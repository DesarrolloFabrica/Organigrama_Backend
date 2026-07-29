# MC1 — Auditoría de integridad y ciclo de vida de cv_extraction

**Estado:** AUDITORÍA DE CICLO DE VIDA COMPLETADA / WRITES 0
**Generado:** 2026-07-29T21:15:43.183Z
**Unidad de activación:** `ACTIVE_PER_PERSON`

## 1. Esquema

| Elemento | Existe | Definición |
| -------- | -----: | ---------- |
| table organigrama.cv_extraction | Sí | `organigrama.cv_extraction` |
| PK id | Sí | `bigint PRIMARY KEY (BIGSERIAL)` |
| FK person_id → core.person | Sí | `FOREIGN KEY (person_id) REFERENCES core.person(id) ON DELETE RESTRICT` |
| FK person_cv_id → person_cv | Sí | `FOREIGN KEY (person_cv_id) REFERENCES organigrama.person_cv(id) ON DELETE RESTRICT` |
| drive_file_id | Sí | `character varying NOT NULL` |
| is_active | Sí | `boolean default false` |
| status | Sí | `CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'RUNNING'::character varying, 'SUCCEEDED'::character varying, 'FAILED'::character varying])::text[])))` |
| created_at / updated_at | Sí | `timestamptz` |
| model / prompt_version / extractor_version | Sí | `varchar NOT NULL (idempotencia)` |
| pdf_sha256 (checksum) | Sí | `character` |
| CHECK is_active ⇒ SUCCEEDED | Sí | `CHECK (((is_active = false) OR ((status)::text = 'SUCCEEDED'::text)))` |
| UNIQUE (person_id) WHERE is_active | Sí | `CREATE UNIQUE INDEX uq_cv_extraction_person_active ON organigrama.cv_extraction USING btree (person_id) WHERE (is_active = true)` |
| UNIQUE idempotency SUCCEEDED | Sí | `CREATE UNIQUE INDEX uq_cv_extraction_idempotency ON organigrama.cv_extraction USING btree (person_id, pdf_sha256, model, prompt_version, extractor_version) WHERE ((status)::text = 'SUCCEEDED'::text)` |
| triggers | No | `ninguno` |

### Semántica

- `is_active` = **una extracción activa por persona** (`ACTIVE_PER_PERSON`).
- CHECK: `is_active` solo permitido si `status = SUCCEEDED` → una activa FAILED/RUNNING es **imposible** en BD conforme.
- Índice `uq_cv_extraction_person_active`: `UNIQUE (person_id) WHERE is_active`.
- **No** existe `UNIQUE (person_cv_id) WHERE is_active`.

## 2. Flujo de activación (código)

```text
createExtraction (is_active=false, status=RUNNING/PENDING)
  → Gemini / pipeline
  → completeExtraction (TX + pg_advisory_xact_lock(person_id)):
       desactivar otras activas del person_id
       status=SUCCEEDED, is_active=true
       commit
  → failExtraction: is_active=false, status=FAILED
```

Si falla o se interrumpe antes de `completeExtraction`, la fila RUNNING no queda activa (default `is_active=false` + CHECK). Race: advisory lock + UNIQUE mitigan doble activa.

## 3. Distribución de activas por persona

| Número de activas por persona | Personas |
| ----------------------------- | -------: |
| 0 | 16 |
| 1 | 139 |
| 2 | 0 |
| 3+ | 0 |

Casos con >1 activa: **0** (debe ser 0 si el UNIQUE está aplicado).

### Status de filas is_active=true

| Status | Filas activas |
| ------ | ------------: |
| SUCCEEDED | 139 |
| FAILED | 0 |
| RUNNING | 0 |
| PENDING | 0 |
| Otro | 0 |

## 4. Consumidores / selección

| Consumidor | Criterio | Orden | Filtros |
| ---------- | -------- | ----- | ------- |
| mc110-activate-person-competencies / MC1 CLI | status=SUCCEEDED AND is_active=true (find first after ORDER BY id DESC) | id DESC | person_id |
| CvSkillsPersistenceService.completeExtraction | activa por person_id; UNIQUE index; CHECK SUCCEEDED | n/a (write path) | advisory lock + deactivate others + activate new |
| OrgChartCvService (ficha hasCv) | NO lee cv_extraction; solo person_cv is_active | id DESC | person_id + is_active |
| OrgChartCompetenciesService (API competencias) | mc_profile_evaluation is_active SUCCEEDED → extraction_id congelado | cv.is_active DESC, e.id DESC | person_id + domain |
| McPa2Service.loadExtraction | por extraction_id explícito; exige SUCCEEDED | n/a | id = $1 |
| reconcile-drive-cv (auditoría previa) | todas is_active=true; comparado file_id vs person_cv | document | is_active (sin exigir unicidad por persona en el conteo) |

