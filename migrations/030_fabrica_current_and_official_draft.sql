-- Fábrica: el snapshot actual pasa a ser la versión vigente (la que ve
-- todo el mundo). Se crea una copia "oficial" inactiva, visible solo
-- para quien puede consultar versiones. No se publica hasta activarla.
--
-- Recomendado:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/030_fabrica_current_and_official_draft.sql

BEGIN;

UPDATE organigrama.org_chart_version
SET
  is_active = true,
  is_locked = false,
  name = 'Fábrica de contenidos',
  period_label = 'Actual',
  description = 'Versión vigente de Fábrica de contenidos. Es la que ve todo el mundo hasta que se active la próxima oficial.',
  updated_at = NOW()
WHERE code = 'fabrica-contenidos'
  AND scope_type = 'COORDINATION';

DO $$
DECLARE
  v_source_id BIGINT;
  v_new_id BIGINT;
  v_root_id BIGINT;
  v_copied INT;
BEGIN
  SELECT id, scope_root_person_id
  INTO v_source_id, v_root_id
  FROM organigrama.org_chart_version
  WHERE code = 'fabrica-contenidos'
    AND scope_type = 'COORDINATION'
  LIMIT 1;

  IF v_source_id IS NULL OR v_root_id IS NULL THEN
    RAISE NOTICE '030: no existe la versión vigente de Fábrica; se omite el borrador oficial.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM organigrama.org_chart_version
    WHERE code = 'fabrica-contenidos-oficial'
  ) THEN
    RAISE NOTICE '030: fabrica-contenidos-oficial ya existe; no se duplica.';
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
    'fabrica-contenidos-oficial',
    'Fábrica de contenidos (oficial)',
    'Próxima versión oficial de Fábrica. Solo la ven quienes pueden consultar versiones. No sustituye a la vigente hasta que se active.',
    'Próxima oficial',
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

  RAISE NOTICE '030: fabrica-contenidos vigente id=%; oficial borrador id=% relaciones=%',
    v_source_id, v_new_id, v_copied;
END $$;

COMMIT;
