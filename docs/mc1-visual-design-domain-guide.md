# Guía del dominio — Diseño Visual (MC1)

**Versión documental:** MC1.6.1D · 2026-07-28  
**Estado del dominio:** **EN CONSTRUCCIÓN** (V2 validado; conocimiento en maduración)  
**Pack vigente (referencia técnica):** `visual-design-mappings@1.1.0`  
**PA2 vigente (referencia técnica):** `pa2-visual-design-1.1.0` — **no modificar en esta fase**

**Corpus de evidencia:** cadena CV→extracción→enrichment→evidence→dry-run PA2 V2 sobre **Nidia**, **Garzón**, **Daniel**, **Diego**, **Poveda** y **Laura** (fases MC1.6.0 → MC1.6.1C.3).  
Este documento **no piensa en personas**; sintetiza **qué es Diseño Visual** en la organización según evidencia acumulada.

---

## 1. Propósito del dominio

### 1.1 Qué es

**Diseño Visual** es la disciplina de **concebir, componer y producir soluciones visuales estáticas o semi-estáticas** para comunicar información, identidad de marca y mensajes mediante:

- piezas gráficas (impresas o digitales),
- sistemas de identidad visual,
- maquetación y diagramación editorial,
- recursos visuales de apoyo (no audiovisuales ni pedagógicos como núcleo).

### 1.2 Qué no es

| No es | Por qué |
|-------|---------|
| Un cargo (“Analista de diseño de contenidos”) | El rol mezcla visual + e-learning + AV; el dominio filtra por evidencia CV. |
| Un área organizacional (“Fábrica y Desarrollo”) | Misma área incluye perfiles pedagógicos y AV. |
| Producción audiovisual | Premiere, After Effects, edición de video → frontera OUTSIDE. |
| Diseño instruccional / e-learning | SCORM, LMS, granulación → frontera OUTSIDE. |
| UX/UI como disciplina | Investigación, arquitectura de información, prototipado funcional → dominio distinto o futuro. |
| Marketing digital / performance | SEO, analítica, campañas → frontera OUTSIDE. |

### 1.3 Pregunta rectora (MC1.6.1D)

> ¿Qué representa realmente Diseño Visual en los CV de la Fábrica de Contenidos?

**Respuesta consolidada:** un **núcleo gráfico-comunicacional** (composición, marca, editorial) con **herramientas Adobe/Canva como apoyo**, frecuentemente **coexistente** con competencias pedagógicas o AV que **no deben contaminar** el score visual. El dominio debe **reconocer el profesional antes que la herramienta** y **normalizar sinónimos** frecuentes en CVs (branding, identidad, diagramación compuesta).

---

## 2. Especialidades — fichas técnicas

### 2.1 VISUAL_GRAPHIC — Diseño gráfico

#### Definición profesional

Práctica de crear y estructurar **piezas visuales** mediante composición, tipografía, color, jerarquía, ilustración aplicada y retoque, para soportes impresos o digitales **no interactivos** (o con interactividad mínima).

#### Competencias nucleares

- Diseño gráfico como disciplina declarada y ejercida.
- Composición de piezas publicitarias, institucionales o educativas **como arte visual**.
- Uso aplicado de Illustrator/Photoshop en producción gráfica.
- Ilustración digital **cuando acompaña** pieza gráfica (no como arte autónomo sin ancla gráfica).

#### Competencias accesorias

- Retoque fotográfico.
- Maquetación publicitaria (cuando no alcanza umbral editorial).
- Diseño gráfico institucional (variante sector público/educación).
- Identidad visual como aporte **secundario** (10 % mapping) cuando el eje es gráfico.

#### Skills canónicas (pack V2)

| key | Tipo | Rol en especialidad |
|-----|------|---------------------|
| `diseno_grafico` | PROFESSIONAL | PRIMARY 1.0 |
| `diseno_grafico_institucional` | PROFESSIONAL | PRIMARY 0.9 |
| `adobe_illustrator` | TOOL | PRIMARY 0.25 |
| `adobe_photoshop` | TOOL | PRIMARY 0.25 |
| `canva` | TOOL | SECONDARY 0.1 → GRAPHIC |

#### Aliases propuestos (no implementados)

