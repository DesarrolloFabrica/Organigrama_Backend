-- Fábrica de contenidos: promueve el borrador `fabrica-contenidos-oficial` a
-- versión vigente (2.0) y deja la vigente actual `fabrica-contenidos` como
-- versión anterior histórica (1.0), bloqueada.
--
-- No crea ni borra versiones. No toca relaciones (`org_visual_relation`) ni
-- overrides: solo cambia qué versión del alcance `fabrica-contenidos` está
-- activa y sus etiquetas.
--
-- Restricción del modelo (migración 029):
--   uq_org_chart_version_single_active_scope — UNIQUE (scope_code)
--   WHERE is_active = true AND scope_type = 'COORDINATION'
-- Por eso hay que DESACTIVAR la vigente antes de ACTIVAR el borrador. El orden
-- de los UPDATE de este archivo no es intercambiable.
--
-- Idempotente: si el borrador ya es la vigente, no hace nada.
--
-- Recomendado:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/035_fabrica_promote_oficial_to_current.sql

BEGIN;

DO $$
DECLARE
  v_current_id BIGINT;
  v_draft_id   BIGINT;
  v_scope      CONSTANT TEXT := 'fabrica-contenidos';
BEGIN
  -- ─── Estado actual ────────────────────────────────────────────────────────
  SELECT id INTO v_current_id
  FROM organigrama.org_chart_version
  WHERE code = 'fabrica-contenidos'
    AND scope_type = 'COORDINATION'
  LIMIT 1;

  SELECT id INTO v_draft_id
  FROM organigrama.org_chart_version
  WHERE code = 'fabrica-contenidos-oficial'
    AND scope_type = 'COORDINATION'
  LIMIT 1;

  IF v_current_id IS NULL THEN
    RAISE EXCEPTION '035: no existe la versión fabrica-contenidos (COORDINATION).';
  END IF;

  IF v_draft_id IS NULL THEN
    RAISE EXCEPTION '035: no existe el borrador fabrica-contenidos-oficial (COORDINATION).';
  END IF;

  -- ─── Ya promovido: no repetir ─────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM organigrama.org_chart_version
    WHERE id = v_draft_id AND is_active = true
  ) THEN
    RAISE NOTICE '035: fabrica-contenidos-oficial ya es la versión vigente; no se repite.';
    RETURN;
  END IF;

  -- ─── El borrador no puede estar bloqueado ─────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM organigrama.org_chart_version
    WHERE id = v_draft_id AND is_locked = true
  ) THEN
    RAISE EXCEPTION
      '035: el borrador fabrica-contenidos-oficial está bloqueado; revisar antes de promover.';
  END IF;

  -- ─── 1. La vigente pasa a anterior 1.0 (bloqueada) ────────────────────────
  -- Debe ir PRIMERO: el índice único parcial no admite dos activas del alcance.
  UPDATE organigrama.org_chart_version
  SET
    is_active    = false,
    is_locked    = true,
    name         = 'Fábrica de contenidos 1.0',
    period_label = '1.0',
    description  = 'Versión anterior de Fábrica de contenidos. Histórica y bloqueada; '
                   || 'se conserva para consulta y comparación.',
    updated_at   = NOW()
  WHERE id = v_current_id;

  -- ─── 2. El borrador pasa a vigente 2.0 ────────────────────────────────────
  UPDATE organigrama.org_chart_version
  SET
    is_active    = true,
    is_locked    = false,
    name         = 'Fábrica de contenidos 2.0',
    period_label = '2.0',
    description  = 'Versión vigente de Fábrica de contenidos. Es la que ve todo el mundo.',
    updated_at   = NOW()
  WHERE id = v_draft_id;

  RAISE NOTICE
    '035: alcance % promovido — vigente ahora id=% (2.0), anterior id=% (1.0, bloqueada).',
    v_scope, v_draft_id, v_current_id;
END $$;

-- ─── Verificación dentro de la misma transacción ────────────────────────────
DO $$
DECLARE
  v_active INT;
BEGIN
  SELECT COUNT(*) INTO v_active
  FROM organigrama.org_chart_version
  WHERE scope_type = 'COORDINATION'
    AND scope_code = 'fabrica-contenidos'
    AND is_active = true;

  IF v_active <> 1 THEN
    RAISE EXCEPTION
      '035: el alcance fabrica-contenidos quedó con % versiones activas; se esperaba 1.', v_active;
  END IF;
END $$;

COMMIT;

-- ─── Comprobación posterior (fuera de la transacción) ───────────────────────
-- SELECT id, code, name, period_label, is_active, is_locked
-- FROM organigrama.org_chart_version
-- WHERE scope_type = 'COORDINATION' AND scope_code = 'fabrica-contenidos'
-- ORDER BY is_active DESC, id;
--
-- Esperado:
--   fabrica-contenidos-oficial  Fábrica de contenidos 2.0  2.0  active=t  locked=f
--   fabrica-contenidos          Fábrica de contenidos 1.0  1.0  active=f  locked=t
