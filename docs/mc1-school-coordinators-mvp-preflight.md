# MC1 — Piloto MVP coordinadores de escuela · Fase C1 (preflight)

**Estado:** `FASE C1 COMPLETADA / WRITES 0` → **C2 ejecutada** (ver `docs/mc1-school-coordinators-mvp-execution.md`)  
**Fecha C1:** 2026-07-29  
**CLI:** `npm run mc:pilot-school-coordinators -- --dry-run` · C2: `--execute --confirm`

Artefactos: `tmp/mc1-school-coordinators-mvp/`

`--execute` (Fase C2) está **bloqueado** hasta aprobación explícita tras este reporte.

---

## Personas

Versión activa: **4** · `periodo-agosto-2026` · Agosto 2026.  
Jefe inmediato (todos): LEIDY VIVIANA BERNAL LEÓN · COODINADOR OPERATIVO ACADEMICO · person_id 1077.

| Nombre esperado | Identificada | person_id | Documento | Correo | Rol real | CV | Extracción | Apta |
|-----------------|--------------|-----------|-----------|--------|----------|----|------------|------|
| Viviana Andrea Cabrera Cabrera | sí | 601 | 1117526801 | viviana_cabrerac@cun.edu.co | COORDINADOR ESCUELA DE INGENIERIA | sí | activa stale (#10) | sí · REEXTRACT |
| Maira Alejandra Doncel Largo | sí | 1078 | 1023935373 | maira_doncel@cun.edu.co | COORDINADOR ESCUELA DE TRANSVERSALES | sí | **ninguna** | sí · FIRST_EXTRACTION |
| Andrés Felipe Prieto Lizarazo | sí | 1079 | 1020720408 | andres_prieto@cun.edu.co | COORDINADOR ESCUELA DE NEGOCIOS | sí | activa stale (#11) | sí · REEXTRACT |
| Carlos Andrés Rodríguez | sí | 1080 | 1010174410 | carlos_rodriguezs@cun.edu.co | COORDINADOR ESCUELA DE BELLAS ARTES | sí | activa stale (#12) | sí · REEXTRACT |
| Aura Marcela Royero Vergara | sí | 1297 | 1042448655 | aura_royero@cun.edu.co | COORDINADOR ESCUELA DE TRANSFORMACION EMPRESARIAL | sí | activa stale (#198) | sí · REEXTRACT |

Sin ambigüedades de identidad. Todos en versión activa.

### Cohorte organizacional

| Documento | Escuela | Rol | Jefe | Versión | Activo |
|-----------|---------|-----|------|---------|--------|
| 1117526801 | Ingeniería | COORDINADOR ESCUELA DE INGENIERIA | L. V. Bernal | 4 | sí |
| 1023935373 | Transversales | COORDINADOR ESCUELA DE TRANSVERSALES | L. V. Bernal | 4 | sí |
| 1020720408 | Negocios | COORDINADOR ESCUELA DE NEGOCIOS | L. V. Bernal | 4 | sí |
| 1010174410 | Bellas Artes | COORDINADOR ESCUELA DE BELLAS ARTES | L. V. Bernal | 4 | sí |
| 1042448655 | Transformación Empresarial | COORDINADOR ESCUELA DE TRANSFORMACION EMPRESARIAL | L. V. Bernal | 4 | sí |

---

## Pipeline (CV / extracción)

| Documento | person_cv | Extracción activa | Estado | Content class | Acción C1 |
|-----------|-----------|-------------------|--------|---------------|-----------|
| 1117526801 | 105 | 10 | STALE_SELECTED_EXTRACTION | DIFFERENT_CONTENT | REEXTRACT |
| 1023935373 | 180 | — | NO_USABLE_EXTRACTION | UNVERIFIABLE | FIRST_EXTRACTION |
| 1020720408 | 53 | 11 | STALE_SELECTED_EXTRACTION | DIFFERENT_CONTENT | REEXTRACT |
| 1010174410 | 93 | 12 | STALE_SELECTED_EXTRACTION | DIFFERENT_CONTENT | REEXTRACT |
| 1042448655 | 167 | 198 | STALE_SELECTED_EXTRACTION | DIFFERENT_CONTENT | REEXTRACT |

SHA comparado (CV vigente vs extracción) en los 4 casos stale → **contenido distinto**. No hay `SAME_CONTENT_DIFFERENT_FILE_ID`.

Ninguna cadena enrichment + evidence activa sobre esas extracciones → PA2 dry-run **no evaluable** todavía (`MISSING_ENRICHMENT_OR_EVIDENCE_CHAIN`).

---

## Competencias preliminares (solo evidencia de extracción existente)

Señales leídas de extracciones activas stale (inventario C1; **no publicadas**). Sin evidence engine → la mayoría queda como evidencia **moderada heurística** o texto de extracción; **0 STRONG** formales.

| Persona | Señales publicables (heurística) | Familias detectadas (ejemplos) |
|---------|----------------------------------|--------------------------------|
| Viviana | ~17 complementarias | gestión académica, pedagogía/EVA, liderazgo, sistemas de información, marketing/emprendimiento |
| Maira | 0 (sin extracción) | — |
| Andrés | ~7 complementarias | liderazgo, gestión curricular, registro calificado, pedagogía |
| Carlos | ~14 complementarias | innovación educativa, pedagogía creativa, liderazgo, diseño/artes |
| Aura | ~10 complementarias | planeación académica, negocios/marketing, liderazgo |

**Principio:** ausencia de dominio aplicable ≠ ausencia de competencias. Tras C2 (reextracción + evidence) se podrá publicar capa MVP sin forzar dominio.

El cargo **no** se usó para inferir competencias (`INFERRED_FROM_ROLE` prohibido en publicación).

---

## Dominios vigentes (dry-run)

| Persona | Software | Diseño Visual | Audiovisual | RR. HH. |
|---------|----------|---------------|-------------|---------|
| Viviana | NOT_EVALUABLE (sin cadena) | idem | idem | DISCOVERED / no operativo |
| Maira | sin extracción | — | — | DISCOVERED / no operativo |
| Andrés | NOT_EVALUABLE | idem | idem | DISCOVERED / no operativo |
| Carlos | NOT_EVALUABLE | idem | idem | DISCOVERED / no operativo |
| Aura | NOT_EVALUABLE | idem | idem | DISCOVERED / no operativo |

No se ejecutaron evaluadores incompletos como productivos. **HUMAN_RESOURCES** no se evaluó.

---

## Posible dominio nuevo

**Diagnóstico global:** `WEAK_NEW_DOMAIN_SIGNAL`

| Clúster provisional | Personas | Fortaleza | Recomendación |
|---------------------|----------|-----------|---------------|
| EDUCATION_AND_PEDAGOGY | 3 | REPEATED_CROSS_PROFILE_SIGNAL | rastrear; no crear catálogo aún |
| LEADERSHIP_AND_PROJECTS | 3 | REPEATED_CROSS_PROFILE_SIGNAL | capacidad transversal probable |
| ACADEMIC_MANAGEMENT | 2 | REPEATED_CROSS_PROFILE_SIGNAL | candidato débil; más perfiles |
| BUSINESS_MANAGEMENT | 2 | REPEATED_CROSS_PROFILE_SIGNAL | no igualar a «Escuela de Negocios» |
| ENGINEERING_MANAGEMENT | 1 | ISOLATED_SIGNAL | no dominio por Escuela de Ingeniería |
| QUALITY_ASSURANCE | 1 | ISOLATED_SIGNAL | observar |

**Anti-forzado:** la escuela organizacional no implica dominio. Un dominio nuevo requeriría patrón repetido post-C2 con evidence STRONG en ≥3–4 perfiles adicionales fuera de esta cohorte.

Respuestas C1:

| Pregunta | Respuesta preliminar |
|----------|----------------------|
| ¿Sin dominio representativo? | **5/5** (cadena PA2 incompleta + extracciones stale/ausentes) |
| Competencias en ≥2 perfiles | pedagogía/educación, liderazgo, gestión académica, negocios (señales) |
| ¿Clúster coherente? | Educación/pedagogía + liderazgo (débil, pre-evidence) |
| ¿Dominio / especialidad / transversal? | Más bien **capacidades transversales** + posible dominio académico post-validación |
| Mayor cobertura potencial | EDUCATION_AND_PEDAGOGY / ACADEMIC_MANAGEMENT |
| Evidencia en contra | Se mezclan prácticas distintas por escuela; riesgo de dominio artificial |
| Perfiles adicionales | ≥5–10 coordinadores/docentes con CV fresco y evidence |

Detalle: `new-domain-signals.json` · matriz: `capability-matrix.json`.

---

## Recomendación de ejecución (C2)

| Persona | Documento | Acción |
|---------|-----------|--------|
| Viviana | 1117526801 | REEXTRACT |
| Maira | 1023935373 | FIRST_EXTRACTION |
| Andrés | 1020720408 | REEXTRACT |
| Carlos | 1010174410 | REEXTRACT |
| Aura | 1042448655 | REEXTRACT |

Tras aprobar C2: concurrencia máx. 2; persistir extracción → enrichment → evidence → evaluar SOFTWARE / VISUAL_DESIGN / AUDIOVISUAL_PRODUCTION → proyección MVP de competencias sustentadas aunque no haya PRIMARY_MATCH.

```bash
# Solo cuando se apruebe C2:
npm run mc:pilot-school-coordinators -- --execute --concurrency=2
```

---

## Confirmación

| Ítem | Cumple |
|------|--------|
| No se modificó Google Drive | sí |
| No se modificó person_cv | sí |
| No se modificó cv_extraction | sí |
| No se crearon evaluaciones | sí |
| No se modificaron dominios / aliases / mappings / PA2 | sí |
| No se modificó la ficha | sí |
| No deploy / no commit / no push | sí |
| **writes: 0** | sí |

SHA de PDF se leyó desde Drive en modo RO para clasificar stale (sin writes).
