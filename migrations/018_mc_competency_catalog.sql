-- MC1.3.1: Catálogo de dominios y especialidades (Modelo de Competencias).
--
-- Schema: organigrama. Aditiva: no modifica PA1, Extractor, Enrichment,
-- Evidence Engine ni ninguna tabla cv_* previa.
--
-- Uso:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/018_mc_competency_catalog.sql
--
-- Esta migración incluye BEGIN/COMMIT. No combinar con psql --single-transaction.

BEGIN;

-- ─── Versión del catálogo MC1 ─────────────────────────────────────────────────

CREATE TABLE organigrama.mc_catalog_version (
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

  CONSTRAINT uq_mc_catalog_version_code_version
    UNIQUE (code, version),

  CONSTRAINT chk_mc_catalog_version_status
    CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),

  CONSTRAINT chk_mc_catalog_version_active_status
    CHECK (is_active = FALSE OR status = 'ACTIVE')
);

COMMENT ON TABLE organigrama.mc_catalog_version IS
  'Versión del catálogo MC1 (áreas/dominios + especialidades). '
  'Independiente de cv_attribute_catalog_version (PA1). '
  'Solo una versión activa por code (índice parcial).';

CREATE UNIQUE INDEX uq_mc_catalog_version_active
  ON organigrama.mc_catalog_version (code)
  WHERE is_active = TRUE;

CREATE INDEX idx_mc_catalog_version_status
  ON organigrama.mc_catalog_version (status);

-- ─── Dominio / Área de experiencia ───────────────────────────────────────────

CREATE TABLE organigrama.mc_domain (
  id                  BIGSERIAL     PRIMARY KEY,
  catalog_version_id  BIGINT        NOT NULL,
  code                VARCHAR(80)   NOT NULL,
  name                VARCHAR(200)  NOT NULL,
  description         TEXT          NULL,
  sort_order          INT           NOT NULL DEFAULT 0,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mc_domain_catalog
    FOREIGN KEY (catalog_version_id)
    REFERENCES organigrama.mc_catalog_version(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_mc_domain_code
    UNIQUE (catalog_version_id, code)
);

COMMENT ON TABLE organigrama.mc_domain IS
  'Área de experiencia del Modelo de Competencias (MC1). '
  'code es identificador canónico estable (p. ej. SOFTWARE). '
  'El nombre visible puede cambiar sin alterar code.';

COMMENT ON COLUMN organigrama.mc_domain.code IS
  'Identificador canónico permanente del área (nunca el nombre visible).';

CREATE INDEX idx_mc_domain_catalog
  ON organigrama.mc_domain (catalog_version_id);

-- ─── Especialidad ────────────────────────────────────────────────────────────

CREATE TABLE organigrama.mc_specialty (
  id                  BIGSERIAL     PRIMARY KEY,
  catalog_version_id  BIGINT        NOT NULL,
  domain_id           BIGINT        NOT NULL,
  code                VARCHAR(80)   NOT NULL,
  name                VARCHAR(200)  NOT NULL,
  purpose             TEXT          NOT NULL,
  description         TEXT          NOT NULL,
  lifecycle_status    VARCHAR(20)   NOT NULL,
  sort_order          INT           NOT NULL DEFAULT 0,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mc_specialty_catalog
    FOREIGN KEY (catalog_version_id)
    REFERENCES organigrama.mc_catalog_version(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_mc_specialty_domain
    FOREIGN KEY (domain_id)
    REFERENCES organigrama.mc_domain(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_mc_specialty_code
    UNIQUE (catalog_version_id, code),

  -- Ciclo de vida de catálogo (MC1.3.2). EMERGENT NO pertenece aquí;
  -- la presentación por perfil (ACTIVE|EMERGENT|HIDDEN) es resultado PA2.
  CONSTRAINT chk_mc_specialty_lifecycle_status
    CHECK (lifecycle_status IN ('ACTIVE', 'EXPERIMENTAL', 'INACTIVE'))
);

COMMENT ON TABLE organigrama.mc_specialty IS
  'Especialidad oficial de un dominio MC1. code canónico estable. '
  'lifecycle_status = ciclo de vida del catálogo (ACTIVE|EXPERIMENTAL|INACTIVE). '
  'La presentación por perfil (ACTIVE|EMERGENT|HIDDEN) NO se almacena aquí.';

COMMENT ON COLUMN organigrama.mc_specialty.code IS
  'Identificador canónico permanente (p. ej. SOFTWARE_FRONTEND).';

COMMENT ON COLUMN organigrama.mc_specialty.lifecycle_status IS
  'Ciclo de vida de catálogo: ACTIVE (oficial), EXPERIMENTAL (candidato), '
  'INACTIVE (retirado). No confundir con presentación por perfil.';

CREATE INDEX idx_mc_specialty_catalog
  ON organigrama.mc_specialty (catalog_version_id);

CREATE INDEX idx_mc_specialty_domain
  ON organigrama.mc_specialty (domain_id);

CREATE INDEX idx_mc_specialty_lifecycle_status
  ON organigrama.mc_specialty (lifecycle_status);

COMMIT;
