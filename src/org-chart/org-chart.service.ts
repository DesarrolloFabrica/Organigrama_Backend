import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Role } from '../catalogs/entities/role.entity';
import { Hierarchy } from '../catalogs/entities/hierarchy.entity';
import { Area } from '../catalogs/entities/area.entity';
import { School } from '../catalogs/entities/school.entity';
import { Campus } from '../catalogs/entities/campus.entity';
import { Program } from '../catalogs/entities/program.entity';
import { City } from '../catalogs/entities/city.entity';
import { ContractType } from '../catalogs/entities/contract-type.entity';
import { Region } from '../catalogs/entities/region.entity';
import { Person } from '../person/entities/person.entity';
import type {
  OrgNode,
  OrgNodeHierarchy,
  OrgNodeRole,
} from './types/org-node.type';
import { resolveOrgLevelFromRoleName } from './org-chart.visual-map';
import { findActivePeopleByRoleName } from './org-chart-person.query';
import { OrgChartTreeEngine } from './org-chart-tree.engine';

// ─── Catalog maps helper ──────────────────────────────────────────────────────

interface OrgCatalogs {
  roleById: Map<string, Role>;
  hierarchyById: Map<string, Hierarchy>;
  areaById: Map<string, Area>;
  schoolById: Map<string, School>;
  programById: Map<string, Program>;
  cityById: Map<string, City>;
  campusById: Map<string, Campus>;
  contractTypeById: Map<string, ContractType>;
  regionById: Map<string, Region>;
}

// ─── Role → Org-level mapping ─────────────────────────────────────────────────
// resolveOrgLevelFromRoleName: org-chart.visual-map.ts

/**
 * Indica si una persona entra en la fase actual del organigrama.
 *
 * Fase 1: solo quien tenga rol con nivel resuelto = 1.
 * Expandir cuando se integren niveles 2, 3, etc.
 */
