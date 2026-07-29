# MC1.6.1C.3 — Validación dirigida Diseño Visual (ronda 2)

**Fecha:** 2026-07-28  
**Alcance:** 4 candidatos por documento; cadena CV completa; dry-run PA2 V2 **sin persistir** PA2.  
**Motor:** `visual-design-mappings@1.1.0` + `pa2-visual-design-1.1.0`  
**Artefactos:** `tmp/mc161c3-preflight.json`, `tmp/mc161c3-dryruns/*-v2.json`, `tmp/cv-skills/*.json`, `tmp/cv-evidence/enrichment-*-er2-*.json`

**Referencias de comparación:** Nidia (`207`) y Garzón (`209`) — dry-runs V2 en `tmp/mc161c2-dryruns/`.

---

## 0. Resumen ejecutivo

| # | Pregunta | Respuesta corta |
|---|----------|-----------------|
| 1 | ¿Segundo MATCH+ACTIVE además de Nidia? | **Sí — Daniel A. Pérez Sánchez** (`1032488010`, ext `212`). |
| 2 | ¿Garzón es caso especial? | **Parcialmente.** El patrón EMERGENT-sin-ACTIVE se repite (Poveda, Laura); Daniel rompe el patrón con ACTIVE gráfico. |
| 3 | ¿EDITORIAL necesita más mappings? | **Sí** — alias/compuestos para variantes de nombre editorial e identidad. |
| 4 | ¿IDENTITY calibrado? | **Parcial** — funciona con `diseno_de_identidad_visual` (Garzón); falla con otras formulaciones del CV. |
| 5 | ¿VISUAL_UI sin evidencia? | **Sí** — sin mappings en pack; UX en CV no entra al radar PA2. |
| 6 | ¿DIGITAL_ASSETS es especialidad real? | **No aún** — sigue comportándose como agrupación débil de tools (InDesign/Canva). |
| 7 | ¿Skills profesionales repetidas fuera del catálogo? | **Sí** — ver §8. |
| 8 | ¿V3 o V2 validado? | **V2 validado estructuralmente**; siguiente paso = **V2.1 aliases** (no rediseño V3). |

---

## 1. Cadena CV ejecutada

Pipeline vigente: prompt `c2.1-2026-07-24`, extractor `1.1.0`, evidence `er2`.

| Documento | Persona | person_id | ext | enr | ev | source_hash (prefijo) |
|-----------|---------|-----------|-----|-----|-----|------------------------|
| 1032488010 | DANIEL ALEJANDRO PEREZ SANCHEZ | **1164** | **212** | **10** | **10** | `e8564a16…` |
| 1001294362 | DIEGO FERNANDO PEREZ MINDIOLAO | **1168** | **213** | **11** | **11** | `fef6ec19…` |
| 1000254881 | DANNA MICHELLE POVEDA CAÑON | **1182** | **215** | **13** | **13** | `c87040c2…` |
| 1000366409 | LAURA MELISA PEREZ VELASCO | **1167** | **214** | **12** | **12** | `793b8a0c…` |

Todas tenían extracción **obsoleta** (`c1` / `1.0.0`) y **sin** enrichment/evidence. Se re-extrajo y completó cadena. **PA2 no persistido** (solo dry-run).

---

## 2. Identidad organizacional (preflight)

| Documento | Nombre | Rol | Área | Jefe |
|-----------|--------|-----|------|------|
| 1032488010 | Daniel A. Pérez Sánchez | ANALISTA DE DISEÑO DE CONTENIDOS | FABRICA Y DESARROLLO | Vacante — Coordinador Fábrica de Contenidos |
| 1001294362 | Diego F. Pérez Mindiolao | idem | idem | idem |
| 1000254881 | Danna M. Poveda Cañon | idem | idem | idem |
| 1000366409 | Laura M. Pérez Velasco | idem | idem | idem |

Mismo rol y área que Nidia/Garzón; **el rol no implica dominio** — se valida solo con evidencia CV.

---

## 3. Auditoría individual

