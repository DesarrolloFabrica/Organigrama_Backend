-- QA de exportadores — casos de relaciones (datos 100 % SINTÉTICOS).
--
-- Reproduce en QA las situaciones que el exportador debe representar igual
-- que el mapa, sin tocar producción. Idempotente. Solo base marcada como QA.
--
--   900120 Analista QA Dos Jefes      ← 900101 y ← 900102   (dos jefes efectivos;
--                                      override de cargo por arista solo en la de
--                                      900102 → cargos distintos por ubicación)
--   900121 Jefa QA Retirada           ← 900100   (is_active = false)
--   900122 Analista QA Jefe Inactivo  ← 900121   (activa; jefe inactivo)
--   900125 Auxiliar QA Equipo Huérfano← 900122   (equipo de quien tiene jefe inactivo)
--   900123 Persona QA Por Posición    hijo por POSICIÓN de la arista 900101 → 900103
--                                      (cuelga de quien ocupa la posición: 900103)
--   900124 Colaborador QA Overlay     ← 900104 solo en el overlay 9202
--
-- Overlay de coordinación 9202 (activo, raíz 900104, que no tiene equipo en la
-- versión global: el resto del mapa QA no cambia) con:
--   - la arista 900104 → 900124;
--   - override de cargo por persona para 900108: COORDINADOR en el overlay,
--     DOCENTE en la versión global → debe ganar el overlay (entra al informe).

BEGIN;

DO $$
BEGIN
  IF current_setting('organigrama.environment', true) IS DISTINCT FROM 'qa' THEN
    RAISE EXCEPTION 'Base no marcada como QA (ejecute 00_marcar_base_qa.sql).';
  END IF;
  IF current_setting('cloudsql.iam_authentication', true) IS NOT NULL THEN
    RAISE EXCEPTION 'Esta base es Cloud SQL: este seed solo corre en QA local.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM core.person
     WHERE coalesce(edu_email, '') NOT LIKE 'qa_sintetico_%@cun.edu.co'
       AND NOT (id = 900199 AND edu_email = 'desarrollofabrica@cun.edu.co')
  ) THEN
    RAISE EXCEPTION 'core.person contiene datos no sintéticos: este seed solo corre en una base QA desechable.';
  END IF;
END $$;

