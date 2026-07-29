# Guía del dominio — Producción Audiovisual (AUDIOVISUAL_PRODUCTION)

**Versión documental:** MC1.8.1 · 2026-07-28  
**Estado del dominio:** **PROTOTYPE**  
**Pack vigente:** `audiovisual-production-mappings@1.0.0` (`f75ae6ee…08870`)  
**PA2 vigente:** `pa2-audiovisual-production-1.0.0` (`pa2-algo-lexico-v2`)  
**Blueprint:** [`mc1-domain-blueprint.md`](mc1-domain-blueprint.md)

**Corpus de evidencia:** Santiago (`1000944247`, ext **216** / enr **14** / ev **14**); Juan Pablo (`1022445625`, ext **208** / enr **6** / ev **6**)  
**Artefactos:** … · [`mc1.8.1b-audiovisual-prototype-stabilization.md`](mc1.8.1b-audiovisual-prototype-stabilization.md) · `tmp/mc181b/`

> **Principio de evolución continua:** este dominio es un modelo evolutivo. DISCOVERED ≠ cerrado. CONSOLIDATED (futuro) tampoco implicará congelamiento del vocabulario.

---

## 0. Metadatos **(obligatorio)**

| Campo | Valor |
|-------|-------|
| `DOMAIN_CODE` | `AUDIOVISUAL_PRODUCTION` |
| Nombre | Producción Audiovisual |
| `MC_CATALOG_VERSION` | `mc1.8-2026-07-28` |
| Estado madurez dominio | **PROTOTYPE** |
| Autor / fase | MC1.8.1 · Domain Prototype |
| Última revisión | 2026-07-28 |

---

## 1. Propósito del dominio **(obligatorio)**

### 1.1 Qué es

**Producción Audiovisual** es la disciplina de **planificar, capturar, editar, animar y finalizar contenidos en soporte temporal** (video, motion graphics, animación 2D, streaming técnico) para comunicar mensajes institucionales, educativos o promocionales. Incluye la cadena **pre→producción→postproducción** cuando el entregable principal es un **timeline audiovisual**, no una pieza gráfica estática.

### 1.2 Qué no es

| No es | Por qué |
|-------|---------|
| Un cargo (“Analista de diseño de contenidos”) | Mezcla visual, AV, DI y comunicación; el dominio filtra por evidencia CV. |
| Un área (“Fábrica y Desarrollo”) | Convive con diseñadores gráficos, pedagógicos y AV en la misma unidad. |
| Diseño gráfico / identidad visual | Identidad, mockups, InDesign editorial → dominio Visual (OUTSIDE AV). |
| Diseño instruccional | SCORM, granulación, autoría pedagógica iSpring → dominio Instruccional. |
| Marketing digital / performance | E-mail marketing, analítica, SEO → dominio Marketing. |
| Producción musical como núcleo | DAWs y masterización sin entregable audiovisual → fuera o especialidad reservada. |
| Mera lista de software | Premiere/AE/DaVinci **apoyan**; no sustituyen skills profesionales (anti-tool). |

### 1.3 Pregunta rectora

> ¿Qué representa realmente Producción Audiovisual en los CV de la organización?

**Respuesta consolidada (v1):** un **núcleo temporal** (edición, animación/motion, postproducción/color) expresado mediante **responsabilidades de producción** y **herramientas de timeline**, frecuentemente **coexistente** con competencias gráficas, pedagógicas o de comunicación que **no deben contaminar** el score AV. El dominio debe **reconocer la práctica profesional antes que la herramienta** y tratar sinónimos frecuentes (`edición de video`, `producción audiovisual`, `motion graphics`, `animación 2D`).

---

## 2. Objetivo en MC1 **(obligatorio)**

Permitir clasificar perfiles cuya evidencia CV demuestre **práctica audiovisual aplicada** (no solo herramientas listadas), desagregando especialidades de edición, motion/post y — en fases futuras — fotografía en movimiento, sonido para video o streaming, cuando el corpus lo respalde.

Este dominio cierra un **gap** detectado en Diseño Visual: Premiere, After Effects, CapCut y edición de video están explícitamente **OUTSIDE** Visual y requieren hogar propio.

