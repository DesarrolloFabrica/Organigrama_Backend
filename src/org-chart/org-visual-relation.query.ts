import { Not, type Repository } from 'typeorm';
import { OrgVisualRelation } from './entities/org-visual-relation.entity';
import { isOrgChartPlantaEnabled } from './org-chart-version-read-plan';

const PLANTA_CALL =
  'organigrama.org_chart_effective_relations_planta($1, ARRAY[]::bigint[])';

/**
 * La capa Planta de Orbit es el organigrama vigente. No depende del contexto
 * async de la petición: si la versión está activa, las lecturas salen de ahí.
 */
export async function plantaRelationsCall(
  relations: Repository<OrgVisualRelation>,
  versionId: string,
): Promise<string | null> {
  if (!isOrgChartPlantaEnabled()) return null;
  const rows = await relations.query<Array<{ is_active: boolean }>>(
    `SELECT is_active FROM organigrama.org_chart_version WHERE id = $1`,
    [versionId],
  );
  return rows?.[0]?.is_active === true ? PLANTA_CALL : null;
}

/**
 * Busca relaciones visuales activas donde la persona indicada es el padre.
 * Una arista de una persona hacia sí misma no cuenta como equipo.
 */
export async function findActiveVisualRelationsByParentId(
  relations: Repository<OrgVisualRelation>,
  parentPersonId: string,
  versionId: string,
): Promise<OrgVisualRelation[]> {
  const call = await plantaRelationsCall(relations, versionId);
  if (!call) {
    return relations.find({
      where: {
        version_id: versionId,
        parent_person_id: parentPersonId,
        child_person_id: Not(parentPersonId),
        is_active: true,
      },
      order: {
        visual_level: 'ASC',
        child_person_id: 'ASC',
      },
    });
  }

  const rows = await relations.query<OrgVisualRelation[] | null>(
    `
    SELECT *
    FROM ${call} r
    WHERE r.parent_person_id = $2
      AND r.child_person_id <> r.parent_person_id
      AND r.is_active = true
    ORDER BY r.visual_level ASC NULLS LAST, r.child_person_id ASC
    `,
    [versionId, parentPersonId],
  );

  return rows ?? [];
}
