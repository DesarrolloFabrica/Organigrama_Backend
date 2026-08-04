/**
 * Disponibilidad / metadatos de video de presentación (+ ticket Fase 3B).
 *
 * Misma política de visibilidad que la ficha / CV (`canViewFullProfile`).
 * Anti-enumeración: sin permiso → { hasVideo: false }.
 * Emite ticket firmado; no consulta Drive; no transmite bytes.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { isVacancyPerson } from '../org-chart-vacancy';
import { OrgChartVisibilityService } from '../org-chart-visibility.service';
import type { OrgViewerContext } from '../org-viewer-context';
import {
  PERSON_VIDEO_FILE_NAME_MAX_LEN,
  PERSON_VIDEO_GENERIC_FILE_NAME,
  PERSON_VIDEO_LOG_TAG,
} from './org-chart-video.constants';
import { OrgChartVideoTicketService } from './org-chart-video-ticket.service';
import { PersonVideoStreamTicketError } from './org-chart-video-ticket.types';
import { buildPersonVideoStreamUrl } from './org-chart-video-stream.service';
import type {
  PersonVideoActiveRow,
  PersonVideoResponseDto,
} from './org-chart-video.types';

@Injectable()
export class OrgChartVideoService {
  private readonly logger = new Logger(OrgChartVideoService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly visibilityService: OrgChartVisibilityService,
    private readonly ticketService: OrgChartVideoTicketService,
  ) {}

  async getPersonVideo(
    viewer: OrgViewerContext,
    targetPersonId: string,
    versionId: string,
  ): Promise<PersonVideoResponseDto> {
    const canView = await this.visibilityService.canViewFullProfile(
      viewer,
      targetPersonId,
      versionId,
    );
    if (!canView) {
      this.logger.warn(
        `${PERSON_VIDEO_LOG_TAG} denied video access viewerPersonId=${viewer.personId} targetPersonId=${targetPersonId}`,
      );
      return { hasVideo: false };
    }

    const person = await this.loadPersonForVacancyCheck(targetPersonId);
    if (!person) {
      throw new NotFoundException(
        `No existe una persona con id ${targetPersonId}.`,
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
      return { hasVideo: false };
    }

    const rows = await this.dataSource.query<PersonVideoActiveRow[]>(
      `SELECT id::text AS id,
              drive_file_name,
              mime_type,
              drive_file_size,
              synced_at
         FROM organigrama.person_video
        WHERE person_id = $1 AND is_active = TRUE
        LIMIT 2`,
      [targetPersonId],
    );

    if (rows.length === 0) {
      return { hasVideo: false };
    }

    if (rows.length > 1) {
      this.logger.error(
        `${PERSON_VIDEO_LOG_TAG} anomaly multiple active videos targetPersonId=${targetPersonId}`,
      );
    }

    const row = rows[0];
    const sizeRaw = row.drive_file_size;
    let sizeBytes: number | null = null;
    if (sizeRaw != null && sizeRaw !== '') {
      const n = Number(sizeRaw);
      sizeBytes = Number.isFinite(n) ? n : null;
    }

    let issued;
    try {
      issued = this.ticketService.issueStreamTicket({
        viewerPersonId: viewer.personId,
        targetPersonId,
        personVideoId: row.id,
      });
    } catch (err) {
      if (
        err instanceof PersonVideoStreamTicketError &&
        err.code === 'CONFIG_ERROR'
      ) {
        throw new ServiceUnavailableException(
          'Emisión de ticket de video no disponible: configuración incompleta.',
        );
      }
      throw err;
    }

    return {
      hasVideo: true,
      fileName: sanitizePersonVideoFileName(row.drive_file_name),
      mimeType: (row.mime_type ?? 'video/mp4').trim() || 'video/mp4',
      sizeBytes,
      lastSync: toIsoOrNull(row.synced_at),
      streamTicket: issued.ticket,
      streamTicketExpiresAt: issued.expiresAt.toISOString(),
      streamUrl: buildPersonVideoStreamUrl(targetPersonId, issued.ticket),
    };
  }

  private async loadPersonForVacancyCheck(personId: string): Promise<{
    document: string;
    full_name: string;
    role_id: string | null;
    role_name: string | null;
  } | null> {
    const rows = await this.dataSource.query<
      Array<{
        document: string;
        full_name: string;
        role_id: string | null;
        role_name: string | null;
      }>
    >(
      `SELECT p.document,
              p.full_name,
              p.role_id::text AS role_id,
              ro.name AS role_name
         FROM core.person p
         LEFT JOIN core.role ro ON ro.id = p.role_id
        WHERE p.id = $1
        LIMIT 1`,
      [personId],
    );
    return rows[0] ?? null;
  }
}

/**
 * Sanitiza el nombre de archivo para exposición al cliente.
 * Sin rutas, sin controles, longitud acotada.
 * Nombres que son solo documento (+ extensión) → etiqueta genérica (sin PII).
 */
export function sanitizePersonVideoFileName(
  raw: string | null | undefined,
): string {
  if (!raw) return PERSON_VIDEO_GENERIC_FILE_NAME;
  let name = String(raw).trim();
  // Basename: descartar cualquier pseudo-ruta.
  name = name.replace(/\\/g, '/');
  const slash = name.lastIndexOf('/');
  if (slash >= 0) name = name.slice(slash + 1);
  // Controles y separadores residuales.
  name = name.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!name) return PERSON_VIDEO_GENERIC_FILE_NAME;
  if (name.length > PERSON_VIDEO_FILE_NAME_MAX_LEN) {
    name = name.slice(0, PERSON_VIDEO_FILE_NAME_MAX_LEN).trim();
  }
  if (!name || /^[.]+$/.test(name)) {
    return PERSON_VIDEO_GENERIC_FILE_NAME;
  }
  // Convención Drive: `<documento>.mp4` — no exponer documento como fileName.
  if (/^\d+(\.[A-Za-z0-9]+)?$/.test(name)) {
    return PERSON_VIDEO_GENERIC_FILE_NAME;
  }
  return name;
}

function toIsoOrNull(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}
