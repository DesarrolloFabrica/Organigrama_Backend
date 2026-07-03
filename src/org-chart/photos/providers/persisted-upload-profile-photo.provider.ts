import { Injectable, Logger } from '@nestjs/common';
import { PROFILE_PHOTO_SOURCE_GOOGLE } from '../../../profile/profile-photo.constants';
import { getPublicAssetBaseUrl, isOrgChartPhotosEnabled } from '../photo.config';
import { resolvePublicPhotoUrl } from '../profile-photo-url.util';
import type {
  PhotoPayload,
  PhotoResolveContext,
  PhotoSourceProvider,
} from '../types/photo.types';

/**
 * Provider para fotos de perfil "directas" (no-Google), p. ej. subidas
 * (`source='upload'`) cuya `profile_photo_url` es una URL pública.
 * Resuelve la URL (absoluta tal cual; root-relativa contra la base pública)
 * y la sirve a través del proxy.
 */
@Injectable()
export class PersistedUploadProfilePhotoProvider implements PhotoSourceProvider {
  readonly id = 'profile-upload' as const;
  readonly priority = 5;

  private readonly log = new Logger(PersistedUploadProfilePhotoProvider.name);

  isEnabled(): boolean {
    return isOrgChartPhotosEnabled();
  }

  canResolve(context: PhotoResolveContext): boolean {
    return this.resolveUrl(context) != null;
  }

  getCacheKey(context: PhotoResolveContext): string | null {
    const url = this.resolveUrl(context);
    if (!url) {
      return null;
    }
    return `${context.personId}:profile-upload:${url}`;
  }

  async fetch(context: PhotoResolveContext): Promise<PhotoPayload | null> {
    const url = this.resolveUrl(context);
    if (!url) {
      return null;
    }

    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) {
      return null;
    }

    const contentType =
      response.headers.get('content-type')?.split(';')[0]?.trim() ||
      'image/jpeg';

    return {
      bytes,
      contentType,
      source: this.id,
    };
  }

  private resolveUrl(context: PhotoResolveContext): string | null {
    if (context.profilePhotoSource === PROFILE_PHOTO_SOURCE_GOOGLE) {
      return null;
    }
    if (!context.profilePhotoUrl?.trim()) {
      return null;
    }

    return resolvePublicPhotoUrl(context.profilePhotoUrl, {
      personId: context.personId,
      source: context.profilePhotoSource ?? null,
      publicBaseUrl: getPublicAssetBaseUrl(),
      logger: this.log,
    });
  }
}
