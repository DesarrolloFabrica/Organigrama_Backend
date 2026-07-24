-- Fase E5.1: columnas aditivas Evidence Engine er2.
--
-- No modifica filas existentes de evaluationId=1 (defaults 0).
-- No altera enrichment ni inventario.
--
-- Uso:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/016_cv_evidence_evaluation_item_er2_metrics.sql

BEGIN;

ALTER TABLE organigrama.cv_evidence_evaluation_item
  ADD COLUMN IF NOT EXISTS substantive_evidence_count INT NOT NULL DEFAULT 0;

ALTER TABLE organigrama.cv_evidence_evaluation_item
  ADD COLUMN IF NOT EXISTS listing_evidence_count INT NOT NULL DEFAULT 0;

ALTER TABLE organigrama.cv_evidence_evaluation_item
  ADD COLUMN IF NOT EXISTS ambiguous_evidence_count INT NOT NULL DEFAULT 0;

ALTER TABLE organigrama.cv_evidence_evaluation_item
  DROP CONSTRAINT IF EXISTS chk_cv_evidence_evaluation_item_er2_counts;

ALTER TABLE organigrama.cv_evidence_evaluation_item
  ADD CONSTRAINT chk_cv_evidence_evaluation_item_er2_counts
  CHECK (
    substantive_evidence_count >= 0
    AND listing_evidence_count >= 0
    AND ambiguous_evidence_count >= 0
  );

COMMENT ON COLUMN organigrama.cv_evidence_evaluation_item.substantive_evidence_count IS
  'Conteo er2: evidencias únicas clasificadas como sustantivas.';
COMMENT ON COLUMN organigrama.cv_evidence_evaluation_item.listing_evidence_count IS
  'Conteo er2: evidencias únicas de listado (SKILLS_SECTION o formato lista).';
COMMENT ON COLUMN organigrama.cv_evidence_evaluation_item.ambiguous_evidence_count IS
  'Conteo er2: evidencias únicas ambiguas (name-only / corto sin contexto).';

COMMIT;
