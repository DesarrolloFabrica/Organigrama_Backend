import { Injectable } from '@nestjs/common';
import {
  getGoogleWorkspaceAdminEmail,
  loadServiceAccountCredentials,
} from './google-workspace.config';
import { GoogleWorkspaceAuthService } from './google-workspace-auth.service';
import type {
  GoogleApiErrorDetail,
  PhotoBytesProbe,
  PhotoDiagnosticResult,
} from './types/photo-diagnostic-result.type';

@Injectable()
export class GoogleWorkspacePhotoDiagnosticService {
  constructor(
    private readonly googleWorkspaceAuth: GoogleWorkspaceAuthService,
  ) {}

  async diagnose(eduEmailInput: string): Promise<PhotoDiagnosticResult> {
    const edu_email = eduEmailInput.trim().toLowerCase();
    const errors: GoogleApiErrorDetail[] = [];
    const photoProbes: PhotoBytesProbe[] = [];

    const credentials = loadServiceAccountCredentials();
    const adminEmail = getGoogleWorkspaceAdminEmail();

    const result: PhotoDiagnosticResult = {
      edu_email,
      timestamp: new Date().toISOString(),
      configuration: {
        serviceAccountConfigured: Boolean(credentials),
        adminEmailConfigured: Boolean(adminEmail),
        domainWideDelegationSubject: adminEmail,
      },
      userExists: null,
      primaryEmail: null,
      hasThumbnailPhotoUrl: false,
      thumbnailPhotoUrl: null,
      hasPhotoInDirectory: false,
      photoProbes,
      summary: {
        canFetchPhotoBytes: false,
        recommendedContentType: null,
        recommendedByteLength: null,
      },
      errors,
    };

    if (!credentials || !adminEmail) {
      errors.push({
        message:
          'Faltan credenciales Google: GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_SERVICE_ACCOUNT_KEY_PATH, y GOOGLE_WORKSPACE_ADMIN_EMAIL',
      });
      return result;
    }

    let directory;
    try {
      directory = this.googleWorkspaceAuth.createDirectoryClient();
    } catch (err) {
      errors.push(toGoogleApiErrorDetail(err));
      return result;
    }

    let userExists: boolean | null = null;
    let primaryEmail: string | null = null;
    let thumbnailPhotoUrl: string | null = null;

    try {
      const userResponse = await directory.users.get({
        userKey: edu_email,
        projection: 'full',
      });
      userExists = true;
      primaryEmail = userResponse.data.primaryEmail ?? null;
      thumbnailPhotoUrl = userResponse.data.thumbnailPhotoUrl ?? null;
    } catch (err) {
      const detail = toGoogleApiErrorDetail(err);
      errors.push(detail);
      if (detail.code === 404) {
        userExists = false;
      }
    }

    result.userExists = userExists;
    result.primaryEmail = primaryEmail;
    result.thumbnailPhotoUrl = thumbnailPhotoUrl;
    result.hasThumbnailPhotoUrl = Boolean(thumbnailPhotoUrl);

    if (userExists !== true) {
      return result;
    }

    photoProbes.push(await this.probeDirectoryPhoto(directory, edu_email));

    if (thumbnailPhotoUrl) {
      photoProbes.push(await this.probeThumbnailUrl(thumbnailPhotoUrl));
    }

    result.hasPhotoInDirectory = photoProbes.some(
      (probe) => probe.success && (probe.byteLength ?? 0) > 0,
    );

    const successfulProbe = photoProbes.find(
      (probe) => probe.success && (probe.byteLength ?? 0) > 0,
    );
    result.summary = {
      canFetchPhotoBytes: Boolean(successfulProbe),
      recommendedContentType: successfulProbe?.contentType ?? null,
      recommendedByteLength: successfulProbe?.byteLength ?? null,
    };

    return result;
  }

  private async probeDirectoryPhoto(
    directory: ReturnType<GoogleWorkspaceAuthService['createDirectoryClient']>,
    edu_email: string,
  ): Promise<PhotoBytesProbe> {
    const source = 'photos.get' as const;

    try {
      const response = await directory.users.photos.get({
        userKey: edu_email,
      });

      const photoData = response.data.photoData;
      if (!photoData) {
        return {
          source,
          success: false,
          contentType: response.data.mimeType ?? null,
          byteLength: null,
          width: response.data.width ?? null,
          height: response.data.height ?? null,
          error: {
            message: 'Google respondió sin photoData',
          },
        };
      }

      const bytes = Buffer.from(photoData, 'base64');

      return {
        source,
        success: bytes.length > 0,
        contentType: response.data.mimeType ?? 'application/octet-stream',
        byteLength: bytes.length,
        width: response.data.width ?? null,
        height: response.data.height ?? null,
        error: null,
      };
    } catch (err) {
      return {
        source,
        success: false,
        contentType: null,
        byteLength: null,
        width: null,
        height: null,
        error: toGoogleApiErrorDetail(err),
      };
    }
  }

  private async probeThumbnailUrl(
    thumbnailPhotoUrl: string,
  ): Promise<PhotoBytesProbe> {
    try {
      const headers = await this.googleWorkspaceAuth.getAuthorizedFetchHeaders();
      const response = await fetch(thumbnailPhotoUrl, { headers });

      if (!response.ok) {
        return {
          source: 'thumbnailPhotoUrl',
          success: false,
          contentType: response.headers.get('content-type'),
          byteLength: null,
          width: null,
          height: null,
          error: {
            code: response.status,
            status: response.statusText,
            message: `HTTP ${response.status} al descargar thumbnailPhotoUrl`,
          },
        };
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      return {
        source: 'thumbnailPhotoUrl',
        success: buffer.length > 0,
        contentType:
          response.headers.get('content-type') ?? 'application/octet-stream',
        byteLength: buffer.length,
        width: null,
        height: null,
        error: null,
      };
    } catch (err) {
      return {
        source: 'thumbnailPhotoUrl',
        success: false,
        contentType: null,
        byteLength: null,
        width: null,
        height: null,
        error: toGoogleApiErrorDetail(err),
      };
    }
  }
}

function toGoogleApiErrorDetail(err: unknown): GoogleApiErrorDetail {
  if (isGaxiosLikeError(err)) {
    const apiError = err.response?.data?.error;
    const firstReason = apiError?.errors?.[0]?.reason;
    const statusCode = err.response?.status;
    const numericCode =
      typeof statusCode === 'number'
        ? statusCode
        : typeof err.code === 'number'
          ? err.code
          : undefined;

    return {
      code: numericCode,
      status: apiError?.status ?? err.response?.statusText,
      message: apiError?.message ?? err.message ?? 'Error desconocido de Google',
      reason: firstReason,
    };
  }

  if (err instanceof Error) {
    return { message: err.message };
  }

  return { message: String(err) };
}

type GaxiosLikeError = {
  message?: string;
  code?: number | string;
  response?: {
    status?: number;
    statusText?: string;
    data?: {
      error?: {
        message?: string;
        status?: string;
        errors?: Array<{ reason?: string }>;
      };
    };
  };
};

function isGaxiosLikeError(err: unknown): err is GaxiosLikeError {
  return (
    typeof err === 'object' &&
    err !== null &&
    ('response' in err || 'code' in err)
  );
}
