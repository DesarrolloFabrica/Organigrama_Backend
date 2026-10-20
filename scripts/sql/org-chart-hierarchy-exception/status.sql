-- Estado de las excepciones jerárquicas provisionales (SOLO LECTURA).
--
--   psql ... -v ON_ERROR_STOP=1 -f scripts/sql/org-chart-hierarchy-exception/status.sql

BEGIN READ ONLY;

-- 1. Excepciones y su ciclo de vida.
SELECT e.id, e.batch_code, e.status, e.global_version_id,
       e.person_id, p.full_name AS persona,
       e.parent_person_id, j.full_name AS jefe_provisional,
       e.visual_level, e.created_at, e.activated_at, e.activated_by_person_id,
       e.retired_at, e.retired_by_person_id, e.retire_reason
FROM organigrama.org_chart_hierarchy_exception e
LEFT JOIN core.person p ON p.id = e.person_id
LEFT JOIN core.person j ON j.id = e.parent_person_id
ORDER BY e.batch_code, e.id;

-- 2. Estado A (publicado) vs Estado B (Orbit) para cada persona con excepción.
WITH v AS (
  SELECT id FROM organigrama.org_chart_version
  WHERE is_active AND scope_type = 'GLOBAL' ORDER BY id LIMIT 1
), ov AS (
  SELECT COALESCE(ARRAY_AGG(id ORDER BY id), ARRAY[]::BIGINT[]) ids
  FROM organigrama.org_chart_version
  WHERE is_active AND scope_type = 'COORDINATION'
)
SELECT e.person_id, p.full_name,
       (SELECT string_agg(pl.parent_person_id::text, ',')
          FROM organigrama.org_chart_effective_relations_planta((SELECT id FROM v), (SELECT ids FROM ov)) pl
         WHERE pl.child_person_id = e.person_id) AS jefe_orbit_planta,
       (SELECT string_agg(pub.parent_person_id::text, ',')
          FROM organigrama.org_chart_effective_relations_published((SELECT id FROM v), (SELECT ids FROM ov)) pub
         WHERE pub.child_person_id = e.person_id) AS jefe_publicado
FROM (SELECT DISTINCT person_id FROM organigrama.org_chart_hierarchy_exception) e
JOIN core.person p ON p.id = e.person_id
ORDER BY e.person_id;

ROLLBACK;
