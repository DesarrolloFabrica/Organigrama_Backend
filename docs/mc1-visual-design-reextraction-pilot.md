# MC1 — Piloto de reextracción controlada (Diseño Visual)

**Estado:** `PILOTO DE REEXTRACCIÓN COMPLETADO`  
**Fecha:** 2026-07-29  
**Alcance:** solo `1000035262` y `1000590473` (no masivo de 96).  
**CLI:** `npm run mc:pilot-reextract-visual -- --documents=… --i-confirm-persist`

Artefactos:

- `tmp/mc-visual-design-reextraction-pilot/before/{doc}.json`
- `tmp/mc-visual-design-reextraction-pilot/dry-run/{doc}.json`
- `tmp/mc-visual-design-reextraction-pilot/after/{doc}.json`
- `tmp/mc-visual-design-reextraction-pilot/compare/{doc}.json`
- `tmp/mc-visual-design-reextraction-pilot/pilot-summary.json`
- `tmp/mc-visual-design-reextraction-pilot/api-mc1-verify.json`

---

## 1. Precondiciones

| Documento | person_id | person_cv_id | Extracción activa previa | PDF actual accesible | contentClass | Apto |
|-----------|-----------|--------------|--------------------------|----------------------|--------------|------|
| 1000035262 | 1169 | 27 | 96 (SUCCEEDED) | sí (`1jeOc0eDoA8LHek90pIc20kWLPtEV8k6h`) | DIFFERENT_CONTENT | sí |
| 1000590473 | 1170 | 17 | 97 (SUCCEEDED) | sí (`1CFxpyoDYieNjfvaqwczefo-zrV-j5rA5`) | DIFFERENT_CONTENT | sí |

Verificado por persona: exactamente 1 `person_cv` activo; 1 extracción activa SUCCEEDED; file ID distinto; 0 RUNNING/PENDING; PDF MIME; tamaño > 0; `pdf_sha256` calculable.

**Nota de esquema:** la BD remota no tenía `mc_profile_evaluation.domain_qualification` (migración 022 pendiente) ni tabla `mc_evaluation_set`. Se aplicó **solo** la migración 022 aditiva (`ADD COLUMN IF NOT EXISTS`) como prerequisito de la entidad TypeORM vigente. No se modificaron reglas PA2, thresholds, mappings ni catálogo. Evaluation Set: **N/A** en este entorno (persistencia single-domain; tabla 023 ausente).

---

## 2. Hashes y PDF vigente

Fuente exclusiva: `person_cv.drive_file_id` (sin búsqueda por nombre).

### 1000035262

| Campo | Valor |
|-------|-------|
| file ID | `1jeOc0eDoA8LHek90pIc20kWLPtEV8k6h` |
| nombre | `1000035262.pdf` |
| ruta | `FABRICA CONTENIDO/1000035262.pdf` |
| tamaño | 219826 |
| modifiedTime | 2026-07-24T13:42:18.000Z |
| md5Checksum | `c654325cef410ffe82931245dc50088d` |
| SHA-256 local | `6013fab4e0bf040f9613fc208b0400606820d1603a1ca2090a3e728d3186471a` |
| SHA extracción previa | `6bbed5a136800da8daacc5526f16f8fe6b488ec96afc17b015677b499d0c3cf3` |
| Clase | **DIFFERENT_CONTENT** |

### 1000590473

| Campo | Valor |
|-------|-------|
| file ID | `1CFxpyoDYieNjfvaqwczefo-zrV-j5rA5` |
| nombre | `1000590473.pdf` |
| ruta | `FABRICA CONTENIDO/1000590473.pdf` |
| SHA-256 local | `72121b6439f86bbe2b1e54cb5d6a38a86b9b5e0c6417d9dd7e03d609d7d2c4d7` |
| SHA extracción previa | `e17b805f87bdddc39a072f4f4da016c770b4948945fb773f9867832ce834ab20` |
| Clase | **DIFFERENT_CONTENT** |

Ningún caso SAME_CONTENT → no se aplicó `REPOINT_OR_METADATA_REPAIR`.

---

## 3. Baseline previo

Guardado en `before/`. Incluye person_cv, extracciones, skills/idiomas/certs, enrichment, evidence, evaluaciones VISUAL_DESIGN, versiones modelo/prompt/extractor. Sin Evaluation Set (tabla ausente).

---

## 4. Preflight dry-run

Guardado en `dry-run/`. Extracción Gemini + validación JSON **antes** de insertar la nueva fila activa. El resultado del preflight se reutiliza en `completeExtraction` (sin segunda llamada a Gemini).