| Formulación en CV | → Canónica |
|-------------------|------------|
| Diseño Gráfico | `diseno_grafico` |
| Diseño Gráfico Institucional | `diseno_grafico_institucional` |
| Ilustración digital / Ilustración Digital | **nueva key** `ilustracion_digital` → GRAPHIC |
| Retoque fotográfico | `retoque_fotografico` → GRAPHIC |
| Maquetación publicitaria | `maquetacion_publicitaria` → GRAPHIC o EDITORIAL (bajo peso) |
| Fotografía digital | OUTSIDE o TRANSVERSAL (no núcleo gráfico en CVs auditados) |

#### Herramientas asociadas

Adobe Illustrator, Adobe Photoshop, Canva (apoyo; nunca ancla sola tras anti-tool PA2).

#### Skills que NO pertenecen

- Premiere, After Effects, CapCut (AV).
- Figma, prototipado UI/UX (UI / otro dominio).
- SCORM, LMS (instruccional).
- Marketing digital, community manager.

#### Ejemplos reales (evidencia corpus)

| Señal en CV | Evidencia EE | Efecto PA2 V2 |
|-------------|--------------|---------------|
| Liderazgo proyectos diseño gráfico | MODERATE | Daniel **ACTIVE** GRAPHIC |
| Título + trayectoria diseño gráfico | MODERATE | Nidia **ACTIVE** GRAPHIC |
| Diseño gráfico + tools listing | MODERATE + NONE tools | Poveda **EMERGENT** (1 pro) |
| Solo Illustrator/Photoshop listing | NONE | Diego/Laura **HIDDEN** |

#### Nivel de madurez

**CONSOLIDADO** — Es la especialidad con **mayor densidad de evidencia** y **2 perfiles ACTIVE** reproducibles (Nidia, Daniel). Es el ancla del dominio.

---

### 2.2 VISUAL_IDENTITY — Identidad visual

#### Definición profesional

Diseño y aplicación de **sistemas visuales de marca**: logotipos, paletas, tipografías institucionales, lineamientos gráficos, manuales de identidad y coherencia visual en touchpoints.

#### Competencias nucleares

- Diseño de identidad visual / branding aplicado.
- Manuales de identidad corporativa (brandbook).
- Comunicación visual como sistema (no pieza aislada).
- Estrategia de comunicación visual **solo si** va acompañada de entregables de identidad.

#### Competencias accesorias

- Branding para PYMEs / proyectos académicos.
- Adaptación de identidad en soportes digitales.
- Línea gráfica institucional.

#### Skills canónicas (pack V2)

| key | Tipo | Rol |
|-----|------|-----|
| `diseno_de_identidad_visual` | PROFESSIONAL | PRIMARY 0.9 IDENTITY |
| `manuales_de_identidad_corporativa` | PROFESSIONAL | PRIMARY 0.9 IDENTITY |
| `comunicacion_visual` | PROFESSIONAL | PRIMARY 1.0 IDENTITY |
| `diseno_de_identidad_visual` | PROFESSIONAL | SECONDARY 0.1 GRAPHIC |

#### Aliases — mapa branding (implementado en pack 1.2.0 / MC1.11.0)

| Término en CV | ¿Equivale? | Acción propuesta |
|---------------|------------|------------------|
| Branding y Diseño de Identidad Corporativa | **Sí** → identidad | Alias → `diseno_de_identidad_visual` |
| Branding e Identidad de Marca | **Sí** | Alias → `diseno_de_identidad_visual` |
| Identidad visual (minúscula) | **Sí** | Alias → `diseno_de_identidad_visual` |
| Manual de marca / brandbook | **Sí** | Alias → `manuales_de_identidad_corporativa` |
| Línea gráfica / sistema visual | **Parcial** | Alias → `comunicacion_visual` o identidad |
| Creación de marca (solo perfil) | **Parcial** | Requiere evidencia aplicada; no listing |
| Logo design (inglés) | **Sí** | Alias futuro |
| Community manager / redes | **No** | OUTSIDE / marketing |

#### Falsas equivalencias (no aliasar)

| Término | Por qué no |
|---------|------------|
| `adobe_illustrator` solo | Tool ≠ identidad |
| `adobe_creative_cloud` / `suite_adobe` | Genérico; no prueba identidad |
| Diseño gráfico genérico | Puede ser GRAPHIC sin sistema de marca |
| Diseño instruccional | Pedagogía |
| UX/UI | Interacción, no sistema de marca estático |