**Ficha Organigrama (hasCv):** no usa `cv_extraction`. **API competencias:** usa `extraction_id` de `mc_profile_evaluation` activa (puede diferir de la extracción MC1 activa si PA2 no se reevaluó). **MC1 pipeline:** `is_active AND SUCCEEDED`.

## 5. Corrección de métricas (auditoría Drive previa)

| Métrica anterior | Unidad real | Solapamiento | Correcta | Valor corregido |
| ---------------- | ----------- | ------------ | -------- | --------------: |
| person_cv_activos_127 | rows person_cv WHERE is_active | none | Sí | 127 |
| extracciones_activas_138 | rows cv_extraction WHERE is_active | one row per person if UNIQUE holds | No | 139 |
| CURRENT_14 | previous=document rows; corrected=persons with CURRENT_SELECTED | previous mixed with drive-only docs | No | 31 |
| STALE_FILE_ID_96 | previous≈document rows with active ext file≠cv; corrected=persons | could approach persons if 1 active/person | No | 80 |
| NO_EXTRACTION_50 | previous=document rows without CURRENT/STALE active; corrected=persons sin ninguna extracción | incluía MISSING_IN_PERSON_CV y históricos | No | 16 |

Veredicto sobre métricas del reporte Drive↔person_cv: **PARTIALLY_INVALID** (filas/documentos vs personas; ORPHAN/NO_EXTRACTION mal definidos).

## 6. Estado real por persona (mutuamente excluyente)

| Estado final por persona | Cantidad |
| ------------------------ | -------: |
| HEALTHY_CURRENT | 31 |
| STALE_SELECTED_EXTRACTION | 80 |
| NO_USABLE_EXTRACTION | 16 |
| MULTIPLE_ACTIVE_CURRENT_RESOLVED | 0 |
| MULTIPLE_ACTIVE_AMBIGUOUS | 0 |
| PERSON_CV_ORPHAN | 0 |
| EXTRACTION_ONLY_NO_CV | 28 |
| **Suma** | **155** |
| Universo | 155 |
| Cobertura OK | true |

### STALE / NO_EXTRACTION recalculados

| Clasificación selección MC1 | Personas |
| ---------------------------- | -------: |
| CURRENT_SELECTED_EXTRACTION | 31 |
| NO_USABLE_SELECTED_EXTRACTION | 44 |
| STALE_SELECTED_EXTRACTION | 80 |

| Bucket NO_EXTRACTION (solo con person_cv activo) | Personas |
| ----------------------------------------------- | -------: |
| HAS_ACTIVE_SUCCEEDED | 111 |
| NOT_APPLICABLE_NO_CV | 28 |
| NO_EXTRACTION_AT_ALL | 16 |

### Orfandad (por fila extraction)

| Estado | Filas |
| ------ | ----: |
| NOT_ORPHAN_HISTORICAL | 111 |
| ORPHAN_NO_ACTIVE_PERSON_CV | 44 |
| ORPHAN_OLD_DRIVE_FILE | 80 |

## 7. Casos Diseño Visual

| Documento | Extracciones | Activas | API | MC1 | Estado real |
| --------- | -----------: | ------: | --- | --- | ----------- |
| 1015482688 | 3 | 1 | 207 | 207 | HEALTHY_CURRENT |
| 1000035262 | 2 | 1 | 219 | 219 | HEALTHY_CURRENT |
| 1000590473 | 2 | 1 | 220 | 220 | HEALTHY_CURRENT |

## 8. Causa raíz

- `STALE_SELECTED_EXTRACTIONS`
- `NO_USABLE_EXTRACTIONS`
- `AUDIT_COUNTING_ERROR`
- `HISTORICAL_ROWS_MISCLASSIFIED`

## 9. Decisión: `REEXTRACTION_REQUIRED`

Prioridad: reextracción (o reevaluación PA2) para `STALE_SELECTED_EXTRACTION`; no “reparar activación” masiva si UNIQUE ya garantiza una activa/persona. Corregir interpretación de auditoría previa.

## 10. Confirmación

```text
No se modificó Google Drive.
No se modificó person_cv.
No se modificó cv_extraction.
No se activaron ni desactivaron filas.
No se crearon extracciones.
No se modificó la API.
No se modificó MC1.
No commit.
No push.
writes: 0.
```
