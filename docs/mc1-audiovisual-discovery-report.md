# MC1.8.0 — Producción Audiovisual · Informe de Discovery

**Fase:** MC1.8.0 · Domain Discovery (Blueprint oficial)  
**Fecha:** 2026-07-28  
**Metodología:** [`mc1-domain-blueprint.md`](mc1-domain-blueprint.md)  
**Alcance:** auditoría, cadena CV, modelado conceptual. **Sin PA2, sin catálogo, sin mappings, sin código.**

---

## Principio de evolución continua

Los dominios MC1 son **modelos evolutivos**. El estado **CONSOLIDATED** representa madurez suficiente para uso en producción, **no** cierre del dominio. Nuevas evidencias podrán ampliar vocabulario, aliases, especialidades o fronteras en versiones posteriores, manteniendo trazabilidad histórica.

Este informe documenta la **primera versión** del dominio Producción Audiovisual con la evidencia disponible hoy (dos perfiles candidatos).

---

## 1. Auditoría de perfiles semilla

### 1.1 SANTIAGO VANEGAS GARCIA — `1000944247`

| Campo | Valor |
|-------|-------|
| `person_id` | **1172** |
| Nombre | SANTIAGO VANEGAS GARCIA |
| Cargo | AUXILIAR ADMINISTRATIVO DE OPERACIONES |
| Área | DIRECCION GENERAL DE OPERACIONES |
| Jefe inmediato | VACANTE — COORDINADOR FABRICA DE CONTENIDOS… |
| CV activo | Sí (`person_cv_id=190`, `1000944247.pdf`) |
| Extracción vigente | **216** · SUCCEEDED · activa · 15 skills |
| Enrichment vigente | **14** · SUCCEEDED · activa |
| Evidence vigente | **14** · SUCCEEDED · activa |
| `source_hash` | `a684d8731c35563de9efc0a2a088b4f6e2598ee51f79ddec0ad24c3b9b40ca04` |
| Hash alineado ext↔enr | **Sí** |
| Prompt / extractor | `c2.1-2026-07-24` / `1.1.0` (vigente) |
| Cadena completa | **Sí** (completada en MC1.8.0: re-extracción + enrich + evidence) |

**Acciones MC1.8.0:** extracción histórica **100** (`c1` / 13 skills) desactivada; nueva cadena **216/14/14**.

**Métricas evidence:** 0 STRONG · **13 MODERATE** · 2 WEAK · 0 NONE · avgStrength ≈ **41.4**

---

### 1.2 JUAN PABLO SANABRIA DIAZ — `1022445625`

| Campo | Valor |
|-------|-------|
| `person_id` | **1176** |
| Nombre | JUAN PABLO SANABRIA DIAZ |
| Cargo | ANALISTA DE DISEÑO DE CONTENIDOS |
| Área | FABRICA Y DESARROLLO |
| Jefe inmediato | VACANTE — COORDINADOR FABRICA DE CONTENIDOS… |
| CV activo | Sí (`person_cv_id=104`, `1022445625.pdf`) |
| Extracción vigente | **208** · SUCCEEDED · activa · 22 skills |
| Enrichment vigente | **6** · SUCCEEDED · activa |
| Evidence vigente | **6** · SUCCEEDED · activa |
| `source_hash` | `0078bc04b776ac14f0c10853f26257e4f6994556967358b592bc2b3f5113ec81` |
| Hash alineado ext↔enr | **Sí** |
| Prompt / extractor | `c2.1-2026-07-24` / `1.1.0` (vigente) |
| Cadena completa | **Sí** (completada MC1.5.3) |

**Métricas evidence:** 0 STRONG · **10 MODERATE** · 11 WEAK · 1 NONE · avgStrength ≈ **25.0**

**Contexto previo:** clasificado **OUTSIDE** Diseño Visual (MC1.6.1C); perfil multimedia mixto auditado en MC1.5.3.

---

## 2. Selección de persona semilla

Criterios aplicados: Blueprint **§5.2 Persona semilla**.

