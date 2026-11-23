-- Intervención exportadores — POST-VERIFICACIÓN de la migración 040.
-- Parte A: solo lectura. Parte B: prueba de escritura que se REVIERTE (ROLLBACK).

-- ── A. Estructura (solo lectura) ──────────────────────────────────────────
BEGIN READ ONLY;

SELECT to_regclass('organigrama.org_chart_directory_export_audit') AS tabla;  -- no NULL

SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'organigrama' AND table_name = 'org_chart_directory_export_audit'
 ORDER BY ordinal_position;
-- id, person_id, export_format, version_id, row_count, result, error_code, created_at (8 columnas)

SELECT conname FROM pg_constraint
 WHERE conrelid = 'organigrama.org_chart_directory_export_audit'::regclass
 ORDER BY conname;
-- 5 CHECK (error_code, format, result, rows, success) + 2 FK + PK

SELECT count(*) AS filas FROM organigrama.org_chart_directory_export_audit;  -- 0 recién aplicada

ROLLBACK;

-- ── B. ¿La tabla acepta y rechaza lo correcto? (se revierte) ──────────────
-- Usa la persona de la cuenta aprobada y la versión global vigente. No deja filas.
BEGIN;

INSERT INTO organigrama.org_chart_directory_export_audit
  (person_id, export_format, version_id, row_count, result)
SELECT :'person_id'::bigint, 'xls', v.id, 0, 'SUCCESS'
  FROM organigrama.org_chart_version v
 WHERE v.is_active AND v.scope_type = 'GLOBAL'
 ORDER BY v.id
 LIMIT 1;                                                              -- INSERT 0 1

-- Un registro inválido debe ser rechazado por los CHECK.
DO $$
BEGIN
  INSERT INTO organigrama.org_chart_directory_export_audit
    (person_id, export_format, result, error_code)
  VALUES (1, 'pdf', 'SUCCESS', 'texto libre');
  RAISE EXCEPTION 'FALLO: la tabla aceptó un registro inválido';
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'OK: registro inválido rechazado por CHECK';
END $$;                                                                -- NOTICE: OK: ...

ROLLBACK;                                                              -- no queda nada

SELECT count(*) AS filas_tras_prueba
  FROM organigrama.org_chart_directory_export_audit;                   -- igual que en la parte A (0 recién aplicada)
