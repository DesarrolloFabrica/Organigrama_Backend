# MC1.1 — Análisis del dominio Desarrollo de Software (piloto Camilo)

**Fase:** MC1.1 (descubrimiento / diseño — sin implementación)  
**Generado:** 2026-07-27  
**Fuente de datos:** snapshot solo-lectura `tmp/cv-attributes/mc1-camilo-source-snapshot.json`  
**Referencia histórica:** `tmp/cv-attributes/pa2-proposal-camilo.json` (`PROPOSED_NOT_CREATED`)

Este documento es el entregable de análisis para aprobar el primer Vertical Slice de PA2.  
No crea catálogos, mappings, migraciones ni código de producto.

---

## 1. Validación de la fuente de verdad

Consulta en vivo contra PostgreSQL (`organigrama.*`). Resultado: **OK — sin mismatches**.

| Campo esperado | Valor observado | Estado |
|----------------|-----------------|--------|
| `personCvId` | `187` | OK |
| `extractionId` | `206` | OK |
| Extracciones activas para pcv 187 | solo `206` | OK |
| `enrichmentId` | `2` (activo, SUCCEEDED, 59→59) | OK |
| `evaluationId` | `3` (activo, SUCCEEDED, 59→59) | OK |
| Skills persistidas en extracción 206 | **59** | OK |
| Items de evaluación 3 | **59** | OK |

Cadena confirmada:

```
person_cv 187 → extraction 206 → enrichment 2 → evaluation 3
```

Distribución Evidence Engine (evaluation 3):

| Nivel | Cantidad |
|-------|----------|
| STRONG | 6 |
| MODERATE | 15 |
| WEAK | 15 |
| NONE | 23 |
| Con evidencia aplicada | 25 |

Conclusión: la fuente de verdad coincide exactamente con lo declarado. Se puede continuar.

---

## 2. Distribución completa de las 59 skills

### 2.1 Resumen de clasificación

| Estado | Cantidad | Criterio usado |
|--------|----------|----------------|
| `DOMAIN_SPECIALTY` | 42 | Skill técnica/metodológica del dominio Software, asignable a especialidad(es) |
| `TRANSVERSAL_FUTURE` | 14 | Soft skills / MC2 — fuera de MC1 |
| `AMBIGUOUS` | 3 | Etiqueta de rol, conocimiento aspiracional o outcome de negocio sin especialidad inequívoca |
| `OUTSIDE_SOFTWARE_DOMAIN` | 0 | Ninguna skill cae fuera del software en este CV |
| `CATALOG_GAP` | 0 | No se detectó skill que exija una especialidad ausente; los huecos son de evidencia, no de catálogo |

### 2.2 Tabla maestra (59/59)

Leyenda de especialidades propuestas (ver §3):

- `FE` Desarrollo frontend  
- `BE` Desarrollo backend  
- `DB` Bases de datos  
- `API` Integración de APIs  
- `CLOUD` Cloud y despliegue  
- `ENG` Ingeniería y calidad de software  
- `IA` IA aplicada al desarrollo  

