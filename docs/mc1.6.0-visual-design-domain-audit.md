# MC1.6.0 — Auditoría y propuesta técnica: dominio Diseño Visual

**Modo:** solo lectura · **Sin migraciones, seeds, PA2, frontend, catálogo ni commits**  
**Fecha:** 2026-07-27  
**Semilla:** documento `1015482688` — NIDIA MARCELA PRADA RAMIREZ  
**Artefacto JSON:** `tmp/cv-attributes/mc1-visual-design-audit-nidia-ro.json`

---

## 1. Resumen ejecutivo

La evidencia vigente de Nidia (extracción **207** / enrichment **5** / evidence **5**, hash `467d…`) **sí permite** una primera versión documental de un dominio **Diseño Visual**, centrado en la disciplina (no en el área “Fábrica de Contenidos”).

El motor MC1 (tablas `mc_*`, PA2, API de detalle) es **multi-dominio en diseño**, pero el **contenido sembrado, el summary API, el hash de mappings y el radar FE están acoplados a SOFTWARE**. Por eso Nidia **no puede ver Competencias** hoy aunque su pipeline CV esté completo: no hay dominio, mappings ni evaluación PA2 de Diseño Visual, y el explorador fuerza SOFTWARE.

**Veredicto:** **GO CON AJUSTES** → avanzar a MC1.6.1B solo tras desacoplar summary/radar y definir catálogo + mappings + `pa2-visual-design-1.0.0`, evaluando primero a Nidia y luego 3–8 hermanos.

---

## 2. Persona y CV vigente

| Campo | Valor verificado (Cloud 2026-07-27) |
|-------|-------------------------------------|
| person_id | **1163** |
| Nombre | NIDIA MARCELA PRADA RAMIREZ |
| Documento | 1015482688 |
| Correo institucional | nidia_prada@cun.edu.co |
| Rol | ANALISTA DE DISEÑO DE CONTENIDOS |
| Área | FABRICA Y DESARROLLO |
| Activo | **Sí** |
| Jefe inmediato | VACANTE — COORDINADOR FABRICA DE CONTENIDOS… (`person_id=1206`) |
| person_cv.id | **7** (activo) |
| drive_file_id | `15JMUTCX4mtnx0VH0yCO24CXifE42lACO` |
| Archivo | `1015482688.pdf` |
| synced_at | 2026-07-24T19:59:06.977Z |
| drive_modified_time | 2026-07-24T13:42:18.000Z |
| md5 | `b2eed475307d435df1976fcbeed43225` |

---

## 3. Trazabilidad del pipeline

```
person_cv 7  →  cv_extraction 207  →  enrichment 5  →  evidence 5
pdf_sha256 = 467d7dbea064e77535fe2c3742e58c6adfff499fc98745f3a68844d62f86f3a6
```

| Check | Resultado |
|-------|-----------|
| Extracción sobre CV activo (7) | Sí |
| Enrichment sobre extracción 207 | Sí |
| Mismo `pdf_sha256` extracción↔enrichment | Sí |
| Evidence sobre enrichment 5 | Sí |
| Estados SUCCEEDED + activos | Sí |
| PA2 | **0** (esperado) |
| Cadena coherente | **`chain.ok = true`** |

### Históricas (no vigentes)

| ID | Tipo | Hash | Activa | Nota |
|----|------|------|--------|------|
| 87 | extracción | `6c29…` | No | Histórica post-drift MC1.5.2C |
| 88 | extracción | `6c29…` | No | FAILED |
| 3, 4 | enrichment | (sobre 87) | No | Históricas |
| 4 | evidence | enrichment 4 | No | Histórica |

**No mezclar** resultados de 87/4/4 con la cadena vigente 207/5/5.

---

## 4. Inventario de competencias

Fuente: extracción 207 + evidence 5. Confianza extractor = 1.000 en todas las filas listadas.

### 4.1 Habilidades / conocimientos profesionales