#### Mappings necesarios (propuesta V2.1)

1. Capa de **normalización pre-pack** (extractor/enricher) hacia 3 keys canónicas.
2. No duplicar PRIMARY en GRAPHIC e IDENTITY para la misma formulación.
3. Mantener SECONDARY 0.1 identidad→gráfico solo cuando exista `diseno_de_identidad_visual` PRIMARY.

#### Ejemplos reales

| Señal | EE | PA2 V2 |
|-------|-----|--------|
| `diseno_de_identidad_visual` | MODERATE 63 | Garzón **EMERGENT** IDENTITY (rank 1) |
| `manuales_de_identidad_corporativa` | MODERATE 50 | Juan Pablo EMERGENT (ronda C.1; fuera corpus D) |
| Branding… Corporativa (Diego) | MODERATE 50 | **0 mappings** → todo HIDDEN (gap) |
| Identidad visual (Poveda) | MODERATE | **Sin key** → no entra PA2 |
| `comunicacion_visual` (Nidia) | NONE | HIDDEN |

#### Nivel de madurez

**EN CONSTRUCCIÓN** — Evidencia **abundante en CVs** pero **catálogo incompleto en aliases**. Garzón demuestra señal; Diego demuestra **falso negativo** por vocabulario. No consolidar hasta ≥1 ACTIVE post-V2.1.

---

### 2.3 VISUAL_EDITORIAL — Diseño editorial

#### Definición profesional

Organización visual de **documentos y publicaciones**: diagramación, maquetación, preprensa, folletos, cartillas, revistas, libros, informes y piezas editoriales digitales **como objeto visual** (no como curso SCORM).

#### Competencias nucleares

- Diseño editorial.
- Diagramación editorial.
- Maquetación y preprensa.
- Maquetación editorial digital (PDF, publicaciones web estáticas, guías).

#### Competencias accesorias

- Publicaciones institucionales / material educativo **maquetado** (sin autoría pedagógica como núcleo).
- InDesign como herramienta de maquetación **con** práctica editorial evidenciada.

#### Vocabulario profesional (corpus)

| Concepto en CV | Canónica propuesta |
|--------------|-------------------|
| Diseño editorial | `diseno_editorial` |
| Diagramación editorial | `diagramacion_editorial` |
| Diseño Editorial y Diagramación (compuesto) | Split → editorial + diagramación |
| Maquetación y preprensa | `maquetacion_y_preprensa` |
| Maquetación editorial digital | `maquetacion_editorial_digital` |
| Maquetación publicitaria | GRAPHIC o editorial (según contexto) |
| Folletos, cartillas, revistas | Evidencia bajo `diseno_editorial` / `diagramacion_editorial` |
| Publicación digital educativa | Editorial si maquetación; instruccional si SCORM/LMS |

#### Skills canónicas (pack V2)

| key | PRIMARY | Peso |
|-----|---------|------|
| `diseno_editorial` | EDITORIAL | 1.0 |
| `diagramacion_editorial` | EDITORIAL | 0.9 |
| `maquetacion_y_preprensa` | EDITORIAL | 0.85 |
| `maquetacion_editorial_digital` | EDITORIAL | 0.85 |
| `adobe_indesign` | EDITORIAL | 0.2 (tool apoyo) |

#### Herramientas

Adobe InDesign (PRIMARY bajo en editorial; **nunca** activa especialidad sola — anti-tool).

#### Skills que NO pertenecen

- SCORM, LMS, granulación (instruccional).
- PowerPoint como autoría de cursos (instruccional/transversal).
- Premiere (AV).

#### Ejemplos reales

| Señal | EE | PA2 V2 |
|-------|-----|--------|
| `diseno_editorial` + InDesign WEAK | MODERATE + WEAK | Nidia **EMERGENT** editorial |
| `diseno_editorial` solo | MODERATE 51.5 | Laura **EMERGENT** editorial |
| `diagramacion_editorial` | WEAK 37 | Garzón **EMERGENT** editorial |
| InDesign solo | WEAK/NONE | Daniel **HIDDEN** editorial (anti-tool) |

