-- Fase E6: Attribute Engine determinista (Pipeline V2).
--
-- Schema: organigrama. Aditiva: no modifica extraction, extraction_skill,
-- enrichment, ni cv_evidence_evaluation / _item.
--
-- Uso:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/017_cv_attribute_engine.sql
--
-- Esta migración incluye BEGIN/COMMIT. No combinar con psql --single-transaction.

BEGIN;

-- ─── Catálogo versionado ──────────────────────────────────────────────────────

CREATE TABLE organigrama.cv_attribute_catalog_version (
  id            BIGSERIAL     PRIMARY KEY,
  code          VARCHAR(64)   NOT NULL,
  name          VARCHAR(200)  NOT NULL,
  description   TEXT          NULL,
  version       VARCHAR(64)   NOT NULL,
  status        VARCHAR(20)   NOT NULL,
  is_active     BOOLEAN       NOT NULL DEFAULT FALSE,
  config_hash   VARCHAR(64)   NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_cv_attribute_catalog_version_code_version
    UNIQUE (code, version),

  CONSTRAINT chk_cv_attribute_catalog_version_status
    CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),

  CONSTRAINT chk_cv_attribute_catalog_version_active_status
    CHECK (is_active = FALSE OR status = 'ACTIVE')
);

COMMENT ON TABLE organigrama.cv_attribute_catalog_version IS
  'Versión del catálogo de atributos profesionales. Solo una activa (índice parcial). '
  'No se eliminan versiones anteriores.';

-- `code` es único por sí solo para que (code, version) sea histórico y a la vez
-- exista una sola familia de catálogo por code en uso operativo.
CREATE UNIQUE INDEX uq_cv_attribute_catalog_version_active
  ON organigrama.cv_attribute_catalog_version (code)
  WHERE is_active = TRUE;

CREATE INDEX idx_cv_attribute_catalog_version_status
  ON organigrama.cv_attribute_catalog_version (status);

-- ─── Macroatributos ───────────────────────────────────────────────────────────

