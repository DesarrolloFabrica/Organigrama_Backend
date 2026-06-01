import { Injectable } from '@nestjs/common';
import { isGoogleWorkspacePhotosEnabled } from '../photo.config';
import type {
  PhotoPayload,
  PhotoResolveContext,
  PhotoSourceProvider,
} from '../types/photo.types';

/**
 * Stub Fase A — implementación real en Fase B (post-DWD).
 * Cuando GOOGLE_WORKSPACE_PHOTOS_ENABLED=true retorna null hasta conectar
 * GoogleWorkspacePhotoService.
 */
@Injectable()
export class GoogleWorkspaceDirectoryPhotoProvider
  implements PhotoSourceProvider
{
  readonly id = 'google-workspace' as const;
  readonly priority = 30;

  isEnabled(): boolean {
    return isGoogleWorkspacePhotosEnabled();
  }

  canResolve(context: PhotoResolveContext): boolean {
    return Boolean(context.edu_email?.trim());
  }

  getCacheKey(context: PhotoResolveContext): string | null {
    const email = context.edu_email?.trim().toLowerCase();
    if (!email) {
      return null;
    }
    return `${context.personId}:google-workspace:${email}`;
  }

  async fetch(_context: PhotoResolveContext): Promise<PhotoPayload | null> {
    return null;
  }
}
