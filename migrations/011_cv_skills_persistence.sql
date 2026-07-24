-- Fase D: persistencia versionada de skills extraídas de hojas de vida.
--
-- Schema: organigrama (overlay). No modifica core.person.
--
-- Migración ESTRICTA: ejecutar exactamente una vez.
--   psql ... -v ON_ERROR_STOP=1 -f migrations/011_cv_skills_persistence.sql
--
-- Esta migración ya incluye BEGIN/COMMIT. No combinar con psql --single-transaction.
-- No usa IF NOT EXISTS: si se re-ejecuta sobre un schema ya migrado, fallará a propósito.

BEGIN;

-- ─── Catálogo de skills normalizadas ──────────────────────────────────────────

CREATE TABLE organigrama.cv_skill (
  id                BIGSERIAL     PRIMARY KEY,
  normalized_name   VARCHAR(200)  NOT NULL,
  normalized_key    VARCHAR(220)  NOT NULL,
  skill_type        VARCHAR(40)   NOT NULL,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_cv_skill_key_type
    UNIQUE (normalized_key, skill_type),

  CONSTRAINT chk_cv_skill_type
    CHECK (skill_type IN (
      'TECHNOLOGY',
      'TOOL',
      'METHODOLOGY',
      'PROFESSIONAL_KNOWLEDGE',
      'LANGUAGE',
      'SOFT_SKILL',
      'OTHER'
    ))
);

COMMENT ON TABLE organigrama.cv_skill IS
  'Catálogo compartido de skills normalizadas. Unique (normalized_key, skill_type).';

COMMENT ON COLUMN organigrama.cv_skill.normalized_key IS
  'Clave estable (lower, sin acentos, espacios→_). Junto con skill_type identifica la skill.';

CREATE INDEX idx_cv_skill_type
  ON organigrama.cv_skill (skill_type);

CREATE INDEX idx_cv_skill_active
  ON organigrama.cv_skill (is_active)
  WHERE is_active = TRUE;

-- ─── Aliases del catálogo ─────────────────────────────────────────────────────

CREATE TABLE organigrama.cv_skill_alias (
  id           BIGSERIAL     PRIMARY KEY,
  skill_id     BIGINT        NOT NULL,
  alias_name   VARCHAR(200)  NOT NULL,
  alias_key    VARCHAR(220)  NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_skill_alias_skill
    FOREIGN KEY (skill_id)
    REFERENCES organigrama.cv_skill(id)
    ON DELETE CASCADE,

  -- Impide que el mismo alias apunte a dos skills. Un INSERT/UPDATE que intente
  -- reasignar alias_key a otro skill_id debe fallar (unique violation); la app
  -- no debe hacer UPDATE silencioso de skill_id sobre un alias existente.
  CONSTRAINT uq_cv_skill_alias_key
    UNIQUE (alias_key)
);

COMMENT ON TABLE organigrama.cv_skill_alias IS
  'Aliases inequívocos hacia una skill del catálogo. alias_key es globalmente único '
  'y no puede reasignarse a otro skill_id sin fallo de unicidad.';

CREATE INDEX idx_cv_skill_alias_skill
  ON organigrama.cv_skill_alias (skill_id);

-- ─── Ejecución de extracción ──────────────────────────────────────────────────
-- core.person.id = bigint (confirmado en Cloud). person_id usa el mismo tipo.