| # | Skill | Tipo | Categoría extractor | Level | Strength | Conf | Estado | Especialidad(es) | Pesos |
|---|-------|------|---------------------|-------|----------|------|--------|------------------|-------|
| 0 | React | TECHNOLOGY | Frontend | STRONG | 84.8 | 0.86 | DOMAIN_SPECIALTY | FE | 1.0 |
| 1 | Next.js | TECHNOLOGY | Frontend | STRONG | 77.5 | 0.86 | DOMAIN_SPECIALTY | FE | 1.0 |
| 2 | Angular | TECHNOLOGY | Frontend | STRONG | 77.5 | 0.86 | DOMAIN_SPECIALTY | FE | 1.0 |
| 3 | AngularJS | TECHNOLOGY | Frontend | MODERATE | 40 | 0.78 | DOMAIN_SPECIALTY | FE | 1.0 |
| 4 | Angular Material | TECHNOLOGY | Frontend | WEAK | 1 | 0.82 | DOMAIN_SPECIALTY | FE | 1.0 |
| 5 | JavaScript | TECHNOLOGY | Frontend | MODERATE | 50 | 0.86 | DOMAIN_SPECIALTY | FE + BE | 0.80 / 0.20 |
| 6 | TypeScript | TECHNOLOGY | Frontend | WEAK | 1 | 0.82 | DOMAIN_SPECIALTY | FE + BE | 0.70 / 0.30 |
| 7 | HTML5 | TECHNOLOGY | Frontend | WEAK | 1 | 0.82 | DOMAIN_SPECIALTY | FE | 1.0 |
| 8 | CSS3 | TECHNOLOGY | Frontend | WEAK | 1 | 0.82 | DOMAIN_SPECIALTY | FE | 1.0 |
| 9 | Sass | TECHNOLOGY | Frontend | WEAK | 1 | 0.82 | DOMAIN_SPECIALTY | FE | 1.0 |
| 10 | Tailwind CSS | TECHNOLOGY | Frontend | WEAK | 1 | 0.82 | DOMAIN_SPECIALTY | FE | 1.0 |
| 11 | Node.js | TECHNOLOGY | Backend | STRONG | 84.8 | 0.86 | DOMAIN_SPECIALTY | BE | 1.0 |
| 12 | NestJS | TECHNOLOGY | Backend | MODERATE | 63 | 0.86 | DOMAIN_SPECIALTY | BE | 1.0 |
| 13 | Express.js | TECHNOLOGY | Backend | WEAK | 1 | 0.82 | DOMAIN_SPECIALTY | BE | 1.0 |
| 14 | ASP.NET | TECHNOLOGY | Backend | MODERATE | 50 | 0.86 | DOMAIN_SPECIALTY | BE | 1.0 |
| 15 | C# | TECHNOLOGY | Backend | MODERATE | 48.5 | 0.86 | DOMAIN_SPECIALTY | BE | 1.0 |
| 16 | .NET | TECHNOLOGY | Backend | MODERATE | 47 | 0.86 | DOMAIN_SPECIALTY | BE | 1.0 |
| 17 | Go | TECHNOLOGY | Backend | MODERATE | 47 | 0.86 | DOMAIN_SPECIALTY | BE | 1.0 |
| 18 | APIs REST | TECHNOLOGY | Backend | STRONG | 70.72 | 0.86 | DOMAIN_SPECIALTY | API + BE | 0.60 / 0.40 |
| 19 | PostgreSQL | TECHNOLOGY | Bases de datos y ORM | MODERATE | 57.72 | 0.86 | DOMAIN_SPECIALTY | DB | 1.0 |
| 20 | MySQL | TECHNOLOGY | Bases de datos y ORM | WEAK | 34 | 0.86 | DOMAIN_SPECIALTY | DB | 1.0 |
| 21 | MongoDB | TECHNOLOGY | Bases de datos y ORM | MODERATE | 48.5 | 0.86 | DOMAIN_SPECIALTY | DB | 1.0 |
| 22 | SQL | TECHNOLOGY | Bases de datos y ORM | WEAK | 2 | 0.43 | DOMAIN_SPECIALTY | DB | 1.0 |
| 23 | PL/SQL | TECHNOLOGY | Bases de datos y ORM | WEAK | 34 | 0.86 | DOMAIN_SPECIALTY | DB | 1.0 |
| 24 | Transact-SQL | TECHNOLOGY | Bases de datos y ORM | NONE | 0 | 0.42 | DOMAIN_SPECIALTY | DB | 1.0 |
| 25 | TypeORM | TOOL | Bases de datos y ORM | MODERATE | 48.5 | 0.86 | DOMAIN_SPECIALTY | DB + BE | 0.65 / 0.35 |
| 26 | Google Cloud Platform | TECHNOLOGY | Cloud y Despliegue | WEAK | 34 | 0.86 | DOMAIN_SPECIALTY | CLOUD | 1.0 |
| 27 | Google Cloud SQL | TECHNOLOGY | Cloud y Despliegue | NONE | 0 | 0.50 | DOMAIN_SPECIALTY | CLOUD + DB | 0.70 / 0.30 |
| 28 | Amazon Web Services | TECHNOLOGY | Cloud y Despliegue | MODERATE | 47 | 0.86 | DOMAIN_SPECIALTY | CLOUD | 1.0 |
| 29 | Amazon S3 | TECHNOLOGY | Cloud y Despliegue | NONE | 0 | 0.50 | DOMAIN_SPECIALTY | CLOUD | 1.0 |
| 30 | Amazon CloudFront | TECHNOLOGY | Cloud y Despliegue | NONE | 0 | 0.50 | DOMAIN_SPECIALTY | CLOUD | 1.0 |
| 31 | Microsoft Azure | TECHNOLOGY | Cloud y Despliegue | NONE | 0 | 0.50 | DOMAIN_SPECIALTY | CLOUD | 1.0 |
| 32 | Docker | TOOL | Cloud y Despliegue | NONE | 0 | 0.42 | DOMAIN_SPECIALTY | CLOUD | 1.0 |
| 33 | Git | TOOL | Herramientas y Metodologías | MODERATE | 48.5 | 0.86 | DOMAIN_SPECIALTY | ENG + CLOUD | 0.75 / 0.25 |
| 34 | GitHub | TOOL | Herramientas y Metodologías | NONE | 0 | 0.42 | DOMAIN_SPECIALTY | ENG | 1.0 |
| 35 | Postman | TOOL | Herramientas y Metodologías | NONE | 0 | 0.42 | DOMAIN_SPECIALTY | API | 1.0 |
| 36 | Scrum | METHODOLOGY | Herramientas y Metodologías | WEAK | 12 | 0.43 | DOMAIN_SPECIALTY | ENG | 1.0 |
| 37 | Metodologías Ágiles | METHODOLOGY | Herramientas y Metodologías | WEAK | 34 | 0.86 | DOMAIN_SPECIALTY | ENG | 1.0 |
| 38 | Pruebas funcionales | PROFESSIONAL_KNOWLEDGE | Herramientas y Metodologías | MODERATE | 48.5 | 0.86 | DOMAIN_SPECIALTY | ENG | 1.0 |
| 39 | Gestión de requerimientos | PROFESSIONAL_KNOWLEDGE | Herramientas y Metodologías | NONE | 0 | 0.42 | DOMAIN_SPECIALTY | ENG | 1.0 |
| 40 | Desarrollo Full Stack | PROFESSIONAL_KNOWLEDGE | Conocimientos Especializados… | MODERATE | 55.8 | 0.53 | AMBIGUOUS | — (meta FE+BE) | — |
| 41 | Arquitectura de software | PROFESSIONAL_KNOWLEDGE | Conocimientos Especializados… | NONE | 0 | 0.42 | AMBIGUOUS | — | — |
| 42 | Automatización de procesos | PROFESSIONAL_KNOWLEDGE | Conocimientos Especializados… | MODERATE | 51.5 | 0.86 | AMBIGUOUS | — | — |
| 43 | Inteligencia Artificial | PROFESSIONAL_KNOWLEDGE | Conocimientos Especializados… | STRONG | 87.6 | 0.86 | DOMAIN_SPECIALTY | IA | 1.0 |
| 44 | prompting | PROFESSIONAL_KNOWLEDGE | Conocimientos Especializados… | NONE | 0 | 0.42 | DOMAIN_SPECIALTY | IA | 1.0 |
| 45 | Comunicación Asertiva | SOFT_SKILL | Habilidades Blandas | NONE | 0 | 0.42 | TRANSVERSAL_FUTURE | — | — |
| 46 | Trabajo en equipo | SOFT_SKILL | Habilidades Blandas | NONE | 0 | 0.42 | TRANSVERSAL_FUTURE | — | — |
| 47 | Liderazgo | SOFT_SKILL | Habilidades Blandas | WEAK | 2 | 0.43 | TRANSVERSAL_FUTURE | — | — |
| 48 | Escucha activa | SOFT_SKILL | Habilidades Blandas | NONE | 0 | 0.42 | TRANSVERSAL_FUTURE | — | — |
| 49 | Resolución de conflictos | SOFT_SKILL | Habilidades Blandas | NONE | 0 | 0.42 | TRANSVERSAL_FUTURE | — | — |
| 50 | Autonomía | SOFT_SKILL | Habilidades Blandas | WEAK | 2 | 0.43 | TRANSVERSAL_FUTURE | — | — |
| 51 | Adaptabilidad | SOFT_SKILL | Habilidades Blandas | NONE | 0 | 0.42 | TRANSVERSAL_FUTURE | — | — |
| 52 | Orientación a resultados | SOFT_SKILL | Habilidades Blandas | NONE | 0 | 0.42 | TRANSVERSAL_FUTURE | — | — |
| 53 | Pensamiento crítico | SOFT_SKILL | Habilidades Blandas | NONE | 0 | 0.42 | TRANSVERSAL_FUTURE | — | — |
| 54 | Gestión del tiempo | SOFT_SKILL | Habilidades Blandas | NONE | 0 | 0.42 | TRANSVERSAL_FUTURE | — | — |
| 55 | Atención al detalle | SOFT_SKILL | Habilidades Blandas | NONE | 0 | 0.42 | TRANSVERSAL_FUTURE | — | — |
| 56 | Capacidad analítica | SOFT_SKILL | Habilidades Blandas | NONE | 0 | 0.42 | TRANSVERSAL_FUTURE | — | — |
| 57 | Resolución de problemas | SOFT_SKILL | Habilidades Blandas | NONE | 0 | 0.42 | TRANSVERSAL_FUTURE | — | — |
| 58 | Aprendizaje continuo | SOFT_SKILL | Habilidades Blandas | NONE | 0 | 0.42 | TRANSVERSAL_FUTURE | — | — |

