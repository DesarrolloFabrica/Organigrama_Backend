-- Excepciones jerárquicas provisionales con prioridad sobre Planta (Orbit).
--
-- Contexto: el mapa vigente se lee con
--   org_chart_effective_relations_planta(global, overlays)
-- que aplica los overrides de Planta Activa (`core.planta_org_override`)
-- ENCIMA de la versión global y de los overlays de coordinación. Ningún
-- mecanismo existente (versiones, overlays, overrides de rol/relación) puede
-- ganarle a Planta, y los datos de Orbit no se tocan.
--
-- Esta migración añade:
--   1. `organigrama.org_chart_hierarchy_exception`: "esta persona cuelga
--      visualmente de este jefe en esta versión global", con ciclo de vida
--      DRAFT → ACTIVE → RETIRED (auditable; las filas no se borran).
--   2. `organigrama.org_chart_effective_relations_published(global, overlays)`:
--      Planta + excepciones ACTIVE de esa versión global.
--
-- NO crea excepciones ni activa nada: sin filas ACTIVE la función devuelve
-- exactamente lo mismo que la de Planta. El backend la usa solo si existe y
-- solo para la versión global vigente.
--
-- Sin FK a core.person a propósito: no debe bloquear altas/bajas de Orbit.
-- Las personas inexistentes o inactivas no se pintan (el árbol filtra activas).
--
-- Recomendado:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/037_org_chart_hierarchy_exception.sql

BEGIN;

CREATE TABLE IF NOT EXISTS organigrama.org_chart_hierarchy_exception (
  id                   BIGSERIAL PRIMARY KEY,
  global_version_id    BIGINT       NOT NULL
    REFERENCES organigrama.org_chart_version(id),
  person_id            BIGINT       NOT NULL,
  parent_person_id     BIGINT       NOT NULL,
  visual_level         INTEGER      NULL,
  status               VARCHAR(10)  NOT NULL DEFAULT 'DRAFT',
  batch_code           VARCHAR(100) NOT NULL,
  reason               TEXT         NOT NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by_person_id BIGINT       NULL,
  activated_at         TIMESTAMPTZ  NULL,
  activated_by_person_id BIGINT     NULL,
  retired_at           TIMESTAMPTZ  NULL,
  retired_by_person_id BIGINT       NULL,
  retire_reason        TEXT         NULL,
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_org_chart_hierarchy_exception_status
    CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  CONSTRAINT ck_org_chart_hierarchy_exception_not_self
    CHECK (person_id <> parent_person_id),
  CONSTRAINT ck_org_chart_hierarchy_exception_lifecycle
    CHECK (
      (status = 'DRAFT'   AND activated_at IS NULL AND retired_at IS NULL)
      OR (status = 'ACTIVE'  AND activated_at IS NOT NULL AND retired_at IS NULL)
      OR (status = 'RETIRED' AND retired_at IS NOT NULL)
    )
);

COMMENT ON TABLE organigrama.org_chart_hierarchy_exception IS
  'Excepciones jerárquicas provisionales del organigrama vigente. ACTIVE gana a Planta (Orbit) sin modificar core. DRAFT no se pinta; RETIRED vuelve a la jerarquía de Orbit.';

-- Una persona no puede tener dos jefes provisionales publicados a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_chart_hierarchy_exception_active_person
  ON organigrama.org_chart_hierarchy_exception (global_version_id, person_id)
  WHERE status = 'ACTIVE';

-- Ni dos borradores para la misma persona en el mismo lote.
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_chart_hierarchy_exception_draft_person
  ON organigrama.org_chart_hierarchy_exception (global_version_id, batch_code, person_id)
  WHERE status = 'DRAFT';

CREATE INDEX IF NOT EXISTS idx_org_chart_hierarchy_exception_batch
  ON organigrama.org_chart_hierarchy_exception (batch_code);

-- ─── Transiciones permitidas (auditoría) ─────────────────────────────────────
-- DRAFT → ACTIVE, DRAFT → RETIRED (descartar), ACTIVE → RETIRED.
-- Persona, jefe, versión y lote son inmutables: para otra estructura se crea
-- una fila nueva. Reactivar = nueva fila DRAFT.
CREATE OR REPLACE FUNCTION organigrama.org_chart_hierarchy_exception_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.person_id <> OLD.person_id
     OR NEW.parent_person_id <> OLD.parent_person_id
     OR NEW.global_version_id <> OLD.global_version_id
     OR NEW.batch_code <> OLD.batch_code THEN
    RAISE EXCEPTION 'org_chart_hierarchy_exception %: persona, jefe, versión y lote son inmutables', OLD.id;
  END IF;

  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'DRAFT'  AND NEW.status IN ('ACTIVE', 'RETIRED'))
    OR (OLD.status = 'ACTIVE' AND NEW.status = 'RETIRED')
  ) THEN
    RAISE EXCEPTION 'org_chart_hierarchy_exception %: transición % → % no permitida',
      OLD.id, OLD.status, NEW.status;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_org_chart_hierarchy_exception_guard
  ON organigrama.org_chart_hierarchy_exception;

CREATE TRIGGER trg_org_chart_hierarchy_exception_guard
  BEFORE UPDATE ON organigrama.org_chart_hierarchy_exception
  FOR EACH ROW EXECUTE FUNCTION organigrama.org_chart_hierarchy_exception_guard();

-- ─── Grafo publicado = Planta + excepciones ACTIVE ───────────────────────────
-- Misma técnica que org_chart_effective_relations_planta:
--   - la persona con excepción pierde TODAS sus aristas (versión y Planta) y
--     gana una sola, la provisional → sin duplicados ni doble jefe;
--   - si la arista provisional cerrara un ciclo (el jefe cuelga de la propia
--     persona), se rechaza y la persona conserva su lugar de Planta;
--   - UNION + tope de profundidad: termina aun con ciclos previos (49 → 49).
-- Aristas provisionales: id = -person_id (como Planta: no casan con
-- overrides por relación ni hijos por posición).
CREATE OR REPLACE FUNCTION organigrama.org_chart_effective_relations_published(
  p_global_version_id BIGINT,
  p_overlay_version_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[]
)
RETURNS SETOF organigrama.org_visual_relation
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE base AS (
    SELECT *
    FROM organigrama.org_chart_effective_relations_planta(
      p_global_version_id,
      p_overlay_version_ids
    )
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
  'Grafo publicado del organigrama vigente: Planta (Orbit) + excepciones jerárquicas ACTIVE de esa versión global. Sin excepciones activas = Planta.';

COMMIT;