| Documento | skills | visualHintHits | preflightOk | warnings críticos |
|-----------|--------|----------------|-------------|-------------------|
| 1000035262 | 31–32 | Figma, Illustrator, Photoshop, InDesign, ilustración/animación, identidad | sí | no |
| 1000590473 | 32–34 | Prototipado UX/UI, editorial, motion, Illustrator, Photoshop, AE, XD, Figma | sí | no |

Evidencia esperada: hallada en el PDF vigente **sin forzar**. Ausencias puntuales no bloquearon (evaluación contra contenido real).

Enrichment / evidence / PA2 del preflight completo en memoria no son persistibles sin extracción en BD; se ejecutaron en la cadena post-activación con rollback documentado si fallan.

---

## 5. Writes ejecutados

Por persona, secuencia:

1. `createRunningExtraction` (`is_active=false`)
2. `completeExtraction` → SUCCEEDED + activa; desactiva anterior (TX + advisory lock)
3. Enrichment persist + activate
4. Evidence persist + activate (`er2`)
5. PA2 VISUAL_DESIGN dry → qualification → persist + activate

| Documento | Ext. anterior | Ext. nueva | Enrichment | Evidence | Evaluación VISUAL |
|-----------|---------------|------------|------------|----------|-------------------|
| 1000035262 | 96 (histórica) | **219** | 36 | 36 | **18** |
| 1000590473 | 97 (histórica) | **220** | 37 | 37 | **19** |

Historial:

- Anterior: `is_active=false`, `status=SUCCEEDED`, trazable.
- Nueva: `is_active=true`, `status=SUCCEEDED`, `drive_file_id` = person_cv actual, SHA = PDF vigente.

---

## 6. Validación API / MC1 / ficha

| Documento | Ext. activa antes | Nueva activa | API usa nueva | MC1 usa nueva | Ficha OK (`hasCv`) |
|-----------|-------------------|--------------|---------------|---------------|--------------------|
| 1000035262 | 96 | 219 | sí (eval 18 → 219) | sí | sí |
| 1000590473 | 97 | 220 | sí (eval 19 → 220) | sí | sí |
| 1015482688 | 207 | 207 (sin cambio) | sí | sí | sí |

Cadena activa coherente: enrichment y evidence apuntan a la nueva extracción. Sin mezcla histórico/actual en resultados activos.

---

## 7. Comparación antes vs después

### 1000035262

| Métrica | Antes | Después |
|---------|-------|---------|
| drive_file_id | `1YqN_2fRmE6b4J-7PV4eJ70_8lfxvxO6w` | `1jeOc0eDoA8LHek90pIc20kWLPtEV8k6h` |
| pdf_sha256 | `6bbed5…` | `6013fa…` |
| nº skills | 11 | 32 |
| skills visuales (heurística) | Adobe CS, Diseño de Marca, Ilustración, Animación 2D | Figma, Illustrator, Photoshop, InDesign, identidad, interactivo/educativo, etc. |
| especialidades activas | (sobre fuente stale) | **VISUAL_GRAPHIC** ACTIVE |
| especialidades emergentes | — | VISUAL_DIGITAL_ASSETS, VISUAL_EDITORIAL |
| qualification | — | **PRIMARY_MATCH** |
| warnings | histórico c1 | normalización no interpretativa (Clip Studio, Premiere, Claude, Gemini, Notebook) |

Diff detallado: `tmp/.../compare/1000035262.json` (ADDED_FROM_CURRENT_CV dominante; histórico removido por no estar en CV vigente).

### 1000590473

| Métrica | Antes | Después |
|---------|-------|---------|
| drive_file_id | `1lAougY7g5lYa-UkyER7jwAij8EwsCd4P` | `1CFxpyoDYieNjfvaqwczefo-zrV-j5rA5` |
| pdf_sha256 | `e17b80…` | `72121b…` |
| nº skills | 18 | 34 |
| skills visuales | Illustrator, Photoshop, AE, Animación 2D, Motion, UX/UI, Figma, Prototipado | Prototipado UX/UI, editorial, Motion, Illustrator, Photoshop, AE, Animate, XD, Figma |
| especialidades activas | — | **ninguna ACTIVE** |
| especialidades emergentes | — | VISUAL_GRAPHIC, VISUAL_EDITORIAL |
| qualification | — | **SECONDARY_SIGNAL** |
| VISUAL_UI | — | **HIDDEN** (pese a Figma / XD / Prototipado UX/UI en extracción) |

---

## 8. Diagnóstico residual por capa (post-fuente correcta)

### Resuelto por reextracción

- `STALE_SELECTED_EXTRACTION` → `HEALTHY_CURRENT` en ambos casos.
- MC1 / API / PA2 alineados al `person_cv.drive_file_id` y SHA actuales.
- Skills visuales del PDF vigente ahora visibles en extracción (Figma, suite Adobe, identidad, editorial, motion, etc.).
- `1000035262` alcanza **PRIMARY_MATCH** con VISUAL_GRAPHIC ACTIVE.

