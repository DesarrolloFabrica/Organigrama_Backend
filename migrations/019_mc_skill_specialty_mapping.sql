-- MC1.3.2: Clasificación de skills por dominio + mapping skill → especialidad.
--
-- Schema: organigrama. Aditiva sobre 018_mc_competency_catalog.
-- No modifica PA1, Extractor, Enrichment ni Evidence Engine.
--
-- Identidad de skill: organigrama.cv_skill(id) (canónica).
--
-- Uso:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/019_mc_skill_specialty_mapping.sql

BEGIN;

-- ─── Clasificación skill × dominio (por versión de catálogo) ─────────────────

CREATE TABLE organigrama.mc_skill_domain_classification (
  id                  BIGSERIAL     PRIMARY KEY,
  catalog_version_id  BIGINT        NOT NULL,
  domain_id           BIGINT        NOT NULL,
  skill_id            BIGINT        NOT NULL,
  classification      VARCHAR(40)   NOT NULL,
  rationale           TEXT          NULL,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mc_skill_domain_class_catalog
    FOREIGN KEY (catalog_version_id)
    REFERENCES organigrama.mc_catalog_version(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_mc_skill_domain_class_domain
    FOREIGN KEY (domain_id)
    REFERENCES organigrama.mc_domain(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_mc_skill_domain_class_skill
    FOREIGN KEY (skill_id)
    REFERENCES organigrama.cv_skill(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_mc_skill_domain_classification
    UNIQUE (catalog_version_id, domain_id, skill_id),

  CONSTRAINT chk_mc_skill_domain_classification
    CHECK (classification IN (
      'DOMAIN_SPECIALTY',
      'TRANSVERSAL_FUTURE',
      'OUTSIDE_SOFTWARE_DOMAIN',
      'AMBIGUOUS',
      'CATALOG_GAP'
    ))
);

COMMENT ON TABLE organigrama.mc_skill_domain_classification IS
  'Clasificación de una skill canónica (cv_skill.id) respecto a un dominio MC1, '
  'versionada con el catálogo. Independiente de person/extracción. '
  'Solo DOMAIN_SPECIALTY puede tener mappings activos a especialidades.';

CREATE INDEX idx_mc_skill_domain_class_catalog
  ON organigrama.mc_skill_domain_classification (catalog_version_id);

CREATE INDEX idx_mc_skill_domain_class_domain
  ON organigrama.mc_skill_domain_classification (domain_id);

CREATE INDEX idx_mc_skill_domain_class_skill
  ON organigrama.mc_skill_domain_classification (skill_id);

CREATE INDEX idx_mc_skill_domain_class_status
  ON organigrama.mc_skill_domain_classification (classification);

-- ─── Mapping skill → especialidad ────────────────────────────────────────────

CREATE TABLE organigrama.mc_skill_specialty_mapping (
  id                  BIGSERIAL     PRIMARY KEY,
  catalog_version_id  BIGINT        NOT NULL,
  skill_id            BIGINT        NOT NULL,
  specialty_id        BIGINT        NOT NULL,
  weight              NUMERIC(4,3)  NOT NULL,
  mapping_type        VARCHAR(20)   NOT NULL,
  rationale           TEXT          NULL,
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mc_skill_specialty_map_catalog
    FOREIGN KEY (catalog_version_id)
    REFERENCES organigrama.mc_catalog_version(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_mc_skill_specialty_map_skill
    FOREIGN KEY (skill_id)
    REFERENCES organigrama.cv_skill(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_mc_skill_specialty_map_specialty
    FOREIGN KEY (specialty_id)
    REFERENCES organigrama.mc_specialty(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_mc_skill_specialty_mapping
    UNIQUE (catalog_version_id, skill_id, specialty_id),

  CONSTRAINT chk_mc_skill_specialty_map_weight
    CHECK (weight > 0 AND weight <= 1),

  CONSTRAINT chk_mc_skill_specialty_map_type
    CHECK (mapping_type IN ('PRIMARY', 'SECONDARY'))
);

COMMENT ON TABLE organigrama.mc_skill_specialty_mapping IS
  'Mapping versionado skill canónica → especialidad MC1 con peso. '
  'No depende de person_id ni extraction_id. '
  'Suma de weights activos por skill en una versión <= 1 (validado en servicio).';

CREATE INDEX idx_mc_skill_specialty_map_catalog
  ON organigrama.mc_skill_specialty_mapping (catalog_version_id);

CREATE INDEX idx_mc_skill_specialty_map_skill
  ON organigrama.mc_skill_specialty_mapping (skill_id);

CREATE INDEX idx_mc_skill_specialty_map_specialty
  ON organigrama.mc_skill_specialty_mapping (specialty_id);

COMMIT;
