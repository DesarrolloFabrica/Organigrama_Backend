import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { DirectoryExportFormat } from './org-chart-directory-export.permissions';

export type DirectoryExportAuditResult = 'SUCCESS' | 'DENIED' | 'ERROR';

/**
 * Evento de auditoría de una descarga. Deliberadamente SIN datos personales
 * ni contenido del informe: solo quién (person_id), qué formato, qué versión,
 * cuántas filas, cuándo (created_at lo pone la BD) y con qué resultado.
 */
export type DirectoryExportAuditEvent = {
  personId: string;
  format: DirectoryExportFormat;
  result: DirectoryExportAuditResult;
  versionId?: string | null;
  rowCount?: number | null;
  /** Código técnico corto (p. ej. FORBIDDEN, QUERY_FAILED). Nunca un mensaje libre. */
  errorCode?: string | null;
};

export const DIRECTORY_EXPORT_AUDIT_TABLE =
  'organigrama.org_chart_directory_export_audit';

const ERROR_CODE_PATTERN = /^[A-Z0-9_]{1,60}$/;

/**
 * Persistencia de la auditoría de exportaciones
 * (migración 040_org_chart_directory_export_audit.sql).
 */
@Injectable()
export class OrgChartDirectoryExportAuditService {
  private readonly log = new Logger(OrgChartDirectoryExportAuditService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Inserta el evento. Lanza si no se puede escribir: el llamador decide si
   * la operación debe abortar (SUCCESS: sí, fail-closed) o continuar.
   */
  async record(event: DirectoryExportAuditEvent): Promise<void> {
    const errorCode =
      event.errorCode && ERROR_CODE_PATTERN.test(event.errorCode)
        ? event.errorCode
        : event.errorCode
          ? 'UNSPECIFIED'
          : null;

    await this.dataSource.query(
      `INSERT INTO ${DIRECTORY_EXPORT_AUDIT_TABLE}
         (person_id, export_format, version_id, row_count, result, error_code)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        event.personId,
        event.format,
        event.versionId ?? null,
        event.rowCount ?? null,
        event.result,
        errorCode,
      ],
    );
  }

  /**
   * Variante que nunca lanza: para DENIED/ERROR, donde la respuesta ya está
   * decidida y la auditoría no debe ocultar el error original.
   */
  async recordBestEffort(event: DirectoryExportAuditEvent): Promise<void> {
    try {
      await this.record(event);
    } catch (error) {
      this.log.warn(
        `[OrgChartDirectoryExportAudit] no se pudo registrar result=${event.result} format=${event.format} personId=${event.personId} cause=${errorName(error)}`,
      );
    }
  }
}

/** Nombre técnico del error, sin mensaje (puede contener SQL o datos). */
export function errorName(error: unknown): string {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && /^[A-Za-z0-9_]{1,20}$/.test(code)) {
      return code;
    }
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return 'UnknownError';
}
