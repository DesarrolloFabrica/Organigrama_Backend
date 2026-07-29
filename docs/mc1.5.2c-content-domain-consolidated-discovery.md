# MC1.5.2C — Descubrimiento consolidado (dominio contenidos / Nidia)

**Persona:** NIDIA MARCELA PRADA RAMIREZ (`personId=1163`, documento `1015482688`, `personCvId=7`)  
**Fecha:** 2026-07-27  
**Alcance:** reextracción + Enrichment + Evidence sobre PDF vigente. **Sin PA2, sin catálogo, sin mappings, sin frontend.**

---

## 1. Fuente histórica (MC1.5.2B)

| Capa | ID | Hash PDF | Estado al cerrar 1.5.2B |
|------|-----|----------|-------------------------|
| Extracción | **87** | `6c292f8c79fc90846631403f36cbf06f452d64b1770b6fe0a99091620a6d053c` | SUCCEEDED + activa |
| Enrichment | **4** | `6c29…` (persistido; análisis había usado PDF vivo) | SUCCEEDED + activa |
| Evidence | **4** | vía enrichment 4 | SUCCEEDED + activa |
| Skills | 9 | — | 0 STRONG · 2 MODERATE · 3 WEAK · 4 NONE |

### Drift encontrado

| Campo | Valor |
|-------|--------|
| Causa | **`PDF_SOURCE_CHANGED`** — no es un bug del pipeline de extracción |
| Hash extracción 87 | `6c292f8c…6d053c` |
| Hash PDF vigente | `467d7dbe…f86f3a6` |
| `drive_file_id` extracción 87 | `1-yrvcQUj8QbsXo3idatsnLFByAJGImjR` |
| `drive_file_id` person_cv 7 | `15JMUTCX4mtnx0VH0yCO24CXifE42lACO` (**distinto**) |
| `drive_modified_time` | `2026-07-24T13:42:18.000Z` |
| `drive_md5_checksum` | `b2eed475307d435df1976fcbeed43225` |
| `person_cv.synced_at` | `2026-07-24T19:59:06.977Z` |
| Extracción 87 `finished_at` | `2026-07-22T21:24:20.179Z` (**antes** del PDF vigente) |

**Por qué 87 seguía activa:** la idempotencia de extracción es `(person, pdf_sha256, model, prompt, extractor)`. Un PDF nuevo (hash distinto y, en este caso, **otro** `drive_file_id`) **no** desactiva automáticamente la SUCCEEDED previa hasta completar una nueva extracción del hash vigente. El sistema **sí** distingue contenido por SHA-256; no hubo reutilización incorrecta del hash.

Auditoría: `tmp/cv-attributes/mc1.5.2c-preflight-drift.json` (PDF estable en doble descarga).

---

## 2. Fuente vigente (pipeline coherente)

| Capa | ID | Hash | Estado |
|------|-----|------|--------|
| Extracción | **207** | `467d7dbea064e77535fe2c3742e58c6adfff499fc98745f3a68844d62f86f3a6` | SUCCEEDED + **activa** |
| Enrichment | **5** | **mismo** `467d…` | SUCCEEDED + **activa** |
| Evidence | **5** | enrichment 5 → extracción 207 | SUCCEEDED + **activa** |

**Igualdad demostrable:**

```
extraction.pdf_sha256
  = enrichment.pdf_sha256
  = 467d7dbea064e77535fe2c3742e58c6adfff499fc98745f3a68844d62f86f3a6
```

Evidence no tiene columna propia de hash; la cadena se verifica por `evidence.enrichment_id → enrichment.pdf_sha256 → extraction.pdf_sha256`.

**Metadatos de fuente (extracción 207):**

- `drive_file_id`: `15JMUTCX4mtnx0VH0yCO24CXifE42lACO`
- `person_cv_id`: 7
- modelo: `gemini-3.6-flash`
- `prompt_version`: `c2.1-2026-07-24`
- `extractor_version`: `1.1.0`

**Históricos conservados:** extracción 87 (`is_active=false`, skills intactas); enrichment 4 y evidence 4 desactivados vía CLI oficial / `deactivate` (filas SUCCEEDED conservadas).

**Integridad:** `tmp/cv-attributes/mc1.5.2c-integrity.json` → `hashChainOk=true`, `zeroPa2=true`, una sola capa activa por tipo.

---

## 3. Comparación extracción 87 vs 207

