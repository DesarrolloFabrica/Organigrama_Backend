import type { Repository } from 'typeorm';
import { OrgVisualRelation } from './entities/org-visual-relation.entity';

/**
 * Busca relaciones visuales activas donde la persona indicada es el padre.
 */
export async function findActiveVisualRelationsByParentId(
  relations: Repository<OrgVisualRelation>,
  parentPersonId: string,
): Promise<OrgVisualRelation[]> {
  return relations.find({
    where: {
      parent_person_id: parentPersonId,
      is_active: true,
    },
    order: {
      visual_level: 'ASC',
      child_person_id: 'ASC',
    },
  });
}