CREATE TABLE organigrama.cv_extraction (
  id                  BIGSERIAL     PRIMARY KEY,
  person_id           BIGINT        NOT NULL,
  person_cv_id        BIGINT        NOT NULL,
  document            VARCHAR(80)   NOT NULL,
  drive_file_id       VARCHAR(255)  NOT NULL,
  drive_file_name     VARCHAR(255)  NOT NULL,
  pdf_sha256          CHAR(64)      NOT NULL,
  pdf_byte_size       BIGINT        NOT NULL,
  model               VARCHAR(80)   NOT NULL,
  prompt_version      VARCHAR(64)   NOT NULL,
  extractor_version   VARCHAR(64)   NOT NULL,
  status              VARCHAR(20)   NOT NULL,
  is_active           BOOLEAN       NOT NULL DEFAULT FALSE,
  started_at          TIMESTAMPTZ   NOT NULL,
  finished_at         TIMESTAMPTZ   NULL,
  error_message       TEXT          NULL,
  warnings            JSONB         NOT NULL DEFAULT '[]'::jsonb,
  raw_result          JSONB         NULL,
  skills_count        INT           NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_extraction_person
    FOREIGN KEY (person_id)
    REFERENCES core.person(id)
    ON DELETE RESTRICT,

  -- FK formal a organigrama.person_cv(id) (PK bigint).
  -- ON DELETE RESTRICT: protege historial; no CASCADE. SET NULL se descartó
  -- porque ocultaría la pérdida del vínculo sin bloquear el DELETE.
  CONSTRAINT fk_cv_extraction_person_cv
    FOREIGN KEY (person_cv_id)
    REFERENCES organigrama.person_cv(id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_cv_extraction_status
    CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),

  CONSTRAINT chk_cv_extraction_active_succeeded
    CHECK (is_active = FALSE OR status = 'SUCCEEDED'),

  CONSTRAINT chk_cv_extraction_pdf_byte_size
    CHECK (pdf_byte_size > 0),

  -- PENDING/RUNNING: aún en curso → finished_at NULL.
  -- SUCCEEDED/FAILED: terminó → finished_at obligatorio.
  CONSTRAINT chk_cv_extraction_finished_at
    CHECK (
      (status IN ('PENDING', 'RUNNING') AND finished_at IS NULL)
      OR (status IN ('SUCCEEDED', 'FAILED') AND finished_at IS NOT NULL)
    ),

  CONSTRAINT chk_cv_extraction_skills_count
    CHECK (skills_count IS NULL OR skills_count >= 0),

  CONSTRAINT chk_cv_extraction_warnings_array
    CHECK (jsonb_typeof(warnings) = 'array'),

  CONSTRAINT chk_cv_extraction_time_order
    CHECK (finished_at IS NULL OR finished_at >= started_at)
);

COMMENT ON TABLE organigrama.cv_extraction IS
  'Ejecución de extracción de skills. Solo una SUCCEEDED activa por persona. '
  'Idempotencia: (person_id, pdf_sha256, model, prompt_version, extractor_version) '
  'para status=SUCCEEDED. Orden de activación (app): advisory lock → desactivar '
  'anterior → completar nueva → activar nueva → commit.';

COMMENT ON COLUMN organigrama.cv_extraction.raw_result IS
  'JSON de auditoría (ExtractedCvSkills + meta). No es la fuente de verdad consultable.';

COMMENT ON COLUMN organigrama.cv_extraction.extractor_version IS
  'Versión del pipeline de extracción (código), independiente del model name. NOT NULL.';

COMMENT ON COLUMN organigrama.cv_extraction.prompt_version IS
  'Versión del prompt de extracción, independiente del model name. NOT NULL.';

COMMENT ON COLUMN organigrama.cv_extraction.model IS
  'Identificador del modelo LLM usado. NOT NULL (parte de la clave de idempotencia).';

COMMENT ON COLUMN organigrama.cv_extraction.pdf_byte_size IS
  'Tamaño del PDF en bytes (BIGINT). Debe ser > 0.';

COMMENT ON COLUMN organigrama.cv_extraction.person_cv_id IS
  'FK NOT NULL a organigrama.person_cv(id). Toda extracción debe enlazar un CV.';

COMMENT ON COLUMN organigrama.cv_extraction.drive_file_name IS
  'Nombre del archivo PDF en Drive. NOT NULL.';

-- Una sola extracción activa por persona.
CREATE UNIQUE INDEX uq_cv_extraction_person_active
  ON organigrama.cv_extraction (person_id)
  WHERE is_active = TRUE;

-- Idempotencia: misma persona + PDF + modelo + prompt + extractor → un solo éxito.
-- Requiere model/prompt_version/extractor_version NOT NULL (declarados arriba).
CREATE UNIQUE INDEX uq_cv_extraction_idempotency
  ON organigrama.cv_extraction (
    person_id,
    pdf_sha256,
    model,
    prompt_version,
    extractor_version
  )
  WHERE status = 'SUCCEEDED';

-- Índice de FK person_id (también cubre búsquedas por persona).
CREATE INDEX idx_cv_extraction_person
  ON organigrama.cv_extraction (person_id);

CREATE INDEX idx_cv_extraction_person_started
  ON organigrama.cv_extraction (person_id, started_at DESC);

CREATE INDEX idx_cv_extraction_status
  ON organigrama.cv_extraction (status);

CREATE INDEX idx_cv_extraction_drive_file
  ON organigrama.cv_extraction (drive_file_id);

CREATE INDEX idx_cv_extraction_person_cv
  ON organigrama.cv_extraction (person_cv_id);

