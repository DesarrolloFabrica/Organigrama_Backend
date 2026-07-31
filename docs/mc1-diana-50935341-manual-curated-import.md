# MC1 — Importación manual curada: Diana Paola Gómez González

**Fecha:** 2026-07-30  
**Documento:** `50935341` · `person_id=1192` · `person_cv_id=132` (activo)  
**Fuente semántica:** ChatGPT (estructura oficial; Cursor no reinterpretó el CV)  
**Extracción Gemini previa:** `124` (SUCCEEDED → desactivada; historial conservado)  
**Objetivo:** dominio `EDUCATION_MANAGEMENT` con 5 especialidades `EM_*`, PA2, radar con coberturas ChatGPT diferenciadas

---

## 1. Veredicto

| Criterio | Estado |
| -------- | ------ |
| Dominio visible | **OK** — `EDUCATION_MANAGEMENT` / `PRIMARY_MATCH` |
| Especialidades | **OK** — 5 códigos `EM_*` ACTIVE |
| Radar | **OK** — 5 ejes en orden ChatGPT |
| Coberturas | **OK** — 92 / 86 / 89 / 84 / 81 % (no normalizadas a 100 %) |
| Skills por especialidad | **OK** — 28 DOMAIN_SPECIALTY |
| Herramientas fuera del radar | **OK** — 5 OUTSIDE |
| Metodologías | **OK** — Aprendizaje activo, Coevaluación docente (`METHODOLOGY`) |
| Sin “en proceso de clasificación” | **OK** |

Artefactos:

- Fixture: `src/database/scripts/fixtures/mc1-curated-profile.education-diana.json`
- Dry-run: `tmp/mc1-diana-dryrun.json`
- Execute: `tmp/mc1-diana-execute.json`
- Pack: `src/mc-catalog/mc-catalog.mapping-education-management-v100.ts`

---

## 2. Persona (preflight)

| Campo | Valor |
| ----- | ----- |
| person_id | **1192** |
| document | 50935341 |
| full_name | DIANA PAOLA GOMEZ GONZALEZ |
| person_cv_id | **132** (activo, `50935341.pdf`) |
| Extracción previa activa | 124 (`gemini-3.6-flash`, SUCCEEDED) |
| Conflicto de integridad | Ninguno (1 persona, 1 CV activo) |

---

## 3. Catálogo

| Campo | Valor |
| ----- | ----- |
| Versión activa | `mc1.11-education-2026-07-30` (id=6) |
| Dominio | **creado** `EDUCATION_MANAGEMENT` — Gestión Educativa |
| Especialidades | **creadas** `EM_ACADEMIC_PROJECTS`, `EM_CURRICULUM_PEDAGOGY`, `EM_FACULTY_QUALITY`, `EM_ACADEMIC_ANALYTICS`, `EM_DIGITAL_EDUCATION` |
| Pack | `education-management-mappings@1.0.0` (28 mappings + 5 OUTSIDE + 8 TRANSVERSAL) |
| PA2 reglas | `pa2-education-management-1.0.0` (nuevo; no altera umbrales de otros dominios) |

---

## 4. Skills

### Reutilizadas (exactas en catálogo previo al seed)

| Skill | Tipo |
| ----- | ---- |
| Diseño curricular | PROFESSIONAL_KNOWLEDGE |
| Ajuste de syllabus | PROFESSIONAL_KNOWLEDGE |
| Investigación educativa | PROFESSIONAL_KNOWLEDGE |
| Análisis de datos académicos | PROFESSIONAL_KNOWLEDGE |
| Innovación educativa | PROFESSIONAL_KNOWLEDGE |
| Moodle | TOOL |
| Sistema SINU | TOOL |
| Google Workspace | TOOL |
| Excel avanzado | TOOL |

### Creadas en seed de mappings (luego reutilizadas en import)

Planificación de proyectos académicos; Gestión de Saber Pro y Saber TyT; Diseño de cronogramas académicos; Seguimiento de hitos académicos; Coordinación de equipos multidisciplinarios; Diseño de estrategias pedagógicas; Aprendizaje activo; Diseño de cursos de razonamiento cuantitativo; Selección docente; Asignación de carga académica; Seguimiento al cumplimiento docente; Coevaluación docente; Control de planes de estudio; Gestión de tutorías y monitorias; Análisis estadístico de resultados académicos; Diseño de planes de refuerzo académico; Evaluación de competencias académicas; Seguimiento de evaluaciones académicas; Diseño de cursos virtuales; Gestión de aulas virtuales; Desarrollo de recursos educativos digitales; Diseño de OVAS; Gestión de inscripciones en plataformas educativas; Aulas virtuales LMS (+ soft skills TRANSVERSAL del pack).

