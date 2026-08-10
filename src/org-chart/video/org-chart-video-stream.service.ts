/**
 * Proxy de streaming de video de presentación con HTTP Range (Fase 3C).
 */
import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import type { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { isVacancyPerson } from '../org-chart-vacancy';
import {
  PERSON_VIDEO_ALLOWED_MIME_TYPES,
  PERSON_VIDEO_LOG_TAG,
} from './org-chart-video.constants';
import { OrgChartVideoDriveStreamClient } from './org-chart-video-drive-stream.client';
import {
  contentRangeForUnsatisfiable,
  parseBytesRangeHeader,
} from './org-chart-video-range';
import { OrgChartVideoTicketService } from './org-chart-video-ticket.service';
import { PersonVideoStreamTicketError } from './org-chart-video-ticket.types';
import {
  PersonVideoStreamHttpError,
  type PersonVideoStreamRow,
} from './org-chart-video-stream.types';

@Injectable()
export class OrgChartVideoStreamService {
  private readonly logger = new Logger(OrgChartVideoStreamService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly ticketService: OrgChartVideoTicketService,
    private readonly driveStream: OrgChartVideoDriveStreamClient,
  ) {}

  /**
   * Valida ticket + BD, abre Drive y hace pipeline a `res`.
   * Lanza PersonVideoStreamHttpError antes de escribir body.
   */
  async streamToResponse(opts: {
    personId: string;
    ticket: string | undefined;
    rangeHeader: string | undefined;
    req: Request;
    res: Response;
    requestId?: string;
  }): Promise<void> {
    const started = Date.now();
    const requestId = opts.requestId ?? 'n/a';
    const abort = new AbortController();

    const onClose = () => {
      if (!opts.res.writableEnded) {
        abort.abort();
      }
    };
    opts.req.on('close', onClose);
    opts.res.on('close', onClose);

    let personVideoId: string | undefined;

    try {
      const payload = this.verifyTicketOrThrow(opts.ticket);

      if (payload.targetPersonId !== opts.personId) {
        throw new PersonVideoStreamHttpError(
          404,
          'STREAM_TARGET_MISMATCH',
          'Recurso de video no encontrado',
        );
      }

      personVideoId = payload.personVideoId;
      const row = await this.loadActiveVideoOrThrow(
        payload.personVideoId,
        payload.targetPersonId,
      );
      await this.assertTargetPersonEligible(payload.targetPersonId);

      const sizeBytes = toSizeNumber(row.drive_file_size);
      const rangeResult = parseBytesRangeHeader(opts.rangeHeader, sizeBytes);

      if (rangeResult.kind === 'invalid') {
        const headers: Record<string, string> = {
          'Accept-Ranges': 'bytes',
        };
        if (sizeBytes != null) {
          headers['Content-Range'] = contentRangeForUnsatisfiable(sizeBytes);
        }
        throw new PersonVideoStreamHttpError(
          416,
          'STREAM_RANGE_INVALID',
          'Rango de bytes no satisfacible',
          headers,
        );
      }

      const rangeToDrive =
        rangeResult.kind === 'range' ? rangeResult.headerValue : undefined;

      const upstream = await this.driveStream.openMediaStream({
        fileId: row.drive_file_id,
        rangeHeader: rangeToDrive,
        signal: abort.signal,
      });

      if (!upstream.ok) {
        throw this.mapDriveFailure(upstream.code, sizeBytes);
      }

      const contentType =
        (row.mime_type?.trim() || upstream.contentType || 'video/mp4').split(
          ';',
        )[0] || 'video/mp4';

      const finalStatus = rangeResult.kind === 'range' ? 206 : 200;

      this.setCommonHeaders(opts.res, contentType, opts.req);
      if (upstream.contentRange) {
        opts.res.setHeader('Content-Range', upstream.contentRange);
      } else if (rangeResult.kind === 'range' && sizeBytes != null) {
        const end =
          rangeResult.end != null ? rangeResult.end : sizeBytes - 1;
        opts.res.setHeader(
          'Content-Range',
          `bytes ${rangeResult.start}-${end}/${sizeBytes}`,
        );
      }

      const length =
        upstream.contentLength ??
        (rangeResult.kind === 'range' &&
        sizeBytes != null &&
        rangeResult.end != null
          ? rangeResult.end - rangeResult.start + 1
          : rangeResult.kind === 'none'
            ? sizeBytes
            : null);

      if (length != null && Number.isFinite(length) && length >= 0) {
        opts.res.setHeader('Content-Length', String(length));
      }

      opts.res.status(finalStatus);
      // Forzar flush de headers (CORS + 206) antes del body; evita que Cloud Run
      // entregue un 500 opaco sin ACAO si el cliente aborta al instante.
      const flushable = opts.res as Response & { flushHeaders?: () => void };
      if (typeof flushable.flushHeaders === 'function') {
        flushable.flushHeaders();
      }

      this.logger.log(
        `${PERSON_VIDEO_LOG_TAG} stream start requestId=${requestId} personVideoId=${personVideoId} targetPersonId=${opts.personId} status=${finalStatus} range=${rangeToDrive ?? 'none'} upstream=${upstream.status}`,
      );

      try {
        await pipeline(upstream.body as Readable, opts.res);
        this.logger.log(
          `${PERSON_VIDEO_LOG_TAG} stream done requestId=${requestId} personVideoId=${personVideoId} ms=${Date.now() - started}`,
        );
      } catch (pipeErr) {
        // Solo abort de cliente si el AbortController de req/res close se disparó.
        // ERR_STREAM_PREMATURE_CLOSE también ocurre cuando Drive corta el upstream;
        // clasificarlo como client-abort dejaba la respuesta a medias → Cloud Run 500.
        if (abort.signal.aborted) {
          this.logger.log(
            `${PERSON_VIDEO_LOG_TAG} stream aborted requestId=${requestId} personVideoId=${personVideoId} code=STREAM_CLIENT_ABORTED ms=${Date.now() - started}`,
          );
          return;
        }
        const pipeMsg =
          pipeErr instanceof Error ? pipeErr.message : String(pipeErr);
        this.logger.error(
          `${PERSON_VIDEO_LOG_TAG} stream pipe error requestId=${requestId} personVideoId=${personVideoId} code=STREAM_PIPE_ERROR msg=${pipeMsg}`,
        );
        if (!opts.res.headersSent) {
          throw new PersonVideoStreamHttpError(
            500,
            'STREAM_PIPE_ERROR',
            'Error al transmitir el video',
          );
        }
        try {
          if (!opts.res.writableEnded) {
            opts.res.destroy(
              pipeErr instanceof Error ? pipeErr : new Error(pipeMsg),
            );
          }
        } catch {
          /* ignore */
        }
      }
    } finally {
      opts.req.off('close', onClose);
      opts.res.off('close', onClose);
    }
  }

  private verifyTicketOrThrow(ticket: string | undefined) {
    try {
      return this.ticketService.verifyStreamTicket(ticket ?? '');
    } catch (err) {
      if (err instanceof PersonVideoStreamTicketError) {
        if (err.code === 'EXPIRED_TICKET') {
          throw new PersonVideoStreamHttpError(
            401,
            'STREAM_TICKET_EXPIRED',
            'Ticket de reproducción inválido o expirado',
          );
        }
        if (err.code === 'MISSING_TICKET') {
          throw new PersonVideoStreamHttpError(
            401,
            'STREAM_TICKET_INVALID',
            'Ticket de reproducción inválido o expirado',
          );
        }
        throw new PersonVideoStreamHttpError(
          401,
          'STREAM_TICKET_INVALID',
          'Ticket de reproducción inválido o expirado',
        );
      }
      throw err;
    }
  }

  private async loadActiveVideoOrThrow(
    personVideoId: string,
    targetPersonId: string,
  ): Promise<PersonVideoStreamRow> {
    const rows = await this.dataSource.query<PersonVideoStreamRow[]>(
      `SELECT id::text AS id,
              person_id::text AS person_id,
              is_active,
              drive_file_id,
              mime_type,
              drive_file_size
         FROM organigrama.person_video
        WHERE id = $1
        LIMIT 1`,
      [personVideoId],
    );
    const row = rows[0];
    if (
      !row ||
      !row.is_active ||
      row.person_id !== targetPersonId ||
      !row.drive_file_id?.trim()
    ) {
      throw new PersonVideoStreamHttpError(
        404,
        'STREAM_VIDEO_NOT_FOUND',
        'Recurso de video no encontrado',
      );
    }

    const mime = (row.mime_type ?? 'video/mp4').trim().toLowerCase();
    if (!PERSON_VIDEO_ALLOWED_MIME_TYPES.has(mime)) {
      throw new PersonVideoStreamHttpError(
        404,
        'STREAM_VIDEO_NOT_FOUND',
        'Recurso de video no encontrado',
      );
    }

    return row;
  }

  private async assertTargetPersonEligible(personId: string): Promise<void> {
    const rows = await this.dataSource.query<
      Array<{
        is_active: boolean;
        document: string;
        full_name: string;
        role_id: string | null;
        role_name: string | null;
      }>
    >(
      `SELECT p.is_active,
              p.document,
              p.full_name,
              p.role_id::text AS role_id,
              ro.name AS role_name
         FROM core.person p
         LEFT JOIN core.role ro ON ro.id = p.role_id
        WHERE p.id = $1
        LIMIT 1`,
      [personId],
    );
    const person = rows[0];
    if (!person || !person.is_active) {
      throw new PersonVideoStreamHttpError(
        404,
        'STREAM_VIDEO_NOT_FOUND',
        'Recurso de video no encontrado',
      );
    }
    if (
      isVacancyPerson(
        {
          document: person.document,
          full_name: person.full_name,
          role_id: person.role_id,
        },
        person.role_name ? { name: person.role_name } : null,
      )
    ) {
      throw new PersonVideoStreamHttpError(
        404,
        'STREAM_VIDEO_NOT_FOUND',
        'Recurso de video no encontrado',
      );
    }
  }

  private mapDriveFailure(
    code: string,
    sizeBytes: number | null,
  ): PersonVideoStreamHttpError {
    switch (code) {
      case 'DRIVE_NOT_FOUND':
        return new PersonVideoStreamHttpError(
          404,
          'STREAM_DRIVE_NOT_FOUND',
          'Recurso de video no encontrado',
        );
      case 'DRIVE_FORBIDDEN':
        return new PersonVideoStreamHttpError(
          502,
          'STREAM_DRIVE_FORBIDDEN',
          'No se pudo obtener el video',
        );
      case 'DRIVE_RATE_LIMIT':
        return new PersonVideoStreamHttpError(
          503,
          'STREAM_DRIVE_RATE_LIMIT',
          'Servicio de video temporalmente no disponible',
        );
      case 'DRIVE_TIMEOUT':
        return new PersonVideoStreamHttpError(
          503,
          'STREAM_DRIVE_TIMEOUT',
          'Servicio de video temporalmente no disponible',
        );
      case 'DRIVE_RANGE_REJECTED': {
        const headers: Record<string, string> = { 'Accept-Ranges': 'bytes' };
        if (sizeBytes != null) {
          headers['Content-Range'] = contentRangeForUnsatisfiable(sizeBytes);
        }
        return new PersonVideoStreamHttpError(
          416,
          'STREAM_RANGE_INVALID',
          'Rango de bytes no satisfacible',
          headers,
        );
      }
      case 'DRIVE_NETWORK':
        return new PersonVideoStreamHttpError(
          502,
          'STREAM_DRIVE_NETWORK',
          'No se pudo obtener el video',
        );
      default:
        return new PersonVideoStreamHttpError(
          500,
          'STREAM_PIPE_ERROR',
          'Error al transmitir el video',
        );
    }
  }

  private setCommonHeaders(res: Response, contentType: string, req?: Request) {
    if (req) {
      applyPersonVideoStreamCors(req, res);
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}

/** CORS explícito para <video crossOrigin> (FE/BE en orígenes Cloud Run distintos). */
export function applyPersonVideoStreamCors(req: Request, res: Response): void {
  const origin =
    typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  if (!origin) return;

  const allowed = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (!allowed.includes(origin)) return;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Accept-Ranges, Content-Range, Content-Length, Content-Type',
  );
}

function toSizeNumber(raw: string | number | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Construye streamUrl relativo con ticket encodeado. */
export function buildPersonVideoStreamUrl(
  personId: string,
  ticket: string,
): string {
  return `/api/org-chart/person/${encodeURIComponent(personId)}/video/stream?ticket=${encodeURIComponent(ticket)}`;
}