| Competencia | Tipo | Categoría | EE | Strength | Fuentes | Observación |
|-------------|------|-----------|-----|----------|---------|-------------|
| Diseño Gráfico | PROFESSIONAL_KNOWLEDGE | Diseño y Edición Multimedia | **MODERATE** | 66 | EDUCATION+WORK+PROFILE+SKILLS | **Núcleo** del dominio |
| Diseño editorial | PROFESSIONAL_KNOWLEDGE | idem | WEAK | 5 | PROFILE | Mención débil |
| Comunicación Visual | PROFESSIONAL_KNOWLEDGE | idem | NONE | 0 | SKILLS | Solo listing |
| Diseño instruccional | PROFESSIONAL_KNOWLEDGE | E-Learning… | WEAK | 2 | PROFILE+SKILLS | Frontera con otro dominio |
| Microaprendizaje | PROFESSIONAL_KNOWLEDGE | E-Learning… | NONE | 0 | SKILLS | Listing |
| Control de Calidad (QA) | PROFESSIONAL_KNOWLEDGE | Control… | **MODERATE** | 50 | WORK+SKILLS | QA pedagógico/visual |
| Gestión de proyectos | PROFESSIONAL_KNOWLEDGE | Control… | WEAK | 14 | EDUCATION | Curso Coursera |

### 4.2 Tecnologías

| Competencia | EE | Strength | Observación |
|-------------|-----|----------|-------------|
| SCORM | MODERATE | 52 | Actividad e-learning |
| LMS | MODERATE | 52 | Actividad e-learning |
| Inteligencia Artificial | MODERATE | 63 | Soporte al flujo creativo |

### 4.3 Metodologías

| Competencia | EE | Strength | Observación |
|-------------|-----|----------|-------------|
| Prompting | MODERATE | 50 | Metodología / soporte IA |

### 4.4 Herramientas (no especialidades)

| Competencia | EE | Strength | Observación |
|-------------|-----|----------|-------------|
| Adobe Illustrator | WEAK | 2 | Perfil + skills |
| Adobe Photoshop | WEAK | 2 | Perfil + skills |
| Adobe InDesign | WEAK | 2 | Skills/perfil |
| Adobe Premiere Pro | NONE | 0 | Solo listing |
| Adobe After Effects | NONE | 0 | Solo listing |
| Canva | NONE | 0 | Listing |
| CapCut | NONE | 0 | Listing |
| Moodle, iSpring, Genially, isEAZY | NONE | 0 | Listing e-learning |
| Midjourney, Runway, Grok | NONE | 0 | Listing IA |

### 4.5 Transversales (SOFT_SKILL)

Comunicación asertiva, Trabajo en equipo, Empatía, Liderazgo de equipos, Escucha activa, Resolución de conflictos, Adaptabilidad, Orientación a resultados, Pensamiento crítico, Gestión del tiempo, Atención al detalle, Capacidad analítica — **todas Evidence NONE**. Tratar como transversales / no mapear a especialidades de Diseño Visual en v1.

### 4.6 Idiomas y certificaciones

| Tipo | Detalle |
|------|---------|
| Idiomas | Español Nativo; Inglés B1 |
| Certificación/curso | Gestión de Proyectos (Coursera, 2025) |

---

## 5. Arquitectura actual reutilizable

| Pieza | Archivo / tabla | Responsabilidad | ¿Genérica? |
|-------|-----------------|-----------------|------------|
| Catálogo versionado | `mc_catalog_version`, `McCatalogVersion` | Versionar dominios | Sí |
| Dominio | `mc_domain`, `McDomain` | Área de experiencia | Sí (hoy solo SOFTWARE) |
| Especialidad | `mc_specialty`, `McSpecialty` | Ejes del radar | Sí |
| Clasificación skill×dominio | `mc_skill_domain_classification` | DOMAIN_SPECIALTY / TRANSVERSAL / … | Parcial (enum `OUTSIDE_SOFTWARE_DOMAIN`) |
| Mapping skill↔especialidad | `mc_skill_specialty_mapping` | weight, PRIMARY/SECONDARY | Sí |
| Skills canónicas | `cv_skill` | Identidad de skill | Sí |
| Motor PA2 | `mc-pa2.engine.ts` `runMcPa2Engine` | Coverage/strength/confidence/ranking | **Sí** |
| Config PA2 | `mc-pa2.config.ts` | Umbrales + estrategia | Parcial (nombres `pa2-software-*`) |
| Persistencia PA2 | `mc_profile_evaluation`, `mc_profile_specialty_result` | Evaluación por persona | Sí |
| Orquestación | `mc-pa2.service.ts` | Carga evidencia + mappings | Parcial (hash pack SOFTWARE) |
| API detalle | `GET .../competencies/domains/:domainCode` | Lectura | Sí |
| API specialty | `.../specialties/:specialtyCode` | Skills + evidencia | Sí |
| FE métricas/skills | `SpecialtyDetailPanel`, `SkillAccordionItem` | Data-driven | Sí |
| Geometría radar | `radarGeometry.ts` | n-gon | Sí |

