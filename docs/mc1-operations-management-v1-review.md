# MC1 — Revisión v1: dominio Gestión de Operaciones

**Fecha:** 2026-07-29  
**Modo:** solo lectura / plan técnico (sin escritura en BD, sin seed, sin import, sin cambios PA2/FE)  
**Persona semilla (contexto):** Ingrid Juliana Vargas Beltrán · `person_id=1145` · documento `******9945` · `person_cv` **ACTIVO** (sync Drive resuelto)  
**Corpus conceptual:** curación manual ChatGPT (no reanalizar CV; no Gemini)  
**Base de resolución previa:** `tmp/mc1-curated/1000019945-catalog-resolution.json` (RO, 2026-07-30)  
**Catálogo activo de referencia:** `mc1.8-2026-07-28`

---

## 0. Veredicto ejecutivo

| Pregunta | Respuesta |
| -------- | --------- |
| ¿El código `OPERATIONS_MANAGEMENT` es válido? | **Sí** (convención `UPPER_SNAKE_CASE`) |
| ¿Las 5 especialidades duplican catálogo vigente? | **No** — todas `NO_MATCH` frente a las 15 ACTIVE |
| ¿El importer puede crear este dominio hoy? | **No** — bloquea dominio/especialidad `PROPOSED` |
| ¿PA2 puede evaluarlo “sin tocar” el motor? | **Parcial:** el motor genérico sí; hace falta **regla nueva** registrada + catálogo/pack sembrados |
| ¿El radar consume sin cambios de FE? | **Parcial:** API data-driven sí; ejes/labels canónicos en FE **aún no** incluyen este dominio (cae a fallback por rank) |
| ¿Se puede importar el perfil de Ingrid ya? | **No todavía** — faltan seed de dominio/especialidades + pack + PA2 + mappings |

**Conclusión:** la propuesta funcional es coherente y **no choca** con dominios/especialidades existentes. Es un candidato sólido a **nuevo dominio controlado** (análogo documental a `HUMAN_RESOURCES` DISCOVERED → luego seed). La primera creación **no** puede hacerse vía importer curado: hay que seguir la política de nacimiento de dominio (`docs/mc1-domain-versioning-policy.md` §2).

---

## 1. Dominio propuesto

| Campo | Valor propuesto | Validación |
| ----- | --------------- | ---------- |
| Nombre | Gestión de Operaciones | OK (nombre humano; no entra al código) |
| Código sugerido | `OPERATIONS_MANAGEMENT` | Cumple regex API `^[A-Z][A-Z0-9_]{1,79}$` y patrón de catálogo |
| Estado hoy | **Inexistente** en `mc_domain` activo | Solo operativos: `SOFTWARE`, `VISUAL_DESIGN`, `AUDIOVISUAL_PRODUCTION` |
| Closest existente (score débil) | `SOFTWARE` | Correspondencia **WEAK/NONE** — no reutilizable |

### Qué no es (anti-patrones)

| No es | Por qué |
| ----- | ------- |
| Área Cloud / carpeta Drive `OPERACIONES ACADEMICAS` | Estructura org ≠ dominio MC1 |
| Atributo PA1 `OPERATIONS` | Otro sistema; no sustituye `mc_domain` |
| Especialidad dentro de SOFTWARE | Ingeniería de software ≠ operación académica/servicios |
| `HUMAN_RESOURCES` | Ciclo de talento; frontera explícita en guía HR (“operación académica genérica” ≠ TH) |

### Pregunta rectora (propuesta)

> ¿Qué práctica profesional de **operar, mejorar y controlar servicios/procesos** (con énfasis académico-operativo en esta semilla) debe representar el radar, fuera de SOFTWARE / VISUAL / AV?

---

## 2. Código final recomendado

### Dominio

**Recomendado: `OPERATIONS_MANAGEMENT`**

