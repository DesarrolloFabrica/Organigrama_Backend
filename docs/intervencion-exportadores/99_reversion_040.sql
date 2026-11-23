-- Intervención exportadores — REVERSIÓN de la migración 040.
--
-- Usar solo si hay que deshacer la intervención. Antes de ejecutarla:
--   1) Revocar los permisos con el script (ver RUNBOOK.md, paso de reversión).
--   2) Si la tabla tiene filas, conservar la traza (no contiene datos personales):
--        \copy organigrama.org_chart_directory_export_audit TO 'auditoria-exportaciones.csv' CSV HEADER
--
-- Efecto: sin la tabla, el backend integrado responde 503 a toda descarga
-- autorizada (fail-closed). El backend actual de Cloud Run no la usa.

BEGIN;

-- Defensa: no revertir mientras existan permisos de exportación activos.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM core.person_permission
     WHERE permission_code IN ('ORG_DIRECTORY_EXPORT_HTML', 'ORG_DIRECTORY_EXPORT_XLS')
  ) THEN
    RAISE EXCEPTION 'Hay permisos de exportación concedidos: revóquelos primero con org:grant-directory-export --revoke.';
  END IF;
END $$;

DROP TABLE IF EXISTS organigrama.org_chart_directory_export_audit;   -- elimina también índices, CHECK y FK propios

-- La 040 solo añadió comentarios a core.person_permission; antes eran NULL
-- (verificado en solo lectura el 23-nov-2026).
COMMENT ON TABLE core.person_permission IS NULL;
COMMENT ON COLUMN core.person_permission.permission_code IS NULL;

COMMIT;

SELECT to_regclass('organigrama.org_chart_directory_export_audit') AS tabla;  -- NULL