### 3.1 Daniel A. Pérez Sánchez — `1032488010`

**Lectura manual del CV (pre-PA2)**  
- Perfil **híbrido**: liderazgo en **diseño gráfico** (proyectos, retoque, maquetación publicitaria) **y** fuerte peso **e-learning** (diseño instruccional, SCORM, LMS, granulación).  
- Tools Adobe con evidencia laboral aplicada (Photoshop/Illustrator en retoque y piezas).  
- Premiere y PowerPoint en contexto de materiales de aprendizaje.  
- Comunicación visual listada pero sin sustancia en evidence engine.

**Clasificación conceptual (solo CV):** **MATCH** — núcleo gráfico con evidencia laboral; frontera pedagógica presente pero no domina el perfil gráfico.

**Dry-run V2** (`tmp/mc161c3-dryruns/daniel-v2.json`)

| Campo | Valor |
|-------|-------|
| Dominio | VISUAL_DESIGN |
| Principal PA2 | **VISUAL_GRAPHIC** (ACTIVE, default) |
| ACTIVE / EMERGENT / HIDDEN | **1 / 0 / 4** |
| Visibility gate | `professionalEvidencedCount 1 >= 1` en GRAPHIC |

**Contribuciones (GRAPHIC ACTIVE, desde breakdown):**

| Tipo | Skills activadas | Contrib. strength ≈ |
|------|------------------|---------------------|
| Profesional | `diseno_grafico` (MODERATE 63.5) | **63.5** |
| Tool | `adobe_illustrator`, `adobe_photoshop` (WEAK ~37) | **~18.7** |

**Mappings utilizados:** `diseno_grafico`→GRAPHIC; Illustrator/Photoshop→GRAPHIC; InDesign→EDITORIAL (PRIMARY) y DIGITAL (SECONDARY).

**Mappings descartados / no visibles:**

| Skill / área | Motivo |
|--------------|--------|
| InDesign → EDITORIAL, DIGITAL | **anti-tool** (solo tool evidenciada) |
| `comunicacion_visual` → IDENTITY | sin evidencia (NONE) |
| SCORM, LMS, diseño instruccional | **OUTSIDE** pack (correcto) |
| `retoque_fotografico`, `maquetacion_publicitaria` | **sin key en pack** (gap) |
| Adobe Premiere | no mapeado / OUTSIDE AV |

**Explicación:** ACTIVE gráfico defendible: profesional MODERATE + 2 tools débiles; anti-tool oculta InDesign pese a WEAK; e-learning no contamina el dominio visual.

**vs Nidia:** Mismo patrón ACTIVE GRAPHIC; Daniel sin EMERGENT editorial (fuerza editorial más débil que Nidia).

**vs Garzón:** Opuesto — Daniel alcanza ACTIVE; Garzón queda EMERGENT identidad.

---

### 3.2 Diego F. Pérez Mindiolao — `1001294362`

**Lectura manual del CV**  
- Perfil **identidad / branding / ilustración** (“creación de marca, ilustración digital, medios editoriales y audiovisuales”).  
- Adobe Creative Cloud + apps listadas; evidencia aplicada en identidad (trabajo con PYMEs).  
- Fotografía y estrategia de comunicación visual en skills.  
- CV corto (19 skills); menos profundidad que Daniel/Poveda.

**Clasificación conceptual:** **MATCH** (disciplina visual clara) con **riesgo de gap de catálogo** en formulaciones de identidad.

**Dry-run V2** (`tmp/mc161c3-dryruns/diego-v2.json`)

| Campo | Valor |
|-------|-------|
| Dominio | VISUAL_DESIGN (por rol + skills, pero PA2 no refleja) |
| Principal PA2 | **ninguna** |
| ACTIVE / EMERGENT / HIDDEN | **0 / 0 / 5** |

**Contribuciones:** 0 visibles — ninguna especialidad con evidencia mapeada.

**Evidence relevante no mapeada:**

