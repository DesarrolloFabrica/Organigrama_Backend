-- Fase E3: persistencia histórica del Skill Enricher (Pipeline V2).
--
-- Schema: organigrama. No modifica cv_extraction / cv_extraction_skill (inventario).
-- No proyecta evidencia sobre evidence / evidence_items legacy.
--
-- Uso:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/014_cv_skill_enrichment.sql
--
-- Esta migración incluye BEGIN/COMMIT. No combinar con psql --single-transaction.

BEGIN;

-- ─── Run de enriquecimiento ───────────────────────────────────────────────────

CREATE TABLE organigrama.cv_skill_enrichment (
  id                              BIGSERIAL     PRIMARY KEY,
  extraction_id                   BIGINT        NOT NULL,
  person_id                       BIGINT        NOT NULL,
  person_cv_id                    BIGINT        NOT NULL,
  pdf_sha256                      CHAR(64)      NOT NULL,
  inventory_hash                  VARCHAR(64)   NOT NULL,

  model                           VARCHAR(80)   NOT NULL,
  prompt_version                  VARCHAR(64)   NOT NULL,
  enricher_version                VARCHAR(64)   NOT NULL,
  block_config_version            VARCHAR(64)   NOT NULL,
  block_config                    JSONB         NOT NULL,
  block_config_hash               VARCHAR(64)   NOT NULL,

  status                          VARCHAR(20)   NOT NULL,
  is_active                       BOOLEAN       NOT NULL DEFAULT FALSE,

  input_skills_count              INT           NOT NULL,
  output_skills_count             INT           NOT NULL DEFAULT 0,
  skills_with_evidence_count      INT           NOT NULL DEFAULT 0,
  skills_without_evidence_count   INT           NOT NULL DEFAULT 0,
  evidence_items_count            INT           NOT NULL DEFAULT 0,
  missing_filled_empty_count      INT           NOT NULL DEFAULT 0,
  blocks_total                    INT           NOT NULL,
  blocks_succeeded                INT           NOT NULL DEFAULT 0,
  blocks_failed                   INT           NOT NULL DEFAULT 0,
  attempts_total                  INT           NOT NULL DEFAULT 0,

  warnings                        JSONB         NULL,
  metrics                         JSONB         NULL,
  validated_result_json           JSONB         NULL,
  error_stage                     VARCHAR(80)   NULL,
  error_code                      VARCHAR(80)   NULL,
  error_message                   TEXT          NULL,

  started_at                      TIMESTAMPTZ   NULL,
  completed_at                    TIMESTAMPTZ   NULL,
  created_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_skill_enrichment_extraction
    FOREIGN KEY (extraction_id)
    REFERENCES organigrama.cv_extraction(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cv_skill_enrichment_person
    FOREIGN KEY (person_id)
    REFERENCES core.person(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cv_skill_enrichment_person_cv
    FOREIGN KEY (person_cv_id)
    REFERENCES organigrama.person_cv(id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_cv_skill_enrichment_status
    CHECK (status IN ('PENDING', 'RUNNING', 'PARTIAL', 'SUCCEEDED', 'FAILED')),

  CONSTRAINT chk_cv_skill_enrichment_active_succeeded
    CHECK (is_active = FALSE OR status = 'SUCCEEDED'),

  CONSTRAINT chk_cv_skill_enrichment_counts
    CHECK (
      input_skills_count >= 0
      AND output_skills_count >= 0
      AND skills_with_evidence_count >= 0
      AND skills_without_evidence_count >= 0
      AND evidence_items_count >= 0
      AND missing_filled_empty_count >= 0
      AND blocks_total >= 0
      AND blocks_succeeded >= 0
      AND blocks_failed >= 0
      AND attempts_total >= 0
    ),

  CONSTRAINT chk_cv_skill_enrichment_block_config_object
    CHECK (jsonb_typeof(block_config) = 'object'),

  CONSTRAINT chk_cv_skill_enrichment_warnings_array
    CHECK (warnings IS NULL OR jsonb_typeof(warnings) = 'array')
);

COMMENT ON TABLE organigrama.cv_skill_enrichment IS
  'Run histórico del Skill Enricher. Inventario inmutable en cv_extraction_skill. '
  'Una sola activa por extraction_id. Idempotencia SUCCEEDED por '
  '(extraction_id, pdf_sha256, inventory_hash, model, prompt_version, enricher_version, block_config_hash).';

CREATE UNIQUE INDEX uq_cv_skill_enrichment_extraction_active
  ON organigrama.cv_skill_enrichment (extraction_id)
  WHERE is_active = TRUE;

CREATE UNIQUE INDEX uq_cv_skill_enrichment_idempotency
  ON organigrama.cv_skill_enrichment (
    extraction_id,
    pdf_sha256,
    inventory_hash,
    model,
    prompt_version,
    enricher_version,
    block_config_hash
  )
  WHERE status = 'SUCCEEDED';

CREATE INDEX idx_cv_skill_enrichment_extraction
  ON organigrama.cv_skill_enrichment (extraction_id);

CREATE INDEX idx_cv_skill_enrichment_person
  ON organigrama.cv_skill_enrichment (person_id);

CREATE INDEX idx_cv_skill_enrichment_status
  ON organigrama.cv_skill_enrichment (status);

CREATE INDEX idx_cv_skill_enrichment_created
  ON organigrama.cv_skill_enrichment (created_at DESC);

-- ─── Intentos por bloque ──────────────────────────────────────────────────────

CREATE TABLE organigrama.cv_skill_enrichment_block (
  id                      BIGSERIAL     PRIMARY KEY,
  enrichment_id           BIGINT        NOT NULL,
  block_number            INT           NOT NULL,
  attempt_number          INT           NOT NULL,
  attempt_type            VARCHAR(20)   NOT NULL,
  input_skill_ids         JSONB         NOT NULL,
  input_skills_count      INT           NOT NULL,
  status                  VARCHAR(20)   NOT NULL,
  raw_response_json       JSONB         NULL,
  raw_truncated            BOOLEAN       NOT NULL DEFAULT FALSE,
  validation_errors       JSONB         NULL,
  validation_warnings     JSONB         NULL,
  model_usage             JSONB         NULL,
  duration_ms             INT           NULL,
  started_at              TIMESTAMPTZ   NULL,
  completed_at            TIMESTAMPTZ   NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_skill_enrichment_block_run
    FOREIGN KEY (enrichment_id)
    REFERENCES organigrama.cv_skill_enrichment(id)
    ON DELETE CASCADE,

  CONSTRAINT uq_cv_skill_enrichment_block_attempt
    UNIQUE (enrichment_id, block_number, attempt_number, attempt_type),

  CONSTRAINT chk_cv_skill_enrichment_block_attempt_type
    CHECK (attempt_type IN ('BLOCK', 'MICRO_RETRY')),

  CONSTRAINT chk_cv_skill_enrichment_block_status
    CHECK (status IN (
      'RUNNING',
      'SUCCEEDED',
      'FAILED',
      'IDENTITY_ERROR',
      'TRANSIENT_ERROR'
    )),

  CONSTRAINT chk_cv_skill_enrichment_block_input_ids_array
    CHECK (jsonb_typeof(input_skill_ids) = 'array'),

  CONSTRAINT chk_cv_skill_enrichment_block_counts
    CHECK (block_number > 0 AND attempt_number > 0 AND input_skills_count >= 0)
);

COMMENT ON TABLE organigrama.cv_skill_enrichment_block IS
  'Auditoría de cada intento Gemini por bloque/micro-retry. Sin PDF/base64.';

CREATE INDEX idx_cv_skill_enrichment_block_run_block
  ON organigrama.cv_skill_enrichment_block (enrichment_id, block_number);

-- ─── Evidencia validada por skill ─────────────────────────────────────────────

CREATE TABLE organigrama.cv_skill_enrichment_item (
  id                      BIGSERIAL     PRIMARY KEY,
  enrichment_id           BIGINT        NOT NULL,
  extraction_skill_id     BIGINT        NOT NULL,
  normalized_name         VARCHAR(200)  NOT NULL,
  evidence_items          JSONB         NOT NULL DEFAULT '[]'::jsonb,
  evidence_count          INT           NOT NULL DEFAULT 0,
  source_types            JSONB         NOT NULL DEFAULT '[]'::jsonb,
  warnings                JSONB         NULL,
  status                  VARCHAR(20)   NOT NULL,
  was_filled_empty        BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_skill_enrichment_item_run
    FOREIGN KEY (enrichment_id)
    REFERENCES organigrama.cv_skill_enrichment(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_cv_skill_enrichment_item_extraction_skill
    FOREIGN KEY (extraction_skill_id)
    REFERENCES organigrama.cv_extraction_skill(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_cv_skill_enrichment_item_skill
    UNIQUE (enrichment_id, extraction_skill_id),

  CONSTRAINT chk_cv_skill_enrichment_item_evidence_array
    CHECK (jsonb_typeof(evidence_items) = 'array'),

  CONSTRAINT chk_cv_skill_enrichment_item_source_types_array
    CHECK (jsonb_typeof(source_types) = 'array'),

  CONSTRAINT chk_cv_skill_enrichment_item_status
    CHECK (status IN ('OK', 'EMPTY', 'FILLED_EMPTY', 'FAILED')),

  CONSTRAINT chk_cv_skill_enrichment_item_counts
    CHECK (evidence_count >= 0)
);

COMMENT ON TABLE organigrama.cv_skill_enrichment_item IS
  'Evidencia validada autoritativa por extraction_skill_id. No modifica inventario.';

CREATE INDEX idx_cv_skill_enrichment_item_extraction_skill
  ON organigrama.cv_skill_enrichment_item (extraction_skill_id);

CREATE INDEX idx_cv_skill_enrichment_item_run
  ON organigrama.cv_skill_enrichment_item (enrichment_id);

COMMIT;
