/**
 * Provider de foto de perfil desde disco: `public/profile-photos/{personId}.*`
 * Prioridad entre persistidas (upload/google) y mock/workspace.
 */
import { readFile } from 'node:fs/promises';
import { Injectable } from '@nestjs/common';
import { isOrgChartPhotosEnabled } from '../photo.config';
import { LocalProfilePhotosIndex } from '../local-profile-photos.index';
import type {
  PhotoPayload,
  PhotoResolveContext,
  PhotoSourceProvider,
} from '../types/photo.types';

@Injectable()
export class LocalDiskProfilePhotoProvider implements PhotoSourceProvider {
  readonly id = 'local' as const;
  /** Después de upload (5) y google persistido (10); antes de mock (20). */
  readonly priority = 15;

  constructor(private readonly localPhotos: LocalProfilePhotosIndex) {}

  isEnabled(): boolean {
    return isOrgChartPhotosEnabled();
  }

  canResolve(context: PhotoResolveContext): boolean {
    return this.localPhotos.has(context.personId);
  }

  getCacheKey(context: PhotoResolveContext): string | null {
    const entry = this.localPhotos.get(context.personId);
    if (!entry) return null;
    return `${context.personId}:local:${entry.fileName}`;
  }

  async fetch(context: PhotoResolveContext): Promise<PhotoPayload | null> {
    const entry = this.localPhotos.get(context.personId);
    if (!entry) return null;

    try {
      const bytes = await readFile(entry.absolutePath);
      if (bytes.length === 0) return null;
      return {
        bytes,
        contentType: entry.contentType,
        source: this.id,
      };
    } catch {
      return null;
    }
  }
}
