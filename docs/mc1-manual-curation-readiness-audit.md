# Auditoría MC1 — Readiness para curaduría manual

**Fecha:** 2026-07-29  
**Alcance:** solo lectura (código + consultas SELECT). Sin migraciones, sin escrituras en BD, sin cambios de implementación.  
**Ruta del entregable:** `Organigrama_Backend/docs/mc1-manual-curation-readiness-audit.md`  
(ubicado junto al resto de auditorías MC1 del backend; el path pedido `docs/...` se interpreta relativo al módulo backend).

---

## A. Resumen ejecutivo

El sistema MC1 **ya implementa de punta a punta** la cadena evidence-first:

```text
CV (person_cv) → extracción → skills + evidencia → enrichment → evidence evaluation → PA2 (dominio/especialidades) → API → radar FE
```

**Veredicto: reutilizable con ajustes.**

| Criterio | Resultado |
| -------- | --------- |
| Estado general | Arquitectura operativa y alineada al modelo Dominio → Especialidad → Skill |
| Nivel de reutilización | Alto (tablas, catálogo, PA2, API lectura, radar FE) |
| ¿Migración necesaria para el piloto? | **No** para cargar perfiles manuales en el modelo actual |
| ¿Catálogo nuevo? | **No**; extender mappings del catálogo activo si faltan skills |
| ¿Capa paralela persona-dominio? | **No crear**; no existe y no hace falta |
| Riesgo general | Medio — falta importer CLI + marcador de origen; cadena enrichment/evidence es obligatoria para PA2 |

La extracción automática con Gemini **no debe desecharse**: la curaduría manual debe insertarse como **otra fuente de extracción** en las mismas tablas, marcada por versiones (`model` / `prompt_version` / `extractor_version`), y luego reutilizar evidence + PA2 + API + radar sin cambios de producto.

---

## B. Arquitectura actual encontrada

### Flujo real (implementado)

```text
core.person
    ↓
organigrama.person_cv          (sync Drive: sync:drive-cv)
    ↓
CvSkillsExtractionService      (Gemini; GEMINI_API_KEY)
    ↓
organigrama.cv_extraction      (+ cv_extraction_skill / language / certification)
    ↓  cv_skill + cv_skill_alias (catálogo canónico)
CvSkillsEnrichmentOrchestrator (Gemini)
    ↓
organigrama.cv_skill_enrichment (+ items)
    ↓
evaluateEvidenceSkills         (determinista, sin LLM)
    ↓
organigrama.cv_evidence_evaluation (+ items)
    ↓
McPa2Service.evaluateProfileDomain / runMcPa2Engine
    ↓
organigrama.mc_profile_evaluation
    └── mc_profile_specialty_result   (ejes del radar)
    ↓
OrgChartCompetenciesService    (HTTP lectura JWT)
    ↓
GET .../competencies/professional-profile
GET .../domains/:code/specialties/:code
    ↓
CompetenciesExplorer + CompetencyRadar (FE SVG)
```

### Ligadura conceptual vs implementación

| Concepto esperado | Dónde vive hoy |
| ----------------- | -------------- |
| Dominio / especialidad (catálogo) | `mc_domain`, `mc_specialty` + versión `mc_catalog_version` |
| Skill canónica + alias | `cv_skill`, `cv_skill_alias` |
| Skill → especialidad | `mc_skill_specialty_mapping` (PRIMARY/SECONDARY + weight) |
| Skill × dominio (clasificación) | `mc_skill_domain_classification` |
| Persona → dominio | **Solo** vía `mc_profile_evaluation` (no hay `person_domain`) |
| Persona → especialidad | **Solo** vía `mc_profile_specialty_result` |
| Persona → skill + evidencia | `cv_extraction` activa → `cv_extraction_skill` (+ enrichment/evidence) |
| Dominio principal (UI) | `defaultDomainCode` = primer dominio publishable con preferencia `PRIMARY_MATCH` (`mc-multidomain-profile-publish.ts`) |

**Conclusión:** dominio y especialidades **no** están ligados directamente a la persona ni a un campo en la extracción; están ligados a una **evaluación MC1 (PA2)** versionada sobre una cadena extraction→enrichment→evidence concreta.

---

## C. Inventario técnico

### C.1 Tablas relevantes