| Skill en CV | evidence | ¿En pack V2? |
|-------------|----------|--------------|
| Branding y Diseño de Identidad Corporativa | **MODERATE 50** | **No** (gap) |
| Ilustración Digital | NONE | No |
| Fotografía Digital | débil | No |
| Estrategia de Comunicación Visual | listing | No (`comunicacion_visual` existe pero skill distinta) |
| Adobe Illustrator/Photoshop | NONE (solo listing CC) | Sí, pero sin evidencia → HIDDEN |

**Explicación:** Fracaso de **catálogo/alias**, no de dominio. El CV sustenta identidad visual; el pack no reconoce la key extraída. Anti-tool irrelevante: ni siquiera hay skill profesional mapeada.

**Clasificación post-PA2:** **BORDERLINE** (dominio sí, motor no puede expresarlo).

---

### 3.3 Danna M. Poveda Cañon — `1000254881`

**Lectura manual del CV**  
- Título profesional en **diseño gráfico**; 3+ años.  
- Mezcla: gráfico, **identidad visual**, **diseño editorial y diagramación**, prototipado UI/UX, producción AV, marketing digital (STRONG), IA generativa.  
- Tools Adobe mayormente **listing** en skills section.

**Clasificación conceptual:** **BORDERLINE** — núcleo visual claro pero perfil **multidominio** (AV, marketing, UX).

**Dry-run V2** (`tmp/mc161c3-dryruns/poveda-v2.json`)

| Campo | Valor |
|-------|-------|
| Principal PA2 | **ninguna** (rank 1 = GRAPHIC EMERGENT) |
| ACTIVE / EMERGENT / HIDDEN | **0 / 1 / 4** |

**GRAPHIC EMERGENT:**

| Tipo | Skill | Evidencia |
|------|-------|-----------|
| Profesional | `diseno_grafico` | MODERATE 66 |
| Tool | Illustrator, Photoshop | NONE |

**Motivos EMERGENT:** `evidencedSkillCount 1 < 2`, coverage &lt; 0.45, single-skill dominance.

**Skills con evidencia MODERATE no usadas por PA2:**

| Skill CV | Evidencia | Gap |
|----------|-----------|-----|
| Identidad visual | MODERATE | no key (`diseno_de_identidad_visual` / `comunicacion_visual`) |
| Diseño Editorial y Diagramación | MODERATE | compuesto; no `diagramacion_editorial` ni `diseno_editorial` |
| Producción y Edición Audiovisual | MODERATE | OUTSIDE (correcto) |
| Marketing Digital | STRONG | OUTSIDE (correcto) |
| Prototipado UI/UX | WEAK | sin mapping VISUAL_UI |

**vs Garzón:** **Mismo patrón** — EMERGENT por cardinalidad baja (1 skill profesional mapeada con evidencia); identidad/editorial en CV no entran por aliases.

---

### 3.4 Laura M. Pérez Velasco — `1000366409`

**Lectura manual del CV**  
- Ilustración, **branding**, **diseño editorial** con publicación educativa; UX/UI en propuestas.  
- Diseño instruccional + IA (frontera pedagógica).  
- Tools Adobe = listing sin experiencia aplicada en evidence.

**Clasificación conceptual:** **BORDERLINE** — editorial + identidad; tools débiles.

**Dry-run V2** (`tmp/mc161c3-dryruns/laura-v2.json`)

| Campo | Valor |
|-------|-------|
| Principal PA2 | **VISUAL_EDITORIAL** (EMERGENT rank 1) |
| ACTIVE / EMERGENT / HIDDEN | **0 / 1 / 4** |

**EDITORIAL EMERGENT:**

| Tipo | Skill | Evidencia |
|------|-------|-----------|
| Profesional | `diseno_editorial` | **MODERATE 51.5** |
| Tool | InDesign | NONE |

**Skills MODERATE no mapeadas:** `Branding e Identidad de Marca`, `Ilustración digital` (WEAK), `Diseño UX/UI` (WEAK), `Diseño instruccional` (OUTSIDE).

**Explicación:** Confirma que **EDITORIAL responde** cuando la key canónica coincide; identidad/branding paralelo queda fuera.

