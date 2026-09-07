-- Reactiva a MARIA FERNANDA DE LA HOZ ESCORCIA (documento 1048065691) para
-- que vuelva a verse como hija de TANIA LIZETH ROCHA CONTRERAS en la versión
-- vigente global (periodo-agosto-2026).
--
-- Ya existía la arista visual Tania → María (relation 12009), pero Core la
-- dejó inactiva el 2026-08-31 al crear un duplicado LITE (person 1655,
-- documento distinto). El árbol solo pinta personas con is_active = true.
--
-- Idempotente. No toca el duplicado 1655 ni versiones históricas.
--
-- Recomendado:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/036_tania_maria_delahoz_child.sql

BEGIN;

DO $$
DECLARE
  v_version_id CONSTANT BIGINT := 4;
  v_tania_id CONSTANT BIGINT := 1081;
  v_maria_id CONSTANT BIGINT := 1638;
  v_rel_id BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM core.person
    WHERE id = v_maria_id
      AND regexp_replace(COALESCE(document, ''), '[^0-9]', '', 'g') = '1048065691'
      AND LOWER(COALESCE(edu_email, '')) = 'maria_delahoz@cun.edu.co'
  ) THEN
    RAISE EXCEPTION
      '036: person 1638 no coincide con MARIA FERNANDA DE LA HOZ ESCORCIA (1048065691).';
  END IF;

  UPDATE core.person
  SET
    is_active = true,
    phone = COALESCE(NULLIF(TRIM(phone), ''), '3022152552'),
    updated_at = NOW()
  WHERE id = v_maria_id
    AND is_active = false;

  SELECT r.id
  INTO v_rel_id
  FROM organigrama.org_visual_relation r
  WHERE r.version_id = v_version_id
    AND r.parent_person_id = v_tania_id
    AND r.child_person_id = v_maria_id
  LIMIT 1;

  IF v_rel_id IS NULL THEN
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
    VALUES (
      v_version_id,
      v_tania_id,
      v_maria_id,
      'DIRECT_REPORT',
      4,
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_rel_id;
  ELSE
    UPDATE organigrama.org_visual_relation
    SET
      is_active = true,
      visual_level = 4,
      updated_at = NOW()
    WHERE id = v_rel_id;
  END IF;

  RAISE NOTICE '036: Maria person=% activa; arista Tania→Maria rel=%',
    v_maria_id, v_rel_id;
END $$;

COMMIT;