Definición SOFTWARE: `mc-catalog.definition-mc12.ts` · Mappings: `mc-catalog.mapping-software-mc11.ts` · Spec: `docs/mc1.2-functional-spec-software-domain.md`.

---

## 6. Acoplamientos a Software

| Acoplamiento | Ubicación | Impacto | ¿Bloquea Diseño Visual? | Recomendación |
|--------------|-----------|---------|-------------------------|---------------|
| Solo dominio SOFTWARE en seed | `mc-catalog.definition-mc12.ts` | Alto | **Sí** | Nueva entrada de catálogo / versión |
| Pack mappings SOFTWARE | `mapping-software-mc11.ts`, `seedSoftwareMappings` | Alto | **Sí** | Pack `visual-design` + seed genérico |
| Enum `OUTSIDE_SOFTWARE_DOMAIN` | `mc-catalog.types.ts` | Medio | Parcial | Renombrar a `OUTSIDE_DOMAIN` o por dominio |
| Rules `pa2-software-*` | `mc-pa2.config.ts` | Medio | **Sí** (versionado limpio) | `pa2-visual-design-1.0.0` |
| Hash siempre pack SOFTWARE | `mc-pa2.service.ts` | Alto | **Sí** | Hash por dominio/pack activo |
| Summary fuerza SOFTWARE | `org-chart-competencies.service.ts` | Alto | **Sí** | Multi-dominio / dominio por perfil |
| FE prioriza SOFTWARE | `CompetenciesExplorer.tsx` | Alto | **Sí** | Selector o default por eval activa |
| Ejes radar fijos SOFTWARE_* | `radarLabels.ts` | Medio | **Sí** (UX) | Orden/labels por dominio |
| CLI default `--domain=SOFTWARE` | `mc-evaluate.ts` | Bajo–Medio | Ops | Flag explícito |
| Fixture Camilo / tests | FE fixtures, specs | Bajo | No | Extender después |

**Motor PA2 y tablas:** no bloquean. **Producto visible:** bloqueado hasta desacoplar summary + radar + catálogo.

---

## 7. Definición propuesta del dominio

### Qué representa

**Diseño Visual:** disciplina profesional de concepción y producción de piezas visuales (gráficas, editoriales, de identidad y de comunicación visual) para soportar productos, marcas y contenidos, con uso de herramientas digitales y, cuando aplique, asistencia de IA en el flujo creativo.

### Qué incluye

- Diseño gráfico y composición visual  
- Identidad visual / sistemas de marca (cuando haya evidencia)  
- Diseño editorial y diagramación  
- Comunicación visual de mensajes  
- Piezas publicitarias / campañas visuales (si hay actividad, no solo cargo)  
- Recursos visuales digitales (plantillas, piezas para web/redes/LMS **como entregable visual**, no como pedagogía)  
- Herramientas asociadas (Adobe, Canva, etc.) como **skills/herramientas**  
- QA visual / control de calidad de pieza  

### Qué excluye

