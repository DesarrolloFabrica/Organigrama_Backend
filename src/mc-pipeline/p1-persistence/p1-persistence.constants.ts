/** Allowlist alineada a DDL `WARNING_POLICY_VERSION=1.0.0`. */
export const P1_WARNING_POLICY_VERSION = '1.0.0';

export const P1_ALLOWED_WARNING_CODES = [
  'P0_PARSE_WARNING_PRESENT',
  'HIGH_REVIEW_RATIO',
  'BATCH_RETRY_USED',
  'SEGMENTER_HEADING_SPARSE',
] as const;

export type P1AllowedWarningCode = (typeof P1_ALLOWED_WARNING_CODES)[number];

/** Lease objetivo para batch RUNNING abandonado (no basta reinicio de proceso). */
export const P1_BATCH_RUNNING_LEASE_MS = 30 * 60 * 1000;

export const P1_CONTRACT_CODE = 'MC1.P1.EVIDENCE' as const;