---

## 3. Especialidades — fichas técnicas **(obligatorio)**

> Estado Discovery: definiciones conceptuales **sin mappings ni keys canónicas**. Sub-estados según Blueprint §4.3.

### 3.1 AV_EDITING — Edición de video

#### Definición profesional

Práctica de **ensamblar, narrar y exportar** contenido en timeline: cortes, ritmo, transiciones, sincronización básica audio-imagen, entrega de piezas terminadas.

#### Competencias nucleares

- Edición de video como disciplina (explícita o vía responsabilidad laboral).
- Uso aplicado de NLE (Premiere, DaVinci Resolve, CapCut).

#### Competencias accesorias

- Postproducción en tiempo real (cuando no alcanza umbral POST).
- Flujos estandarizados de edición.

#### Skills canónicas (pack vigente)

*(pendiente Prototype)*

#### Aliases propuestos / vigentes

| Formulación en CV | → Canónica propuesta | Estado |
|-------------------|----------------------|--------|
| Edición de video | `edicion_de_video` | **PROPOSED** |
| Adobe Premiere / Premiere Pro | `adobe_premiere_pro` | **PROPOSED** (TOOL) |
| DaVinci Resolve | `davinci_resolve` | **PROPOSED** (TOOL) |
| CapCut | `capcut` | **PROPOSED** (TOOL) |

#### Herramientas asociadas

Adobe Premiere Pro, DaVinci Resolve, CapCut, Adobe Suite (descomponer).

#### Skills que NO pertenecen

- Illustrator, Photoshop como núcleo (Visual).
- iSpring, SCORM (Instruccional).

#### Ejemplos reales (corpus)

| Señal en CV | Evidencia EE | Perfil |
|-------------|--------------|--------|
| “utilizando DaVinci Resolve y Adobe Premiere” | MODERATE 40–50 | Santiago |
| “Producción material audiovisual… Premiere, AE, CapCut” | MODERATE 50 | Juan Pablo |
| “Edición de video” en skills | MODERATE 53 / WEAK 1 | Santiago / Juan Pablo |

#### Nivel de madurez especialidad

**DRAFT** — SUPPORTED en 2 perfiles; MODERATE repetido; sin pack.

---

### 3.2 AV_MOTION — Motion graphics y animación 2D

#### Definición profesional

Creación de **gráficos en movimiento** y **animación 2D** para piezas explicativas, intros, plantillas reutilizables o secuencias animadas.

#### Competencias nucleares

- Animación 2D / Motion Graphics declarados y aplicados.
- After Effects u homólogos con evidencia laboral.

#### Competencias accesorias

- Animación 2D/3D genérica (3D solo listing → no incluir aún).

#### Skills canónicas (pack vigente)

*(pendiente Prototype)*

#### Aliases propuestos / vigentes

| Formulación en CV | → Canónica propuesta | Estado |
|-------------------|----------------------|--------|
| Motion graphics | `motion_graphics` | **PROPOSED** |
| Animación 2D / 2D/3D | `animacion_2d` | **PROPOSED** |
| Adobe After Effects | `adobe_after_effects` | **PROPOSED** (TOOL) |

#### Herramientas asociadas

After Effects, Animate (listing débil), Blender (listing — no activar 3D).

#### Skills que NO pertenecen

- Ilustración estática (Visual).
- Rigging 3D avanzado (sin evidencia).

#### Ejemplos reales (corpus)

| Señal en CV | Evidencia EE | Perfil |
|-------------|--------------|--------|
| “plantillas de motion graphics personalizadas” | MODERATE 40 | Santiago |
| “videos explicativos animados en 2D” | MODERATE 64.5 | Santiago |
| “animación 2D/3D” + AE | MODERATE 64.5 / 50 | Juan Pablo |

#### Nivel de madurez especialidad

**DRAFT** — SUPPORTED en 2 perfiles.

---

### 3.3 AV_POST — Postproducción

#### Definición profesional

**Finalización** de piezas audiovisuales: color grading, ajuste de color, finishing, preparación de master para entrega.

#### Competencias nucleares

- Ajuste de color / color grading aplicado.
- Postproducción de video en responsabilidades.

#### Competencias accesorias

