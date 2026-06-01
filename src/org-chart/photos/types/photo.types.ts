import type { AuthenticatedSessionContext } from '../../../auth/types/authenticated-session.context';

export type PhotoPayload = {
  bytes: Buffer;
  contentType: string;
  source: PhotoSourceId;
};

export type PhotoSourceId =
  | 'profile-google'
  | 'dev-mock'
  | 'google-workspace'
  | 'session-google'
  | 'local';

export type PhotoResolveContext = {
  personId: string;
  edu_email: string | null;
  isRootMockEligible: boolean;
  session?: AuthenticatedSessionContext;
  profilePhotoSource?: string | null;
  profilePhotoUrl?: string | null;
};

export type PhotoResolveResult = {
  payload: PhotoPayload;
  cacheKey: string;
  providerId: PhotoSourceId;
};

export interface PhotoSourceProvider {
  readonly id: PhotoSourceId;
  readonly priority: number;
  isEnabled(): boolean;
  canResolve(context: PhotoResolveContext): boolean;
  getCacheKey(context: PhotoResolveContext): string | null;
  fetch(context: PhotoResolveContext): Promise<PhotoPayload | null>;
}

export type CachedPhotoEntry = {
  bytes: Buffer;
  contentType: string;
  source: PhotoSourceId;
  fetchedAt: number;
  expiresAt: number;
};

export type NegativePhotoCacheEntry = {
  reason: string;
  checkedAt: number;
  expiresAt: number;
};
