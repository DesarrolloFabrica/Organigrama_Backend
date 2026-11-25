import type { VisualRelationSqlSource } from './org-chart-effective-relation.sql';

/**
 * CTE compartidas de las UBICACIONES efectivas (persona, jefe) del mapa:
 * `effective_edges`, `edges` y `placements` (una fila por persona y jefe).
 *
 * Extraídas sin cambios de la consulta del directorio para que el exportador
 * (pestañas por coordinación) y el alcance de vacantes del panel deriven las
 * coordinaciones de exactamente las mismas ubicaciones. Las reglas están
 * documentadas en `directorySql` (org-chart-directory-export.service.ts).
 *
 * Usar detrás de `WITH`; `source` sale de `visualRelationSqlSource` y la
 * consulta debe ejecutarse dentro de `runWithOrgChartVersionReadPlan`.
 */
export function directoryPlacementCtes(
  source: VisualRelationSqlSource,
): string {
  return `effective_edges AS (
  SELECT r.id, r.parent_person_id, r.child_person_id
  FROM ${source.from}
  WHERE ${source.versionPredicate}
    AND r.is_active = true
),
edges AS (
  SELECT
    ee.child_person_id::text AS person_id,
    ee.parent_person_id::text AS boss_id,
    ee.id::text AS relation_id,
    0 AS edge_rank
  FROM effective_edges ee
  WHERE ee.parent_person_id <> ee.child_person_id

  UNION ALL

  SELECT
    pc.child_person_id::text AS person_id,
    ee.child_person_id::text AS boss_id,
    NULL::text AS relation_id,
    1 AS edge_rank
  FROM organigrama.org_visual_relation_position_child pc
  INNER JOIN effective_edges ee
    ON ee.id = pc.parent_relation_id
  WHERE pc.is_active = true
    AND pc.child_person_id <> ee.child_person_id

  UNION ALL

  SELECT
    parent_edge.parent_person_id::text AS person_id,
    NULL::text AS boss_id,
    NULL::text AS relation_id,
    2 AS edge_rank
  FROM effective_edges parent_edge
  WHERE NOT EXISTS (
    SELECT 1
    FROM effective_edges child_edge
    WHERE child_edge.child_person_id = parent_edge.parent_person_id
      AND child_edge.parent_person_id <> child_edge.child_person_id
  )
),
placements AS (
  SELECT DISTINCT ON (e.person_id, COALESCE(e.boss_id, ''))
    e.person_id,
    e.boss_id,
    e.relation_id,
    e.edge_rank
  FROM edges e
  ORDER BY e.person_id, COALESCE(e.boss_id, ''), e.edge_rank, e.relation_id NULLS LAST
)`;
}