CREATE TABLE organigrama.cv_macroattribute (
  id                  BIGSERIAL     PRIMARY KEY,
  catalog_version_id  BIGINT        NOT NULL,
  code                VARCHAR(80)   NOT NULL,
  name                VARCHAR(200)  NOT NULL,
  description         TEXT          NULL,
  sort_order          INT           NOT NULL DEFAULT 0,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_macroattribute_catalog
    FOREIGN KEY (catalog_version_id)
    REFERENCES organigrama.cv_attribute_catalog_version(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_cv_macroattribute_code
    UNIQUE (catalog_version_id, code)
);

COMMENT ON TABLE organigrama.cv_macroattribute IS
  'Macroatributo del catálogo. Sus resultados se agregan desde subatributos, nunca desde skills.';

CREATE INDEX idx_cv_macroattribute_catalog
  ON organigrama.cv_macroattribute (catalog_version_id);

-- ─── Subatributos ─────────────────────────────────────────────────────────────

CREATE TABLE organigrama.cv_subattribute (
  id                          BIGSERIAL     PRIMARY KEY,
  catalog_version_id          BIGINT        NOT NULL,
  macroattribute_id           BIGINT        NOT NULL,
  code                        VARCHAR(80)   NOT NULL,
  name                        VARCHAR(200)  NOT NULL,
  description                 TEXT          NULL,
  sort_order                  INT           NOT NULL DEFAULT 0,
  is_active                   BOOLEAN       NOT NULL DEFAULT TRUE,
  minimum_supporting_skills   INT           NOT NULL DEFAULT 3,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_subattribute_catalog
    FOREIGN KEY (catalog_version_id)
    REFERENCES organigrama.cv_attribute_catalog_version(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cv_subattribute_macro
    FOREIGN KEY (macroattribute_id)
    REFERENCES organigrama.cv_macroattribute(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_cv_subattribute_code
    UNIQUE (catalog_version_id, code),

  CONSTRAINT chk_cv_subattribute_minimum_supporting
    CHECK (minimum_supporting_skills >= 1)
);

COMMENT ON TABLE organigrama.cv_subattribute IS
  'Subatributo del catálogo. minimum_supporting_skills es el target usado para coverage.';

CREATE INDEX idx_cv_subattribute_catalog
  ON organigrama.cv_subattribute (catalog_version_id);

CREATE INDEX idx_cv_subattribute_macro
  ON organigrama.cv_subattribute (macroattribute_id);

-- ─── Mapping skill → subatributo ──────────────────────────────────────────────

CREATE TABLE organigrama.cv_skill_attribute_mapping (
  id                  BIGSERIAL     PRIMARY KEY,
  catalog_version_id  BIGINT        NOT NULL,
  skill_id            BIGINT        NOT NULL,
  subattribute_id     BIGINT        NOT NULL,
  weight              NUMERIC(4,3)  NOT NULL,
  mapping_type        VARCHAR(20)   NOT NULL,
  rationale           TEXT          NULL,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_skill_attribute_mapping_catalog
    FOREIGN KEY (catalog_version_id)
    REFERENCES organigrama.cv_attribute_catalog_version(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cv_skill_attribute_mapping_skill
    FOREIGN KEY (skill_id)
    REFERENCES organigrama.cv_skill(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cv_skill_attribute_mapping_subattribute
    FOREIGN KEY (subattribute_id)
    REFERENCES organigrama.cv_subattribute(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_cv_skill_attribute_mapping
    UNIQUE (catalog_version_id, skill_id, subattribute_id),

  CONSTRAINT chk_cv_skill_attribute_mapping_weight
    CHECK (weight > 0 AND weight <= 1),

  CONSTRAINT chk_cv_skill_attribute_mapping_type
    CHECK (mapping_type IN ('DIRECT', 'SUPPORTING', 'CONTEXTUAL'))
);

COMMENT ON TABLE organigrama.cv_skill_attribute_mapping IS
  'Mapping explícito skill (catálogo cv_skill) → subatributo, con peso. '
  'La suma de weights activos por skill dentro de una versión se valida <= 1 en servicio.';

CREATE INDEX idx_cv_skill_attribute_mapping_catalog
  ON organigrama.cv_skill_attribute_mapping (catalog_version_id);

CREATE INDEX idx_cv_skill_attribute_mapping_skill
  ON organigrama.cv_skill_attribute_mapping (skill_id);

CREATE INDEX idx_cv_skill_attribute_mapping_subattribute
  ON organigrama.cv_skill_attribute_mapping (subattribute_id);

-- ─── Ejecución del Attribute Engine ───────────────────────────────────────────

CREATE TABLE organigrama.cv_attribute_run (
  id                                  BIGSERIAL     PRIMARY KEY,
  evidence_evaluation_id              BIGINT        NOT NULL,
  enrichment_id                       BIGINT        NOT NULL,
  extraction_id                       BIGINT        NOT NULL,
  person_id                           BIGINT        NOT NULL,
  catalog_version_id                  BIGINT        NOT NULL,

  mapping_hash                        VARCHAR(64)   NOT NULL,
  algorithm_version                   VARCHAR(64)   NOT NULL,
  config_version                      VARCHAR(64)   NOT NULL,
  config_hash                         VARCHAR(64)   NOT NULL,
  config_json                         JSONB         NOT NULL,

  status                              VARCHAR(20)   NOT NULL,
  is_active                           BOOLEAN       NOT NULL DEFAULT FALSE,

  input_skills_count                  INT           NOT NULL,
  mapped_skills_count                 INT           NOT NULL DEFAULT 0,
  unmapped_skills_count               INT           NOT NULL DEFAULT 0,
  contributing_skills_count           INT           NOT NULL DEFAULT 0,
  ignored_none_skills_count           INT           NOT NULL DEFAULT 0,
  subattributes_with_support_count     INT          NOT NULL DEFAULT 0,
  macroattributes_with_support_count   INT          NOT NULL DEFAULT 0,
  warnings_count                      INT           NOT NULL DEFAULT 0,

  metrics                             JSONB         NULL,
  warnings                            JSONB         NULL,
  errors                              JSONB         NULL,
  error_stage                         VARCHAR(80)   NULL,
  error_code                          VARCHAR(80)   NULL,
  error_message                       TEXT          NULL,

  started_at                          TIMESTAMPTZ   NULL,
  completed_at                        TIMESTAMPTZ   NULL,
  created_at                          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_attribute_run_evaluation
    FOREIGN KEY (evidence_evaluation_id)
    REFERENCES organigrama.cv_evidence_evaluation(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cv_attribute_run_enrichment
    FOREIGN KEY (enrichment_id)
    REFERENCES organigrama.cv_skill_enrichment(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cv_attribute_run_extraction
    FOREIGN KEY (extraction_id)
    REFERENCES organigrama.cv_extraction(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cv_attribute_run_person
    FOREIGN KEY (person_id)
    REFERENCES core.person(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cv_attribute_run_catalog
    FOREIGN KEY (catalog_version_id)
    REFERENCES organigrama.cv_attribute_catalog_version(id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_cv_attribute_run_status
    CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),

  CONSTRAINT chk_cv_attribute_run_active_succeeded
    CHECK (is_active = FALSE OR status = 'SUCCEEDED'),

  CONSTRAINT chk_cv_attribute_run_counts
    CHECK (
      input_skills_count >= 0
      AND mapped_skills_count >= 0
      AND unmapped_skills_count >= 0
      AND contributing_skills_count >= 0
      AND ignored_none_skills_count >= 0
      AND subattributes_with_support_count >= 0
      AND macroattributes_with_support_count >= 0
      AND warnings_count >= 0
    ),

  CONSTRAINT chk_cv_attribute_run_config_object
    CHECK (jsonb_typeof(config_json) = 'object'),

  CONSTRAINT chk_cv_attribute_run_warnings_array
    CHECK (warnings IS NULL OR jsonb_typeof(warnings) = 'array'),

  CONSTRAINT chk_cv_attribute_run_errors_array
    CHECK (errors IS NULL OR jsonb_typeof(errors) = 'array')
);

COMMENT ON TABLE organigrama.cv_attribute_run IS
  'Run del Attribute Engine (determinista, sin Gemini/PDF). Una activa por '
  'evidence_evaluation_id. Idempotencia SUCCEEDED por (evidence_evaluation_id, '
  'catalog_version_id, mapping_hash, algorithm_version, config_hash).';

CREATE UNIQUE INDEX uq_cv_attribute_run_evaluation_active
  ON organigrama.cv_attribute_run (evidence_evaluation_id)
  WHERE is_active = TRUE;

CREATE UNIQUE INDEX uq_cv_attribute_run_idempotency
  ON organigrama.cv_attribute_run (
    evidence_evaluation_id,
    catalog_version_id,
    mapping_hash,
    algorithm_version,
    config_hash
  )
  WHERE status = 'SUCCEEDED';

CREATE INDEX idx_cv_attribute_run_evaluation
  ON organigrama.cv_attribute_run (evidence_evaluation_id);

CREATE INDEX idx_cv_attribute_run_person
  ON organigrama.cv_attribute_run (person_id);

CREATE INDEX idx_cv_attribute_run_status
  ON organigrama.cv_attribute_run (status);

CREATE INDEX idx_cv_attribute_run_created
  ON organigrama.cv_attribute_run (created_at DESC);

-- ─── Resultados por subatributo ───────────────────────────────────────────────

CREATE TABLE organigrama.cv_subattribute_result (
  id                          BIGSERIAL     PRIMARY KEY,
  attribute_run_id            BIGINT        NOT NULL,
  subattribute_id             BIGINT        NOT NULL,

  score                       NUMERIC(6,2)  NOT NULL,
  confidence                  NUMERIC(5,4)  NOT NULL,
  coverage                    NUMERIC(5,4)  NOT NULL,
  level                       VARCHAR(20)   NOT NULL,

  supporting_skills_count     INT           NOT NULL,
  contributing_skills_count   INT           NOT NULL,
  strong_support_count        INT           NOT NULL DEFAULT 0,
  moderate_support_count      INT           NOT NULL DEFAULT 0,
  weak_support_count          INT           NOT NULL DEFAULT 0,
  none_support_count          INT           NOT NULL DEFAULT 0,

  quality_flags               JSONB         NOT NULL DEFAULT '[]'::jsonb,
  scoring_breakdown           JSONB         NOT NULL,
  explanation                 TEXT          NOT NULL,

  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_subattribute_result_run
    FOREIGN KEY (attribute_run_id)
    REFERENCES organigrama.cv_attribute_run(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_cv_subattribute_result_subattribute
    FOREIGN KEY (subattribute_id)
    REFERENCES organigrama.cv_subattribute(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_cv_subattribute_result
    UNIQUE (attribute_run_id, subattribute_id),

  CONSTRAINT chk_cv_subattribute_result_score
    CHECK (score >= 0 AND score <= 100),

  CONSTRAINT chk_cv_subattribute_result_confidence
    CHECK (confidence >= 0 AND confidence <= 1),

  CONSTRAINT chk_cv_subattribute_result_coverage
    CHECK (coverage >= 0 AND coverage <= 1),

  CONSTRAINT chk_cv_subattribute_result_level
    CHECK (level IN (
      'NO_SUPPORT', 'LIMITED', 'DEVELOPING', 'ESTABLISHED', 'WELL_SUPPORTED'
    )),

  CONSTRAINT chk_cv_subattribute_result_flags_array
    CHECK (jsonb_typeof(quality_flags) = 'array'),

  CONSTRAINT chk_cv_subattribute_result_breakdown_object
    CHECK (jsonb_typeof(scoring_breakdown) = 'object'),

  CONSTRAINT chk_cv_subattribute_result_counts
    CHECK (
      supporting_skills_count >= 0
      AND contributing_skills_count >= 0
      AND strong_support_count >= 0
      AND moderate_support_count >= 0
      AND weak_support_count >= 0
      AND none_support_count >= 0
    )
);

COMMENT ON TABLE organigrama.cv_subattribute_result IS
  'Resultado por subatributo. score representa respaldo observado en evidencia, '
  'no dominio ni nivel profesional.';

CREATE INDEX idx_cv_subattribute_result_run
  ON organigrama.cv_subattribute_result (attribute_run_id);

CREATE INDEX idx_cv_subattribute_result_subattribute
  ON organigrama.cv_subattribute_result (subattribute_id);

-- ─── Resultados por macroatributo ─────────────────────────────────────────────

CREATE TABLE organigrama.cv_macroattribute_result (
  id                              BIGSERIAL     PRIMARY KEY,
  attribute_run_id                BIGINT        NOT NULL,
  macroattribute_id               BIGINT        NOT NULL,

  score                           NUMERIC(6,2)  NOT NULL,
  confidence                      NUMERIC(5,4)  NOT NULL,
  coverage                        NUMERIC(5,4)  NOT NULL,
  level                           VARCHAR(20)   NOT NULL,

  supported_subattributes_count   INT           NOT NULL,
  total_subattributes_count       INT           NOT NULL,

  quality_flags                   JSONB         NOT NULL DEFAULT '[]'::jsonb,
  scoring_breakdown               JSONB         NOT NULL,
  explanation                     TEXT          NOT NULL,

  created_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_macroattribute_result_run
    FOREIGN KEY (attribute_run_id)
    REFERENCES organigrama.cv_attribute_run(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_cv_macroattribute_result_macro
    FOREIGN KEY (macroattribute_id)
    REFERENCES organigrama.cv_macroattribute(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_cv_macroattribute_result
    UNIQUE (attribute_run_id, macroattribute_id),

  CONSTRAINT chk_cv_macroattribute_result_score
    CHECK (score >= 0 AND score <= 100),

  CONSTRAINT chk_cv_macroattribute_result_confidence
    CHECK (confidence >= 0 AND confidence <= 1),

  CONSTRAINT chk_cv_macroattribute_result_coverage
    CHECK (coverage >= 0 AND coverage <= 1),

  CONSTRAINT chk_cv_macroattribute_result_level
    CHECK (level IN (
      'NO_SUPPORT', 'LIMITED', 'DEVELOPING', 'ESTABLISHED', 'WELL_SUPPORTED'
    )),

  CONSTRAINT chk_cv_macroattribute_result_flags_array
    CHECK (jsonb_typeof(quality_flags) = 'array'),

  CONSTRAINT chk_cv_macroattribute_result_breakdown_object
    CHECK (jsonb_typeof(scoring_breakdown) = 'object'),

  CONSTRAINT chk_cv_macroattribute_result_counts
    CHECK (
      supported_subattributes_count >= 0
      AND total_subattributes_count >= 0
      AND supported_subattributes_count <= total_subattributes_count
    )
);

COMMENT ON TABLE organigrama.cv_macroattribute_result IS
  'Resultado por macroatributo, agregado exclusivamente desde cv_subattribute_result.';

CREATE INDEX idx_cv_macroattribute_result_run
  ON organigrama.cv_macroattribute_result (attribute_run_id);

CREATE INDEX idx_cv_macroattribute_result_macro
  ON organigrama.cv_macroattribute_result (macroattribute_id);

-- ─── Trazabilidad de skills aportantes ────────────────────────────────────────

CREATE TABLE organigrama.cv_attribute_result_skill (
  id                          BIGSERIAL     PRIMARY KEY,
  attribute_run_id            BIGINT        NOT NULL,
  subattribute_result_id      BIGINT        NOT NULL,
  extraction_skill_id         BIGINT        NOT NULL,
  evidence_evaluation_item_id BIGINT        NOT NULL,
  mapping_id                  BIGINT        NOT NULL,

  mapping_weight              NUMERIC(4,3)  NOT NULL,
  evidence_strength           NUMERIC(6,2)  NOT NULL,
  evidence_confidence         NUMERIC(5,4)  NOT NULL,
  raw_contribution            NUMERIC(8,4)  NOT NULL,
  normalized_contribution     NUMERIC(8,4)  NOT NULL,
  contribution_rank           INT           NOT NULL,

  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_attribute_result_skill_run
    FOREIGN KEY (attribute_run_id)
    REFERENCES organigrama.cv_attribute_run(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_cv_attribute_result_skill_sub_result
    FOREIGN KEY (subattribute_result_id)
    REFERENCES organigrama.cv_subattribute_result(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_cv_attribute_result_skill_extraction_skill
    FOREIGN KEY (extraction_skill_id)
    REFERENCES organigrama.cv_extraction_skill(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cv_attribute_result_skill_evaluation_item
    FOREIGN KEY (evidence_evaluation_item_id)
    REFERENCES organigrama.cv_evidence_evaluation_item(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_cv_attribute_result_skill_mapping
    FOREIGN KEY (mapping_id)
    REFERENCES organigrama.cv_skill_attribute_mapping(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_cv_attribute_result_skill
    UNIQUE (subattribute_result_id, extraction_skill_id, mapping_id),

  CONSTRAINT chk_cv_attribute_result_skill_weight
    CHECK (mapping_weight > 0 AND mapping_weight <= 1),

  CONSTRAINT chk_cv_attribute_result_skill_strength
    CHECK (evidence_strength >= 0 AND evidence_strength <= 100),

  CONSTRAINT chk_cv_attribute_result_skill_confidence
    CHECK (evidence_confidence >= 0 AND evidence_confidence <= 1),

  CONSTRAINT chk_cv_attribute_result_skill_contributions
    CHECK (raw_contribution >= 0 AND normalized_contribution >= 0),

  CONSTRAINT chk_cv_attribute_result_skill_rank
    CHECK (contribution_rank >= 1)
);

COMMENT ON TABLE organigrama.cv_attribute_result_skill IS
  'Traza por mapping: explica exactamente por qué un subatributo obtuvo su score. '
  'normalized_contribution es la contribución tras el factor de rendimiento decreciente.';

CREATE INDEX idx_cv_attribute_result_skill_run
  ON organigrama.cv_attribute_result_skill (attribute_run_id);

CREATE INDEX idx_cv_attribute_result_skill_sub_result
  ON organigrama.cv_attribute_result_skill (subattribute_result_id);

CREATE INDEX idx_cv_attribute_result_skill_extraction_skill
  ON organigrama.cv_attribute_result_skill (extraction_skill_id);

COMMIT;
