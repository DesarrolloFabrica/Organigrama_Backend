-- QA — completa catálogos y skills SINTÉTICOS para que el informe Excel tenga
-- las 26 columnas con contenido (Escuela, Programa, Nivel, Tipo de contrato,
-- Región, Ciudad, Campus y Skills). Solo base QA desechable.
--
-- Requiere 01_seed_sintetico.sql (y opcionalmente 02). Idempotente.

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
END $$;

INSERT INTO core.hierarchy (id, name, description, level) VALUES
  (9301, 'Nivel 1 QA', 'Dirección (sintético)', 1),
  (9302, 'Nivel 2 QA', 'Coordinación (sintético)', 2),
  (9303, 'Nivel 3 QA', 'Equipo (sintético)', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.city (id, name, is_active) VALUES (9401, 'Ciudad QA Sintética', true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO core.region (id, name, city_id, is_active, created_at, updated_at) VALUES (9411, 'Región QA Sintética', 9401, true, now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO core.campus (id, name, city_id, region_id, is_active, created_at, updated_at) VALUES (9421, 'Sede QA Sintética', 9401, 9411, true, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.school (id, area_id, code, name, is_active, created_at, updated_at) VALUES
  (9501, 9002, 'QA_ESC', 'Escuela QA Sintética', true, now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO core.program (id, school_id, code, name, level, is_active, created_at, updated_at) VALUES
  (9511, 9501, 'QA_PRG', 'Programa QA Sintético', 'PROFESIONAL', true, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.contract_type (id, code, name, is_active, created_at, updated_at) VALUES
  (9601, 'QA_INDEF', 'Término indefinido (QA)', true, now(), now()),
  (9602, 'QA_FIJO', 'Término fijo (QA)', true, now(), now())
ON CONFLICT (id) DO NOTHING;

UPDATE core.person p
   SET hierarchy_id = CASE
         WHEN p.role_id = 9101 THEN 9301
         WHEN p.role_id = 9102 THEN 9302
         ELSE 9303 END,
       contract_type_id = CASE WHEN p.id % 2 = 0 THEN 9601 ELSE 9602 END,
       city_id = 9401, region_id = 9411, campus_id = 9421,
       school_id = 9501, program_id = 9511
 WHERE p.id = 1144 OR p.id BETWEEN 900100 AND 900199;

-- Skills sintéticas (extracción de CV ficticia; no hay archivos reales detrás).
INSERT INTO organigrama.cv_skill (normalized_name, normalized_key, skill_type, is_active, created_at, updated_at) VALUES
  ('Gestión de proyectos (QA)', 'qa_gestion_proyectos', 'METHODOLOGY', true, now(), now()),
  ('Hojas de cálculo (QA)', 'qa_hojas_calculo', 'TOOL', true, now(), now()),
  ('Análisis de datos (QA)', 'qa_analisis_datos', 'PROFESSIONAL_KNOWLEDGE', true, now(), now())
ON CONFLICT (normalized_key, skill_type) DO NOTHING;

INSERT INTO organigrama.person_cv (person_id, document, drive_file_id, drive_file_name, drive_web_url, mime_type, is_active, created_at, synced_at)
SELECT p.id, p.document, 'qa-sintetico-cv-' || p.id, 'cv-qa-' || p.id || '.pdf', 'https://example.test/cv-qa-' || p.id, 'application/pdf', true, now(), now()
  FROM core.person p
 WHERE (p.id = 1144 OR p.id BETWEEN 900100 AND 900199)
   AND NOT EXISTS (SELECT 1 FROM organigrama.person_cv c WHERE c.person_id = p.id);

INSERT INTO organigrama.cv_extraction (person_id, person_cv_id, document, drive_file_id, drive_file_name, pdf_sha256, pdf_byte_size,
                                       model, prompt_version, extractor_version, status, is_active, started_at, finished_at, warnings, skills_count, created_at, updated_at)
SELECT c.person_id, c.id, c.document, c.drive_file_id, c.drive_file_name, repeat('0', 64), 1024,
       'qa-sintetico', 'qa', 'qa', 'SUCCEEDED', true, now(), now(), '[]'::jsonb, 2, now(), now()
  FROM organigrama.person_cv c
 WHERE c.drive_file_id LIKE 'qa-sintetico-cv-%'
   AND NOT EXISTS (SELECT 1 FROM organigrama.cv_extraction e WHERE e.person_id = c.person_id);

INSERT INTO organigrama.cv_extraction_skill (extraction_id, skill_id, original_name, category, confidence, evidence, is_explicit, sort_order, created_at)
SELECT e.id, s.id, s.normalized_name, s.skill_type, 0.9, 'Evidencia sintética de QA', true, s.ord, now()
  FROM organigrama.cv_extraction e
  JOIN (
    SELECT id, normalized_name, skill_type,
           row_number() OVER (ORDER BY normalized_key) - 1 AS ord
      FROM organigrama.cv_skill
     WHERE normalized_key LIKE 'qa_%'
  ) s ON s.ord < 2
 WHERE e.drive_file_id LIKE 'qa-sintetico-cv-%'
ON CONFLICT (extraction_id, skill_id) DO NOTHING;

COMMIT;
