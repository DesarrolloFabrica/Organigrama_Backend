-- 040: Auditoría de descargas de los exportadores del organigrama activo
--      (GET /api/org-chart/export/html y /api/org-chart/export/directory).
--
-- PROPUESTA — NO EJECUTADA. Aplicar primero en QA; en producción solo con
-- aprobación explícita y antes de conceder ORG_DIRECTORY_EXPORT_HTML/XLS.
--
-- Sin esta tabla las descargas autorizadas fallan con 503: el backend no
-- entrega un archivo si no pudo registrar el evento SUCCESS (fail-closed).
--
-- Qué se guarda: quién (person_id), formato, versión, filas, cuándo y
-- resultado. Qué NO se guarda: contenido del informe, documentos, correos,
-- teléfonos ni ningún campo exportado. error_code es un código técnico corto.
--
-- No modifica tablas existentes salvo los comentarios de documentación de
-- core.person_permission. Idempotente.

CREATE TABLE IF NOT EXISTS organigrama.org_chart_directory_export_audit (
  id             BIGSERIAL    PRIMARY KEY,
  person_id      BIGINT       NOT NULL REFERENCES core.person(id),
  export_format  VARCHAR(4)   NOT NULL,
  version_id     BIGINT       NULL REFERENCES organigrama.org_chart_version(id),
  row_count      INTEGER      NULL,
  result         VARCHAR(10)  NOT NULL,
  error_code     VARCHAR(60)  NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_org_chart_directory_export_audit_format
    CHECK (export_format IN ('html', 'xls')),
  CONSTRAINT ck_org_chart_directory_export_audit_result
    CHECK (result IN ('SUCCESS', 'DENIED', 'ERROR')),
  CONSTRAINT ck_org_chart_directory_export_audit_rows
    CHECK (row_count IS NULL OR row_count >= 0),
  CONSTRAINT ck_org_chart_directory_export_audit_success
    CHECK (result <> 'SUCCESS' OR (version_id IS NOT NULL AND row_count IS NOT NULL)),
  CONSTRAINT ck_org_chart_directory_export_audit_error_code
    CHECK (error_code IS NULL OR error_code ~ '^[A-Z0-9_]{1,60}$')
);

CREATE INDEX IF NOT EXISTS idx_org_chart_directory_export_audit_person_created
  ON organigrama.org_chart_directory_export_audit (person_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_chart_directory_export_audit_created
  ON organigrama.org_chart_directory_export_audit (created_at DESC);

COMMENT ON TABLE organigrama.org_chart_directory_export_audit IS
  'Traza de descargas de los exportadores HTML/Excel del organigrama. Solo metadatos: nunca contenido del informe ni datos personales exportados.';

-- Documentación de los códigos (no cambia datos ni restricciones).
COMMENT ON TABLE core.person_permission IS
  'Permisos técnicos de aplicación por persona. No relacionados con la jerarquía visual del organigrama. Códigos: ORG_READ_ALL, ORG_ADMIN, ORG_CONTACT_READ_ALL, ORG_DIRECTORY_EXPORT_HTML, ORG_DIRECTORY_EXPORT_XLS.';

COMMENT ON COLUMN core.person_permission.permission_code IS
  'Código del permiso. ORG_READ_ALL: visibilidad total del organigrama. ORG_ADMIN: administración técnica. ORG_CONTACT_READ_ALL: teléfono de cualquier persona visible. ORG_DIRECTORY_EXPORT_HTML / ORG_DIRECTORY_EXPORT_XLS: descarga del informe HTML / Excel del organigrama activo (independientes de ORG_ADMIN; conceder con npm run org:grant-directory-export).';