| Esquema.tabla | Propósito | Columnas relevantes | Relaciones | Restricciones | Uso | Datos (~) | Reutilización | Riesgos |
| ------------- | --------- | ------------------- | ---------- | ------------- | --- | --------- | ------------- | ------- |
| `organigrama.person_cv` | CV sincronizado Drive | `person_id`, Drive meta, `is_active` | → `core.person` | índices Drive | Activa | 191 total / **127 activas** | Sí | Asume Drive; carga manual debe respetar FK |
| `organigrama.cv_skill` | Catálogo canónico skills | `normalized_name`, `normalized_key`, `skill_type`, `is_active` | ← alias, extraction_skill, mappings | UNIQUE `(normalized_key, skill_type)` | Activa | **1310** | Sí | Mismo nombre en tipos distintos = “duplicados” aparentes |
| `organigrama.cv_skill_alias` | Alias → skill | `alias_key`, `skill_id` | → `cv_skill` CASCADE | UNIQUE `alias_key` | Activa | **104** | Sí | Alias global inequívoco |
| `organigrama.cv_extraction` | Run extracción | person, person_cv, pdf hash, `model`, `prompt_version`, `extractor_version`, `status`, `is_active`, `raw_result`, `warnings` | → person, person_cv | 1 activa/persona; idempotencia SUCCEEDED | Activa | **235** (167 SUCCEEDED, **139 activas**) | Sí | Sin campo `source`; marcar vía model/versiones |
| `organigrama.cv_extraction_skill` | Skills + evidencia por extracción | `skill_id`, `original_name`, `confidence`, `evidence`, `evidence_items` | → extraction, skill | UNIQUE (extraction, skill); confidence 0..1 | Activa | **2237** en activas | Sí | Evidencia autoritativa luego pasa por enrichment |
| `organigrama.cv_extraction_language` | Idiomas por extracción | name, level, evidence | → extraction | UNIQUE (extraction, name_key) | Activa | — | Parcial | Fuera del catálogo skill |
| `organigrama.cv_extraction_certification` | Certificaciones | name, issuer, evidence | → extraction | — | Activa | — | Parcial | Sin catálogo compartido |
| `organigrama.cv_skill_enrichment` | Run enricher | status, is_active, hashes/versiones | → extraction | activa por extraction | Activa | 52 / **50 activas** | Sí | Hoy Gemini; manual puede sintetizar items |
| `organigrama.cv_skill_enrichment_item` | Evidencia enrich por skill | status OK/EMPTY/… | → enrichment, extraction_skill | UNIQUE | Activa | — | Sí | Input de evidence engine |
| `organigrama.cv_evidence_evaluation` | Scoring evidencia | status, is_active | → enrichment | activa por enrichment | Activa | 52 / **50 activas** | Sí | Determinista; reusable sin API key |
| `organigrama.cv_evidence_evaluation_item` | Nivel/strength/confidence | evidence_level, counts | → evaluation | UNIQUE | Activa | — | Sí | Alimenta PA2 |
| `organigrama.mc_catalog_version` | Versión catálogo | code, version, status, is_active | ← domains | UNIQUE (code,version); 1 activa | Activa | 3 versiones | Sí | Activa: `mc1.8-2026-07-28` |
| `organigrama.mc_domain` | Dominios | code, name, catalog_version_id | → catalog | UNIQUE (catalog, code) | Activa | 3 en catálogo activo | Sí | CONTENT/HR no operativos |
| `organigrama.mc_specialty` | Especialidades | code, domain_id, lifecycle_status | → domain | UNIQUE (catalog, code); lifecycle ACTIVE/EXPERIMENTAL/INACTIVE | Activa | **15** códigos activos | Sí | Especialidad ⊂ un solo dominio |
| `organigrama.mc_skill_domain_classification` | Clasificación skill×dominio | classification enum | catalog, domain, skill | UNIQUE | Activa | 323 (todas versiones) | Sí | Catálogo, no por persona |
| `organigrama.mc_skill_specialty_mapping` | Mapping skill→especialidad | weight, mapping_type | catalog, skill, specialty | UNIQUE; weight (0,1] | Activa | **101** en catálogo activo (48+42+11) | Sí | Skills multi-especialidad: 33 |
| `organigrama.mc_mapping_pack_release` | Releases mapping packs | pack_code/version, hash, status | — | UNIQUE (code,version) | Activa | 5 packs | Sí | Trazabilidad de mappings |
| `organigrama.mc_profile_evaluation` | Evaluación PA2 por dominio | domain_id, qualification, hashes, is_active | extraction, enrichment, evidence, catalog, domain | activa parcial por contexto | Activa | 73 SUCCEEDED / **19 activas** (19 personas) | Sí | Aquí vive “persona tiene dominio” |
| `organigrama.mc_profile_specialty_result` | Resultado por especialidad | coverage, confidence, strength, presentation_status, skill_breakdown | → evaluation, specialty | UNIQUE; default parcial | Activa | — | Sí | Fuente del radar |
| `organigrama.mc_evaluation_set` (+ domain) | Set multidominio | — | migración 023 | — | **Código presente; tabla NO en cloud** | 0 | No aún | No bloquear piloto |

