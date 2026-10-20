-- RETIRA (ACTIVE/DRAFT → RETIRED) un lote de supresiones de aristas.
-- Las aristas vuelven a publicarse tal como están en su versión.
-- No toca core, Planta ni org_visual_relation; las filas quedan como historial.
--
--   psql ... -v ON_ERROR_STOP=1 \
--     -v batch=provisional-haider-segunda-posicion-2026-10 \
--     -v actor=1229 \
--     -v reason='Se restablece la segunda posición' \
--     -f scripts/sql/org-chart-relation-suppression/retire.sql
--
-- Tras el COMMIT, el change-token cambia y backend y navegadores recargan.

BEGIN;

SELECT set_config('organigrama.suppression_batch', :'batch', true),
       set_config('organigrama.suppression_actor', :'actor', true),
       set_config('organigrama.suppression_reason', :'reason', true);

DO $$
DECLARE
  v_batch  TEXT   := current_setting('organigrama.suppression_batch');
  v_actor  BIGINT := current_setting('organigrama.suppression_actor')::BIGINT;
  v_reason TEXT   := NULLIF(BTRIM(current_setting('organigrama.suppression_reason')), '');
  v_done   INT;
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'retire: indique -v reason=''motivo''.';
  END IF;

  UPDATE organigrama.org_chart_relation_suppression
  SET status = 'RETIRED', retired_at = NOW(), retired_by_person_id = v_actor,
      retire_reason = v_reason
  WHERE batch_code = v_batch AND status IN ('ACTIVE', 'DRAFT');
  GET DIAGNOSTICS v_done = ROW_COUNT;

  IF v_done = 0 THEN
    RAISE EXCEPTION 'retire: el lote % no tiene supresiones ACTIVE ni DRAFT.', v_batch;
  END IF;

  RAISE NOTICE 'retire: lote % retirado (% supresión(es)).', v_batch, v_done;
END $$;

COMMIT;
