/**
 * Cliente Drive readonly para streaming de media (Fase 3C).
 *
 * Reutiliza la credencial OAuth de CV (`createDriveCvClient` / GOOGLE_DRIVE_CV_TOKEN_PATH)
 * pero NO usa downloadCvPdfBuffer (Buffer completo).
 *
 * No expone drive_file_id hacia el controlador HTTP.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { Readable } from 'node:stream';
import type { drive_v3 } from 'googleapis';
import { createDriveCvClient } from '../../database/scripts/utils/google-drive-cv-client';
import { resolvePersonVideoStreamUpstreamTimeoutMs } from './org-chart-video-stream.config';

export type DriveMediaStreamOpenInput = {
  /** Solo uso interno del cliente; no se propaga en errores públicos. */
  fileId: string;
  rangeHeader?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Inyección para tests. */
  drive?: drive_v3.Drive;
};

export type DriveMediaStreamSuccess = {
  ok: true;
  status: number;
  body: Readable;
  contentType: string | null;
  contentLength: number | null;
  contentRange: string | null;
  acceptRanges: string | null;
};

export type DriveMediaStreamFailureCode =
  | 'DRIVE_NOT_FOUND'
  | 'DRIVE_FORBIDDEN'
  | 'DRIVE_RATE_LIMIT'
  | 'DRIVE_TIMEOUT'
  | 'DRIVE_RANGE_REJECTED'
  | 'DRIVE_NETWORK'
  | 'DRIVE_UNEXPECTED';

export type DriveMediaStreamFailure = {
  ok: false;
  code: DriveMediaStreamFailureCode;
  upstreamStatus?: number;
};

export type DriveMediaStreamResult =
  | DriveMediaStreamSuccess
  | DriveMediaStreamFailure;

@Injectable()
export class OrgChartVideoDriveStreamClient {
  private readonly logger = new Logger(OrgChartVideoDriveStreamClient.name);

  async openMediaStream(
    input: DriveMediaStreamOpenInput,
  ): Promise<DriveMediaStreamResult> {
    const timeoutMs =
      input.timeoutMs ?? resolvePersonVideoStreamUpstreamTimeoutMs();

    let drive: drive_v3.Drive;
    try {
      drive = input.drive ?? createDriveCvClient();
    } catch (err) {
      this.logger.error(
        `[OrgChartVideoDrive] OAuth client unavailable: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { ok: false, code: 'DRIVE_FORBIDDEN' };
    }

    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

    const onOuterAbort = () => timeoutController.abort();
    if (input.signal) {
      if (input.signal.aborted) {
        clearTimeout(timer);
        return { ok: false, code: 'DRIVE_NETWORK' };
      }
      input.signal.addEventListener('abort', onOuterAbort, { once: true });
    }

    try {
      const headers: Record<string, string> = {};
      if (input.rangeHeader) {
        headers.Range = input.rangeHeader;
      }

      const response = await drive.files.get(
        {
          fileId: input.fileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        {
          responseType: 'stream',
          headers,
          signal: timeoutController.signal,
        },
      );

      clearTimeout(timer);
      input.signal?.removeEventListener('abort', onOuterAbort);

      const status = response.status ?? 200;
      const h = normalizeHeaders(response.headers as Record<string, unknown>);

      if (status === 416) {
        destroyQuiet(response.data as Readable);
        return {
          ok: false,
          code: 'DRIVE_RANGE_REJECTED',
          upstreamStatus: 416,
        };
      }

      if (status !== 200 && status !== 206) {
        destroyQuiet(response.data as Readable);
        return mapUnexpectedStatus(status);
      }

      return {
        ok: true,
        status,
        body: response.data as Readable,
        contentType: h['content-type'] ?? null,
        contentLength: parseLength(h['content-length']),
        contentRange: h['content-range'] ?? null,
        acceptRanges: h['accept-ranges'] ?? null,
      };
    } catch (err) {
      clearTimeout(timer);
      input.signal?.removeEventListener('abort', onOuterAbort);
      return mapDriveError(err, this.logger);
    }
  }
}

function normalizeHeaders(
  headers: Record<string, unknown> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const [k, v] of Object.entries(headers)) {
    if (v == null) continue;
    const key = k.toLowerCase();
    if (Array.isArray(v)) {
      out[key] = String(v[0] ?? '');
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

function parseLength(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function destroyQuiet(stream: Readable | undefined) {
  try {
    stream?.destroy();
  } catch {
    /* ignore */
  }
}

function mapUnexpectedStatus(status: number): DriveMediaStreamFailure {
  if (status === 404) return { ok: false, code: 'DRIVE_NOT_FOUND', upstreamStatus: status };
  if (status === 403) return { ok: false, code: 'DRIVE_FORBIDDEN', upstreamStatus: status };
  if (status === 429) return { ok: false, code: 'DRIVE_RATE_LIMIT', upstreamStatus: status };
  return { ok: false, code: 'DRIVE_UNEXPECTED', upstreamStatus: status };
}

function mapDriveError(
  err: unknown,
  logger: Logger,
): DriveMediaStreamFailure {
  const anyErr = err as {
    code?: number | string;
    response?: { status?: number };
    name?: string;
    message?: string;
  };

  if (
    anyErr?.name === 'AbortError' ||
    /aborted|timeout/i.test(String(anyErr?.message ?? ''))
  ) {
    return { ok: false, code: 'DRIVE_TIMEOUT' };
  }

  const status =
    typeof anyErr?.response?.status === 'number'
      ? anyErr.response.status
      : typeof anyErr?.code === 'number'
        ? anyErr.code
        : undefined;

  if (status === 404) return { ok: false, code: 'DRIVE_NOT_FOUND', upstreamStatus: 404 };
  if (status === 403) return { ok: false, code: 'DRIVE_FORBIDDEN', upstreamStatus: 403 };
  if (status === 416) return { ok: false, code: 'DRIVE_RANGE_REJECTED', upstreamStatus: 416 };
  if (status === 429) return { ok: false, code: 'DRIVE_RATE_LIMIT', upstreamStatus: 429 };

  logger.warn(`[OrgChartVideoDrive] upstream open failed status=${status ?? 'n/a'}`);
  return { ok: false, code: 'DRIVE_NETWORK', upstreamStatus: status };
}
