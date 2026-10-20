-- Prepara (DRAFT, NO visible) la estructura provisional institucional:
--   SARA JULIANA MARTINEZ LOPEZ (52)      → hija directa de HAIDER YESID BELLO MELO (49)
--   JOHAN SEBASTIAN DAZA SARMIENTO (2)    → hijo directo de HAIDER YESID BELLO MELO (49)
--
-- Orbit (Planta) los tiene hoy bajo RAUL VALENCIA CIFUENTES (1082) y así se
-- conserva: no toca core.person, core.planta_org_override ni ninguna versión.
-- Sus equipos siguen colgando de ellos y se mueven con ellos.
--
-- visual_level igual al que tenían bajo Haider en las versiones 4/6
-- (Sara 3, Johan 4), para conservar el orden del mapa.
--
-- Solo crea filas DRAFT en la versión global ACTIVA. Publicar exige ejecutar
-- scripts/sql/org-chart-hierarchy-exception/activate.sql (aprobación explícita).
-- Requiere 037. Idempotente.
--
-- Recomendado:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/038_provisional_haider_sara_johan_draft.sql

BEGIN;

DO $$
DECLARE
  v_batch   CONSTANT TEXT   := 'provisional-haider-sara-johan-2026-10';
  v_reason  CONSTANT TEXT   := 'Estructura provisional institucional: Sara Juliana Martínez y Johan Daza como hijos directos de Haider Bello mientras se aprueba la estructura registrada en Orbit.';
  v_haider  CONSTANT BIGINT := 49;
  v_sara    CONSTANT BIGINT := 52;
  v_johan   CONSTANT BIGINT := 2;
  v_actor   CONSTANT BIGINT := 1229;
  v_version BIGINT;
  v_created INT;
BEGIN
  -- ─── Guardas de identidad ─────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM core.person WHERE id = v_haider
                  AND full_name ILIKE '%HAIDER%BELLO%') THEN
    RAISE EXCEPTION '038: person_id % no es HAIDER YESID BELLO MELO.', v_haider;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM core.person WHERE id = v_sara
                  AND full_name ILIKE '%SARA%JULIANA%MARTINEZ%') THEN
    RAISE EXCEPTION '038: person_id % no es SARA JULIANA MARTINEZ LOPEZ.', v_sara;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM core.person WHERE id = v_johan
                  AND full_name ILIKE '%JOHAN%DAZA%') THEN
    RAISE EXCEPTION '038: person_id % no es JOHAN SEBASTIAN DAZA SARMIENTO.', v_johan;
  END IF;

  SELECT id INTO v_version
  FROM organigrama.org_chart_version
  WHERE is_active = true AND scope_type = 'GLOBAL'
  ORDER BY id
  LIMIT 1;

  IF v_version IS NULL THEN
    RAISE EXCEPTION '038: no hay versión global activa.';
  END IF;

  INSERT INTO organigrama.org_chart_hierarchy_exception (
    global_version_id, person_id, parent_person_id, visual_level,
    status, batch_code, reason, created_by_person_id
  )
  SELECT v_version, x.person_id, v_haider, x.visual_level,
         'DRAFT', v_batch, v_reason, v_actor
  FROM (VALUES (v_sara, 3), (v_johan, 4)) AS x(person_id, visual_level)
  WHERE NOT EXISTS (
    SELECT 1 FROM organigrama.org_chart_hierarchy_exception e
    WHERE e.global_version_id = v_version
      AND e.batch_code = v_batch
      AND e.person_id = x.person_id
  );

  GET DIAGNOSTICS v_created = ROW_COUNT;
  RAISE NOTICE '038: versión global % — % excepción(es) DRAFT creadas en el lote %.',
    v_version, v_created, v_batch;
END $$;

COMMIT;