### 2.3 Justificación de pesos duales

| Skill | Decisión | Por qué |
|-------|----------|---------|
| JavaScript | FE 0.80 / BE 0.20 | Evidencia laboral habla de *interfaces*; el vínculo con Node es de ecosistema, no citado como skill de backend |
| TypeScript | FE 0.70 / BE 0.30 | Aparece en listado Frontend; el stack NestJS/Node la implica en backend, pero **no hay cita laboral de TypeScript** |
| TypeORM | DB 0.65 / BE 0.35 | Es herramienta de persistencia; la evidencia la une a PostgreSQL **y** a NestJS |
| APIs REST | API 0.60 / BE 0.40 | Hay frases de *creación* y de *integración*; también “servicios backend y APIs REST” |
| Git | ENG 0.75 / CLOUD 0.25 | Control de versiones + “apoyo en despliegues” |
| Google Cloud SQL | CLOUD 0.70 / DB 0.30 | Nombre cloud, naturaleza de base de datos; evidencia solo SKILLS_SECTION |

### 2.4 AMBIGUOUS (detalle)

| Skill | Strength | Por qué no es especialidad |
|-------|----------|----------------------------|
| Desarrollo Full Stack | 55.8 MODERATE | Es etiqueta de **rol/título** (“Ingeniero Full Stack”), no un saber hacer distinto. Cubre FE+BE; usarla como eje inflaría el radar sin añadir información |
| Arquitectura de software | 0 NONE | Solo listado. No hay diseño, patrones ni decisiones documentadas. Crear especialidad “Arquitectura” sería inferir capacidad |
| Automatización de procesos | 51.5 MODERATE | Es **resultado de negocio** (“automatización de procesos institucionales/aeronáuticos”), no un stack. Cruza BE e IA sin pertenecer a uno solo |

