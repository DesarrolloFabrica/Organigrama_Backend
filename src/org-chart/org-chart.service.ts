import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  forwardRef,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
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
  OrgChartSearchHit,
  OrgNode,
  OrgNodeHierarchy,
  OrgNodeRole,
} from './types/org-node.type';
import { resolveOrgLevelFromRoleName } from './org-chart.visual-map';
import {
  isVacancyPerson as detectVacancyPerson,
  resolveOrgNodeKindFromRoleName,
  VACANCY_ROLE_NAMES_NORMALIZED,
} from './org-chart-vacancy';
import { findActivePeopleByRoleName } from './org-chart-person.query';
import { OrgChartTreeEngine } from './org-chart-tree.engine';
import { PhotoUrlBuilder } from './photos/photo-url.builder';
import { ProfilePhotoLookupService } from './photos/profile-photo-lookup.service';
import { getApiPublicBaseUrl, isOrgChartPhotosEnabled } from './photos/photo.config';
import type { GeneralAreaSummaryDto } from './types/general-area-summary.dto';
import type { OrgSummaryResponseDto } from './types/org-summary.dto';
import { ProfileService } from '../profile/profile.service';

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

/** Id de la persona raíz del organigrama en Core (GET /org-chart/root). */
const ORG_CHART_ROOT_PERSON_ID = '1144';

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class OrgChartService {
  private readonly log = new Logger(OrgChartService.name);

  private catalogsCache: { value: OrgCatalogs; expiresAt: number } | null =
    null;

  private readonly catalogsCacheTtlMs = 5 * 60 * 1000;

  private orgChartRootCache: { value: OrgNode; expiresAt: number } | null =
    null;

  private orgChartNodeCache = new Map<
    string,
    { value: OrgNode; expiresAt: number }
  >();

  private readonly orgChartResponseCacheTtlMs = 60 * 1000;

  private readonly enableOrgChartPerfLogs =
    process.env.ORG_CHART_PERF_LOGS === 'true';

  /** Set de person_id con foto Google persistida (ámbito de una petición de árbol). */
  private googlePhotoPersonIds: Set<string> | null = null;

  constructor(
    private readonly treeEngine: OrgChartTreeEngine,
    private readonly photoUrlBuilder: PhotoUrlBuilder,
    private readonly profilePhotoLookup: ProfilePhotoLookupService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
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
    @Inject(forwardRef(() => ProfileService))
    private readonly profileService: ProfileService,
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

    return await this.buildOrgNode(root, catalogs, children);
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
    return await this.buildOrgNode(person, catalogs, children);
  }

  async getOrgChartChildren(personId: string): Promise<OrgNode[]> {
    return this.withGooglePhotoContext(async () => {
      const person = await this.persons.findOne({ where: { id: personId } });

      if (!person) {
        throw new NotFoundException(
          `No existe una persona con id ${personId} en Core.`,
        );
      }

      const catalogs = await this.loadCatalogsCached();

      return this.treeEngine.buildDirectChildrenForPerson(
        person,
        catalogs,
        (nodePerson, nodeCatalogs, nodeChildren, directReportsCount) =>
          this.buildOrgNode(
            nodePerson,
            nodeCatalogs,
            nodeChildren,
            directReportsCount,
          ),
      );
    });
  }

  /**
   * Nodo raíz del lienzo de exploración: persona activa + hijos directos (sin recursión).
   * GET /api/org-chart/node/:id
   */
  async getOrgChartNode(personId: string): Promise<OrgNode> {
    const now = Date.now();
    const cachedNode = this.orgChartNodeCache.get(personId);

    if (cachedNode && cachedNode.expiresAt > now) {
      this.logOrgChartPerf(`[CacheNode] id=${personId} hit`);
      return cachedNode.value;
    }

    this.logOrgChartPerf(`[CacheNode] id=${personId} miss`);

    return this.withGooglePhotoContext(async () => {
    const perfTotalStart = Date.now();
    const perfId = personId;

    const perfFindPersonStart = Date.now();
    const person = await this.persons.findOne({
      where: {
        id: personId,
        is_active: true,
      },
    });
    this.logOrgChartPerf(
      `[PerfNode] id=${perfId} findPerson: ${Date.now() - perfFindPersonStart}ms`,
    );

    if (!person) {
      throw new NotFoundException(
        `No existe una persona activa con id ${personId} en Core.`,
      );
    }

    const perfLoadCatalogsStart = Date.now();
    const catalogs = await this.loadCatalogsCached();
    this.logOrgChartPerf(
      `[PerfNode] id=${perfId} loadCatalogs: ${Date.now() - perfLoadCatalogsStart}ms`,
    );

    const perfBuildDirectChildrenStart = Date.now();
    const children = await this.treeEngine.buildDirectChildrenForPerson(
      person,
      catalogs,
      (nodePerson, nodeCatalogs, nodeChildren, directReportsCount) =>
        this.buildOrgNode(
          nodePerson,
          nodeCatalogs,
          nodeChildren,
          directReportsCount,
        ),
    );
    this.logOrgChartPerf(
      `[PerfNode] id=${perfId} buildDirectChildren: ${Date.now() - perfBuildDirectChildrenStart}ms`,
    );

    const perfBuildOrgNodeStart = Date.now();
    const node = await this.buildOrgNode(person, catalogs, children);
    this.logOrgChartPerf(
      `[PerfNode] id=${perfId} buildOrgNode: ${Date.now() - perfBuildOrgNodeStart}ms`,
    );

    this.logOrgChartPerf(
      `[PerfNode] id=${perfId} total: ${Date.now() - perfTotalStart}ms`,
    );

    this.pruneExpiredOrgChartNodeCache(now);
    this.orgChartNodeCache.set(personId, {
      value: node,
      expiresAt: now + this.orgChartResponseCacheTtlMs,
    });

    return node;
    });
  }

  async getOrgChartRoot(): Promise<OrgNode> {
    const now = Date.now();

    if (this.orgChartRootCache && this.orgChartRootCache.expiresAt > now) {
      this.logOrgChartPerf('[CacheRoot] hit');
      return this.orgChartRootCache.value;
    }

    this.logOrgChartPerf('[CacheRoot] miss');

    return this.withGooglePhotoContext(async () => {
    const perfTotalStart = Date.now();

    // TODO: mover a variable de entorno, p. ej. ORG_CHART_ROOT_PERSON_ID.
    const perfFindDirectorStart = Date.now();
    const root = await this.persons.findOne({
      where: {
        id: ORG_CHART_ROOT_PERSON_ID,
        is_active: true,
      },
    });
    this.logOrgChartPerf(
      `[PerfRoot] findDirector: ${Date.now() - perfFindDirectorStart}ms`,
    );

    if (!root) {
      throw new NotFoundException(
        `No se encontró la persona raíz del organigrama (id=${ORG_CHART_ROOT_PERSON_ID}, activa) en Core.`,
      );
    }

    const perfLoadCatalogsStart = Date.now();
    const catalogs = await this.loadCatalogsCached();
    this.logOrgChartPerf(
      `[PerfRoot] loadCatalogs: ${Date.now() - perfLoadCatalogsStart}ms`,
    );

    const perfBuildDirectChildrenStart = Date.now();
    const children = await this.treeEngine.buildDirectChildrenForPerson(
      root,
      catalogs,
      (nodePerson, nodeCatalogs, nodeChildren, directReportsCount) =>
        this.buildOrgNode(
          nodePerson,
          nodeCatalogs,
          nodeChildren,
          directReportsCount,
        ),
    );
    this.logOrgChartPerf(
      `[PerfRoot] buildDirectChildren: ${Date.now() - perfBuildDirectChildrenStart}ms`,
    );

    const perfBuildRootNodeStart = Date.now();
    const rootNode = await this.buildOrgNode(root, catalogs, children);
    this.logOrgChartPerf(
      `[PerfRoot] buildOrgNode: ${Date.now() - perfBuildRootNodeStart}ms`,
    );

    this.logOrgChartPerf(`[PerfRoot] total: ${Date.now() - perfTotalStart}ms`);

    this.orgChartRootCache = {
      value: rootNode,
      expiresAt: now + this.orgChartResponseCacheTtlMs,
    };

    return rootNode;
    });
  }

  // ─── GET /org-chart/summary/general-areas ───────────────────────────────────

  /**
   * Resumen por áreas generales: hijos directos del root visual y total de
   * personas bajo cada jerarquía (todos los descendientes vía org_visual_relation).
   *
   * `totalPeople` incluye vacantes y personas reales (misma regla que countAllDescendants).
   * `vacancies` cuenta solo placeholders con rol vacante en el subárbol del área (incluye el nodo área si aplica).
   */
  async getGeneralAreasSummary(): Promise<GeneralAreaSummaryDto[]> {
    const rootNode = await this.getOrgChartRoot();
    const generalAreas = rootNode.children;

    if (generalAreas.length === 0) {
      return [];
    }

    const summaries = await Promise.all(
      generalAreas.map(async (area) => {
        const [totalPeople, vacancies] = await Promise.all([
          this.countAllDescendants(area.id),
          this.countVacanciesInSubtree(area.id, true),
        ]);

        return {
          id: area.id,
          name: area.name,
          roleName: area.role?.name ?? null,
          totalPeople,
          vacancies,
        };
      }),
    );

    return summaries;
  }

  // ─── GET /org-chart/summary/:personId ─────────────────────────────────────

  /**
   * Resumen jerárquico de un nodo:
   *  - general: total de descendientes del nodo actual.
   *  - areas: solo hijos directos, cada uno con el total completo de su jerarquía.
   *
   * `totalPeople` incluye vacantes y personas reales bajo el nodo (sin contar al propio nodo).
   * `vacancies` cuenta placeholders con rol vacante (descendientes; en `areas` también el hijo directo si aplica).
   */
  async getNodeSummary(personId: string): Promise<OrgSummaryResponseDto> {
    const person = await this.persons.findOne({
      where: { id: personId, is_active: true },
    });

    if (!person) {
      throw new NotFoundException(
        `Persona ${personId} no encontrada o inactiva.`,
      );
    }

    const catalogs = await this.loadCatalogsCached();
    const role = person.role_id
      ? catalogs.roleById.get(String(person.role_id))
      : undefined;

    const [totalPeople, generalVacancies] = await Promise.all([
      this.countAllDescendants(personId),
      this.countVacancyDescendants(personId),
    ]);

    const directChildRows: { child_person_id: string }[] =
      await this.dataSource.query(
        `SELECT child_person_id
           FROM organigrama.org_visual_relation
          WHERE parent_person_id = $1
            AND is_active = true`,
        [personId],
      );

    const childIds = directChildRows.map((r) => r.child_person_id);

    let areas: OrgSummaryResponseDto['areas'] = [];

    if (childIds.length > 0) {
      const childPersons = await this.persons.find({
        where: childIds.map((id) => ({ id, is_active: true })),
      });

      const childMap = new Map(childPersons.map((p) => [String(p.id), p]));

      areas = await Promise.all(
        childIds
          .filter((id) => childMap.has(id))
          .map(async (id) => {
            const child = childMap.get(id)!;
            const childRole = child.role_id
              ? catalogs.roleById.get(String(child.role_id))
              : undefined;
            const [childTotal, childVacancies] = await Promise.all([
              this.countAllDescendants(id),
              this.countVacanciesInSubtree(id, true),
            ]);

            return {
              id: String(child.id),
              name: child.full_name,
              roleName: childRole?.name ?? null,
              totalPeople: childTotal,
              vacancies: childVacancies,
            };
          }),
      );
    }

    return {
      general: {
        id: String(person.id),
        name: person.full_name,
        roleName: role?.name ?? null,
        totalPeople,
        vacancies: generalVacancies,
      },
      areas,
    };
  }

  // ─── GET /org-chart/search?q= ──────────────────────────────────────────────

  /**
   * Búsqueda ligera de personas activas por nombre, correo o documento.
   * La ruta jerárquica (`path`) es mínima (solo el propio hit) hasta integrar el árbol.
   */
  async searchOrgChart(query: string): Promise<OrgChartSearchHit[]> {
    const term = (query ?? '').trim();
    if (term.length < 2) {
      return [];
    }

    const pattern = `%${term}%`;
    const matches = await this.persons.find({
      where: [
        { is_active: true, full_name: ILike(pattern) },
        { is_active: true, email: ILike(pattern) },
        { is_active: true, edu_email: ILike(pattern) },
        { is_active: true, document: ILike(pattern) },
      ],
      take: 20,
      order: { id: 'ASC' },
    });

    if (matches.length === 0) {
      return [];
    }

    const catalogs = await this.loadCatalogs();

    return matches.map((person) => {
      const role = person.role_id
        ? (catalogs.roleById.get(String(person.role_id)) ?? null)
        : null;
      const hierarchy = person.hierarchy_id
        ? (catalogs.hierarchyById.get(String(person.hierarchy_id)) ?? null)
        : null;

      const nodeKind = this.isVacancyPerson(person, catalogs)
        ? ('vacancy' as const)
        : ('person' as const);

      return {
        id: String(person.id),
        document: person.document ?? '',
        name: person.full_name ?? '',
        nodeKind,
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
        school_id: person.school_id,
        program_id: person.program_id,
        email: person.email,
        edu_email: person.edu_email,
        phone: person.phone,
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

    const nodeKind = resolveOrgNodeKindFromRoleName(role?.name);

    const directReportsCount = await this.countDirectVisualChildren(
      String(person.id),
    );

    const emergency_contact = await this.profileService.getEmergencyContactForPerson(
      String(person.id),
    );

    return {
      id: String(person.id),
      nodeKind,

      document: person.document,
      type_document: person.type_document,
      full_name: person.full_name,
      photoUrl:
        nodeKind === 'vacancy' ? null : await this.resolvePhotoUrl(person),

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

      emergency_contact,

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

      direct_reports_count: directReportsCount,
      direct_reports: [],
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private logOrgChartPerf(message: string): void {
    if (this.enableOrgChartPerfLogs) {
      this.log.log(message);
    }
  }

  /**
   * Hijos directos activos en `organigrama.org_visual_relation` (para ficha y acciones).
   */
  private async countDirectVisualChildren(personId: string): Promise<number> {
    const result = await this.dataSource.query(
      `
      SELECT COUNT(*)::int AS total
      FROM organigrama.org_visual_relation r
      INNER JOIN core.person p
        ON p.id = r.child_person_id
        AND p.is_active = true
      WHERE r.parent_person_id = $1
        AND r.is_active = true;
      `,
      [personId],
    );

    return Number(result?.[0]?.total ?? 0);
  }

  /**
   * Cuenta todas las personas descendientes activas bajo `personId` en el grafo visual.
   */
  private async countAllDescendants(personId: string): Promise<number> {
    const result = await this.dataSource.query(
      `
      WITH RECURSIVE descendants AS (
        SELECT
          r.child_person_id
        FROM organigrama.org_visual_relation r
        INNER JOIN core.person p
          ON p.id = r.child_person_id
          AND p.is_active = true
        WHERE r.parent_person_id = $1
          AND r.is_active = true

        UNION ALL

        SELECT
          r.child_person_id
        FROM organigrama.org_visual_relation r
        INNER JOIN descendants d
          ON r.parent_person_id = d.child_person_id
        INNER JOIN core.person p
          ON p.id = r.child_person_id
          AND p.is_active = true
        WHERE r.is_active = true
      )
      SELECT COUNT(*)::int AS total
      FROM descendants;
      `,
      [personId],
    );

    return Number(result?.[0]?.total ?? 0);
  }

  /**
   * Placeholders con rol vacante entre los descendientes activos (sin incluir a `personId`).
   */
  private async countVacancyDescendants(personId: string): Promise<number> {
    return this.countVacanciesInSubtree(personId, false);
  }

  /**
   * Cuenta vacantes en el subárbol visual bajo `rootPersonId`.
   * Con `includeRoot`, el propio nodo cuenta si su rol es vacante.
   */
  private async countVacanciesInSubtree(
    rootPersonId: string,
    includeRoot: boolean,
  ): Promise<number> {
    if (includeRoot) {
      const result = await this.dataSource.query(
        `
        WITH RECURSIVE subtree AS (
          SELECT $1::bigint AS person_id

          UNION ALL

          SELECT
            r.child_person_id
          FROM organigrama.org_visual_relation r
          INNER JOIN subtree s
            ON r.parent_person_id = s.person_id
          INNER JOIN core.person p
            ON p.id = r.child_person_id
            AND p.is_active = true
          WHERE r.is_active = true
        )
        SELECT COUNT(*)::int AS total
        FROM subtree s
        INNER JOIN core.person p
          ON p.id = s.person_id
          AND p.is_active = true
        INNER JOIN core.role ro
          ON ro.id = p.role_id
        WHERE UPPER(TRIM(ro.name)) = ANY($2::text[]);
        `,
        [rootPersonId, VACANCY_ROLE_NAMES_NORMALIZED],
      );
      return Number(result?.[0]?.total ?? 0);
    }

    const result = await this.dataSource.query(
      `
      WITH RECURSIVE descendants AS (
        SELECT
          r.child_person_id AS person_id
        FROM organigrama.org_visual_relation r
        INNER JOIN core.person p
          ON p.id = r.child_person_id
          AND p.is_active = true
        WHERE r.parent_person_id = $1
          AND r.is_active = true

        UNION ALL

        SELECT
          r.child_person_id
        FROM organigrama.org_visual_relation r
        INNER JOIN descendants d
          ON r.parent_person_id = d.person_id
        INNER JOIN core.person p
          ON p.id = r.child_person_id
          AND p.is_active = true
        WHERE r.is_active = true
      )
      SELECT COUNT(*)::int AS total
      FROM descendants d
      INNER JOIN core.person p
        ON p.id = d.person_id
        AND p.is_active = true
      INNER JOIN core.role ro
        ON ro.id = p.role_id
      WHERE UPPER(TRIM(ro.name)) = ANY($2::text[]);
      `,
      [rootPersonId, VACANCY_ROLE_NAMES_NORMALIZED],
    );

    return Number(result?.[0]?.total ?? 0);
  }

  private isVacancyPerson(person: Person, catalogs: OrgCatalogs): boolean {
    return detectVacancyPerson(person, catalogs.roleById);
  }

  /** Tras persistir foto de perfil: el JSON cacheado puede omitir `photoUrl`. */
  clearResponseCaches(): void {
    this.orgChartRootCache = null;
    this.orgChartNodeCache.clear();
  }

  private async withGooglePhotoContext<T>(fn: () => Promise<T>): Promise<T> {
    const ids = await this.profilePhotoLookup.findAllGooglePhotoPersonIds();
    this.googlePhotoPersonIds = new Set(ids);
    try {
      return await fn();
    } finally {
      this.googlePhotoPersonIds = null;
    }
  }

  private pruneExpiredOrgChartNodeCache(now: number): void {
    for (const [key, entry] of this.orgChartNodeCache.entries()) {
      if (entry.expiresAt <= now) {
        this.orgChartNodeCache.delete(key);
      }
    }
  }

  private async loadCatalogsCached(): Promise<OrgCatalogs> {
    const now = Date.now();

    if (this.catalogsCache && this.catalogsCache.expiresAt > now) {
      return this.catalogsCache.value;
    }

    const value = await this.loadCatalogs();

    this.catalogsCache = {
      value,
      expiresAt: now + this.catalogsCacheTtlMs,
    };

    return value;
  }

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

  private async buildOrgNode(
    person: Person,
    catalogs: OrgCatalogs,
    children: OrgNode[],
    directReportsCount?: number,
  ): Promise<OrgNode> {
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

    const nodeKind = resolveOrgNodeKindFromRoleName(role?.name);

    return {
      id: String(person.id),
      document: person.document ?? '',
      name: person.full_name ?? '',
      nodeKind,
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
      direct_reports_count: directReportsCount ?? children.length,
      children,
      photoUrl:
        nodeKind === 'vacancy' ? null : await this.resolvePhotoUrl(person),
    };
  }

  /**
   * URL de foto vía proxy cuando hay foto Google persistida, mock root o Workspace + edu_email.
   */
  private async resolvePhotoUrl(person: Person): Promise<string | null> {
    if (!isOrgChartPhotosEnabled()) {
      return this.photoUrlBuilder.buildLegacyDirectPhotoUrl(person);
    }

    const personId = String(person.id);
    const hasPersisted =
      this.googlePhotoPersonIds?.has(personId) ??
      (await this.profilePhotoLookup.hasPersistedGooglePhoto(personId));

    if (
      this.photoUrlBuilder.shouldExposeProxyUrl(person, hasPersisted)
    ) {
      return `${getApiPublicBaseUrl()}/api/org-chart/photos/${person.id}`;
    }

    return null;
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