#### Nivel de madurez

**EN CONSTRUCCIÓN** — Vocabulario **parcialmente cubierto**; compuestos y baja cardinalidad impiden ACTIVE. Requiere aliases editoriales + posible segunda skill evidenciada por perfil.

---

### 2.4 VISUAL_UI — Diseño de interfaces

#### Definición profesional (catálogo MC1.2)

Capa **visual** de interfaces digitales: composición de pantallas, jerarquía visual, prototipado visual, design systems **sin** investigación UX ni arquitectura de información como núcleo.

#### ¿Pertenece al dominio Diseño Visual?

**Parcialmente, con política restrictiva.**

En el corpus de 6 personas:

- **Poveda** y **Laura** mencionan UX/UI o prototipado.
- Evidencia: WEAK (Laura) o mención en perfil (Poveda).
- **Ningún mapping** en pack V2.
- **Ningún ACTIVE/EMERGENT** UI en PA2.

#### Evidencia mínima propuesta para considerar UI como especialidad Visual

Documentar **sin implementar**. Criterio propuesto:

| Criterio | Umbral |
|----------|--------|
| Skill profesional explícita | `diseno_ui`, `diseno_de_interfaces`, o `prototipado_visual` (key futura) |
| Evidencia aplicada | ≥ MODERATE con trabajo en experiencia (wireframes/mockups entregables) |
| Herramienta | Figma / Sketch / Adobe XD con evidencia **no** solo listing |
| Exclusiones | “Prototipado con código”, UX research, Design Thinking solo → no UI visual |
| Acompañamiento | Al menos 1 skill profesional UI evidenciada (anti-tool análogo) |
| Cardinalidad PA2 | Mismos umbrales que otras especialidades (sin relajar PA2) |

#### Nivel de madurez

**NO VALIDADO** — Especialidad **reservada** en catálogo; **sin mappings ni evidencia MODERATE UI** en el corpus. Mantener **sin score** hasta política explícita de frontera UX/UI.

---

### 2.5 VISUAL_DIGITAL_ASSETS — Recursos visuales digitales

#### Pregunta: ¿Existe realmente como práctica profesional independiente?

#### Análisis profesional

En el corpus, “recursos visuales digitales” aparece como:

- **InDesign** en contexto maquetación (editorial).
- **Canva / Genially** en listing o piezas puntuales.
- Materiales de aprendizaje digitales (a menudo **instruccional**, no asset puro).

**No aparece** una competencia profesional recurrente del tipo “diseño de assets digitales” o “producción de recursos visuales para plataformas” **independiente** de gráfico o editorial.

#### Comportamiento PA2 V2

- Mappings: InDesign SECONDARY 0.15, Canva PRIMARY 0.25, Genially PRIMARY 0.25.
- **Siempre HIDDEN o EMERGENT tool-led**; anti-tool bloquea cuando no hay profesional.
- Nidia: DIGITAL **HIDDEN** (anti-tool) en V2 — corrección deseada vs V1.

#### Conclusión

**No representa una práctica profesional independiente** en la Fábrica de Contenidos auditada.

#### Propuesta futura (no implementar)

| Opción | Descripción |
|--------|-------------|
| **A (recomendada)** | **Retirar** `VISUAL_DIGITAL_ASSETS` en catálogo V3; redistribuir Canva/Genially como tools GRAPHIC; InDesign solo EDITORIAL. |
| B | Mantener como “bucket transitorio” sin ACTIVE hasta definir key profesional `produccion_de_assets_digitales` con evidencia. |

#### Si se mantuviera (contrafactual)

| Campo | Definición |
|-------|------------|
| Alcance | Piezas visuales ligeras para redes/plataformas sin maquetación editorial ni identidad sistema. |
| Competencias | Diseño de piezas digitales rápidas, adaptación formato, kits para redes. |
| Skills | Canva, Genially; **no** InDesign (editorial). |
| Fronteras | ≠ AV, ≠ instruccional, ≠ marketing analytics. |

#### Nivel de madurez

**NO CONSOLIDADO — CANDIDATO A ELIMINACIÓN** en futura versión de catálogo.

---

## 3. Matriz de vocabulario del dominio

Clasificación: **PROFESSIONAL** · **TOOL** · **TRANSVERSAL** · **NO PERTENECE**

