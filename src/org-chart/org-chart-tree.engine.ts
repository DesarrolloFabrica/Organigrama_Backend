import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
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
import { OrgVisualRelation } from './entities/org-visual-relation.entity';
import { findActiveVisualRelationsByParentId } from './org-visual-relation.query';

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
  directReportsCount?: number,
) => OrgNode | Promise<OrgNode>;

/**
 * Motor declarativo del árbol visual: aristas en `org-chart.visual-map.ts` + personas en Core.
 */
@Injectable()
export class OrgChartTreeEngine {
  constructor(
    @InjectRepository(Person)
    private readonly persons: Repository<Person>,

    @InjectRepository(OrgVisualRelation)
    private readonly visualRelations: Repository<OrgVisualRelation>,
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
    const visualRelations = await findActiveVisualRelationsByParentId(
      this.visualRelations,
      String(parent.id),
    );

    if (visualRelations.length > 0) {
      const nodes: OrgNode[] = [];

      for (const relation of visualRelations) {
        const child = await this.persons.findOne({
          where: {
            id: String(relation.child_person_id),
            is_active: true,
          },
        });

        if (!child) continue;

        const nestedChildren = await this.buildChildrenForPerson(
          child,
          catalogs,
          buildOrgNode,
        );

        nodes.push(await buildOrgNode(child, catalogs, nestedChildren));
      }

      return nodes;
    }
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
        nodes.push(await buildOrgNode(child, catalogs, nestedChildren));
      }
    }

    return nodes;
  }

  async buildDirectChildrenForPerson(
    parent: Person,
    catalogs: OrgChartCatalogs,
    buildOrgNode: BuildOrgNodeFn,
  ): Promise<OrgNode[]> {
    const visualRelations = await findActiveVisualRelationsByParentId(
      this.visualRelations,
      String(parent.id),
    );

    if (visualRelations.length > 0) {
      const orderedChildren = await this.loadActivePersonsOrderedByRelationIds(
        visualRelations.map((r) => String(r.child_person_id)),
      );

      const countMap = await this.countActiveDirectChildrenByParentIds(
        orderedChildren.map((c) => String(c.id)),
      );

      return Promise.all(
        orderedChildren.map(async (child) => {
          const directCount = await this.resolveDirectReportsCount(
            child,
            catalogs,
            countMap,
          );
          return await buildOrgNode(child, catalogs, [], directCount);
        }),
      );
    }

    const parentRoleName = parent.role_id
      ? (catalogs.roleById.get(String(parent.role_id))?.name ?? null)
      : null;

    const edges = getEdgesForParentRole(parentRoleName);

    if (edges.length === 0) {
      return [];
    }

    const candidates: Person[] = [];

    for (const edge of edges) {
      const found = await findActivePeopleByRoleName(
        this.persons,
        edge.childRoleName,
        {
          match: edge.childMatch,
          eduEmails: edge.childEduEmails?.length
            ? [...edge.childEduEmails]
            : undefined,
        },
      );
      candidates.push(...found);
    }

    const countMap = await this.countActiveDirectChildrenByParentIds(
      candidates.map((c) => String(c.id)),
    );

    return Promise.all(
      candidates.map(async (child) => {
        const directCount = await this.resolveDirectReportsCount(
          child,
          catalogs,
          countMap,
        );
        return await buildOrgNode(child, catalogs, [], directCount);
      }),
    );
  }

  /** Carga personas activas por id preservando el orden de `orderedIds`. */
  private async loadActivePersonsOrderedByRelationIds(
    orderedIds: string[],
  ): Promise<Person[]> {
    if (orderedIds.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(orderedIds)];
    const rows = await this.persons.find({
      where: { id: In(uniqueIds), is_active: true },
    });
    const byId = new Map(rows.map((p) => [String(p.id), p]));

    return orderedIds
      .map((id) => byId.get(id))
      .filter((p): p is Person => p != null);
  }

  /**
   * Conteo de hijos directos activos por `parent_person_id` en `org_visual_relation`.
   */
  private async countActiveDirectChildrenByParentIds(
    parentIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (parentIds.length === 0) {
      return map;
    }

    const uniqueIds = [...new Set(parentIds)];
    const rows = await this.visualRelations
      .createQueryBuilder('r')
      .innerJoin(Person, 'p', 'p.id = r.child_person_id')
      .select('r.parent_person_id', 'parentId')
      .addSelect('COUNT(*)', 'cnt')
      .where('r.parent_person_id IN (:...parentIds)', { parentIds: uniqueIds })
      .andWhere('r.is_active = :relActive', { relActive: true })
      .andWhere('p.is_active = :personActive', { personActive: true })
      .groupBy('r.parent_person_id')
      .getRawMany<{ parentId: string; cnt: string }>();

    for (const row of rows) {
      map.set(String(row.parentId), Number(row.cnt));
    }

    return map;
  }

  /** Conteo total de reportes directos (relaciones visuales o fallback por rol). */
  private async countDirectChildrenForPerson(
    person: Person,
    catalogs: OrgChartCatalogs,
  ): Promise<number> {
    const visualRelations = await findActiveVisualRelationsByParentId(
      this.visualRelations,
      String(person.id),
    );

    if (visualRelations.length > 0) {
      const children = await this.loadActivePersonsOrderedByRelationIds(
        visualRelations.map((r) => String(r.child_person_id)),
      );
      return children.length;
    }

    const parentRoleName = person.role_id
      ? (catalogs.roleById.get(String(person.role_id))?.name ?? null)
      : null;

    const edges = getEdgesForParentRole(parentRoleName);
    if (edges.length === 0) {
      return 0;
    }

    let total = 0;
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
      total += candidates.length;
    }

    return total;
  }

  /**
   * Usa el mapa batch de relaciones visuales; si no hay entrada, calcula por rol.
   */
  private async resolveDirectReportsCount(
    person: Person,
    catalogs: OrgChartCatalogs,
    visualCountMap: Map<string, number>,
  ): Promise<number> {
    const id = String(person.id);
    if (visualCountMap.has(id)) {
      return visualCountMap.get(id) ?? 0;
    }
    return this.countDirectChildrenForPerson(person, catalogs);
  }
}
