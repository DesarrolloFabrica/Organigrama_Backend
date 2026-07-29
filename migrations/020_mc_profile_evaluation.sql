-- MC1.3.3: Evaluación PA2 por perfil/dominio (Modelo de Competencias).
--
-- Aditiva. No modifica Extractor, Enrichment, Evidence Engine, PA1 ni mappings.
--
-- Uso:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/020_mc_profile_evaluation.sql

BEGIN;

CREATE TABLE organigrama.mc_profile_evaluation (
  id                        BIGSERIAL     PRIMARY KEY,
  person_id                 BIGINT        NOT NULL,
  person_cv_id              BIGINT        NOT NULL,
  extraction_id             BIGINT        NOT NULL,
  enrichment_id             BIGINT        NOT NULL,
  evidence_evaluation_id    BIGINT        NOT NULL,
  catalog_version_id        BIGINT        NOT NULL,
  domain_id                 BIGINT        NOT NULL,
  domain_code               VARCHAR(80)   NOT NULL,
  engine_rules_version      VARCHAR(64)   NOT NULL,
  config_hash               VARCHAR(64)   NOT NULL,
  mapping_hash              VARCHAR(64)   NOT NULL,
  status                    VARCHAR(20)   NOT NULL,
  is_active                 BOOLEAN       NOT NULL DEFAULT FALSE,
  input_skills_count        INT           NOT NULL,
  specialty_count           INT           NOT NULL DEFAULT 0,
  active_count              INT           NOT NULL DEFAULT 0,
  emergent_count            INT           NOT NULL DEFAULT 0,
  hidden_count              INT           NOT NULL DEFAULT 0,
  default_specialty_code    VARCHAR(80)   NULL,
  warnings                  JSONB         NULL,
  metrics                   JSONB         NULL,
  error_code                VARCHAR(80)   NULL,
  error_message             TEXT          NULL,
  started_at                TIMESTAMPTZ   NULL,
  completed_at              TIMESTAMPTZ   NULL,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mc_profile_eval_extraction
    FOREIGN KEY (extraction_id)
    REFERENCES organigrama.cv_extraction(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_mc_profile_eval_enrichment
    FOREIGN KEY (enrichment_id)
    REFERENCES organigrama.cv_skill_enrichment(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_mc_profile_eval_evidence
    FOREIGN KEY (evidence_evaluation_id)
    REFERENCES organigrama.cv_evidence_evaluation(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_mc_profile_eval_catalog
    FOREIGN KEY (catalog_version_id)
    REFERENCES organigrama.mc_catalog_version(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_mc_profile_eval_domain
    FOREIGN KEY (domain_id)
    REFERENCES organigrama.mc_domain(id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_mc_profile_eval_status
    CHECK (status IN ('DRAFT', 'SUCCEEDED', 'FAILED'))
);

COMMENT ON TABLE organigrama.mc_profile_evaluation IS
  'Evaluación PA2 de un dominio para una extracción concreta. '
  'Trazable por catálogo, mappings, evidencia y versión de reglas. '
  'No mutar evaluaciones finalizadas; crear una nueva.';

CREATE UNIQUE INDEX uq_mc_profile_eval_active
  ON organigrama.mc_profile_evaluation (
    extraction_id,
    domain_id,
    catalog_version_id,
    engine_rules_version,
    config_hash,
    mapping_hash
  )
  WHERE is_active = TRUE AND status = 'SUCCEEDED';

CREATE INDEX idx_mc_profile_eval_person
  ON organigrama.mc_profile_evaluation (person_id);

CREATE INDEX idx_mc_profile_eval_extraction
  ON organigrama.mc_profile_evaluation (extraction_id);

CREATE INDEX idx_mc_profile_eval_domain
  ON organigrama.mc_profile_evaluation (domain_id);

CREATE TABLE organigrama.mc_profile_specialty_result (
  id                        BIGSERIAL     PRIMARY KEY,
  profile_evaluation_id     BIGINT        NOT NULL,
  specialty_id              BIGINT        NOT NULL,
  specialty_code            VARCHAR(80)   NOT NULL,
  lifecycle_status          VARCHAR(20)   NOT NULL,
  presentation_status       VARCHAR(20)   NOT NULL,
  mapped_skill_count        INT           NOT NULL,
  evidenced_skill_count     INT           NOT NULL,
  coverage                  NUMERIC(5,4)  NOT NULL,
  confidence                NUMERIC(5,4)  NOT NULL,
  strength                  NUMERIC(6,2)  NOT NULL,
  rank                      INT           NOT NULL,
  is_default                BOOLEAN       NOT NULL DEFAULT FALSE,
  ranking_score             NUMERIC(10,4) NOT NULL DEFAULT 0,
  reasons                   JSONB         NOT NULL DEFAULT '[]',
  warnings                  JSONB         NOT NULL DEFAULT '[]',
  skill_breakdown           JSONB         NOT NULL DEFAULT '[]',
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mc_profile_spec_eval
    FOREIGN KEY (profile_evaluation_id)
    REFERENCES organigrama.mc_profile_evaluation(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_mc_profile_spec_specialty
    FOREIGN KEY (specialty_id)
    REFERENCES organigrama.mc_specialty(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_mc_profile_spec_result
    UNIQUE (profile_evaluation_id, specialty_id),

  CONSTRAINT chk_mc_profile_spec_presentation
    CHECK (presentation_status IN ('ACTIVE', 'EMERGENT', 'HIDDEN')),

  CONSTRAINT chk_mc_profile_spec_coverage
    CHECK (coverage >= 0 AND coverage <= 1),

  CONSTRAINT chk_mc_profile_spec_confidence
    CHECK (confidence >= 0 AND confidence <= 1),

  CONSTRAINT chk_mc_profile_spec_strength
    CHECK (strength >= 0 AND strength <= 100)
);

COMMENT ON TABLE organigrama.mc_profile_specialty_result IS
  'Resultado PA2 por especialidad. presentation_status es por perfil; '
  'lifecycle_status es copia del catálogo al momento de la evaluación.';

CREATE UNIQUE INDEX uq_mc_profile_spec_default
  ON organigrama.mc_profile_specialty_result (profile_evaluation_id)
  WHERE is_default = TRUE;

CREATE INDEX idx_mc_profile_spec_eval
  ON organigrama.mc_profile_specialty_result (profile_evaluation_id);

CREATE INDEX idx_mc_profile_spec_status
  ON organigrama.mc_profile_specialty_result (presentation_status);

COMMIT;