| Alternativa | Motivo de descartarla / deferirla |
| ----------- | --------------------------------- |
| `OPERATIONS` | Más corto, pero ambiguo vs PA1 y vs “ops” IT; menos alineado con nombres largos ya usados (`AUDIOVISUAL_PRODUCTION`, `HUMAN_RESOURCES`) |
| `ACADEMIC_OPERATIONS` | Demasiado estrecho: la propuesta incluye procesos, servicios, analítica y coordinación no solo académica |

No hace falta ajustar el formato: `OPERATIONS_MANAGEMENT` es el código correcto bajo la convención vigente.

### Especialidades — códigos recomendados

Convención observada:

| Dominio | Prefijo especialidad |
| ------- | -------------------- |
| `SOFTWARE` | `SOFTWARE_*` |
| `VISUAL_DESIGN` | `VISUAL_*` |
| `AUDIOVISUAL_PRODUCTION` | `AV_*` |
| `HUMAN_RESOURCES` (doc) | `HR_*` |

Para un dominio de nombre compuesto largo, el precedente más cercano es **`AV_*`**. Se recomienda prefijo **`OPS_*`**.

| # | Nombre (propuesta funcional) | Código recomendado | Notas |
| - | ---------------------------- | ------------------ | ----- |
| 1 | Operaciones Académicas | `OPS_ACADEMIC` | Núcleo de la semilla Ingrid |
| 2 | Gestión y Mejora de Procesos | `OPS_PROCESS_IMPROVEMENT` | Evitar colisión semántica con QA SOFTWARE |
| 3 | Gestión de Servicios y Requerimientos | `OPS_SERVICE_REQUESTS` | Distinto de `SOFTWARE_ENGINEERING_QUALITY` (reqs de software) |
| 4 | Analítica y Control de Gestión | `OPS_ANALYTICS_CONTROL` | No es `SOFTWARE_DATA` ni People Analytics HR |
| 5 | Coordinación Operativa | `OPS_COORDINATION` | Nombre funcional “Coordinación Operativa” (antes “de equipos” en resolución RO) |

**Alternativa más verbosa** (si se prefiere simetría total con `SOFTWARE_*`): `OPERATIONS_ACADEMIC`, `OPERATIONS_PROCESS_IMPROVEMENT`, etc. Funcionalmente equivalente; `OPS_*` es más compacto para radar/FE.

Ningún código propuesto existe hoy en las 15 especialidades ACTIVE → **sin duplicidad de código**.

---

## 3. Especialidades vs catálogo vigente

| Especialidad conceptual | Match en mc1.8 | Veredicto |
| ----------------------- | -------------- | --------- |
| Operaciones Académicas | — | **NO_MATCH** → crear |
| Gestión y Mejora de Procesos | — | **NO_MATCH** → crear |
| Gestión de Servicios y Requerimientos | — | **NO_MATCH** → crear (cercanía falsa con `SOFTWARE_ENGINEERING_QUALITY` solo por skill `gestion_de_requerimientos`) |
| Analítica y Control de Gestión | — | **NO_MATCH** → crear |
| Coordinación Operativa | — | **NO_MATCH** → crear |

Códigos MVP de coordinadores (`ACADEMIC_MANAGEMENT`, `PROJECT_MANAGEMENT`, …) **no** son `mc_specialty` y no deben reutilizarse como si lo fueran.

---

## 4. Skills existentes (reutilizables)

Fuente: resolución RO de 24 skills prioritarias del perfil conceptual. Identidad canónica = `(normalized_key, skill_type)`.

