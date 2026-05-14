import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Area } from '../catalogs/entities/area.entity';
import { Campus } from '../catalogs/entities/campus.entity';
import { City } from '../catalogs/entities/city.entity';
import { ContractType } from '../catalogs/entities/contract-type.entity';
import { Hierarchy } from '../catalogs/entities/hierarchy.entity';
import { Program } from '../catalogs/entities/program.entity';
import { Region } from '../catalogs/entities/region.entity';
import { Role } from '../catalogs/entities/role.entity';
import { School } from '../catalogs/entities/school.entity';
import { Person } from '../person/entities/person.entity';
import { findActivePeopleByRoleName } from './org-chart-person.query';
import { getEdgesForParentRole } from './org-chart.visual-map';
import type { OrgNode } from './types/org-node.type';

/**
 * Mapas de catálogo Core necesarios para enriquecer nodos (misma forma que en el servicio).
 * Cuando se cablee el engine al servicio, se podrá unificar el tipo con `OrgCatalogs`.
 */
export interface OrgChartCatalogs {
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

/**
 * Callback que materializa un `Person` + hijos ya resueltos en un `OrgNode`.
 * Lo inyecta el servicio (p. ej. su `buildOrgNode` privado) cuando se conecte el motor.
 */
export type BuildOrgNodeFn = (
  person: Person,
  catalogs: OrgChartCatalogs,
  children: OrgNode[],
) => OrgNode;

/**
 * Motor declarativo del árbol visual: aristas en `org-chart.visual-map.ts` + personas en Core.
 */
@Injectable()
export class OrgChartTreeEngine {
  constructor(
    @InjectRepository(Person)
    private readonly persons: Repository<Person>,
  ) {}

  /**
   * Construye los nodos hijos directos de `parent` según las aristas visuales cuyo padre
   * coincide con el rol de `parent`, y recurre para cada hijo encontrado.
   *
   * Flujo:
   * 1. Resolver `core.role.name` del padre vía `catalogs.roleById`.
   * 2. `getEdgesForParentRole` → reglas hijas aplicables (orden del `visual-map`).
   * 3. Por cada arista: `findActivePeopleByRoleName` (match + emails opcionales).
   * 4. Por cada persona hija: recursión con `buildChildrenForPerson` + `buildOrgNode` al cerrar.
   */
  async buildChildrenForPerson(
    parent: Person,
    catalogs: OrgChartCatalogs,
    buildOrgNode: BuildOrgNodeFn,
  ): Promise<OrgNode[]> {
    const parentRoleName = parent.role_id
      ? (catalogs.roleById.get(String(parent.role_id))?.name ?? null)
      : null;

    const edges = getEdgesForParentRole(parentRoleName);
    if (edges.length === 0) {
      return [];
    }

    const nodes: OrgNode[] = [];

    for (const edge of edges) {
      const candidates = await findActivePeopleByRoleName(
        this.persons,
        edge.childRoleName,
        {
          match: edge.childMatch,
          eduEmails: edge.childEduEmails?.length
            ? [...edge.childEduEmails]
            : undefined,
        },
      );

      for (const child of candidates) {
        const nestedChildren = await this.buildChildrenForPerson(
          child,
          catalogs,
          buildOrgNode,
        );
        nodes.push(buildOrgNode(child, catalogs, nestedChildren));
      }
    }

    return nodes;
  }
}
