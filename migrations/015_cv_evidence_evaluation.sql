-- Fase E5: Evidence Engine determinista (Pipeline V2).
--
-- Schema: organigrama. No modifica inventario ni enrichment.
--
-- Uso:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/015_cv_evidence_evaluation.sql
--
-- Esta migración incluye BEGIN/COMMIT. No combinar con psql --single-transaction.

BEGIN;

CREATE TABLE organigrama.cv_evidence_evaluation (
  id                              BIGSERIAL     PRIMARY KEY,
  enrichment_id                   BIGINT        NOT NULL,
  extraction_id                   BIGINT        NOT NULL,
  person_id                       BIGINT        NOT NULL,

  evidence_rules_version          VARCHAR(64)   NOT NULL,
  source_weight_version           VARCHAR(64)   NOT NULL,
  algorithm_version               VARCHAR(64)   NOT NULL,
  config_hash                     VARCHAR(64)   NOT NULL,
  config_json                     JSONB         NOT NULL,

  status                          VARCHAR(20)   NOT NULL,
  is_active                       BOOLEAN       NOT NULL DEFAULT FALSE,

  input_skills_count              INT           NOT NULL,
  output_skills_count             INT           NOT NULL DEFAULT 0,
  strong_skills_count             INT           NOT NULL DEFAULT 0,
  moderate_skills_count           INT           NOT NULL DEFAULT 0,
  weak_skills_count               INT           NOT NULL DEFAULT 0,
  no_evidence_skills_count        INT           NOT NULL DEFAULT 0,
  applied_evidence_skills_count   INT           NOT NULL DEFAULT 0,
  warnings_count                  INT           NOT NULL DEFAULT 0,

  metrics                         JSONB         NULL,
  warnings                        JSONB         NULL,
  error_stage                     VARCHAR(80)   NULL,
  error_code                      VARCHAR(80)   NULL,
  error_message                   TEXT          NULL,

  started_at                      TIMESTAMPTZ   NULL,
  completed_at                    TIMESTAMPTZ   NULL,
  created_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_evidence_evaluation_enrichment
    FOREIGN KEY (enrichment_id)
    REFERENCES organigrama.cv_skill_enrichment(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cv_evidence_evaluation_extraction
    FOREIGN KEY (extraction_id)
    REFERENCES organigrama.cv_extraction(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cv_evidence_evaluation_person
    FOREIGN KEY (person_id)
    REFERENCES core.person(id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_cv_evidence_evaluation_status
    CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),

  CONSTRAINT chk_cv_evidence_evaluation_active_succeeded
    CHECK (is_active = FALSE OR status = 'SUCCEEDED'),

  CONSTRAINT chk_cv_evidence_evaluation_counts
    CHECK (
      input_skills_count >= 0
      AND output_skills_count >= 0
      AND strong_skills_count >= 0
      AND moderate_skills_count >= 0
      AND weak_skills_count >= 0
      AND no_evidence_skills_count >= 0
      AND applied_evidence_skills_count >= 0
      AND warnings_count >= 0
    ),

  CONSTRAINT chk_cv_evidence_evaluation_config_object
    CHECK (jsonb_typeof(config_json) = 'object'),

  CONSTRAINT chk_cv_evidence_evaluation_warnings_array
    CHECK (warnings IS NULL OR jsonb_typeof(warnings) = 'array')
);

COMMENT ON TABLE organigrama.cv_evidence_evaluation IS
  'Run del Evidence Engine (determinista). Una activa por enrichment_id. '
  'Idempotencia SUCCEEDED por (enrichment_id, evidence_rules_version, '
  'source_weight_version, algorithm_version, config_hash).';

CREATE UNIQUE INDEX uq_cv_evidence_evaluation_enrichment_active
  ON organigrama.cv_evidence_evaluation (enrichment_id)
  WHERE is_active = TRUE;

CREATE UNIQUE INDEX uq_cv_evidence_evaluation_idempotency
  ON organigrama.cv_evidence_evaluation (
    enrichment_id,
    evidence_rules_version,
    source_weight_version,
    algorithm_version,
    config_hash
  )
  WHERE status = 'SUCCEEDED';

CREATE INDEX idx_cv_evidence_evaluation_enrichment
  ON organigrama.cv_evidence_evaluation (enrichment_id);

CREATE INDEX idx_cv_evidence_evaluation_extraction
  ON organigrama.cv_evidence_evaluation (extraction_id);

CREATE INDEX idx_cv_evidence_evaluation_status
  ON organigrama.cv_evidence_evaluation (status);

CREATE INDEX idx_cv_evidence_evaluation_created
  ON organigrama.cv_evidence_evaluation (created_at DESC);

CREATE TABLE organigrama.cv_evidence_evaluation_item (
  id                          BIGSERIAL     PRIMARY KEY,
  evaluation_id               BIGINT        NOT NULL,
  enrichment_item_id          BIGINT        NOT NULL,
  extraction_skill_id         BIGINT        NOT NULL,
  normalized_name             VARCHAR(200)  NOT NULL,

  evidence_count              INT           NOT NULL,
  unique_evidence_count       INT           NOT NULL,
  applied_evidence_count      INT           NOT NULL,
  source_diversity            INT           NOT NULL,
  repeated_mention_count      INT           NOT NULL,

  has_work_experience         BOOLEAN       NOT NULL DEFAULT FALSE,
  has_project                 BOOLEAN       NOT NULL DEFAULT FALSE,
  has_achievement             BOOLEAN       NOT NULL DEFAULT FALSE,
  has_responsibility          BOOLEAN       NOT NULL DEFAULT FALSE,
  has_certification           BOOLEAN       NOT NULL DEFAULT FALSE,
  has_education               BOOLEAN       NOT NULL DEFAULT FALSE,
  has_profile_summary         BOOLEAN       NOT NULL DEFAULT FALSE,
  has_skills_section          BOOLEAN       NOT NULL DEFAULT FALSE,
  has_other                   BOOLEAN       NOT NULL DEFAULT FALSE,

  evidence_strength           NUMERIC(6,2)  NOT NULL,
  evidence_confidence         NUMERIC(5,4)  NOT NULL,
  evidence_level              VARCHAR(20)   NOT NULL,

  quality_flags               JSONB         NOT NULL DEFAULT '[]'::jsonb,
  source_breakdown            JSONB         NOT NULL,
  scoring_breakdown           JSONB         NOT NULL,
  explanation                 TEXT          NOT NULL,

  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_evidence_evaluation_item_eval
    FOREIGN KEY (evaluation_id)
    REFERENCES organigrama.cv_evidence_evaluation(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_cv_evidence_evaluation_item_enrichment_item
    FOREIGN KEY (enrichment_item_id)
    REFERENCES organigrama.cv_skill_enrichment_item(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cv_evidence_evaluation_item_extraction_skill
    FOREIGN KEY (extraction_skill_id)
    REFERENCES organigrama.cv_extraction_skill(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_cv_evidence_evaluation_item_skill
    UNIQUE (evaluation_id, extraction_skill_id),

  CONSTRAINT chk_cv_evidence_evaluation_item_strength
    CHECK (evidence_strength >= 0 AND evidence_strength <= 100),

  CONSTRAINT chk_cv_evidence_evaluation_item_confidence
    CHECK (evidence_confidence >= 0 AND evidence_confidence <= 1),

  CONSTRAINT chk_cv_evidence_evaluation_item_level
    CHECK (evidence_level IN ('NONE', 'WEAK', 'MODERATE', 'STRONG')),

  CONSTRAINT chk_cv_evidence_evaluation_item_flags_array
    CHECK (jsonb_typeof(quality_flags) = 'array'),

  CONSTRAINT chk_cv_evidence_evaluation_item_breakdown_objects
    CHECK (
      jsonb_typeof(source_breakdown) = 'object'
      AND jsonb_typeof(scoring_breakdown) = 'object'
    ),

  CONSTRAINT chk_cv_evidence_evaluation_item_counts
    CHECK (
      evidence_count >= 0
      AND unique_evidence_count >= 0
      AND applied_evidence_count >= 0
      AND source_diversity >= 0
      AND repeated_mention_count >= 0
    )
);

COMMENT ON TABLE organigrama.cv_evidence_evaluation_item IS
  'Métricas de evidencia por skill (Evidence Engine). No modifica enrichment.';

CREATE INDEX idx_cv_evidence_evaluation_item_eval
  ON organigrama.cv_evidence_evaluation_item (evaluation_id);

CREATE INDEX idx_cv_evidence_evaluation_item_extraction_skill
  ON organigrama.cv_evidence_evaluation_item (extraction_skill_id);

COMMIT;