**PA1 (`cv_attribute_*`):** paralelo; no alimenta el explorador/radar MC1. No tocar para esta entrega.

### C.2 Entidades TypeORM (muestra)

- `src/cv-skills/entities/*`
- `src/cv-skills-enrichment/entities/*`
- `src/cv-evidence/entities/*`
- `src/mc-catalog/entities/*`
- Sin entidad `PersonCv` (SQL directo)

### C.3 Servicios / pipeline

| Pieza | Archivo / clase | Estado |
| ----- | --------------- | ------ |
| Extracción Gemini | `CvSkillsExtractionService.extractSkills` | Implementado · API key |
| Prompt / schema / validación | `cv-skills.prompt.ts`, `.types.ts`, `.validation.ts` | Implementado |
| Normalizador + aliases código | `cv-skills.normalize.ts` (`SAFE_SKILL_ALIASES`) | Implementado |
| Persistencia extracción | `CvSkillsPersistenceService` | Implementado · activación 1/persona |
| Enrichment | `CvSkillsEnrichmentOrchestratorService` | Implementado · API key |
| Evidence | `evaluateEvidenceSkills` | Implementado · sin LLM |
| PA2 | `McPa2Service` / `runMcPa2Engine` | Implementado · sin LLM |
| Catálogo seed | `mc:catalog`, `mc:mappings` | Implementado |
| CDR cross-domain | `mc-cross-domain-resolver.ts` | Dry-run / no en API (`null`) |
| API competencias | `OrgChartCompetenciesService` | Implementado lectura |
| Carga manual JSON→BD | — | **No existe** |

### C.4 Endpoints HTTP

Prefijo `/api`. Guard JWT global + visibilidad de perfil completo.

| Método | Ruta | Servicio | Respuesta | Seguridad | Reutilizable |
| ------ | ---- | -------- | --------- | --------- | ------------ |
| GET | `/org-chart/person/:personId/cv` | `OrgChartCvService` | hasCv, viewUrl | JWT + visibilidad | Sí |
| GET | `/org-chart/person/:personId/competencies` | `getExplorerSummary` | dominio/especialidades resumen | JWT + visibilidad | Sí |
| GET | `.../competencies/professional-profile` | `getProfessionalProfile` | defaultDomain, dominios publishables, specialties, MVP | JWT + visibilidad | **Sí — preferido FE** |
| GET | `.../competencies/domains/:domainCode` | `getDomainDetail` | especialidades del dominio | JWT + visibilidad | Sí |
| GET | `.../domains/:domainCode/specialties/:specialtyCode` | `getSpecialtyDetail` | skills + evidencias + confidence | JWT + visibilidad | **Sí — hover/detalle** |

**No existen** endpoints de escritura para extracción, enrich, PA2 ni import manual.

El frontend **ya puede** consultar dominio principal, especialidades, skills por especialidad, evidencias y confianza vía professional-profile + specialty detail.

**Extender vs crear:** para el piloto **no hace falta endpoint nuevo**; hace falta **CLI importer** que deje la cadena persistida. Un endpoint de import sería fase posterior opcional.

### C.5 Scripts CLI (npm)

`sync:drive-cv`, `extract:cv-skills*`, `enrich:cv-skills*`, `evaluate:cv-evidence*`, `mc:catalog`, `mc:mappings`, `mc:evaluate` (`--dry-run` / `--i-confirm-evaluate`), audits/pilots RO, `mc:resolve-set:dry`, activaciones selectivas.

Patrones ya presentes: dry-run, confirmación explícita, idempotencia, validación por documento/cédula o `extractionId`.

### C.6 Frontend

Feature `Organigrama_Frontend/src/features/competencies/`:

