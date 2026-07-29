-- MC1.2 / 1C.2: Evaluation Set — agrupación explícita de Domain Evaluations.
--
-- No determina dominio dominante. No crea Professional Classification.
-- No modifica filas históricas de mc_profile_evaluation.
-- No hace backfill.
--
-- Uso:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/023_mc_evaluation_set.sql
--
-- Rollback (manual):
--   BEGIN;
--   DROP TABLE IF EXISTS organigrama.mc_evaluation_set_domain;
--   DROP TABLE IF EXISTS organigrama.mc_evaluation_set;
--   COMMIT;

BEGIN;

CREATE TABLE organigrama.mc_evaluation_set (
  id                              BIGSERIAL     PRIMARY KEY,
  person_id                       BIGINT        NOT NULL,
  person_cv_id                    BIGINT        NOT NULL,
  extraction_id                   BIGINT        NOT NULL,
  enrichment_id                   BIGINT        NOT NULL,
  evidence_evaluation_id          BIGINT        NOT NULL,
  catalog_version_id              BIGINT        NOT NULL,
  source_hash                     VARCHAR(64)   NOT NULL,
  schema_version                  VARCHAR(32)   NOT NULL,
  qualification_policy_version    VARCHAR(32)   NOT NULL,
  candidate_domains_snapshot      JSONB         NOT NULL,
  set_context_hash                CHAR(64)      NOT NULL,
  status                          VARCHAR(20)   NOT NULL,
  warnings                        JSONB         NULL,
  completed_at                    TIMESTAMPTZ   NULL,
  failed_at                       TIMESTAMPTZ   NULL,
  created_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mc_eval_set_extraction
    FOREIGN KEY (extraction_id)
    REFERENCES organigrama.cv_extraction(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_mc_eval_set_enrichment
    FOREIGN KEY (enrichment_id)
    REFERENCES organigrama.cv_skill_enrichment(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_mc_eval_set_evidence
    FOREIGN KEY (evidence_evaluation_id)
    REFERENCES organigrama.cv_evidence_evaluation(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_mc_eval_set_catalog
    FOREIGN KEY (catalog_version_id)
    REFERENCES organigrama.mc_catalog_version(id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_mc_eval_set_status
    CHECK (status IN ('RUNNING', 'COMPLETE', 'PARTIAL', 'FAILED')),

  CONSTRAINT chk_mc_eval_set_hash_len
    CHECK (char_length(set_context_hash) = 64),

  CONSTRAINT chk_mc_eval_set_snapshot_array
    CHECK (jsonb_typeof(candidate_domains_snapshot) = 'array'),

  CONSTRAINT chk_mc_eval_set_warnings_array
    CHECK (warnings IS NULL OR jsonb_typeof(warnings) = 'array'),

  CONSTRAINT chk_mc_eval_set_terminal_ts
    CHECK (
      (status = 'RUNNING' AND completed_at IS NULL AND failed_at IS NULL)
      OR (status IN ('COMPLETE', 'PARTIAL') AND completed_at IS NOT NULL)
      OR (status = 'FAILED' AND failed_at IS NOT NULL)
    )
);

COMMENT ON TABLE organigrama.mc_evaluation_set IS
  'MC1.2 Evaluation Set: run multidominio comparable. '
  'No determina dominio dominante ni Professional Classification. '
  'Universo candidato autoritativo: filas mc_evaluation_set_domain; '
  'candidate_domains_snapshot es copia canónica de trazabilidad.';

COMMENT ON COLUMN organigrama.mc_evaluation_set.set_context_hash IS
  'SHA-256 hex (es-hash-1.0.0). Índice no UNIQUE: se permite re-run con mismo contexto.';

COMMENT ON COLUMN organigrama.mc_evaluation_set.status IS
  'RUNNING | COMPLETE | PARTIAL | FAILED. COMPLETE ≠ tiene PRIMARY_MATCH.';

CREATE INDEX idx_mc_eval_set_person
  ON organigrama.mc_evaluation_set (person_id);

CREATE INDEX idx_mc_eval_set_extraction
  ON organigrama.mc_evaluation_set (extraction_id);

CREATE INDEX idx_mc_eval_set_context_hash
  ON organigrama.mc_evaluation_set (set_context_hash);

CREATE INDEX idx_mc_eval_set_status
  ON organigrama.mc_evaluation_set (status);

CREATE TABLE organigrama.mc_evaluation_set_domain (
  id                        BIGSERIAL     PRIMARY KEY,
  evaluation_set_id         BIGINT        NOT NULL,
  domain_code               VARCHAR(80)   NOT NULL,
  domain_status             VARCHAR(20)   NOT NULL,
  profile_evaluation_id     BIGINT        NULL,
  domain_qualification      VARCHAR(32)   NULL,
  mapping_pack_code         VARCHAR(80)   NULL,
  mapping_pack_version      VARCHAR(64)   NULL,
  mapping_hash              VARCHAR(64)   NULL,
  engine_rules_version      VARCHAR(64)   NULL,
  algorithm_version         VARCHAR(64)   NULL,
  config_hash               VARCHAR(64)   NULL,
  failure_code              VARCHAR(80)   NULL,
  failure_message           TEXT          NULL,
  skip_reason               VARCHAR(80)   NULL,
  completed_at              TIMESTAMPTZ   NULL,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mc_eval_set_domain_set
    FOREIGN KEY (evaluation_set_id)
    REFERENCES organigrama.mc_evaluation_set(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_mc_eval_set_domain_eval
    FOREIGN KEY (profile_evaluation_id)
    REFERENCES organigrama.mc_profile_evaluation(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_mc_eval_set_domain_code
    UNIQUE (evaluation_set_id, domain_code),

  CONSTRAINT uq_mc_eval_set_domain_eval
    UNIQUE (profile_evaluation_id),

  CONSTRAINT chk_mc_eval_set_domain_status
    CHECK (domain_status IN (
      'SUCCEEDED', 'FAILED', 'SKIPPED', 'NOT_EVALUATED'
    )),

  CONSTRAINT chk_mc_eval_set_domain_qualification
    CHECK (
      domain_qualification IS NULL
      OR domain_qualification IN (
        'PRIMARY_MATCH',
        'SECONDARY_SIGNAL',
        'OUTSIDE',
        'INSUFFICIENT_EVIDENCE'
      )
    ),

  -- SUCCEEDED requiere evaluación vinculada.
  -- No-SUCCEEDED: qualification normalmente NULL (permite FAILED con mensaje).
  CONSTRAINT chk_mc_eval_set_domain_succeeded_link
    CHECK (
      (domain_status = 'SUCCEEDED' AND profile_evaluation_id IS NOT NULL)
      OR (
        domain_status IN ('FAILED', 'SKIPPED', 'NOT_EVALUATED')
        AND profile_evaluation_id IS NULL
      )
    ),

  CONSTRAINT chk_mc_eval_set_domain_non_success_qual
    CHECK (
      domain_status = 'SUCCEEDED'
      OR domain_qualification IS NULL
    )
);

COMMENT ON TABLE organigrama.mc_evaluation_set_domain IS
  'Outcome operativo por dominio candidato del Evaluation Set. '
  'domain_status ≠ domain_qualification. '
  'Relación autoritativa set↔evaluación: profile_evaluation_id (sin FK en mc_profile_evaluation).';

CREATE INDEX idx_mc_eval_set_domain_set
  ON organigrama.mc_evaluation_set_domain (evaluation_set_id);

CREATE INDEX idx_mc_eval_set_domain_eval
  ON organigrama.mc_evaluation_set_domain (profile_evaluation_id)
  WHERE profile_evaluation_id IS NOT NULL;

COMMIT;
