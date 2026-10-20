-- Estado de las supresiones de aristas (SOLO LECTURA).
--
--   psql ... -v ON_ERROR_STOP=1 -f scripts/sql/org-chart-relation-suppression/status.sql

BEGIN READ ONLY;

-- 1. Supresiones y su ciclo de vida.
SELECT s.id, s.batch_code, s.status, s.global_version_id, s.relation_id,
       r.version_id AS relation_version_id,
       s.parent_person_id, pp.full_name AS padre,
       s.child_person_id, pc.full_name AS hijo,
       s.created_at, s.activated_at, s.activated_by_person_id,
       s.retired_at, s.retired_by_person_id, s.retire_reason
FROM organigrama.org_chart_relation_suppression s
LEFT JOIN organigrama.org_visual_relation r ON r.id = s.relation_id
LEFT JOIN core.person pp ON pp.id = s.parent_person_id
LEFT JOIN core.person pc ON pc.id = s.child_person_id
ORDER BY s.batch_code, s.id;

-- 2. Equipo por posición de cada arista suprimida: jefe publicado de cada
--    miembro según Orbit/versión. NULL = quedaría (o queda) sin ubicación en
--    el mapa: la supresión no reasigna a nadie.
WITH v AS (
  SELECT id FROM organigrama.org_chart_version
  WHERE is_active AND scope_type = 'GLOBAL' ORDER BY id LIMIT 1
), ov AS (
  SELECT COALESCE(ARRAY_AGG(id ORDER BY id), ARRAY[]::BIGINT[]) ids
  FROM organigrama.org_chart_version
  WHERE is_active AND scope_type = 'COORDINATION'
)
SELECT s.relation_id, pc.child_person_id, p.full_name, p.is_active,
       (SELECT string_agg(pub.parent_person_id::text || '#' || pub.id::text, ',')
          FROM organigrama.org_chart_effective_relations_published((SELECT id FROM v), (SELECT ids FROM ov)) pub
         WHERE pub.child_person_id = pc.child_person_id) AS jefe_publicado
FROM organigrama.org_chart_relation_suppression s
JOIN organigrama.org_visual_relation_position_child pc
  ON pc.parent_relation_id = s.relation_id AND pc.is_active
JOIN core.person p ON p.id = pc.child_person_id
WHERE s.status IN ('DRAFT', 'ACTIVE')
ORDER BY s.relation_id, pc.child_person_id;

ROLLBACK;