- Radar **producción** (SVG propio; sin Recharts/Chart.js)
- Hover → debounce 200 ms → `GET specialty` → tooltip skills (`CompetencyRadarTooltip`)
- `SpecialtyDetailPanel` + `SkillAccordionItem` con evidencias
- Contratos en `features/competencies/types/index.ts`
- Hooks React Query en `useOrgPersonCompetencies.ts`

**Para hover de skills sobre especialidad del radar: ya está.** No implementar radar nuevo.

### C.7 Representación persona → … → evidencia

Sí existe, versionada:

```text
persona → person_cv → cv_extraction (activa)
        → cv_extraction_skill (skill + evidencia)
        → enrichment → evidence_evaluation
        → mc_profile_evaluation (dominio)
        → mc_profile_specialty_result (especialidad + métricas + breakdown)
```

---

## D. Datos actuales (consultas solo lectura, 2026-07-29)

| Métrica | Valor |
| ------- | ----- |
| Personas con CV activo | **127** (191 filas `person_cv`) |
| Extracciones totales | **235** |
| Extracciones SUCCEEDED | **167** |
| Extracciones activas | **139** |
| Extracciones FAILED | 68 (ninguna activa) |
| Extracciones sin `person_cv` / sin `person` | **0** / **0** |
| Enrichments activos | **50** |
| Evidence evaluations activas | **50** |
| Personas con evaluación dominio activa | **19** |
| Personas con especialidades (vía PA2 activa) | **19** |
| Personas con skills en extracción activa | **139** |
| Personas con cadena completa extraction→enrich→evidence→PA2 | **19** |
| Personas con `PRIMARY_MATCH` activo | **5** |
| Personas con >1 `PRIMARY_MATCH` activo | **0** |
| Skills en catálogo | **1310** (todas activas) |
| Aliases | **104** |
| Skills extraction activas sin evidencia | **0** |
| Resultados specialty huérfanos | **0** |
| Marcadores manuales en extracciones | **0** |
| Catálogo activo | `mc1-domains` / `mc1.8-2026-07-28` |
| Dominios activos | SOFTWARE (7 esp.), VISUAL_DESIGN (5), AUDIOVISUAL_PRODUCTION (3) |
| Especialidades sin mappings (activo) | `VISUAL_UI` (intencional / sin seed) |
| Dominios sin especialidades | 0 |
| Modelos extracción | `gemini-3.6-flash` + prompt `c1` (137) / `c2.1` (30) |

### Catálogo — muestras

**SOFTWARE (mapeos ejemplo):** Angular, React, Next.js, HTML5, CSS3, JavaScript → `SOFTWARE_FRONTEND` PRIMARY.

**VISUAL_DESIGN:** Adobe Photoshop/Illustrator, Diseño Gráfico, Ilustración → `VISUAL_GRAPHIC`; varias skills SECONDARY a identidad/editorial.

**Aliases ejemplo:** `js`→JavaScript (en código), `aws`→Amazon Web Services, `audition`→Adobe Audition, `consultas_sql_avanzadas`→SQL.

**Duplicados potenciales:** mismo `normalized_name`/`normalized_key` con distinto `skill_type` (p.ej. “Bases de datos” ×3). No viola UNIQUE; sí genera ruido de catálogo.

**Mapping packs publicados:** software-mappings, visual-design-mappings (1.1.0 / 1.2.0), audiovisual-production-mappings 1.0.0.

---

## E. Elementos reutilizables (mantener sin cambios estructurales)

1. Tablas de la cadena CV → PA2 (listadas en C.1).
2. Catálogo `mc_domain` / `mc_specialty` y seeds `mc:catalog` / `mc:mappings`.
3. `cv_skill` + `cv_skill_alias` + normalizador `SAFE_SKILL_ALIASES`.
4. Motor evidence + PA2 (`evaluate:cv-evidence`, `mc:evaluate`).
5. API de competencias y DTOs existentes.
6. Frontend radar + hover + detalle de especialidad.
7. Patrones CLI: dry-run, `--i-confirm-*`, activación de una extracción por persona.
8. Principio evidence-first y códigos estables de dominio/especialidad.

---

## F. Brechas para soportar carga manual

