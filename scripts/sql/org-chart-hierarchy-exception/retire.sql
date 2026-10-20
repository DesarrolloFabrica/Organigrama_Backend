-- RETIRA (ACTIVE/DRAFT → RETIRED) un lote de excepciones jerárquicas.
-- Vuelve a prevalecer la jerarquía de Orbit (Planta) en la versión vigente.
-- No toca core ni Planta; las filas quedan como historial.
--
--   psql ... -v ON_ERROR_STOP=1 \
--     -v batch=provisional-haider-sara-johan-2026-10 \
--     -v actor=1229 \
--     -v reason='Aprobada la estructura de Orbit' \
--     -f scripts/sql/org-chart-hierarchy-exception/retire.sql
--
-- Tras el COMMIT, el change-token cambia y backend y navegadores recargan.

BEGIN;

SELECT set_config('organigrama.exception_batch', :'batch', true),
       set_config('organigrama.exception_actor', :'actor', true),
       set_config('organigrama.exception_reason', :'reason', true);

DO $$
DECLARE
  v_batch  TEXT   := current_setting('organigrama.exception_batch');
  v_actor  BIGINT := current_setting('organigrama.exception_actor')::BIGINT;
  v_reason TEXT   := NULLIF(BTRIM(current_setting('organigrama.exception_reason')), '');
  v_done   INT;
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'retire: indique -v reason=''motivo''.';
  END IF;

  UPDATE organigrama.org_chart_hierarchy_exception
  SET status = 'RETIRED', retired_at = NOW(), retired_by_person_id = v_actor,
      retire_reason = v_reason
  WHERE batch_code = v_batch AND status IN ('ACTIVE', 'DRAFT');
  GET DIAGNOSTICS v_done = ROW_COUNT;

  IF v_done = 0 THEN
    RAISE EXCEPTION 'retire: el lote % no tiene excepciones ACTIVE ni DRAFT.', v_batch;
  END IF;

  RAISE NOTICE 'retire: lote % retirado (% excepción(es)). Prevalece Planta (Orbit).', v_batch, v_done;
END $$;

COMMIT;
