-- Supresiones de aristas en el grafo publicado del organigrama vigente.
--
-- Contexto: con el lote provisional de 038 ACTIVE, Sara (52) y Johan (2)
-- cuelgan de Haider (49). La versión de Fábrica 2.0 (overlay, migración 032)
-- guarda además una SEGUNDA POSICIÓN de Haider: la arista 49 → 49
-- ("analistas de diseño / presentador de contenido / realizador multimedia")
-- con su equipo propio en `org_visual_relation_position_child`. En el mapa,
-- esa posición se pinta como un segundo Haider, hermano de Sara y Johan.
--
-- Esta migración añade:
--   1. `organigrama.org_chart_relation_suppression`: "esta arista (por id) no
--      se publica en esta versión global", con ciclo de vida
--      DRAFT → ACTIVE → RETIRED (auditable; las filas no se borran). Guarda
--      también padre/hijo de la arista para verificar identidad al activar.
--   2. Nueva definición de `org_chart_effective_relations_published`:
--      Planta − aristas suprimidas ACTIVE + excepciones ACTIVE (037).
--      NO reasigna a nadie: los miembros del equipo por posición de la arista
--      suprimida siguen solo donde los ubique Orbit (Planta) o la versión.
--      Si alguno queda sin ubicación en el mapa, activate.sql se detiene y
--      exige una decisión explícita (darle ubicación institucional, o
--      aceptarlo por id en `accepted_unplaced_person_ids`).
--   3. Una supresión DRAFT (no visible) de la segunda posición de Haider.
--
-- No borra ni modifica `org_visual_relation`, sus overrides ni sus hijos por
-- posición; no toca core ni Planta. Sin filas ACTIVE la función devuelve
-- exactamente lo mismo que en 037. Publicar exige ejecutar
-- scripts/sql/org-chart-relation-suppression/activate.sql (aprobación explícita).
--
-- Requiere 037. Idempotente.
--
-- Recomendado:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/039_org_chart_relation_suppression.sql

BEGIN;

CREATE TABLE IF NOT EXISTS organigrama.org_chart_relation_suppression (
  id                     BIGSERIAL PRIMARY KEY,
  global_version_id      BIGINT       NOT NULL
    REFERENCES organigrama.org_chart_version(id),
  relation_id            BIGINT       NOT NULL
    REFERENCES organigrama.org_visual_relation(id),
  parent_person_id       BIGINT       NOT NULL,
  child_person_id        BIGINT       NOT NULL,
  status                 VARCHAR(10)  NOT NULL DEFAULT 'DRAFT',
  batch_code             VARCHAR(100) NOT NULL,
  reason                 TEXT         NOT NULL,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by_person_id   BIGINT       NULL,
  activated_at           TIMESTAMPTZ  NULL,
  activated_by_person_id BIGINT       NULL,
  retired_at             TIMESTAMPTZ  NULL,
  retired_by_person_id   BIGINT       NULL,
  retire_reason          TEXT         NULL,
  -- Personas del equipo por posición que se aceptó, de forma explícita al
  -- activar, dejar sin ubicación en el mapa (auditoría de la decisión).
  accepted_unplaced_person_ids BIGINT[] NOT NULL DEFAULT ARRAY[]::BIGINT[],
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_org_chart_relation_suppression_status
    CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  CONSTRAINT ck_org_chart_relation_suppression_lifecycle
    CHECK (
      (status = 'DRAFT'   AND activated_at IS NULL AND retired_at IS NULL)
      OR (status = 'ACTIVE'  AND activated_at IS NOT NULL AND retired_at IS NULL)
      OR (status = 'RETIRED' AND retired_at IS NOT NULL)
    )
);

COMMENT ON TABLE organigrama.org_chart_relation_suppression IS
  'Aristas de org_visual_relation que no se publican en el organigrama vigente. ACTIVE las oculta del grafo publicado sin borrarlas; RETIRED las vuelve a mostrar.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_chart_relation_suppression_active
  ON organigrama.org_chart_relation_suppression (global_version_id, relation_id)
  WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_chart_relation_suppression_draft
  ON organigrama.org_chart_relation_suppression (global_version_id, batch_code, relation_id)
  WHERE status = 'DRAFT';