| Brecha | Detalle |
| ------ | ------- |
| Importer CLI | No hay script que lea JSON curado y haga upsert controlado |
| Marcador de origen | No hay `source` / `extraction_type`; hay que convención en `model`+versiones (+ `warnings`) |
| Puente enrichment | PA2 exige enrichment + evidence; hoy enrichment asume Gemini |
| Contrato JSON formal | No hay DTO/schema de “perfil curado multidominio”; el schema de extracción Gemini es parcial (skills, no dominio/especialidades) |
| Validación catálogo en import | Skills nuevas sin mapping no aparecen en radar aunque estén en extracción |
| `person_cv` obligatorio | Extracción exige `person_cv_id`; personas sin CV Drive necesitan registro o sync previo |
| Migración 023 | Evaluation set en código, no en cloud — no requerido para piloto |
| Dominios CONTENT/HR | Documentados, no operativos en PA2 seed |

**Lo que NO falta:** tablas persona-dominio nuevas, radar nuevo, endpoint de lectura nuevo, catálogo desde cero.

---

## G. Riesgos

| Riesgo | Impacto | Mitigación |
| ------ | ------- | ---------- |
| Duplicar skills por nombre/tipo | Contamina mappings y scores | Resolver vía alias + `normalized_key` + tipo explícito en JSON |
| Sobreescritura de extracción activa Gemini | Pierde historial activo (historial SUCCEEDED se conserva inactivo) | Dry-run; activar solo con confirm; documentar person_id |
| Saltar enrichment/evidence | PA2 no corre / API STALE | Importer debe materializar enrichment items desde evidencia curada |
| Skills sin mapping a especialidad | Persona “tiene skills” pero radar vacío/bajo | Validar mappings en dry-run; extender pack si hace falta |
| Incompatibilidad futura con extractor | Si se inventan tablas paralelas | **No crear** tablas persona-*; reutilizar cadena |
| Confundir cargo/área con dominio | Viola manifesto | Checklist curaduría; PA2 ya no usa cargo |
| Catálogo degradado (dupes por tipo) | Ruido | Reporte en dry-run; no merge automático agresivo |
| `VISUAL_UI` sin mappings | Especialidad siempre débil | Conocido; no bloquear piloto |

---

## H. Propuesta mínima (menor impacto)

```text
ChatGPT analiza CV (fuera del sistema)
    ↓
JSON curado (contrato piloto, ver Fase 1)
    ↓
CLI nuevo: mc:import-curated-profile
    --dry-run | --i-confirm-import
    ↓
Validar persona (document → core.person)
Validar/asegurar person_cv activo
Resolver skills (cv_skill + alias; crear solo si falta)
Validar domain/specialty codes contra catálogo ACTIVO
Validar mappings existentes (warning si skill sin specialty)
    ↓
Crear cv_extraction SUCCEEDED
  model = 'manual-curated'
  prompt_version = 'manual-curated-v1'
  extractor_version = 'manual-1.0.0'
  warnings incluye source=MANUAL_CURATED + observaciones
  pdf_sha256 = hash estable del JSON o del PDF si existe
    ↓
Insertar cv_extraction_skill + evidence_items
    ↓
Crear enrichment SUCCEEDED sintético (copiar evidencias curadas → items OK)
    ↓
evaluate:cv-evidence (reutilizar)
    ↓
mc:evaluate --domain=... (reutilizar PA2)
    ↓
API existente → radar existente
```

**Persistencia recomendada:** opción **1+2 combinadas** —

1. Nueva `cv_extraction` (origen manual, misma tabla).  
2. Evaluación MC1 (`mc_profile_evaluation`) asociada a esa extracción vía evidence/enrichment.  

**No** persistir solo en tablas persona-dominio (no existen).  
**No** escribir solo specialty_result sin cadena (rompe API/STALE y trazabilidad).

**Contrato:** adaptar el JSON conceptual del brief a un schema validado que alimente skills+evidencias+dominio objetivo; las especialidades/métricas del radar deben salir de **PA2**, no inventarse en el JSON (el JSON puede declarar dominio principal y skills agrupadas para validación humana, pero el score lo calcula el motor).

---

## I. Plan por fases

### Fase 0 — Auditoría (esta entrega)

| | |
| -- | -- |
| Objetivo | Diagnóstico RO y veredicto |
| Archivos | Este documento |
| Cambios | Ninguno de producto |
| Pruebas | Consultas SELECT ejecutadas |
| Aceptación | Documento con métricas y recomendación |
| Riesgos | Ninguno |
| Rollback | N/A |

### Fase 1 — Contrato JSON piloto

