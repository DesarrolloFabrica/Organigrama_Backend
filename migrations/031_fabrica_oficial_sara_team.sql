-- Reestructura el equipo de Sara solo en Fábrica (oficial / borrador).
-- No modifica la versión vigente ni el resto de coordinaciones.
--
-- Padre: SARA JULIANA MARTINEZ LOPEZ (person_id 52)
-- Hijos directos = las 11 personas de la planilla (documento).
--
-- Recomendado:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/031_fabrica_oficial_sara_team.sql

BEGIN;

DO $$
DECLARE
  v_version_id BIGINT;
  v_sara_id CONSTANT BIGINT := 52;
  v_child_ids BIGINT[] := ARRAY[
    1647, -- ANGIE STEFANY VERA MEDINA
    1190, -- BLANCA ALEJANDRA HERRERA DUCUARA
    1178, -- DORIS KATHERINE AVILA HERNANDEZ
    1188, -- HARI STEFFAN TOTENA SILVA
    1181, -- LUIS MIGUEL CUSPIAN ANGUCHO
    1303, -- FELIPE GUERRERO BUENAVENTURA
    1305, -- VICTOR DANIEL RODRIGUEZ HURTADO
    1306, -- PAULA GONZALEZ CABEZAS
    1307, -- NATALIA TINJACA GAMBA
    1308, -- NICOLÁS MARTINEZ PEÑA
    1309  -- CHRISTIAN GARZON ORTIZ
  ];
  v_moved INT;
  v_parked INT;
BEGIN
  SELECT id
  INTO v_version_id
  FROM organigrama.org_chart_version
  WHERE code = 'fabrica-contenidos-oficial'
    AND scope_type = 'COORDINATION'
    AND is_active = false
  LIMIT 1;

  IF v_version_id IS NULL THEN
    RAISE EXCEPTION '031: no existe la versión borrador fabrica-contenidos-oficial';
  END IF;

  -- Cuelga a las 11 personas de Sara (mueve si ya tenían otro padre en esta versión).
  UPDATE organigrama.org_visual_relation r
  SET
    parent_person_id = v_sara_id,
    visual_level = 4,
    is_active = true,
    updated_at = NOW()
  WHERE r.version_id = v_version_id
    AND r.child_person_id = ANY(v_child_ids)
    AND r.parent_person_id <> v_sara_id
    AND NOT EXISTS (
      SELECT 1
      FROM organigrama.org_visual_relation existing
      WHERE existing.version_id = v_version_id
        AND existing.parent_person_id = v_sara_id
        AND existing.child_person_id = r.child_person_id
    );

  GET DIAGNOSTICS v_moved = ROW_COUNT;

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
    v_version_id,
    v_sara_id,
    child_id,
    'DIRECT_REPORT',
    4,
    true,
    NOW(),
    NOW()
  FROM unnest(v_child_ids) AS child_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM organigrama.org_visual_relation r
    WHERE r.version_id = v_version_id
      AND r.parent_person_id = v_sara_id
      AND r.child_person_id = child_id
  );

  -- Quien ya está bajo Sara y no va en la planilla: se desactiva (sigue en vigente).
  UPDATE organigrama.org_visual_relation
  SET
    is_active = false,
    updated_at = NOW()
  WHERE version_id = v_version_id
    AND parent_person_id = v_sara_id
    AND is_active = true
    AND child_person_id <> ALL(v_child_ids);

  GET DIAGNOSTICS v_parked = ROW_COUNT;

  RAISE NOTICE '031: oficial id=% movidos=% aparcados=%', v_version_id, v_moved, v_parked;
END $$;

COMMIT;