| Input curado | `normalized_key` | `skill_id` | `skill_type` | Mapping actual | Uso recomendado en OPS v1 |
| ------------ | ---------------- | ---------- | ------------ | -------------- | ------------------------- |
| Registro y control académico | `registro_y_control_academico` | 1275 | `PROFESSIONAL_KNOWLEDGE` | *(sin specialty MC1)* | `REUSE_EXISTING` → `OPS_ACADEMIC` PRIMARY |
| Gestión de requerimientos | `gestion_de_requerimientos` | 1091 | `PROFESSIONAL_KNOWLEDGE` | **PRIMARY → `SOFTWARE_ENGINEERING_QUALITY`** | Reutilizar skill; ver riesgo §7 (multi-dominio) |
| Sistema SINU | `sistema_sinu` | 260 | `TOOL` | — | `REUSE_EXISTING` → tool de `OPS_ACADEMIC` / servicios (con política anti-tool consciente) |
| Liderazgo de equipos | `liderazgo_de_equipos` | 190 | `SOFT_SKILL` | — | Preferible `TRANSVERSAL_FUTURE` o SECONDARY débil en `OPS_COORDINATION` (no núcleo de dominio) |
| Microsoft Office | `microsoft_office` | 288 | `TOOL` | — | Probable `OUTSIDE` / no eje; no inventar especialidad de Office |

**Conteo reutilizable inequívoco (EXISTING):** 5  
**Nota:** `person_cv` activo ya no bloquea import (el JSON RO antiguo aún lista `NO_ACTIVE_PERSON_CV` — obsoleto tras sync).

---

## 5. Skills nuevas (PROPOSED — habría que crear)

Solo tras seed de dominio/especialidades + `reviewDecision: APPROVED_FOR_CREATION` en JSON 1.1.0 (el importer **sí** puede crear skills aprobadas; **no** dominios/especialidades).

| Input | `normalized_key` sugerido | `skill_type` sugerido v1 | Especialidad primaria sugerida |
| ----- | ------------------------- | ------------------------ | ------------------------------ |
| Gestión de operaciones académicas | `gestion_de_operaciones_academicas` | `PROFESSIONAL_KNOWLEDGE` | `OPS_ACADEMIC` |
| Homologaciones académicas | `homologaciones_academicas` | `PROFESSIONAL_KNOWLEDGE` | `OPS_ACADEMIC` |
| Equivalencias académicas | `equivalencias_academicas` | `PROFESSIONAL_KNOWLEDGE` | `OPS_ACADEMIC` |
| Gestión de casos académicos | `gestion_de_casos_academicos` | `PROFESSIONAL_KNOWLEDGE` | `OPS_ACADEMIC` |
| Gestión de SLA | `gestion_de_sla` | `PROFESSIONAL_KNOWLEDGE` | `OPS_SERVICE_REQUESTS` |
| Análisis de indicadores de gestión | `analisis_de_indicadores_de_gestion` | `PROFESSIONAL_KNOWLEDGE` | `OPS_ANALYTICS_CONTROL` |
| Elaboración de informes de gestión | `elaboracion_de_informes_de_gestion` | `PROFESSIONAL_KNOWLEDGE` | `OPS_ANALYTICS_CONTROL` |
| Gestión de certificaciones | `gestion_de_certificaciones` | `PROFESSIONAL_KNOWLEDGE` | `OPS_ACADEMIC` / `OPS_SERVICE_REQUESTS` |
| Cierre de periodos académicos | `cierre_de_periodos_academicos` | `PROFESSIONAL_KNOWLEDGE` | `OPS_ACADEMIC` |
| Gestión de procesos | `gestion_de_procesos` | `PROFESSIONAL_KNOWLEDGE` | `OPS_PROCESS_IMPROVEMENT` |
| Trazabilidad de casos | `trazabilidad_de_casos` | `PROFESSIONAL_KNOWLEDGE` | `OPS_SERVICE_REQUESTS` |
| Gestión de historias académicas | `gestion_de_historias_academicas` | `PROFESSIONAL_KNOWLEDGE` | `OPS_ACADEMIC` |
| Gestión de notas | `gestion_de_notas` | `PROFESSIONAL_KNOWLEDGE` | `OPS_ACADEMIC` |
| Aplicación de normatividad académica | `aplicacion_de_normatividad_academica` | `PROFESSIONAL_KNOWLEDGE` | `OPS_ACADEMIC` |
| Capacitación de usuarios | `capacitacion_de_usuarios` | `PROFESSIONAL_KNOWLEDGE` | `OPS_COORDINATION` / `OPS_SERVICE_REQUESTS` |
| CRM Zoho *(si no se aliasa)* | `crm_zoho` | `TOOL` | Preferir alias → `zoho_crm` (§6) |