---

## 3. Propuesta definitiva del dominio (desde datos)

### 3.1 Cómo se descubrió (no se partió de hipótesis)

Se observaron tres señales independientes en el perfil:

1. **Categorías del extractor** (agrupación ya presente en el CV estructurado).  
2. **Texto de evidencia enriquecida** (qué dice el CV que *hizo*).  
3. **Evidence Engine** (qué tan respaldado está cada skill).

Patrones emergentes del CV (citas reales):

- Perfil: *“especializado en frontend con React, Next.js y Angular”* + *“backend con Node.js, NestJS y .NET”*.  
- Trabajo: construcción de interfaces; servicios backend; APIs REST; gestión de PostgreSQL/MySQL/MongoDB; despliegue GCP/AWS; pruebas funcionales; Git; IA aplicada a reportes/automatización; maestría/diplomado en IA.

Esto produce **siete especialidades**, no por checklist previo, sino porque cada una responde la pregunta *“¿qué sabe hacer dentro de Desarrollo de Software?”* con un conjunto de skills + evidencia propia.

```
Desarrollo de Software
├── Desarrollo frontend
├── Desarrollo backend
├── Bases de datos
├── Integración de APIs
├── Cloud y despliegue
├── Ingeniería y calidad de software
└── IA aplicada al desarrollo
```

### 3.2 Por qué no se usaron las hipótesis previas como verdad

Las hipótesis MC1 (Frontend, Backend, APIs, DB, Arquitectura, QA, Ingeniería/entrega) se contrastaron *después* del descubrimiento:

| Hipótesis previa | Veredicto desde datos |
|------------------|----------------------|
| Frontend | Confirmada — núcleo identitario del perfil |
| Backend | Confirmada — segundo núcleo |
| Integración de APIs | Confirmada como especialidad **delgada** (poca cardinality, evidencia STRONG en 1 skill) |
| Bases de datos | Confirmada |
| Arquitectura | **Rechazada como especialidad** — 1 skill NONE; sería inferencia |
| QA aislado | **No sostiene eje propio** — 1 skill; se fusionó en Ingeniería y calidad |
| Ingeniería y entrega | Confirmada solo si se fusiona con QA/agile (por sí sola también es delgada) |
| *(no hipotetizada)* IA aplicada | **Emergente** — evidenceStrength 87.6 + educación formal; debe existir |

---

## 4. Especialidades — ficha completa

Métricas: `coverage` = skills con level ≠ NONE / total; `avgStrength` / `avgConf` sobre todas las skills de la especialidad (primarias; duales cuentan en su primaria).

### 4.1 Desarrollo frontend

