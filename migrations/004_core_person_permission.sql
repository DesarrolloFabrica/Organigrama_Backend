-- Fase 4: tabla de permisos técnicos de aplicación (schema core).
-- No relacionada con la jerarquía visual de organigrama.org_visual_relation.
-- Ejecutar contra la misma BD que usa el backend antes de desplegar la versión
-- que incluye PersonPermissionService.
--
-- Para otorgar permisos de administrador técnico usar:
--   npm run org:grant-admin -- correo@cun.edu.co
-- O a través de la variable de entorno ORG_ADMIN_EMAILS (fallback de arranque).
-- NUNCA insertar al admin técnico en organigrama.org_visual_relation.

CREATE TABLE IF NOT EXISTS core.person_permission (
  person_id       BIGINT       NOT NULL REFERENCES core.person(id),
  permission_code VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (person_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_person_permission_person_id
  ON core.person_permission (person_id);

COMMENT ON TABLE core.person_permission IS
  'Permisos técnicos de aplicación por persona. No relacionados con la jerarquía visual del organigrama. Códigos válidos: ORG_READ_ALL, ORG_ADMIN.';

COMMENT ON COLUMN core.person_permission.permission_code IS
  'Código del permiso. ORG_READ_ALL: visibilidad total del organigrama. ORG_ADMIN: permiso de administración técnica.';
