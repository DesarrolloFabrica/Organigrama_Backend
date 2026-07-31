# MC1 — Dry-run: reclasificación de especialidades (Ingrid)

**Fecha:** 2026-07-30  
**Modo:** SOLO LECTURA — **ninguna escritura**  
**Persona:** Ingrid Juliana Vargas Beltrán · `person_id=1145` · `******9945`  
**Extracción:** `236` (manual-curated, activa)  
**Evaluación PA2:** `74` (OPERATIONS_MANAGEMENT, PRIMARY_MATCH)  
**Catálogo activo:** `mc1.9-operations-golden-2026-07-29` (id=4)  
**Fuente de taxonomía:** ChatGPT (aprobada por negocio). Cursor no reinterpretó el CV.

Artefacto JSON RO: `tmp/mc1-ingrid-specialty-reclassification-dry-run.json`

---

## 1. Estado actual

| Campo | Valor |
| ----- | ----- |
| Dominio | `OPERATIONS_MANAGEMENT` (Gestión de Operaciones) — **no se modifica** |
| Scaffold | `OPS_GENERAL` (única specialty ACTIVE del dominio) |
| Skills en extracción 236 | **22** |
| Evidence evaluation | id **53**, SUCCEEDED, activa, **22** items |
| PA2 | id **74**, SUCCEEDED, activa, `PRIMARY_MATCH`, default=`OPS_GENERAL`, 1 eje ACTIVE |
| Pack vigente | `operations-management-mappings@1.0.0` (inmutable; write path exigirá nueva `pack_version`) |
| Regla PA2 | `pa2-operations-management-1.0.0` (**umbrales no se cambian**) |

### Skills activas en extracción 236

| # | normalized_name | key | type | skill_id |
| - | --------------- | --- | ---- | -------- |
| 1 | Análisis de indicadores de gestión | `analisis_de_indicadores_de_gestion` | PK | 1316 |
| 2 | Aplicación de normatividad académica | `aplicacion_de_normatividad_academica` | PK | 1324 |
| 3 | Automatización de procesos | `automatizacion_de_procesos` | PK | 1093 |
| 4 | Capacitación de usuarios | `capacitacion_de_usuarios` | PK | 1325 |
| 5 | Cierre de periodos académicos | `cierre_de_periodos_academicos` | PK | 1319 |
| 6 | Elaboración de informes de gestión | `elaboracion_de_informes_de_gestion` | PK | 1317 |
| 7 | Equivalencias académicas | `equivalencias_academicas` | PK | 1313 |
| 8 | Gestión de casos académicos | `gestion_de_casos_academicos` | PK | 1314 |
| 9 | Gestión de certificaciones | `gestion_de_certificaciones` | PK | 1318 |
| 10 | Gestión de historias académicas | `gestion_de_historias_academicas` | PK | 1322 |
| 11 | Gestión de notas | `gestion_de_notas` | PK | 1323 |
| 12 | Gestión de operaciones académicas | `gestion_de_operaciones_academicas` | PK | 1311 |
| 13 | Gestión de procesos | `gestion_de_procesos` | PK | 1320 |
| 14 | Gestión de requerimientos | `gestion_de_requerimientos` | PK | 1091 |
| 15 | Gestión de SLA | `gestion_de_sla` | PK | 1315 |
| 16 | Homologaciones académicas | `homologaciones_academicas` | PK | 1312 |
| 17 | Mejora Continua | `mejora_continua` | METHODOLOGY | 222 |
| 18 | Optimización de procesos | `optimizacion_de_procesos` | METHODOLOGY | 216 |
| 19 | Registro y Control Académico | `registro_y_control_academico` | PK | 1275 |
| 20 | Sistema SINU | `sistema_sinu` | TOOL | 260 |
| 21 | Trazabilidad de casos | `trazabilidad_de_casos` | PK | 1321 |
| 22 | Zoho CRM | `zoho_crm` | TOOL | 833 |

---

## 2. Resolución por especialidad (aprobada)

Convención: **encontrada** = presente en extracción 236 con key/tipo usable.  
**Faltante** = en taxonomía aprobada pero **no** en extracción 236 (reportar antes de crear).

### OPS_ACADEMIC — Operaciones Académicas