| | |
| -- | -- |
| Objetivo | Schema JSON + validador TypeScript (sin escritura BD) |
| Archivos afectados | `src/database/scripts/utils/curated-profile.schema.ts` (nuevo), fixture ejemplo, doc corta |
| Cambios | Contrato: document, domain.code, specialties[].skills[].canonicalName/evidence/confidence, warnings, source |
| Pruebas | Unit tests del validador; 1 fixture SOFTWARE y 1 VISUAL_DESIGN |
| Aceptación | JSON inválido rechazado; códigos de catálogo verificables en dry-run |
| Riesgos | Sobre-especificar especialidades vs dejarlas a PA2 |
| Rollback | Borrar schema/fixture |

### Fase 2 — Importación de una persona

| | |
| -- | -- |
| Objetivo | CLI dry-run + import confirmado de **un** perfil |
| Archivos | `mc-import-curated-profile.ts`, package.json script, helper persist enrichment sintético |
| Cambios | Upsert skills/aliases; extracción manual; enrichment sintético; llamar evidence + PA2 existentes |
| Pruebas | Dry-run sin writes; import en persona piloto; verificar `professional-profile` + specialty detail |
| Aceptación | Persona visible en radar con skills en hover; `model=manual-curated`; extracción Gemini previa inactiva pero conservada |
| Riesgos | FK person_cv; skills sin mapping |
| Rollback | Desactivar extracción/evaluación manual; reactivar extracción Gemini previa si aplica |

### Fase 3 — API

| | |
| -- | -- |
| Objetivo | Confirmar lectura suficiente; opcional incluir `source` en audit meta |
| Archivos | Posible extensión menor `CompetencyEvaluationMetaDto.audit` (solo si se quiere mostrar origen) |
| Cambios | Preferible **cero** cambios; o campo audit `extractionModel` ya disponible vía includeAudit |
| Pruebas | Smoke JWT de endpoints existentes |
| Aceptación | FE muestra dominio/especialidades/skills/evidencias sin endpoint nuevo |
| Riesgos | Scope creep HTTP write |
| Rollback | Revert DTO si se tocó |

### Fase 4 — Radar y hover

| | |
| -- | -- |
| Objetivo | Verificar UI; no reconstruir |
| Archivos | Ninguno o ajustes cosméticos mínimos |
| Cambios | Ninguno esperado |
| Pruebas | Manual en ficha: hover ejes, detalle skills |
| Aceptación | Tooltip muestra skills PRIMARY/SECONDARY; detalle con evidencia |
| Riesgos | Ninguno |
| Rollback | N/A |

### Fase 5 — Carga de 30–40 perfiles

| | |
| -- | -- |
| Objetivo | Batch de JSONs con dry-run global + confirm |
| Archivos | Directorio `curated-profiles/*.json`, reporte CLI |
| Cambios | Modo batch del importer; reporte OK/WARN/FAIL |
| Pruebas | Dry-run completo; import por lotes pequeños |
| Aceptación | N perfiles con evaluación activa y radar; reporte idempotente en re-run |
| Riesgos | Contaminación catálogo; rate de mappings faltantes |
| Rollback | Desactivar extracciones `manual-curated` del lote |

### Fase 6 — Validación final

| | |
| -- | -- |
| Objetivo | Checklist evidencia-first + compatibilidad con extractor automático |
| Archivos | Informe corto de validación |
| Cambios | Ninguno de arquitectura |
| Pruebas | Muestreo: evidencia textual real; sin inferencia por cargo; re-extracción Gemini no rompe historial |
| Aceptación | 30–40 perfiles presentables; extractor automático intacto |
| Riesgos | Presión de “atajos” de última hora |
| Rollback | N/A |

---

## J. Recomendación final (respuestas explícitas)

1. **¿Qué tablas reutilizar?**  
   `person_cv`, `cv_skill`, `cv_skill_alias`, `cv_extraction`, `cv_extraction_skill`, `cv_skill_enrichment` (+ items), `cv_evidence_evaluation` (+ items), `mc_catalog_version`, `mc_domain`, `mc_specialty`, `mc_skill_specialty_mapping`, `mc_skill_domain_classification`, `mc_profile_evaluation`, `mc_profile_specialty_result`, `mc_mapping_pack_release`.

2. **¿Qué tablas no tocar?**  
   PA1 `cv_attribute_*`; no crear `person_domain` / `person_specialty` / `person_skill`; no tocar `mc_evaluation_set` hasta aplicar 023 (no necesario ahora).