| Frente | Diferencia |
|--------|------------|
| **Producción Audiovisual** | Edición de video, motion, postproducción como núcleo (dominio hermano; p.ej. Juan Pablo) |
| **Diseño Instruccional** | Diseño de aprendizaje, SCORM/LMS como pedagogía (dominio o especialidad aparte) |
| **UX/UI** | Producto interactivo / experiencia de usuario (roles distintos en el área) |
| **Marketing** | Estrategia comercial / performance; no solo la pieza visual |
| **Software** | Ingeniería de software |

**No** igualar el dominio al área organizacional “Fábrica de Contenidos” ni al cargo “Analista de diseño de contenidos”.

---

## 8. Especialidades candidatas (6)

| Especialidad candidata | Definición | Skills Nidia asociadas | Evidencia actual | Riesgo sobreajuste | Recomendación |
|------------------------|------------|------------------------|------------------|--------------------|---------------|
| **Diseño gráfico** | Creación y composición de piezas gráficas | Diseño Gráfico; Illustrator; Photoshop; Canva (herramienta) | MODERATE 66 + tools WEAK | Bajo–medio | **INCLUIR (eje principal v1)** |
| **Identidad visual** | Sistemas de marca, manuales, coherencia visual | Comunicación Visual (débil); (hermanos: manuales) | NONE en Nidia | Medio–alto | **INCLUIR como EMERGENT**; validar hermanos |
| **Diseño editorial** | Diagramación y piezas editoriales | Diseño editorial; InDesign | WEAK 5 | Alto | **INCLUIR con umbral estricto** o diferir a v1.1 |
| **Comunicación visual** | Traducción visual de mensajes | Comunicación Visual | NONE | Alto (genérica) | **Fusionar con Identidad** o skill, no eje separado v1 |
| **Diseño publicitario** | Campañas y piezas publicitarias | (no hay skill vigente; solo texto histórico) | Insuficiente en 207 | Muy alto | **NO incluir en v1** |
| **Diseño de recursos digitales** | Piezas visuales para entornos digitales / e-learning *como asset* | Canva, Genially, InDesign; borde SCORM/LMS | Tools NONE; SCORM/LMS MODERATE (pedagogía) | Alto (mezcla con instruccional) | **INCLUIR acotada** o mapear tools a gráfico/editorial |

### Conceptos fronterizos

| Concepto | Tratamiento propuesto v1 |
|----------|---------------------------|
| Diseño instruccional | **Otro dominio / fuera** de Diseño Visual v1 (skill frontera `REQUIERE VALIDACIÓN`) |
| IA aplicada | **Skill / capacidad de soporte**, no especialidad del radar v1 (o EMERGENT en v1.1) |
| Prompting | **Metodología / skill de soporte** |
| Producción audiovisual | **Otro dominio** (Premiere/AE/CapCut listing en Nidia = herramienta débil, no especialidad) |
| QA visual | Skill PRIMARY de Diseño gráfico o metodología transversal |

**Set recomendado para radar v1 (5 ejes, heptágono no obligatorio):**  
1. Diseño gráfico · 2. Identidad visual · 3. Diseño editorial · 4. Diseño de recursos digitales · 5. *(opcional)* Calidad visual / QA de pieza  

Evitar forzar 7 ejes por copia de Software.

---

## 9. Catálogo y mappings preliminares