| Skill aprobada | En ext. 236 | Acción dry-run |
| -------------- | ----------- | -------------- |
| Gestión de operaciones académicas | Sí (1311) | REUSE → PRIMARY |
| Homologaciones académicas | Sí (1312) | REUSE → PRIMARY |
| Equivalencias académicas | Sí (1313) | REUSE → PRIMARY |
| Gestión de historias académicas | Sí (1322) | REUSE → PRIMARY |
| Gestión de notas | Sí (1323) | REUSE → PRIMARY |
| Cierre de períodos académicos | Sí (1319) (`periodos` sin tilde; misma key) | REUSE → PRIMARY |
| Gestión de certificaciones | Sí (1318) | REUSE → PRIMARY |
| Aplicación de normatividad académica | Sí (1324) | REUSE → PRIMARY |

**Encontradas: 8 · Faltantes: 0**

### OPS_PROCESS_IMPROVEMENT — Gestión y Mejora de Procesos

| Skill aprobada | En ext. 236 | Acción dry-run |
| -------------- | ----------- | -------------- |
| Automatización de procesos | Sí (1093 PK) | REUSE 1093 (hay también 1119 METHODOLOGY — no duplicar) |
| Gestión de procesos | Sí (1320) | REUSE → PRIMARY |
| Mejora continua | Sí (222 METHODOLOGY) | REUSE 222 (hay también 386 PK — no duplicar) |
| Optimización de tiempos de respuesta | **No** | **FALTANTE** — no crear sin aprobación; no existe key en catálogo |

**Encontradas: 3 · Faltantes: 1**

### OPS_SERVICE_REQUESTS — Gestión de Servicios y Requerimientos

| Skill aprobada | En ext. 236 | Acción dry-run |
| -------------- | ----------- | -------------- |
| Gestión de requerimientos | Sí (1091) | REUSE → PRIMARY |
| Gestión de casos académicos | Sí (1314) | REUSE → PRIMARY |
| Gestión de SLA | Sí (1315) | REUSE → PRIMARY |
| Trazabilidad de casos | Sí (1321) | REUSE → PRIMARY |

**Encontradas: 4 · Faltantes: 0**

### OPS_ANALYTICS_CONTROL — Analítica y Control de Gestión

| Skill aprobada | En ext. 236 | Acción dry-run |
| -------------- | ----------- | -------------- |
| Análisis de indicadores de gestión | Sí (1316) | REUSE → PRIMARY |
| Elaboración de informes de gestión | Sí (1317) | REUSE → PRIMARY |
| Seguimiento de indicadores operativos | **No** | **FALTANTE** — near en catálogo: `seguimiento_de_indicadores_de_gestion` (323); **no auto-alias** |
| Control de cumplimiento operativo | **No** | **FALTANTE** — sin match en catálogo |

**Encontradas: 2 · Faltantes: 2**

### OPS_COORDINATION — Coordinación Operativa

| Skill aprobada | En ext. 236 | Acción dry-run |
| -------------- | ----------- | -------------- |
| Coordinación de equipos | **No** en 236 | Existe en catálogo `coordinacion_de_equipos` (347 SOFT_SKILL) — **no está en extracción**; no añadir a extraction sin aprobación |
| Capacitación de usuarios | Sí (1325) | REUSE → PRIMARY |
| Distribución y seguimiento de actividades | **No** | **FALTANTE** — sin match en catálogo |

**Encontradas: 1 · Faltantes: 2** (1 existe en catálogo pero fuera de extracción)

---

## 3. Herramientas (no ejes de radar)

| Tool aprobada | En ext. 236 | En catálogo | Acción prevista (write, no ahora) |
| ------------- | ----------- | ----------- | --------------------------------- |
| Zoho CRM | Sí `zoho_crm` 833 | Sí | OUTSIDE / sin mapping a specialty; alias `crm_zoho` ya existe |
| SINU | Sí como `sistema_sinu` 260 | También `sinu` 4 + alias `sistema_sinu`→4 | Mantener skill de extracción 260; **no** forzar merge a 4 sin aprobación |
| SIIGO | **No** | `siigo` 2 | Solo catálogo; no inyectar en 236 |
| COMERSSIA | **No** | `comerssia` 3 | Solo catálogo; no inyectar en 236 |
| Microsoft Office | **No** | `microsoft_office` 288 | Solo catálogo; no inyectar en 236 |

---

## 4. Diferencias críticas

### Skills sobrantes en extracción 236 (no aparecen en taxonomía aprobada de especialidades ni como tools listadas con ese nombre)