| Campo | Valor |
|-------|-------|
| Código propuesto | `SOFTWARE_FRONTEND` |
| Skills (11) | React, Next.js, Angular, AngularJS, Angular Material, JavaScript*, TypeScript*, HTML5, CSS3, Sass, Tailwind CSS |
| Levels | STRONG 3 · MODERATE 2 · WEAK 6 · NONE 0 |
| avgStrength | 30.53 |
| coverage | **1.00** |
| avgConf | 0.83 |
| workBacked | 5/11 |
| ¿Eje del Explorador? | **Sí — abrir por defecto** |

**Por qué existe:** el CV se autodefine como especializado en frontend; tres frameworks con evidencia laboral STRONG; el resto del stack UI aparece en skills section.

**Riesgos:** 6 skills solo WEAK (listado). El eje es fuerte por React/Next/Angular, no por CSS/Tailwind.

**Observaciones:** TypeScript y JavaScript aportan peso secundario a BE (ver §2.3).

---

### 4.2 Desarrollo backend

| Campo | Valor |
|-------|-------|
| Código propuesto | `SOFTWARE_BACKEND` |
| Skills (7 primarias) | Node.js, NestJS, Express.js, ASP.NET, C#, .NET, Go (+ duales JS/TS/TypeORM/APIs) |
| Levels | STRONG 1 · MODERATE 5 · WEAK 1 · NONE 0 |
| avgStrength | 48.76 |
| coverage | **1.00** |
| avgConf | 0.85 |
| workBacked | 6/7 |
| ¿Eje del Explorador? | **Sí** |

