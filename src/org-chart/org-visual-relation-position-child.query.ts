import type { Repository } from 'typeorm';
import { OrgVisualRelationPositionChild } from './entities/org-visual-relation-position-child.entity';

/**
 * Busca hijos activos colgados de una POSICIÓN visual concreta
 * (`org_visual_relation.id`) en la versión indicada.
 *
 * Devuelve [] cuando la posición no tiene hijos por posición; en ese caso el
 * llamador debe mantener el comportamiento actual por `parent_person_id`.
 */
export async function findActivePositionChildrenByParentRelationId(
  positionChildren: Repository<OrgVisualRelationPositionChild>,
  parentRelationId: string,
  versionId: string,
): Promise<OrgVisualRelationPositionChild[]> {
  return positionChildren.find({
    where: {
      version_id: versionId,
      parent_relation_id: parentRelationId,
      is_active: true,
    },
    order: {
      visual_level: 'ASC',
      child_person_id: 'ASC',
    },
  });
}