| Skill en 236 | Motivo |
| ------------ | ------ |
| **Registro y Control Académico** (1275) | No está en la lista OPS_ACADEMIC aprobada |
| **Optimización de procesos** (216) | La lista aprobada pide *Optimización de tiempos de respuesta* (distinta) |

**No eliminar** sin aprobación. Opciones a decidir en write:

- A) Mapear `registro_y_control_academico` → `OPS_ACADEMIC` SECONDARY/PRIMARY por afinidad (requiere aprobación explícita; hoy **fuera** de lista).  
- B) Dejar `optimizacion_de_procesos` como SECONDARY de `OPS_PROCESS_IMPROVEMENT` o omitir del pack nuevo (sigue en extracción/evidencia).

### Skills no encontradas (faltantes vs taxonomía)

| Skill | ¿Existe en `cv_skill`? | ¿En extracción 236? |
| ----- | ---------------------- | ------------------- |
| Optimización de tiempos de respuesta | No | No |
| Seguimiento de indicadores operativos | No (near: indicadores_de_gestion 323) | No |
| Control de cumplimiento operativo | No | No |
| Coordinación de equipos | Sí 347 SOFT | **No** |
| Distribución y seguimiento de actividades | No | No |

**Regla cumplida:** reportadas **antes** de crear. Dry-run **no crea** ninguna.

### Aliases

| Alias | Canónica | Uso |
| ----- | -------- | --- |
| `crm_zoho` | `zoho_crm` (833) | Ya aplicado |
| `sistema_sinu` | `sinu` (4) | Existe; extracción usa skill 260 `sistema_sinu` (paralela) — **no unificar en dry-run** |
| `herramientas_ofimaticas_de_microsoft_office` | `microsoft_office` (288) | Irrelevante (Office no está en 236) |

### Duplicados técnicos (mismo key, distinto type)

| key | ids | Decisión dry-run |
| --- | --- | ---------------- |
| `automatizacion_de_procesos` | 1093 PK (en 236), 1119 METHODOLOGY | Reusar **1093** |
| `mejora_continua` | 222 METHODOLOGY (en 236), 386 PK | Reusar **222** |
| `optimizacion_de_procesos` | 216 METHODOLOGY (en 236), 494 PK | Sobrante / no en lista aprobada |

---

## 5. Plan de escritura (NO ejecutado)

### Especialidades a crear

En catálogo activo (vía **nueva versión de catálogo** o inserción controlada — el seed actual no muta versiones existentes):

1. `OPS_ACADEMIC`  
2. `OPS_PROCESS_IMPROVEMENT`  
3. `OPS_SERVICE_REQUESTS`  
4. `OPS_ANALYTICS_CONTROL`  
5. `OPS_COORDINATION`

### Tratamiento de `OPS_GENERAL`

- **Retirar** del radar: `lifecycle_status=INACTIVE` y/o `is_active=false` tras crear las 5.  
- **No borrar** la fila (trazabilidad evaluación 74).  
- Nueva evaluación PA2 no debe listarla como ACTIVE.  
- Pack nuevo **sin** mappings a `OPS_GENERAL`.

### Mappings que se crearían (solo skills encontradas en 236)

| Specialty | skill_key | type | mapping |
| --------- | --------- | ---- | ------- |
| OPS_ACADEMIC | gestion_de_operaciones_academicas | PK | PRIMARY |
| OPS_ACADEMIC | homologaciones_academicas | PK | PRIMARY |
| OPS_ACADEMIC | equivalencias_academicas | PK | PRIMARY |
| OPS_ACADEMIC | gestion_de_historias_academicas | PK | PRIMARY |
| OPS_ACADEMIC | gestion_de_notas | PK | PRIMARY |
| OPS_ACADEMIC | cierre_de_periodos_academicos | PK | PRIMARY |
| OPS_ACADEMIC | gestion_de_certificaciones | PK | PRIMARY |
| OPS_ACADEMIC | aplicacion_de_normatividad_academica | PK | PRIMARY |
| OPS_PROCESS_IMPROVEMENT | automatizacion_de_procesos | PK | PRIMARY |
| OPS_PROCESS_IMPROVEMENT | gestion_de_procesos | PK | PRIMARY |
| OPS_PROCESS_IMPROVEMENT | mejora_continua | METHODOLOGY | PRIMARY |
| OPS_SERVICE_REQUESTS | gestion_de_requerimientos | PK | PRIMARY |
| OPS_SERVICE_REQUESTS | gestion_de_casos_academicos | PK | PRIMARY |
| OPS_SERVICE_REQUESTS | gestion_de_sla | PK | PRIMARY |
| OPS_SERVICE_REQUESTS | trazabilidad_de_casos | PK | PRIMARY |
| OPS_ANALYTICS_CONTROL | analisis_de_indicadores_de_gestion | PK | PRIMARY |
| OPS_ANALYTICS_CONTROL | elaboracion_de_informes_de_gestion | PK | PRIMARY |
| OPS_COORDINATION | capacitacion_de_usuarios | PK | PRIMARY |

