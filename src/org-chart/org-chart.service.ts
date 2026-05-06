import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
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
import { OrgRelation } from './entities/org-relation.entity';
import type {
  OrgNode,
  OrgNodeHierarchy,
  OrgNodeRole,
} from './types/org-node.type';

@Injectable()
export class OrgChartService {
  constructor(
    @InjectRepository(Person)
    private readonly persons: Repository<Person>,
    @InjectRepository(OrgRelation)
    private readonly relations: Repository<OrgRelation>,
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

  /**
   * Construye el árbol del organigrama desde la BD.
   *
   * Flujo:
   * 1. Lee relaciones activas.
   * 2. Obtiene las personas involucradas.
   * 3. Detecta la raíz como la persona con hierarchy_id = 1.
   * 4. Arma el árbol usando parent_person_id -> child_person_id.
   */
  async getOrgChartTree(): Promise<OrgNode> {
    const activeRelations = await this.relations.find({
      where: { is_active: true },
      order: { hierarchy_id: 'ASC', child_person_id: 'ASC' },
    });

    const persons = await this.persons.find({
      order: { hierarchy_id: 'ASC', full_name: 'ASC' },
    });

    if (persons.length === 0) {
      throw new NotFoundException(
        'No hay personas registradas para mostrar el organigrama.',
      );
    }

    const root = persons.find((person) => String(person.hierarchy_id) === '1');

    if (!root) {
      throw new UnprocessableEntityException(
        'No hay nodo raíz con hierarchy_id = 1. Revise los datos de person.',
      );
    }

    const roles = await this.roles.find({
      where: { is_active: true },
      order: { id: 'ASC' },
    });

    const roleById = this.buildMapById(roles);

    for (const role of roles) {
      roleById.set(String(role.id), role);
    }

    const hierarchies = await this.hierarchies.find({
      where: { is_active: true },
      order: { id: 'ASC' },
    });

    const hierarchyById = new Map<string, Hierarchy>();

    for (const hierarchy of hierarchies) {
      hierarchyById.set(String(hierarchy.id), hierarchy);
    }

    const areas = await this.areas.find({
      where: { is_active: true },
      order: { id: 'ASC' },
    });

    const areaById = new Map<string, Area>();

    for (const area of areas) {
      areaById.set(String(area.id), area);
    }

    const schools = await this.schools.find({
      where: { is_active: true },
      order: { id: 'ASC' },
    });

    const schoolById = new Map<string, School>();

    for (const school of schools) {
      schoolById.set(String(school.id), school);
    }

    const programs = await this.programs.find({
      where: { is_active: true },
      order: { id: 'ASC' },
    });

    const programById = new Map<string, Program>();

    for (const program of programs) {
      programById.set(String(program.id), program);
    }

    const cities = await this.cities.find({
      where: { is_active: true },
      order: { id: 'ASC' },
    });

    const cityById = new Map<string, City>();

    for (const city of cities) {
      cityById.set(String(city.id), city);
    }

    const campuses = await this.campuses.find({
      where: { is_active: true },
      order: { id: 'ASC' },
    });

    const campusById = new Map<string, Campus>();

    for (const campus of campuses) {
      campusById.set(String(campus.id), campus);
    }

    const regions = await this.regions.find({
      where: { is_active: true },
      order: { id: 'ASC' },
    });

    const regionById = new Map<string, Region>();

    for (const region of regions) {
      regionById.set(String(region.id), region);
    }

    const contractTypes = await this.contractTypes.find({
      where: { is_active: true },
      order: { id: 'ASC' },
    });

    const contractTypeById = new Map<string, ContractType>();

    for (const contractType of contractTypes) {
      contractTypeById.set(String(contractType.id), contractType);
    }

    const personById = new Map<string, Person>();

    for (const person of persons) {
      personById.set(String(person.id), person);
    }

    const childrenByParentId = new Map<string, OrgRelation[]>();

    for (const relation of activeRelations) {
      const parentId = String(relation.parent_person_id);
      const bucket = childrenByParentId.get(parentId);

      if (bucket) {
        bucket.push(relation);
      } else {
        childrenByParentId.set(parentId, [relation]);
      }
    }

    return this.mapPersonToOrgNode(
      root,
      personById,
      childrenByParentId,
      roleById,
      hierarchyById,
      areaById,
      schoolById,
      programById,
      cityById,
      campusById,
      contractTypeById,
      regionById,
    );
  }

  private buildMapById<T extends { id: string }>(rows: T[]): Map<string, T> {
    const map = new Map<string, T>();

    for (const row of rows) {
      map.set(String(row.id), row);
    }

    return map;
  }

  private mapPersonToOrgNode(
    person: Person,
    personById: Map<string, Person>,
    childrenByParentId: Map<string, OrgRelation[]>,
    roleById: Map<string, Role>,
    hierarchyById: Map<string, Hierarchy>,
    areaById: Map<string, Area>,
    schoolById: Map<string, School>,
    programById: Map<string, Program>,
    cityById: Map<string, City>,
    campusById: Map<string, Campus>,
    contractTypeById: Map<string, ContractType>,
    regionById: Map<string, Region>,
  ): OrgNode {
    const directRelations = childrenByParentId.get(String(person.id)) ?? [];

    const children = directRelations
      .map((relation) => personById.get(String(relation.child_person_id)))
      .filter((child): child is Person => Boolean(child))
      .sort((a, b) => {
        const levelA = Number(a.hierarchy_id ?? 999);
        const levelB = Number(b.hierarchy_id ?? 999);

        return levelA - levelB || a.full_name.localeCompare(b.full_name);
      })
      .map((child) =>
        this.mapPersonToOrgNode(
          child,
          personById,
          childrenByParentId,
          roleById,
          hierarchyById,
          areaById,
          schoolById,
          programById,
          cityById,
          campusById,
          contractTypeById,
          regionById,
        ),
      );
    const role = person.role_id
      ? (roleById.get(String(person.role_id)) ?? null)
      : null;

    const hierarchy = person.hierarchy_id
      ? (hierarchyById.get(String(person.hierarchy_id)) ?? null)
      : null;
    const area = person.area_id
      ? (areaById.get(String(person.area_id)) ?? null)
      : null;

    const school = person.school_id
      ? (schoolById.get(String(person.school_id)) ?? null)
      : null;

    const program = person.program_id
      ? (programById.get(String(person.program_id)) ?? null)
      : null;

    const city = person.city_id
      ? (cityById.get(String(person.city_id)) ?? null)
      : null;

    const campus = person.campus_id
      ? (campusById.get(String(person.campus_id)) ?? null)
      : null;

    const contractType = person.contract_type_id
      ? (contractTypeById.get(String(person.contract_type_id)) ?? null)
      : null;

    const region = person.region_id
      ? (regionById.get(String(person.region_id)) ?? null)
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
      hierarchy: hierarchy
        ? {
            id: String(hierarchy.id),
            name: hierarchy.name,
            description: hierarchy.description,
          }
        : null,
      area: area
        ? {
            id: String(area.id),
            name: area.name,
            description: area.description,
          }
        : null,
      school: school
        ? {
            id: String(school.id),
            name: school.name,
            description: school.description,
          }
        : null,
      program: program
        ? {
            id: String(program.id),
            name: program.name,
            description: program.description,
            school_id: program.school_id,
          }
        : null,
      city: city
        ? {
            id: String(city.id),
            name: city.name,
          }
        : null,
      campus: campus
        ? {
            id: Number(campus.id),
            name: campus.name,
          }
        : null,
      contract_type: contractType
        ? {
            id: String(contractType.id),
            name: contractType.name,
            description: contractType.description,
          }
        : null,

      region_id: person.region_id,

      location: {
        region: region
          ? {
              id: region.id,
              name: region.name,
            }
          : null,
        city,
        campus,
      },
      hierarchy_id: person.hierarchy_id,
      area_id: person.area_id,
      school_id: person.school_id,
      program_id: person.program_id,
      email: person.email,
      edu_email: person.edu_email,
      phone: person.phone,
      children,
    };
  }

