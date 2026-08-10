-- FASE 6D/6E — Persistencia P1 (MC1.P1.EVIDENCE 2.0.0).
-- Schema: organigrama. Diseño: docs/mc1-p1-persistence-ddl-design.md (6C).
-- Auditoría 6E: SCHEMA_APPROVED_FOR_APPLICATION_LAYER.
-- Solo aplicar en MDE (127.0.0.1:5434 / organigrama_mde).
-- TRUNCATE bypassa triggers de fila: no usar sobre historia mc_*; DROP ordenado.
--
--   psql ... -v ON_ERROR_STOP=1 -f migrations/027_mc1_p1_evidence_persistence.sql
--
-- Rollback conceptual (solo MDE / desarrollo):
--   BEGIN;
--   DROP VIEW IF EXISTS organigrama.v_mc_p1_canonical_evidence_for_p2;
--   DROP TRIGGER IF EXISTS trg_mc_p1_run_immutable ON organigrama.mc_p1_run;
--   DROP TRIGGER IF EXISTS trg_mc_p1_run_complete_guards ON organigrama.mc_p1_run;
--   DROP TRIGGER IF EXISTS trg_mc_p1_run_cursor_eligible ON organigrama.mc_p1_run_cursor;
--   DROP TRIGGER IF EXISTS trg_mc_evidence_batch_immutable ON organigrama.mc_evidence_batch;
--   DROP TRIGGER IF EXISTS trg_mc_evidence_candidate_immutable ON organigrama.mc_evidence_candidate;
--   DROP TRIGGER IF EXISTS trg_mc_evidence_candidate_decision_immutable ON organigrama.mc_evidence_candidate_decision;
--   DROP TRIGGER IF EXISTS trg_mc_evidence_unit_immutable ON organigrama.mc_evidence_unit;
--   DROP TRIGGER IF EXISTS trg_mc_evidence_unit_insert_guards ON organigrama.mc_evidence_unit;
--   DROP TRIGGER IF EXISTS trg_mc_evidence_unit_candidate_link_immutable ON organigrama.mc_evidence_unit_candidate_link;
--   DROP TRIGGER IF EXISTS trg_mc_evidence_unit_candidate_link_guards ON organigrama.mc_evidence_unit_candidate_link;
--   DROP TRIGGER IF EXISTS trg_mc_evidence_review_item_protect ON organigrama.mc_evidence_review_item;
--   DROP FUNCTION IF EXISTS organigrama.fn_mc_p1_run_is_terminal(TEXT);
--   DROP FUNCTION IF EXISTS organigrama.fn_mc_p1_run_block_terminal_mutation();
--   DROP FUNCTION IF EXISTS organigrama.fn_mc_p1_run_complete_guards();
--   DROP FUNCTION IF EXISTS organigrama.fn_mc_p1_run_assert_satisfactory(organigrama.mc_p1_run);
--   DROP FUNCTION IF EXISTS organigrama.fn_mc_p1_warning_codes_allowed(JSONB);
--   DROP FUNCTION IF EXISTS organigrama.fn_mc_p1_run_cursor_eligible();
--   DROP FUNCTION IF EXISTS organigrama.fn_mc_evidence_child_immutable();
--   DROP FUNCTION IF EXISTS organigrama.fn_mc_evidence_unit_insert_guards();
--   DROP FUNCTION IF EXISTS organigrama.fn_mc_evidence_unit_candidate_link_guards();
--   DROP FUNCTION IF EXISTS organigrama.fn_mc_evidence_review_item_protect();
--   DROP TABLE IF EXISTS organigrama.mc_evidence_review_item;
--   DROP TABLE IF EXISTS organigrama.mc_evidence_unit_candidate_link;
--   DROP TABLE IF EXISTS organigrama.mc_evidence_unit;
--   DROP TABLE IF EXISTS organigrama.mc_evidence_candidate_decision;
--   DROP TABLE IF EXISTS organigrama.mc_evidence_candidate;
--   DROP TABLE IF EXISTS organigrama.mc_evidence_batch;
--   DROP TABLE IF EXISTS organigrama.mc_p1_run_cursor;
--   DROP TABLE IF EXISTS organigrama.mc_p1_run;
--   COMMIT;
--
-- Esta migración incluye BEGIN/COMMIT. No combinar con psql --single-transaction.
-- Sin seed. Sin backfill de pilotos. Sin texto de CV / prompts / secretos / raw IA.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- mc_p1_run
-- ---------------------------------------------------------------------------
CREATE TABLE organigrama.mc_p1_run (
  id                              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id                     BIGINT        NOT NULL,
  attempt_no                      INT           NOT NULL,
  config_fingerprint              CHAR(64)      NOT NULL,
  contract_code                   TEXT          NOT NULL DEFAULT 'MC1.P1.EVIDENCE',
  contract_version                TEXT          NOT NULL,
  segmenter_name                  TEXT          NOT NULL,
  segmenter_version               TEXT          NOT NULL,
  prompt_version                  TEXT          NOT NULL,
  model_provider                  TEXT          NOT NULL,
  model_version                   TEXT          NOT NULL,
  batch_builder_version           TEXT          NOT NULL,
  validator_version               TEXT          NOT NULL,
  status                          TEXT          NOT NULL,
  started_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  completed_at                    TIMESTAMPTZ   NULL,
  decision_coverage               NUMERIC(6,5)  NOT NULL DEFAULT 0,
  candidate_count                 INT           NOT NULL DEFAULT 0,
  evidence_unit_count             INT           NOT NULL DEFAULT 0,
  unsupported_span_count          INT           NOT NULL DEFAULT 0,
  forbidden_taxonomy_hit_count    INT           NOT NULL DEFAULT 0,
  failed_batch_count              INT           NOT NULL DEFAULT 0,
  warning_codes                   JSONB         NOT NULL DEFAULT '[]'::jsonb,
  result_origin                   TEXT          NOT NULL,
  campaign_id                     TEXT          NULL,
  pipeline_run_id                 TEXT          NULL,
  observatory_run_id              TEXT          NULL,
  error_code                      TEXT          NULL,
  created_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mc_p1_run_snapshot
    FOREIGN KEY (snapshot_id)
    REFERENCES organigrama.mc_cv_snapshot(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT uq_mc_p1_run_attempt
    UNIQUE (snapshot_id, config_fingerprint, attempt_no),

  CONSTRAINT chk_mc_p1_run_attempt_no
    CHECK (attempt_no >= 1),

  CONSTRAINT chk_mc_p1_run_config_fingerprint
    CHECK (config_fingerprint ~ '^[a-f0-9]{64}$'),

  CONSTRAINT chk_mc_p1_run_contract_code
    CHECK (contract_code = 'MC1.P1.EVIDENCE'),

  CONSTRAINT chk_mc_p1_run_status
    CHECK (status IN (
      'PLANNED',
      'RUNNING',
      'COMPLETED',
      'COMPLETED_WITH_WARNINGS',
      'PARTIAL',
      'FAILED',
      'CANCELLED'
    )),

  CONSTRAINT chk_mc_p1_run_result_origin
    CHECK (result_origin IN ('PIPELINE', 'REPLAY', 'LAB')),

  CONSTRAINT chk_mc_p1_run_decision_coverage
    CHECK (decision_coverage >= 0 AND decision_coverage <= 1),

  CONSTRAINT chk_mc_p1_run_counts_nonneg
    CHECK (
      candidate_count >= 0
      AND evidence_unit_count >= 0
      AND unsupported_span_count >= 0
      AND forbidden_taxonomy_hit_count >= 0
      AND failed_batch_count >= 0
    ),

  CONSTRAINT chk_mc_p1_run_completed_at
    CHECK (
      (
        status IN ('PLANNED', 'RUNNING')
        AND completed_at IS NULL
      )
      OR
      (
        status IN (
          'COMPLETED',
          'COMPLETED_WITH_WARNINGS',
          'PARTIAL',
          'FAILED',
          'CANCELLED'
        )
        AND completed_at IS NOT NULL
      )
    ),

  CONSTRAINT chk_mc_p1_run_warning_codes_array
    CHECK (jsonb_typeof(warning_codes) = 'array')
);

CREATE UNIQUE INDEX uq_mc_p1_run_satisfactory_fingerprint
  ON organigrama.mc_p1_run (snapshot_id, config_fingerprint)
  WHERE status IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS');

CREATE UNIQUE INDEX uq_mc_p1_run_open_fingerprint
  ON organigrama.mc_p1_run (snapshot_id, config_fingerprint)
  WHERE status IN ('PLANNED', 'RUNNING');

CREATE INDEX ix_mc_p1_run_snapshot_id
  ON organigrama.mc_p1_run (snapshot_id);

CREATE INDEX ix_mc_p1_run_status
  ON organigrama.mc_p1_run (status);

CREATE INDEX ix_mc_p1_run_created_at
  ON organigrama.mc_p1_run (created_at DESC);

COMMENT ON TABLE organigrama.mc_p1_run IS
  'P1 run versionado (MC1.P1.EVIDENCE 2.0.0). Artefacto de ejecución; no texto CV.';

-- ---------------------------------------------------------------------------
-- mc_p1_run_cursor
-- ---------------------------------------------------------------------------
CREATE TABLE organigrama.mc_p1_run_cursor (
  snapshot_id           BIGINT        NOT NULL,
  lineage_key           TEXT          NOT NULL,
  p1_run_id             UUID          NOT NULL,
  promoted_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  promoted_reason       TEXT          NOT NULL,
  previous_p1_run_id    UUID          NULL,

  CONSTRAINT pk_mc_p1_run_cursor
    PRIMARY KEY (snapshot_id, lineage_key),

  CONSTRAINT fk_mc_p1_run_cursor_snapshot
    FOREIGN KEY (snapshot_id)
    REFERENCES organigrama.mc_cv_snapshot(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT fk_mc_p1_run_cursor_run
    FOREIGN KEY (p1_run_id)
    REFERENCES organigrama.mc_p1_run(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT fk_mc_p1_run_cursor_previous
    FOREIGN KEY (previous_p1_run_id)
    REFERENCES organigrama.mc_p1_run(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT chk_mc_p1_run_cursor_lineage
    CHECK (lineage_key IN ('DEFAULT', 'LAB', 'REPLAY')),

  CONSTRAINT chk_mc_p1_run_cursor_promoted_reason
    CHECK (promoted_reason IN ('INITIAL', 'SUPERSEDE', 'MANUAL'))
);

CREATE INDEX ix_mc_p1_run_cursor_p1_run_id
  ON organigrama.mc_p1_run_cursor (p1_run_id);

COMMENT ON TABLE organigrama.mc_p1_run_cursor IS
  'Puntero CURRENT por (snapshot_id, lineage_key). Mutable. Canal DEFAULT = P2.';

-- ---------------------------------------------------------------------------
-- mc_evidence_batch
-- ---------------------------------------------------------------------------
CREATE TABLE organigrama.mc_evidence_batch (
  id                              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  p1_run_id                       UUID          NOT NULL,
  batch_id                        TEXT          NOT NULL,
  page_range_start                INT           NOT NULL,
  page_range_end                  INT           NOT NULL,
  candidate_count                 INT           NOT NULL DEFAULT 0,
  status                          TEXT          NOT NULL,
  attempt_count                   INT           NOT NULL DEFAULT 0,
  validation_status               TEXT          NOT NULL DEFAULT 'NOT_VALIDATED',
  unsupported_span_count          INT           NOT NULL DEFAULT 0,
  forbidden_taxonomy_hit_count    INT           NOT NULL DEFAULT 0,
  raw_output_ref                  TEXT          NULL,
  started_at                      TIMESTAMPTZ   NULL,
  finished_at                     TIMESTAMPTZ   NULL,
  created_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mc_evidence_batch_run
    FOREIGN KEY (p1_run_id)
    REFERENCES organigrama.mc_p1_run(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT uq_mc_evidence_batch_run_batch
    UNIQUE (p1_run_id, batch_id),

  CONSTRAINT chk_mc_evidence_batch_status
    CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'ABORTED')),

  CONSTRAINT chk_mc_evidence_batch_validation
    CHECK (validation_status IN (
      'NOT_VALIDATED',
      'OK',
      'SCHEMA_INVALID',
      'OFFSET_INVALID',
      'COVERAGE_INVALID'
    )),

  CONSTRAINT chk_mc_evidence_batch_pages
    CHECK (page_range_start >= 1 AND page_range_end >= page_range_start),

  CONSTRAINT chk_mc_evidence_batch_counts
    CHECK (
      candidate_count >= 0
      AND attempt_count >= 0
      AND unsupported_span_count >= 0
      AND forbidden_taxonomy_hit_count >= 0
    )
);

CREATE INDEX ix_mc_evidence_batch_run
  ON organigrama.mc_evidence_batch (p1_run_id);

COMMENT ON COLUMN organigrama.mc_evidence_batch.raw_output_ref IS
  'Referencia segura opcional (path/URI). Nunca el payload IA en la fila.';

-- ---------------------------------------------------------------------------
-- mc_evidence_candidate
-- ---------------------------------------------------------------------------
CREATE TABLE organigrama.mc_evidence_candidate (
  p1_run_id                   UUID          NOT NULL,
  candidate_id                TEXT          NOT NULL,
  snapshot_id                 BIGINT        NOT NULL,
  page_number                 INT           NOT NULL,
  start_offset                INT           NOT NULL,
  end_offset                  INT           NOT NULL,
  text_hash                   CHAR(64)      NOT NULL,
  character_count             INT           NOT NULL,
  candidate_type              TEXT          NOT NULL,
  block_type                  TEXT          NULL,
  parent_heading_candidate_id TEXT          NULL,
  batch_id                    TEXT          NULL,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT pk_mc_evidence_candidate
    PRIMARY KEY (p1_run_id, candidate_id),

  CONSTRAINT fk_mc_evidence_candidate_run
    FOREIGN KEY (p1_run_id)
    REFERENCES organigrama.mc_p1_run(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT fk_mc_evidence_candidate_snapshot
    FOREIGN KEY (snapshot_id)
    REFERENCES organigrama.mc_cv_snapshot(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT chk_mc_evidence_candidate_offsets
    CHECK (start_offset >= 0 AND end_offset > start_offset),

  CONSTRAINT chk_mc_evidence_candidate_char_count
    CHECK (character_count = end_offset - start_offset),

  CONSTRAINT chk_mc_evidence_candidate_text_hash
    CHECK (text_hash ~ '^[a-f0-9]{64}$'),

  CONSTRAINT chk_mc_evidence_candidate_page
    CHECK (page_number >= 1),

  CONSTRAINT chk_mc_evidence_candidate_type
    CHECK (candidate_type IN (
      'SENTENCE',
      'BULLET',
      'PARAGRAPH',
      'HEADING',
      'TABLE_LIKE_ROW',
      'OTHER'
    )),

  CONSTRAINT chk_mc_evidence_candidate_block_type
    CHECK (
      block_type IS NULL
      OR block_type IN (
        'PROFILE',
        'EXPERIENCE',
        'EDUCATION',
        'CERTIFICATIONS',
        'SKILLS',
        'TOOLS',
        'LANGUAGES',
        'PROJECTS',
        'REFERENCES',
        'OTHER'
      )
    )
);

CREATE INDEX ix_mc_evidence_candidate_snapshot
  ON organigrama.mc_evidence_candidate (snapshot_id);

-- ---------------------------------------------------------------------------
-- mc_evidence_candidate_decision
-- ---------------------------------------------------------------------------
CREATE TABLE organigrama.mc_evidence_candidate_decision (
  p1_run_id         UUID          NOT NULL,
  candidate_id      TEXT          NOT NULL,
  decision          TEXT          NOT NULL,
  reason_code       TEXT          NOT NULL,
  review_required   BOOLEAN       NOT NULL DEFAULT FALSE,
  batch_id          TEXT          NULL,
  decided_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT pk_mc_evidence_candidate_decision
    PRIMARY KEY (p1_run_id, candidate_id),

  CONSTRAINT fk_mc_evidence_candidate_decision_candidate
    FOREIGN KEY (p1_run_id, candidate_id)
    REFERENCES organigrama.mc_evidence_candidate (p1_run_id, candidate_id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT chk_mc_evidence_candidate_decision_enum
    CHECK (decision IN (
      'ACCEPTED',
      'REJECTED_NON_PROFESSIONAL',
      'REJECTED_CONTEXT_ONLY',
      'AMBIGUOUS',
      'REVIEW_REQUIRED'
    ))
);

CREATE INDEX ix_mc_evidence_candidate_decision_decision
  ON organigrama.mc_evidence_candidate_decision (p1_run_id, decision);

-- ---------------------------------------------------------------------------
-- mc_evidence_unit
-- ---------------------------------------------------------------------------
CREATE TABLE organigrama.mc_evidence_unit (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  p1_run_id                 UUID          NOT NULL,
  snapshot_id               BIGINT        NOT NULL,
  primary_candidate_id      TEXT          NOT NULL,
  page_number               INT           NOT NULL,
  start_offset              INT           NOT NULL,
  end_offset                INT           NOT NULL,
  span_text_hash            CHAR(64)      NOT NULL,
  evidence_kind             TEXT          NOT NULL,
  explicitness              TEXT          NOT NULL,
  decision                  TEXT          NOT NULL,
  review_gate               TEXT          NOT NULL,
  normalized_activity       TEXT          NULL,
  object                    TEXT          NULL,
  tool_or_method            TEXT          NULL,
  result                    TEXT          NULL,
  scope                     TEXT          NULL,
  temporal_context          TEXT          NULL,
  content_fingerprint       CHAR(64)      NOT NULL,
  confidence_extraction     NUMERIC(6,5)  NULL,
  confidence_span_integrity NUMERIC(6,5)  NULL,
  batch_id                  TEXT          NULL,
  provenance                JSONB         NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mc_evidence_unit_run
    FOREIGN KEY (p1_run_id)
    REFERENCES organigrama.mc_p1_run(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT fk_mc_evidence_unit_snapshot
    FOREIGN KEY (snapshot_id)
    REFERENCES organigrama.mc_cv_snapshot(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT fk_mc_evidence_unit_primary_candidate
    FOREIGN KEY (p1_run_id, primary_candidate_id)
    REFERENCES organigrama.mc_evidence_candidate (p1_run_id, candidate_id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT uq_mc_evidence_unit_dedupe
    UNIQUE (
      p1_run_id,
      primary_candidate_id,
      start_offset,
      end_offset,
      evidence_kind,
      content_fingerprint
    ),

  CONSTRAINT chk_mc_evidence_unit_offsets
    CHECK (start_offset >= 0 AND end_offset > start_offset),

  CONSTRAINT chk_mc_evidence_unit_span_hash
    CHECK (span_text_hash ~ '^[a-f0-9]{64}$'),

  CONSTRAINT chk_mc_evidence_unit_content_fp
    CHECK (content_fingerprint ~ '^[a-f0-9]{64}$'),

  CONSTRAINT chk_mc_evidence_unit_page
    CHECK (page_number >= 1),

  CONSTRAINT chk_mc_evidence_unit_kind
    CHECK (evidence_kind IN (
      'ACTION',
      'RESPONSIBILITY',
      'PROJECT',
      'DELIVERABLE',
      'RESULT',
      'TOOL_USAGE',
      'METHODOLOGY',
      'CERTIFICATION',
      'KNOWLEDGE_STATEMENT',
      'LANGUAGE',
      'EDUCATION_SIGNAL',
      'OTHER_PROFESSIONAL_EVIDENCE'
    )),

  CONSTRAINT chk_mc_evidence_unit_explicitness
    CHECK (explicitness IN ('EXPLICIT', 'STRONGLY_SUPPORTED', 'INFERRED')),

  CONSTRAINT chk_mc_evidence_unit_decision
    CHECK (decision IN (
      'ACCEPTED',
      'REJECTED_NON_PROFESSIONAL',
      'REJECTED_CONTEXT_ONLY',
      'AMBIGUOUS',
      'REVIEW_REQUIRED'
    )),

  CONSTRAINT chk_mc_evidence_unit_review_gate
    CHECK (review_gate IN ('NOT_REQUIRED', 'PENDING_REVIEW')),

  CONSTRAINT chk_mc_evidence_unit_confidence
    CHECK (
      (confidence_extraction IS NULL OR (confidence_extraction >= 0 AND confidence_extraction <= 1))
      AND (confidence_span_integrity IS NULL OR (confidence_span_integrity >= 0 AND confidence_span_integrity <= 1))
    ),

  CONSTRAINT chk_mc_evidence_unit_provenance_object
    CHECK (jsonb_typeof(provenance) = 'object')
);

CREATE INDEX ix_mc_evidence_unit_run
  ON organigrama.mc_evidence_unit (p1_run_id);

CREATE INDEX ix_mc_evidence_unit_review_gate
  ON organigrama.mc_evidence_unit (p1_run_id, review_gate);

CREATE INDEX ix_mc_evidence_unit_snapshot
  ON organigrama.mc_evidence_unit (snapshot_id);

-- ---------------------------------------------------------------------------
-- mc_evidence_unit_candidate_link
-- ---------------------------------------------------------------------------
CREATE TABLE organigrama.mc_evidence_unit_candidate_link (
  evidence_unit_id    UUID          NOT NULL,
  p1_run_id           UUID          NOT NULL,
  candidate_id        TEXT          NOT NULL,
  link_role           TEXT          NOT NULL,
  overlap_ratio       NUMERIC(6,5)  NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT pk_mc_evidence_unit_candidate_link
    PRIMARY KEY (evidence_unit_id, candidate_id, link_role),

  CONSTRAINT fk_mc_evidence_unit_candidate_link_unit
    FOREIGN KEY (evidence_unit_id)
    REFERENCES organigrama.mc_evidence_unit(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT fk_mc_evidence_unit_candidate_link_run
    FOREIGN KEY (p1_run_id)
    REFERENCES organigrama.mc_p1_run(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT fk_mc_evidence_unit_candidate_link_candidate
    FOREIGN KEY (p1_run_id, candidate_id)
    REFERENCES organigrama.mc_evidence_candidate (p1_run_id, candidate_id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT chk_mc_evidence_unit_candidate_link_role
    CHECK (link_role IN ('RELATED', 'CONTEXT', 'MERGE_SOURCE')),

  CONSTRAINT chk_mc_evidence_unit_candidate_link_overlap
    CHECK (overlap_ratio IS NULL OR (overlap_ratio >= 0 AND overlap_ratio <= 1))
);

CREATE INDEX ix_mc_evidence_unit_candidate_link_run
  ON organigrama.mc_evidence_unit_candidate_link (p1_run_id);

-- ---------------------------------------------------------------------------
-- mc_evidence_review_item
-- ---------------------------------------------------------------------------
CREATE TABLE organigrama.mc_evidence_review_item (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  p1_run_id                 UUID          NOT NULL,
  snapshot_id               BIGINT        NOT NULL,
  subject_type              TEXT          NOT NULL,
  subject_id                TEXT          NOT NULL,
  trigger_code              TEXT          NOT NULL,
  queue_status              TEXT          NOT NULL DEFAULT 'OPEN',
  resolution                TEXT          NULL,
  actor_id                  TEXT          NULL,
  resolved_at               TIMESTAMPTZ   NULL,
  resolution_reason_code    TEXT          NULL,
  resolution_note_safe      TEXT          NULL,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mc_evidence_review_item_run
    FOREIGN KEY (p1_run_id)
    REFERENCES organigrama.mc_p1_run(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT fk_mc_evidence_review_item_snapshot
    FOREIGN KEY (snapshot_id)
    REFERENCES organigrama.mc_cv_snapshot(id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,

  CONSTRAINT chk_mc_evidence_review_item_subject_type
    CHECK (subject_type IN ('CANDIDATE', 'EVIDENCE_UNIT')),

  CONSTRAINT chk_mc_evidence_review_item_trigger
    CHECK (trigger_code IN (
      'DECISION_REVIEW_REQUIRED',
      'AMBIGUOUS',
      'INFERRED_UNIT',
      'POLICY_SAMPLE'
    )),

  CONSTRAINT chk_mc_evidence_review_item_queue
    CHECK (queue_status IN (
      'OPEN',
      'IN_PROGRESS',
      'RESOLVED',
      'WAIVED',
      'SUPERSEDED'
    )),

  CONSTRAINT chk_mc_evidence_review_item_resolution
    CHECK (
      resolution IS NULL
      OR resolution IN ('APPROVED', 'REJECTED')
    ),

  CONSTRAINT chk_mc_evidence_review_item_resolved_shape
    CHECK (
      (
        queue_status = 'RESOLVED'
        AND resolution IS NOT NULL
        AND resolved_at IS NOT NULL
      )
      OR
      (
        queue_status <> 'RESOLVED'
        AND resolution IS NULL
      )
    )
);

CREATE INDEX ix_mc_evidence_review_item_queue
  ON organigrama.mc_evidence_review_item (queue_status);

CREATE INDEX ix_mc_evidence_review_item_run
  ON organigrama.mc_evidence_review_item (p1_run_id);

CREATE INDEX ix_mc_evidence_review_item_subject
  ON organigrama.mc_evidence_review_item (subject_type, subject_id);

-- ---------------------------------------------------------------------------
-- Helpers / triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION organigrama.fn_mc_p1_run_is_terminal(p_status TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status IN (
    'COMPLETED',
    'COMPLETED_WITH_WARNINGS',
    'PARTIAL',
    'FAILED',
    'CANCELLED'
  );
$$;

CREATE OR REPLACE FUNCTION organigrama.fn_mc_p1_run_block_terminal_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF organigrama.fn_mc_p1_run_is_terminal(OLD.status) THEN
      RAISE EXCEPTION 'mc_p1_run is immutable after terminal status (id=%, status=%)',
        OLD.id, OLD.status
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF organigrama.fn_mc_p1_run_is_terminal(OLD.status) THEN
    RAISE EXCEPTION 'mc_p1_run is immutable after terminal status (id=%, status=%)',
      OLD.id, OLD.status
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mc_p1_run_immutable
  BEFORE UPDATE OR DELETE ON organigrama.mc_p1_run
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_p1_run_block_terminal_mutation();

-- Allowlist cerrada versionada (WARNING_POLICY_VERSION = 1.0.0)
CREATE OR REPLACE FUNCTION organigrama.fn_mc_p1_warning_codes_allowed(p_codes JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_elem TEXT;
  v_allowed TEXT[] := ARRAY[
    'P0_PARSE_WARNING_PRESENT',
    'HIGH_REVIEW_RATIO',
    'BATCH_RETRY_USED',
    'SEGMENTER_HEADING_SPARSE'
  ];
BEGIN
  IF p_codes IS NULL OR jsonb_typeof(p_codes) <> 'array' THEN
    RETURN FALSE;
  END IF;
  FOR v_elem IN SELECT jsonb_array_elements_text(p_codes)
  LOOP
    IF NOT (v_elem = ANY (v_allowed)) THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION organigrama.fn_mc_p1_warning_codes_allowed(JSONB) IS
  'Allowlist warning_codes P1 WARNING_POLICY_VERSION=1.0.0. Códigos desconocidos => false.';

CREATE OR REPLACE FUNCTION organigrama.fn_mc_p1_run_assert_satisfactory(p_row organigrama.mc_p1_run)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_cand_count INT;
  v_dec_count INT;
  v_rr_missing INT;
  v_bad_batch INT;
BEGIN
  IF p_row.status NOT IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS') THEN
    RETURN;
  END IF;

  IF p_row.decision_coverage <> 1 THEN
    RAISE EXCEPTION 'mc_p1_run completion requires decision_coverage=1 (id=%)', p_row.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_row.unsupported_span_count <> 0 THEN
    RAISE EXCEPTION 'mc_p1_run completion requires unsupported_span_count=0 (id=%)', p_row.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_row.failed_batch_count <> 0 THEN
    RAISE EXCEPTION 'mc_p1_run completion requires failed_batch_count=0 (id=%)', p_row.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT organigrama.fn_mc_p1_warning_codes_allowed(p_row.warning_codes) THEN
    RAISE EXCEPTION 'mc_p1_run.warning_codes contains unknown code (id=%)', p_row.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_row.status = 'COMPLETED' AND jsonb_array_length(p_row.warning_codes) <> 0 THEN
    RAISE EXCEPTION 'COMPLETED requires empty warning_codes (id=%)', p_row.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_row.status = 'COMPLETED_WITH_WARNINGS' AND jsonb_array_length(p_row.warning_codes) = 0 THEN
    RAISE EXCEPTION 'COMPLETED_WITH_WARNINGS requires non-empty warning_codes (id=%)', p_row.id
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*) INTO v_cand_count
    FROM organigrama.mc_evidence_candidate c
   WHERE c.p1_run_id = p_row.id;
  SELECT COUNT(*) INTO v_dec_count
    FROM organigrama.mc_evidence_candidate_decision d
   WHERE d.p1_run_id = p_row.id;

  IF v_cand_count < 1 THEN
    RAISE EXCEPTION 'mc_p1_run satisfactory status requires >=1 candidate (id=%)', p_row.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_cand_count <> v_dec_count THEN
    RAISE EXCEPTION
      'mc_p1_run completion requires 1:1 candidate decisions (id=%, candidates=%, decisions=%)',
      p_row.id, v_cand_count, v_dec_count
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_row.candidate_count <> v_cand_count THEN
    RAISE EXCEPTION
      'mc_p1_run.candidate_count mismatch (id=%, column=%, actual=%)',
      p_row.id, p_row.candidate_count, v_cand_count
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*) INTO v_bad_batch
    FROM organigrama.mc_evidence_batch b
   WHERE b.p1_run_id = p_row.id
     AND b.status IS DISTINCT FROM 'SUCCEEDED';
  IF v_bad_batch > 0 THEN
    RAISE EXCEPTION
      'mc_p1_run completion requires all batches SUCCEEDED (id=%, bad=%)',
      p_row.id, v_bad_batch
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_cand_count > 0 AND NOT EXISTS (
    SELECT 1 FROM organigrama.mc_evidence_batch b
     WHERE b.p1_run_id = p_row.id AND b.status = 'SUCCEEDED'
  ) THEN
    RAISE EXCEPTION
      'mc_p1_run completion requires >=1 SUCCEEDED batch when candidates exist (id=%)',
      p_row.id
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*) INTO v_rr_missing
    FROM organigrama.mc_evidence_candidate_decision d
   WHERE d.p1_run_id = p_row.id
     AND d.decision = 'REVIEW_REQUIRED'
     AND NOT EXISTS (
       SELECT 1
       FROM organigrama.mc_evidence_review_item ri
       WHERE ri.p1_run_id = p_row.id
         AND ri.subject_type = 'CANDIDATE'
         AND ri.subject_id = d.candidate_id
         AND ri.queue_status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'WAIVED')
     );
  IF v_rr_missing > 0 THEN
    RAISE EXCEPTION
      'REVIEW_REQUIRED decisions require review_item (id=%, missing=%)',
      p_row.id, v_rr_missing
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION organigrama.fn_mc_p1_run_complete_guards()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (
      (OLD.status = 'PLANNED' AND NEW.status IN ('RUNNING', 'CANCELLED'))
      OR (OLD.status = 'RUNNING' AND NEW.status IN (
            'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'PARTIAL', 'FAILED', 'CANCELLED'
          ))
    ) THEN
      RAISE EXCEPTION 'mc_p1_run illegal status transition % -> % (id=%)',
        OLD.status, NEW.status, NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS') THEN
    -- INSERT directo satisfactorio siempre inválido (aún no hay hijos en la misma TX de fila)
    RAISE EXCEPTION
      'mc_p1_run cannot be inserted directly as % (id=%); use RUNNING then UPDATE',
      NEW.status, NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS') THEN
    PERFORM organigrama.fn_mc_p1_run_assert_satisfactory(NEW);
  END IF;

  IF NEW.warning_codes IS NOT NULL
     AND jsonb_array_length(NEW.warning_codes) > 0
     AND NOT organigrama.fn_mc_p1_warning_codes_allowed(NEW.warning_codes) THEN
    RAISE EXCEPTION 'mc_p1_run.warning_codes contains unknown code (id=%)', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mc_p1_run_complete_guards ON organigrama.mc_p1_run;
CREATE TRIGGER trg_mc_p1_run_complete_guards
  BEFORE INSERT OR UPDATE ON organigrama.mc_p1_run
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_p1_run_complete_guards();

CREATE OR REPLACE FUNCTION organigrama.fn_mc_p1_run_cursor_eligible()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
  v_snap BIGINT;
BEGIN
  SELECT r.status, r.snapshot_id INTO v_status, v_snap
    FROM organigrama.mc_p1_run r
   WHERE r.id = NEW.p1_run_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'mc_p1_run_cursor: run not found (%)', NEW.p1_run_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_snap <> NEW.snapshot_id THEN
    RAISE EXCEPTION 'mc_p1_run_cursor: snapshot_id mismatch for run %', NEW.p1_run_id
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_status NOT IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS') THEN
    RAISE EXCEPTION
      'mc_p1_run_cursor requires satisfactory run status (run=%, status=%)',
      NEW.p1_run_id, v_status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mc_p1_run_cursor_eligible
  BEFORE INSERT OR UPDATE OF p1_run_id, snapshot_id ON organigrama.mc_p1_run_cursor
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_p1_run_cursor_eligible();

CREATE OR REPLACE FUNCTION organigrama.fn_mc_evidence_child_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
  v_run UUID;
BEGIN
  v_run := COALESCE(OLD.p1_run_id, NEW.p1_run_id);
  SELECT status INTO v_status FROM organigrama.mc_p1_run WHERE id = v_run;
  IF organigrama.fn_mc_p1_run_is_terminal(v_status) THEN
    RAISE EXCEPTION
      '% is immutable after parent run terminal (run=%, status=%)',
      TG_TABLE_NAME, v_run, v_status
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mc_evidence_batch_immutable
  BEFORE UPDATE OR DELETE ON organigrama.mc_evidence_batch
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_evidence_child_immutable();

CREATE TRIGGER trg_mc_evidence_candidate_immutable
  BEFORE UPDATE OR DELETE ON organigrama.mc_evidence_candidate
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_evidence_child_immutable();

CREATE TRIGGER trg_mc_evidence_candidate_decision_immutable
  BEFORE UPDATE OR DELETE ON organigrama.mc_evidence_candidate_decision
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_evidence_child_immutable();

CREATE TRIGGER trg_mc_evidence_unit_immutable
  BEFORE UPDATE OR DELETE ON organigrama.mc_evidence_unit
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_evidence_child_immutable();

CREATE TRIGGER trg_mc_evidence_unit_candidate_link_immutable
  BEFORE UPDATE OR DELETE ON organigrama.mc_evidence_unit_candidate_link
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_evidence_child_immutable();

CREATE OR REPLACE FUNCTION organigrama.fn_mc_evidence_unit_insert_guards()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_run_snap BIGINT;
  v_run_status TEXT;
  v_decision TEXT;
BEGIN
  SELECT snapshot_id, status INTO v_run_snap, v_run_status
    FROM organigrama.mc_p1_run WHERE id = NEW.p1_run_id;

  IF v_run_snap IS NULL THEN
    RAISE EXCEPTION 'mc_evidence_unit: run not found';
  END IF;
  IF organigrama.fn_mc_p1_run_is_terminal(v_run_status) THEN
    RAISE EXCEPTION 'mc_evidence_unit: cannot insert into terminal run %', NEW.p1_run_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.snapshot_id <> v_run_snap THEN
    RAISE EXCEPTION 'mc_evidence_unit.snapshot_id must match run.snapshot_id'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT d.decision INTO v_decision
    FROM organigrama.mc_evidence_candidate_decision d
   WHERE d.p1_run_id = NEW.p1_run_id
     AND d.candidate_id = NEW.primary_candidate_id;

  IF v_decision IS NULL THEN
    RAISE EXCEPTION 'mc_evidence_unit requires decision for primary candidate'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_decision <> 'ACCEPTED' THEN
    RAISE EXCEPTION
      'mc_evidence_unit only allowed when primary candidate decision=ACCEPTED (got %)',
      v_decision
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mc_evidence_unit_insert_guards
  BEFORE INSERT ON organigrama.mc_evidence_unit
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_evidence_unit_insert_guards();

CREATE OR REPLACE FUNCTION organigrama.fn_mc_evidence_unit_candidate_link_guards()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_unit_run UUID;
  v_primary TEXT;
BEGIN
  SELECT u.p1_run_id, u.primary_candidate_id
    INTO v_unit_run, v_primary
    FROM organigrama.mc_evidence_unit u
   WHERE u.id = NEW.evidence_unit_id;

  IF v_unit_run IS NULL THEN
    RAISE EXCEPTION 'mc_evidence_unit_candidate_link: unit not found';
  END IF;
  IF NEW.p1_run_id <> v_unit_run THEN
    RAISE EXCEPTION 'mc_evidence_unit_candidate_link.p1_run_id must match unit run'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.candidate_id = v_primary THEN
    RAISE EXCEPTION 'secondary link cannot equal primary_candidate_id'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mc_evidence_unit_candidate_link_guards
  BEFORE INSERT OR UPDATE ON organigrama.mc_evidence_unit_candidate_link
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_evidence_unit_candidate_link_guards();

CREATE OR REPLACE FUNCTION organigrama.fn_mc_evidence_review_item_protect()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.p1_run_id IS DISTINCT FROM OLD.p1_run_id
       OR NEW.snapshot_id IS DISTINCT FROM OLD.snapshot_id
       OR NEW.subject_type IS DISTINCT FROM OLD.subject_type
       OR NEW.subject_id IS DISTINCT FROM OLD.subject_id
       OR NEW.trigger_code IS DISTINCT FROM OLD.trigger_code THEN
      RAISE EXCEPTION 'mc_evidence_review_item identity fields are immutable'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  -- Subject must belong to the same run (INSERT and resolution)
  IF NEW.subject_type = 'EVIDENCE_UNIT' THEN
    SELECT EXISTS (
      SELECT 1 FROM organigrama.mc_evidence_unit u
       WHERE u.id = NEW.subject_id::uuid AND u.p1_run_id = NEW.p1_run_id
    ) INTO v_ok;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM organigrama.mc_evidence_candidate c
       WHERE c.p1_run_id = NEW.p1_run_id AND c.candidate_id = NEW.subject_id
    ) INTO v_ok;
  END IF;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'mc_evidence_review_item subject does not belong to run %', NEW.p1_run_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mc_evidence_review_item_protect ON organigrama.mc_evidence_review_item;
CREATE TRIGGER trg_mc_evidence_review_item_protect
  BEFORE INSERT OR UPDATE ON organigrama.mc_evidence_review_item
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_evidence_review_item_protect();

-- Candidate snapshot must match run (insert guard)
CREATE OR REPLACE FUNCTION organigrama.fn_mc_evidence_candidate_insert_guards()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_run_snap BIGINT;
  v_run_status TEXT;
BEGIN
  SELECT snapshot_id, status INTO v_run_snap, v_run_status
    FROM organigrama.mc_p1_run WHERE id = NEW.p1_run_id;
  IF v_run_snap IS NULL THEN
    RAISE EXCEPTION 'mc_evidence_candidate: run not found';
  END IF;
  IF organigrama.fn_mc_p1_run_is_terminal(v_run_status) THEN
    RAISE EXCEPTION 'mc_evidence_candidate: cannot insert into terminal run'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.snapshot_id <> v_run_snap THEN
    RAISE EXCEPTION 'mc_evidence_candidate.snapshot_id must match run.snapshot_id'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mc_evidence_candidate_insert_guards
  BEFORE INSERT ON organigrama.mc_evidence_candidate
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_evidence_candidate_insert_guards();

CREATE OR REPLACE FUNCTION organigrama.fn_mc_evidence_decision_insert_guards()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_run_status TEXT;
BEGIN
  SELECT status INTO v_run_status FROM organigrama.mc_p1_run WHERE id = NEW.p1_run_id;
  IF v_run_status IS NULL THEN
    RAISE EXCEPTION 'mc_evidence_candidate_decision: run not found';
  END IF;
  IF organigrama.fn_mc_p1_run_is_terminal(v_run_status) THEN
    RAISE EXCEPTION 'mc_evidence_candidate_decision: cannot insert into terminal run'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mc_evidence_decision_insert_guards
  BEFORE INSERT ON organigrama.mc_evidence_candidate_decision
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_evidence_decision_insert_guards();

CREATE OR REPLACE FUNCTION organigrama.fn_mc_evidence_batch_insert_guards()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_run_status TEXT;
BEGIN
  SELECT status INTO v_run_status FROM organigrama.mc_p1_run WHERE id = NEW.p1_run_id;
  IF v_run_status IS NULL THEN
    RAISE EXCEPTION 'mc_evidence_batch: run not found';
  END IF;
  IF organigrama.fn_mc_p1_run_is_terminal(v_run_status) THEN
    RAISE EXCEPTION 'mc_evidence_batch: cannot insert into terminal run'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mc_evidence_batch_insert_guards
  BEFORE INSERT ON organigrama.mc_evidence_batch
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_evidence_batch_insert_guards();

-- ---------------------------------------------------------------------------
-- Vista canónica P2 (lineage DEFAULT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW organigrama.v_mc_p1_canonical_evidence_for_p2 AS
SELECT
  u.id AS evidence_unit_id,
  u.p1_run_id,
  u.snapshot_id,
  u.primary_candidate_id,
  u.page_number,
  u.start_offset,
  u.end_offset,
  u.span_text_hash,
  u.evidence_kind,
  u.explicitness,
  u.review_gate,
  u.content_fingerprint,
  c.lineage_key,
  r.status AS run_status
FROM organigrama.mc_p1_run_cursor c
JOIN organigrama.mc_p1_run r
  ON r.id = c.p1_run_id
JOIN organigrama.mc_evidence_unit u
  ON u.p1_run_id = r.id
JOIN organigrama.mc_evidence_candidate_decision d
  ON d.p1_run_id = u.p1_run_id
 AND d.candidate_id = u.primary_candidate_id
WHERE c.lineage_key = 'DEFAULT'
  AND r.status IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS')
  AND r.decision_coverage = 1
  AND r.unsupported_span_count = 0
  AND d.decision = 'ACCEPTED'
  AND (
    u.explicitness IN ('EXPLICIT', 'STRONGLY_SUPPORTED')
    OR (
      u.explicitness = 'INFERRED'
      AND EXISTS (
        SELECT 1
        FROM organigrama.mc_evidence_review_item ri
        WHERE ri.p1_run_id = u.p1_run_id
          AND ri.subject_type = 'EVIDENCE_UNIT'
          AND ri.subject_id = u.id::text
          AND ri.queue_status = 'RESOLVED'
          AND ri.resolution = 'APPROVED'
      )
    )
  )
  AND (
    u.review_gate = 'NOT_REQUIRED'
    OR EXISTS (
      SELECT 1
      FROM organigrama.mc_evidence_review_item ri
      WHERE ri.p1_run_id = u.p1_run_id
        AND (
          (ri.subject_type = 'EVIDENCE_UNIT' AND ri.subject_id = u.id::text)
          OR (ri.subject_type = 'CANDIDATE' AND ri.subject_id = u.primary_candidate_id)
        )
        AND ri.queue_status = 'RESOLVED'
        AND ri.resolution = 'APPROVED'
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM organigrama.mc_evidence_review_item ri
    WHERE ri.p1_run_id = u.p1_run_id
      AND (
        (ri.subject_type = 'EVIDENCE_UNIT' AND ri.subject_id = u.id::text)
        OR (ri.subject_type = 'CANDIDATE' AND ri.subject_id = u.primary_candidate_id)
      )
      AND ri.queue_status IN ('OPEN', 'IN_PROGRESS')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM organigrama.mc_evidence_review_item ri
    WHERE ri.p1_run_id = u.p1_run_id
      AND (
        (ri.subject_type = 'EVIDENCE_UNIT' AND ri.subject_id = u.id::text)
        OR (ri.subject_type = 'CANDIDATE' AND ri.subject_id = u.primary_candidate_id)
      )
      AND ri.queue_status = 'RESOLVED'
      AND ri.resolution = 'REJECTED'
  );

COMMENT ON VIEW organigrama.v_mc_p1_canonical_evidence_for_p2 IS
  'Entrada canónica P2: CURRENT DEFAULT + COMPLETED/COMPLETED_WITH_WARNINGS + '
  'coverage=1 + spans=0 + ACCEPTED + review efectivo aprobado. Sin texto CV.';

COMMIT;
