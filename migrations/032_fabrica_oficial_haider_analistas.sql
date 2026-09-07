-- Fábrica oficial: Haider como coordinador y, a la vez, como subjefe de
-- analistas (segunda posición: hijo de sí mismo, hermano de Johan y Sara).
-- Los 28 analistas de la planilla cuelgan de ESA posición, no del cargo de
-- coordinador. Solo toca fabrica-contenidos-oficial.
--
-- Recomendado:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/032_fabrica_oficial_haider_analistas.sql

BEGIN;

DO $$
DECLARE
  v_version_id BIGINT;
  v_haider_id CONSTANT BIGINT := 49;
  v_vacancy_id CONSTANT BIGINT := 1206;
  v_dup_rel_id BIGINT;
  v_docs TEXT[] := ARRAY[
    '52495900','1031164534','1000254881','1022356343','1001294362','1000732617',
    '1002460888','1023899594','1015482688','1193092980','1032488010','1030646495',
    '1022445625','1000366409','1000616663','1000590473','1000035262','1000944247',
    '1000622424','93135969','1026254889','1030613471','1001187596','1012410286',
    '1013102120','1000020890','1013100614','1072896519'
  ];
  v_child_ids BIGINT[];
  v_inserted INT;
BEGIN
  SELECT id
  INTO v_version_id
  FROM organigrama.org_chart_version
  WHERE code = 'fabrica-contenidos-oficial'
    AND scope_type = 'COORDINATION'
    AND is_active = false
  LIMIT 1;

  IF v_version_id IS NULL THEN
    RAISE EXCEPTION '032: no existe la versión borrador fabrica-contenidos-oficial';
  END IF;

  SELECT ARRAY_AGG(p.id ORDER BY p.id)
  INTO v_child_ids
  FROM core.person p
  WHERE regexp_replace(p.document, '[^0-9]', '', 'g') = ANY(v_docs);

  IF v_child_ids IS NULL OR CARDINALITY(v_child_ids) <> 28 THEN
    RAISE EXCEPTION '032: se esperaban 28 personas de la planilla, hay %',
      COALESCE(CARDINALITY(v_child_ids), 0);
  END IF;

  SELECT r.id
  INTO v_dup_rel_id
  FROM organigrama.org_visual_relation r
  WHERE r.version_id = v_version_id
    AND r.parent_person_id = v_haider_id
    AND r.child_person_id = v_haider_id
  LIMIT 1;

  IF v_dup_rel_id IS NULL THEN
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
      v_haider_id,
      v_haider_id,
      'DIRECT_REPORT',
      3,
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_dup_rel_id;
  ELSE
    UPDATE organigrama.org_visual_relation
    SET
      is_active = true,
      visual_level = 3,
      updated_at = NOW()
    WHERE id = v_dup_rel_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM organigrama.org_visual_relation_override o
    WHERE o.version_id = v_version_id
      AND o.relation_id = v_dup_rel_id
  ) THEN
    INSERT INTO organigrama.org_visual_relation_override (
      version_id,
      relation_id,
      role_id_override,
      assignment_status,
      assignment_label,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      v_version_id,
      v_dup_rel_id,
      NULL,
      NULL,
      'Subjefe de analistas',
      true,
      NOW(),
      NOW()
    );
  ELSE
    UPDATE organigrama.org_visual_relation_override
    SET
      assignment_label = 'Subjefe de analistas',
      is_active = true,
      updated_at = NOW()
    WHERE version_id = v_version_id
      AND relation_id = v_dup_rel_id;
  END IF;

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
    v_version_id,
    v_dup_rel_id,
    child_id,
    'DIRECT_REPORT',
    4,
    true,
    NOW(),
    NOW()
  FROM unnest(v_child_ids) AS child_id
  ON CONFLICT (version_id, parent_relation_id, child_person_id) DO UPDATE
  SET
    is_active = true,
    visual_level = 4,
    updated_at = NOW();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Dejan de colgar del padre anterior (vacante / otros) en esta versión.
  UPDATE organigrama.org_visual_relation
  SET
    is_active = false,
    updated_at = NOW()
  WHERE version_id = v_version_id
    AND is_active = true
    AND child_person_id = ANY(v_child_ids)
    AND NOT (parent_person_id = v_haider_id AND child_person_id = v_haider_id);

  -- La vacante de analistas queda sustituida por la posición de Haider.
  UPDATE organigrama.org_visual_relation
  SET
    is_active = false,
    updated_at = NOW()
  WHERE version_id = v_version_id
    AND parent_person_id = v_haider_id
    AND child_person_id = v_vacancy_id
    AND is_active = true;

  RAISE NOTICE '032: oficial id=% haider-dup rel=% analistas=%',
    v_version_id, v_dup_rel_id, v_inserted;
END $$;

COMMIT;
