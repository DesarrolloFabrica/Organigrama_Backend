-- Versiones de organigrama con alcance GLOBAL o COORDINATION.
-- Crea la versión independiente de Fábrica de contenidos (subárbol de
-- person_id 49 / Coordinador Fábrica) copiada desde la versión global activa.
-- No modifica relaciones de otras coordinaciones en versiones globales.
--
-- Recomendado:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/029_org_chart_scoped_versions.sql

BEGIN;

-- ─── Columnas de alcance ─────────────────────────────────────────────────────

ALTER TABLE organigrama.org_chart_version
  ADD COLUMN IF NOT EXISTS scope_type VARCHAR(20) NOT NULL DEFAULT 'GLOBAL';

ALTER TABLE organigrama.org_chart_version
  ADD COLUMN IF NOT EXISTS scope_code VARCHAR(100) NULL;

ALTER TABLE organigrama.org_chart_version
  ADD COLUMN IF NOT EXISTS scope_label VARCHAR(255) NULL;

ALTER TABLE organigrama.org_chart_version
  ADD COLUMN IF NOT EXISTS scope_root_person_id BIGINT NULL;

UPDATE organigrama.org_chart_version
SET scope_type = 'GLOBAL'
WHERE scope_type IS NULL OR scope_type = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_org_chart_version_scope_type'
  ) THEN
    ALTER TABLE organigrama.org_chart_version
      ADD CONSTRAINT ck_org_chart_version_scope_type
      CHECK (scope_type IN ('GLOBAL', 'COORDINATION'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_org_chart_version_scope_consistency'
  ) THEN
    ALTER TABLE organigrama.org_chart_version
      ADD CONSTRAINT ck_org_chart_version_scope_consistency
      CHECK (
        (scope_type = 'GLOBAL' AND scope_code IS NULL AND scope_root_person_id IS NULL)
        OR
        (scope_type = 'COORDINATION' AND scope_code IS NOT NULL AND scope_root_person_id IS NOT NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_org_chart_version_scope_root_person'
  ) THEN
    ALTER TABLE organigrama.org_chart_version
      ADD CONSTRAINT fk_org_chart_version_scope_root_person
      FOREIGN KEY (scope_root_person_id)
      REFERENCES core.person(id);
  END IF;
END $$;

COMMENT ON COLUMN organigrama.org_chart_version.scope_type IS
  'GLOBAL = mapa completo. COORDINATION = overlay independiente de un subárbol.';

COMMENT ON COLUMN organigrama.org_chart_version.scope_code IS
  'Identificador estable de la coordinación (p. ej. fabrica-contenidos). NULL en GLOBAL.';

COMMENT ON COLUMN organigrama.org_chart_version.scope_root_person_id IS
  'Nodo raíz del subárbol versionado. La arista que cuelga este nodo del resto del mapa sigue en la versión global.';

DROP INDEX IF EXISTS organigrama.uq_org_chart_version_single_active;

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_chart_version_single_active_global
  ON organigrama.org_chart_version (is_active)
  WHERE is_active = true AND scope_type = 'GLOBAL';

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_chart_version_single_active_scope
  ON organigrama.org_chart_version (scope_code)
  WHERE is_active = true AND scope_type = 'COORDINATION';

-- ─── Relaciones efectivas (global + overlays de coordinación) ────────────────

CREATE OR REPLACE FUNCTION organigrama.org_chart_effective_relations(
  p_global_version_id BIGINT,
  p_overlay_version_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[]
)
RETURNS SETOF organigrama.org_visual_relation
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE overlay_meta AS (
    SELECT
      v.id AS overlay_version_id,
      v.scope_root_person_id AS root_id
    FROM organigrama.org_chart_version v
    WHERE v.id = ANY(COALESCE(p_overlay_version_ids, ARRAY[]::BIGINT[]))
      AND v.scope_type = 'COORDINATION'
      AND v.scope_root_person_id IS NOT NULL
  ),
  global_subtree AS (
    SELECT m.root_id AS person_id
    FROM overlay_meta m
    UNION
    SELECT r.child_person_id
    FROM organigrama.org_visual_relation r
    INNER JOIN global_subtree t ON r.parent_person_id = t.person_id
    WHERE r.version_id = p_global_version_id
      AND r.is_active = true
  ),
  overlay_subtree AS (
    SELECT
      m.overlay_version_id,
      m.root_id AS person_id
    FROM overlay_meta m
    UNION
    SELECT
      t.overlay_version_id,
      r.child_person_id
    FROM organigrama.org_visual_relation r
    INNER JOIN overlay_subtree t
      ON r.version_id = t.overlay_version_id
     AND r.parent_person_id = t.person_id
    WHERE r.is_active = true
  )
  SELECT r.*
  FROM organigrama.org_visual_relation r
  WHERE r.version_id = p_global_version_id
    AND r.is_active = true
    AND r.parent_person_id NOT IN (SELECT person_id FROM global_subtree)
  UNION ALL
  SELECT r.*
  FROM organigrama.org_visual_relation r
  INNER JOIN overlay_subtree os
    ON os.overlay_version_id = r.version_id
   AND os.person_id = r.parent_person_id
  WHERE r.is_active = true
$$;

COMMENT ON FUNCTION organigrama.org_chart_effective_relations(BIGINT, BIGINT[]) IS
  'Aristas visuales de la versión global con overlays de coordinación: el subárbol de cada root se toma de su versión independiente.';

-- ─── Versión independiente de Fábrica de contenidos ──────────────────────────

DO $$
DECLARE
  v_source_id BIGINT;
  v_new_id BIGINT;
  v_root_id BIGINT;
  v_copied INT;
BEGIN
  SELECT id
  INTO v_source_id
  FROM organigrama.org_chart_version
  WHERE is_active = true
    AND scope_type = 'GLOBAL'
  ORDER BY id ASC
  LIMIT 1;

  IF v_source_id IS NULL THEN
    RAISE NOTICE '029: no hay versión global activa; se omite el snapshot de Fábrica.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM organigrama.org_chart_version
    WHERE code = 'fabrica-contenidos'
  ) THEN
    RAISE NOTICE '029: la versión fabrica-contenidos ya existe; no se duplica.';
    RETURN;
  END IF;

  -- Coordinador Fábrica (Haider, person_id 49) si aparece como padre en la versión activa.
  IF EXISTS (
    SELECT 1
    FROM organigrama.org_visual_relation r
    WHERE r.version_id = v_source_id
      AND r.parent_person_id = 49
      AND r.is_active = true
  ) THEN
    v_root_id := 49;
  ELSE
    SELECT p.id
    INTO v_root_id
    FROM core.person p
    INNER JOIN core.role ro ON ro.id = p.role_id
    INNER JOIN organigrama.org_visual_relation r
      ON r.parent_person_id = p.id
     AND r.version_id = v_source_id
     AND r.is_active = true
    WHERE p.is_active = true
      AND upper(ro.name) LIKE '%COORDINADOR%'
      AND upper(translate(ro.name, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) LIKE '%FABRICA%'
    ORDER BY p.id ASC
    LIMIT 1;
  END IF;

  IF v_root_id IS NULL THEN
    RAISE NOTICE '029: no se encontró el nodo raíz de Fábrica en la versión activa; se omite el snapshot.';
    RETURN;
  END IF;

  INSERT INTO organigrama.org_chart_version (
    code,
    name,
    description,
    period_label,
    is_active,
    is_locked,
    created_by_person_id,
    scope_type,
    scope_code,
    scope_label,
    scope_root_person_id
  )
  VALUES (
    'fabrica-contenidos',
    'Fábrica de contenidos',
    'Versión independiente de Fábrica de contenidos. El resto de coordinaciones sigue la versión global.',
    'Independiente',
    false,
    false,
    1229,
    'COORDINATION',
    'fabrica-contenidos',
    'Fábrica de contenidos',
    v_root_id
  )
  RETURNING id INTO v_new_id;

  WITH RECURSIVE subtree AS (
    SELECT v_root_id AS person_id
    UNION
    SELECT r.child_person_id
    FROM organigrama.org_visual_relation r
    INNER JOIN subtree s ON r.parent_person_id = s.person_id
    WHERE r.version_id = v_source_id
      AND r.is_active = true
  )
  INSERT INTO organigrama.org_visual_relation (
    version_id,
    parent_person_id,
    child_person_id,
    relation_type,
    visual_level,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    v_new_id,
    r.parent_person_id,
    r.child_person_id,
    r.relation_type,
    r.visual_level,
    r.is_active,
    NOW(),
    NOW()
  FROM organigrama.org_visual_relation r
  WHERE r.version_id = v_source_id
    AND r.parent_person_id IN (SELECT person_id FROM subtree);

  GET DIAGNOSTICS v_copied = ROW_COUNT;

  INSERT INTO organigrama.org_chart_person_override (
    version_id,
    person_id,
    role_id_override,
    created_by_person_id
  )
  SELECT
    v_new_id,
    o.person_id,
    o.role_id_override,
    1229
  FROM organigrama.org_chart_person_override o
  WHERE o.version_id = v_source_id
    AND o.person_id IN (
      WITH RECURSIVE subtree AS (
        SELECT v_root_id AS person_id
        UNION
        SELECT r.child_person_id
        FROM organigrama.org_visual_relation r
        INNER JOIN subtree s ON r.parent_person_id = s.person_id
        WHERE r.version_id = v_new_id
          AND r.is_active = true
      )
      SELECT person_id FROM subtree
    )
  ON CONFLICT (version_id, person_id) DO NOTHING;

  INSERT INTO organigrama.org_visual_relation_override (
    version_id,
    relation_id,
    role_id_override,
    assignment_status,
    assignment_label,
    is_active
  )
  SELECT
    v_new_id,
    new_r.id,
    o.role_id_override,
    o.assignment_status,
    o.assignment_label,
    o.is_active
  FROM organigrama.org_visual_relation_override o
  INNER JOIN organigrama.org_visual_relation old_r
    ON old_r.id = o.relation_id
   AND old_r.version_id = v_source_id
  INNER JOIN organigrama.org_visual_relation new_r
    ON new_r.version_id = v_new_id
   AND new_r.parent_person_id = old_r.parent_person_id
   AND new_r.child_person_id = old_r.child_person_id
  WHERE o.version_id = v_source_id;

  INSERT INTO organigrama.org_visual_relation_position_child (
    version_id,
    parent_relation_id,
    child_person_id,
    relation_type,
    visual_level,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    v_new_id,
    new_r.id,
    pc.child_person_id,
    pc.relation_type,
    pc.visual_level,
    pc.is_active,
    NOW(),
    NOW()
  FROM organigrama.org_visual_relation_position_child pc
  INNER JOIN organigrama.org_visual_relation old_r
    ON old_r.id = pc.parent_relation_id
   AND old_r.version_id = v_source_id
  INNER JOIN organigrama.org_visual_relation new_r
    ON new_r.version_id = v_new_id
   AND new_r.parent_person_id = old_r.parent_person_id
   AND new_r.child_person_id = old_r.child_person_id
  WHERE pc.version_id = v_source_id
  ON CONFLICT (version_id, parent_relation_id, child_person_id) DO NOTHING;

  RAISE NOTICE '029: versión fabrica-contenidos id=% root=% relaciones=%', v_new_id, v_root_id, v_copied;
END $$;

COMMIT;
