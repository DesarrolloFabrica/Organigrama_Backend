-- Fase B: evidencia individual por skill (jsonb nullable).
--
-- Extiende organigrama.cv_extraction_skill sin romper filas existentes
-- (evidence_items queda NULL en extracciones antiguas).
--
-- Uso:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/013_cv_extraction_skill_evidence_items.sql
--
-- Esta migración incluye BEGIN/COMMIT. No combinar con psql --single-transaction.

BEGIN;

ALTER TABLE organigrama.cv_extraction_skill
  ADD COLUMN IF NOT EXISTS evidence_items JSONB NULL;

COMMENT ON COLUMN organigrama.cv_extraction_skill.evidence_items IS
  'Array JSON de citas por skill: [{ sourceType, evidenceText, occurrenceIndex, isFallback? }]. '
  'NULL en extracciones anteriores a Fase B. La columna evidence (TEXT) conserva el primer evidenceText.';

COMMIT;