### 3.1 Skills con key canónica en pack V2

| Skill encontrada (forma CV) | Skill canónica | Alias | Especialidad | Tipo |
|----------------------------|----------------|-------|--------------|------|
| Diseño Gráfico | `diseno_grafico` | — | GRAPHIC | PROFESSIONAL |
| Diseño Gráfico Institucional | `diseno_grafico_institucional` | — | GRAPHIC | PROFESSIONAL |
| Diseño de identidad visual | `diseno_de_identidad_visual` | — | IDENTITY | PROFESSIONAL |
| Manuales de identidad corporativa | `manuales_de_identidad_corporativa` | manual de marca, brandbook | IDENTITY | PROFESSIONAL |
| Comunicación Visual | `comunicacion_visual` | estrategia comunicación visual* | IDENTITY | PROFESSIONAL |
| Diseño editorial | `diseno_editorial` | — | EDITORIAL | PROFESSIONAL |
| Diagramación editorial | `diagramacion_editorial` | — | EDITORIAL | PROFESSIONAL |
| Maquetación y Preprensa | `maquetacion_y_preprensa` | — | EDITORIAL | PROFESSIONAL |
| Maquetación Editorial Digital | `maquetacion_editorial_digital` | — | EDITORIAL | PROFESSIONAL |
| Adobe Illustrator | `adobe_illustrator` | Illustrator | GRAPHIC | TOOL |
| Adobe Photoshop | `adobe_photoshop` | Photoshop | GRAPHIC | TOOL |
| Adobe InDesign | `adobe_indesign` | — | EDITORIAL (+DIGITAL†) | TOOL |
| Canva | `canva` | — | DIGITAL† / GRAPHIC sec. | TOOL |
| Genially | `genially` | — | DIGITAL† | TOOL |
| Inteligencia Artificial | `inteligencia_artificial` | — | — | TRANSVERSAL |
| Prompting | `prompting` | — | — | TRANSVERSAL |
| Control de Calidad (QA) | `control_de_calidad_(qa)` | — | — | TRANSVERSAL |
| Gestión de proyectos | `gestion_de_proyectos` | — | — | TRANSVERSAL |
| Soft skills MC2 | varias | — | — | TRANSVERSAL |
| Diseño instruccional | `diseno_instruccional` | — | — | NO PERTENECE |
| SCORM / LMS | `scorm`, `lms`, Moodle… | — | — | NO PERTENECE |
| Adobe Premiere / AE / CapCut | varias | — | — | NO PERTENECE |
| Adobe Creative Cloud / suite Adobe | `adobe_creative_cloud`, `suite_adobe` | — | — | NO PERTENECE |
| Midjourney, Runway, Grok… | varias | — | — | NO PERTENECE |

† DIGITAL = especialidad candidata a eliminación; ver §2.5.

### 3.2 Skills recurrentes sin key canónica (vacíos)

| Skill encontrada | Frecuencia corpus | Canónica propuesta | Especialidad | Tipo |
|------------------|-------------------|--------------------|--------------|------|
| Branding y Diseño de Identidad Corporativa | Diego | `diseno_de_identidad_visual` | IDENTITY | PROFESSIONAL |
| Branding e Identidad de Marca | Laura | `diseno_de_identidad_visual` | IDENTITY | PROFESSIONAL |
| Identidad visual | Poveda | `diseno_de_identidad_visual` | IDENTITY | PROFESSIONAL |
| Ilustración digital | Diego, Laura | `ilustracion_digital` (nueva) | GRAPHIC | PROFESSIONAL |
| Diseño Editorial y Diagramación | Poveda | split editorial | EDITORIAL | PROFESSIONAL |
| Retoque fotográfico | Daniel | `retoque_fotografico` (nueva) | GRAPHIC | PROFESSIONAL |
| Maquetación publicitaria | Daniel | `maquetacion_publicitaria` (nueva) | GRAPHIC | PROFESSIONAL |
| Diseño UX/UI | Laura | — | — | NO PERTENECE‡ |
| Prototipado UI/UX | Poveda | — | — | NO PERTENECE‡ |
| Producción y edición audiovisual | Poveda | — | — | NO PERTENECE |
| Marketing digital | Poveda | — | — | NO PERTENECE |
| Fotografía digital | Diego | — | — | TRANSVERSAL / NO PERTENECE |
| Edición de video | Garzón | — | — | NO PERTENECE |
| Community manager | Garzón | — | — | NO PERTENECE |

