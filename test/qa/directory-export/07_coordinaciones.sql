-- QA sintético — Dirección y coordinaciones para las pestañas del Excel (fase 3).
--
-- Replica la FORMA del organigrama vigente (no sus datos): bajo la Dirección
-- (raíz 1144 → Directora 900100, área DIRECCIÓN QA) cuelgan cabezas de
-- coordinación de OTRAS áreas, cada una con su equipo en varios niveles.
--
--   Directora 900100 (DIRECCIÓN QA) + staff 900162 Analista Operativa (Dirección)
--   ├ 900140 Supervisor B2B QA (B2B) ─ 900141, 900142
--   ├ 900145 Coordinador Fábrica QA (FABRICA Y DESARROLLO)
--   │   ├ 900146 Líder Contenidos QA ─ 900147, 900148, 900151 (área PROYECCIÓN: sale en Fábrica)
--   │   └ 900149 Líder Desarrollo QA ─ 900150
--   ├ 900155 Coordinadora Especializaciones QA (ESPECIALIZACIONES)
--   │   ├ 900156 Docente LITE QA (no elegible) ─ 900157 Monitora QA (elegible)
--   │   └ 900158 Docente QA Especializaciones (no elegible)
--   ├ 900159 Analista compartida: jefes 900146 (Fábrica) y 900140 (B2B) → en ambas hojas
--   ├ 900165 Coordinadora Operación Académica QA (OPERACION ACADEMICA)
--   │   ├ 900173 Asistente Operación Académica QA (staff directo, sin equipo)
--   │   ├ 900166 Coordinador Escuela Ingenierías QA ─ 900167 docente, 900168 monitor,
--   │   │                                            900169 Auxiliar Consultorio Jurídico
--   │   │                                            (área PROYECCION SOCIAL: caso real análogo)
--   │   └ 900170 Coordinadora Escuela Bellas Artes QA ─ 900171 docente, 900172 analista
--   ├ 900175 Coordinador Prácticas QA (PRACTICAS) ─ 900176
--   ├ 900178 Líder de Servicio QA (HOMOLOGACIONES) ─ 900179
--   ├ 900181 Coordinadora Proyección Social QA (PROYECCION SOCIAL) ─ 900182
--   └ 900184 Coordinadora Saber QA (SABER PRO) ─ 900185
--
-- Con 01–06 la coordinación «OPERACIONES QA SINTÉTICA» (Coordinador Uno y Dos)
-- también existe, así que el Excel QA tiene 11 hojas: Base general, Dirección
-- y 9 coordinaciones (las 8 de la forma real + OPERACIONES QA SINTÉTICA).
--
-- Solo datos sintéticos. Idempotente. Se niega a correr fuera de una base QA.
BEGIN;

DO $$
BEGIN
  IF current_setting('organigrama.environment', true) IS DISTINCT FROM 'qa' THEN
    RAISE EXCEPTION 'La base no está marcada como QA (organigrama.environment=qa).';
  END IF;
  IF EXISTS (
    SELECT 1 FROM core.person
     WHERE coalesce(edu_email, '') NOT LIKE 'qa_sintetico_%@cun.edu.co'
       AND NOT (id = 900199 AND edu_email = 'desarrollofabrica@cun.edu.co')
  ) THEN
    RAISE EXCEPTION 'core.person contiene datos no sintéticos: este seed solo corre en una base QA desechable.';
  END IF;
END $$;

