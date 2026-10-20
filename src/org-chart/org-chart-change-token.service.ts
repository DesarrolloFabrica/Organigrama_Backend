import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrgChartService } from './org-chart.service';
import { OrgChartVisibilityService } from './org-chart-visibility.service';
import { isOrgChartPlantaEnabled } from './org-chart-version-read-plan';
import { OrgChartHierarchyExceptionService } from './org-chart-hierarchy-exception.service';

const LOG_TAG = '[OrgChartChangeToken]';

/** Valor que el frontend ignora: no invalida nada si la huella falla. */
export const ORG_CHART_CHANGE_TOKEN_UNAVAILABLE = 'unavailable';

/**
 * Reutiliza la última huella unos segundos: cada pestaña abierta consulta
 * cada 20 s y la huella es igual para todos los usuarios.
 */
const TOKEN_MEMO_TTL_MS = 5_000;

export type OrgChartChangeTokenDto = { token: string };

/**
 * Huella de los datos que pintan el mapa. Las altas y cambios de jefe de
 * Orbit llegan a `core.person` y `core.planta_org_override` sin pasar por
 * este backend; la huella permite detectarlos por consulta:
 *
 * - el frontend la sondea (`GET /api/org-chart/change-token`) y, si cambia,
 *   invalida sus queries del organigrama;
 * - aquí, si cambia respecto de la anterior, se vacían las caches en memoria
 *   del árbol y de visibilidad para que la recarga no sirva datos viejos.
 *
 * Solo lectura: no escribe en la base.
 */
@Injectable()
export class OrgChartChangeTokenService {
  private readonly log = new Logger(OrgChartChangeTokenService.name);
  private memo: { token: string; expiresAt: number } | null = null;
  private inFlight: Promise<string> | null = null;
  private lastToken: string | null = null;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly orgChartService: OrgChartService,
    private readonly visibility: OrgChartVisibilityService,
    private readonly hierarchyExceptions: OrgChartHierarchyExceptionService,
  ) {}

  async getChangeToken(): Promise<OrgChartChangeTokenDto> {
    const now = Date.now();
    if (this.memo && this.memo.expiresAt > now) {
      return { token: this.memo.token };
    }

    this.inFlight ??= this.computeToken().finally(() => {
      this.inFlight = null;
    });

    try {
      const token = await this.inFlight;
      this.memo = { token, expiresAt: Date.now() + TOKEN_MEMO_TTL_MS };
      this.onTokenObserved(token);
      return { token };
    } catch (error) {
      this.log.error(
        `${LOG_TAG} no se pudo calcular la huella: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { token: ORG_CHART_CHANGE_TOKEN_UNAVAILABLE };
    }
  }

  private onTokenObserved(token: string): void {
    if (this.lastToken === token) return;
    const previous = this.lastToken;
    this.lastToken = token;
    if (previous === null) return;

    this.orgChartService.clearResponseCaches();
    this.visibility.clearDescendantCache();
    this.log.log(`${LOG_TAG} datos cambiados; caches del organigrama vaciadas`);
  }

  private async computeToken(): Promise<string> {
    const includeExceptions =
      await this.hierarchyExceptions.isPublishedLayerAvailable();
    const includeSuppressions =
      await this.hierarchyExceptions.isSuppressionLayerAvailable();
    const rows = await this.dataSource.query<{ token: string }[]>(
      buildChangeTokenSql(
        isOrgChartPlantaEnabled(),
        includeExceptions,
        includeSuppressions,
      ),
    );
    const token = rows?.[0]?.token;
    if (!token) {
      throw new Error('la consulta de huella no devolvió token');
    }
    return token;
  }
}

/**
 * Una sola consulta: hashes de lo que define nodos y aristas (personas
 * activas, relaciones, overrides de Planta, excepciones provisionales,
 * versiones, overrides por versión) más marcas de tiempo y conteos de vacantes.
 */
export function buildChangeTokenSql(
  includePlanta: boolean,
  includeExceptions = false,
  includeSuppressions = false,
): string {
  const parts = [
    `(SELECT COALESCE(MD5(STRING_AGG(id::text, ',' ORDER BY id)), '-')
       FROM core.person WHERE is_active)`,
    `(SELECT COALESCE(MAX(updated_at)::text, '-') FROM core.person)`,
    `(SELECT COALESCE(MD5(STRING_AGG(
         id::text || '>' || parent_person_id::text || '>' || child_person_id::text,
         ',' ORDER BY id)), '-')
       FROM organigrama.org_visual_relation WHERE is_active)`,
    `(SELECT COALESCE(MAX(updated_at)::text, '-') FROM organigrama.org_visual_relation)`,
    `(SELECT COALESCE(MD5(STRING_AGG(
         id::text || ':' || is_active::text || ':' || updated_at::text,
         ',' ORDER BY id)), '-')
       FROM organigrama.org_chart_version)`,
    `(SELECT COUNT(*)::text || '@' || COALESCE(MAX(updated_at)::text, '-')
       FROM organigrama.org_visual_relation_override)`,
    `(SELECT COUNT(*)::text || '@' || COALESCE(MAX(updated_at)::text, '-')
       FROM organigrama.org_visual_relation_position_child)`,
    `(SELECT COUNT(*)::text || '@' || COALESCE(MAX(updated_at)::text, '-')
       FROM organigrama.org_chart_person_override)`,
    `(SELECT COUNT(*)::text || '@' || COALESCE(MAX(updated_at)::text, '-')
       FROM vacancies.vacancy)`,
  ];

  if (includePlanta) {
    parts.unshift(
      `(SELECT COALESCE(MD5(STRING_AGG(
           person_id::text || '>' || COALESCE(parent_person_id::text, '-'),
           ',' ORDER BY person_id)), '-')
         FROM core.planta_org_override)`,
      `(SELECT COALESCE(MAX(updated_at)::text, '-') FROM core.planta_org_override)`,
    );
  }

  // Activar o retirar una excepción cambia status/updated_at → nueva huella.
  if (includeExceptions) {
    parts.push(
      `(SELECT COALESCE(MD5(STRING_AGG(
           id::text || ':' || status || ':' || updated_at::text,
           ',' ORDER BY id)), '-')
         FROM organigrama.org_chart_hierarchy_exception)`,
    );
  }

  // Igual para las supresiones de aristas (migración 039).
  if (includeSuppressions) {
    parts.push(
      `(SELECT COALESCE(MD5(STRING_AGG(
           id::text || ':' || status || ':' || updated_at::text,
           ',' ORDER BY id)), '-')
         FROM organigrama.org_chart_relation_suppression)`,
    );
  }

  return `SELECT MD5(CONCAT_WS('|', ${parts.join(',\n')})) AS token`;
}
