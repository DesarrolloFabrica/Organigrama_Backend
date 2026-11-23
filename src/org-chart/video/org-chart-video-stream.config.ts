/**
 * Config upstream timeout para video stream.
 */
import { Logger } from '@nestjs/common';
import {
  PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_DEFAULT_MS,
  PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_ENV,
  PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_MAX_MS,
  PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_MIN_MS,
} from './org-chart-video.constants';

const log = new Logger('OrgChartVideoStreamConfig');

export function resolvePersonVideoStreamUpstreamTimeoutMs(
  raw: string | undefined = process.env[PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_ENV],
): number {
  if (raw == null || String(raw).trim() === '') {
    return PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_DEFAULT_MS;
  }
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    log.warn(
      `${PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_ENV} inválido; usando default ${PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_DEFAULT_MS}`,
    );
    return PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_DEFAULT_MS;
  }
  if (
    n < PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_MIN_MS ||
    n > PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_MAX_MS
  ) {
    log.warn(
      `${PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_ENV} fuera de rango; usando default ${PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_DEFAULT_MS}`,
    );
    return PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_DEFAULT_MS;
  }
  return n;
}
