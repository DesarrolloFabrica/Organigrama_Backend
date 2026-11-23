-- Videos de presentación por persona (Organigrama OP).
--
-- Aditiva. No altera core.person, person_cv ni tablas MC1.
-- No almacena binario, URLs públicas, tickets ni metadatos de jerarquía.
--
-- Estado: creada en repositorio. NO aplicar hasta disponer de entorno local
-- representativo (ver docs/person-profile-video-persistence.md).
--
-- Uso (cuando se autorice):
--   psql ... -v ON_ERROR_STOP=1 -f migrations/025_person_video.sql
--
-- Rollback (manual, solo si no hay datos productivos):
--   BEGIN;
--   DROP TABLE IF EXISTS organigrama.person_video;
--   COMMIT;
--
-- Esta migración incluye BEGIN/COMMIT. No combinar con psql --single-transaction.

BEGIN;

CREATE TABLE organigrama.person_video (
  id                      BIGSERIAL     PRIMARY KEY,
  person_id               BIGINT        NOT NULL,
  document                VARCHAR(80)   NOT NULL,
  drive_file_id           VARCHAR(255)  NOT NULL,
  drive_file_name         VARCHAR(255)  NOT NULL,
  mime_type               VARCHAR(120)  NOT NULL,
  drive_modified_time     TIMESTAMPTZ   NULL,
  drive_md5_checksum      VARCHAR(64)   NULL,
  drive_file_size         BIGINT        NULL,
  drive_parent_folder_id  VARCHAR(255)  NULL,
  drive_relative_path     TEXT          NULL,
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  synced_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_person_video_person
    FOREIGN KEY (person_id)
    REFERENCES core.person(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_person_video_drive_file_id
    UNIQUE (drive_file_id),

  CONSTRAINT chk_person_video_document_nonempty
    CHECK (length(trim(document)) > 0),

  CONSTRAINT chk_person_video_drive_file_id_nonempty
    CHECK (length(trim(drive_file_id)) > 0),

  CONSTRAINT chk_person_video_drive_file_name_nonempty
    CHECK (length(trim(drive_file_name)) > 0),

  CONSTRAINT chk_person_video_mime_type_nonempty
    CHECK (length(trim(mime_type)) > 0),

  CONSTRAINT chk_person_video_drive_file_size_nonneg
    CHECK (drive_file_size IS NULL OR drive_file_size >= 0)
);

COMMENT ON TABLE organigrama.person_video IS
  'Video de presentación asociado a una persona por documento (match Drive). '
  'Historial: varios registros; solo uno activo por person_id. '
  'Sin binario ni URL pública; streaming futuro vía backend.';

COMMENT ON COLUMN organigrama.person_video.person_id IS
  'FK a core.person(id). ON DELETE RESTRICT para preservar historial.';

COMMENT ON COLUMN organigrama.person_video.document IS
  'Documento usado en el match del nombre de archivo. Alineado a core.person.document (VARCHAR 80). '
  'No exponer en API pública de reproducción.';

COMMENT ON COLUMN organigrama.person_video.drive_file_id IS
  'Identidad única del archivo en Google Drive. No exponer al frontend.';

COMMENT ON COLUMN organigrama.person_video.drive_file_name IS
  'Nombre original del archivo en Drive (diagnóstico / sync).';

COMMENT ON COLUMN organigrama.person_video.mime_type IS
  'MIME reportado por Drive (p. ej. video/mp4). Política de formatos en planner, no CHECK de MIME.';

COMMENT ON COLUMN organigrama.person_video.drive_md5_checksum IS
  'md5Checksum de Drive cuando está disponible (archivos binarios).';

COMMENT ON COLUMN organigrama.person_video.drive_relative_path IS
  'Ruta relativa desde la carpeta raíz de videos hasta el archivo (diagnóstico).';

COMMENT ON COLUMN organigrama.person_video.is_active IS
  'Solo un registro activo por person_id (índice único parcial).';

COMMENT ON COLUMN organigrama.person_video.updated_at IS
  'DEFAULT NOW() al insertar. Writers futuros deben actualizarlo explícitamente (sin trigger).';

COMMENT ON COLUMN organigrama.person_video.synced_at IS
  'Última sincronización confirmada del inventario/apply.';

-- Un solo video activo por persona (historial inactivo permitido).
CREATE UNIQUE INDEX uq_person_video_active_person
  ON organigrama.person_video (person_id)
  WHERE is_active = TRUE;

CREATE INDEX ix_person_video_document
  ON organigrama.person_video (document);

CREATE INDEX ix_person_video_person_active
  ON organigrama.person_video (person_id, is_active);

COMMIT;