CREATE INDEX IF NOT EXISTS idx_org_chart_relation_suppression_batch
  ON organigrama.org_chart_relation_suppression (batch_code);

-- ─── Transiciones permitidas (auditoría) ─────────────────────────────────────
-- Igual que las excepciones: DRAFT → ACTIVE | RETIRED, ACTIVE → RETIRED.
CREATE OR REPLACE FUNCTION organigrama.org_chart_relation_suppression_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.relation_id <> OLD.relation_id
     OR NEW.parent_person_id <> OLD.parent_person_id
     OR NEW.child_person_id <> OLD.child_person_id
     OR NEW.global_version_id <> OLD.global_version_id
     OR NEW.batch_code <> OLD.batch_code THEN
    RAISE EXCEPTION 'org_chart_relation_suppression %: arista, versión y lote son inmutables', OLD.id;
  END IF;

  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'DRAFT'  AND NEW.status IN ('ACTIVE', 'RETIRED'))
    OR (OLD.status = 'ACTIVE' AND NEW.status = 'RETIRED')
  ) THEN
    RAISE EXCEPTION 'org_chart_relation_suppression %: transición % → % no permitida',
      OLD.id, OLD.status, NEW.status;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_org_chart_relation_suppression_guard
  ON organigrama.org_chart_relation_suppression;

CREATE TRIGGER trg_org_chart_relation_suppression_guard
  BEFORE UPDATE ON organigrama.org_chart_relation_suppression
  FOR EACH ROW EXECUTE FUNCTION organigrama.org_chart_relation_suppression_guard();

-- ─── Grafo publicado = (Planta − supresiones) + excepciones ─────────────────
-- - Supresión: la arista se descarta por id (no por persona ni por nivel).
--   Con ella deja de pintarse su equipo por posición (los hijos por posición
--   cuelgan de la arista); cada miembro sigue donde lo ubique Orbit/versión.
-- - Excepciones (037): misma lógica que antes, sobre el grafo sin suprimidas.
-- - NO se reasigna a nadie al titular de la posición: no se crean relaciones
--   sin respaldo institucional.
CREATE OR REPLACE FUNCTION organigrama.org_chart_effective_relations_published(
  p_global_version_id BIGINT,
  p_overlay_version_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[]
)
RETURNS SETOF organigrama.org_visual_relation
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE sup AS (
    SELECT s.relation_id, s.activated_at
    FROM organigrama.org_chart_relation_suppression s
    WHERE s.status = 'ACTIVE'
      AND s.global_version_id = p_global_version_id
  ),
  base AS (
    SELECT pl.*
    FROM organigrama.org_chart_effective_relations_planta(
      p_global_version_id,
      p_overlay_version_ids
    ) pl
    WHERE pl.id NOT IN (SELECT relation_id FROM sup)
  ),
  exc AS (
    SELECT e.person_id, e.parent_person_id, e.visual_level, e.activated_at
    FROM organigrama.org_chart_hierarchy_exception e
    WHERE e.status = 'ACTIVE'
      AND e.global_version_id = p_global_version_id
  ),
  candidate AS (
    SELECT b.parent_person_id, b.child_person_id
    FROM base b
    WHERE b.child_person_id NOT IN (SELECT person_id FROM exc)
    UNION ALL
    SELECT x.parent_person_id, x.person_id
    FROM exc x
  ),
  reach AS (
    SELECT x.person_id AS origin, x.person_id AS node, 0 AS depth
    FROM exc x
    UNION
    SELECT r.origin, c.child_person_id, r.depth + 1
    FROM reach r
    INNER JOIN candidate c ON c.parent_person_id = r.node
    WHERE r.depth < 64
  ),
  cyclic AS (
    SELECT DISTINCT x.person_id
    FROM exc x
    INNER JOIN reach r
      ON r.origin = x.person_id
     AND r.node = x.parent_person_id
  )
  SELECT b.*
  FROM base b
  WHERE b.child_person_id NOT IN (SELECT person_id FROM exc)
     OR b.child_person_id IN (SELECT person_id FROM cyclic)
  UNION ALL
  SELECT
    (-x.person_id)::BIGINT                          AS id,
    x.parent_person_id,
    x.person_id                                     AS child_person_id,
    'DIRECT_REPORT'::VARCHAR(50)                    AS relation_type,
    x.visual_level,
    TRUE                                            AS is_active,
    (x.activated_at AT TIME ZONE 'UTC')::TIMESTAMP  AS created_at,
    (x.activated_at AT TIME ZONE 'UTC')::TIMESTAMP  AS updated_at,
    p_global_version_id                             AS version_id
  FROM exc x
  WHERE x.person_id NOT IN (SELECT person_id FROM cyclic)
