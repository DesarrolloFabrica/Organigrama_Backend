-- Prerrequisitos mínimos para bootstrap MC1 local (no productivo).
-- Crea schemas y stubs de core.person / organigrama.person_cv
-- antes de aplicar migraciones 011+.

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS organigrama;

CREATE TABLE IF NOT EXISTS core.person (
  id          BIGSERIAL PRIMARY KEY,
  document    VARCHAR(40) NULL,
  full_name   VARCHAR(200) NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organigrama.person_cv (
  id                      BIGSERIAL PRIMARY KEY,
  person_id               BIGINT NOT NULL REFERENCES core.person(id),
  document                VARCHAR(80) NOT NULL,
  drive_file_id           VARCHAR(255) NULL,
  drive_file_name         VARCHAR(255) NULL,
  drive_web_url           TEXT NULL,
  mime_type               VARCHAR(120) NULL,
  is_active               BOOLEAN NOT NULL DEFAULT FALSE,
  synced_at               TIMESTAMPTZ NULL,
  drive_parent_folder_id  VARCHAR(255) NULL,
  drive_area_folder       VARCHAR(255) NULL,
  drive_subarea_folder    VARCHAR(255) NULL,
  drive_relative_path     TEXT NULL,
  drive_modified_time     TIMESTAMPTZ NULL,
  drive_md5_checksum      VARCHAR(64) NULL,
  drive_file_size         BIGINT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
