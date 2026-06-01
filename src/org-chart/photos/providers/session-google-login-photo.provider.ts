import { Injectable } from '@nestjs/common';
import type {
  PhotoPayload,
  PhotoResolveContext,
  PhotoSourceProvider,
} from '../types/photo.types';

/**
 * Stub Fase C — foto del usuario autenticado vía login Google.
 * Deshabilitado hasta existir módulo de auth.
 */
@Injectable()
export class SessionGoogleLoginPhotoProvider implements PhotoSourceProvider {
  readonly id = 'session-google' as const;
  readonly priority = 40;

  isEnabled(): boolean {
    return true;
  }

  canResolve(context: PhotoResolveContext): boolean {
    return (
      Boolean(context.session?.personId) &&
      context.session!.personId === context.personId &&
      Boolean(context.session!.googlePictureUrl?.trim())
    );
  }

  getCacheKey(context: PhotoResolveContext): string | null {
    const pictureUrl = context.session?.googlePictureUrl?.trim();
    if (
      !pictureUrl ||
      context.session?.personId !== context.personId
    ) {
      return null;
    }
    return `${context.personId}:session-google:${pictureUrl}`;
  }

  async fetch(context: PhotoResolveContext): Promise<PhotoPayload | null> {
    const pictureUrl = context.session?.googlePictureUrl?.trim();
    if (!pictureUrl) {
      return null;
    }

    const response = await fetch(pictureUrl);
    if (!response.ok) {
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    const contentType =
      response.headers.get('content-type')?.split(';')[0]?.trim() ||
      'image/jpeg';

    return {
      bytes,
      contentType,
      source: this.id,
    };
  }
}
