import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { Area } from '../../catalogs/entities/area.entity';
import { School } from '../../catalogs/entities/school.entity';
import { Program } from '../../catalogs/entities/program.entity';
import { directoryPlacementCtes } from '../org-chart-directory-placements.sql';
import {
  visualRelationSqlSource,
  withOverlayQueryParams,
} from '../org-chart-effective-relation.sql';
import { ORG_CHART_ROOT_PERSON_ID } from '../photos/photo.config';

import { Vacancy } from './entities/vacancy.entity';
import type {
  ScopedVacancyListResponseDto,
  VacancyListResponseDto,
  VacancyResponseDto,
} from './dto/vacancy.response.dto';
import {
  resolveVacancyScope,
  type VacancyScopePlacement,
} from './org-chart-vacancy-scope';

/** Único estado de vacante que Organigrama muestra en el panel lateral. */
const VACANCY_VISIBLE_STATUS = 'requisition_sent';

type PlacementRow = {
  person_id: string;
  boss_id: string | null;
  full_name: string | null;
  area_id: string | null;
  area_name: string | null;
};

/**
 * Ubicaciones efectivas de personas ACTIVAS con su área: las mismas CTE que
 * el exportador usa para sus pestañas por coordinación, sin datos personales.
 */
function vacancyScopePlacementsSql(): { sql: string; overlayIds: string[] } {
  const source = visualRelationSqlSource('r', '$1', '$2');
  const sql = `
WITH ${directoryPlacementCtes(source)}
SELECT
  e.person_id,
  e.boss_id,
  p.full_name,
  p.area_id::text AS area_id,
  a.name AS area_name
FROM placements e
INNER JOIN core.person p
  ON p.id::text = e.person_id
 AND p.is_active = true
LEFT JOIN core.area a ON a.id = p.area_id
ORDER BY e.person_id, e.edge_rank, e.boss_id NULLS LAST
`;
  return { sql, overlayIds: source.overlayIds };
}

@Injectable()
export class OrgChartVacancyService {
  private readonly log = new Logger(OrgChartVacancyService.name);

