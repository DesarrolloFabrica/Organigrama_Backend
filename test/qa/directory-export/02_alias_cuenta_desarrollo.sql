-- QA — alias de ingreso de desarrollo (SOLO base QA desechable).
--
-- Permite entrar al frontend QA con el formulario de desarrollo (solo existe
-- en `vite dev`; el backend lo bloquea con NODE_ENV=production) usando
-- `desarrollofabrica@cun.edu.co` como identificador local.
--
-- Ese correo queda vinculado a una PERSONA FICTICIA (900199). No es la cuenta
-- real: no se copia ningún dato de producción y NO recibe ORG_ADMIN,
-- ORG_READ_ALL ni ningún permiso implícito. Los permisos de exportación se
-- conceden aparte con `org:grant-directory-export`, como a cualquier persona.
--
-- Requiere 01_seed_sintetico.sql. Idempotente.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM core.person
     WHERE coalesce(edu_email, '') NOT LIKE 'qa_sintetico_%@cun.edu.co'
       AND NOT (id = 900199 AND edu_email = 'desarrollofabrica@cun.edu.co')
  ) THEN
    RAISE EXCEPTION 'core.person contiene datos no sintéticos: este script solo corre en una base QA desechable.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM core.person WHERE id = 900100) THEN
    RAISE EXCEPTION 'Falta la planta sintética: ejecute primero 01_seed_sintetico.sql.';
  END IF;
END $$;

INSERT INTO core.person (
  id, area_id, role_id, full_name, edu_email, email, type_document, document,
  phone, address, gender, marital_status, born_date, born_city,
  emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
  is_active, created_at, updated_at
) VALUES (
  900199, 9001, 9103, 'Cuenta de Desarrollo QA (alias sintético)',
  'desarrollofabrica@cun.edu.co', 'personal.qa199@example.test', 'CC', '9000000199',
  '3000000199', 'Calle QA 199', 'M', 'Soltero', '1995-01-01', 'Ciudad QA',
  'Contacto QA 199', '3100000199', 'Familiar', true, now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organigrama.person_profile_state (person_id, profile_completed_at, profile_updated_by_user_at, created_at, updated_at)
VALUES (900199, now(), now(), now(), now())
ON CONFLICT (person_id) DO NOTHING;

-- Ubicación en la planta sintética: analista bajo la Directora QA.
INSERT INTO organigrama.org_visual_relation (parent_person_id, child_person_id, relation_type, visual_level, is_active, created_at, updated_at, version_id)
SELECT 900100, 900199, 'DIRECT', 1, true, now(), now(), 9201
 WHERE NOT EXISTS (
   SELECT 1 FROM organigrama.org_visual_relation
    WHERE version_id = 9201 AND child_person_id = 900199 AND is_active
 );

-- Garantía: el alias no hereda privilegios administrativos.
DELETE FROM core.person_permission
 WHERE person_id = 900199
   AND permission_code IN ('ORG_ADMIN', 'ORG_READ_ALL', 'ORG_CONTACT_READ_ALL');

COMMIT;