- DaVinci Resolve como herramienta dual edición+color.

#### Skills canónicas (pack vigente)

*(pendiente Prototype)*

#### Aliases propuestos / vigentes

| Formulación en CV | → Canónica propuesta | Estado |
|-------------------|----------------------|--------|
| Ajuste de color | `ajuste_de_color` | **PROPOSED** |
| Postproducción de video | `postproduccion_video` | **PROPOSED** |

#### Ejemplos reales (corpus)

| Señal en CV | Evidencia EE | Perfil |
|-------------|--------------|--------|
| “ajuste de color y postproducción de video” | MODERATE 40 | Santiago |
| “postproducción de video en tiempo real” | MODERATE 53 (vía Edición) | Santiago |

#### Nivel de madurez especialidad

**DRAFT** — Evidencia clara en 1 perfil, implícita en 2º; SUPPORTED para Prototype núcleo.

---

### 3.4 AV_PRODUCTION — Producción audiovisual integral

#### Definición profesional

**Coordinación y ejecución** de producción: planeación, iluminación, montaje de escenas, dirección técnica de rodaje o set.

#### Competencias nucleares

- Responsabilidades de producción integral en experiencia laboral.

#### Nivel de madurez especialidad

**RESERVED** — EMERGENT (Santiago: iluminación MODERATE; “Dirijo producción integral”). Validar con más perfiles antes de mappings dedicados.

---

### 3.5 AV_PHOTOGRAPHY — Fotografía (comercial / dirección)

#### Definición profesional

Captura y dirección de fotografía **cuando el CV ancla práctica fotográfica** aplicada (comercial, publicitaria).

#### Nivel de madurez especialidad

**RESERVED** — EMERGENT solo en Juan Pablo (MODERATE 54.5). Frontera con Visual. **No mappings** hasta corpus ampliado.

---

### 3.6 AV_SOUND — Sonido y post audio

#### Nivel de madurez especialidad

**RESERVED** — Masterización WEAK + DAWs listing (Juan Pablo). **No implementar** en Prototype v1.

---

### 3.7 AV_STREAMING — Streaming / producción en vivo

#### Nivel de madurez especialidad

**RESERVED** — OBS/Streaming WEAK (Juan Pablo). Zona gris con Comunicación.

---

## 4. Matriz de vocabulario del dominio **(obligatorio)**

> Discovery: clasificación sin keys canónicas en pack. Tipos: **PROFESSIONAL** · **TOOL** · **METHODOLOGY** · **TRANSVERSAL** · **NO PERTENECE**

### 4.1 Skills con evidencia MODERATE+ (núcleo AV)

| Skill encontrada | Perfil(es) | EE | Tipo | Especialidad hipótesis |
|------------------|------------|-----|------|------------------------|
| Animación 2D / 2D/3D | Ambos | MODERATE | PROFESSIONAL | AV_MOTION |
| Motion Graphics | Santiago | MODERATE | PROFESSIONAL | AV_MOTION |
| Edición de video | Ambos | MODERATE / WEAK* | PROFESSIONAL | AV_EDITING |
| Ajuste de color | Santiago | MODERATE | PROFESSIONAL | AV_POST |
| Iluminación | Santiago | MODERATE | PROFESSIONAL | AV_PRODUCTION |
| Adobe Premiere / Pro | Ambos | MODERATE | TOOL | AV_EDITING |
| DaVinci Resolve | Santiago | MODERATE | TOOL | AV_EDITING / AV_POST |
| Adobe After Effects | Juan Pablo | MODERATE | TOOL | AV_MOTION |
| CapCut | Juan Pablo | MODERATE | TOOL | AV_EDITING |
| Adobe Suite (genérico) | Santiago | MODERATE | TOOL | *(descomponer)* |
| Fotografía comercial | Juan Pablo | MODERATE | PROFESSIONAL | AV_PHOTOGRAPHY (reservada) |
| Retoque fotográfico | Juan Pablo | MODERATE | PROFESSIONAL | NO PERTENECE / Visual gris |

\* Juan Pablo: skill nominal WEAK; actividad MODERATE vía herramientas.

### 4.2 Skills recurrentes sin key canónica (vacíos)

