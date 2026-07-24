-- Metadatos de ubicación y archivo Drive en organigrama.person_cv.
--
-- Extiende la tabla existente (hoy ~168 filas) con columnas NULLABLE
-- para no exigir valores en registros ya sincronizados.
--
-- Uso:
--   psql ... -v ON_ERROR_STOP=1 -f migrations/012_person_cv_drive_path_metadata.sql
--
-- Esta migración incluye BEGIN/COMMIT. No combinar con psql --single-transaction.

BEGIN;

ALTER TABLE organigrama.person_cv
  ADD COLUMN IF NOT EXISTS drive_parent_folder_id VARCHAR(255) NULL;

ALTER TABLE organigrama.person_cv
  ADD COLUMN IF NOT EXISTS drive_area_folder VARCHAR(255) NULL;

ALTER TABLE organigrama.person_cv
  ADD COLUMN IF NOT EXISTS drive_subarea_folder VARCHAR(255) NULL;

ALTER TABLE organigrama.person_cv
  ADD COLUMN IF NOT EXISTS drive_relative_path TEXT NULL;

ALTER TABLE organigrama.person_cv
  ADD COLUMN IF NOT EXISTS drive_modified_time TIMESTAMPTZ NULL;

ALTER TABLE organigrama.person_cv
  ADD COLUMN IF NOT EXISTS drive_md5_checksum VARCHAR(64) NULL;

ALTER TABLE organigrama.person_cv
  ADD COLUMN IF NOT EXISTS drive_file_size BIGINT NULL;

COMMENT ON COLUMN organigrama.person_cv.drive_parent_folder_id IS
  'ID de la carpeta de Drive que contiene directamente el PDF.';

COMMENT ON COLUMN organigrama.person_cv.drive_area_folder IS
  'Primer nivel de carpeta bajo la raíz configurada (área operativa de Drive).';

COMMENT ON COLUMN organigrama.person_cv.drive_subarea_folder IS
  'Segundo nivel bajo la raíz (p. ej. escuela en OPERACIONES ACADEMICAS), si existe.';

COMMENT ON COLUMN organigrama.person_cv.drive_relative_path IS
  'Ruta relativa desde la carpeta raíz hasta el PDF (incluye nombre de archivo).';

COMMENT ON COLUMN organigrama.person_cv.drive_modified_time IS
  'modifiedTime reportado por Google Drive (timestamptz).';

COMMENT ON COLUMN organigrama.person_cv.drive_md5_checksum IS
  'md5Checksum de Drive cuando está disponible (archivos binarios).';

COMMENT ON COLUMN organigrama.person_cv.drive_file_size IS
  'Tamaño en bytes reportado por Drive (campo size).';

CREATE INDEX IF NOT EXISTS ix_person_cv_drive_area_folder
  ON organigrama.person_cv (drive_area_folder);

CREATE INDEX IF NOT EXISTS ix_person_cv_drive_area_subarea
  ON organigrama.person_cv (drive_area_folder, drive_subarea_folder);

CREATE INDEX IF NOT EXISTS ix_person_cv_drive_relative_path
  ON organigrama.person_cv (drive_relative_path);

COMMIT;
