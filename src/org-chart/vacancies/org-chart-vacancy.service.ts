import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Area } from '../../catalogs/entities/area.entity';
import { School } from '../../catalogs/entities/school.entity';
import { Program } from '../../catalogs/entities/program.entity';

import { Vacancy } from './entities/vacancy.entity';
import type {
  VacancyListResponseDto,
  VacancyResponseDto,
} from './dto/vacancy.response.dto';

/** Único estado de vacante que Organigrama muestra en el panel lateral. */
const VACANCY_VISIBLE_STATUS = 'requisition_sent';

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
  ) {}

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

    const vacancies = await this.vacancyRepo.find({
      where: { operation_status: VACANCY_VISIBLE_STATUS },
      order: { created_at: 'DESC' },
    });

    this.log.log(
      `[OrgChartVacancies] vacancies found: ${vacancies.length}`,
    );

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

    const items: VacancyResponseDto[] = vacancies.map((v) => ({
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

    return { items };
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
