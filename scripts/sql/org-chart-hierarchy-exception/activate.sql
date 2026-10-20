-- PUBLICA (DRAFT → ACTIVE) un lote de excepciones jerárquicas provisionales.
-- Cambia lo que ven TODOS los usuarios en la versión vigente: requiere
-- aprobación explícita antes de ejecutarlo.
--
--   psql ... -v ON_ERROR_STOP=1 \
--     -v batch=provisional-haider-sara-johan-2026-10 \
--     -v actor=1229 \
--     -f scripts/sql/org-chart-hierarchy-exception/activate.sql
--
-- Atómico: si alguna verificación falla, no se publica nada.
-- No toca core ni Planta. Tras el COMMIT, el change-token cambia y backend y
-- navegadores recargan en ≤ ~25 s (sondeo 20 s + memo 5 s).

BEGIN;

SELECT set_config('organigrama.exception_batch', :'batch', true),
       set_config('organigrama.exception_actor', :'actor', true);

DO $$
DECLARE
  v_batch   TEXT   := current_setting('organigrama.exception_batch');
  v_actor   BIGINT := current_setting('organigrama.exception_actor')::BIGINT;
  v_version BIGINT;
  v_overlays BIGINT[];
  v_drafts  INT;
  v_bad     INT;
  v_done    INT;
BEGIN
  SELECT id INTO v_version FROM organigrama.org_chart_version
  WHERE is_active AND scope_type = 'GLOBAL' ORDER BY id LIMIT 1;

  SELECT COALESCE(ARRAY_AGG(id ORDER BY id), ARRAY[]::BIGINT[]) INTO v_overlays
  FROM organigrama.org_chart_version
  WHERE is_active AND scope_type = 'COORDINATION';

  SELECT COUNT(*) INTO v_drafts
  FROM organigrama.org_chart_hierarchy_exception
  WHERE batch_code = v_batch AND status = 'DRAFT';

  IF v_drafts = 0 THEN
    RAISE EXCEPTION 'activate: el lote % no tiene excepciones DRAFT.', v_batch;
  END IF;

  -- Solo se publica sobre la versión global vigente.
  SELECT COUNT(*) INTO v_bad
  FROM organigrama.org_chart_hierarchy_exception
  WHERE batch_code = v_batch AND status = 'DRAFT'
    AND global_version_id <> v_version;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'activate: % excepción(es) del lote no pertenecen a la versión vigente %.', v_bad, v_version;
  END IF;

  -- Persona y jefe deben existir y estar activos.
  SELECT COUNT(*) INTO v_bad
  FROM organigrama.org_chart_hierarchy_exception e
  WHERE e.batch_code = v_batch AND e.status = 'DRAFT'
    AND (NOT EXISTS (SELECT 1 FROM core.person p WHERE p.id = e.person_id AND p.is_active)
      OR NOT EXISTS (SELECT 1 FROM core.person p WHERE p.id = e.parent_person_id AND p.is_active));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'activate: % excepción(es) con persona o jefe inexistente/inactivo.', v_bad;
  END IF;

  -- El jefe debe estar colgado del mapa (o la persona quedaría huérfana).
  SELECT COUNT(*) INTO v_bad
  FROM organigrama.org_chart_hierarchy_exception e
  WHERE e.batch_code = v_batch AND e.status = 'DRAFT'
    AND NOT EXISTS (
      SELECT 1 FROM organigrama.org_chart_effective_relations_published(v_version, v_overlays) r
      WHERE r.child_person_id = e.parent_person_id AND r.child_person_id <> r.parent_person_id
    );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'activate: % excepción(es) cuelgan de un jefe que no está en el mapa vigente.', v_bad;
  END IF;

  UPDATE organigrama.org_chart_hierarchy_exception
  SET status = 'ACTIVE', activated_at = NOW(), activated_by_person_id = v_actor
  WHERE batch_code = v_batch AND status = 'DRAFT';
  GET DIAGNOSTICS v_done = ROW_COUNT;

  -- Verificación: cada persona del lote tiene UNA sola arista y es la provisional
  -- (si cerrara un ciclo la función la rechazaría y esto fallaría).
  SELECT COUNT(*) INTO v_bad
  FROM organigrama.org_chart_hierarchy_exception e
  WHERE e.batch_code = v_batch AND e.status = 'ACTIVE'
    AND (
      SELECT COUNT(*) FILTER (WHERE r.parent_person_id = e.parent_person_id) || '/' || COUNT(*)
      FROM organigrama.org_chart_effective_relations_published(v_version, v_overlays) r
      WHERE r.child_person_id = e.person_id
    ) <> '1/1';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'activate: % persona(s) no quedaron con un único jefe provisional (¿ciclo?). Se revierte.', v_bad;
  END IF;

  RAISE NOTICE 'activate: lote % publicado en versión % (% excepción(es)).', v_batch, v_version, v_done;
END $$;

COMMIT;
