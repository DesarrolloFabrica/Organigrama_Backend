import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const LOG_TAG = '[OrgChartHierarchyException]';

/** Si la capa no existe aún (migración 037/039 sin aplicar), se reintenta cada minuto. */
const MISSING_RECHECK_MS = 60_000;

/**
 * Capa de excepciones jerárquicas provisionales (migración 037):
 * `organigrama.org_chart_effective_relations_published` = Planta (Orbit) +
 * excepciones ACTIVE de `organigrama.org_chart_hierarchy_exception`.
 * La migración 039 añade a esa misma función las supresiones de aristas
 * (`organigrama.org_chart_relation_suppression`).
 *
 * El estado (DRAFT/ACTIVE/RETIRED) vive en la base; aquí solo se detecta si
 * la capa está instalada, para poder desplegar este código antes de la
 * migración sin romper lecturas: sin la función se sigue leyendo Planta.
 */
@Injectable()
export class OrgChartHierarchyExceptionService {
  private readonly log = new Logger(OrgChartHierarchyExceptionService.name);
  private available = false;
  private suppressionsAvailable = false;
  private checkedAt = 0;
  private inFlight: Promise<void> | null = null;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async isPublishedLayerAvailable(): Promise<boolean> {
    await this.refresh();
    return this.available;
  }

  /** ¿Existe la tabla de supresiones de aristas (migración 039)? */
  async isSuppressionLayerAvailable(): Promise<boolean> {
    await this.refresh();
    return this.available && this.suppressionsAvailable;
  }

  private async refresh(): Promise<void> {
    if (this.available && this.suppressionsAvailable) return;
    if (Date.now() - this.checkedAt < MISSING_RECHECK_MS) return;

    this.inFlight ??= this.detect().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async detect(): Promise<void> {
    try {
      const rows = await this.dataSource.query<
        { ok: boolean; suppressions: boolean }[]
      >(
        `SELECT
           to_regprocedure('organigrama.org_chart_effective_relations_published(bigint,bigint[])') IS NOT NULL
           AND to_regclass('organigrama.org_chart_hierarchy_exception') IS NOT NULL AS ok,
           to_regclass('organigrama.org_chart_relation_suppression') IS NOT NULL AS suppressions`,
      );
      const wasAvailable = this.available;
      const hadSuppressions = this.suppressionsAvailable;
      this.available = rows?.[0]?.ok === true;
      this.suppressionsAvailable = rows?.[0]?.suppressions === true;
      if (this.available && !wasAvailable) {
        this.log.log(`${LOG_TAG} capa de excepciones jerárquicas disponible`);
      }
      if (this.suppressionsAvailable && !hadSuppressions) {
        this.log.log(`${LOG_TAG} capa de supresiones de aristas disponible`);
      }
    } catch (error) {
      this.log.warn(
        `${LOG_TAG} no se pudo comprobar la capa: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.available = false;
      this.suppressionsAvailable = false;
    }
    this.checkedAt = Date.now();
  }
}