**Por qué existe:** evidencia laboral explícita de servicios backend en dos familias (Node/Nest y .NET/C#) más Go.

**Riesgos:** Express.js solo listado. Diversidad de stacks puede leerse como amplitud o como superficialidad; coverage alto mitiga, pero confidence por skill no certifica profundidad igual en todos.

**Observaciones:** APIs REST contribuye 0.40 aquí (creación de servicios).

---

### 4.3 Bases de datos

| Campo | Valor |
|-------|-------|
| Código propuesto | `SOFTWARE_DATA` |
| Skills (7) | PostgreSQL, MySQL, MongoDB, SQL, PL/SQL, Transact-SQL, TypeORM* |
| Levels | STRONG 0 · MODERATE 3 · WEAK 3 · NONE 1 |
| avgStrength | 32.10 |
| coverage | **0.86** |
| avgConf | 0.74 |
| workBacked | 5/7 |
| ¿Eje del Explorador? | **Sí** |

**Por qué existe:** múltiples menciones laborales de gestión/modelado/optimización en PostgreSQL, MySQL, MongoDB y TypeORM.

**Riesgos:** ningún STRONG; Transact-SQL sin evidencia aplicada; SQL genérico débil (profile + listado).

**Observaciones:** especialidad sólida pero no el centro del perfil.

---

### 4.4 Integración de APIs

| Campo | Valor |
|-------|-------|
| Código propuesto | `SOFTWARE_API_INTEGRATION` |
| Skills (2) | APIs REST*, Postman |
| Levels | STRONG 1 · NONE 1 |
| avgStrength | 35.36 |
| coverage | **0.50** |
| avgConf | 0.64 |
| workBacked | 1/2 |
| ¿Eje del Explorador? | **Condicional** (ver §6) |

**Por qué existe:** la evidencia distingue *creación* e *integración* de APIs REST (“Integración de APIs REST y validación de la información…”), distinto de “solo backend”.

**Riesgos:** cardinality muy baja (2 skills). Postman sin evidencia. Riesgo de eje “de una sola skill fuerte”.

**Observaciones:** candidata a fusión con Backend en implementación mínima (§7). Se mantiene en el modelo descubierto porque el CV verbaliza la actividad como integración.

---

### 4.5 Cloud y despliegue

| Campo | Valor |
|-------|-------|
| Código propuesto | `SOFTWARE_CLOUD_DEPLOY` |
| Skills (7) | GCP, Google Cloud SQL*, AWS, S3, CloudFront, Azure, Docker (+ Git dual) |
| Levels | MODERATE 1 · WEAK 1 · NONE 5 |
| avgStrength | 11.57 |
| coverage | **0.29** |
| avgConf | 0.59 |
| workBacked | 2/7 |
| ¿Eje del Explorador? | **Oculto / atenuado en Camilo** |

**Por qué existe:** hay cluster real de proveedores/herramientas cloud en el CV y una frase laboral de despliegue GCP/AWS.

**Riesgos:** mayoría NONE (solo skills section). No debe proyectarse como fortaleza comparable a FE/BE.

**Observaciones:** la especialidad existe en el catálogo del dominio; el radar de Camilo no debe abrirla por defecto ni darla peso visual alto.

---

### 4.6 Ingeniería y calidad de software

| Campo | Valor |
|-------|-------|
| Código propuesto | `SOFTWARE_ENGINEERING_QUALITY` |
| Skills (6) | Git*, GitHub, Scrum, Metodologías Ágiles, Pruebas funcionales, Gestión de requerimientos |
| Levels | MODERATE 2 · WEAK 2 · NONE 2 |
| avgStrength | 23.83 |
| coverage | **0.67** |
| avgConf | 0.64 |
| workBacked | 3/6 |
| ¿Eje del Explorador? | **Sí, con lectura cautelosa** |

**Por qué existe:** fusiona prácticas de entrega (Git/ágil) y calidad (pruebas funcionales) porque por separado **ningún cluster alcanza masa crítica**. El CV sí documenta ambas actividades en experiencia laboral.

**Riesgos:** nombre amplio; Scrum casi solo certificación; requerimientos sin evidencia. No confundir con “seniority en ingeniería”.

**Observaciones:** nombre deliberadamente conjunto; no “QA” solo ni “DevOps” (no hay CI/CD skill explícita en las 59).

---

### 4.7 IA aplicada al desarrollo

| Campo | Valor |
|-------|-------|
| Código propuesto | `SOFTWARE_AI_APPLIED` |
| Skills (2) | Inteligencia Artificial, prompting |
| Levels | STRONG 1 · NONE 1 |
| avgStrength | 43.80 |
| coverage | **0.50** |
| avgConf | 0.64 |
| workBacked | 1/2 (+ educación formal en IA) |
| ¿Eje del Explorador? | **Sí** (por strength/educación, no por cardinality) |

**Por qué existe:** IA es la skill con **mayor evidenceStrength del perfil (87.6)**: trabajo + maestría en curso + diplomado + profile summary + skills section. No es transversal blanda: el CV la liga a *análisis, reportes, automatización y calidad del software*.

**Riesgos:** solo 2 skills; prompting sin evidencia. Eje “estrella” posible si el UI no muestra cardinality.

**Observaciones:** emergente respecto a hipótesis previas. Debe permanecer en MC1 (dominio software), no en MC2.

---

## 5. Comparación con PA2 histórico

Artefacto: `pa2-proposal-camilo.json` — 101 mappings, 56 skills únicas, status `PROPOSED_NOT_CREATED`.

### 5.1 Modelo anterior (PA2 histórico)

Subatributos usados (conteo de mappings):

| Subatributo PA2 | Mappings | Naturaleza |
|-----------------|----------|------------|
| DIGITAL_TOOLS | 34 | Cubo genérico: casi toda tecnología también caía aquí |
| SOFTWARE_DEVELOPMENT | 25 | Macro-bolsa FE+BE+frameworks |
| DATA_DATABASES | 9 | Parcialmente alineado |
| INFRASTRUCTURE_DEPLOYMENT | 7 | Parcialmente alineado a Cloud |
| AUTOMATION_QUALITY | 4 | Mezcla QA + automatización |
| + varios soft (LEADERSHIP, TEAMWORK, …) | resto | Competencias transversales mezcladas en el mismo catálogo |

### 5.2 Qué permanece

- Idea de **mapear skills → dimensiones** con pesos.  
- Cobertura de datos (`DATA_DATABASES` ≈ Bases de datos).  
- Cobertura infra (`INFRASTRUCTURE_DEPLOYMENT` ≈ Cloud y despliegue).  
- Necesidad de tratar skills sin mapping como gap consciente (no forzar).

### 5.3 Qué desaparece en MC1

- `DIGITAL_TOOLS` como destino comodín (inflaba todo).  
- `SOFTWARE_DEVELOPMENT` monolítico (ocultaba Frontend vs Backend).  
- Soft skills dentro del mismo motor de atributos profesionales del dominio.  
- Mezcla “automatización de negocio + QA” en un solo cajón.

### 5.4 Qué cambia

| PA2 histórico | MC1 propuesto |
|---------------|---------------|
| Macroatributos/subatributos tipo PA1 | Área → Especialidad → Skill → Evidencia |
| Una skill → a menudo SOFTWARE + DIGITAL_TOOLS | Una skill → especialidad profesional (con duales justificados) |
| Soft skills scoreables en el mismo run | `TRANSVERSAL_FUTURE` (MC2) |
| Objetivo: “cobertura técnica/transversal” | Objetivo: **navegación del perfil profesional** |

### 5.5 Problemas del enfoque anterior

1. **No navegable:** “SOFTWARE_DEVELOPMENT 0.7 + DIGITAL_TOOLS 0.3” no responde “¿qué hace Camilo?”.  
2. **Sesgo de doble conteo:** casi toda tech alimentaba DIGITAL_TOOLS.  
3. **Pérdida de identidad del perfil:** Camilo es fuertemente frontend; PA2 lo aplanaba a “desarrollo genérico”.  
4. **Contaminación transversal:** liderazgo/comunicación en el mismo catálogo diluyen el dominio.  
5. **No distinguía evidencia débil de especialidad:** Cloud quedaba “cubierto” aunque 5/7 skills fueran NONE.

### 5.6 Por qué MC1 representa mejor el perfil

Porque alinea el modelo con las preguntas del Explorador:

- Área = profesión (Desarrollo de Software) — no herramientas.  
- Especialidad = saber hacer (Frontend, Backend, …) — no “digital tools”.  
- Skill = con qué lo hace.  
- Evidencia = por qué lo creemos (Evidence Engine intacto).

El perfil de Camilo deja de ser un vector de atributos abstractos y pasa a ser un árbol navegable con ejes desiguales pero honestos.

---

## 6. Propuesta del primer Explorador de Competencias (modelo de navegación)

Sin frontend. Solo contrato de navegación.

```
Área: Desarrollo de Software
        │
        ▼
Especialidades (ejes del radar de ESTA área)
        │
        ▼
Skills de la especialidad seleccionada
        │
        ▼
Evidencias (ítems Enrichment + métricas Evidence Engine)
```

### 6.1 Ejes del radar (Camilo / área Software)

**Total especialidades del dominio:** 7  
**Ejes visibles recomendados en la primera visualización:** **5**  
**Ejes ocultos/atenuados:** **2**

| Eje | Visible | Abrir por defecto | Motivo |
|-----|---------|-------------------|--------|
| Desarrollo frontend | Sí | **Sí** | Identidad del perfil + 3 STRONG |
| Desarrollo backend | Sí | No | coverage 1.0, avgStrength alto |
| Bases de datos | Sí | No | cluster laboral claro |
| Ingeniería y calidad | Sí | No | Git + pruebas con evidencia laboral |
| IA aplicada al desarrollo | Sí | No | mayor strength del CV |
| Integración de APIs | **Oculto** (o badge “evidencia puntual”) | No | cardinality 2; riesgo de eje monoskills |
| Cloud y despliegue | **Oculto** | No | coverage 0.29; 5 NONE |

Regla propuesta para ocultar:  
`coverage < 0.40` **o** (`skills_with_support ≤ 1` **y** `strong+moderate ≤ 1` sin acompañamiento).

### 6.2 Flujo al seleccionar un eje

1. Usuario elige área **Desarrollo de Software** (única en el MVP).  
2. Radar muestra 5 ejes; Frontend preseleccionado.  
3. Panel de skills: solo skills con peso primario (o primario+secundario) en esa especialidad, ordenadas por `evidenceStrength` desc.  
4. Al abrir una skill: `evidence_items` enriquecidos + `evidenceLevel` / `evidenceStrength` / `evidenceConfidence` / `explanation` / flags.

### 6.3 Tratamiento de estados no-DOMAIN

| Estado | En Explorador MC1 |
|--------|-------------------|
| TRANSVERSAL_FUTURE | No aparecen en el árbol del área Software (reservado MC2) |
| AMBIGUOUS | No crean eje; opcionalmente “Otros hallazgos” colapsado para auditoría, no para radar |
| OUTSIDE / CATALOG_GAP | N/A en este piloto |

### 6.4 Vertical Slice objetivo (post-aprobación)

```
Camilo
  → Desarrollo de Software
    → Especialidades validadas (7 en catálogo; 5 en radar Camilo)
      → Clasificación de 42 DOMAIN_SPECIALTY (+ pesos duales)
        → Evidencias evaluationId=3
          → Explorador navegable (mínimo viable)
```

---

## 7. Recomendaciones arquitectónicas

### 7.1 Fusiones / divisiones

| Recomendación | Acción | Motivo |
|---------------|--------|--------|
| No crear especialidad **Arquitectura** ahora | Excluir | Solo 1 skill NONE; sería inferencia |
| No crear **QA** separado | Ya fusionado en Ingeniería y calidad | Masa insuficiente |
| **Integración de APIs** | Mantener en catálogo; **ocultar en radar Camilo** o fusionar a BE en PA2 mínimo | Cardinality 2 vs evidencia STRONG puntual |
| **IA aplicada** | Mantener pese a 2 skills | Strength + educación lo justifican; no fusionar a “conocimientos varios” |
| **Cloud** | Mantener en catálogo; ocultar en radar hasta más evidencia | Evitar falsa fortaleza |

### 7.2 Nombres

| Propuesto | Alternativa descartada | Por qué |
|-----------|------------------------|---------|
| Desarrollo frontend | “UI” / “React stack” | Profesión comprensible, no herramienta |
| Desarrollo backend | “Node/.NET” | No atar el eje a un vendor |
| Bases de datos | “Data & ORM” | ORM es skill, no especialidad |
| Integración de APIs | “APIs REST” | La especialidad es la práctica, no el protocolo |
| Cloud y despliegue | “DevOps” | No hay CI/CD/pipelines en las 59 skills |
| Ingeniería y calidad de software | “Herramientas y metodologías” | Evitar nombre de cajón del extractor |
| IA aplicada al desarrollo | “Inteligencia Artificial” genérica | Ancla al dominio software (no MC2 cognitivo) |

### 7.3 Conceptos demasiado amplios / específicos

- **Demasiado amplio:** “Desarrollo Full Stack”, “SOFTWARE_DEVELOPMENT” histórico, “DIGITAL_TOOLS”.  
- **Demasiado específico para eje:** Postman, prompting, Angular Material, un proveedor S3/CloudFront.  
- **Adecuado para eje:** Frontend, Backend, Bases de datos.  
- **Adecuado con cautela:** IA aplicada, Ingeniería y calidad, Cloud (catálogo sí / radar no).

### 7.4 Reglas para PA2 (cuando se implemente)

1. Catálogo **por área** (`SOFTWARE`), versionado, independiente de PA1.  
2. PA1 **congelado**; no migrar mappings audiovisuales.  
3. Inputs de clasificación: skills de extraction 206 + enrichment 2 + evaluation 3.  
4. Cada mapping: `skill → specialty` + `weight` + `mappingType` + `rationale`; suma de pesos ≤ 1 por skill.  
5. Soft skills → flag `TRANSVERSAL_FUTURE`, sin score en MC1.  
6. AMBIGUOUS → no mapping definitivo; artefacto de auditoría.  
7. Radar config por persona/área: `visibleAxes`, `defaultAxis`, `hiddenAxes` (no hardcodear 7 ejes iguales para todos).  
8. No inferir especialidades sin skills con evidencia; la existencia en catálogo ≠ visibilidad en radar.

### 7.5 Criterio de éxito de esta fase (cumplido)

Queda definida la información para implementar el primer Vertical Slice de PA2:

- Fuente de verdad validada (187 / 206 / 2 / 3 / 59).  
- 59 skills clasificadas.  
- 7 especialidades descubiertas desde datos.  
- 5 ejes visibles + 2 ocultos para Camilo.  
- Comparación explícita vs PA2 histórico.  
- Recomendaciones de fusión/nombre/radar listas para catálogo mínimo.

---

## Apéndice A — Skills STRONG (ancla del perfil)

| Skill | Strength | Fuentes |
|-------|----------|---------|
| Inteligencia Artificial | 87.6 | WORK + EDUCATION + PROFILE + SKILLS |
| React | 84.8 | WORK + PROFILE + SKILLS |
| Node.js | 84.8 | WORK + PROFILE + SKILLS |
| Next.js | 77.5 | WORK + PROFILE + SKILLS |
| Angular | 77.5 | WORK + PROFILE + SKILLS |
| APIs REST | 70.72 | WORK + SKILLS |

Estas seis skills son el “esqueleto” del Explorador: FE (3), BE/API (2), IA (1).

## Apéndice B — Artefactos de esta fase

| Artefacto | Uso |
|-----------|-----|
| `tmp/mc1-validate-source.js` | Script solo-lectura de validación |
| `tmp/cv-attributes/mc1-camilo-source-snapshot.json` | Snapshot 59 skills + enrichment + evidence |
| `tmp/cv-attributes/mc1-camilo-evidence-digest.json` | Digest de evidencias |
| `tmp/cv-attributes/pa2-proposal-camilo.json` | Referencia histórica (no fuente de verdad) |
| `docs/mc1.1-analisis-dominio-software-camilo.md` | Este documento |

---

**Próximo paso (fuera de MC1.1, tras aprobación):** implementar catálogo mínimo PA2 solo para `Desarrollo de Software`, mappings de las 42 `DOMAIN_SPECIALTY`, y el primer Explorador navegable con datos reales de Camilo — sin tocar PA1, Extractor, Enrichment ni Evidence Engine.
