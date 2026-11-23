-- Intervención exportadores — PRE-VERIFICACIÓN (solo lectura).
-- Ejecutar con la sesión en solo lectura:
--   PGOPTIONS='-c default_transaction_read_only=on'
-- Resultado esperado (23-nov-2026): ver comentarios al final de cada consulta.

BEGIN READ ONLY;

-- Identidad: base core, PostgreSQL 18.x, IP de la instancia esperada.
SELECT current_database() AS base,
       host(inet_server_addr()) AS ip_servidor,
       split_part(version(), ' ', 2) AS version_pg,
       current_setting('transaction_read_only') AS solo_lectura;      -- core | 136.113.128.135 | 18.x | on

-- La 040 aún no está aplicada y no hay objetos con esos nombres.
SELECT to_regclass('organigrama.org_chart_directory_export_audit')       AS tabla,      -- NULL
       to_regclass('organigrama.idx_org_chart_directory_export_audit_person_created') AS idx1, -- NULL
       to_regclass('organigrama.idx_org_chart_directory_export_audit_created')        AS idx2, -- NULL
       (SELECT count(*) FROM pg_constraint
         WHERE conname LIKE 'ck_org_chart_directory_export_audit%') AS checks;        -- 0

-- Privilegios del usuario que aplicará la migración.
SELECT has_schema_privilege(current_user, 'organigrama', 'CREATE')                AS crear_en_organigrama, -- t
       has_table_privilege(current_user, 'core.person', 'REFERENCES')              AS fk_person,            -- t
       has_table_privilege(current_user, 'organigrama.org_chart_version', 'REFERENCES') AS fk_version,      -- t
       (SELECT pg_get_userbyid(relowner) = current_user
          FROM pg_class WHERE oid = 'core.person_permission'::regclass)            AS dueno_person_permission; -- t

-- Comentarios actuales de core.person_permission (la reversión los restaura).
SELECT obj_description('core.person_permission'::regclass, 'pg_class') AS comentario_tabla,   -- NULL
       col_description('core.person_permission'::regclass,
         (SELECT attnum FROM pg_attribute
           WHERE attrelid = 'core.person_permission'::regclass
             AND attname = 'permission_code'))                         AS comentario_columna; -- NULL

-- Permisos de exportación concedidos (debe ser 0 antes de empezar).
SELECT count(*) AS permisos_exportacion
  FROM core.person_permission
 WHERE permission_code IN ('ORG_DIRECTORY_EXPORT_HTML', 'ORG_DIRECTORY_EXPORT_XLS');  -- 0

-- Versión vigente que exportará el informe.
SELECT id, code, name FROM organigrama.org_chart_version
 WHERE is_active AND scope_type = 'GLOBAL';                            -- 4 | periodo-agosto-2026 | Versión actual

-- Actividad (elegir un momento de baja carga).
SELECT count(*) AS conexiones, count(*) FILTER (WHERE state = 'active') AS activas
  FROM pg_stat_activity WHERE datname = current_database();

ROLLBACK;