‡ Hasta política UI; ver §2.4.

---

## 4. Redundancias detectadas

### 4.1 Aliases repetidos / sinónimos no unificados

- **Identidad:** ≥4 formulaciones CV → 3 keys canónicas (`diseno_de_identidad_visual`, `manuales…`, `comunicacion_visual`) sin capa alias.
- **Editorial compuesto:** “Diseño editorial y diagramación” vs keys separadas.
- **Adobe genérico:** Creative Cloud / suite Adobe vs apps específicas (correctamente OUTSIDE, pero genera ruido en extracción).

### 4.2 Mappings duplicados (misma skill, varias especialidades)

| Skill | Especialidades | Observación |
|-------|----------------|-------------|
| `adobe_indesign` | EDITORIAL PRIMARY, DIGITAL SECONDARY | DIGITAL redundante si se elimina especialidad |
| `canva` | DIGITAL PRIMARY, GRAPHIC SECONDARY | Doble conteo; preferir GRAPHIC secundario |
| `diseno_de_identidad_visual` | IDENTITY PRIMARY, GRAPHIC SECONDARY | Aceptable (10 % gráfico) |

### 4.3 Herramientas repetidas

- Suite Adobe listada **además** de PS/AI/ID — inflar conteo sin evidencia aplicada.
- InDesign aparece en perfiles **gráficos, editoriales e instruccionales** — solo editorial con profesional aporta señal.

### 4.4 Skills demasiado amplias

| Skill | Problema |
|-------|----------|
| `comunicacion_visual` | Mezcla estrategia + identidad + pieza suelta |
| `adobe_creative_cloud` | No discrimina competencia |
| “Diseño y Edición Multimedia” (categoría extractor) | Agrupa gráfico + AV |

### 4.5 Skills demasiado específicas

| Skill | Problema |
|-------|----------|
| `diseno_grafico_institucional` | Útil pero 1 perfil (Angulo, fuera corpus D); mantener como variante |
| `maquetacion_editorial_digital` vs `maquetacion_y_preprensa` | Solapamiento; ambas necesarias pero documentar frontera impreso/digital |

### 4.6 Skills ambiguas

| Skill | Ambigüedad |
|-------|------------|
| InDesign en “materiales de aprendizaje” | ¿Editorial o instruccional? |
| “Identidad visual” en marketing digital | ¿IDENTITY o marketing? |
| Ilustración digital | ¿GRAPHIC o arte independiente? |

---

## 5. Vacíos del catálogo (recurrentes en CV, ausentes como key)

Prioridad de cierre documental (implementación futura):

| Prioridad | Concepto | Perfiles |
|-----------|----------|----------|
| **P0** | Branding / identidad (variantes léxicas) | Diego, Laura, Poveda |
| **P0** | Editorial compuesto “diseño editorial y diagramación” | Poveda |
| **P1** | Ilustración digital | Diego, Laura, Correa† |
| **P1** | Retoque fotográfico / maquetación publicitaria | Daniel |
| **P2** | Producción assets digitales (si se mantiene DIGITAL) | — |
| **P3** | Fotografía digital | Diego |

† Correa fuera del corpus D pero citada en C.1.

---

## 6. Fronteras del dominio

### 6.1 Diseño Visual ↔ Producción audiovisual

| Pertenece a Visual | No pertenece (AV) |
|--------------------|-------------------|
| Pieza gráfica estática, infografía impresa/digital | Edición de video, motion graphics |
| Thumbnail diseñado como gráfico | Premiere, After Effects, CapCut |
| Branding estático | Producción audiovisual, locución, rodaje |

**Regla:** si el entregable principal es **timeline de video**, es AV aunque use suite Adobe.

### 6.2 Diseño Visual ↔ Diseño instruccional

| Pertenece a Visual | No pertenece (instruccional) |
|--------------------|------------------------------|
| Maquetación visual de guía/PDF | Diseño instruccional como método |
| Diagramación de manual impreso | SCORM, LMS, granulación, iSpring |
| Identidad de material educativo (marca del recurso) | Objetivos de aprendizaje, evaluación |

