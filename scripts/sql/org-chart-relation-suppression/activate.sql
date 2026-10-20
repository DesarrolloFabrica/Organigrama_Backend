-- PUBLICA (DRAFT → ACTIVE) un lote de supresiones de aristas.
-- Cambia lo que ven TODOS los usuarios en la versión vigente: requiere
-- aprobación explícita antes de ejecutarlo.
--
--   psql ... -v ON_ERROR_STOP=1 \
--     -v batch=provisional-haider-segunda-posicion-2026-10 \
--     -v actor=1229 \
--     -v accept_unplaced= \
--     -f scripts/sql/org-chart-relation-suppression/activate.sql
--
-- `accept_unplaced` (obligatorio, puede ir vacío): ids separados por coma de
-- miembros del equipo por posición que se ACEPTA dejar sin ubicación en el
-- mapa. La supresión NO reasigna a nadie: si alguien quedaría sin ubicación y
-- no está aceptado aquí, la activación se detiene y lo nombra. La lista
-- aceptada debe coincidir exactamente con los afectados y queda registrada.
--
-- Atómico: si alguna verificación falla, no se publica nada.
-- No toca core, Planta ni org_visual_relation. Tras el COMMIT, el change-token
-- cambia y backend y navegadores recargan en ≤ ~25 s.

BEGIN;

SELECT set_config('organigrama.suppression_batch', :'batch', true),
       set_config('organigrama.suppression_actor', :'actor', true),
       set_config('organigrama.suppression_accept_unplaced', :'accept_unplaced', true);

DO $$
DECLARE
  v_batch    TEXT   := current_setting('organigrama.suppression_batch');
  v_actor    BIGINT := current_setting('organigrama.suppression_actor')::BIGINT;
  v_accepted BIGINT[] := COALESCE(
    (SELECT ARRAY_AGG(DISTINCT BTRIM(x)::BIGINT ORDER BY BTRIM(x)::BIGINT)
       FROM unnest(string_to_array(current_setting('organigrama.suppression_accept_unplaced'), ',')) AS x
      WHERE BTRIM(x) <> ''),
    ARRAY[]::BIGINT[]);
  v_version  BIGINT;
  v_overlays BIGINT[];
  v_drafts   INT;
  v_bad      INT;
  v_done     INT;
  v_before   BIGINT[];
  v_after    BIGINT[];
  v_unplaced BIGINT[];
  v_names    TEXT;