  constructor(
    @InjectRepository(Vacancy)
    private readonly vacancyRepo: Repository<Vacancy>,
    @InjectRepository(Area)
    private readonly areaRepo: Repository<Area>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(Program)
    private readonly programRepo: Repository<Program>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Requisiciones visibles para el nodo `personId` en la versión `versionId`.
   *
   * Debe llamarse dentro del plan de lectura de la petición (el interceptor
   * lo instala cuando llega `personId`): las ubicaciones se componen con los
   * mismos overlays, Planta y excepciones que el mapa que ve el usuario.
   *
   * Un nodo inexistente o inactivo es un alcance inválido → 404, nunca el
   * total global. Solo lectura.
   */
  async getVacanciesForNode(
    personId: string,
    versionId: string,
  ): Promise<ScopedVacancyListResponseDto> {
    const exists = await this.dataSource.query<{ id: string }[]>(
      `SELECT id::text AS id FROM core.person WHERE id = $1 AND is_active = true`,
      [personId],
    );
    if (exists.length === 0) {
      throw new NotFoundException(
        `Persona ${personId} no encontrada o inactiva.`,
      );
    }

    const { sql, overlayIds } = vacancyScopePlacementsSql();
    const rows = await this.dataSource.query<PlacementRow[]>(
      sql,
      withOverlayQueryParams([versionId], overlayIds),
    );
    const placements: VacancyScopePlacement[] = rows.map((row) => ({
      personId: String(row.person_id),
      bossId: row.boss_id == null ? null : String(row.boss_id),
      areaName: row.area_name ?? '',
      areaId: row.area_id == null ? null : String(row.area_id),
      fullName: row.full_name ?? '',
    }));

    const scope = resolveVacancyScope(
      placements,
      ORG_CHART_ROOT_PERSON_ID,
      personId,
    );

    let vacancies: Vacancy[] = [];
    if (scope.kind === 'global') {
      vacancies = await this.findVisibleVacancies();
    } else if (scope.kind === 'coordination' && scope.areaIds.length > 0) {
      vacancies = await this.findVisibleVacancies(scope.areaIds);
    }
    // `none` y coordinaciones sin área: lista vacía (no se asigna nada).

    this.log.log(
      `[OrgChartVacancies] scope=${scope.kind}${
        scope.kind === 'none' ? `(${scope.reason})` : ''
      } person=${personId} version=${versionId} found=${vacancies.length}`,
    );

    return {
      items: await this.toResponseItems(vacancies),
      scope: {
        kind: scope.kind,
        personId,
        areaName: scope.kind === 'coordination' ? scope.areaName : null,
      },
    };
  }

  /** Requisiciones `requisition_sent`, opcionalmente solo de esas áreas. */
  private findVisibleVacancies(areaIds?: string[]): Promise<Vacancy[]> {
    return this.vacancyRepo.find({
      where: {
        operation_status: VACANCY_VISIBLE_STATUS,
        ...(areaIds ? { area_id: In(areaIds) } : {}),
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Devuelve las vacantes desde `vacancies.vacancy` en estado
   * `requisition_sent`, ordenadas por fecha de creación descendente, y las
   * enriquece con nombres de core (área, escuela, programa) cuando existe la
   * referencia por ID.
   *
   * Solo lectura: no inserta ni sincroniza datos hacia organigrama.
   */
  async getVacancies(): Promise<VacancyListResponseDto> {
    this.log.log('[OrgChartVacancies] fetching vacancies');

    const vacancies = await this.findVisibleVacancies();

    this.log.log(`[OrgChartVacancies] vacancies found: ${vacancies.length}`);

    return { items: await this.toResponseItems(vacancies) };
  }

  /** Mapea a DTO y enriquece con nombres de core (área, escuela, programa). */
  private async toResponseItems(
    vacancies: Vacancy[],
  ): Promise<VacancyResponseDto[]> {
    const [areaNames, schoolNames, programNames] = await Promise.all([
      this.buildNameMap(
        this.areaRepo,
        this.collectIds(vacancies, (v) => v.area_id),
      ),
      this.buildNameMap(
        this.schoolRepo,
        this.collectIds(vacancies, (v) => v.school_id),
      ),
      this.buildNameMap(
        this.programRepo,
        this.collectIds(vacancies, (v) => v.program_id),
      ),
    ]);

    return vacancies.map((v) => ({
      id: this.toNumber(v.id) ?? 0,
      areaId: this.toNumber(v.area_id),
      schoolId: this.toNumber(v.school_id),
      programId: this.toNumber(v.program_id),
      positionName: v.position_name ?? null,
      curricularLine: v.curricular_line ?? null,
      quantity: v.quantity ?? null,
      operationStatus: v.operation_status ?? null,
      createdAt: v.created_at ? v.created_at.toISOString() : null,
      updatedAt: v.updated_at ? v.updated_at.toISOString() : null,
      areaName: v.area_id ? (areaNames.get(String(v.area_id)) ?? null) : null,
      schoolName: v.school_id
        ? (schoolNames.get(String(v.school_id)) ?? null)
        : null,
      programName: v.program_id
        ? (programNames.get(String(v.program_id)) ?? null)
        : null,
    }));
  }

  /** Extrae IDs únicos y no nulos de las vacantes. */
  private collectIds(
    vacancies: Vacancy[],
    pick: (v: Vacancy) => string | null,
  ): string[] {
    const ids = new Set<string>();
    for (const v of vacancies) {
      const id = pick(v);
      if (id !== null && id !== undefined) {
        ids.add(String(id));
      }
    }
    return Array.from(ids);
  }

  /** Construye un mapa id -> name consultando core por lote. */
  private async buildNameMap(
    repo: Repository<{ id: string; name: string | null }>,
    ids: string[],
  ): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    if (ids.length === 0) {
      return map;
    }

    const rows = await repo.find({ where: { id: In(ids) } });
    for (const row of rows) {
      map.set(String(row.id), row.name ?? null);
    }
    return map;
  }

  /** Convierte un valor bigint/string a number, respetando null. */
  private toNumber(value: string | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
}