INSERT INTO core.role (id, code, name, is_active, sort_order, created_at, updated_at) VALUES
  (9107, 'QA_LIDER', 'LIDER DE EQUIPO QA', true, 7, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.person (
  id, area_id, role_id, full_name, edu_email, email, type_document, document,
  phone, address, emergency_contact_name, emergency_contact_phone,
  emergency_contact_relationship, is_active, created_at, updated_at
) VALUES
  (900120, 9002, 9103, 'Analista QA Dos Jefes',        'qa_sintetico_dosjefes@cun.edu.co',   'personal.qa120@example.test', 'CC', '9000000120', '3000000120', 'Calle QA 120', 'Contacto QA 120', '3100000120', 'Familiar', true,  now(), now()),
  (900121, 9002, 9102, 'Jefa QA Retirada',             'qa_sintetico_retirada@cun.edu.co',   'personal.qa121@example.test', 'CC', '9000000121', '3000000121', 'Calle QA 121', 'Contacto QA 121', '3100000121', 'Familiar', false, now(), now()),
  (900122, 9002, 9103, 'Analista QA Jefe Inactivo',    'qa_sintetico_jefeinactivo@cun.edu.co','personal.qa122@example.test', 'CC', '9000000122', '3000000122', 'Calle QA 122', 'Contacto QA 122', '3100000122', 'Familiar', true,  now(), now()),
  (900123, 9002, 9103, 'Persona QA Por Posición',      'qa_sintetico_posicion@cun.edu.co',   'personal.qa123@example.test', 'CC', '9000000123', '3000000123', 'Calle QA 123', 'Contacto QA 123', '3100000123', 'Familiar', true,  now(), now()),
  (900124, 9002, 9103, 'Colaborador QA Overlay',       'qa_sintetico_overlay@cun.edu.co',    'personal.qa124@example.test', 'CC', '9000000124', '3000000124', 'Calle QA 124', 'Contacto QA 124', '3100000124', 'Familiar', true,  now(), now()),
  (900125, 9002, 9103, 'Auxiliar QA Equipo Huérfano',  'qa_sintetico_huerfano@cun.edu.co',   'personal.qa125@example.test', 'CC', '9000000125', '3000000125', 'Calle QA 125', 'Contacto QA 125', '3100000125', 'Familiar', true,  now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO organigrama.person_profile_state (person_id, profile_completed_at, profile_updated_by_user_at, created_at, updated_at)
SELECT id, now(), now(), now(), now() FROM core.person WHERE id BETWEEN 900120 AND 900125
ON CONFLICT (person_id) DO NOTHING;

-- Versión global vigente (9201).
INSERT INTO organigrama.org_visual_relation (parent_person_id, child_person_id, relation_type, visual_level, is_active, created_at, updated_at, version_id) VALUES
  (900101, 900120, 'DIRECT', 2, true, now(), now(), 9201),
  (900102, 900120, 'DIRECT', 2, true, now(), now(), 9201),
  (900100, 900121, 'DIRECT', 1, true, now(), now(), 9201),
  (900121, 900122, 'DIRECT', 2, true, now(), now(), 9201),
  (900122, 900125, 'DIRECT', 3, true, now(), now(), 9201)
ON CONFLICT (version_id, parent_person_id, child_person_id) DO NOTHING;

-- Hijo por posición de la arista 900101 → 900103.
INSERT INTO organigrama.org_visual_relation_position_child (version_id, parent_relation_id, child_person_id, relation_type, visual_level, is_active, created_at, updated_at)
SELECT 9201, r.id, 900123, 'DIRECT', 3, true, now(), now()
  FROM organigrama.org_visual_relation r
 WHERE r.version_id = 9201 AND r.parent_person_id = 900101 AND r.child_person_id = 900103
   AND NOT EXISTS (
     SELECT 1 FROM organigrama.org_visual_relation_position_child pc
      WHERE pc.parent_relation_id = r.id AND pc.child_person_id = 900123
   );

-- Override de cargo por ARISTA (solo la ubicación bajo 900102).
INSERT INTO organigrama.org_visual_relation_override (version_id, relation_id, role_id_override, is_active, created_at, updated_at)
SELECT 9201, r.id, 9107, true, now(), now()
  FROM organigrama.org_visual_relation r
 WHERE r.version_id = 9201 AND r.parent_person_id = 900102 AND r.child_person_id = 900120
   AND NOT EXISTS (
     SELECT 1 FROM organigrama.org_visual_relation_override o WHERE o.relation_id = r.id
   );

-- Overlay de coordinación activo con raíz 900104.
INSERT INTO organigrama.org_chart_version (id, code, name, description, is_active, is_locked, scope_type, scope_code, scope_label, scope_root_person_id, created_at, updated_at)
VALUES (9202, 'qa-overlay-analitica', 'Overlay QA Sintético', 'Solo QA', true, false, 'COORDINATION', 'qa-analitica', 'Analítica QA', 900104, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO organigrama.org_visual_relation (parent_person_id, child_person_id, relation_type, visual_level, is_active, created_at, updated_at, version_id) VALUES
  (900104, 900124, 'DIRECT', 3, true, now(), now(), 9202)
ON CONFLICT (version_id, parent_person_id, child_person_id) DO NOTHING;

-- Override de cargo por PERSONA: global DOCENTE, overlay COORDINADOR.
INSERT INTO organigrama.org_chart_person_override (version_id, person_id, role_id_override, created_at, updated_at)
SELECT v.version_id, 900108, v.role_id, now(), now()
  FROM (VALUES (9201, 9104), (9202, 9102)) AS v(version_id, role_id)
 WHERE NOT EXISTS (
   SELECT 1 FROM organigrama.org_chart_person_override o
    WHERE o.version_id = v.version_id AND o.person_id = 900108
 );

COMMIT;
