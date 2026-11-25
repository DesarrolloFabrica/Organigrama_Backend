-- QA — requisiciones sintéticas de Orbit (`vacancies.vacancy`) para probar el
-- alcance por coordinación del panel de resumen.
--
-- Requiere la base QA del kit `test/qa/directory-export` con 00, 01 y 07
-- (raíz 1144, Dirección 9001 y coordinaciones 9003–9010). Se niega a correr si
-- la base no está marcada como QA o si core.person tiene personas no
-- sintéticas. Idempotente (ids 9901–9910, escuela 9502, programa 9512).
--
-- Resultado esperado (filtro requisition_sent; X requisiciones · Y plazas):
--   Raíz 1144 (global) ................................ 9 · 15
--   ESPECIALIZACIONES (cabeza 900155, área 9005) ....... 2 · 4
--   OPERACION ACADEMICA (cabeza 900165, área 9010) ..... 3 · 3
--   SABER PRO (cabeza 900184, área 9007) ............... 0 · 0
--   Nodo inferior 900166 (escuela bajo Op. Académica) .. bloque omitido
--   Directora 900100 (staff de Dirección, no raíz) ..... bloque omitido

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
  IF NOT EXISTS (SELECT 1 FROM core.area WHERE id = 9005) THEN
    RAISE EXCEPTION 'Faltan las coordinaciones sintéticas: ejecute primero 07_coordinaciones.sql.';
  END IF;
END $$;

-- Escuela y programa de Especializaciones SIN ninguna persona asignada.
INSERT INTO core.school (id, area_id, code, name, is_active, created_at, updated_at)
VALUES (9502, 9005, 'QA_ESC_ESP', 'Escuela QA Especializaciones', true, now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO core.program (id, school_id, code, name, level, is_active, created_at, updated_at)
VALUES (9512, 9502, 'QA_PRG_ESP', 'Programa QA sin persona asignada', 'ESPECIALIZACION', true, now(), now())
ON CONFLICT (id) DO NOTHING;

DELETE FROM vacancies.vacancy WHERE id BETWEEN 9901 AND 9910;

INSERT INTO vacancies.vacancy
  (id, area_id, school_id, program_id, position_name, curricular_line, quantity, operation_status, created_at, updated_at)
VALUES
  -- ESPECIALIZACIONES: programa sin persona asignada y quantity > 1.
  (9901, 9005, 9502, 9512, 'DOCENTE QA ESPECIALIZACION', 'Línea QA de gerencia', 3, 'requisition_sent', now() - interval '1 minute', now()),
  (9902, 9005, NULL, NULL, 'COORDINADOR QA DE PROGRAMA', NULL, 1, 'requisition_sent', now() - interval '2 minutes', now()),
  -- Otro estado: no se muestra en ninguna vista.
  (9903, 9005, NULL, NULL, 'MONITOR QA', NULL, 5, 'open', now() - interval '3 minutes', now()),
  -- OPERACION ACADEMICA: una sin cantidad (suma 0 plazas).
  (9904, 9010, NULL, NULL, 'DOCENTE QA INGENIERIAS', NULL, 2, 'requisition_sent', now() - interval '4 minutes', now()),
  (9909, 9010, NULL, NULL, 'AUXILIAR QA SIN CANTIDAD', NULL, NULL, 'requisition_sent', now() - interval '5 minutes', now()),
  (9910, 9010, NULL, NULL, 'ANALISTA QA ACADEMICO', NULL, 1, 'requisition_sent', now() - interval '6 minutes', now()),
  -- No asociables a una coordinación: solo cuentan en la raíz.
  (9905, NULL, NULL, NULL, 'CARGO QA SIN AREA', NULL, 1, 'requisition_sent', now() - interval '7 minutes', now()),
  (9906, 9001, NULL, NULL, 'CARGO QA AREA DE DIRECCION', NULL, 1, 'requisition_sent', now() - interval '8 minutes', now()),
  (9907, 9011, NULL, NULL, 'CARGO QA AREA SIN CABEZA', NULL, 4, 'requisition_sent', now() - interval '9 minutes', now()),
  (9908, NULL, 9501, 9511, 'CARGO QA SOLO ESCUELA Y PROGRAMA', NULL, 2, 'requisition_sent', now() - interval '10 minutes', now());

-- Plaza vacante DEL ÁRBOL (placeholder en core.person, otro concepto): cuelga
-- de la escuela 900166 para comprobar que «vac.» de Equipo directo no cambia
-- (900165 → fila 900166 con 1 vac.).
INSERT INTO core.person (id, area_id, role_id, full_name, edu_email, email, type_document, document, phone, is_active, created_at, updated_at)
SELECT 900190, 9010, p.role_id, 'VACANTE - DOCENTE QA INGENIERIAS',
       'qa_sintetico_vacante_arbol@cun.edu.co', NULL, 'CC', 'VAC-QA-900190', NULL, true, now(), now()
  FROM core.person p WHERE p.id = 900167
ON CONFLICT (id) DO NOTHING;
INSERT INTO organigrama.org_visual_relation (parent_person_id, child_person_id, relation_type, visual_level, is_active, created_at, updated_at, version_id)
SELECT 900166, 900190, 'DIRECT_REPORT', 5, true, now(), now(), v.id
  FROM organigrama.org_chart_version v
 WHERE v.is_active AND v.scope_type = 'GLOBAL'
ON CONFLICT (version_id, parent_person_id, child_person_id) DO NOTHING;

COMMIT;
