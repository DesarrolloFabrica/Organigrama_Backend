-- QA de exportadores HTML / Excel — datos 100 % SINTÉTICOS.
--
-- Solo para una base PostgreSQL desechable (ver README.md de esta carpeta).
-- Se niega a correr si detecta datos reales: exige que core.person esté vacía
-- o que solo contenga personas sintéticas (prefijo qa_sintetico_).
--
-- Personas (todas ficticias, correo @cun.edu.co solo para pasar la validación
-- de cuenta institucional del dev-login):
--   1144   Raíz QA Sintética       raíz del mapa (el backend fija la raíz en
--                                  ORG_CHART_ROOT_PERSON_ID = '1144')
--   900100 Directora QA            ← 1144
--   900101 Coordinador QA Uno      ← 900100
--   900102 Coordinadora QA Dos     ← 900100
--   900103 Analista QA Uno         ← 900101
--   900104 Analista QA Dos         ← 900101
--   900105 Docente QA              ← 900102   (excluido por regla de docentes)
--   900106 Administrador QA        ← 900102   (tendrá ORG_ADMIN)
--   900107 Persona QA Inactiva     ← 900101   (is_active = false, excluida)
--   900108 Usuario QA Sin Permisos ← 900102

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM core.person
     WHERE coalesce(edu_email, '') NOT LIKE 'qa_sintetico_%@cun.edu.co'
       -- Única excepción: el alias de desarrollo de 02_alias_cuenta_desarrollo.sql
       -- (persona ficticia 900199).
       AND NOT (id = 900199 AND edu_email = 'desarrollofabrica@cun.edu.co')
  ) THEN
    RAISE EXCEPTION 'core.person contiene datos no sintéticos: este seed solo corre en una base QA desechable.';
  END IF;
END $$;