| Criterio | Santiago (`1000944247`) | Juan Pablo (`1022445625`) |
|----------|---------------------------|---------------------------|
| Cadena CV completa | Sí (216/14/14) | Sí (208/6/6) |
| Evidencia disciplinar MODERATE+ en núcleo AV | **Sí** — 8 señales AV nucleares MODERATE+ | **Sí** — 6 señales AV nucleares MODERATE+ |
| Perfil “realista” sin ser perfecto | Sí (mezcla admin + AV + programación) | Sí (mezcla AV + visual + DI + marketing + audio) |
| Trazabilidad | Completa | Completa |
| Rol usado para inferir dominio | **No** (cargo administrativo; evidencia AV en experiencia) | **No** (cargo diseño contenidos ≠ dominio único) |

### Decisión

| Rol en corpus | Perfil | Justificación |
|---------------|--------|---------------|
| **Persona semilla** | **Santiago (`1000944247`)** | Núcleo AV **más limpio**: skills profesionales explícitas (Motion Graphics, Edición de video, Animación 2D, Iluminación, Ajuste de color) con evidencia MODERATE aplicada; menor contaminación de dominios vecinos (Visual, DI, Marketing). Mejor ancla para pack v1. |
| **Primer perfil de validación** | **Juan Pablo (`1022445625`)** | Perfil **multidisciplinar** ya contrastado con Visual: prueba fronteras AV↔Visual↔DI↔Comunicación; aporta fotografía, audio, streaming como señales secundarias. Clasificación esperada: **MATCH** en edición/animación + **BORDERLINE** por mezcla. |

**Nota metodológica:** Juan Pablo fue candidato histórico AV; Santiago emerge como semilla por **pureza de señal disciplinar**, no por antigüedad en el pipeline.

---

## 3. Auditoría profesional del CV (sin software)

### 3.1 Santiago — práctica principal

**Práctica principal:** producción y postproducción audiovisual aplicada a comunicación y contenidos explicativos (video, animación 2D, motion graphics, color y montaje).

**Problemas que resuelve:**

- Transformar briefs en piezas de video terminadas (explicativos animados, plantillas reutilizables).
- Elevar calidad visual mediante color grading y flujos estandarizados.
- Coordinar producción integral (planeación, iluminación, montaje de escenas).

**Competencias recurrentes:** edición/postproducción, animación 2D, motion graphics, ajuste de color, iluminación en set, dominio de suites de edición (Adobe, DaVinci).

**Responsabilidades recurrentes:** producción de series de video, creación de plantillas MG, dirección de producción, postproducción en tiempo real.

**Profesional vs herramienta:**

| Conocimiento profesional | Solo herramienta / listing |
|--------------------------|----------------------------|
| Animación 2D, Motion Graphics, Edición de video, Iluminación, Ajuste de color | Adobe Suite (genérico), Suite Office (listing) |
| Integración diseño + programación (creativo-tecnológico) | — |

---

### 3.2 Juan Pablo — práctica principal

**Práctica principal:** producción audiovisual y animación para contenidos institucionales/educativos, con extensiones en fotografía comercial, identidad visual y objetos de aprendizaje.

**Problemas que resuelve:**

- Material audiovisual de alta calidad para la organización (Premiere, AE, CapCut).
- Piezas de animación 2D/3D y fotografía publicitaria.
- Contenidos híbridos (InDesign educativo, iSpring interactivo).

**Competencias recurrentes:** edición y animación (vía herramientas + responsabilidad), fotografía/retoque, identidad corporativa (adyacente Visual), streaming y campañas digitales (adyacente Comunicación/Marketing).

**Profesional vs herramienta:**

| Conocimiento profesional | Solo herramienta / listing |
|--------------------------|----------------------------|
| Animación 2D/3D, Fotografía comercial, Retoque, Masterización (formación) | Blender, Animate, Protools, FL Studio, Ableton, Traktor, OBS (listing WEAK) |
| Producción AV (responsabilidad explícita) | Skill nominal “Edición de video” WEAK (actividad en herramientas MODERATE) |

---

## 4. Análisis comparativo