| Skill detectada | Normalizado propuesto | Tipo | Especialidad candidata | Evidencia suficiente | Acción |
|-----------------|----------------------|------|------------------------|----------------------|--------|
| Diseño Gráfico | Diseño gráfico | PROFESSIONAL_KNOWLEDGE | Diseño gráfico (PRIMARY) | Sí (MODERATE) | **MAPEAR** / CREAR CANDIDATA en catálogo MC |
| Adobe Illustrator | Adobe Illustrator | TOOL | Diseño gráfico (SECONDARY) | Débil | **MANTENER COMO HERRAMIENTA** + mapear con peso bajo |
| Adobe Photoshop | Adobe Photoshop | TOOL | Diseño gráfico (SECONDARY) | Débil | **MANTENER COMO HERRAMIENTA** |
| Adobe InDesign | Adobe InDesign | TOOL | Diseño editorial (PRIMARY tool) / Recursos digitales | Débil | **MANTENER COMO HERRAMIENTA** |
| Canva | Canva | TOOL | Recursos digitales / Diseño gráfico | No (NONE) | **MANTENER COMO HERRAMIENTA** |
| CapCut / Premiere / AE | (mismo) | TOOL | — (AV) | No | **MANTENER COMO HERRAMIENTA**; no mapear a Diseño Visual v1 o peso ~0 / OUTSIDE |
| Diseño editorial | Diseño editorial | PROFESSIONAL_KNOWLEDGE | Diseño editorial | Débil | **REQUIERE VALIDACIÓN** |
| Comunicación Visual | Comunicación visual | PROFESSIONAL_KNOWLEDGE | Identidad visual | No | **REQUIERE VALIDACIÓN** |
| Diseño instruccional | Diseño instruccional | PROFESSIONAL_KNOWLEDGE | — | Débil | **REQUIERE VALIDACIÓN** (otro dominio) |
| SCORM / LMS | SCORM / LMS | TECHNOLOGY | — / Instruccional | Sí pero otra disciplina | **NO mapear** a Diseño Visual v1 |
| Moodle / iSpring / Genially / isEAZY | (mismo) | TOOL | Recursos digitales (bajo) o fuera | No | **MANTENER COMO HERRAMIENTA** |
| Inteligencia Artificial | Inteligencia artificial aplicada al diseño | TECHNOLOGY | Soporte / transversal | Sí (MODERATE) | **MANTENER TRANSVERSAL** o SECONDARY multi-eje con peso bajo |
| Prompting | Prompting | METHODOLOGY | Soporte | Sí | **MANTENER TRANSVERSAL** |
| Midjourney / Runway / Grok | (mismo) | TOOL | Soporte IA | No | **MANTENER COMO HERRAMIENTA** |
| Control de Calidad (QA) | Control de calidad visual | PROFESSIONAL_KNOWLEDGE | Diseño gráfico (SECONDARY) / QA visual | Sí | **MAPEAR** |
| Gestión de proyectos | Gestión de proyectos | PROFESSIONAL_KNOWLEDGE | — | Débil | **MANTENER TRANSVERSAL** / no eje |
| Soft skills (12) | — | SOFT_SKILL | — | No | **RECHAZAR POR GENÉRICA** (para mappings de especialidad) |

---

## 10. Diseño preliminar de PA2

**Identificador propuesto (no creado):** `pa2-visual-design-1.0.0`  
Convención alineada a `pa2-software-1.0.0` / `1.1.0`.

### Métricas genéricas (reutilizar)

Cobertura, fortaleza, confianza, skills evidenciadas, skills mapeadas, evidencia primaria, presentation ACTIVE/EMERGENT/HIDDEN, default = mejor ACTIVE.

### Adaptaciones

| Tema | Propuesta |
|------|-----------|
| Estrategia ranking | Empezar con **LEXICOGRAPHIC** (como `pa2-software-1.1.0`), no WEIGHTED_SCORE 1.0.0 (primaryStrong×12) |
| Umbrales ACTIVE | Revisar `minimumMappedSkills` / `minimumEvidencedSkills`: catálogo visual v1 será más pequeño que Software |
| Herramientas multi-especialidad | Illustrator/Photoshop → PRIMARY gráfico; InDesign → editorial; pesos SECONDARY acotados; suma ≤ 1 |
| Evitar ganar por nº de mappings | LEXICOGRAPHIC prioriza `evidencedSkillCount` antes que `mappedSkillCount`; no mapear soft skills ni tools NONE masivos |
| IA / Prompting | No crear especialidad solo por mappings de herramientas IA listing |
| AV tools en Nidia | Clasificar OUTSIDE o no mapear en v1 |

**Riesgo de aplicar `pa2-software-1.1.0` tal cual:** umbrales calibrados a 7 especialidades densas; con 4–5 ejes y pocas skills evidenciadas, todo podría quedar EMERGENT (aceptable al inicio) o ACTIVE por override de baja cardinalidad — hay que tunear el override.

**Simulación numérica ahora:** **no ejecutada** (restricción de fase). Métricas PA2 = **pendientes**.

---