| Skill encontrada | Frecuencia | Canónica propuesta | Especialidad | Tipo |
|------------------|------------|--------------------|--------------|------|
| Postproducción (implícita) | 2 | `postproduccion_video` | AV_POST | PROFESSIONAL |
| Producción audiovisual (responsabilidad) | 2 | `produccion_audiovisual` | AV_PRODUCTION | PROFESSIONAL |
| Streaming / OBS | 1 | `streaming` | AV_STREAMING | PROFESSIONAL |
| Masterización de audio | 1 | `masterizacion_audio` | AV_SOUND | PROFESSIONAL |

---

## 5. Redundancias detectadas **(obligatorio antes de STABLE)**

### 5.1 Aliases / sinónimos no unificados

- `Adobe Premiere` vs `Adobe Premiere Pro` vs `Premiere Pro`
- `Animación 2D` vs `Animación 2D/3D`
- `DaVinci Resolve` vs `Davinci Resolve` (forma CV)
- `Producción audiovisual` (responsabilidad) vs tools NLE

### 5.2 Herramientas repetidas

Premiere + DaVinci + CapCut + AE + Adobe Suite genérico → riesgo **doble conteo**; PA2 debe aplicar anti-tool y cardinalidad.

### 5.3 Skills demasiado amplias / ambiguas

| Skill | Problema |
|-------|----------|
| Adobe Suite | Agrupa edición, motion y posible gráfico |
| Animación 2D/3D | 3D no evidenciado (Blender WEAK) |
| Edición de video | Skill nominal vs actividad en tools |

---

## 6. Vacíos del catálogo **(obligatorio)**

| Prioridad | Concepto | Perfiles afectados |
|-----------|----------|-------------------|
| P0 | Keys canónicas núcleo (edición, motion, post) | Ambos |
| P0 | Perfil OUTSIDE AV (Visual puro) | Ninguno aún |
| P1 | Fotografía como especialidad AV | Juan Pablo solo |
| P1 | Sonido / streaming | Juan Pablo solo |
| P2 | Animación 3D | Listing insuficiente |

---

## 7. Fronteras del dominio **(obligatorio)**

### 7.1 Producción Audiovisual ↔ Diseño Visual

| Pertenece AV | No pertenece | Zona gris |
|--------------|--------------|-----------|
| Timeline video, motion, color grading | Identidad, mockups, InDesign, Illustrator/Photoshop núcleo | Retoque fotográfico; fotografía still |
| Premiere, AE, DaVinci, CapCut | Canva, Figma | Thumbnails diseñados como gráfico |

**Regla:** entregable principal = **timeline** → AV.

### 7.2 Producción Audiovisual ↔ Marketing

| Pertenece AV | No pertenece | Zona gris |
|--------------|--------------|-----------|
| Video producido para campaña | E-mail marketing, analítica, SEO | Video para redes sin evidencia de producción |

### 7.3 Producción Audiovisual ↔ Comunicación

| Pertenece AV | No pertenece | Zona gris |
|--------------|--------------|-----------|
| Streaming técnico (OBS), live switching | Community management, redacción | Contenido RRSS sin rodaje/edición |

### 7.4 Producción Audiovisual ↔ Diseño Instruccional

| Pertenece AV | No pertenece | Zona gris |
|--------------|--------------|-----------|
| Video explicativo animado (producción) | SCORM, granulación, autoría iSpring pedagógica | OVA con video embebido |

---

## 8. Casos ambiguos **(obligatorio)**

| Caso | Resolución propuesta |
|------|----------------------|
| Perfil “multimedia” (Juan Pablo) | Descomponer: AV vs Visual vs DI por skill; no un solo default |
| Premiere sin skill “Edición” | Contar actividad vía tool MODERATE + anti-tool |
| Fotografía comercial | AV_PHOTOGRAPHY reservada; no contaminar AV_EDITING |
| iSpring + video | DI para autoría; AV solo si evidencia producción video |
| Santiago: programación + AV | AV no absorbe desarrollo software |

---

## 9. Corpus de validación **(obligatorio)**

### 9.1 Persona semilla

