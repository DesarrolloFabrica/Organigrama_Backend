import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedSessionContext } from '../../auth/types/authenticated-session.context';
import { Person } from '../../person/entities/person.entity';
import { getPhotoFetchConcurrency, isRootMockEligible } from './photo.config';
import { PhotoCacheService } from './photo-cache.service';
import { ProfilePhotoLookupService } from './profile-photo-lookup.service';
import { PhotoResolverService } from './photo-resolver.service';
import { PROFILE_PHOTO_SOURCE_GOOGLE } from '../../profile/profile-photo.constants';
import type { PhotoPayload } from './types/photo.types';

@Injectable()
export class OrgChartPhotoService {
  private activeFetches = 0;
  private readonly fetchWaitQueue: Array<() => void> = [];

  constructor(
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    private readonly photoCache: PhotoCacheService,
    private readonly photoResolver: PhotoResolverService,
    private readonly profilePhotoLookup: ProfilePhotoLookupService,
  ) {}

  async getPhotoPayload(
    personId: string,
    session?: AuthenticatedSessionContext,
  ): Promise<PhotoPayload> {
    const normalizedId = personId.trim();
    if (!normalizedId) {
      throw new NotFoundException();
    }

    const person = await this.personRepo.findOne({
      where: { id: normalizedId, is_active: true },
    });
    if (!person) {
      throw new NotFoundException();
    }

    const profilePhotoState =
      await this.profilePhotoLookup.findGooglePhotoState(normalizedId);

    const context = {
      personId: normalizedId,
      edu_email: person.edu_email?.trim().toLowerCase() ?? null,
      isRootMockEligible: isRootMockEligible(normalizedId),
      session,
      profilePhotoSource: profilePhotoState?.profile_photo_source ?? null,
      profilePhotoUrl: profilePhotoState?.profile_photo_url?.trim() ?? null,
    };

    const resolvableProviders =
      this.photoResolver.getResolvableProviders(context);

    for (const provider of resolvableProviders) {
      const cacheKey = provider.getCacheKey(context);
      if (!cacheKey) {
        continue;
      }

      const cached = this.photoCache.getPositive(cacheKey);
      if (cached) {
        return {
          bytes: cached.bytes,
          contentType: cached.contentType,
          source: cached.source,
        };
      }
    }

    const activeCacheKeys = resolvableProviders
      .map((provider) => provider.getCacheKey(context))
      .filter((cacheKey): cacheKey is string => Boolean(cacheKey));

    if (
      activeCacheKeys.length > 0 &&
      activeCacheKeys.every((cacheKey) =>
        Boolean(this.photoCache.getNegative(cacheKey)),
      )
    ) {
      throw new NotFoundException();
    }

    const providersToFetch = resolvableProviders.filter((provider) => {
      const cacheKey = provider.getCacheKey(context);
      return cacheKey && !this.photoCache.getNegative(cacheKey);
    });

    if (providersToFetch.length === 0) {
      throw new NotFoundException();
    }

    await this.acquireFetchSlot();

    try {
      const result = await this.photoResolver.resolve(context, providersToFetch);

      if (!result) {
        for (const provider of providersToFetch) {
          const cacheKey = provider.getCacheKey(context);
          if (cacheKey) {
            this.photoCache.setNegative(cacheKey, 'no-source-available');
          }
        }
        throw new NotFoundException();
      }

      this.photoCache.setPositive(result.cacheKey, result.payload);
      return result.payload;
    } finally {
      this.releaseFetchSlot();
    }
  }

  private async acquireFetchSlot(): Promise<void> {
    const limit = getPhotoFetchConcurrency();
    if (this.activeFetches < limit) {
      this.activeFetches += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.fetchWaitQueue.push(() => {
        this.activeFetches += 1;
        resolve();
      });
    });
  }

  private releaseFetchSlot(): void {
    this.activeFetches = Math.max(0, this.activeFetches - 1);
    const next = this.fetchWaitQueue.shift();
    if (next) {
      next();
    }
  }
}
