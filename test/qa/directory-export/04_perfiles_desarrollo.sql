-- QA — perfiles SINTÉTICOS de desarrollo para probar roles y permisos.
-- Requiere 01 (planta) y 03 (catálogos). Idempotente. Solo base QA.
--
--   900110 Usuario General QA          AUXILIAR ADMINISTRATIVO, sin permisos técnicos
--   900111 Exportador HTML QA          ANALISTA  (+ ORG_DIRECTORY_EXPORT_HTML vía script)
--   900112 Exportador Excel QA         ANALISTA  (+ ORG_DIRECTORY_EXPORT_XLS vía script)
--   900113 Exportador Ambos QA         COORDINADOR (+ ambos vía script)
--
-- Los permisos de exportación NO se insertan aquí: se conceden con
-- org:grant-directory-export (README), igual que en producción.
-- También registra videos de presentación ficticios (drive_file_id inventado):
-- la pestaña Presentación aparece, pero la reproducción no funciona en QA
-- porque no hay archivo real en Drive.

BEGIN;

DO $$
BEGIN
  IF current_setting('organigrama.environment', true) IS DISTINCT FROM 'qa' THEN
    RAISE EXCEPTION 'Base no marcada como QA (ejecute 00_marcar_base_qa.sql).';
  END IF;
END $$;

INSERT INTO core.role (id, code, name, is_active, sort_order, created_at, updated_at) VALUES
  (9106, 'QA_AUXILIAR', 'AUXILIAR ADMINISTRATIVO', true, 6, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.person (
  id, area_id, role_id, hierarchy_id, contract_type_id, city_id, region_id, campus_id, school_id, program_id,
  full_name, edu_email, email, type_document, document, phone, address, gender, marital_status,
  born_date, born_city, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
  is_active, created_at, updated_at
) VALUES
  (900110, 9002, 9106, 9303, 9601, 9401, 9411, 9421, 9501, 9511, 'Usuario General QA',  'qa_sintetico_general@cun.edu.co',        'personal.qa110@example.test', 'CC', '9000000110', '3000000110', 'Calle QA 110', 'F', 'Soltera', '1994-01-10', 'Ciudad QA', 'Contacto QA 110', '3100000110', 'Familiar', true, now(), now()),
  (900111, 9002, 9103, 9303, 9602, 9401, 9411, 9421, 9501, 9511, 'Exportador HTML QA',  'qa_sintetico_export_html@cun.edu.co',    'personal.qa111@example.test', 'CC', '9000000111', '3000000111', 'Calle QA 111', 'M', 'Soltero', '1993-02-11', 'Ciudad QA', 'Contacto QA 111', '3100000111', 'Familiar', true, now(), now()),
  (900112, 9002, 9103, 9303, 9601, 9401, 9411, 9421, 9501, 9511, 'Exportadora Excel QA', 'qa_sintetico_export_xls@cun.edu.co',    'personal.qa112@example.test', 'CC', '9000000112', '3000000112', 'Calle QA 112', 'F', 'Casada',  '1992-03-12', 'Ciudad QA', 'Contacto QA 112', '3100000112', 'Familiar', true, now(), now()),
  (900113, 9001, 9102, 9302, 9601, 9401, 9411, 9421, 9501, 9511, 'Exportador Ambos QA', 'qa_sintetico_export_ambos@cun.edu.co',   'personal.qa113@example.test', 'CC', '9000000113', '3000000113', 'Calle QA 113', 'M', 'Casado',  '1987-04-13', 'Ciudad QA', 'Contacto QA 113', '3100000113', 'Familiar', true, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO organigrama.person_profile_state (person_id, profile_completed_at, profile_updated_by_user_at, created_at, updated_at)
SELECT id, now(), now(), now(), now() FROM core.person WHERE id BETWEEN 900110 AND 900113
ON CONFLICT (person_id) DO NOTHING;

-- Ubicación en la planta sintética.
INSERT INTO organigrama.org_visual_relation (parent_person_id, child_person_id, relation_type, visual_level, is_active, created_at, updated_at, version_id)
SELECT v.parent, v.child, 'DIRECT', v.lvl, true, now(), now(), 9201
  FROM (VALUES (900102, 900110, 2), (900101, 900111, 2), (900101, 900112, 2), (900100, 900113, 1)) AS v(parent, child, lvl)
 WHERE NOT EXISTS (
   SELECT 1 FROM organigrama.org_visual_relation r
    WHERE r.version_id = 9201 AND r.child_person_id = v.child AND r.is_active
 );

-- Garantía: ninguno de estos perfiles trae permisos técnicos implícitos.
DELETE FROM core.person_permission
 WHERE person_id BETWEEN 900110 AND 900113
   AND permission_code IN ('ORG_ADMIN', 'ORG_READ_ALL', 'ORG_CONTACT_READ_ALL');

-- Videos de presentación ficticios (sin archivo real).
INSERT INTO organigrama.person_video (person_id, document, drive_file_id, drive_file_name, mime_type, drive_file_size, is_active, created_at, updated_at, synced_at)
SELECT p.id, p.document, 'qa-sintetico-video-' || p.id, 'presentacion-qa-' || p.id || '.mp4', 'video/mp4', 1048576, true, now(), now(), now()
  FROM core.person p
 WHERE p.id IN (900100, 900103, 900113)
   AND NOT EXISTS (SELECT 1 FROM organigrama.person_video v WHERE v.person_id = p.id AND v.is_active);

COMMIT;