| Dimensión | Santiago | Juan Pablo |
|-----------|----------|------------|
| Foco disciplinar | **AV puro** (edición, MG, color, iluminación) | **Multimedia mixto** (AV + gráfico + DI + comm) |
| Skills AV MODERATE+ | 8 | 6 (más 2 foto MODERATE) |
| Motion Graphics explícito | **Sí** (MODERATE) | Implícito (AE + Animación) |
| Postproducción / color | **Sí** (MODERATE) | Implícito en edición |
| Fotografía | WEAK (listing) | **MODERATE** (comercial + retoque) |
| Audio / música | Ausente | Emergente (formación + listing tools) |
| Diseño Visual | Ausente | MODERATE (identidad, InDesign, mockups) |
| DI / e-learning | Ausente | MODERATE (iSpring) |
| Marketing / streaming | Ausente | MODERATE/WEAK (email, OBS, streaming) |
| Rol organizacional | Operaciones (fuera Fábrica) | Fábrica y Desarrollo |
| Uso en validación | Semilla MATCH | BORDERLINE + prueba fronteras |

**Convergencia:** ambos demuestran **núcleo AV** (timeline, edición, animación) con herramientas Premiere/DaVinci/AE/CapCut y responsabilidades de producción.

**Divergencia:** Juan Pablo expande el dominio hacia **fotografía**, **audio** y **comunicación digital**; Santiago profundiza **postproducción** y **dirección de producción**.

---

## 5. Hipótesis de especialidades (solo evidencia)

| Código propuesto | Especialidad | Estado hipótesis | Evidencia |
|------------------|--------------|------------------|-----------|
| `AV_EDITING` | Edición de video | **SUPPORTED** | Ambos: Premiere/DaVinci MODERATE; Santiago “Edición de video” MODERATE 53 |
| `AV_MOTION` | Motion graphics / Animación 2D | **SUPPORTED** | Santiago: MG + Animación 2D MODERATE 64.5; Juan Pablo: Animación 2D/3D MODERATE 64.5 + AE |
| `AV_POST` | Postproducción (color, finishing) | **SUPPORTED** | Santiago: Ajuste de color MODERATE; responsabilidades postproducción |
| `AV_PRODUCTION` | Producción audiovisual integral | **EMERGENT** | Santiago: dirección producción (iluminación, montaje); Juan Pablo: “Producción material audiovisual” |
| `AV_PHOTOGRAPHY` | Fotografía (comercial / dirección) | **EMERGENT** | Solo Juan Pablo: Fotografía + Retoque MODERATE 54.5 |
| `AV_SOUND` | Sonido / post audio | **RESERVED** | Solo Juan Pablo: masterización WEAK 24 + tools listing; sin responsabilidad laboral clara |
| `AV_STREAMING` | Streaming / producción en vivo | **RESERVED** | Solo Juan Pablo: OBS/Streaming WEAK 1 |
| `AV_DIRECTION` | Dirección audiovisual | **RESERVED** | Una mención Santiago; no repetida |
| `AV_3D` | Animación 3D | **REJECTED** (por ahora) | Blender/Animate listing WEAK en Juan Pablo |

**No proponer aún:** especialidad única “Producción audiovisual” como catch-all sin descomponer; el corpus sugiere **desagregar** edición, motion y post.

---

## 6. Vocabulario inicial (sin mappings)

Clasificación documental para catálogo futuro:

### 6.1 Professional Skill

| Skill (forma CV) | Perfil(es) | EE | Notas |
|------------------|------------|-----|-------|
| Animación 2D / 2D/3D | Ambos | MODERATE | Núcleo motion |
| Motion Graphics | Santiago | MODERATE | Término explícito |
| Edición de video | Ambos | MODERATE / WEAK | Juan Pablo: actividad vía tools |
| Ajuste de color | Santiago | MODERATE | Postproducción |
| Iluminación | Santiago | MODERATE | Producción en set |
| Fotografía comercial | Juan Pablo | MODERATE | ¿Sub-especialidad o vecino Visual? |
| Retoque fotográfico | Juan Pablo | MODERATE | Frontera Visual |
| Masterización de audio | Juan Pablo | WEAK | No generalizar |
| Streaming | Juan Pablo | WEAK | Listing |

### 6.2 Tool

| Skill | Perfil(es) | EE | Notas |
|-------|------------|-----|-------|
| Adobe Premiere / Premiere Pro | Ambos | MODERATE | Ancla edición, no sustituye skill profesional |
| Adobe After Effects | Juan Pablo | MODERATE | Motion |
| DaVinci Resolve | Santiago | MODERATE | Edición + color |
| CapCut | Juan Pablo | MODERATE | Edición ágil |
| Adobe Suite (genérico) | Santiago | MODERATE | Ambiguo; descomponer en pack |
| Blender, Animate | Juan Pablo | WEAK | Listing |
| Protools, FL Studio, Ableton, Traktor | Juan Pablo | WEAK | Audio listing |
| OBS Studio | Juan Pablo | WEAK | Streaming |

