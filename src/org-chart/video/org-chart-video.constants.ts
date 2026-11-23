/**
 * Constantes del módulo de video de presentación (metadatos + ticket).
 */

export const PERSON_VIDEO_GENERIC_FILE_NAME = 'Video de presentación';

/** Longitud máxima del fileName expuesto al cliente. */
export const PERSON_VIDEO_FILE_NAME_MAX_LEN = 120;

export const PERSON_VIDEO_LOG_TAG = '[OrgChartVideo]';

/** Propósito criptográfico del ticket de stream (distinto del JWT de sesión). */
export const PERSON_VIDEO_STREAM_PURPOSE = 'person-video-stream' as const;

export const PERSON_VIDEO_STREAM_TICKET_VERSION = 1 as const;

export const PERSON_VIDEO_STREAM_TICKET_ALG = 'HS256' as const;

/** TTL por defecto (segundos). */
export const PERSON_VIDEO_STREAM_TICKET_TTL_DEFAULT = 120;

export const PERSON_VIDEO_STREAM_TICKET_TTL_MIN = 30;

export const PERSON_VIDEO_STREAM_TICKET_TTL_MAX = 600;

/** Longitud mínima del secreto de firma. */
export const PERSON_VIDEO_STREAM_TICKET_SECRET_MIN_LEN = 32;

export const PERSON_VIDEO_STREAM_TICKET_ENV_SECRET =
  'PERSON_VIDEO_STREAM_TICKET_SECRET';

export const PERSON_VIDEO_STREAM_TICKET_ENV_TTL =
  'PERSON_VIDEO_STREAM_TICKET_TTL_SECONDS';

/** Timeout de apertura upstream Drive (ms). */
export const PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_DEFAULT_MS = 20_000;

export const PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_MIN_MS = 5_000;

export const PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_MAX_MS = 60_000;

export const PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_ENV =
  'PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_MS';

/** MIME permitidos para stream. */
export const PERSON_VIDEO_ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);
