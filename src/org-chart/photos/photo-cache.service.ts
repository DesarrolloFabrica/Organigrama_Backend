import { Injectable, Logger } from '@nestjs/common';
import { getPhotoCacheTtlMs, getPhotoNegativeCacheTtlMs } from './photo.config';
import type {
  CachedPhotoEntry,
  NegativePhotoCacheEntry,
  PhotoPayload,
} from './types/photo.types';

@Injectable()
export class PhotoCacheService {
  private readonly log = new Logger(PhotoCacheService.name);
  private readonly positive = new Map<string, CachedPhotoEntry>();
  private readonly negative = new Map<string, NegativePhotoCacheEntry>();

  getPositive(cacheKey: string): CachedPhotoEntry | null {
    this.pruneExpired();
    const entry = this.positive.get(cacheKey);
    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) {
        this.positive.delete(cacheKey);
      }
      this.logDev('MISS', cacheKey);
      return null;
    }
    this.logDev('HIT positive', cacheKey);
    return entry;
  }

  getNegative(cacheKey: string): NegativePhotoCacheEntry | null {
    this.pruneExpired();
    const entry = this.negative.get(cacheKey);
    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) {
        this.negative.delete(cacheKey);
      }
      return null;
    }
    return entry;
  }

  setPositive(cacheKey: string, payload: PhotoPayload): void {
    const now = Date.now();
    this.positive.set(cacheKey, {
      bytes: payload.bytes,
      contentType: payload.contentType,
      source: payload.source,
      fetchedAt: now,
      expiresAt: now + getPhotoCacheTtlMs(),
    });
    this.negative.delete(cacheKey);
    this.logDev('SET positive', cacheKey);
  }

  invalidateForPerson(personId: string): void {
    const prefix = `${personId}:`;
    for (const key of this.positive.keys()) {
      if (key.startsWith(prefix)) {
        this.positive.delete(key);
      }
    }
    for (const key of this.negative.keys()) {
      if (key.startsWith(prefix)) {
        this.negative.delete(key);
      }
    }
    this.logDev('INVALIDATE', prefix);
  }

  setNegative(cacheKey: string, reason: string): void {
    const now = Date.now();
    this.negative.set(cacheKey, {
      reason,
      checkedAt: now,
      expiresAt: now + getPhotoNegativeCacheTtlMs(),
    });
    this.logDev('SET negative', cacheKey);
  }

  private logDev(event: string, cacheKey: string): void {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }
    this.log.debug(`[PhotoCache] ${event} key=${cacheKey}`);
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.positive.entries()) {
      if (entry.expiresAt <= now) {
        this.positive.delete(key);
      }
    }
    for (const [key, entry] of this.negative.entries()) {
      if (entry.expiresAt <= now) {
        this.negative.delete(key);
      }
    }
  }
}
