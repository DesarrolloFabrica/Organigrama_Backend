-- Saca a FELIPE GUERRERO BUENAVENTURA (person_id 1303) de las dos versiones
-- vigentes del organigrama y recuelga su equipo de SARA JULIANA MARTINEZ LOPEZ
-- (person_id 52).
--
-- Versiones afectadas (ambas activas):
--   id 4  periodo-agosto-2026        "Versión actual"            GLOBAL
--   id 6  fabrica-contenidos-oficial "Fábrica de contenidos 2.0" COORDINATION
--
-- NOTA sobre el candado: la versión 4 tiene is_locked = true. Ese flag solo lo
-- respeta el código de la aplicación (assertVersionEditable); SQL lo ignora. Se
-- edita deliberadamente sin tocar el flag, que queda en true todo el tiempo.
--
-- Nivel visual:
--   v4 — Felipe y Sara Juliana son ambos hijos de Haider (49), asi que los hijos
--        recolgados conservan visual_level 5.
--   v6 — Felipe es hijo de Sara Juliana, asi que sus hijos suben un nivel al
--        pasar a ser hijos directos de ella: visual_level 5 -> 4, igual que sus
--        cinco compañeros que ya cuelgan de ella.
--
-- No toca is_active de las aristas recolgadas ni la version historica 5
-- ("Fábrica de contenidos 1.0"), que se conserva como estaba.
-- No hay overrides sobre ninguna arista de Felipe (verificado).
--
-- Recomendado:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/036_remove_felipe_reparent_to_sara_juliana.sql

BEGIN;

DO $$
DECLARE
  v_felipe  CONSTANT BIGINT := 1303;
  v_sara    CONSTANT BIGINT := 52;
  v_global  CONSTANT BIGINT := 4;
  v_fabrica CONSTANT BIGINT := 6;
  v_moved   INT;
  v_deleted INT;
BEGIN
  -- ─── Guardas de identidad ─────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM core.person WHERE id = v_felipe
                  AND full_name ILIKE '%FELIPE%GUERRERO%') THEN
    RAISE EXCEPTION '036: person_id % no es FELIPE GUERRERO.', v_felipe;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM core.person WHERE id = v_sara
                  AND full_name ILIKE '%SARA%JULIANA%MARTINEZ%') THEN
    RAISE EXCEPTION '036: person_id % no es SARA JULIANA MARTINEZ.', v_sara;
  END IF;

  -- Sara Juliana debe existir en ambas versiones, o los recolgados quedarian
  -- sin camino hasta la raiz.
  IF NOT EXISTS (SELECT 1 FROM organigrama.org_visual_relation
                  WHERE version_id = v_global AND child_person_id = v_sara) THEN
    RAISE EXCEPTION '036: Sara Juliana no cuelga de nadie en la version global %.', v_global;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM organigrama.org_visual_relation
                  WHERE version_id = v_fabrica AND child_person_id = v_sara) THEN
    RAISE EXCEPTION '036: Sara Juliana no cuelga de nadie en la version %.', v_fabrica;
  END IF;

  -- ─── 1. GLOBAL (v4): recolgar los hijos, conservando visual_level ─────────
  UPDATE organigrama.org_visual_relation
  SET parent_person_id = v_sara, updated_at = NOW()
  WHERE version_id = v_global
    AND parent_person_id = v_felipe;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE '036: v% — % hijos de Felipe recolgados de Sara Juliana.', v_global, v_moved;

  -- ─── 2. GLOBAL (v4): quitar a Felipe ─────────────────────────────────────
  DELETE FROM organigrama.org_visual_relation
  WHERE version_id = v_global AND child_person_id = v_felipe;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '036: v% — % arista(s) de Felipe eliminadas.', v_global, v_deleted;

  -- ─── 3. FÁBRICA 2.0 (v6): recolgar los hijos y subirlos un nivel ─────────
  UPDATE organigrama.org_visual_relation
  SET parent_person_id = v_sara,
      visual_level     = 4,
      updated_at       = NOW()
  WHERE version_id = v_fabrica
    AND parent_person_id = v_felipe;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE '036: v% — % hijos de Felipe recolgados de Sara Juliana (nivel 4).', v_fabrica, v_moved;

  -- ─── 4. FÁBRICA 2.0 (v6): quitar a Felipe ────────────────────────────────
  DELETE FROM organigrama.org_visual_relation
  WHERE version_id = v_fabrica AND child_person_id = v_felipe;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '036: v% — % arista(s) de Felipe eliminadas.', v_fabrica, v_deleted;
END $$;

-- ─── Verificación dentro de la misma transacción ────────────────────────────
DO $$
DECLARE
  v_rest INT;
BEGIN
  SELECT COUNT(*) INTO v_rest
  FROM organigrama.org_visual_relation
  WHERE version_id IN (4, 6)
    AND (parent_person_id = 1303 OR child_person_id = 1303);

  IF v_rest <> 0 THEN
    RAISE EXCEPTION
      '036: Felipe todavia tiene % arista(s) en las versiones vigentes.', v_rest;
  END IF;

  -- Nadie debe quedar huerfano: todo hijo de las versiones tocadas debe tener padre.
  SELECT COUNT(*) INTO v_rest
  FROM organigrama.org_visual_relation r
  WHERE r.version_id IN (4, 6)
    AND NOT EXISTS (
      SELECT 1 FROM core.person p WHERE p.id = r.parent_person_id
    );

  IF v_rest <> 0 THEN
    RAISE EXCEPTION '036: % arista(s) apuntan a un padre inexistente.', v_rest;
  END IF;
END $$;

COMMIT;