INSERT INTO core.area (id, code, name, is_active, created_at, updated_at) VALUES
  (9001, 'QA_DIR', 'DIRECCIÓN QA SINTÉTICA', true, now(), now()),
  (9002, 'QA_OPS', 'OPERACIONES QA SINTÉTICA', true, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.role (id, code, name, is_active, sort_order, created_at, updated_at) VALUES
  (9101, 'QA_DIRECTOR', 'DIRECTOR DE OPERACIONES', true, 1, now(), now()),
  (9102, 'QA_COORD', 'COORDINADOR', true, 2, now(), now()),
  (9103, 'QA_ANALISTA', 'ANALISTA', true, 3, now(), now()),
  (9104, 'QA_DOCENTE', 'DOCENTE', true, 4, now(), now()),
  (9105, 'QA_ADMIN', 'ADMINISTRADOR DE SISTEMAS', true, 5, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.person (
  id, area_id, role_id, full_name, edu_email, email, type_document, document,
  phone, address, gender, marital_status, born_date, born_city,
  emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
  is_active, created_at, updated_at
) VALUES
  (1144,   9001, 9101, 'Raíz QA Sintética',           'qa_sintetico_raiz@cun.edu.co',           'personal.qa1144@example.test', 'CC', '9000001144', '3000001144', 'Calle QA 1144', 'F', 'Soltera', '1970-01-01', 'Ciudad QA', 'Contacto QA 1144', '3100001144', 'Familiar', true,  now(), now()),
  (900100, 9001, 9101, 'Directora QA Sintética',      'qa_sintetico_directora@cun.edu.co',      'personal.qa100@example.test', 'CC', '9000000100', '3000000100', 'Calle QA 100', 'F', 'Soltera', '1980-01-01', 'Ciudad QA', 'Contacto QA 100', '3100000100', 'Familiar', true,  now(), now()),
  (900101, 9002, 9102, 'Coordinador QA Uno',          'qa_sintetico_coord1@cun.edu.co',         'personal.qa101@example.test', 'CC', '9000000101', '3000000101', 'Calle QA 101', 'M', 'Casado',  '1985-02-02', 'Ciudad QA', 'Contacto QA 101', '3100000101', 'Familiar', true,  now(), now()),
  (900102, 9002, 9102, 'Coordinadora QA Dos',         'qa_sintetico_coord2@cun.edu.co',         'personal.qa102@example.test', 'CC', '9000000102', '3000000102', 'Calle QA 102', 'F', 'Soltera', '1986-03-03', 'Ciudad QA', 'Contacto QA 102', '3100000102', 'Familiar', true,  now(), now()),
  (900103, 9002, 9103, 'Analista QA Uno',             'qa_sintetico_analista1@cun.edu.co',      'personal.qa103@example.test', 'CC', '9000000103', '3000000103', 'Calle QA 103', 'M', 'Soltero', '1990-04-04', 'Ciudad QA', 'Contacto QA 103', '3100000103', 'Familiar', true,  now(), now()),
  (900104, 9002, 9103, 'Analista QA Dos',             'qa_sintetico_analista2@cun.edu.co',      'personal.qa104@example.test', 'CC', '9000000104', '3000000104', 'Calle QA 104', 'F', 'Soltera', '1991-05-05', 'Ciudad QA', 'Contacto QA 104', '3100000104', 'Familiar', true,  now(), now()),
  (900105, 9002, 9104, 'Docente QA',                  'qa_sintetico_docente@cun.edu.co',        'personal.qa105@example.test', 'CC', '9000000105', '3000000105', 'Calle QA 105', 'M', 'Casado',  '1975-06-06', 'Ciudad QA', 'Contacto QA 105', '3100000105', 'Familiar', true,  now(), now()),
  (900106, 9001, 9105, 'Administrador QA',            'qa_sintetico_admin@cun.edu.co',          'personal.qa106@example.test', 'CC', '9000000106', '3000000106', 'Calle QA 106', 'M', 'Soltero', '1988-07-07', 'Ciudad QA', 'Contacto QA 106', '3100000106', 'Familiar', true,  now(), now()),
  (900107, 9002, 9103, 'Persona QA Inactiva',         'qa_sintetico_inactiva@cun.edu.co',       'personal.qa107@example.test', 'CC', '9000000107', '3000000107', 'Calle QA 107', 'F', 'Soltera', '1992-08-08', 'Ciudad QA', 'Contacto QA 107', '3100000107', 'Familiar', false, now(), now()),
  (900108, 9002, 9103, 'Usuario QA Sin Permisos',     'qa_sintetico_sinpermisos@cun.edu.co',    'personal.qa108@example.test', 'CC', '9000000108', '3000000108', 'Calle QA 108', 'M', 'Soltero', '1993-09-09', 'Ciudad QA', 'Contacto QA 108', '3100000108', 'Familiar', true,  now(), now())
ON CONFLICT (id) DO NOTHING;

-- Perfil completo (evita el onboarding al iniciar sesión en el frontend).
INSERT INTO organigrama.person_profile_state (person_id, profile_completed_at, profile_updated_by_user_at, created_at, updated_at)
SELECT id, now(), now(), now(), now() FROM core.person WHERE id = 1144 OR id BETWEEN 900100 AND 900108
ON CONFLICT (person_id) DO NOTHING;

-- Versión global vigente.
INSERT INTO organigrama.org_chart_version (id, code, name, description, is_active, is_locked, scope_type, created_at, updated_at)
VALUES (9201, 'qa-vigente', 'Versión QA Sintética', 'Solo QA', true, false, 'GLOBAL', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO organigrama.org_visual_relation (parent_person_id, child_person_id, relation_type, visual_level, is_active, created_at, updated_at, version_id) VALUES
  (1144,   900100, 'DIRECT', 0, true, now(), now(), 9201),
  (900100, 900101, 'DIRECT', 1, true, now(), now(), 9201),
  (900100, 900102, 'DIRECT', 1, true, now(), now(), 9201),
  (900101, 900103, 'DIRECT', 2, true, now(), now(), 9201),
  (900101, 900104, 'DIRECT', 2, true, now(), now(), 9201),
  (900102, 900105, 'DIRECT', 2, true, now(), now(), 9201),
  (900102, 900106, 'DIRECT', 2, true, now(), now(), 9201),
  (900101, 900107, 'DIRECT', 2, true, now(), now(), 9201),
  (900102, 900108, 'DIRECT', 2, true, now(), now(), 9201);

-- Rol técnico previo (no autoriza exportar): el administrador sintético.
INSERT INTO core.person_permission (person_id, permission_code)
VALUES (900106, 'ORG_ADMIN'), (900106, 'ORG_READ_ALL')
ON CONFLICT DO NOTHING;

COMMIT;