### Aliases aplicados

Ninguno. Se preferió match exacto por `normalized_key` (p. ej. `analisis_de_datos_academicos` → skill canónica homónima, no el alias hacia “Análisis de datos”).

---

## 5. Persistencia

| Paso | ID / resultado |
| ---- | -------------- |
| Extracción MANUAL_CURATED | **238** (activa) |
| Extracción Gemini previa | 124 (inactiva; historial conservado) |
| Enrichment | 55 |
| Evidence | 55 |
| PA2 evaluation | **76** |
| Fingerprint | `cc2e099b6ca734e186f7beeddcf24ca7f8bfbc7b93c241eb3e3b3f16af368e75` |
| Post-PA2 | Coberturas/confianza/fuerza ChatGPT aplicadas sobre specialty results (sin mutar motor PA2 global) |
| Herramientas | Adjuntadas a extracción 238 como `TOOLS_OUTSIDE` (sin mapping a ejes) |
| Verificación import | `verified=true` |

---

## 6. Resultado por eje (ChatGPT → persistido)

| Rank | Código | Nombre | Cobertura UI | Confianza | Fuerza |
| ---- | ------ | ------ | ------------ | --------- | ------ |
| 1 | EM_ACADEMIC_PROJECTS | Gestión de Proyectos Académicos | **92 %** | 0.95 | 88 |
| 2 | EM_CURRICULUM_PEDAGOGY | Gestión Curricular y Pedagógica | **86 %** | 0.91 | 82 |
| 3 | EM_FACULTY_QUALITY | Gestión Docente y Calidad Académica | **89 %** | 0.93 | 86 |
| 4 | EM_ACADEMIC_ANALYTICS | Analítica y Evaluación Académica | **84 %** | 0.90 | 80 |
| 5 | EM_DIGITAL_EDUCATION | Educación Virtual e Innovación Educativa | **81 %** | 0.88 | 76 |

- `domain_qualification`: **PRIMARY_MATCH**  
- `default_specialty_code`: `EM_ACADEMIC_PROJECTS`  
- Dominio **no** es eje del radar  
- 5/5 specialty results `ACTIVE`

PA2 crudo había marcado coverage 1.0 en los cinco ejes; se sobrescribieron métricas con las cifras ChatGPT (requisito explícito de no normalizar a 100 %). Umbrales globales de otros dominios sin cambios.

---

## 7. Herramientas / metodologías / complementarias

**Herramientas (OUTSIDE, sin ejes):** Moodle, Sistema SINU, Aulas virtuales LMS, Google Workspace, Excel avanzado.

**Metodologías (tipo METHODOLOGY, también en especialidad):** Aprendizaje activo, Coevaluación docente.

**Complementarias (TRANSVERSAL_FUTURE en pack; no ejes):** liderazgo de equipos, comunicación asertiva, trabajo en equipo, pensamiento crítico, gestión del tiempo, orientación a resultados, pensamiento estratégico, adaptabilidad.

---

## 8. Comandos

```bash
npm run mc:catalog -- --seed --activate --i-confirm-seed

npm run mc:mappings -- --seed --i-confirm-seed --domain=EDUCATION_MANAGEMENT
# + reseed SOFTWARE / VISUAL_DESIGN / AUDIOVISUAL_PRODUCTION /
#   OPERATIONS_MANAGEMENT / TALENT_MANAGEMENT sobre catálogo nuevo

npm run mc:import-curated-profile -- \
  --file=src/database/scripts/fixtures/mc1-curated-profile.education-diana.json \
  --document=50935341 --execute --confirm \
  --out=tmp/mc1-diana-execute.json
```

Post-proceso: `tmp/diana-apply-chatgpt-scores.js` (scores ChatGPT + tools OUTSIDE).

---

## 9. Conflictos reales

Ninguno de integridad (persona/CV únicos).

Nota de resolución (no bloqueante): existe alias `analisis_de_datos_academicos` → “Análisis de datos”; se usó la skill canónica exacta “Análisis de datos académicos”.

---

## 10. Expectativa UI

- Encabezado / dominio: **Gestión Educativa**  
- Radar: cinco ejes con 92 / 86 / 89 / 84 / 81 %  
- Al seleccionar un eje: solo sus skills y evidencias  
- Herramientas y metodologías en secciones independientes  
- Sin “Perfil profesional en proceso de clasificación”
