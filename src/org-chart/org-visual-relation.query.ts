import type { Repository } from 'typeorm';
import { OrgVisualRelation } from './entities/org-visual-relation.entity';
import {
  getOrgChartOverlayVersionIds,
  getOrgChartVersionReadPlan,
} from './org-chart-version-read-plan';

/**
 * Busca relaciones visuales activas donde la persona indicada es el padre.
 * Con overlays de coordinación usa el mapa compuesto.
 */
export async function findActiveVisualRelationsByParentId(
  relations: Repository<OrgVisualRelation>,
  parentPersonId: string,
  versionId: string,
): Promise<OrgVisualRelation[]> {
  const overlayIds = getOrgChartOverlayVersionIds();
  if (overlayIds.length === 0) {
    return relations.find({
      where: {
        version_id: versionId,
        parent_person_id: parentPersonId,
        is_active: true,
      },
      order: {
        visual_level: 'ASC',
        child_person_id: 'ASC',
      },
    });
  }

  const globalVersionId =
    getOrgChartVersionReadPlan()?.globalVersionId ?? versionId;
  const rows = await relations.query(
    `
    SELECT *
    FROM organigrama.org_chart_effective_relations($1, $2::bigint[])
    WHERE parent_person_id = $3
      AND is_active = true
    ORDER BY visual_level ASC NULLS LAST, child_person_id ASC
    `,
    [globalVersionId, overlayIds, parentPersonId],
  );

  return (rows ?? []) as OrgVisualRelation[];
}