export function isPersonIncludedInCurrentOrgPhase(
  person: Person,
  roleById: Map<string, Role>,
): boolean {
  const role = person.role_id
    ? (roleById.get(String(person.role_id)) ?? null)
    : null;
  const level = resolveOrgLevelFromRoleName(role?.name);

  // En Fase 2 permitimos niveles 1 y 2.
  return level !== null && level <= 5;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class OrgChartService {
  private readonly log = new Logger(OrgChartService.name);

  constructor(
    private readonly treeEngine: OrgChartTreeEngine,
    @InjectRepository(Person)
    private readonly persons: Repository<Person>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    @InjectRepository(Hierarchy)
    private readonly hierarchies: Repository<Hierarchy>,
    @InjectRepository(Area)
    private readonly areas: Repository<Area>,
    @InjectRepository(School)
    private readonly schools: Repository<School>,
    @InjectRepository(Program)
    private readonly programs: Repository<Program>,
    @InjectRepository(City)
    private readonly cities: Repository<City>,
    @InjectRepository(Campus)
    private readonly campuses: Repository<Campus>,
    @InjectRepository(ContractType)
    private readonly contractTypes: Repository<ContractType>,
    @InjectRepository(Region)
    private readonly regions: Repository<Region>,
  ) {}

  // ─── GET /org-chart ────────────────────────────────────────────────────────

  /**
   * Construye el árbol del organigrama desde el modelo nativo de Core.
   *
   * FASE 1: devuelve el nodo raíz (Director de Operaciones) con children = [].
   * Detección del root: core.role.name ILIKE '%DIRECTOR DE OPERACIONES%'.
   * No usa org_relation ni ninguna tabla externa.
   */
  async getOrgChartTree(): Promise<OrgNode> {
    const allRoles = await this.roles.find({ order: { id: 'ASC' } });
    const roleById = this.buildMapById(allRoles);

    const level1Roles = allRoles.filter(
      (r) => resolveOrgLevelFromRoleName(r.name) === 1,
    );

    if (level1Roles.length === 0) {
      throw new NotFoundException(
        'No existe ningún rol con nombre similar a "DIRECTOR DE OPERACIONES" en Core. ' +
          'Verificar tabla core.role.',
      );
    }

    // Candidatos a root: join Person + Role en BD (ILIKE), solo activos, orden por id.
    const directorCandidates = await findActivePeopleByRoleName(
      this.persons,
      'DIRECTOR DE OPERACIONES',
      { match: 'ilike' },
    );

    const personsCoreHierarchyLevel1 = await this.persons
      .createQueryBuilder('p')
      .innerJoin(Hierarchy, 'h', 'h.id = p.hierarchy_id')
      .where('p.is_active = :active', { active: true })
      .andWhere('h.level = :lvl', { lvl: 1 })
      .getMany();

    const excludedCoreLevel1NotVisualRoot = personsCoreHierarchyLevel1.filter(
      (p) => !isPersonIncludedInCurrentOrgPhase(p, roleById),
    ).length;

    // ── Reporte de integración ────────────────────────────────────────────
    const [totalActive, totalAll] = await Promise.all([
      this.persons.count({ where: { is_active: true } }),
      this.persons.count(),
    ]);

    this.log.log(
      `[OrgFase1] Roles nivel-1 (mapeo visual): [${level1Roles.map((r) => `"${r.name}"`).join(', ')}]`,
    );
    this.log.log(
      `[OrgFase1] Candidatos a root (Person+Role ILIKE, activos, orden id): ${directorCandidates.length} ` +
        `(ids: ${directorCandidates.map((p) => p.id).join(', ') || 'ninguno'})`,
    );
    this.log.log(
      `[OrgFase1] Personas activas con core.hierarchy.level=1 excluidas del árbol en esta fase ` +
        `(solo se integra el root visual por rol, no todo el nivel Core): ${excludedCoreLevel1NotVisualRoot}`,
    );
    this.log.log(
      `[OrgFase1] Personas activas en Core: ${totalActive} / ${totalAll} total. ` +
        `No integradas en esta fase: ${totalActive - directorCandidates.length}.`,
    );

    const unmappedRoles = allRoles.filter(
      (r) => resolveOrgLevelFromRoleName(r.name) === null,
    );
    this.log.log(
      `[OrgFase1] Roles sin mapear (candidatos para fases siguientes): ` +
        unmappedRoles.map((r) => `"${r.name}"(id=${r.id})`).join(' | '),
    );
    // ─────────────────────────────────────────────────────────────────────

    if (directorCandidates.length === 0) {
      throw new NotFoundException(
        'No se encontró ninguna persona activa con rol "DIRECTOR DE OPERACIONES" en Core.',
      );
    }

    if (directorCandidates.length > 1) {
      this.log.warn(
        `[OrgFase1] CONFLICTO: ${directorCandidates.length} personas activas con rol Director (ILIKE). ` +
          `Se seleccionó id=${directorCandidates[0].id} — "${directorCandidates[0].full_name}". ` +
          `Revisar duplicidad en Core.`,
      );
    } else {
      this.log.log(
        `[OrgFase1] Root seleccionado: id=${directorCandidates[0].id} — "${directorCandidates[0].full_name}"`,
      );
    }

    const root = directorCandidates[0];
    const catalogs = await this.loadCatalogs();

    const children = await this.treeEngine.buildChildrenForPerson(
      root,
      catalogs,
      (nodePerson, nodeCatalogs, nodeChildren) =>
        this.buildOrgNode(nodePerson, nodeCatalogs, nodeChildren),
    );

    return this.buildOrgNode(root, catalogs, children);
  }

  // ─── GET /org-chart/team/:id ───────────────────────────────────────────────

  /**
   * Devuelve el subárbol con la persona indicada como raíz.
   * Fase 1: la persona como nodo único con children = [].
   */
  async getOrgChartSubtree(personId: string): Promise<OrgNode> {
    // Buscamos la persona raíz del subárbol solicitado.
    const person = await this.persons.findOne({ where: { id: personId } });

    if (!person) {
      throw new NotFoundException(
        `No existe una persona con id ${personId} en Core.`,
      );
    }

    // Cargamos catálogos para enriquecer la respuesta igual que en el árbol principal.
    const catalogs = await this.loadCatalogs();

    // El engine decide automáticamente si este rol tiene hijos visuales.
    // Si no existen reglas para el rol actual, devuelve [].
    const children = await this.treeEngine.buildChildrenForPerson(
      person,
      catalogs,
      (nodePerson, nodeCatalogs, nodeChildren) =>
        this.buildOrgNode(nodePerson, nodeCatalogs, nodeChildren),
    );

    // Retornamos la persona raíz del subárbol con sus hijos.
    return this.buildOrgNode(person, catalogs, children);
  }

  // ─── GET /org-chart/search ─────────────────────────────────────────────────

  async searchOrgChart(query: string) {
    const normalized = query?.trim();

    if (!normalized) {
      throw new BadRequestException('Debe enviar un parámetro de búsqueda q.');
    }

    const matches = await this.persons.find({
      where: [
        { full_name: ILike(`%${normalized}%`) },
        { document: ILike(`%${normalized}%`) },
        { email: ILike(`%${normalized}%`) },
        { edu_email: ILike(`%${normalized}%`) },
        { phone: ILike(`%${normalized}%`) },
      ],
      order: { hierarchy_id: 'ASC', full_name: 'ASC' },
      take: 20,
    });

    if (matches.length === 0) return [];

    const [roles, hierarchies] = await Promise.all([
      this.roles.find({ order: { id: 'ASC' } }),
      this.hierarchies.find({ order: { id: 'ASC' } }),
    ]);

    const roleById = this.buildMapById(roles);
    const hierarchyById = this.buildMapById(hierarchies);

    return matches.map((person) => {
      const role = person.role_id
        ? (roleById.get(String(person.role_id)) ?? null)
        : null;
      const hierarchy = person.hierarchy_id
        ? (hierarchyById.get(String(person.hierarchy_id)) ?? null)
        : null;

      return {
        id: String(person.id),
        document: person.document,
        name: person.full_name,

        role_id: person.role_id,
        role: role
          ? {
              id: String(role.id),
              name: role.name,
              description: role.description,
            }
          : null,

        hierarchy_id: person.hierarchy_id,
        hierarchy: hierarchy
          ? {
              id: String(hierarchy.id),
              name: hierarchy.name,
              description: hierarchy.description,
            }
          : null,

        area_id: person.area_id,
        school_id: person.school_id,
        program_id: person.program_id,
        email: person.email,
        edu_email: person.edu_email,
        phone: person.phone,

        // Fase 1: el path muestra solo la persona misma.
        // Se poblará con la cadena completa una vez integrados los niveles intermedios.
        path: [this.buildPathNode(person, role, hierarchy)],
      };
    });
  }

  // ─── GET /org-chart/person/:id ─────────────────────────────────────────────

  async getPersonDetail(id: string) {
    const person = await this.persons.findOne({ where: { id } });

    if (!person) {
      throw new NotFoundException(`No existe una persona con id ${id}.`);
    }

    const catalogs = await this.loadCatalogs();

    const role = person.role_id
      ? (catalogs.roleById.get(String(person.role_id)) ?? null)
      : null;
    const hierarchy = person.hierarchy_id
      ? (catalogs.hierarchyById.get(String(person.hierarchy_id)) ?? null)
      : null;
    const area = person.area_id
      ? (catalogs.areaById.get(String(person.area_id)) ?? null)
      : null;
    const school = person.school_id
      ? (catalogs.schoolById.get(String(person.school_id)) ?? null)
      : null;
    const program = person.program_id
      ? (catalogs.programById.get(String(person.program_id)) ?? null)
      : null;
    const city = person.city_id
      ? (catalogs.cityById.get(String(person.city_id)) ?? null)
      : null;
    const campus = person.campus_id
      ? (catalogs.campusById.get(String(person.campus_id)) ?? null)
      : null;
    const region = person.region_id
      ? (catalogs.regionById.get(String(person.region_id)) ?? null)
      : null;
    const contractType = person.contract_type_id
      ? (catalogs.contractTypeById.get(String(person.contract_type_id)) ?? null)
      : null;

    return {
      id: String(person.id),

      document: person.document,
      type_document: person.type_document,
      full_name: person.full_name,

      role_id: person.role_id,
      role: role
        ? {
            id: String(role.id),
            name: role.name,
            description: role.description,
          }
        : null,

      hierarchy_id: person.hierarchy_id,
      hierarchy: hierarchy
        ? {
            id: String(hierarchy.id),
            name: hierarchy.name,
            description: hierarchy.description,
          }
        : null,

      area_id: person.area_id,
      area: area
        ? {
            id: String(area.id),
            name: area.name,
            description: area.description,
          }
        : null,

      school_id: person.school_id,
      school: school
        ? {
            id: String(school.id),
            name: school.name,
            description: school.description,
          }
        : null,

      program_id: person.program_id,
      program: program
        ? {
            id: String(program.id),
            name: program.name,
            description: program.description,
            school_id: program.school_id,
          }
        : null,

      contract_type_id: person.contract_type_id,
      contract_type: contractType
        ? {
            id: String(contractType.id),
            name: contractType.name,
            description: contractType.description,
          }
        : null,

      email: person.email,
      edu_email: person.edu_email,
      phone: person.phone,
      address: person.address,

      gender: person.gender,
      marital_status: person.marital_status,
      born_date: person.born_date,
      born_city: person.born_city,

      location: {
        region: region ? { id: region.id, name: region.name } : null,
        city: city ? { id: String(city.id), name: city.name } : null,
        campus: campus ? { id: Number(campus.id), name: campus.name } : null,
      },

      // Fase 1: solo la persona misma como nodo de la cadena.
      // Se extenderá a la cadena completa cuando se integren los niveles superiores.
      hierarchy_path: [this.buildPathNode(person, role, hierarchy)],

      // Fase 1: reportes directos no disponibles hasta integrar la lógica de árbol completa.
      direct_reports_count: 0,
      direct_reports: [],
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async loadCatalogs(): Promise<OrgCatalogs> {
    const [
      roles,
      hierarchies,
      areas,
      schools,
      programs,
      cities,
      campuses,
      contractTypes,
      regions,
    ] = await Promise.all([
      this.roles.find({ order: { id: 'ASC' } }),
      this.hierarchies.find({ order: { id: 'ASC' } }),
      this.areas.find({ order: { id: 'ASC' } }),
      this.schools.find({ order: { id: 'ASC' } }),
      this.programs.find({ order: { id: 'ASC' } }),
      this.cities.find({ order: { id: 'ASC' } }),
      this.campuses.find({ order: { id: 'ASC' } }),
      this.contractTypes.find({ order: { id: 'ASC' } }),
      this.regions.find({ order: { id: 'ASC' } }),
    ]);

    return {
      roleById: this.buildMapById(roles),
      hierarchyById: this.buildMapById(hierarchies),
      areaById: this.buildMapById(areas),
      schoolById: this.buildMapById(schools),
      programById: this.buildMapById(programs),
      cityById: this.buildMapById(cities),
      campusById: this.buildMapById(campuses),
      contractTypeById: this.buildMapById(contractTypes),
      regionById: this.buildMapById(regions),
    };
  }

  private buildOrgNode(
    person: Person,
    catalogs: OrgCatalogs,
    children: OrgNode[],
  ): OrgNode {
    const role = person.role_id
      ? (catalogs.roleById.get(String(person.role_id)) ?? null)
      : null;
    const hierarchy = person.hierarchy_id
      ? (catalogs.hierarchyById.get(String(person.hierarchy_id)) ?? null)
      : null;
    const area = person.area_id
      ? (catalogs.areaById.get(String(person.area_id)) ?? null)
      : null;
    const school = person.school_id
      ? (catalogs.schoolById.get(String(person.school_id)) ?? null)
      : null;
    const program = person.program_id
      ? (catalogs.programById.get(String(person.program_id)) ?? null)
      : null;
    const city = person.city_id
      ? (catalogs.cityById.get(String(person.city_id)) ?? null)
      : null;
    const campus = person.campus_id
      ? (catalogs.campusById.get(String(person.campus_id)) ?? null)
      : null;
    const contractType = person.contract_type_id
      ? (catalogs.contractTypeById.get(String(person.contract_type_id)) ?? null)
      : null;
    const region = person.region_id
      ? (catalogs.regionById.get(String(person.region_id)) ?? null)
      : null;

    return {
      id: String(person.id),
      document: person.document ?? '',
      name: person.full_name ?? '',
      role_id: person.role_id,
      role: role
        ? {
            id: String(role.id),
            name: role.name ?? '',
            description: role.description,
          }
        : null,
      hierarchy_id: person.hierarchy_id,
      hierarchy: hierarchy
        ? {
            id: String(hierarchy.id),
            name: hierarchy.name ?? '',
            description: hierarchy.description,
          }
        : null,
      area_id: person.area_id,
      area: area
        ? {
            id: String(area.id),
            name: area.name ?? '',
            description: area.description,
          }
        : null,
      school_id: person.school_id,
      school: school
        ? {
            id: String(school.id),
            name: school.name ?? '',
            description: school.description,
          }
        : null,
      program_id: person.program_id,
      program: program
        ? {
            id: String(program.id),
            name: program.name ?? '',
            description: program.description,
            school_id: program.school_id,
          }
        : null,
      city: city ? { id: String(city.id), name: city.name ?? '' } : null,
      campus: campus
        ? { id: Number(campus.id), name: campus.name ?? '' }
        : null,
      contract_type: contractType
        ? {
            id: String(contractType.id),
            name: contractType.name ?? '',
            description: contractType.description,
          }
        : null,
      region_id: person.region_id ?? null,
      location: {
        region: region ? { id: region.id, name: region.name } : null,
        city: city ? { id: String(city.id), name: city.name ?? '' } : null,
        campus: campus
          ? { id: Number(campus.id), name: campus.name ?? '' }
          : null,
      },
      email: person.email,
      edu_email: person.edu_email,
      phone: person.phone,
      direct_reports_count: children.length,
      children,
    };
  }

  private buildPathNode(
    person: Person,
    role: Role | null,
    hierarchy: Hierarchy | null,
  ): {
    id: string;
    name: string;
    role_id: string | null;
    role: OrgNodeRole | null;
    hierarchy_id: string | null;
    hierarchy: OrgNodeHierarchy | null;
  } {
    return {
      id: String(person.id),
      name: person.full_name ?? '',
      role_id: person.role_id,
      role: role
        ? {
            id: String(role.id),
            name: role.name ?? '',
            description: role.description,
          }
        : null,
      hierarchy_id: person.hierarchy_id,
      hierarchy: hierarchy
        ? {
            id: String(hierarchy.id),
            name: hierarchy.name ?? '',
            description: hierarchy.description,
          }
        : null,
    };
  }

  private buildMapById<T extends { id: string | number }>(
    rows: T[],
  ): Map<string, T> {
    const map = new Map<string, T>();
    for (const row of rows) {
      map.set(String(row.id), row);
    }
    return map;
  }
}
