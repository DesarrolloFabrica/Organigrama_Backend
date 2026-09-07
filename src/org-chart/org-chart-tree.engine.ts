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
import { OrgVisualRelationPositionChild } from './entities/org-visual-relation-position-child.entity';
import { findActiveVisualRelationsByParentId } from './org-visual-relation.query';
import { findActivePositionChildrenByParentRelationId } from './org-visual-relation-position-child.query';
import {
  getOrgChartOverlayVersionIds,
  getOrgChartVersionReadPlan,
} from './org-chart-version-read-plan';

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
  /**
   * Relación visual que produjo este nodo (padre→persona). Permite aplicar
   * overrides por relación específica. Es `undefined` para el nodo raíz/padre
   * y para los nodos resueltos por el fallback de rol (sin arista en BD).
   */
  relation?: OrgVisualRelation,
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

    @InjectRepository(OrgVisualRelationPositionChild)
    private readonly positionChildren: Repository<OrgVisualRelationPositionChild>,
  ) {}

  async buildChildrenForPerson(
    parent: Person,
    catalogs: OrgChartCatalogs,
    buildOrgNode: BuildOrgNodeFn,
    versionId: string,
    /**
     * Posición (arista `org_visual_relation.id`) que produjo a `parent`. Si se
     * provee y existen hijos por posición, se usan esos como equipo en lugar de
     * los hijos por `parent_person_id`. Permite que la misma persona tenga
     * equipos distintos según la posición que ocupa.
     */
    parentRelationId?: string | null,
  ): Promise<OrgNode[]> {
    // 1) Hijos por POSICIÓN: si el nodo viene de una arista concreta y esa
    //    posición tiene hijos propios, tienen prioridad (compatibilidad: si no
    //    hay, se cae al comportamiento por persona más abajo).
    if (parentRelationId) {
      const positionChildren =
        await findActivePositionChildrenByParentRelationId(
          this.positionChildren,
          String(parentRelationId),
          versionId,
        );

      if (positionChildren.length > 0) {
        const orderedChildren =
          await this.loadActivePersonsOrderedByRelationIds(
            positionChildren.map((c) => String(c.child_person_id)),
          );

        const nodes: OrgNode[] = [];
        for (const child of orderedChildren) {
          // Los hijos por posición no provienen de una arista
          // `org_visual_relation`, así que sus propios hijos se resuelven por
          // `parent_person_id` (sin relación, parentRelationId = undefined).
          const nestedChildren = await this.buildChildrenForPerson(
            child,
            catalogs,
            buildOrgNode,
            versionId,
          );
          nodes.push(await buildOrgNode(child, catalogs, nestedChildren));
        }
        return nodes;
      }
    }

    const visualRelations = await findActiveVisualRelationsByParentId(
      this.visualRelations,
      String(parent.id),
      versionId,
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
          versionId,
          String(relation.id),
        );

        nodes.push(
          await buildOrgNode(child, catalogs, nestedChildren, undefined, relation),
        );
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
          versionId,
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
    versionId: string,
    /**
     * Posición (arista `org_visual_relation.id`) cuya descendencia se pide. Si
     * se provee y la posición tiene hijos propios, se usan esos en lugar de los
     * hijos por `parent_person_id`. Si no hay, se mantiene el comportamiento
     * actual (compatibilidad hacia atrás).
     */
    parentRelationId?: string | null,
  ): Promise<OrgNode[]> {
    // 1) Hijos por POSICIÓN específica (tienen prioridad sobre los de persona).
    if (parentRelationId) {
      const positionChildren =
        await findActivePositionChildrenByParentRelationId(
          this.positionChildren,
          String(parentRelationId),
          versionId,
        );

      if (positionChildren.length > 0) {
        const orderedChildren =
          await this.loadActivePersonsOrderedByRelationIds(
            positionChildren.map((c) => String(c.child_person_id)),
          );

        // El conteo de reportes de cada hijo por posición se calcula por
        // `parent_person_id` (sus propios hijos siguen el modelo actual).
        const countMap = await this.countActiveDirectChildrenByParentIds(
          orderedChildren.map((c) => String(c.id)),
          versionId,
        );

        return Promise.all(
          orderedChildren.map(async (child) => {
            const directCount = await this.resolveDirectReportsCount(
              child,
              catalogs,
              countMap,
              versionId,
            );
            // Sin arista `org_visual_relation`: el nodo no expone relation_id,
            // por lo que su expansión usará el fallback por persona.
            return await buildOrgNode(child, catalogs, [], directCount);
          }),
        );
      }
    }

    const visualRelations = await findActiveVisualRelationsByParentId(
      this.visualRelations,
      String(parent.id),
      versionId,
    );

    if (visualRelations.length > 0) {
      const orderedChildren = await this.loadActivePersonsOrderedByRelationIds(
        visualRelations.map((r) => String(r.child_person_id)),
      );

      // Conserva la relación (arista) asociada a cada hijo para aplicar
      // overrides por relación específica en `buildOrgNode`.
      const relationByChildId = new Map<string, OrgVisualRelation>(
        visualRelations.map((r) => [String(r.child_person_id), r]),
      );

      const countMap = await this.countActiveDirectChildrenByParentIds(
        orderedChildren.map((c) => String(c.id)),
        versionId,
      );

      // Conteo de hijos por POSICIÓN por arista: si una posición tiene equipo
      // propio, su conteo manda sobre el de persona (refleja el equipo correcto
      // de esa posición específica, p. ej. el cargo temporal).
      const positionCountByRelationId =
        await this.countActivePositionChildrenByParentRelationIds(
          visualRelations.map((r) => String(r.id)),
          versionId,
        );

      return Promise.all(
        orderedChildren.map(async (child) => {
          const relation = relationByChildId.get(String(child.id));
          const positionCount = relation
            ? positionCountByRelationId.get(String(relation.id))
            : undefined;
          const directCount =
            positionCount !== undefined && positionCount > 0
              ? positionCount
              : await this.resolveDirectReportsCount(
                  child,
                  catalogs,
                  countMap,
                  versionId,
                );
          return await buildOrgNode(child, catalogs, [], directCount, relation);
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
      versionId,
    );

    return Promise.all(
      candidates.map(async (child) => {
        const directCount = await this.resolveDirectReportsCount(
          child,
          catalogs,
          countMap,
          versionId,
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
    versionId: string,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (parentIds.length === 0) {
      return map;
    }

    const uniqueIds = [...new Set(parentIds)];
    const overlayIds = getOrgChartOverlayVersionIds();
    const rows =
      overlayIds.length === 0
        ? await this.visualRelations
            .createQueryBuilder('r')
            .innerJoin(Person, 'p', 'p.id = r.child_person_id')
            .select('r.parent_person_id', 'parentId')
            .addSelect('COUNT(DISTINCT r.child_person_id)', 'cnt')
            .where('r.version_id = :versionId', { versionId })
            .andWhere('r.parent_person_id IN (:...parentIds)', {
              parentIds: uniqueIds,
            })
            .andWhere('r.is_active = :relActive', { relActive: true })
            .andWhere('p.is_active = :personActive', { personActive: true })
            .groupBy('r.parent_person_id')
            .getRawMany<{ parentId: string; cnt: string }>()
        : await this.visualRelations.query(
            `
            SELECT r.parent_person_id AS "parentId",
                   COUNT(DISTINCT r.child_person_id)::text AS cnt
            FROM organigrama.org_chart_effective_relations($1, $2::bigint[]) r
            INNER JOIN core.person p ON p.id = r.child_person_id
            WHERE r.parent_person_id = ANY($3::bigint[])
              AND r.is_active = true
              AND p.is_active = true
            GROUP BY r.parent_person_id
            `,
            [
              getOrgChartVersionReadPlan()?.globalVersionId ?? versionId,
              overlayIds,
              uniqueIds,
            ],
          );

    for (const row of rows) {
      map.set(String(row.parentId), Number(row.cnt));
    }

    return map;
  }

  /**
   * Conteo de hijos activos por POSICIÓN (`parent_relation_id`) en la versión,
   * agrupado por arista. Solo cuenta personas activas.
   */
  private async countActivePositionChildrenByParentRelationIds(
    parentRelationIds: string[],
    versionId: string,
  ): Promise<Map<string, number>> {
    void versionId;
    const map = new Map<string, number>();
    if (parentRelationIds.length === 0) {
      return map;
    }

    const uniqueIds = [...new Set(parentRelationIds)];
    const rows = await this.positionChildren
      .createQueryBuilder('pc')
      .innerJoin(Person, 'p', 'p.id = pc.child_person_id')
      .select('pc.parent_relation_id', 'relationId')
      .addSelect('COUNT(DISTINCT pc.child_person_id)', 'cnt')
      .where('pc.parent_relation_id IN (:...relationIds)', {
        relationIds: uniqueIds,
      })
      .andWhere('pc.is_active = :pcActive', { pcActive: true })
      .andWhere('p.is_active = :personActive', { personActive: true })
      .groupBy('pc.parent_relation_id')
      .getRawMany<{ relationId: string; cnt: string }>();

    for (const row of rows) {
      map.set(String(row.relationId), Number(row.cnt));
    }

    return map;
  }

  /** Conteo total de reportes directos (relaciones visuales o fallback por rol). */
  private async countDirectChildrenForPerson(
    person: Person,
    catalogs: OrgChartCatalogs,
    versionId: string,
  ): Promise<number> {
    const visualRelations = await findActiveVisualRelationsByParentId(
      this.visualRelations,
      String(person.id),
      versionId,
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
    versionId: string,
  ): Promise<number> {
    const id = String(person.id);
    if (visualCountMap.has(id)) {
      return visualCountMap.get(id) ?? 0;
    }
    return this.countDirectChildrenForPerson(person, catalogs, versionId);
  }
}