3. **¿Hace falta migración?**  
   **No** para el piloto de curaduría manual sobre el modelo actual. (023 es opcional y futura.)

4. **¿Hace falta catálogo nuevo?**  
   **No.** Usar catálogo activo `mc1.8`. Extender **mappings** (y aliases) solo cuando una skill curada no mapee a especialidad.

5. **¿Cómo identificar carga manual?**  
   Convención en extracción: `model='manual-curated'`, `prompt_version='manual-curated-v1'`, `extractor_version='manual-1.0.0'`, más `warnings` con `source=MANUAL_CURATED`. Campo `source` dedicado = mejora opcional posterior (sí migraría).

6. **¿Cómo evitar duplicar skills?**  
   Resolver por `normalized_key` + `skill_type`; consultar `cv_skill_alias`; crear skill solo si no existe; dry-run lista creaciones vs reuso.

7. **¿Cómo se relacionan skills con especialidades?**  
   Catálogo: `mc_skill_specialty_mapping` (PRIMARY/SECONDARY + weight). En perfil: PA2 proyecta skills evidenciadas sobre ese mapping hacia `mc_profile_specialty_result` / specialty detail API.

8. **¿Cómo se relacionan especialidades con dominios?**  
   FK `mc_specialty.domain_id` → `mc_domain`. Una especialidad pertenece a **un** dominio por versión de catálogo (verificado: 0 multi-dominio).

9. **¿Cómo se determina el dominio principal?**  
   En evaluación: `domain_qualification` (p.ej. `PRIMARY_MATCH`). En API/UI: `selectDefaultDomainCode` sobre dominios publishables (prioriza `PRIMARY_MATCH`). El JSON curado puede **proponer** dominio; PA2/calificación deben confirmarlo.

10. **¿Camino mínimo para una persona en el radar?**  
    JSON curado → import (extracción+skills+evidencia) → enrichment sintético → `evaluate:cv-evidence` → `mc:evaluate --domain=X` → abrir ficha → professional-profile + radar. Requiere `person_cv` y mappings para las skills.

11. **¿Mecanismo para las otras 30–40?**  
    Mismo CLI en batch sobre archivos JSON versionados en repo (o carpeta controlada), siempre dry-run → confirm → reporte. No SQL ad-hoc por persona.

12. **¿Qué del extractor automático se mantiene intacto?**  
    Prompt Gemini, schema extracción, enricher Gemini, evidence engine, PA2, seeds de catálogo, endpoints de lectura, frontend radar. Solo se **añade** un camino de entrada paralelo a `cv_extraction`.

---

## Compatibilidad fuentes (sección 7)

| Fuente conceptual | Soporte hoy |
| ----------------- | ----------- |
| `AI_EXTRACTION` | De facto: `model=gemini-*`, prompt/extractor versions |
| `MANUAL_CURATED` | **No tipado**; implementable por convención de versiones |
| `HUMAN_REVIEWED` | No existe |
| `MIGRATED` | No tipado |

Campos existentes útiles: `model`, `prompt_version`, `extractor_version`, `warnings`, hashes, `mapping_pack_*`, `algorithm_version`, timestamps.  
Ausentes: `source`, `provider`, `review_status`, `created_by`, `extraction_type`.

La carga manual puede reemplazarse/enriquecerse después activando otra extracción (Gemini) sin borrar historial SUCCEEDED inactivo.

---

## Versionamiento y trazabilidad (sección 8)

| Capacidad | ¿Existe? |
| --------- | -------- |
| Múltiples extracciones por persona | Sí |
| Una extracción activa | Sí |
| Historial | Sí (filas inactivas) |
| Reemplazar / desactivar anteriores | Sí (activación) |
| Registrar fuente | Parcial (model/versiones) |
| Fecha | Sí (`created_at` / `evaluated_at`) |
| Responsable | No (`created_by` ausente) |
| Versión catálogo | Sí (`catalog_version_id`) |
| Evidencia | Sí |
| Advertencias | Sí (`warnings`) |
| Comparar versiones | CLI compare/inspect parcial |

---

## Apéndice — Restricciones de esta fase

- Sin escrituras en BD  
- Sin migraciones  
- Sin cambios de código de producto  
- Sin inserts / deletes  
- Sin construcción de radar nuevo  
- Sin modificación del extractor automático  

Única entrega: este documento de diagnóstico y propuesta.
