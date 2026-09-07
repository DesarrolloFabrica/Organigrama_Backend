-- Fábrica oficial: el segundo cargo de Haider (hijo de sí mismo) mantiene el
-- rol COORDINADOR AREA FABRICA Y DESARROLLO y añade la distinción de subárea
-- para analistas de diseño / presentador / realizador. Solo toca
-- fabrica-contenidos-oficial.
--
-- Recomendado:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/033_fabrica_oficial_haider_analistas_label.sql

BEGIN;

DO $$
DECLARE
  v_version_id BIGINT;
  v_haider_id CONSTANT BIGINT := 49;
  v_label CONSTANT TEXT :=
    'analistas de diseño / presentador de contenido / realizador multimedia';
BEGIN
  SELECT id
  INTO v_version_id
  FROM organigrama.org_chart_version
  WHERE code = 'fabrica-contenidos-oficial'
    AND scope_type = 'COORDINATION'
    AND is_active = false
  LIMIT 1;

  IF v_version_id IS NULL THEN
    RAISE EXCEPTION '033: no existe la versión borrador fabrica-contenidos-oficial';
  END IF;

  UPDATE organigrama.org_visual_relation_override o
  SET
    assignment_label = v_label,
    is_active = true,
    updated_at = NOW()
  FROM organigrama.org_visual_relation r
  WHERE o.version_id = v_version_id
    AND o.relation_id = r.id
    AND r.version_id = v_version_id
    AND r.parent_person_id = v_haider_id
    AND r.child_person_id = v_haider_id
    AND r.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION '033: no hay override de la posición duplicada de Haider';
  END IF;

  RAISE NOTICE '033: oficial id=% haider-dup label actualizado', v_version_id;
END $$;

COMMIT;