---

## 4. Tabla comparativa PA2 V2

| Persona | ext | Conceptual | PA2 default | A | E | H | Patrón |
|---------|-----|------------|-------------|---|---|---|--------|
| **Nidia** | 207 | MATCH | VISUAL_GRAPHIC | 1 | 1 | 3 | Referencia ACTIVE |
| **Garzón** | 209 | MATCH | — | 0 | 3 | 2 | EMERGENT identidad/editorial |
| **Daniel** | 212 | MATCH | **VISUAL_GRAPHIC** | **1** | 0 | 4 | **Segundo ACTIVE** |
| Diego | 213 | MATCH→gap | — | 0 | 0 | 5 | Todo HIDDEN (catálogo) |
| Poveda | 215 | BORDERLINE | — | 0 | 1 | 4 | ≈ Garzón (GRAPHIC EMERGENT) |
| Laura | 214 | BORDERLINE | — | 0 | 1 | 4 | EMERGENT editorial |

---

## 5. Patrones transversales

1. **ACTIVE gráfico** requiere `diseno_grafico` MODERATE + ≥2 skills evidenciadas mapeadas (tools débiles cuentan tras anti-tool).  
2. **Garzón no es único:** Poveda y Laura muestran EMERGENT con 1 profesional fuerte; umbrales `minimumMappedSkills=2` / `minimumEvidencedSkills=2` bloquean ACTIVE.  
3. **Gaps de alias** concentrados en **identidad** y **editorial compuesto** — perfiles con MATCH conceptual caen a HIDDEN/EMERGENT.  
4. **Anti-tool V2** funciona: InDesign solo no activa EDITORIAL/DIGITAL (Daniel, Poveda, Laura).  
5. **VISUAL_UI** y **DIGITAL_ASSETS** no producen señal estable: UX sin mapping; digital = InDesign/Canva sin profesional.  
6. **E-learning / AV / marketing** correctamente fuera o sin mapping — no diluyen dominio cuando están OUTSIDE.

---

## 6. Respuestas a las 8 preguntas

### 1. ¿Segundo MATCH+ACTIVE además de Nidia?

**Sí.** **Daniel Pérez** (`1032488010`): MATCH conceptual y **ACTIVE `VISUAL_GRAPHIC`** en dry-run V2. Es el segundo perfil con MATCH+ACTIVE en esta ronda.

### 2. ¿Garzón sigue siendo caso especial?

**El patrón EMERGENT-sin-ACTIVE se repite** (Poveda, Laura; también Correa/Angulo en ronda anterior). **Garzón no es outlier metodológico** — es la manifestación típica de perfiles con 1 eje profesional fuerte y cardinalidad baja. **Daniel** demuestra que ACTIVE **sí es alcanzable** con el mismo pack/PA2 cuando hay ≥2 evidencias mapeadas en la especialidad.

### 3. ¿VISUAL_EDITORIAL necesita más mappings?

**Sí, moderadamente.** `diseno_editorial` y `diagramacion_editorial` cubren casos simples (Laura, Garzón). Faltan **aliases** para:

- `Diseño Editorial y Diagramación` (compuesto — Poveda, MODERATE)  
- Posible puente desde maquetación publicitaria / diagramación en CVs de fábrica de contenidos  

No implica nueva especialidad; sí **normalización + mapping**.

### 4. ¿VISUAL_IDENTITY calibrado?

**Parcialmente.**  
- **OK:** `diseno_de_identidad_visual` (Garzón EMERGENT).  
- **Fallo:** variantes frecuentes en CV no enlazan: `Branding y Diseño de Identidad Corporativa`, `Branding e Identidad de Marca`, `Identidad visual` (Poveda MODERATE sin entrada PA2).  
- Diego es el caso extremo: **MODERATE 50 en identidad** → **0 especialidades** por gap.

### 5. ¿VISUAL_UI sin evidencia suficiente?

