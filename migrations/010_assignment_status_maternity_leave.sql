-- Estado de asignación: licencia de maternidad (MATERNITY_LEAVE).
--
-- El backend ya acepta cualquier VARCHAR en assignment_status; este script
-- documenta el valor y deja un upsert de ejemplo.
--
-- Uso:
--   1) Identificar version_id y relation_id de la posición a marcar.
--   2) Reemplazar los placeholders del INSERT (o descomentar el ejemplo).
--
-- Ejemplo (versión 4, relación X):
--   assignment_status = 'MATERNITY_LEAVE'
--   La UI muestra la píldora rosa «LICENCIA DE MATERNIDAD» en el nodo.

BEGIN;

COMMENT ON COLUMN organigrama.org_visual_relation_override.assignment_status IS
  'Estado de asignación visible: PERMANENT | TEMPORAL | MATERNITY_LEAVE.';

-- Descomentar y ajustar relation_id / version_id / role_id_override según el caso:
--
-- INSERT INTO organigrama.org_visual_relation_override (
--   version_id,
--   relation_id,
--   role_id_override,
--   assignment_status,
--   assignment_label,
--   is_active
-- )
-- VALUES (
--   4,
--   <RELATION_ID>,
--   NULL,
--   'MATERNITY_LEAVE',
--   'LICENCIA DE MATERNIDAD',
--   TRUE
-- )
-- ON CONFLICT (version_id, relation_id)
-- DO UPDATE SET
--   assignment_status = EXCLUDED.assignment_status,
--   assignment_label  = EXCLUDED.assignment_label,
--   is_active         = EXCLUDED.is_active,
--   updated_at        = NOW();

COMMIT;
