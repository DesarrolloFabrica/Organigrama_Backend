import type { MetricBucket } from './observatory.types';

/** Buckets versionados V1 — umbrales fijos para comparación. */
export const BUCKET_POLICY_VERSION = '1.0.0';

export function bucketByThresholds(
  value: number | null | undefined,
  low: number,
  medium: number,
  high: number,
): MetricBucket {
  if (value == null || Number.isNaN(value)) return 'LOW';
  if (value < low) return 'LOW';
  if (value < medium) return 'MEDIUM';
  if (value < high) return 'HIGH';
  return 'VERY_HIGH';
}

export function pageCountBucket(n: number | null): MetricBucket {
  return bucketByThresholds(n, 2, 4, 8);
}

export function characterCountBucket(n: number | null): MetricBucket {
  return bucketByThresholds(n, 2000, 6000, 15000);
}

export function perPageBucket(n: number | null): MetricBucket {
  return bucketByThresholds(n, 5, 15, 30);
}