| Campo | Valor |
|-------|-------|
| Referencia | Santiago VANEGAS · `1000944247` |
| person_id | **1172** |
| ext / enr / ev | **216** / **14** / **14** |
| source_hash | `a684d873…b40ca04` |
| Clasificación conceptual | **MATCH** (núcleo AV) |
| PA2 dry-run | **MATCH** — 3 ACTIVE (EDITING default); eval persistida id=**7** |

### 9.2 Tabla comparativa (corpus Discovery)

| Perfil | Clasificación conceptual | Rol en corpus | Notas |
|--------|--------------------------|---------------|-------|
| Santiago | **MATCH** | Semilla | AV puro; 3 ACTIVE en PA2 v1 |
| Juan Pablo | **MATCH / BORDERLINE** | Validación 1 | AV_MOTION ACTIVE; EDITING EMERGENT (anti-tool) |

### 9.3 Falsos positivos / negativos documentados

| Tipo | Perfil | Causa | Acción (Prototype) |
|------|--------|-------|---------------------|
| FP potencial | Juan Pablo | Identidad MODERATE | Frontera Visual; no score AV |
| FN potencial | — | Sin OUTSIDE puro aún | Añadir perfil Visual puro |

---

## 10. Roadmap del dominio **(obligatorio)**

### 10.1 Por especialidad

| Especialidad | ¿Consolidado? | Próximo hito |
|--------------|---------------|--------------|
| AV_EDITING | Parcial (SUPPORTED) | Validating: más perfiles WEAK→MODERATE |
| AV_MOTION | Parcial (SUPPORTED) | Validating: alias corpus ampliado |
| AV_POST | No (**EMERGENT**) | +1 perfil con color/finishing profesional |
| AV_PRODUCTION | No | Más perfiles |
| AV_PHOTOGRAPHY | No | Corpus +2 |
| AV_SOUND / STREAMING | No | Reservado |

### 10.2 Por versión (conocimiento)

| Versión | Contenido | PA2 |
|---------|-----------|-----|
| Discovery (MC1.8.0) | Definición, fronteras, vocabulario | — |
| Prototype (MC1.8.1) | Catálogo + pack v1 + PA2 v1 | v1 (`pa2-audiovisual-production-1.0.0`) |
| Validating (MC1.8.1C) | Hermanos + fronteras Visual/DI | — |

---

## 11. Veredicto y declaración de madurez **(obligatorio al cierre)**

**Estado:** **PROTOTYPE**

**Madurez metodológica núcleo (MC1.8.1B):** `AV_EDITING` y `AV_MOTION` → **SUPPORTED**; `AV_POST` → **EMERGENT** (ACTIVE en Santiago es resultado individual, no madurez de especialidad).

### Criterios CONSOLIDATED

No aplican en esta fase. Ver [`mc1-domain-validation-checklist.md`](templates/mc1-domain-validation-checklist.md) en hitos futuros.

### Lista priorizada pendiente

| # | Necesidad | Prioridad |
|---|-----------|-----------|
| 1 | MC1.8.1C Validating (OUTSIDE Visual, BORDERLINE DI) | P0 |
| 2 | Re-seed mappings Software/Visual en catálogo mc1.8 | **Completado** (MC1.8.1B) |
| 3 | Aliases adicionales si corpus lo exige | P1 |
| 4 | Decisión AV_PHOTOGRAPHY vs Visual | P1 |
| 5 | Perfil sonido/streaming dedicado | P2 |

---

## 12. Referencias

| Documento | Contenido |
|-----------|-----------|
| [`mc1-audiovisual-discovery-report.md`](mc1-audiovisual-discovery-report.md) | Informe Discovery completo |
| [`mc1-domain-blueprint.md`](mc1-domain-blueprint.md) | Metodología oficial |
| [`mc1-visual-design-domain-guide.md`](mc1-visual-design-domain-guide.md) | Frontera Visual↔AV |
| [`mc1.5.3-content-domain-validation.md`](mc1.5.3-content-domain-validation.md) | Auditoría Juan Pablo |
| [`templates/mc1-domain-template.md`](templates/mc1-domain-template.md) | Plantilla base |

---

**Guía:** MC1.8.1 · Producción Audiovisual · PROTOTYPE · 2026-07-28