### Sigue en enrichment

- Warnings de normalización no interpretativa (nombres amplificados luego corregidos al original).
- Calidad/cobertura de evidencia por skill depende del enricher; no se retocó.

### Sigue en aliases / catálogo / mappings

- `1000590473`: keys como `prototipado_ux/ui`, herramientas UI presentes, pero **VISUAL_UI permanece HIDDEN** → brecha de mapping/specialty (no de fuente).
- Skills nuevas del CV vigente pueden quedar sin clasificación DOMAIN_SPECIALTY hasta revisión de pack (sin tocar en este piloto).

### Sigue en especialidades / PA2 / qualification

- PA2/thresholds/policies **no modificados**.
- `1000590473` = SECONDARY_SIGNAL con 0 ACTIVE es resultado del motor vigente sobre evidencia actual; no atribuible a extracción stale.
- Evaluation Set / CDR: no exigidos por el flujo single-domain actual en esta BD.

---

## 9. Rollback documentado (no ejecutado)

Procedimiento de emergencia (piloto / SQL):

```sql
BEGIN;
UPDATE organigrama.cv_extraction
   SET is_active = FALSE, updated_at = NOW()
 WHERE id = :new_extraction_id AND is_active = TRUE;

UPDATE organigrama.cv_extraction
   SET is_active = TRUE, updated_at = NOW()
 WHERE id = :previous_extraction_id
   AND status = 'SUCCEEDED' AND is_active = FALSE;
COMMIT;
```

Luego, si hace falta coherencia de publicación:

- Desactivar enrichment/evidence/evaluación nuevas.
- Reactivar enrichment/evidence/evaluación anteriores (SUCCEEDED) ligadas a la extracción previa.
- Conservar la extracción nueva como histórica (`is_active=false`) para auditoría.

El script piloto, ante fallo post-`completeExtraction`, intenta este rollback de extracción automáticamente. **No se ejecutó rollback** en este piloto (ambos COMPLETED).

Cubierto además por tests existentes de `CvSkillsPersistenceService` (activación atómica, desactivación previa, rollback TX si falla Gemini/relaciones) y lifecycle (máx. 1 activa SUCCEEDED).

---

## 10. Auditoría posterior

### `npm run mc:audit-extraction-lifecycle`

| Documento | Antes | Después |
|-----------|-------|---------|
| 1000035262 | STALE_SELECTED_EXTRACTION | **HEALTHY_CURRENT** |
| 1000590473 | STALE_SELECTED_EXTRACTION | **HEALTHY_CURRENT** |
| 1015482688 | HEALTHY_CURRENT | **HEALTHY_CURRENT** |

Agregados (universo 155): `HEALTHY_CURRENT` **16** (antes 14); `STALE_SELECTED_EXTRACTION` **94** (antes 96).  
Activas por persona: máximo 1; buckets `2`/`3+` = 0. Activas SUCCEEDED.

### `npm run mc:reconcile-drive-cv`

Ambos documentos: `globalStatus=HEALTHY`, `driveStatus=ALIGNED`, `extStatus=CURRENT` (extracciones 219 / 220).

---

## 11. Resultado esperado — resumen

### Estado

**PILOTO DE REEXTRACCIÓN COMPLETADO**

### Casos

| Documento | Resultado | Extracción nueva | Estado final |
|-----------|----------|------------------|--------------|
| 1000035262 | COMPLETED | 219 | HEALTHY_CURRENT / PRIMARY_MATCH |
| 1000590473 | COMPLETED | 220 | HEALTHY_CURRENT / SECONDARY_SIGNAL |

### Integridad

- Máximo una extracción activa por persona.
- Toda activa SUCCEEDED.
- Extracciones anteriores conservadas (96, 97).
- Evaluaciones / enrichment / evidence activos apuntan a la extracción nueva.

### Causa de pobreza residual (orden)

1. ~~Extracción histórica stale~~ → **corregida**
2. Mappings / aliases (p. ej. UI en 1000590473)
3. Especialidades / pack visual
4. PA2 thresholds (sin cambio)
5. Qualification policy (SECONDARY_SIGNAL coherente con 0 ACTIVE)

### Confirmación

| Ítem | Cumple |
|------|--------|
| No se modificó Google Drive | sí |
| No se modificó el catálogo | sí |
| No se modificaron aliases | sí |
| No se modificaron mappings | sí |
| No se modificó lógica/thresholds PA2 | sí (solo columna aditiva 022) |
| No se modificó la API | sí |
| No se modificó el frontend | sí |
| No commit | sí |
| No push | sí |
