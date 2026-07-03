import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { PersonCvResponseDto } from './dto/person-cv.response.dto';
import { OrgChartVisibilityService } from './org-chart-visibility.service';
import type { OrgViewerContext } from './org-viewer-context';

/** Prefijo de logs (solo diagnóstico interno: nunca URLs ni tokens). */
const LOG_TAG = '[OrgChartCV]';

/** Fila cruda devuelta por la consulta a organigrama.person_cv. */
type PersonCvRow = {
  drive_file_name: string | null;
  drive_web_url: string | null;
  synced_at: Date | string | null;
};

/**
 * Servicio de consulta de hojas de vida para el organigrama.
 *
 * La hoja de vida se trata como INFORMACIÓN SENSIBLE: usa exactamente la misma
 * política de visibilidad jerárquica que la ficha completa del organigrama
 * (OrgChartVisibilityService.canViewFullProfile). No se duplica lógica de
 * permisos: se reutiliza la política centralizada.
 *
 * Lee EXCLUSIVAMENTE desde la base de datos (organigrama.person_cv).
 * NO consulta Google Drive en tiempo real: las URLs ya están almacenadas
 * gracias al proceso de sincronización (npm run sync:drive-cv).
 */
@Injectable()
export class OrgChartCvService {
  private readonly logger = new Logger(OrgChartCvService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    /** Política central de visibilidad jerárquica (misma que la ficha completa). */
    private readonly visibilityService: OrgChartVisibilityService,
  ) {}

  /**
   * Devuelve el estado de hoja de vida de una persona, respetando la política
   * de visibilidad jerárquica.
   *
   * Permisos (delegados en canViewFullProfile):
   *  - La propia persona.
   *  - Jefes/líderes sobre esa persona según la jerarquía vigente (descendientes).
   *  - Usuarios con ORG_READ_ALL / ORG_ADMIN (acceso global).
   *
   * Si el viewer NO tiene permiso, devolvemos { hasCv: false } sin revelar si el
   * archivo existe (no se filtra fileName, viewUrl ni la existencia real del CV).
   *
   * @param viewer Contexto del usuario autenticado (JWT): personId, email, permisos.
   * @param targetPersonId ID de la persona cuyo CV se consulta (core.person.id).
   * @param versionId Versión vigente del organigrama para resolver la jerarquía.
   */
  async getPersonCv(
    viewer: OrgViewerContext,
    targetPersonId: string,
    versionId: string,
  ): Promise<PersonCvResponseDto> {
    try {
      // 1) Validación de permiso ANTES de consultar/exponer nada.
      //    Reutiliza la misma política que decide la ficha completa de la tarjeta.
      const canView = await this.visibilityService.canViewFullProfile(
        viewer,
        targetPersonId,
        versionId,
      );

      if (!canView) {
        // Negamos sin revelar existencia: se responde igual que "sin CV".
        // Log solo para diagnóstico interno (sin URLs ni tokens).
        this.logger.warn(
          `${LOG_TAG} denied cv access viewerPersonId=${viewer.personId} targetPersonId=${targetPersonId}`,
        );
        return { hasCv: false };
      }

      // 2) Con permiso: consulta parametrizada del registro ACTIVO de esa persona.
      const rows = await this.dataSource.query<PersonCvRow[]>(
        `SELECT drive_file_name, drive_web_url, synced_at
           FROM organigrama.person_cv
          WHERE person_id = $1 AND is_active = true
          LIMIT 1`,
        [targetPersonId],
      );

      // Sin registro activo => la persona no tiene hoja de vida disponible.
      if (rows.length === 0) {
        return { hasCv: false };
      }

      const row = rows[0];

      // Normalizamos synced_at a ISO 8601 (string) para el frontend.
      const lastSync = this.toIsoString(row.synced_at);

      return {
        hasCv: true,
        fileName: row.drive_file_name ?? undefined,
        viewUrl: row.drive_web_url ?? undefined,
        lastSync,
      };
    } catch (error) {
      // Solo registramos logs en caso de error, con el prefijo solicitado.
      this.logger.error(
        `${LOG_TAG} Error consultando hoja de vida para targetPersonId=${targetPersonId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // Propagamos el error para que Nest devuelva un 500 controlado.
      throw error;
    }
  }

  /**
   * Convierte el valor de synced_at a ISO 8601, tolerando Date o string.
   * Devuelve undefined si no hay valor.
   */
  private toIsoString(value: Date | string | null): string | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value.toISOString();
    // Si el driver lo devuelve como string, lo normalizamos vía Date.
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
  }
}
