# MC1.5.3 — Validación multidominio (segundo perfil de contenidos)

**Documento analizado:** `1022445625`  
**Persona:** JUAN PABLO SANABRIA DIAZ (`personId=1176`)  
**Comparado con:** Nidia (`1015482688`, extracción 207 / enrichment 5 / evidence 5)  
**Fecha:** 2026-07-27  
**Alcance:** auditoría + pipeline + descubrimiento documental. **Sin PA2, sin catálogo, sin mappings, sin frontend.**

---

## Parte A — Auditoría inicial

| Campo | Valor |
|-------|--------|
| personId | **1176** |
| Nombre | JUAN PABLO SANABRIA DIAZ |
| Rol | ANALISTA DE DISEÑO DE CONTENIDOS |
| Área | FABRICA Y DESARROLLO |
| Correo institucional | juan_sanabriad@cun.edu.co |
| Estado activo | **Sí** |
| Jefe inmediato | VACANTE — COORDINADOR FABRICA DE CONTENIDOS… (`personId=1206`) |
| Organigrama activo | **Sí** (1 relación visual) |

### Pipeline previo (antes de escribir)

| Etapa | Existe | Estado | Activa | ID |
|-------|--------|--------|--------|-----|
| CV | Sí | AVAILABLE | Sí | **104** |
| Extraction | Sí | SUCCEEDED | Sí | **104** (hash `710b…`) |
| Enrichment | No | — | — | — |
| Evidence | No | — | — | — |
| PA2 | No | — | — | — |

### Drift detectado

| Campo | Valor |
|-------|--------|
| Hash extracción 104 | `710b86e9cdd30fa961303e935fb0d76795faef001995fb0b344ac1b5a0267a12` |
| Hash PDF vigente | `0078bc04b776ac14f0c10853f26257e4f6994556967358b592bc2b3f5113ec81` |
| PDF estable en auditoría | Sí (doble descarga) |
| Recomendación | **REEXTRACT_THEN_ENRICH_EVIDENCE** |

Artefacto: `tmp/cv-attributes/mc1.5.3-1022445625-audit.json`

---

## Parte B — Pipeline ejecutado

Misma política que MC1.5.2C: drift ⇒ nueva extracción; histórica conservada; Enrichment/Evidence sobre hash vigente.

| Capa | ID | Hash | Estado |
|------|-----|------|--------|
| Extracción histórica | 104 | `710b…` | SUCCEEDED, `is_active=false` |
| Extracción vigente | **208** | `0078bc04…5113ec81` | SUCCEEDED + **activa** |
| Enrichment | **6** | **mismo** `0078…` | SUCCEEDED + **activa** |
| Evidence | **6** | vía enrichment 6 | SUCCEEDED + **activa** |

- Modelo / prompt / extractor: `gemini-3.6-flash` / `c2.1-2026-07-24` / `1.1.0`
- Skills: **22**
- Evidence: **0 STRONG · 10 MODERATE · 11 WEAK · 1 NONE** (avgStrength ≈ 25.0)
- PA2: **0**

Cadena demostrable: `extraction.pdf_sha256 = enrichment.pdf_sha256 = 0078…`

---

## Parte C — Descubrimiento (perfil 1022445625)

### Skills con Evidence ≥ MODERATE

| Skill | Nivel | Strength | Clasificación documental |
|-------|-------|----------|---------------------------|
| Animación 2D/3D | MODERATE | 64.5 | **PROFESSIONAL_CORE** |
| Fotografía comercial | MODERATE | 54.5 | **PROFESSIONAL_CORE** |
| Retoque fotográfico | MODERATE | 54.5 | **PROFESSIONAL_SUPPORT** |
| Adobe After Effects | MODERATE | 50 | **PROFESSIONAL_SUPPORT** (herramienta con actividad) |
| Adobe Premiere Pro | MODERATE | 50 | **PROFESSIONAL_SUPPORT** (herramienta con actividad) |
| Manuales de identidad corporativa | MODERATE | 50 | **PROFESSIONAL_CORE** |
| CapCut | MODERATE | 40 | **PROFESSIONAL_SUPPORT** |
| iSpring | MODERATE | 40 | **PROFESSIONAL_SUPPORT** |
| Adobe InDesign | MODERATE | 40 | **PROFESSIONAL_SUPPORT** |
| E-mail marketing | MODERATE | 40 | **AMBIGUOUS** / soporte comunicación |

