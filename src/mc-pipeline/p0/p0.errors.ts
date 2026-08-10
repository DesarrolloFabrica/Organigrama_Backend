/**
 * Errores tipados P0 — mensajes seguros sin PII ni raw text.
 */
export type P0ErrorStage =
  | 'MDE_GUARD'
  | 'DRIVE'
  | 'EXTRACT'
  | 'NORMALIZE'
  | 'SECTIONS'
  | 'PERSIST'
  | 'IDEMPOTENCY';

export type P0ErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'PDF_PARSE_FAILED'
  | 'EMPTY_DOCUMENT'
  | 'SCANNED_OR_IMAGE_ONLY'
  | 'NORMALIZATION_FAILED'
  | 'SNAPSHOT_PERSIST_FAILED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'MDE_GUARD_FAILED'
  | 'INVALID_INPUT'
  | 'ACTIVE_CV_NOT_FOUND'
  | 'DRIVE_FILE_NOT_FOUND'
  | 'DRIVE_DOWNLOAD_FAILED'
  | 'DRIVE_TIMEOUT';

export class P0SnapshotError extends Error {
  readonly code: P0ErrorCode;
  readonly stage: P0ErrorStage;
  readonly retryable: boolean;
  readonly messageSafe: string;
  readonly technicalCause?: string;

  constructor(params: {
    code: P0ErrorCode;
    stage: P0ErrorStage;
    retryable: boolean;
    messageSafe: string;
    technicalCause?: string;
  }) {
    super(params.messageSafe);
    this.name = 'P0SnapshotError';
    this.code = params.code;
    this.stage = params.stage;
    this.retryable = params.retryable;
    this.messageSafe = params.messageSafe;
    this.technicalCause = params.technicalCause;
  }
}

export function mdeGuardFailed(detailSafe: string): P0SnapshotError {
  return new P0SnapshotError({
    code: 'MDE_GUARD_FAILED',
    stage: 'MDE_GUARD',
    retryable: false,
    messageSafe: `MDE guard failed: ${detailSafe}`,
  });
}