## 11. Compatibilidad frontend/API

| Pregunta | Respuesta |
|----------|-----------|
| ¿Título de dominio dinámico? | Parcial: muestra `domain.name`, pero **elige SOFTWARE** primero |
| ¿Ejes del radar dinámicos? | Geometría sí (n-gon); **orden/labels no** (fijos SOFTWARE_*) |
| ¿Nº especialidades variable? | Datos sí; orden canónico asume 7 códigos Software |
| ¿Cards skills/evidencias genéricas? | **Sí** |
| ¿Narrativas Full Stack / FE-BE? | Principalmente en labels radar y fixtures Camilo |
| Cambios mínimos para Nidia | 1) Eval PA2 persistida Diseño Visual · 2) Summary multi-dominio · 3) FE sin hardcode SOFTWARE · 4) `radarLabels` por dominio |

**No implementar en esta fase.**

---

## 12. Simulación conceptual de Nidia (sin persistir)

```
Dominio principal:     Diseño Visual
Especialidad principal: Diseño gráfico   (propuesta cualitativa; sin score PA2)
Especialidades activas: [pendiente PA2 — candidata: Diseño gráfico]
Especialidades emergentes: Identidad visual, Diseño editorial, Recursos digitales
Skills destacadas:     Diseño gráfico (EE MODERATE 66); IA (63); Prompting (50); QA (50)
Herramientas:          Illustrator, Photoshop, InDesign (débiles); Canva/CapCut/Premiere/AE (listing)
Confianza / Cobertura: PENDIENTES DE PA2 (sin simulación de motor en esta fase)
```

Justificación de principal: única skill profesional con Evidence MODERATE clara alineada al núcleo disciplinar; no inventar scores.

---

## 13. Perfiles hermanos candidatos

Mismo jefe `1206`, rol ANALISTA DE DISEÑO DE CONTENIDOS, CV + extracción activos.  
**No** afirmar pertenencia a Diseño Visual solo por cargo.

| Persona | Documento | Rol | Jefe | CV activo | Extracción | Afinidad | Razón |
|---------|-----------|-----|------|-----------|------------|----------|-------|
| JUAN PABLO SANABRIA DIAZ | 1022445625 | Analista diseño contenidos | 1206 | Sí | **208** (22 skills) | Alta | Ya auditado MC1.5.3; contraste AV vs visual |
| ANIBAL FERNANDO ANGULO ORTIZ | 1193092980 | idem | 1206 | Sí | 114 (18) | Alta | Mismo rol/jefe; masa de skills |
| GINNA MARCELA GARZON TOLEDO | 1030646495 | idem | 1206 | Sí | 92 (18) | Alta | idem |
| JULIANA SOFIA CORREA ARAQUI | 1002460888 | idem | 1206 | Sí | 115 (19) | Alta | idem |
| DANNA MICHELLE POVEDA CAÑON | 1000254881 | idem | 1206 | Sí | 111 (17) | Alta | idem |
| BLANCA ALEJANDRA HERRERA DUCUARA | 1031167800 | idem | 1206 | Sí | 120 (16) | Media–alta | Validación diversidad |
| ALISON JULIETH CASTRO SUAREZ | 1000622424 | idem | 1206 | Sí | 108 (6) | Media | Perfil más corto; prueba umbrales |

**Complementarios (otra jerarquía / rol, para fronteras de dominio):**

| Persona | Documento | Rol | Nota |
|---------|-----------|-----|------|
| JOSE ALEJANDRO CAMACHO COBOS | 1010247929 | DISEÑADOR UX/UI | Frontera UX/UI (no mezclar en v1) |
| CHRISTIAN GARZON ORTIZ | 80802023 | DISEÑADOR INTEGRAL IA | Frontera IA + diseño |
| ZUANY ALEJANDRO ACUÑA VELEZ | 1000372715 | DISEÑADOR UX/UI | Frontera UX/UI |

No ejecutar extracción/enrich/PA2 sobre ellos en esta fase.

---

## 14. Riesgos