### Otras señales

| Skill | Nivel | Clasificación |
|-------|-------|----------------|
| Mockups publicitarios | WEAK 34 | AMBIGUOUS |
| Masterización de audio | WEAK 24 | PROFESSIONAL_SUPPORT (formación + listing) |
| Edición de video (nombre skill) | WEAK 1 | AMBIGUOUS — la actividad real está en Premiere/AE/CapCut |
| Blender, Animate, Protools, FL Studio, Ableton, Traktor, OBS, Streaming | WEAK 1 | INSUFFICIENT_EVIDENCE (listing) |
| Liderar equipos creativos | NONE | TRANSVERSAL / INSUFFICIENT |

### ¿Orientación “video”? (solo evidencia)

**Sí, respaldado por el CV**, no por el rumor de producto:

- Responsabilidades explícitas de producción audiovisual con Premiere, After Effects y CapCut (Evidence MODERATE en las tres herramientas).
- Animación 2D/3D MODERATE 64.5 con experiencia laboral.
- No hay skill “Diseño gráfico” ni “IA”; sí identidad corporativa, fotografía e InDesign educativo.

### Evaluación de temas pedidos

| Tema | ¿Evidencia sólida? | Nota |
|------|-------------------|------|
| Producción audiovisual | **Sí** | AE + Premiere + CapCut + Animación |
| Edición de video | **Sí** (vía herramientas + responsabilidad) | Skill nominal WEAK; actividad MODERATE |
| Motion graphics | **Sí / emergente** | Animación 2D/3D + After Effects |
| Postproducción | **Emergente** | Implícita en edición/animación; no skill aparte |
| Diseño gráfico | **Parcial** | Identidad + mockups + InDesign; sin “Diseño Gráfico” |
| Diseño instruccional | **Emergente débil** | iSpring + InDesign educativos; sin skill DI |
| IA aplicada | **No** | Ausente |
| Adobe / CapCut / Premiere / AE | **Sí** | Con WORK_EXPERIENCE en varios |

### Agrupaciones profesionales (documentales)

1. **Producción y edición audiovisual** — CORE  
2. **Animación / motion** — CORE  
3. **Fotografía y retoque** — CORE / SUPPORT  
4. **Identidad de marca y piezas gráficas** — CORE adyacente a diseño gráfico  
5. **Contenidos educativos interactivos** (iSpring / InDesign) — SUPPORT / EMERGING  
6. **Audio / streaming** — SUPPORT débil (listings + formación)

---

## Parte D — Comparación con Nidia

| Especialidad | Nidia (207/5/5) | Perfil 1022445625 (208/6/6) | Resultado |
|--------------|-----------------|-----------------------------|-----------|
| Diseño gráfico | **SUPPORTED** (Diseño Gráfico MODERATE 66 + Adobe gráfico) | **EMERGING** (identidad/mockups/InDesign; sin skill “Diseño Gráfico”) | **SUPPORTED_BY_ONE_PROFILE** |
| Diseño instruccional | **EMERGING** (skill WEAK; SCORM/LMS MODERATE) | **EMERGING** (iSpring/InDesign educativos) | **EMERGING** |
| Producción audiovisual | **INSUFFICIENT** (tools listing NONE) | **SUPPORTED** (Premiere/AE/CapCut/Animación MODERATE) | **SUPPORTED_BY_ONE_PROFILE** |
| IA aplicada | **EMERGING** (IA 63 + Prompting 50) | **REJECTED** (ausente) | **SUPPORTED_BY_ONE_PROFILE** |
| Editorial | **INSUFFICIENT** (WEAK 5) | **INSUFFICIENT** (InDesign educativo ≠ editorial) | **REJECTED** |