**Conteo PROPOSED:** 16 (antes de colapsar Zoho a alias).

---

## 6. Aliases

| Formulación CV / curada | Acción recomendada | Canónica destino | Estado |
| ----------------------- | ------------------ | ---------------- | ------ |
| `CRM Zoho` / `crm_zoho` | **Alias controlado** | `zoho_crm` (`Zoho CRM`, id 833, `TOOL`) | No crear skill nueva |
| `sistema_sinu` | Ya existe alias → `sinu` (id 4) | Preferir canónica ya usada en resolución (`sistema_sinu` id 260) o unificar en curación explícita | Revisar cuál queda canónica en JSON |
| `Microsoft Office` vs `Microsoft Office 365` | **Mantener distintos** salvo evidencia | id 288 vs 1246 | No alias automático |
| `Elaboración de informes de gestión` | Revisar variante; no fusionar | near: `elaboracion_de_informes` (692), `elaboracion_de_reportes_de_gestion` (1004) | Decisión humana |

### AMBIGUOUS (requieren `skillType` explícito — no son aliases)

| Input | Candidatos existentes | Decisión sugerida v1 |
| ----- | --------------------- | -------------------- |
| Automatización de procesos | id 1093 `PROFESSIONAL_KNOWLEDGE` · id 1119 `METHODOLOGY` | Preferir **1093 PK** para outcome operativo; o 1119 si el CV habla de método |
| Mejora continua | id 386 PK · id 222 `METHODOLOGY` | Preferir **222 METHODOLOGY** (práctica) → `OPS_PROCESS_IMPROVEMENT` |
| Optimización de procesos | id 494 PK · id 216 `METHODOLOGY` | Preferir **216 METHODOLOGY** → `OPS_PROCESS_IMPROVEMENT` |

Sin `skillType` en JSON 1.1.0 el lookup queda AMBIGUOUS y el import se bloquea o omite según política.

---

## 7. Relaciones dominio → especialidad → skill (borrador v1)

```text
OPERATIONS_MANAGEMENT
├── OPS_ACADEMIC
│     PRIMARY: registro_y_control_academico (existente)
│     PRIMARY: gestion_de_operaciones_academicas, homologaciones_academicas,
│              equivalencias_academicas, gestion_de_casos_academicos,
│              cierre_de_periodos_academicos, gestion_de_historias_academicas,
│              gestion_de_notas, aplicacion_de_normatividad_academica (nuevas)
│     TOOL: sistema_sinu (existente) — peso bajo / SECONDARY según política anti-tool
├── OPS_PROCESS_IMPROVEMENT
│     PRIMARY: gestion_de_procesos (nueva)
│     PRIMARY: mejora_continua (existente, tipo elegido)
│     PRIMARY: optimizacion_de_procesos (existente, tipo elegido)
│     AMBIGUOUS→elegida: automatizacion_de_procesos (hoy clasificación SOFTWARE=AMBIGUOUS)
├── OPS_SERVICE_REQUESTS
│     PRIMARY: gestion_de_sla, trazabilidad_de_casos (nuevas)
│     PRIMARY/SECONDARY: gestion_de_requerimientos (existente — ver riesgo)
│     TOOL: zoho_crm vía alias (existente)
├── OPS_ANALYTICS_CONTROL
│     PRIMARY: analisis_de_indicadores_de_gestion,
│              elaboracion_de_informes_de_gestion (nuevas)
│     Cuidado: no mapear capacidad_analitica / analisis_de_datos como núcleo
│              (hoy TRANSVERSAL / AV-outside)
└── OPS_COORDINATION
      PRIMARY: capacitacion_de_usuarios (nueva)
      SOFT: liderazgo_de_equipos — SECONDARY o TRANSVERSAL_FUTURE
```

### Riesgo de duplicidad / multi-dominio