1. Sobreajuste a Nidia (IA + e-learning fuertes; AV listing).  
2. Confundir área organizacional con disciplina.  
3. Convertir herramientas (Canva, CapCut) en especialidades.  
4. Incluir Diseño instruccional / AV dentro de Diseño Visual y diluir el dominio.  
5. Copiar heptágono Software sin evidencia de 7 especialidades.  
6. Aplicar umbrales PA2 Software sin recalibrar → todo EMERGENT o ACTIVE espurio.  
7. Hash/mappings SOFTWARE en servicio PA2 al evaluar otro dominio.  
8. Drift PDF futuro sin reextracción (política MC1.5.2C ya documentada).

---

## 15. Recomendación de implementación (MC1.6.1B+)

Orden sugerido:

1. Desacoplar **summary API** y **selección de dominio FE** (sin tocar evaluaciones Software históricas).  
2. Radar: orden/labels **por dominio** (fallback alfabético/sort_order).  
3. Nueva versión de catálogo con dominio `VISUAL_DESIGN` (o código acordado) + 4–5 especialidades.  
4. Pack de classification + mappings (pesos bajos en tools).  
5. Config `pa2-visual-design-1.0.0` (LEXICOGRAPHIC).  
6. Hash de mapping **por pack/dominio**.  
7. Evaluar **solo Nidia** (lectura de 207/5/5).  
8. Validar 3–5 hermanos (pipeline si drift; luego PA2).  
9. Publicar v1.1 del dominio sin mutar evals históricas.

**Para que Nidia vea Competencias hace falta:** pasos 1–7 como mínimo (catálogo + mappings + PA2 + API summary + FE dominio/radar).

---

## 16. Veredicto

# **GO CON AJUSTES**

| Pregunta de salida | Respuesta |
|--------------------|-----------|
| ¿Evidencia permite 1ª versión Diseño Visual? | **Sí** |
| ¿Especialidades defendibles? | **Diseño gráfico** (principal); Identidad / Editorial / Recursos digitales (emergentes); **no** publicitario ni AV como ejes v1 |
| ¿Qué mapear? | Diseño gráfico + tools Adobe (bajo peso) + QA; IA/Prompting transversal; soft skills fuera |
| ¿Reutilizable? | Motor PA2, tablas MC, API detalle, UI métricas/evidencia |
| ¿Qué corregir? | Summary SOFTWARE, FE preferencia SOFTWARE, radar labels, hash mappings, enum naming, seeds |
| ¿Qué falta para UI Nidia? | Dominio + mappings + PA2 + desacople API/FE |
| ¿Siguientes perfiles? | Juan Pablo + 4–6 analistas mismo jefe (tabla §13) |

---

## Consultas y archivos inspeccionados

**Cloud (RO):** `core.person`, `core.role`, `core.area`, `organigrama.person_cv`, `cv_extraction`, `cv_extraction_skill`, `cv_skill`, `cv_extraction_language`, `cv_extraction_certification`, `cv_skill_enrichment`, `cv_evidence_evaluation`, `cv_evidence_evaluation_item`, `mc_profile_evaluation`, `mc_domain`, `mc_specialty`, `mc_skill_specialty_mapping`, `mc_catalog_version`, `org_chart_version`, `org_visual_relation`.

**Script RO:** `src/database/scripts/mc-visual-design-audit-ro.ts` → `tmp/cv-attributes/mc1-visual-design-audit-nidia-ro.json`

**Código / docs:**  
`mc-catalog.definition-mc12.ts`, `mc-catalog.mapping-software-mc11.ts`, `mc-pa2.config.ts`, `mc-pa2.engine.ts`, `mc-pa2.service.ts`, `org-chart-competencies.service.ts`, `competencies.response.dto.ts`, `CompetenciesExplorer.tsx`, `radarLabels.ts`, `radarGeometry.ts`, `docs/mc1.2-functional-spec-software-domain.md`, `docs/mc1.5.2c-content-domain-consolidated-discovery.md`, `docs/mc1.5.3-content-domain-validation.md`.

**Sin cambios** a Software, evaluaciones históricas, catálogo, frontend productivo ni ejecución PA2.