**Sí.** Sin mappings en pack V2; `Diseño UX/UI` / prototipado en Laura y Poveda quedan **fuera del radar**. Correcto no forzar UI hasta política de frontera UX/UI.

### 6. ¿VISUAL_DIGITAL_ASSETS es especialidad real?

**Aún no.** Sigue siendo **agrupación de tools** (InDesign SECONDARY, Canva PRIMARY). Sin profesional dedicado; anti-tool la oculta cuando solo hay tools. No promover a eje sin skill profesional de “activos digitales”.

### 7. ¿Skills profesionales repetidas fuera del catálogo?

**Sí**, observadas en ≥2 perfiles de esta ronda o hermanos:

| Skill / formulación CV | Personas | Propuesta |
|------------------------|----------|-----------|
| Branding / Identidad (variantes) | Diego, Laura, Poveda | Alias → `diseno_de_identidad_visual` o `comunicacion_visual` |
| Ilustración digital | Diego, Laura | Nueva key o alias → GRAPHIC |
| Diseño Editorial y Diagramación | Poveda | Alias split → `diseno_editorial` + `diagramacion_editorial` |
| Identidad visual (minúscula) | Poveda | Alias → IDENTITY |
| Retoque fotográfico / Maquetación publicitaria | Daniel | Alias → GRAPHIC o EDITORIAL (bajo peso) |
| Producción y edición audiovisual | Poveda | Mantener OUTSIDE |
| Marketing digital | Poveda | OUTSIDE (no visual core) |

### 8. ¿Evidencia para V3 o V2 validado?

**Visual Design V2 queda validado** en comportamiento (anti-tool, Nidia estable, segundo ACTIVE con Daniel, EMERGENT coherentes).  
**No hay evidencia para V3** (rediseño de especialidades o PA2).  
**Sí hay evidencia para V2.1** = pack **1.1.1** con:

- Aliases de identidad/branding (3–4 formulaciones)  
- Alias editorial compuesto  
- Opcional: `ilustracion_digital` → GRAPHIC  
- **No** bajar umbrales PA2 para “fabricar” ACTIVE  

---

## 7. Propuesta Visual Design V2.1 (no implementada)

| Cambio | Tipo | Prioridad |
|--------|------|-----------|
| `branding_y_diseno_de_identidad_corporativa` → IDENTITY | alias/key | P0 |
| `branding_e_identidad_de_marca` → IDENTITY | alias | P0 |
| `identidad_visual` → `diseno_de_identidad_visual` | alias | P0 |
| `diseno_editorial_y_diagramacion` → split editorial | alias | P1 |
| `ilustracion_digital` → GRAPHIC | nueva key | P2 |
| Re-evaluar override baja cardinalidad para IDENTITY | PA2 config | P2 (solo tras aliases) |

**No propuesto:** V3, mappings VISUAL_UI, rebajar `minimumEvidencedSkills`, persistir PA2 de esta ronda.

---

## 8. Comandos de reproducción

```text
# Cadena (ejemplo Daniel)
npm run extract:cv-skills -- --document=1032488010 --persist
npm run enrich:cv-skills -- --extractionId=212 --persist --i-confirm-persist --activate --i-confirm-activate
npm run evaluate:cv-evidence -- --enrichmentId=10 --persist --i-confirm-persist --activate --i-confirm-activate

# Dry-run PA2 V2 (sin persistir)
npm run mc:evaluate -- --extraction-id=212 --domain=VISUAL_DESIGN \
  --rules-version=pa2-visual-design-1.1.0 --dry-run \
  --out=tmp/mc161c3-dryruns/daniel-v2.json
```

---

## 9. Veredicto de fase

**VISUAL DESIGN V2 — VALIDADO CON GAPS DE ALIAS (V2.1 RECOMENDADO)**

- Segundo **MATCH+ACTIVE** confirmado (Daniel).  
- Patrón Garzón **replicable**; no requiere excepción metodológica.  
- Diego demuestra **riesgo de falso negativo** por catálogo, no por OUTSIDE de dominio.  
- **Sin persistencia PA2** en esta ronda (por diseño).
