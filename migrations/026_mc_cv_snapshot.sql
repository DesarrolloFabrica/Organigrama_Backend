-- FASE 4C — P0 CvSnapshot (artefacto documental inmutable).
-- Schema: organigrama. Independiente de cv_extraction.
-- Solo aplicar en MDE (127.0.0.1:5434 / organigrama_mde).
--
--   psql ... -v ON_ERROR_STOP=1 -f migrations/026_mc_cv_snapshot.sql
--
-- Rollback (solo MDE / desarrollo):
--   BEGIN;
--   DROP TRIGGER IF EXISTS trg_mc_cv_snapshot_immutable ON organigrama.mc_cv_snapshot;
--   DROP FUNCTION IF EXISTS organigrama.fn_mc_cv_snapshot_block_update();
--   DROP TABLE IF EXISTS organigrama.mc_cv_snapshot;
--   COMMIT;
--
-- Esta migración incluye BEGIN/COMMIT. No combinar con psql --single-transaction.

BEGIN;

CREATE TABLE organigrama.mc_cv_snapshot (
  id                      BIGSERIAL     PRIMARY KEY,
  person_id               BIGINT        NOT NULL,
  person_cv_id            BIGINT        NOT NULL,
  drive_file_id           TEXT          NOT NULL,
  drive_file_name         TEXT          NOT NULL,
  mime_type               TEXT          NOT NULL,
  source_hash             CHAR(64)      NOT NULL,
  source_size_bytes       BIGINT        NOT NULL,
  source_modified_time    TIMESTAMPTZ   NULL,
  raw_text                TEXT          NULL,
  normalized_text         TEXT          NULL,
  normalized_text_hash    CHAR(64)      NULL,
  page_count              INT           NOT NULL DEFAULT 0,
  pages                   JSONB         NOT NULL DEFAULT '[]'::jsonb,
  sectioned_content       JSONB         NOT NULL DEFAULT '{}'::jsonb,
  extractor_name          TEXT          NOT NULL,
  extractor_version       TEXT          NOT NULL,
  normalizer_name         TEXT          NOT NULL,
  normalizer_version      TEXT          NOT NULL,
  parse_status            TEXT          NOT NULL,
  parse_warnings          JSONB         NOT NULL DEFAULT '[]'::jsonb,
  parse_error_code        TEXT          NULL,
  parse_error_detail_safe TEXT          NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mc_cv_snapshot_person
    FOREIGN KEY (person_id)
    REFERENCES core.person(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_mc_cv_snapshot_person_cv
    FOREIGN KEY (person_cv_id)
    REFERENCES organigrama.person_cv(id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_mc_cv_snapshot_source_size_nonneg
    CHECK (source_size_bytes >= 0),

  CONSTRAINT chk_mc_cv_snapshot_page_count_nonneg
    CHECK (page_count >= 0),

  CONSTRAINT chk_mc_cv_snapshot_source_hash
    CHECK (source_hash ~ '^[a-f0-9]{64}$'),

  CONSTRAINT chk_mc_cv_snapshot_norm_hash
    CHECK (
      normalized_text_hash IS NULL
      OR normalized_text_hash ~ '^[a-f0-9]{64}$'
    ),

  CONSTRAINT chk_mc_cv_snapshot_parse_status
    CHECK (parse_status IN (
      'PARSED',
      'PARTIAL',
      'EMPTY_DOCUMENT',
      'SCANNED_OR_IMAGE_ONLY',
      'UNSUPPORTED_FORMAT',
      'FAILED'
    )),

  CONSTRAINT chk_mc_cv_snapshot_text_by_status
    CHECK (
      (
        parse_status IN ('PARSED', 'PARTIAL')
        AND raw_text IS NOT NULL
        AND normalized_text IS NOT NULL
        AND normalized_text_hash IS NOT NULL
      )
      OR
      (
        parse_status IN (
          'EMPTY_DOCUMENT',
          'SCANNED_OR_IMAGE_ONLY',
          'UNSUPPORTED_FORMAT',
          'FAILED'
        )
      )
    )
);

CREATE UNIQUE INDEX uq_mc_cv_snapshot_idempotency
  ON organigrama.mc_cv_snapshot (
    person_cv_id,
    source_hash,
    extractor_version,
    normalizer_version
  );

CREATE INDEX ix_mc_cv_snapshot_person_id
  ON organigrama.mc_cv_snapshot (person_id);

CREATE INDEX ix_mc_cv_snapshot_person_cv_id
  ON organigrama.mc_cv_snapshot (person_cv_id);

CREATE INDEX ix_mc_cv_snapshot_source_hash
  ON organigrama.mc_cv_snapshot (source_hash);

CREATE INDEX ix_mc_cv_snapshot_created_at
  ON organigrama.mc_cv_snapshot (created_at DESC);

CREATE INDEX ix_mc_cv_snapshot_parse_status
  ON organigrama.mc_cv_snapshot (parse_status);

COMMENT ON TABLE organigrama.mc_cv_snapshot IS
  'P0 CvSnapshot inmutable (MC1.P0.SNAPSHOT 1.1.0). Artefacto documental; '
  'no es ejecución de pipeline ni campaña. PII CONFIDENTIAL. Sin IA. '
  'No publicar. Independiente de cv_extraction. Solo MDE en primera implementación.';

COMMENT ON COLUMN organigrama.mc_cv_snapshot.source_hash IS
  'SHA-256 hex del binario fuente (sourceHash). Parte de la clave de idempotencia.';

COMMENT ON COLUMN organigrama.mc_cv_snapshot.raw_text IS
  'Texto crudo extraído localmente. PII. No exponer en API/logs.';

COMMENT ON COLUMN organigrama.mc_cv_snapshot.normalized_text IS
  'Texto normalizado determinístico. PII. Entrada futura a P1.';

COMMENT ON COLUMN organigrama.mc_cv_snapshot.extractor_version IS
  'Versión del adapter extractor. Parte de idempotencia junto a normalizer_version.';

COMMENT ON COLUMN organigrama.mc_cv_snapshot.normalizer_version IS
  'Versión del normalizador. Parte de la clave de idempotencia (contrato 1.1.0).';

-- Inmutabilidad: bloquear cualquier UPDATE (el snapshot no se corrige in-place).
CREATE OR REPLACE FUNCTION organigrama.fn_mc_cv_snapshot_block_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mc_cv_snapshot is immutable: UPDATE is not allowed (id=%)', OLD.id
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER trg_mc_cv_snapshot_immutable
  BEFORE UPDATE ON organigrama.mc_cv_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION organigrama.fn_mc_cv_snapshot_block_update();

COMMENT ON FUNCTION organigrama.fn_mc_cv_snapshot_block_update() IS
  'Bloquea UPDATE sobre mc_cv_snapshot. Correcciones = nuevo INSERT. DELETE solo ops/rollback.';

COMMIT;