**Total mappings specialty: 18** (con solo skills presentes en 236).

Tools (`zoho_crm`, `sistema_sinu`): clasificación **OUTSIDE** (o TRANSVERSAL), **sin** `mc_skill_specialty_mapping` → no son ejes.

### Extracción / evidencias / PA2

| Artefacto | Acción write (futura) |
| --------- | --------------------- |
| Extracción 236 | **Conservar** (no re-extraer) |
| Evidence 53 + 22 items | **Conservar** |
| Mappings OPS_GENERAL actuales | Desactivar / reemplazar por pack nuevo |
| Evaluación 74 | Quedará histórica (`is_active=false`) al recalcular |
| Nueva evaluación PA2 | Sobre extraction 236 + pack/especialidades nuevas; misma regla `pa2-operations-management-1.0.0` |

### Pack / catálogo (requisito técnico)

- Nueva `MC_CATALOG_VERSION` (recomendado) con 5 specialties + OPS_GENERAL INACTIVE, **o** ampliación controlada del catálogo 4.  
- Nuevo pack `operations-management-mappings@1.1.0` (hash distinto; no mutar 1.0.0).  
- Actualizar `MC_DOMAIN_RADAR_AXIS_ORDER.OPERATIONS_MANAGEMENT` a las 5 códigos.  
- FE: sin cambios; fallback de ejes por códigos de specialty.

---

## 6. Resultado PA2 / radar esperado (proyección)

Con **solo** las 18 skills mapeadas presentes en 236 (sin crear faltantes):

| Specialty | Skills mapeadas evidenciables | Presentación esperada* |
| --------- | ----------------------------: | ---------------------- |
| OPS_ACADEMIC | 8 | **ACTIVE** (masa alta) |
| OPS_PROCESS_IMPROVEMENT | 3 | **ACTIVE** o EMERGENT (umbral minMapped=3) |
| OPS_SERVICE_REQUESTS | 4 | **ACTIVE** |
| OPS_ANALYTICS_CONTROL | 2 | **EMERGENT** (bajo mínimo mapped=3; posible override low-cardinality) |
| OPS_COORDINATION | 1 | **EMERGENT** / **HIDDEN** (poca masa) |

\*Sin cambiar umbrales PA2. Dominio sigue **PRIMARY_MATCH** si ≥1 specialty ACTIVE (probable vía ACADEMIC + SERVICE).

| Radar | Valor esperado |
| ----- | -------------- |
| Número de ejes | **5** |
| Nombres | Operaciones Académicas; Gestión y Mejora de Procesos; Gestión de Servicios y Requerimientos; Analítica y Control de Gestión; Coordinación Operativa |
| Dominio visible | Sí (`OPERATIONS_MANAGEMENT`, PRIMARY_MATCH) |
| Tools como ejes | **No** |

---

## 7. Inequivocidad del dry-run

**Inequívoco para proceder a write parcial** (solo redistribuir skills existentes):

- 5 códigos de specialty claros.  
- 18 mappings exactos a skills ya en 236.  
- Tools fuera de ejes.  
- OPS_GENERAL a retirar.  
- Extracción/evidencias intactas.

**Bloqueantes / decisiones humanas antes de write completo “lista ChatGPT 100%”:**

1. ¿Crear las **5 skills faltantes** y añadirlas a extracción 236? (rompe “no re-extraer”; habría que ampliar extraction_skills + evidence items).  
2. Destino de **Registro y Control Académico** y **Optimización de procesos** (sobrantes).  
3. ¿Unificar `sistema_sinu` (260) con `sinu` (4)?  
4. ¿Incluir SIIGO / COMERSSIA / Office solo en pack OUTSIDE sin estar en 236?

**Recomendación:** write fase A = especialidades + remap de las 18 + tools OUTSIDE + PA2 recalc; fase B = faltantes solo tras aprobación explícita.

---

## 8. Escrituras en esta fase

**Ninguna.**
