/**
 * Configuración del ticket de stream (Fase 3B).
 * Sin fallback a AUTH_JWT_SECRET.
 */
import { Logger } from '@nestjs/common';
import {
  PERSON_VIDEO_STREAM_TICKET_ENV_SECRET,
  PERSON_VIDEO_STREAM_TICKET_ENV_TTL,
  PERSON_VIDEO_STREAM_TICKET_SECRET_MIN_LEN,
  PERSON_VIDEO_STREAM_TICKET_TTL_DEFAULT,
  PERSON_VIDEO_STREAM_TICKET_TTL_MAX,
  PERSON_VIDEO_STREAM_TICKET_TTL_MIN,
} from './org-chart-video.constants';

const configLogger = new Logger('OrgChartVideoTicketConfig');

export type PersonVideoStreamTicketConfig = {
  secret: string;
  ttlSeconds: number;
};

/**
 * Resuelve TTL: default 120; clamp [30, 600]; inválido → 120 + warning.
 */
export function resolvePersonVideoStreamTicketTtlSeconds(
  raw: string | undefined = process.env[PERSON_VIDEO_STREAM_TICKET_ENV_TTL],
): number {
  if (raw == null || String(raw).trim() === '') {
    return PERSON_VIDEO_STREAM_TICKET_TTL_DEFAULT;
  }
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    configLogger.warn(
      `${PERSON_VIDEO_STREAM_TICKET_ENV_TTL} inválido; usando default ${PERSON_VIDEO_STREAM_TICKET_TTL_DEFAULT}`,
    );
    return PERSON_VIDEO_STREAM_TICKET_TTL_DEFAULT;
  }
  if (
    n < PERSON_VIDEO_STREAM_TICKET_TTL_MIN ||
    n > PERSON_VIDEO_STREAM_TICKET_TTL_MAX
  ) {
    configLogger.warn(
      `${PERSON_VIDEO_STREAM_TICKET_ENV_TTL} fuera de rango [${PERSON_VIDEO_STREAM_TICKET_TTL_MIN}, ${PERSON_VIDEO_STREAM_TICKET_TTL_MAX}]; usando default ${PERSON_VIDEO_STREAM_TICKET_TTL_DEFAULT}`,
    );
    return PERSON_VIDEO_STREAM_TICKET_TTL_DEFAULT;
  }
  return n;
}

/**
 * Valida secreto: obligatorio, ≥32 chars. Sin fallback a AUTH_JWT_SECRET.
 * @throws Error de configuración (mensaje sin valor del secreto)
 */
export function resolvePersonVideoStreamTicketSecret(
  raw: string | undefined = process.env[PERSON_VIDEO_STREAM_TICKET_ENV_SECRET],
): string {
  const secret = raw?.trim() ?? '';
  if (!secret) {
    throw new Error(
      `${PERSON_VIDEO_STREAM_TICKET_ENV_SECRET} no está configurado. ` +
        `Defina un secreto ≥${PERSON_VIDEO_STREAM_TICKET_SECRET_MIN_LEN} caracteres ` +
        `(Secret Manager en Cloud Run). No reutilizar AUTH_JWT_SECRET ni credenciales Drive.`,
    );
  }
  if (secret.length < PERSON_VIDEO_STREAM_TICKET_SECRET_MIN_LEN) {
    throw new Error(
      `${PERSON_VIDEO_STREAM_TICKET_ENV_SECRET} debe tener al menos ` +
        `${PERSON_VIDEO_STREAM_TICKET_SECRET_MIN_LEN} caracteres.`,
    );
  }
  return secret;
}

export function loadPersonVideoStreamTicketConfig(
  env: NodeJS.ProcessEnv = process.env,
): PersonVideoStreamTicketConfig {
  return {
    secret: resolvePersonVideoStreamTicketSecret(
      env[PERSON_VIDEO_STREAM_TICKET_ENV_SECRET],
    ),
    ttlSeconds: resolvePersonVideoStreamTicketTtlSeconds(
      env[PERSON_VIDEO_STREAM_TICKET_ENV_TTL],
    ),
  };
}