| Aspecto | Extracción 87 | Extracción 207 |
|---------|---------------|----------------|
| Total skills | 9 | **37** |
| Skills técnicas/creativas (conocimiento profesional) | ~6 | Diseño Gráfico, Editorial, Instruccional, Comunicación Visual, Microaprendizaje, QA, Gestión de proyectos |
| Herramientas | **0** (gap crítico) | Illustrator, Photoshop, InDesign, Premiere, After Effects, Canva, CapCut, Moodle, iSpring, Genially, isEAZY, Midjourney, Runway, Grok |
| Metodologías | Optimización de prompts | Prompting (+ QA / gestión) |
| Transversales / soft | Liderazgo creativo | 12 soft skills listadas |
| Skills con evidencia EE ≥ WEAK | 5 | 12 (6 MODERATE + 6 WEAK) |
| Skills NONE | **4** | **25** (mayormente herramientas/soft listadas) |
| Warnings extractor | — | 0 |
| Evidence resumen | 0/2/3/4 | **0 STRONG · 6 MODERATE · 6 WEAK · 25 NONE** |

### Clasificación de cambios (skills de 87)

| Skill 87 | Cambio | Nota |
|----------|--------|------|
| Diseño publicitario | **REMOVED** | Ya no es skill propia; “publicitario” queda solo en texto de evidencia de editorial/instruccional |
| Diseño editorial | **UNCHANGED** (nombre) / **EVIDENCE** similar | Sigue WEAK 5 |
| Diseño instruccional | **UNCHANGED** / evidencia aún débil en el nombre | WEAK 2; **refuerzo lateral** vía SCORM/LMS MODERATE |
| Edición audiovisual | **REMOVED** (como skill PK) | Sustituida por herramientas Premiere/AE/CapCut con Evidence NONE |
| Inteligencia Artificial | **EVIDENCE_ENRICHED** | MODERATE 55 → **63**; más fuentes aplicadas |
| Optimización de prompts | **RENAMED_OR_NORMALIZED** → Prompting | WEAK 39 → **MODERATE 50** |
| Pensamiento estratégico en diseño | **REMOVED** | Sin skill equivalente |
| Planificación de contenido | **REMOVED** | Sin skill equivalente |
| Liderazgo creativo | **RENAMED_OR_NORMALIZED** → Liderazgo de equipos (soft) | Evidence NONE |

### Skills ADDED relevantes (muestra)

Diseño Gráfico (MODERATE 66), suite Adobe, Canva, CapCut, SCORM, LMS, Moodle, iSpring, Genially, isEAZY, Midjourney, Runway, Grok, Control de Calidad (QA) MODERATE 50, Comunicación Visual, Microaprendizaje, soft skills.

**Calidad:** más skills ≠ automáticamente mejor. El salto 9→37 mejora **cobertura de herramientas y e-learning**; muchas filas quedan NONE (listings). La señal profesional fuerte se concentra en pocas skills MODERATE.

---

## 4. Cobertura temática (PDF vigente)

| Tema | ¿Capturado? | Evidencia EE |
|------|-------------|--------------|
| Diseño gráfico | Sí (skill) | **MODERATE 66** |
| Diseño editorial | Sí | WEAK 5 |
| Diseño publicitario | Solo mención en texto | Sin skill; no inventar |
| Diseño instruccional | Sí | WEAK 2 + SCORM/LMS MODERATE |
| Recursos educativos / LMS / SCORM | Sí | MODERATE |
| Herramientas de autor (iSpring, Genially, isEAZY) | Sí | NONE (listing) |
| Edición audiovisual | Herramientas sí | NONE |
| Identidad visual / diagramación | No como skills explícitas | — |
| Planificación de contenidos | No | Gap |
| Dirección creativa | No | — |
| IA generativa / prompting | Sí | MODERATE |
| Illustrator / Photoshop / InDesign / Premiere / AE / Canva | Sí | WEAK/NONE (perfil o listing) |

---

## 5. Clasificación documental de skills (nueva)

Solo skills con señal profesional relevante (no se listan todas las soft/NONE):

| Skill | Clasificación |
|-------|----------------|
| Diseño Gráfico | **PROFESSIONAL_CORE** |
| Inteligencia Artificial | **PROFESSIONAL_SUPPORT** |
| Prompting | **PROFESSIONAL_SUPPORT** |
| SCORM | **PROFESSIONAL_SUPPORT** |
| LMS | **PROFESSIONAL_SUPPORT** |
| Control de Calidad (QA) | **PROFESSIONAL_SUPPORT** |
| Diseño editorial | **AMBIGUOUS** |
| Diseño instruccional | **AMBIGUOUS** (refuerzo por SCORM/LMS) |
| Adobe Illustrator / Photoshop / InDesign | **PROFESSIONAL_SUPPORT** (herramienta; evidencia débil) |
| Premiere / After Effects / CapCut / Canva / Midjourney / … | **INSUFFICIENT_EVIDENCE** (solo listing) |
| Soft skills | **TRANSVERSAL** |

*(Clasificación documental; no persistida en tablas MC.)*

---

## 6. Área candidata (re-evaluada)