BEGIN
  SELECT id INTO v_version FROM organigrama.org_chart_version
  WHERE is_active AND scope_type = 'GLOBAL' ORDER BY id LIMIT 1;

  SELECT COALESCE(ARRAY_AGG(id ORDER BY id), ARRAY[]::BIGINT[]) INTO v_overlays
  FROM organigrama.org_chart_version
  WHERE is_active AND scope_type = 'COORDINATION';

  SELECT COUNT(*) INTO v_drafts
  FROM organigrama.org_chart_relation_suppression
  WHERE batch_code = v_batch AND status = 'DRAFT';

  IF v_drafts = 0 THEN
    RAISE EXCEPTION 'activate: el lote % no tiene supresiones DRAFT.', v_batch;
  END IF;

  SELECT COUNT(*) INTO v_bad
  FROM organigrama.org_chart_relation_suppression
  WHERE batch_code = v_batch AND status = 'DRAFT'
    AND global_version_id <> v_version;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'activate: % supresión(es) del lote no pertenecen a la versión vigente %.', v_bad, v_version;
  END IF;

  -- Identidad: la arista sigue siendo la registrada y hoy se publica.
  SELECT COUNT(*) INTO v_bad
  FROM organigrama.org_chart_relation_suppression s
  WHERE s.batch_code = v_batch AND s.status = 'DRAFT'
    AND NOT EXISTS (
      SELECT 1 FROM organigrama.org_chart_effective_relations_published(v_version, v_overlays) r
      WHERE r.id = s.relation_id
        AND r.parent_person_id = s.parent_person_id
        AND r.child_person_id = s.child_person_id
    );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'activate: % supresión(es) apuntan a una arista que no se publica o cambió de padre/hijo.', v_bad;
  END IF;

  -- Personas visibles antes (con algún jefe en el mapa).
  SELECT ARRAY_AGG(DISTINCT r.child_person_id ORDER BY r.child_person_id) INTO v_before
  FROM organigrama.org_chart_effective_relations_published(v_version, v_overlays) r
  INNER JOIN core.person p ON p.id = r.child_person_id AND p.is_active;

  UPDATE organigrama.org_chart_relation_suppression
  SET status = 'ACTIVE', activated_at = NOW(), activated_by_person_id = v_actor
  WHERE batch_code = v_batch AND status = 'DRAFT';
  GET DIAGNOSTICS v_done = ROW_COUNT;

  -- Verificación 1: las aristas suprimidas ya no se publican.
  SELECT COUNT(*) INTO v_bad
  FROM organigrama.org_chart_relation_suppression s
  WHERE s.batch_code = v_batch AND s.status = 'ACTIVE'
    AND EXISTS (
      SELECT 1 FROM organigrama.org_chart_effective_relations_published(v_version, v_overlays) r
      WHERE r.id = s.relation_id
    );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'activate: % arista(s) siguen publicadas. Se revierte.', v_bad;
  END IF;

  -- Verificación 2: nadie que estaba en el mapa queda fuera, tampoco el
  -- titular de la posición (su arista principal debe seguir publicada).
  SELECT ARRAY_AGG(DISTINCT r.child_person_id ORDER BY r.child_person_id) INTO v_after
  FROM organigrama.org_chart_effective_relations_published(v_version, v_overlays) r
  INNER JOIN core.person p ON p.id = r.child_person_id AND p.is_active;

  SELECT COUNT(*) INTO v_bad
  FROM unnest(v_before) AS b(person_id)
  WHERE b.person_id <> ALL (COALESCE(v_after, ARRAY[]::BIGINT[]));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'activate: % persona(s) quedarían sin jefe en el mapa. Se revierte.', v_bad;
  END IF;

  -- Verificación 3: miembros activos del equipo por posición de las aristas
  -- suprimidas que no quedan colgando de nadie (no hay re-alojo). Solo se
  -- publica si esa lista es exactamente la aceptada en `accept_unplaced`.
  SELECT COALESCE(ARRAY_AGG(DISTINCT pc.child_person_id ORDER BY pc.child_person_id), ARRAY[]::BIGINT[]),
         string_agg(DISTINCT p.full_name || ' (' || pc.child_person_id || ')', ', ')
  INTO v_unplaced, v_names
  FROM organigrama.org_chart_relation_suppression s
  INNER JOIN organigrama.org_visual_relation_position_child pc
    ON pc.parent_relation_id = s.relation_id AND pc.is_active
  INNER JOIN core.person p ON p.id = pc.child_person_id AND p.is_active
  WHERE s.batch_code = v_batch AND s.status = 'ACTIVE'
    AND pc.child_person_id <> s.child_person_id
    AND pc.child_person_id <> ALL (COALESCE(v_after, ARRAY[]::BIGINT[]));

  IF v_unplaced <> v_accepted THEN
    RAISE EXCEPTION 'activate: sin ubicación en el mapa quedarían [%] — aceptados: [%]. Decisión requerida: ubicarlos institucionalmente o aceptarlos con -v accept_unplaced=<ids>. Se revierte.',
      COALESCE(v_names, 'nadie'), array_to_string(v_accepted, ',');
  END IF;

  UPDATE organigrama.org_chart_relation_suppression
  SET accepted_unplaced_person_ids = v_accepted
  WHERE batch_code = v_batch AND status = 'ACTIVE';

  RAISE NOTICE 'activate: lote % publicado en versión % (% supresión(es)); sin ubicación aceptados: [%].',
    v_batch, v_version, v_done, array_to_string(v_accepted, ',');
END $$;

COMMIT;