Ninguna especialidad quedó **VALIDATED** (sólida en **ambos** perfiles). El dominio se sostiene por **complementariedad**, no por solapamiento idéntico.

---

## Parte E — Consolidación del dominio

### Área propuesta

**¿Sigue siendo correcta “Diseño y Producción de Contenidos”?**  
**Sí.**

- Nidia: diseño gráfico + e-learning + IA en flujo creativo.  
- Juan Pablo: producción audiovisual + animación + fotografía + identidad.  
Ambos encajan en diseño/producción de contenidos con núcleos distintos. No hace falta renombrar el área a “solo video” ni a “solo gráfico”.

### Especialidades (decisión documental previa a catálogo)

| Especialidad | Decisión | Motivo |
|--------------|----------|--------|
| Diseño gráfico | **EMERGING** → candidata a CONFIRMED con más perfiles o criterio de especialidad no ubicua | Fuerte en 1/2; adyacente en el otro |
| Producción audiovisual | **EMERGING** → candidata a CONFIRMED (mismo criterio) | Fuerte en 1/2; gap en Nidia |
| Diseño instruccional | **EMERGING** | Señales en ambos, ninguna SUPPORTED sola |
| IA aplicada a contenidos | **EMERGING** | Solo Nidia |
| Editorial | **REMOVE** | Insuficiente en ambos |
| Motion graphics | **EMERGING** (nueva candidata desde perfil 2) | Animación 2D/3D + AE en Juan Pablo |
| Fotografía / identidad de marca | **EMERGING** (perfil 2) | No elevar a contrato aún |

**CONFIRMED estricto (ambos perfiles):** ninguna.

### Hallazgos

1. **¿Especialidades en ambos?** Solo de forma débil/emergente: contenidos educativos / autoría (iSpring↔SCORM/LMS), piezas gráficas (Adobe InDesign en ambos).  
2. **¿Solo en uno?** Diseño gráfico + IA (Nidia); producción AV + animación + fotografía + identidad (Juan Pablo).  
3. **¿Herramientas?** Premiere, AE, CapCut, InDesign, iSpring, Illustrator, Photoshop, Midjourney, etc. Son **herramientas**; solo cuentan como actividad profesional cuando Evidence muestra responsabilidad/experiencia (caso Juan Pablo en AV; Nidia en IA/SCORM más que en Adobe listing).  
4. **¿Actividades profesionales?** Diseño gráfico; producción/edición audiovisual; animación; fotografía; gestión de contenidos con IA; desarrollo SCORM/LMS.

### ¿Listo para MC1.6.1?

**Condicionado: sí para definir el área; no para congelar especialidades como contrato cerrado.**

| Pregunta | Respuesta |
|----------|-----------|
| ¿El dominio está respaldado por más de un perfil? | **Sí** |
| ¿Hay especialidades estables en ambos? | **No** (ninguna VALIDATED) |
| ¿Pasar a MC1.6.1? | **Sí, como borrador funcional del área**, con especialidades marcadas EMERGING / complementarias y **sin** seed de catálogo hasta decidir política: ¿especialidades no ubicuas permitidas? |

Recomendación: en MC1.6.1 documentar el dominio **Diseño y Producción de Contenidos** con especialidades candidatas **Diseño gráfico** y **Producción audiovisual** como pilares complementarios, más **Diseño instruccional** e **IA aplicada** como emergentes, y **excluir Editorial**.

---

## Integridad

| Check | Resultado |
|-------|-----------|
| Extracción activa | 208 |
| Enrichment activa | 6 (hash = extracción) |
| Evidence activa | 6 |
| Histórica 104 | Conservada |
| PA2 / mappings / catálogo / frontend | **0** |

Artefactos:

- `docs/mc1.5.3-content-domain-validation.md` (este documento)
- `tmp/cv-attributes/mc1.5.3-profile-1022445625.json`
- auditoría: `tmp/cv-attributes/mc1.5.3-1022445625-audit.json`
