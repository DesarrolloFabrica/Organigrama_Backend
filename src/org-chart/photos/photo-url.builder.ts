import { Injectable } from '@nestjs/common';
import type { Person } from '../../person/entities/person.entity';
import {
  getApiPublicBaseUrl,
  getOrgChartPhotoTestUrl,
  isGoogleWorkspacePhotosEnabled,
  isOrgChartPhotosEnabled,
  isRootMockEligible,
  ORG_CHART_ROOT_PERSON_ID,
} from './photo.config';
import { LocalProfilePhotosIndex } from './local-profile-photos.index';

@Injectable()
export class PhotoUrlBuilder {
  constructor(private readonly localPhotos: LocalProfilePhotosIndex) {}

  /**
   * Reglas de photoUrl en JSON (síncrono, sin I/O):
   * - ORG_CHART_PHOTOS_ENABLED=false → mock directo legacy solo en root.
   * - ORG_CHART_PHOTOS_ENABLED=true + mock root / Google / foto local → URL proxy.
   * - Resto → null.
   */
  buildPhotoUrl(person: Person): string | null {
    if (!isOrgChartPhotosEnabled()) {
      return this.buildLegacyDirectPhotoUrl(person);
    }

    if (this.shouldExposeProxyUrl(person)) {
      return `${getApiPublicBaseUrl()}/api/org-chart/photos/${person.id}`;
    }

    return null;
  }

  buildLegacyDirectPhotoUrl(person: Person): string | null {
    const testUrl = getOrgChartPhotoTestUrl();
    if (!testUrl || String(person.id) !== ORG_CHART_ROOT_PERSON_ID) {
      return null;
    }
    return testUrl;
  }

  shouldExposeProxyUrl(
    person: Person,
    hasPersistedGooglePhoto = false,
  ): boolean {
    if (hasPersistedGooglePhoto) {
      return true;
    }

    if (isRootMockEligible(String(person.id))) {
      return true;
    }

    if (this.hasLocalDiskPhoto(person.id)) {
      return true;
    }

    if (isGoogleWorkspacePhotosEnabled() && Boolean(person.edu_email?.trim())) {
      return true;
    }

    return false;
  }

  hasLocalDiskPhoto(personId: string | number): boolean {
    return this.localPhotos.has(String(personId));
  }
}