  async searchOrgChart(query: string) {
    const normalizedQuery = query?.trim();

    if (!normalizedQuery) {
      throw new BadRequestException('Debe enviar un parámetro de búsqueda q.');
    }

    const matches = await this.persons.find({
      where: [
        { full_name: ILike(`%${normalizedQuery}%`) },
        { document: ILike(`%${normalizedQuery}%`) },
        { email: ILike(`%${normalizedQuery}%`) },
        { edu_email: ILike(`%${normalizedQuery}%`) },
        { phone: ILike(`%${normalizedQuery}%`) },
      ],
      order: { hierarchy_id: 'ASC', full_name: 'ASC' },
      take: 20,
    });

    if (matches.length === 0) {
      return [];
    }

    const [allPersons, activeRelations, roles, hierarchies] = await Promise.all(
      [
        this.persons.find({
          order: { hierarchy_id: 'ASC', full_name: 'ASC' },
        }),
        this.relations.find({
          where: { is_active: true },
        }),
        this.roles.find({
          where: { is_active: true },
          order: { id: 'ASC' },
        }),
        this.hierarchies.find({
          where: { is_active: true },
          order: { id: 'ASC' },
        }),
      ],
    );

    const personById = new Map<string, Person>();

    for (const person of allPersons) {
      personById.set(String(person.id), person);
    }

    const roleById = new Map<string, Role>();

    for (const role of roles) {
      roleById.set(String(role.id), role);
    }

    const hierarchyById = new Map<string, Hierarchy>();

    for (const hierarchy of hierarchies) {
      hierarchyById.set(String(hierarchy.id), hierarchy);
    }

    const parentByChildId = new Map<string, string>();

    for (const relation of activeRelations) {
      parentByChildId.set(
        String(relation.child_person_id),
        String(relation.parent_person_id),
      );
    }

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

        path: this.buildHierarchyPath(
          person,
          personById,
          parentByChildId,
          roleById,
          hierarchyById,
        ),
      };
    });
  }
  /**
   * Reconstruye la ruta jerárquica de una persona hasta la raíz.
   */
  private buildHierarchyPath(
    person: Person,
    personById: Map<string, Person>,
    parentByChildId: Map<string, string>,
    roleById: Map<string, Role>,
    hierarchyById: Map<string, Hierarchy>,
  ) {
    const path: Array<{
      id: string;
      name: string;
      role_id: string | null;
      role: OrgNodeRole | null;
      hierarchy_id: string | null;
      hierarchy: OrgNodeHierarchy | null;
    }> = [];

    let current: Person | undefined = person;

    while (current) {
      // Busca el rol de la persona actual usando su role_id.
      const role = current.role_id
        ? (roleById.get(String(current.role_id)) ?? null)
        : null;

      // Busca el nivel jerárquico de la persona actual usando su hierarchy_id.
      const hierarchy = current.hierarchy_id
        ? (hierarchyById.get(String(current.hierarchy_id)) ?? null)
        : null;

      // Inserta la persona actual al inicio del path para construir la ruta desde la raíz.
      path.unshift({
        id: String(current.id),
        name: current.full_name,

        role_id: current.role_id,
        role: role
          ? {
              id: String(role.id),
              name: role.name,
              description: role.description,
            }
          : null,

        hierarchy_id: current.hierarchy_id,
        hierarchy: hierarchy
          ? {
              id: String(hierarchy.id),
              name: hierarchy.name,
              description: hierarchy.description,
            }
          : null,
      });

      // Busca el padre de la persona actual.
      const parentId = parentByChildId.get(String(current.id));

      // Si no tiene padre, llegó a la raíz y termina.
      if (!parentId) {
        break;
      }

      // Sube un nivel en la jerarquía.
      current = personById.get(parentId);
    }

    return path;
  }

  /**
   * Devuelve el detalle completo de una persona.
   * Diseñado para alimentar el panel lateral del frontend.
   */
  async getPersonDetail(id: string) {
    const person = await this.persons.findOne({
      where: { id },
    });

    if (!person) {
      throw new NotFoundException(`No existe una persona con id ${id}.`);
    }

    const [
      role,
      hierarchy,
      area,
      school,
      program,
      city,
      campus,
      region,
      contractType,
      activeRelations,
      allPersons,
      roles,
      hierarchies,
    ] = await Promise.all([
      person.role_id
        ? this.roles.findOne({
            where: { id: person.role_id },
          })
        : null,

      person.hierarchy_id
        ? this.hierarchies.findOne({
            where: { id: person.hierarchy_id },
          })
        : null,

      person.area_id
        ? this.areas.findOne({
            where: { id: person.area_id },
          })
        : null,

      person.school_id
        ? this.schools.findOne({
            where: { id: person.school_id },
          })
        : null,

      person.program_id
        ? this.programs.findOne({
            where: { id: person.program_id },
          })
        : null,

      person.city_id
        ? this.cities.findOne({
            where: { id: person.city_id },
          })
        : null,

      person.campus_id
        ? this.campuses.findOne({
            where: { id: person.campus_id },
          })
        : null,

      person.region_id
        ? this.regions.findOne({
            where: { id: person.region_id },
          })
        : null,

      person.contract_type_id
        ? this.contractTypes.findOne({
            where: { id: person.contract_type_id },
          })
        : null,

      this.relations.find({
        where: { is_active: true },
      }),

      this.persons.find(),

      this.roles.find({
        where: { is_active: true },
        order: { id: 'ASC' },
      }),

      this.hierarchies.find({
        where: { is_active: true },
        order: { id: 'ASC' },
      }),
    ]);

    const personById = new Map<string, Person>();

    for (const row of allPersons) {
      personById.set(String(row.id), row);
    }

    const parentByChildId = new Map<string, string>();

    for (const relation of activeRelations) {
      parentByChildId.set(
        String(relation.child_person_id),
        String(relation.parent_person_id),
      );
    }

    const directReports = activeRelations
      .filter(
        (relation) => String(relation.parent_person_id) === String(person.id),
      )
      .map((relation) => personById.get(String(relation.child_person_id)))
      .filter(Boolean);

    const roleById = new Map<string, Role>();

    for (const row of roles) {
      roleById.set(String(row.id), row);
    }

    const hierarchyById = new Map<string, Hierarchy>();

    for (const row of hierarchies) {
      hierarchyById.set(String(row.id), row);
    }

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
        region: region
          ? {
              id: region.id,
              name: region.name,
            }
          : null,

        city: city
          ? {
              id: String(city.id),
              name: city.name,
            }
          : null,

        campus: campus
          ? {
              id: campus.id,
              name: campus.name,
            }
          : null,
      },

      hierarchy_path: this.buildHierarchyPath(
        person,
        personById,
        parentByChildId,
        roleById,
        hierarchyById,
      ),

      direct_reports_count: directReports.length,

      direct_reports: directReports.map((report) => ({
        id: String(report!.id),
        full_name: report!.full_name,
        role_id: report!.role_id,
        hierarchy_id: report!.hierarchy_id,
      })),
    };
  }
}
