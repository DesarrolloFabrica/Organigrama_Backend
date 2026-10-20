-- Copia fiel (2026-10-16) de los objetos de Planta Activa que Orbit creó en
-- Cloud SQL y que no están versionados en este repo. Solo para pruebas SQL
-- aisladas (ver src/org-chart/org-chart-hierarchy-exception.sql.spec.ts).
-- Fuente: pg_get_functiondef / information_schema sobre la base real (lectura).

ALTER TABLE core.person ADD COLUMN IF NOT EXISTS manager_id BIGINT NULL
  REFERENCES core.person(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS core.planta_org_override (
  person_id        BIGINT PRIMARY KEY REFERENCES core.person(id) ON DELETE CASCADE,
  parent_person_id BIGINT NULL REFERENCES core.person(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT planta_org_override_not_self
    CHECK (parent_person_id IS NULL OR parent_person_id <> person_id)
);

CREATE OR REPLACE FUNCTION organigrama.org_chart_effective_relations_planta(p_global_version_id bigint, p_overlay_version_ids bigint[] DEFAULT ARRAY[]::bigint[])
 RETURNS SETOF organigrama.org_visual_relation
 LANGUAGE sql
 STABLE
AS $function$
  WITH RECURSIVE base AS (
    SELECT *
    FROM organigrama.org_chart_effective_relations(
      p_global_version_id,
      p_overlay_version_ids
    )
  ),
  ovr AS (
    SELECT o.person_id, o.parent_person_id, o.updated_at
    FROM core.planta_org_override o
    WHERE o.parent_person_id IS NULL
       OR o.parent_person_id <> o.person_id
  ),
  synth AS (
    SELECT
      o.parent_person_id AS parent_person_id,
      o.person_id        AS child_person_id,
      o.updated_at       AS updated_at
    FROM ovr o
    WHERE o.parent_person_id IS NOT NULL
  ),
  candidate AS (
    SELECT b.parent_person_id, b.child_person_id
    FROM base b
    WHERE b.child_person_id NOT IN (SELECT person_id FROM ovr)
    UNION ALL
    SELECT s.parent_person_id, s.child_person_id
    FROM synth s
  ),
  reach AS (
    SELECT s.child_person_id AS origin, s.child_person_id AS node, 0 AS depth
    FROM synth s
    UNION
    SELECT r.origin, c.child_person_id, r.depth + 1
    FROM reach r
    INNER JOIN candidate c ON c.parent_person_id = r.node
    WHERE r.depth < 64
  ),
  cyclic AS (
    SELECT DISTINCT s.child_person_id
    FROM synth s
    INNER JOIN reach r
      ON r.origin = s.child_person_id
     AND r.node = s.parent_person_id
  )
  SELECT
    b.id,
    b.parent_person_id,
    b.child_person_id,
    b.relation_type,
    b.visual_level,
    b.is_active,
    b.created_at,
    b.updated_at,
    b.version_id
  FROM base b
  WHERE b.child_person_id NOT IN (SELECT person_id FROM ovr)
     OR b.child_person_id IN (SELECT child_person_id FROM cyclic)
  UNION ALL
  SELECT
    (-s.child_person_id)::BIGINT     AS id,
    s.parent_person_id,
    s.child_person_id,
    'DIRECT_REPORT'::VARCHAR(50)     AS relation_type,
    NULL::INTEGER                    AS visual_level,
    TRUE                             AS is_active,
    (s.updated_at AT TIME ZONE 'UTC')::TIMESTAMP AS created_at,
    (s.updated_at AT TIME ZONE 'UTC')::TIMESTAMP AS updated_at,
    p_global_version_id              AS version_id
  FROM synth s
  WHERE s.child_person_id NOT IN (SELECT child_person_id FROM cyclic)
$function$;