**Regla:** Daniel tiene **ambos** en CV; PA2 correctamente **ACTIVE gráfico** y **OUTSIDE** SCORM/LMS.

### 6.3 Diseño Visual ↔ UX/UI

| Pertenece a Visual (UI restringido) | No pertenece |
|-------------------------------------|--------------|
| Composición visual de pantallas | UX research, arquitectura de información |
| Design system visual | Prototipado funcional / código |
| Mockups de alta fidelidad **visual** | Service design, Design Thinking solo |

**Regla actual:** **sin mappings UI** — menciones en CV **no puntúan**. Dominio UX/UI = decisión organizacional pendiente.

### 6.4 Diseño Visual ↔ Marketing

| Pertenece a Visual | No pertenece (marketing) |
|--------------------|--------------------------|
| Pieza gráfica de campaña | Marketing digital, analítica, SEO |
| Identidad para marca | Community manager, gestión redes |
| Comunicación visual institucional | Performance, embudos, CRM |

---

## 7. Casos ambiguos (documentados)

| Caso | Resolución propuesta |
|------|----------------------|
| Analista diseño contenidos + SCORM fuerte | Dominio visual solo si ancla gráfica/identidad/editorial MODERATE |
| Perfil “multimedia” | Descomponer: gráfico vs AV vs instruccional por skill |
| Adobe listing sin experiencia | HIDDEN (anti-tool + NONE evidence) |
| Identidad en PYME (Diego) | MATCH conceptual; requiere alias |
| Editorial en material educativo | EDITORIAL si maquetación; instruccional si metodología |
| Canva como única tool | No activa especialidad |

---

## 8. Síntesis PA2 V2 (corpus 6 personas — referencia)

Solo para validar conocimiento; **PA2 no se modifica**.

| Perfil | MATCH conceptual | Default PA2 | A | E | H | Especialidad dominante |
|--------|------------------|-------------|---|---|---|------------------------|
| Nidia | Sí | VISUAL_GRAPHIC | 1 | 1 | 3 | GRAPHIC ACTIVE |
| Daniel | Sí | VISUAL_GRAPHIC | 1 | 0 | 4 | GRAPHIC ACTIVE |
| Garzón | Sí | — | 0 | 3 | 2 | IDENTITY EMERGENT |
| Poveda | Borderline | — | 0 | 1 | 4 | GRAPHIC EMERGENT |
| Laura | Borderline | — | 0 | 1 | 4 | EDITORIAL EMERGENT |
| Diego | Sí (gap catálogo) | — | 0 | 0 | 5 | — |

**Patrón estable:** GRAPHIC alcanza ACTIVE con `diseno_grafico` MODERATE + cardinalidad; IDENTITY/EDITORIAL quedan EMERGENT por **una** skill profesional fuerte + umbrales cardinalidad; DIGITAL no aporta ACTIVE.

---

## 9. Roadmap por especialidad

