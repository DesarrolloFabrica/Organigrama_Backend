export type GoogleApiErrorDetail = {
  code?: number;
  status?: string;
  message: string;
  reason?: string;
};

export type PhotoBytesProbe = {
  source: 'photos.get' | 'thumbnailPhotoUrl';
  success: boolean;
  contentType: string | null;
  byteLength: number | null;
  width: number | null;
  height: number | null;
  error: GoogleApiErrorDetail | null;
};

export type PhotoDiagnosticResult = {
  edu_email: string;
  timestamp: string;
  configuration: {
    serviceAccountConfigured: boolean;
    adminEmailConfigured: boolean;
    domainWideDelegationSubject: string | null;
  };
  userExists: boolean | null;
  primaryEmail: string | null;
  hasThumbnailPhotoUrl: boolean;
  thumbnailPhotoUrl: string | null;
  hasPhotoInDirectory: boolean;
  photoProbes: PhotoBytesProbe[];
  summary: {
    canFetchPhotoBytes: boolean;
    recommendedContentType: string | null;
    recommendedByteLength: number | null;
  };
  errors: GoogleApiErrorDetail[];
};