| Skill | Riesgo | Mitigación |
| ----- | ------ | ---------- |
| `gestion_de_requerimientos` | Ya PRIMARY en SOFTWARE ENG | Opción A: SECONDARY también en `OPS_SERVICE_REQUESTS` si el modelo lo permite. Opción B: skill OPS más específica (`gestion_de_requerimientos_de_servicio`). **No** borrar el mapping SOFTWARE. |
| `automatizacion_de_procesos` | Pack SOFTWARE la deja `AMBIGUOUS` | En pack OPS clasificar `DOMAIN_SPECIALTY` → `OPS_PROCESS_IMPROVEMENT` con tipo explícito |
| Variantes informes | Near-duplicates semánticos | Una canónica + aliases; no 3 skills “informe/reporte” |
| `gestion_de_operaciones_academicas` vs `gestion_de_historias_academicas` | Par semántico score 60 | Mantener ambas si evidencia distinta; no fusionar en v1 |
| Soft/tools | Inflación de ejes | Política anti-tool / soft similar a Visual-AV; Office fuera del núcleo |

---

## 8. Compatibilidad con importer manual

| Capacidad | Estado respecto a esta propuesta |
| --------- | -------------------------------- |
| Schema `mc1-curated-profile-1.1.0` | OK para skills + `reviewDecision` |
| Dominio `EXISTING` | **Requerido** — hoy sería `PROPOSED` → error `DOMAIN_PROPOSED_OR_MISSING` / `IMPORT_DOMAIN_PROPOSED` |
| Especialidad `EXISTING` | **Requerido** — hoy `PROPOSED` → `IMPORT_SPECIALTY_PROPOSED` |
| Crear skill `APPROVED_FOR_CREATION` | Soportado **después** de dominio/especialidades |
| Enrichment sin Gemini | Soportado (sintético) |
| Evidence + PA2 en execute | Soportado **si** dominio activo + mappings + regla PA2 |
| Idempotencia / fingerprint / rollback | Sin cambio de contrato esperado |

**Respuesta a “¿el importer puede procesar correctamente este dominio?”**

- **Hoy:** no.
- **Después del seed de catálogo + pack + PA2:** sí, el importer puede procesar un JSON con `domain.code = OPERATIONS_MANAGEMENT` y especialidades `OPS_*` EXISTING, creando solo skills aprobadas y evaluando PA2 — **sin** cambiar el código del importer.

Orden obligatorio (política §2):

1. Nueva `MC_CATALOG_VERSION` (no mutar mc1.8 in-place) con dominio + 5 especialidades.  
2. `mc:catalog --seed --activate`.  
3. Mapping pack `operations-management-mappings@…` + release.  
4. Regla `pa2-operations-management-x.y.z` + registro en `MC_OPERATIVE_DOMAIN_RULES`.  
5. Recién entonces `mc:validate-curated-profile` / `mc:import-curated-profile` para Ingrid.

---

## 9. Compatibilidad con PA2

| Aspecto | Evaluación |
| ------- | ---------- |
| Motor (`McPa2Service.evaluateProfileDomain`) | Genérico por `domainCode`; **no** hardcodea solo SOFTWARE |
| Exigencias | Dominio activo, especialidades ACTIVE, clasificaciones + mappings, evidence activa |
| `MC_OPERATIVE_DOMAIN_RULES` | Hoy solo 3 dominios — **hay que añadir** entrada OPS (nueva regla versionada) |
| ¿Hay que modificar fórmulas de SOFTWARE/Visual/AV? | **No** |
| ¿Hay que “tocar reglas” en el sentido de config PA2? | **Sí, crear** `pa2-operations-management-1.0.0` (umbrales, ranking, anti-tool) — no reescribir el engine |
| Evaluación multidominio | Una evaluación por `(person, domain)`; Ingrid puede tener OPS sin borrar SOFTWARE si existiera |

**Respuesta a “¿PA2 podría evaluarlo sin modificar reglas?”**