| Especialidad | ¿Consolidado? | Estado | Próximo hito documental |
|--------------|---------------|--------|-------------------------|
| **VISUAL_GRAPHIC** | **Sí** | 2+ ACTIVE reproducibles; vocabulario estable + aliases 1.2.0 | Mantenimiento |
| **VISUAL_IDENTITY** | **Parcial → operativo** | ACTIVE seco (Diego #15); aliases branding en pack 1.2.0 | ≥2 ACTIVE independientes |
| **VISUAL_EDITORIAL** | **Parcial → operativo** | EMERGENT estable; compuestos en 1.2.0; aún sin ACTIVE seco frecuente | 1 ACTIVE editorial puro |
| **VISUAL_UI** | **No validado** | Sin mappings; menciones WEAK | Política frontera UX; criterios §2.4 |
| **VISUAL_DIGITAL_ASSETS** | **No — retirar** | Bucket de tools; anti-tool lo oculta | Decisión eliminación en catálogo V3 |

### Roadmap del pack de conocimiento (no PA2)

| Versión | Contenido | PA2 |
|---------|-----------|-----|
| V2 | 14 DOMAIN, anti-tool estable | Intacto |
| **V2.1 / pack 1.2.0 (MC1.11.0)** | Aliases identidad + editorial compuesto + ilustración/retoque | Sin cambio de umbrales |
| V2.2 | Ampliar aliases residuales (p.ej. branding corporativo Patiño) | Sin cambio |
| **V3** | Retiro DIGITAL_ASSETS; UI policy; posible merge mappings | Sin cambio |

> Continuación operativa: [`mc1.11.0-visual-domain-operational-audit.md`](mc1.11.0-visual-domain-operational-audit.md).

---

## 10. Veredicto final — ¿Qué necesita Diseño Visual para declararse CONSOLIDATED?

**Estado actual:** dominio **funcionalmente validado** (V2 + PA2 estables) pero **no CONSOLIDATED** como conocimiento profesional maduro.

### Criterio propuesto de CONSOLIDATED

1. **≥3 perfiles** con MATCH conceptual **expresado en PA2** (no solo CV).
2. **≥2 especialidades distintas** con al menos **1 ACTIVE** cada una **o** ≥3 ACTIVE GRAPHIC con diversidad de evidencia no redundante.
3. **Vocabulario:** ≥90 % de formulaciones identidad/editorial recurrentes resueltas por alias (sin falsos negativos tipo Diego).
4. **Arquitectura:** decisión tomada sobre DIGITAL_ASSETS y UI.
5. **Fronteras:** documento de fronteras vigente (este §6) adoptado como política.

### Lista priorizada (exacta)

| # | Necesidad | Tipo | Impacto |
|---|-----------|------|---------|
| **1** | **Capa aliases identidad/branding** (4+ formulaciones → `diseno_de_identidad_visual` / `manuales…`) | Conocimiento V2.1 | Desbloquea Diego; fortalece Poveda/Laura/Garzón |
| **2** | **Alias editorial compuesto** (“diseño editorial y diagramación”) | Conocimiento V2.1 | Desbloquea Poveda editorial |
| **3** | **≥1 perfil ACTIVE en IDENTITY o EDITORIAL** tras V2.1 (dry-run defendible) | Validación | Prueba que especialidades no-gráficas son operativas |
| **4** | **Tercer MATCH+ACTIVE** además de Nidia y Daniel (puede ser mismo GRAPHIC o nueva especialidad) | Validación | Umbral metodológico CONSOLIDATED |
| **5** | **Decisión arquitectónica: retirar VISUAL_DIGITAL_ASSETS** en catálogo V3 | Conocimiento | Elimina ruido tool-bucket |
| **6** | Keys `ilustracion_digital`, `retoque_fotografico`, `maquetacion_publicitaria` | Conocimiento V2.2 | Cierra vacíos GRAPHIC |
| **7** | **Política UI** (¿dominio separado vs especialidad Visual con mappings?) | Gobernanza | Evita contaminación UX en Visual |
| **8** | Normalización extractor hacia keys canónicas (reduce aliases en origen) | Pipeline CV | Menos drift lexical |

### Lo que **no** se necesita para CONSOLIDATED

- Modificar PA2, umbrales, anti-tool o fingerprints.
- Nuevas personas de auditoría (corpus actual es suficiente si se cierran vacíos).
- Rediseño completo V3 de especialidades (solo limpieza DIGITAL + aliases).

---

## 11. Referencias

| Documento | Contenido |
|-----------|-----------|
| `mc1.6.0-visual-design-domain-audit.md` | Auditoría inicial Nidia |
| `mc1.6.1c.1-visual-design-candidate-evidence.md` | Garzón, Correa, Angulo, Juan Pablo |
| `mc1.6.1c.2-visual-design-v2-implementation.md` | Pack V2 + PA2 V2 |
| `mc1.6.1c.3-visual-design-validation-round2.md` | Daniel, Diego, Poveda, Laura |
| `mc-catalog.mapping-visual-design-v110.ts` | Pack congelado V2 |
| `mc-catalog.definition-mc12.ts` | Definición catálogo MC1.2 |

---

**Veredicto MC1.6.1D:** El dominio **Diseño Visual** tiene **núcleo gráfico consolidado** y **motor PA2 estable**. Para **CONSOLIDATED** falta **madurar vocabulario de identidad y editorial** (V2.1), **demostrar ACTIVE fuera de GRAPHIC**, **retirar DIGITAL_ASSETS** y **resolver política UI**. **Sin implementación en esta fase.**