$$;

COMMENT ON FUNCTION organigrama.org_chart_effective_relations_published(BIGINT, BIGINT[]) IS
  'Grafo publicado del organigrama vigente: Planta (Orbit) − aristas suprimidas ACTIVE + excepciones jerárquicas ACTIVE de esa versión global. Sin filas ACTIVE = Planta.';

-- ─── Supresión DRAFT: segunda posición de Haider (49 → 49, Fábrica 2.0) ──────
DO $$
DECLARE
  v_batch    CONSTANT TEXT   := 'provisional-haider-segunda-posicion-2026-10';
  v_reason   CONSTANT TEXT   := 'Estructura provisional institucional: Haider Bello aparece una sola vez, como responsable directo de Sara Juliana Martínez y Johan Daza. Se deja de publicar su segunda posición (arista 49 → 49 de Fábrica 2.0, migración 032).';
  v_haider   CONSTANT BIGINT := 49;
  v_actor    CONSTANT BIGINT := 1229;
  v_version  BIGINT;
  v_relation BIGINT;
  v_created  INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM core.person WHERE id = v_haider
                  AND full_name ILIKE '%HAIDER%BELLO%') THEN
    RAISE EXCEPTION '039: person_id % no es HAIDER YESID BELLO MELO.', v_haider;
  END IF;

  SELECT id INTO v_version
  FROM organigrama.org_chart_version
  WHERE is_active = true AND scope_type = 'GLOBAL'
  ORDER BY id
  LIMIT 1;

  IF v_version IS NULL THEN
    RAISE EXCEPTION '039: no hay versión global activa.';
  END IF;

  SELECT r.id INTO v_relation
  FROM organigrama.org_visual_relation r
  INNER JOIN organigrama.org_chart_version v ON v.id = r.version_id
  WHERE v.code = 'fabrica-contenidos-oficial'
    AND v.scope_type = 'COORDINATION'
    AND r.parent_person_id = v_haider
    AND r.child_person_id = v_haider
    AND r.is_active = true;

  IF v_relation IS NULL THEN
    RAISE EXCEPTION '039: no existe la segunda posición activa de Haider (49 → 49) en fabrica-contenidos-oficial.';
  END IF;

  INSERT INTO organigrama.org_chart_relation_suppression (
    global_version_id, relation_id, parent_person_id, child_person_id,
    status, batch_code, reason, created_by_person_id
  )
  SELECT v_version, v_relation, v_haider, v_haider,
         'DRAFT', v_batch, v_reason, v_actor
  WHERE NOT EXISTS (
    SELECT 1 FROM organigrama.org_chart_relation_suppression s
    WHERE s.global_version_id = v_version
      AND s.batch_code = v_batch
      AND s.relation_id = v_relation
  );

  GET DIAGNOSTICS v_created = ROW_COUNT;
  RAISE NOTICE '039: versión global % — arista % — % supresión(es) DRAFT creadas en el lote %.',
    v_version, v_relation, v_created, v_batch;
END $$;

COMMIT;
