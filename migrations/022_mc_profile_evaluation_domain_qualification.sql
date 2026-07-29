-- MC1.1B: Calificación intra-dominio en evaluaciones PA2.
--
-- Semántica: grado conceptual de compatibilidad persona↔dominio (PRIMARY_MATCH,
-- SECONDARY_SIGNAL, OUTSIDE, INSUFFICIENT_EVIDENCE). No indica dominio dominante
-- multidominio. NULL = evaluación histórica sin calificación persistida.
--
-- Uso:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/022_mc_profile_evaluation_domain_qualification.sql

BEGIN;

ALTER TABLE organigrama.mc_profile_evaluation
  ADD COLUMN IF NOT EXISTS domain_qualification VARCHAR(32) NULL;

COMMENT ON COLUMN organigrama.mc_profile_evaluation.domain_qualification IS
  'Calificación intra-dominio MC1.1: PRIMARY_MATCH | SECONDARY_SIGNAL | OUTSIDE | '
  'INSUFFICIENT_EVIDENCE. NULL en evaluaciones históricas. '
  'No indica práctica profesional dominante multidominio.';

ALTER TABLE organigrama.mc_profile_evaluation
  DROP CONSTRAINT IF EXISTS chk_mc_profile_eval_domain_qualification;

ALTER TABLE organigrama.mc_profile_evaluation
  ADD CONSTRAINT chk_mc_profile_eval_domain_qualification
  CHECK (
    domain_qualification IS NULL
    OR domain_qualification IN (
      'PRIMARY_MATCH',
      'SECONDARY_SIGNAL',
      'OUTSIDE',
      'INSUFFICIENT_EVIDENCE'
    )
  );

COMMIT;