INSERT INTO core.area (id, code, name, is_active, created_at, updated_at) VALUES
  (9003, 'QA_B2B', 'B2B', true, now(), now()),
  (9004, 'QA_FAB', 'FABRICA Y DESARROLLO', true, now(), now()),
  (9005, 'QA_ESP', 'ESPECIALIZACIONES', true, now(), now()),
  (9006, 'QA_PS', 'PROYECCION SOCIAL', true, now(), now()),
  (9007, 'QA_SP', 'SABER PRO', true, now(), now()),
  (9008, 'QA_PRA', 'PRACTICAS', true, now(), now()),
  (9009, 'QA_HOM', 'HOMOLOGACIONES', true, now(), now()),
  (9010, 'QA_OA', 'OPERACION ACADEMICA', true, now(), now()),
  -- Sin personas: lo usa la prueba de «coordinación nueva».
  (9011, 'QA_INV', 'AREA INVESTIGATIVA', true, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.role (id, code, name, is_active, sort_order, created_at, updated_at) VALUES
  (9108, 'QA_SUP_B2B', 'SUPERVISOR B2B', true, 8, now(), now()),
  (9109, 'QA_COORD_FAB', 'COORDINADOR DE FABRICA CONTENIDO Y DESARROLLO', true, 9, now(), now()),
  (9110, 'QA_COORD_ESP', 'COORDINADOR DE ESPECIALIZACIONES', true, 10, now(), now()),
  (9111, 'QA_LID_CONT', 'LIDER DE CONTENIDOS ACADEMICOS', true, 11, now(), now()),
  (9112, 'QA_LID_DES', 'LIDER DE DESARROLLO', true, 12, now(), now()),
  (9113, 'QA_AUX_B2B', 'AUXILIAR GESTOR VINCULACIONES', true, 13, now(), now()),
  (9114, 'QA_COORD_SP', 'COORDINADOR PRUEBAS SABER', true, 14, now(), now()),
  (9115, 'QA_COORD_OA', 'COORDINADOR DE OPERACIÓN ACADEMICA', true, 15, now(), now()),
  (9116, 'QA_COORD_ING', 'COORDINADOR ESCUELA INGENIERIAS', true, 16, now(), now()),
  (9117, 'QA_COORD_BA', 'COORDINADOR ESCUELA BELLAS ARTES', true, 17, now(), now()),
  (9118, 'QA_AUX_CJ', 'AUXILIAR CONSULTORIO JURIDICO', true, 18, now(), now()),
  (9119, 'QA_COORD_PRA', 'COORDINADOR DESARROLLO PROFESIONAL', true, 19, now(), now()),
  (9120, 'QA_LID_SERV', 'LIDER DE SERVICIO', true, 20, now(), now()),
  (9121, 'QA_COORD_PS', 'COORDINADOR PROYECCIÓN SOCIAL', true, 21, now(), now()),
  (9122, 'QA_AN_OP', 'ANALISTA OPERATIVO', true, 22, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.person (
  id, area_id, role_id, full_name, edu_email, email, type_document, document,
  phone, is_active, created_at, updated_at
) VALUES
  (900140, 9003, 9108, 'Supervisor B2B QA',                    'qa_sintetico_b2b_sup@cun.edu.co',    'b2b.sup@example.test',    'CC', '9000000140', '3000000140', true, now(), now()),
  (900141, 9003, 9113, 'Auxiliar B2B QA Uno',                  'qa_sintetico_b2b_aux1@cun.edu.co',   'b2b.aux1@example.test',   'CC', '9000000141', '3000000141', true, now(), now()),
  (900142, 9003, 9113, 'Auxiliar B2B QA Dos',                  'qa_sintetico_b2b_aux2@cun.edu.co',   'b2b.aux2@example.test',   'CC', '9000000142', '3000000142', true, now(), now()),
  (900145, 9004, 9109, 'Coordinador Fábrica QA',               'qa_sintetico_fab_coord@cun.edu.co',  'fab.coord@example.test',  'CC', '9000000145', '3000000145', true, now(), now()),
  (900146, 9004, 9111, 'Líder Contenidos QA',                  'qa_sintetico_fab_lidc@cun.edu.co',   'fab.lidc@example.test',   'CC', '9000000146', '3000000146', true, now(), now()),
  (900147, 9004, 9103, 'Analista Contenidos QA Uno',           'qa_sintetico_fab_an1@cun.edu.co',    'fab.an1@example.test',    'CC', '9000000147', '3000000147', true, now(), now()),
  (900148, 9004, 9103, 'Analista Contenidos QA Dos',           'qa_sintetico_fab_an2@cun.edu.co',    'fab.an2@example.test',    'CC', '9000000148', '3000000148', true, now(), now()),
  (900149, 9004, 9112, 'Líder Desarrollo QA',                  'qa_sintetico_fab_lidd@cun.edu.co',   'fab.lidd@example.test',   'CC', '9000000149', '3000000149', true, now(), now()),
  (900150, 9004, 9103, 'Desarrolladora QA',                    'qa_sintetico_fab_dev@cun.edu.co',    'fab.dev@example.test',    'CC', '9000000150', '3000000150', true, now(), now()),
  (900151, 9006, 9106, 'Auxiliar Proyección en Fábrica QA',    'qa_sintetico_fab_ps@cun.edu.co',     'fab.ps@example.test',     'CC', '9000000151', '3000000151', true, now(), now()),
  (900155, 9005, 9110, 'Coordinadora Especializaciones QA',    'qa_sintetico_esp_coord@cun.edu.co',  'esp.coord@example.test',  'CC', '9000000155', '3000000155', true, now(), now()),
  (900156, 9005, 9104, 'Docente LITE QA',                      'qa_sintetico_esp_lite@cun.edu.co',   'esp.lite@example.test',   'CC', '9000000156', '3000000156', true, now(), now()),
  (900157, 9005, 9103, 'Monitora Especializaciones QA',        'qa_sintetico_esp_mon@cun.edu.co',    'esp.mon@example.test',    'CC', '9000000157', '3000000157', true, now(), now()),
  (900158, 9005, 9104, 'Docente QA Especializaciones',         'qa_sintetico_esp_doc@cun.edu.co',    'esp.doc@example.test',    'CC', '9000000158', '3000000158', true, now(), now()),
  (900159, 9004, 9103, 'Analista Compartida QA',               'qa_sintetico_compartida@cun.edu.co', 'compartida@example.test', 'CC', '9000000159', '3000000159', true, now(), now()),
  (900162, 9001, 9122, 'Analista Operativa QA',                'qa_sintetico_dir_anop@cun.edu.co',   'dir.anop@example.test',   'CC', '9000000162', '3000000162', true, now(), now()),
  (900165, 9010, 9115, 'Coordinadora Operación Académica QA',  'qa_sintetico_oa_coord@cun.edu.co',   'oa.coord@example.test',   'CC', '9000000165', '3000000165', true, now(), now()),
  (900166, 9010, 9116, 'Coordinador Escuela Ingenierías QA',   'qa_sintetico_oa_ing@cun.edu.co',     'oa.ing@example.test',     'CC', '9000000166', '3000000166', true, now(), now()),
  (900167, 9010, 9104, 'Docente Ingenierías QA',               'qa_sintetico_oa_ing_doc@cun.edu.co', 'oa.ing.doc@example.test', 'CC', '9000000167', '3000000167', true, now(), now()),
  (900168, 9010, 9103, 'Monitor Ingenierías QA',               'qa_sintetico_oa_ing_mon@cun.edu.co', 'oa.ing.mon@example.test', 'CC', '9000000168', '3000000168', true, now(), now()),
  (900169, 9006, 9118, 'Auxiliar Consultorio Jurídico QA',     'qa_sintetico_oa_cj@cun.edu.co',      'oa.cj@example.test',      'CC', '9000000169', '3000000169', true, now(), now()),
  (900170, 9010, 9117, 'Coordinadora Escuela Bellas Artes QA', 'qa_sintetico_oa_ba@cun.edu.co',      'oa.ba@example.test',      'CC', '9000000170', '3000000170', true, now(), now()),
  (900171, 9010, 9104, 'Docente Bellas Artes QA',              'qa_sintetico_oa_ba_doc@cun.edu.co',  'oa.ba.doc@example.test',  'CC', '9000000171', '3000000171', true, now(), now()),
  (900172, 9010, 9103, 'Analista Bellas Artes QA',             'qa_sintetico_oa_ba_an@cun.edu.co',   'oa.ba.an@example.test',   'CC', '9000000172', '3000000172', true, now(), now()),
  (900173, 9010, 9106, 'Asistente Operación Académica QA',     'qa_sintetico_oa_asis@cun.edu.co',    'oa.asis@example.test',    'CC', '9000000173', '3000000173', true, now(), now()),
  (900175, 9008, 9119, 'Coordinador Prácticas QA',             'qa_sintetico_pra_coord@cun.edu.co',  'pra.coord@example.test',  'CC', '9000000175', '3000000175', true, now(), now()),
  (900176, 9008, 9103, 'Facilitadora Prácticas QA',            'qa_sintetico_pra_fac@cun.edu.co',    'pra.fac@example.test',    'CC', '9000000176', '3000000176', true, now(), now()),
  (900178, 9009, 9120, 'Líder de Servicio QA',                 'qa_sintetico_hom_lid@cun.edu.co',    'hom.lid@example.test',    'CC', '9000000178', '3000000178', true, now(), now()),
  (900179, 9009, 9106, 'Auxiliar Homologaciones QA',           'qa_sintetico_hom_aux@cun.edu.co',    'hom.aux@example.test',    'CC', '9000000179', '3000000179', true, now(), now()),
  (900181, 9006, 9121, 'Coordinadora Proyección Social QA',    'qa_sintetico_ps_coord@cun.edu.co',   'ps.coord@example.test',   'CC', '9000000181', '3000000181', true, now(), now()),
  (900182, 9006, 9103, 'Analista Proyección Social QA',        'qa_sintetico_ps_an@cun.edu.co',      'ps.an@example.test',      'CC', '9000000182', '3000000182', true, now(), now()),
  (900184, 9007, 9114, 'Coordinadora Saber QA',                'qa_sintetico_sp_coord@cun.edu.co',   'sp.coord@example.test',   'CC', '9000000184', '3000000184', true, now(), now()),
  (900185, 9007, 9103, 'Profesional Saber QA',                 'qa_sintetico_sp_prof@cun.edu.co',    'sp.prof@example.test',    'CC', '9000000185', '3000000185', true, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO organigrama.person_profile_state (person_id, profile_completed_at, profile_updated_by_user_at, created_at, updated_at)
SELECT id, now(), now(), now(), now() FROM core.person WHERE id BETWEEN 900140 AND 900189
ON CONFLICT (person_id) DO NOTHING;

INSERT INTO organigrama.org_visual_relation (parent_person_id, child_person_id, relation_type, visual_level, is_active, created_at, updated_at, version_id)
SELECT v.parent_id, v.child_id, 'DIRECT', v.nivel, true, now(), now(), 9201
  FROM (VALUES
    (900100, 900140, 1), (900140, 900141, 2), (900140, 900142, 2),
    (900100, 900145, 1), (900145, 900146, 2), (900146, 900147, 3), (900146, 900148, 3),
    (900146, 900151, 3), (900145, 900149, 2), (900149, 900150, 3),
    (900100, 900155, 1), (900155, 900156, 2), (900156, 900157, 3), (900155, 900158, 2),
    (900146, 900159, 3), (900140, 900159, 2),
    (900100, 900162, 1),
    (900100, 900165, 1), (900165, 900173, 2),
    (900165, 900166, 2), (900166, 900167, 3), (900166, 900168, 3), (900166, 900169, 3),
    (900165, 900170, 2), (900170, 900171, 3), (900170, 900172, 3),
    (900100, 900175, 1), (900175, 900176, 2),
    (900100, 900178, 1), (900178, 900179, 2),
    (900100, 900181, 1), (900181, 900182, 2),
    (900100, 900184, 1), (900184, 900185, 2)
  ) AS v(parent_id, child_id, nivel)
 WHERE NOT EXISTS (
   SELECT 1 FROM organigrama.org_visual_relation r
    WHERE r.version_id = 9201 AND r.parent_person_id = v.parent_id AND r.child_person_id = v.child_id
 );

COMMIT;