- **Sin modificar reglas de dominios ya publicados:** sí.  
- **Sin registrar ninguna regla nueva para OPS:** no — PA2 operativo no listará/evaluará el dominio.  
- El camino correcto es **nueva regla versionada**, no patch in-place de `pa2-software-*`.

---

## 10. Compatibilidad con radar / frontend

| Capa | Comportamiento esperado |
| ---- | ----------------------- |
| API `GET .../competencies` / `.../domains/:domainCode` | Data-driven desde `mc_domain` + evaluación persistida; regex de código ya acepta `OPERATIONS_MANAGEMENT` |
| Orden de ejes BE `MC_DOMAIN_RADAR_AXIS_ORDER` | Hay que **añadir** array `OPS_*` al publicar el dominio |
| FE `radarLabels.ts` | Solo tipados SOFTWARE + VISUAL_DESIGN; si falta orden → **fallback** `rank` luego `code` (`orderSpecialtiesForRadar`) |
| Short labels FE | Caen al `name` de especialidad si no hay entrada en `SHORT_LABELS` |

**Respuesta a “¿el radar podrá consumir el resultado sin cambios?”**

- **Consumo mínimo (mostrar dominio + especialidades evaluadas):** sí, vía API + fallback de orden.  
- **Radar “de primer nivel” (ejes canónicos, labels cortos, paridad con SOFTWARE):** requiere registro FE/BE de ejes — cambio **acotado**, no rediseño del radar.  
- Esta revisión **no** propone modificar frontend ahora (fuera de alcance); solo deja el gap explícito.

---

## 11. Checklist previo a la primera creación (siguiente iteración)

No ejecutar en esta fase; solo plan:

- [ ] Congelar guía `docs/mc1-operations-management-domain-guide.md` (plantilla) con propósito / anti-patrones / fronteras HR–SOFTWARE  
- [ ] Nueva versión de catálogo con `OPERATIONS_MANAGEMENT` + 5 `OPS_*`  
- [ ] Pack mappings v1 (skills EXISTING + PROPOSED aprobadas + tipos AMBIGUOUS resueltos)  
- [ ] Alias `crm_zoho` → `zoho_crm`  
- [ ] Decisión explícita sobre `gestion_de_requerimientos` multi-dominio  
- [ ] `pa2-operations-management-1.0.0` + `MC_OPERATIVE_DOMAIN_RULES`  
- [ ] `MC_DOMAIN_RADAR_AXIS_ORDER` (+ opcional FE labels)  
- [ ] JSON curado Ingrid 1.1.0 + dry-run validate/import  
- [ ] Execute import solo tras dry-run READY

---

## 12. Resumen tabular pedido

| Entregable | Contenido |
| ---------- | --------- |
| Dominio propuesto | Gestión de Operaciones |
| Código final recomendado | **`OPERATIONS_MANAGEMENT`** |
| Especialidades | `OPS_ACADEMIC`, `OPS_PROCESS_IMPROVEMENT`, `OPS_SERVICE_REQUESTS`, `OPS_ANALYTICS_CONTROL`, `OPS_COORDINATION` |
| Skills existentes | 5 (`registro_y_control_academico`, `gestion_de_requerimientos`, `sistema_sinu`, `liderazgo_de_equipos`, `microsoft_office`) + 3 AMBIGUOUS resolubles por tipo |
| Skills nuevas | ~15–16 PROPOSED (16 − 1 si Zoho es alias) |
| Aliases | `crm_zoho`→`zoho_crm`; revisar SINU canónica; no fusionar Office 365 |
| Riesgos de duplicidad | Reqs SOFTWARE; variantes informes; soft/tools; par operaciones/historias académicas |
| Compatibilidad importer | Contrato OK; **bloqueado** hasta seed dominio/especialidades |
| Compatibilidad PA2 | Motor OK; **falta** regla/pack/catálogo OPS (sin mutar reglas legacy) |
| Compatibilidad radar | API OK; **fallback** FE hoy; ejes canónicos = cambio acotado posterior |

---

*Documento de revisión únicamente. No se escribió en BD ni se ejecutó importer/seed/PA2/FE.*
