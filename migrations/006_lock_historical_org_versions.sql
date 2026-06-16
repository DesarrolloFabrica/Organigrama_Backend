-- Bloquea versiones históricas del organigrama (solo lectura).
-- Ejecutar en local antes de editar `current`.
-- No modifica `current` ni sus relaciones.

BEGIN;

UPDATE organigrama.org_chart_version
SET
  is_locked = true,
  updated_at = NOW()
WHERE code IN (
  'periodo-febrero-junio-2026',
  'snapshot-prueba-versionamiento'
)
AND is_locked = false;

COMMIT;