| Opción | Veredicto |
|--------|-----------|
| **Diseño y producción de contenidos** | **Recomendada** — cubre gráfico + educativo digital + producción asistida por IA |
| Diseño de contenidos | Corta; pierde producción / e-learning |
| Creación y producción de contenidos | Válida pero más vaga |
| Comunicación y producción de contenidos | Sesgo comunicación |
| Diseño gráfico y producción de contenidos | Plausible; estrecha el área hacia gráfico y deja menos claro el bloque SCORM/LMS |

La denominación **no** se hereda de 1.5.2B por inercia: se mantiene porque la evidencia vigente sigue siendo multi-modal (gráfico + e-learning + IA en flujo), no solo “diseño gráfico”.

---

## 7. Especialidades candidatas (re-evaluadas)

| Especialidad | Estado | Motivo |
|--------------|--------|--------|
| **Diseño gráfico** (núcleo de “Diseño gráfico y publicitario”) | **SUPPORTED** | Diseño Gráfico MODERATE 66 (experiencia + educación + perfil) + herramientas Adobe presentes |
| Diseño gráfico y publicitario (agrupación literal) | **EMERGING** | Gráfico sí; **publicitario** solo mención nominal sin skill ni actividad EE suficiente |
| Diseño editorial | **INSUFFICIENT** | WEAK 5; una mención de perfil no basta |
| Diseño instruccional | **EMERGING** | Nombre WEAK; actividad coherente vía SCORM/LMS MODERATE + herramientas de autor |
| Producción audiovisual | **INSUFFICIENT** | Solo herramientas en skills section (NONE) |
| Estrategia y planificación de contenidos | **REJECTED** | Ausente en extracción 207 |
| IA aplicada a contenidos | **EMERGING** | IA 63 + Prompting 50 + tools; uso aplicado en flujo, no especialidad autónoma congelable |
| Dirección creativa | **REJECTED** | Sin skill / evidencia |

**Regla aplicada:** ninguna especialidad pasó a SUPPORTED solo por cargo, herramienta aislada o mención nominal.

---

## 8. Corrección del descubrimiento preliminar

### Afirmación 1.5.2B a corregir

> ACTIVE_CANDIDATE: **Diseño editorial y gráfico**  
> (publicitario MODERATE 45 + editorial WEAK 5)

### Veredicto 1.5.2C

**No es válida.** No agrupar editorial + gráfico:

1. Editorial sigue **WEAK 5** (insuficiente).
2. **Diseño publicitario** ya no es skill evaluable; no hay MODERATE publicitario en la cadena vigente.
3. La señal fuerte es **Diseño Gráfico** (66), no editorial.

**Reemplazo documental:**

- Agrupación activa candidata: **Diseño gráfico** (no “editorial y gráfico”).
- “Diseño gráfico y publicitario” solo como **EMERGING** hasta que exista evidencia de actividad publicitaria (no solo la palabra en un resumen).

---

## 9. Tratamiento de IA

| Pregunta | Respuesta |
|----------|-----------|
| ¿Herramienta de soporte? | Sí (Midjourney, Runway, Grok; Evidence NONE en tools) |
| ¿Skill profesional? | Sí — **Inteligencia Artificial** MODERATE 63 + **Prompting** MODERATE 50 |
| ¿Actividad transversal? | Parcialmente (cruza producción visual / contenidos / QA) |
| ¿Especialidad “IA aplicada a contenidos”? | **EMERGING**, no SUPPORTED |

Hay recurrencia y uso en responsabilidades (“gestión de contenidos mediante IA”, “producción visual a través de IA”, prompting estratégico). Aun así falta autonomía de especialidad (productos/roles exclusivamente IA). **No** congelar especialidad MC solo por esta señal.

---

## 10. Límites y riesgos

1. **25 skills NONE** — riesgo de sobrepeso de listings si PA2/mappings se hicieran sin filtro de Evidence.
2. **Publicitario sub-extraído** respecto a 87 — posible pérdida de señal; no inventar skill.
3. **Planificación / dirección creativa / identidad visual** siguen fuera o nominales.
4. Enrichment/Evidence históricos de extracción 87 no son aplicables al PDF vigente.
5. Prompt/extractor cambiaron (`c1`/`1.0.0` → `c2.1`/`1.1.0`): parte del salto 9→37 es versión de extractor, no solo PDF.

---

## 11. Integridad final

| Check | Resultado |
|-------|-----------|
| Una extracción activa | **207** |
| Una Enrichment activa de esa extracción | **5** |
| Una Evidence activa de ese enrichment | **5** |
| Hashes coherentes | **Sí** (`467d…`) |
| Históricos 87 / 4 / 4 | Conservados, inactivos |
| PA2 | **0** |
| Mappings / catálogo nuevo / frontend / Software | **0 cambios** |

Artefactos: este documento; `tmp/cv-attributes/mc1.5.2c-1015482688-pipeline-comparison.json`.