### 6.3 Methodology

| Skill | Perfil | Notas |
|-------|--------|-------|
| Flujos de trabajo estandarizados (Adobe) | Santiago | Mención en experiencia; no skill separada aún |

### 6.4 Transversal

| Skill | Perfil | EE |
|-------|--------|-----|
| Comunicación / asertiva | Santiago | MODERATE |
| Resolución de conflictos | Santiago | MODERATE |
| Liderazgo equipos creativos | Juan Pablo | NONE |
| Análisis de datos | Santiago | MODERATE (operaciones, no AV) |

### 6.5 Outside Domain

| Skill | Dominio vecino | Perfil |
|-------|----------------|--------|
| Manuales identidad corporativa | Diseño Visual | Juan Pablo |
| Mockups publicitarios | Diseño Visual | Juan Pablo |
| Adobe InDesign | Diseño Visual / Editorial | Juan Pablo |
| iSpring | Diseño Instruccional | Juan Pablo |
| E-mail marketing | Marketing / Comunicación | Juan Pablo |
| Programación de software | Desarrollo / TI | Santiago |
| Suite Office | Transversal genérico | Santiago |

---

## 7. Fronteras

### 7.1 Producción Audiovisual ↔ Diseño Visual

| Pertenece AV | No pertenece (Visual) | Zona gris |
|--------------|----------------------|-----------|
| Edición de timeline, motion, color grading | Identidad corporativa, mockups, maquetación InDesign | Retoque fotográfico; thumbnails diseñados como gráfico |
| Premiere, AE, DaVinci, CapCut | Illustrator, Photoshop como núcleo | Fotografía comercial cuando entregable es still |

**Regla (heredada Visual §6.1):** si el entregable principal es **timeline de video**, es AV aunque use suite Adobe.

### 7.2 Producción Audiovisual ↔ Marketing

| Pertenece AV | No pertenece | Zona gris |
|--------------|--------------|-----------|
| Pieza de video terminada para campaña | E-mail marketing, analítica, SEO | Video para redes sin evidencia de producción (solo publicación) |

### 7.3 Producción Audiovisual ↔ Comunicación

| Pertenece AV | No pertenece | Zona gris |
|--------------|--------------|-----------|
| Streaming técnico (OBS), producción en vivo | Redacción, community management | Contenido para redes cuando núcleo es rodaje/edición |

### 7.4 Producción Audiovisual ↔ Diseño Instruccional

| Pertenece AV | No pertenece | Zona gris |
|--------------|--------------|-----------|
| Video explicativo animado (producción) | SCORM, granulación, iSpring como autoría pedagógica | Videos dentro de OVA sin skill DI explícita |

---

## 8. Vacíos de conocimiento

| Vacío | Impacto | Acción |
|-------|---------|--------|
| Solo **2 perfiles**; fotografía y audio en **un** perfil | No consolidar AV_PHOTOGRAPHY ni AV_SOUND | Buscar 1–2 perfiles fotógrafo/video puro |
| Sin perfil **OUTSIDE** puro (solo Visual o solo DI) | Riesgo falsos positivos en Prototype | Incluir candidato Visual puro (ej. Poveda) como OUTSIDE AV |
| Skill “Producción audiovisual” no extraída como tal | Dependencia de tools | Alias futuro desde responsabilidades |
| DaVinci vs Premiere vs CapCut | Tres tools, una disciplina | Anti-tool PA2 obligatorio |
| Animación 3D | Solo listing | No especialidad AV_3D hasta nuevo corpus |
| Dirección audiovisual | Una mención | RESERVED |
| Sonido profesional | Formación + DAWs listing | Esperar perfil audio/post |

**Conceptos de una sola aparición (no generalizar):** iluminación de escena (solo Santiago), plantillas MG personalizadas (solo Santiago), Music Business diplomado (Juan Pablo).

---

## 9. Riesgos

