import { Injectable } from '@nestjs/common';
import {
  getOrgChartPhotoTestUrl,
  isRootMockEligible,
} from '../photo.config';
import type {
  PhotoPayload,
  PhotoResolveContext,
  PhotoSourceProvider,
} from '../types/photo.types';

export function buildDevMockCacheKey(
  personId: string,
  mockUrl: string,
): string {
  return `${personId}:${mockUrl}`;
}

@Injectable()
export class DevMockPhotoProvider implements PhotoSourceProvider {
  readonly id = 'dev-mock' as const;
  readonly priority = 20;

  isEnabled(): boolean {
    return Boolean(getOrgChartPhotoTestUrl());
  }

  canResolve(context: PhotoResolveContext): boolean {
    return context.isRootMockEligible;
  }

  getCacheKey(context: PhotoResolveContext): string | null {
    const mockUrl = getOrgChartPhotoTestUrl();
    if (!context.isRootMockEligible || !mockUrl) {
      return null;
    }
    return buildDevMockCacheKey(context.personId, mockUrl);
  }

  async fetch(context: PhotoResolveContext): Promise<PhotoPayload | null> {
    if (!isRootMockEligible(context.personId)) {
      return null;
    }

    const testUrl = getOrgChartPhotoTestUrl();
    if (!testUrl) {
      return null;
    }

    const response = await fetch(testUrl);
    if (!response.ok) {
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) {
      return null;
    }

    return {
      bytes,
      contentType:
        response.headers.get('content-type') ?? 'application/octet-stream',
      source: this.id,
    };
  }
}
