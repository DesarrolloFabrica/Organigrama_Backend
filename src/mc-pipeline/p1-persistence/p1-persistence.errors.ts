/**
 * Errores de dominio P1 persistencia — mensajes seguros sin PII/texto CV/prompts.
 */
export const P1_DOMAIN_ERROR_CODES = [
  'RUN_ALREADY_ACTIVE',
  'RUN_ALREADY_COMPLETED',
  'INVALID_RUN_TRANSITION',
  'BATCH_ALREADY_SUCCEEDED',
  'INCOMPLETE_CANDIDATE_COVERAGE',
  'UNSUPPORTED_SPANS_PRESENT',
  'REVIEW_ITEM_REQUIRED',
  'CONFIG_FINGERPRINT_MISMATCH',
  'CURSOR_TARGET_NOT_ELIGIBLE',
  'PERSISTENCE_CONFLICT',
  'UNKNOWN_WARNING_CODE',
  'BATCH_RUN_MISMATCH',
  'SNAPSHOT_NOT_FOUND',
  'MODE_FORBIDS_PERSISTENCE',
  'RUN_NOT_FOUND',
] as const;

export type P1DomainErrorCode = (typeof P1_DOMAIN_ERROR_CODES)[number];

export class P1PersistenceError extends Error {
  readonly code: P1DomainErrorCode;
  readonly retryable: boolean;
  readonly messageSafe: string;
  readonly details?: Record<string, string | number | boolean | null>;

  constructor(params: {
    code: P1DomainErrorCode;
    messageSafe: string;
    retryable?: boolean;
    details?: Record<string, string | number | boolean | null>;
  }) {
    super(params.messageSafe);
    this.name = 'P1PersistenceError';
    this.code = params.code;
    this.messageSafe = params.messageSafe;
    this.retryable = params.retryable ?? false;
    this.details = params.details;
  }
}

export function p1Error(
  code: P1DomainErrorCode,
  messageSafe: string,
  details?: Record<string, string | number | boolean | null>,
  retryable = false,
): P1PersistenceError {
  return new P1PersistenceError({ code, messageSafe, details, retryable });
}