| # | Riesgo | Mitigación |
|---|--------|------------|
| R1 | Absorción de perfil Visual (identidad, InDesign) | Frontera explícita; PA2 anti-contaminación |
| R2 | Tools (Premiere solo) activan dominio sin skill profesional | Regla Visual replicada: profesional antes que tool |
| R3 | Cargo “Analista diseño contenidos” mezcla dominios | Clasificar por evidencia, no cargo |
| R4 | Especialidad foto/audio prematura | RESERVED hasta ≥2 perfiles o MODERATE repetido |
| R5 | Corpus en misma lía org (Fábrica) | Santiago en Operaciones aporta diversidad parcial |
| R6 | “Adobe Suite” genérico infla score | Descomponer en mappings v1 |

---

## 10. Estado de madurez inicial

| Nivel | Valor | Justificación |
|-------|-------|---------------|
| **Dominio** | **DISCOVERED** | Auditoría completa; cadena CV en ambos perfiles; hipótesis de especialidades; vocabulario inicial; fronteras documentadas; informe GO (Blueprint §4.2) |
| Especialidades núcleo (EDITING, MOTION, POST) | **DRAFT** | ≥2 perfiles con señal MODERATE; sin mappings |
| Especialidades periféricas (PHOTO, SOUND, STREAMING) | **RESERVED** | Evidencia insuficiente o un solo perfil |

**No alcanza:** PROTOTYPE (falta catálogo/pack/PA2), VALIDATING (corpus <3 perfiles diversos), CONSOLIDATED.

---

## 11. Veredicto GO / NO-GO

### ¿Evidencia suficiente para iniciar implementación (Prototype MC1.8.1)?

**Veredicto: GO condicionado**

| Componente | ¿Listo? | Nota |
|------------|---------|------|
| Definición conceptual del dominio | **Sí** | Propósito, alcance, fronteras |
| Persona semilla con cadena CV | **Sí** | Santiago 216/14/14 |
| Especialidades núcleo (edición, motion, post) | **Sí** | SUPPORTED en 2 perfiles |
| Vocabulario inicial | **Sí** | Sin mappings aún |
| Pack v1 / PA2 v1 | **Pendiente** | Fase Prototype |
| Especialidades foto / audio / streaming | **No** | Esperar más perfiles |
| Corpus VALIDATING (≥3) | **No** | Solo 2 perfiles AV candidatos |

**Conclusión:** hay evidencia **suficiente para Prototype** del **núcleo** (edición + motion + postproducción). **No** esperar nuevos perfiles para iniciar catálogo/pack/PA2 v1 del núcleo. **Sí** incorporar perfiles adicionales **antes** de declarar especialidades periféricas (foto, sonido, streaming) o avanzar a VALIDATING.

---

## 12. Próximos pasos recomendados

1. **MC1.8.1 Prototype:** catálogo `AUDIOVISUAL_PRODUCTION`, pack v1 (skills núcleo), PA2 v1 con anti-tool, dry-run semilla Santiago.
2. **Validación:** persistir dry-run Juan Pablo; añadir perfil OUTSIDE Visual puro y perfil BORDERLINE DI.
3. **Aliases prioritarios:** `edición de video`, `producción audiovisual`, `motion graphics`, `animación 2D`, `postproducción`.
4. **Fronteras:** adoptar §7 como política en Domain Guide; alinear con [`mc1-visual-design-domain-guide.md`](mc1-visual-design-domain-guide.md) §6.1.
5. **Revisión:** tras 1 ronda Prototype, reevaluar AV_PHOTOGRAPHY con corpus ampliado.

---

## 13. Referencias y artefactos

| Artefacto | Ruta |
|-----------|------|
| Preflight MC1.8.0 | `tmp/mc180-preflight.json` |
| Extracción Santiago | `tmp/cv-skills/1000944247.json` |
| Extracción Juan Pablo | `tmp/cv-skills/1022445625.json` |
| Enrichment Santiago | `tmp/cv-skills-enrichment/1000944247-e1-20260728-091432.json` |
| Evidence Santiago | `tmp/cv-evidence/enrichment-14-er2-20260728-091451.json` |
| Perfil Juan Pablo (MC1.5.3) | `tmp/cv-attributes/mc1.5.3-profile-1022445625.json` |
| Blueprint | `docs/mc1-domain-blueprint.md` |
| Domain Guide (borrador) | `docs/mc1-audiovisual-domain-guide.md` |

---

**Informe:** MC1.8.0 · Discovery · Producción Audiovisual · 2026-07-28
