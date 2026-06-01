import { Injectable, Logger } from '@nestjs/common';
import { DevMockPhotoProvider } from './providers/dev-mock-photo.provider';
import { GoogleWorkspaceDirectoryPhotoProvider } from './providers/google-workspace-directory-photo.provider';
import { PersistedGoogleProfilePhotoProvider } from './providers/persisted-google-profile-photo.provider';
import { SessionGoogleLoginPhotoProvider } from './providers/session-google-login-photo.provider';
import type {
  PhotoResolveContext,
  PhotoResolveResult,
  PhotoSourceProvider,
} from './types/photo.types';

@Injectable()
export class PhotoResolverService {
  private readonly log = new Logger(PhotoResolverService.name);
  private readonly providers: PhotoSourceProvider[];

  constructor(
    persistedGoogleProfilePhotoProvider: PersistedGoogleProfilePhotoProvider,
    devMockPhotoProvider: DevMockPhotoProvider,
    googleWorkspaceDirectoryPhotoProvider: GoogleWorkspaceDirectoryPhotoProvider,
    sessionGoogleLoginPhotoProvider: SessionGoogleLoginPhotoProvider,
  ) {
    this.providers = [
      persistedGoogleProfilePhotoProvider,
      devMockPhotoProvider,
      googleWorkspaceDirectoryPhotoProvider,
      sessionGoogleLoginPhotoProvider,
    ].sort((a, b) => a.priority - b.priority);
  }

  getResolvableProviders(context: PhotoResolveContext): PhotoSourceProvider[] {
    return this.providers.filter(
      (provider) => provider.isEnabled() && provider.canResolve(context),
    );
  }

  async resolve(
    context: PhotoResolveContext,
    providers?: PhotoSourceProvider[],
  ): Promise<PhotoResolveResult | null> {
    const candidates = providers ?? this.getResolvableProviders(context);

    for (const provider of candidates) {
      const cacheKey = provider.getCacheKey(context);
      if (!cacheKey) {
        continue;
      }

      try {
        const payload = await provider.fetch(context);
        if (payload) {
          if (process.env.NODE_ENV === 'development') {
            this.log.debug(`[PhotoResolver] provider=${provider.id}`);
          }
          return {
            payload,
            cacheKey,
            providerId: provider.id,
          };
        }
      } catch (err) {
        this.log.warn(
          `Provider ${provider.id} falló para personId=${context.personId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return null;
  }
}
