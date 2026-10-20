import type { Repository } from 'typeorm';
import { OrgVisualRelation } from './entities/org-visual-relation.entity';
import {
  composedRelationsCall,
  withOverlayQueryParams,
} from './org-chart-effective-relation.sql';
import { getOrgChartVersionReadPlan } from './org-chart-version-read-plan';

/**
 * Busca relaciones visuales activas donde la persona indicada es el padre.
 * Con overlays de coordinación o capa Planta usa el mapa compuesto; las
 * aristas nacidas en Planta llegan con id negativo y `visual_level` NULL.
 */
export async function findActiveVisualRelationsByParentId(
  relations: Repository<OrgVisualRelation>,
  parentPersonId: string,
  versionId: string,
): Promise<OrgVisualRelation[]> {
  const { call, overlayIds } = composedRelationsCall('$1', '$3');
  if (!call) {
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
  const rows = await relations.query<OrgVisualRelation[] | null>(
    `
    SELECT *
    FROM ${call}
    WHERE parent_person_id = $2
      AND is_active = true
    ORDER BY visual_level ASC NULLS LAST, child_person_id ASC
    `,
    withOverlayQueryParams([globalVersionId, parentPersonId], overlayIds),
  );

  return rows ?? [];
}