-- ─── Skills detectadas por extracción ─────────────────────────────────────────
-- Una sola fila por skill canónica dentro de una extracción.
-- Si el modelo emite la misma skill en varias categorías, la capa de persistencia
-- debe consolidar (elegir categoría/evidencia principal), no insertar duplicados.

CREATE TABLE organigrama.cv_extraction_skill (
  id              BIGSERIAL      PRIMARY KEY,
  extraction_id   BIGINT         NOT NULL,
  skill_id        BIGINT         NOT NULL,
  original_name   VARCHAR(200)   NOT NULL,
  category        VARCHAR(200)   NOT NULL,
  confidence      NUMERIC(4, 3)  NOT NULL,
  level           VARCHAR(80)    NULL,
  evidence        TEXT           NOT NULL,
  is_explicit     BOOLEAN        NOT NULL DEFAULT TRUE,
  sort_order      INT            NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_extraction_skill_extraction
    FOREIGN KEY (extraction_id)
    REFERENCES organigrama.cv_extraction(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_cv_extraction_skill_skill
    FOREIGN KEY (skill_id)
    REFERENCES organigrama.cv_skill(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_cv_extraction_skill_item
    UNIQUE (extraction_id, skill_id),

  CONSTRAINT chk_cv_extraction_skill_confidence
    CHECK (confidence >= 0 AND confidence <= 1),

  CONSTRAINT chk_cv_extraction_skill_explicit
    CHECK (is_explicit = TRUE),

  CONSTRAINT chk_cv_extraction_skill_sort_order
    CHECK (sort_order >= 0)
);

COMMENT ON TABLE organigrama.cv_extraction_skill IS
  'Skills detectadas en una extracción. Unique (extraction_id, skill_id): una fila '
  'por skill canónica. category/evidence son la clasificación principal consolidada. '
  'Solo skills explícitas (is_explicit = TRUE).';

CREATE INDEX idx_cv_extraction_skill_skill
  ON organigrama.cv_extraction_skill (skill_id);

CREATE INDEX idx_cv_extraction_skill_extraction
  ON organigrama.cv_extraction_skill (extraction_id);

-- ─── Idiomas por extracción ───────────────────────────────────────────────────

CREATE TABLE organigrama.cv_extraction_language (
  id              BIGSERIAL     PRIMARY KEY,
  extraction_id   BIGINT        NOT NULL,
  name            VARCHAR(120)  NOT NULL,
  name_key        VARCHAR(140)  NOT NULL,
  level           VARCHAR(80)   NULL,
  is_certified    BOOLEAN       NULL,
  evidence        TEXT          NOT NULL,
  sort_order      INT           NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_extraction_language_extraction
    FOREIGN KEY (extraction_id)
    REFERENCES organigrama.cv_extraction(id)
    ON DELETE CASCADE,

  CONSTRAINT uq_cv_extraction_language_item
    UNIQUE (extraction_id, name_key),

  CONSTRAINT chk_cv_extraction_language_sort_order
    CHECK (sort_order >= 0)
);

COMMENT ON TABLE organigrama.cv_extraction_language IS
  'Idiomas por extracción (nivel/certificación/evidencia). Separado del catálogo de skills.';

CREATE INDEX idx_cv_extraction_language_extraction
  ON organigrama.cv_extraction_language (extraction_id);

CREATE INDEX idx_cv_extraction_language_name_key
  ON organigrama.cv_extraction_language (name_key);

-- ─── Certificaciones por extracción ──────────────────────────────────────────

CREATE TABLE organigrama.cv_extraction_certification (
  id              BIGSERIAL     PRIMARY KEY,
  extraction_id   BIGINT        NOT NULL,
  name            VARCHAR(255)  NOT NULL,
  issuer          VARCHAR(255)  NULL,
  evidence        TEXT          NOT NULL,
  sort_order      INT           NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cv_extraction_certification_extraction
    FOREIGN KEY (extraction_id)
    REFERENCES organigrama.cv_extraction(id)
    ON DELETE CASCADE,

  CONSTRAINT chk_cv_extraction_certification_sort_order
    CHECK (sort_order >= 0)
);

COMMENT ON TABLE organigrama.cv_extraction_certification IS
  'Certificaciones por extracción (sin catálogo compartido en esta fase).';

CREATE INDEX idx_cv_extraction_certification_extraction
  ON organigrama.cv_extraction_certification (extraction_id);

COMMIT;
