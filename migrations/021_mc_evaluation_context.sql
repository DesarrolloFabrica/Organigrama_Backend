-- MC1.6.1B.2: trazabilidad de evaluación (pack version, source_hash, algorithm, context).
-- Aditiva. No elimina columnas ni reescribe resultados PA2.
--
-- Uso:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/021_mc_evaluation_context.sql
--
-- Rollback (manual):
--   BEGIN;
--   ALTER TABLE organigrama.mc_profile_evaluation
--     DROP COLUMN IF EXISTS evaluation_context_hash,
--     DROP COLUMN IF EXISTS algorithm_version,
--     DROP COLUMN IF EXISTS source_hash,
--     DROP COLUMN IF EXISTS mapping_pack_version,
--     DROP COLUMN IF EXISTS mapping_pack_code;
--   DROP TABLE IF EXISTS organigrama.mc_mapping_pack_release;
--   COMMIT;

BEGIN;

-- ─── Registro inmutable de releases de mapping pack ──────────────────────────

CREATE TABLE IF NOT EXISTS organigrama.mc_mapping_pack_release (
  id              BIGSERIAL     PRIMARY KEY,
  pack_code       VARCHAR(80)   NOT NULL,
  pack_version    VARCHAR(64)   NOT NULL,
  domain_code     VARCHAR(80)   NOT NULL,
  content_hash    VARCHAR(64)   NOT NULL,
  status          VARCHAR(20)   NOT NULL DEFAULT 'PUBLISHED',
  source_ref      TEXT          NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_mc_mapping_pack_release
    UNIQUE (pack_code, pack_version),

  CONSTRAINT chk_mc_mapping_pack_release_status
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'RETIRED'))
);

COMMENT ON TABLE organigrama.mc_mapping_pack_release IS
  'Release versionado de un mapping pack. PUBLISHED es inmutable: '
  'mismo (pack_code, pack_version) no puede cambiar content_hash.';

CREATE INDEX IF NOT EXISTS idx_mc_mapping_pack_release_domain
  ON organigrama.mc_mapping_pack_release (domain_code);

CREATE INDEX IF NOT EXISTS idx_mc_mapping_pack_release_hash
  ON organigrama.mc_mapping_pack_release (content_hash);

-- ─── Columnas de contexto en evaluación ──────────────────────────────────────

ALTER TABLE organigrama.mc_profile_evaluation
  ADD COLUMN IF NOT EXISTS mapping_pack_code VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS mapping_pack_version VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS source_hash VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS algorithm_version VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS evaluation_context_hash VARCHAR(64) NULL;

COMMENT ON COLUMN organigrama.mc_profile_evaluation.mapping_pack_code IS
  'Código estable del pack (p.ej. software-mappings, visual-design-mappings).';
COMMENT ON COLUMN organigrama.mc_profile_evaluation.mapping_pack_version IS
  'Versión exacta del pack usada al evaluar (no mutar in-place).';
COMMENT ON COLUMN organigrama.mc_profile_evaluation.source_hash IS
  'pdf_sha256 común de la cadena CV/extracción/enrichment al momento de evaluar.';
COMMENT ON COLUMN organigrama.mc_profile_evaluation.algorithm_version IS
  'Identificador del algoritmo PA2 (p.ej. pa2-algo-lexico-v1), independiente del rule label.';
COMMENT ON COLUMN organigrama.mc_profile_evaluation.evaluation_context_hash IS
  'Hash compuesto determinista del contexto evaluativo completo.';

CREATE INDEX IF NOT EXISTS idx_mc_profile_eval_source_hash
  ON organigrama.mc_profile_evaluation (source_hash);

CREATE INDEX IF NOT EXISTS idx_mc_profile_eval_pack
  ON organigrama.mc_profile_evaluation (mapping_pack_code, mapping_pack_version);

CREATE INDEX IF NOT EXISTS idx_mc_profile_eval_context_hash
  ON organigrama.mc_profile_evaluation (evaluation_context_hash);

COMMIT;
