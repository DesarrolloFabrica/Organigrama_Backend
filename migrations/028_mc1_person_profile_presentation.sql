-- FASE deploy B — Persistencia mínima de presentación MC1 (Profile Assembly ya gateado).
-- Schema: organigrama. Productiva (Cloud SQL core / cualquier Postgres app).
-- No altera P0–P4, catálogo, mapper, routing ni Publication Gate.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/028_mc1_person_profile_presentation.sql
--
-- Ejemplo Cloud (SSL):
--   $env:PGPASSWORD='…'
--   psql "host=136.113.128.135 port=5432 dbname=core user=user-core sslmode=require" `
--     -v ON_ERROR_STOP=1 -f migrations/028_mc1_person_profile_presentation.sql
--
-- Rollback (solo si no hay datos productivos a conservar):
--   BEGIN;
--   DROP TABLE IF EXISTS organigrama.mc1_person_profile_presentation;
--   COMMIT;
--
-- Esta migración incluye BEGIN/COMMIT. No combinar con psql --single-transaction.

BEGIN;

CREATE TABLE organigrama.mc1_person_profile_presentation (
  id                   BIGSERIAL     PRIMARY KEY,
  person_id            BIGINT        NOT NULL,
  payload_json         JSONB         NOT NULL,
  config_fingerprint   TEXT          NOT NULL,
  produced_at          TIMESTAMPTZ   NOT NULL,
  is_active            BOOLEAN       NOT NULL DEFAULT TRUE,
  imported_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_mc1_person_profile_presentation_person
    FOREIGN KEY (person_id)
    REFERENCES core.person(id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_mc1_ppp_fingerprint_nonempty
    CHECK (length(trim(config_fingerprint)) > 0),

  CONSTRAINT chk_mc1_ppp_payload_object
    CHECK (jsonb_typeof(payload_json) = 'object')
);

COMMENT ON TABLE organigrama.mc1_person_profile_presentation IS
  'Presentación MC1 (mc1Profile) precomputada y gateada. '
  'Una fila activa por person_id. Historial inactivo permitido. '
  'No almacena packs P0–P4 ni evidencia cruda.';

COMMENT ON COLUMN organigrama.mc1_person_profile_presentation.person_id IS
  'FK a core.person(id).';

COMMENT ON COLUMN organigrama.mc1_person_profile_presentation.payload_json IS
  'DTO Mc1PersonCompetenciesPresentationDto (status AVAILABLE + fields).';

COMMENT ON COLUMN organigrama.mc1_person_profile_presentation.config_fingerprint IS
  'Fingerprint de la config de ensamblaje (p.ej. 12J) usada para generar el payload.';

COMMENT ON COLUMN organigrama.mc1_person_profile_presentation.produced_at IS
  'Timestamp de producción del profile (no del import).';

COMMENT ON COLUMN organigrama.mc1_person_profile_presentation.is_active IS
  'Solo un registro activo por person_id (índice único parcial).';

COMMENT ON COLUMN organigrama.mc1_person_profile_presentation.imported_at IS
  'Momento del upsert/import en esta tabla.';

-- Una presentación activa por persona.
CREATE UNIQUE INDEX uq_mc1_ppp_active_person
  ON organigrama.mc1_person_profile_presentation (person_id)
  WHERE is_active = TRUE;

CREATE INDEX ix_mc1_ppp_person_active
  ON organigrama.mc1_person_profile_presentation (person_id, is_active);

CREATE INDEX ix_mc1_ppp_fingerprint
  ON organigrama.mc1_person_profile_presentation (config_fingerprint);

COMMIT;
