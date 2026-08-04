/**
 * Tipos del streaming de video (Fase 3C).
 */

export type PersonVideoStreamErrorCode =
  | 'STREAM_TICKET_INVALID'
  | 'STREAM_TICKET_EXPIRED'
  | 'STREAM_TARGET_MISMATCH'
  | 'STREAM_VIDEO_NOT_FOUND'
  | 'STREAM_RANGE_INVALID'
  | 'STREAM_DRIVE_NOT_FOUND'
  | 'STREAM_DRIVE_FORBIDDEN'
  | 'STREAM_DRIVE_TIMEOUT'
  | 'STREAM_DRIVE_RATE_LIMIT'
  | 'STREAM_DRIVE_NETWORK'
  | 'STREAM_CLIENT_ABORTED'
  | 'STREAM_PIPE_ERROR';

export class PersonVideoStreamHttpError extends Error {
  readonly httpStatus: number;
  readonly code: PersonVideoStreamErrorCode;
  /** Header extra (p. ej. Content-Range en 416). */
  readonly headers?: Record<string, string>;

  constructor(
    httpStatus: number,
    code: PersonVideoStreamErrorCode,
    message: string,
    headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'PersonVideoStreamHttpError';
    this.httpStatus = httpStatus;
    this.code = code;
    this.headers = headers;
  }
}

/** Fila interna para stream (incluye drive_file_id solo en servidor). */
export type PersonVideoStreamRow = {
  id: string;
  person_id: string;
  is_active: boolean;
  drive_file_id: string;
  mime_type: string | null;
  drive_file_size: string | number | null;
};
