import { Injectable } from '@nestjs/common';
import { PROFILE_PHOTO_SOURCE_GOOGLE } from '../../../profile/profile-photo.constants';
import { ProfilePhotoLookupService } from '../profile-photo-lookup.service';
import { isOrgChartPhotosEnabled } from '../photo.config';
import type {
  PhotoPayload,
  PhotoResolveContext,
  PhotoSourceProvider,
} from '../types/photo.types';

@Injectable()
export class PersistedGoogleProfilePhotoProvider implements PhotoSourceProvider {
  readonly id = 'profile-google' as const;
  readonly priority = 10;

  constructor(private readonly profilePhotoLookup: ProfilePhotoLookupService) {}

  isEnabled(): boolean {
    return isOrgChartPhotosEnabled();
  }

  canResolve(context: PhotoResolveContext): boolean {
    if (context.profilePhotoSource === PROFILE_PHOTO_SOURCE_GOOGLE) {
      return Boolean(context.profilePhotoUrl?.trim());
    }

    return false;
  }

  getCacheKey(context: PhotoResolveContext): string | null {
    const url = context.profilePhotoUrl?.trim();
    if (
      context.profilePhotoSource !== PROFILE_PHOTO_SOURCE_GOOGLE ||
      !url
    ) {
      return null;
    }

    return `${context.personId}:profile-google:${url}`;
  }

  async fetch(context: PhotoResolveContext): Promise<PhotoPayload | null> {
    const pictureUrl = context.profilePhotoUrl?.trim();
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
