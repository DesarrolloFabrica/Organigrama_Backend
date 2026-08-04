# Persistencia: `organigrama.person_video`

**Estado final:** **APLICADA_Y_VALIDADA** (Cloud SQL / BD `core`)  
**Migración:** `migrations/025_person_video.sql`  
**Fecha de aplicación:** 2026-08-03  
**SHA-256 del archivo aplicado:** `911f7a337a74ffc32be3b14f22945688e2904a8ae818f25befa3bc9e2af0fab3`  
**Usuario técnico de sesión:** `user-core`  
**Arquitectura padre:** [`person-profile-modules-and-presentation-architecture.md`](./person-profile-modules-and-presentation-architecture.md)  
**Auditoría de entorno:** [`person-video-local-environment-audit.md`](./person-video-local-environment-audit.md)

---

## Estado del entorno de validación

| Ítem | Estado |
|------|--------|
| Entorno local | No existe (Fase 2A.1) |
| Entorno operativo del proyecto | **Cloud SQL** (`DB_NAME=core`, SSL) vía `.env` del backend |
| Clasificación del destino (2A.2) | **CLOUD_ORGANIGRAMA_VALIDO** |
| ¿Representativo? | **Sí** (schemas `core`+`organigrama`, datos institucionales) |
| Migración 025 | **APLICADA_Y_VALIDADA** |
| Filas en `person_video` tras validación | **0** (pruebas solo con ROLLBACK) |
| `.env` / frontend / Drive / CV / MC1 | Sin cambios en esta fase |

Detalle de auditoría local previa: [`person-video-local-environment-audit.md`](./person-video-local-environment-audit.md).

### Aplicación Cloud controlada (Fase 2A.2)

1. Precheck solo lectura → `MIGRACION_APLICABLE`.
2. Autorización explícita del usuario: `AUTORIZO APLICAR 025 EN CLOUD SQL`.
3. Revalidación: `current_database=core`, `current_user=user-core`, schemas presentes, `person_video` ausente.
4. Aplicación única del SQL sin modificarlo.
5. Post-check estructural OK.
6. Pruebas de integridad en transacción + **ROLLBACK** (con `SAVEPOINT` para violaciones esperadas) → todas OK.
7. Confirmación final: **0 filas** en `person_video`.

No existe registro automático obligatorio en el flujo SQL manual del repo; no se inventó entrada en `public.migrations` (TypeORM). Queda documentado aquí el checksum y el resultado.

### Constraints e índices verificados post-aplicación

**Constraints:** `fk_person_video_person` (ON DELETE RESTRICT), `uq_person_video_drive_file_id`, CHECKs `chk_person_video_*` (document/file_id/file_name/mime nonempty; size ≥ 0), PK.

**Índices:** `uq_person_video_active_person` (UNIQUE parcial `WHERE is_active = true`), `ix_person_video_document`, `ix_person_video_person_active`, más índices de PK/UNIQUE.

### Pruebas transaccionales (todas OK, luego ROLLBACK)

| Prueba | Resultado |
|--------|-----------|
| Insert activo válido | OK |
| Segundo activo bloqueado (23505) | OK |
| Históricos inactivos permitidos | OK |
| Reemplazo (desactivar + insertar) | OK (`active_count=1`) |
| `drive_file_id` duplicado bloqueado (23505) | OK |
| Document vacío/trim bloqueado (23514) | OK |
| Tamaño negativo bloqueado (23514) | OK |
| `person_id` inexistente bloqueado (23503) | OK |
| Rollback final → 0 filas | OK |

---

## 1. Propósito

Almacenar la asociación persona ↔ archivo de video de presentación en Google Drive, con historial de reemplazos, sin binario ni URLs públicas.

La reproducción futura será vía proxy backend + ticket; esta tabla solo guarda metadatos e identidad Drive.

---

## 2. Relación con la arquitectura de módulos

| Capa | Rol |
|------|-----|
| `person_video` | Fuente de verdad de disponibilidad (`is_active`) |
| API futura `GET …/video` | Lee fila activa; emite ticket |
| Stream futuro | Resuelve `drive_file_id` solo en servidor |
| Frontend Presentación | Consume metadatos mínimos; nunca Drive ids |

Fuera de alcance de esta fase: Drive, parser, sync, API, ticket, streaming, UI.

---

## 3. Esquema completo

```sql
organigrama.person_video (
  id                      BIGSERIAL PRIMARY KEY,
  person_id               BIGINT NOT NULL,          -- FK core.person(id) ON DELETE RESTRICT
  document                VARCHAR(80) NOT NULL,
  drive_file_id           VARCHAR(255) NOT NULL,    -- UNIQUE
  drive_file_name         VARCHAR(255) NOT NULL,
  mime_type               VARCHAR(120) NOT NULL,
  drive_modified_time     TIMESTAMPTZ NULL,
  drive_md5_checksum      VARCHAR(64) NULL,
  drive_file_size         BIGINT NULL,
  drive_parent_folder_id  VARCHAR(255) NULL,
  drive_relative_path     TEXT NULL,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

### Justificación de longitudes

| Columna | Tipo | Justificación |
|---------|------|---------------|
| `document` | `VARCHAR(80)` | Igual a `core.person.document` (entity TypeORM `length: 80`) y stub/local `person_cv.document` |
| `drive_file_id` | `VARCHAR(255)` | Igual a `person_cv.drive_file_id` / metadatos migración 012 |
| `drive_file_name` | `VARCHAR(255)` | Igual a `person_cv.drive_file_name` |
| `mime_type` | `VARCHAR(120)` | Igual a `person_cv.mime_type` |
| `drive_md5_checksum` | `VARCHAR(64)` | Igual a `person_cv.drive_md5_checksum` (md5 hex) |
| `drive_parent_folder_id` | `VARCHAR(255)` | Igual a `person_cv.drive_parent_folder_id` |

No se incluyen: binario, `drive_web_url`, URL pública, ticket, duración, poster, transcripción, área, escuela, cargo, jerarquía.

---

## 4. Constraints

| Nombre | Tipo | Definición |
|--------|------|------------|
| `fk_person_video_person` | FK | `person_id → core.person(id) ON DELETE RESTRICT` |
| `uq_person_video_drive_file_id` | UNIQUE | `drive_file_id` |
| `chk_person_video_document_nonempty` | CHECK | `length(trim(document)) > 0` |
| `chk_person_video_drive_file_id_nonempty` | CHECK | `length(trim(drive_file_id)) > 0` |
| `chk_person_video_drive_file_name_nonempty` | CHECK | `length(trim(drive_file_name)) > 0` |
| `chk_person_video_mime_type_nonempty` | CHECK | `length(trim(mime_type)) > 0` |
| `chk_person_video_drive_file_size_nonneg` | CHECK | `drive_file_size IS NULL OR drive_file_size >= 0` |

No hay UNIQUE sobre `document` (permite varios históricos inactivos).

No hay CHECK de MIME (política de formatos en inventario/planner).

---

## 5. Índices

| Nombre | Definición |
|--------|------------|
| `uq_person_video_active_person` | `UNIQUE (person_id) WHERE is_active = TRUE` |
| `ix_person_video_document` | `(document)` |
| `ix_person_video_person_active` | `(person_id, is_active)` |

Más el UNIQUE de tabla sobre `drive_file_id` y el PK sobre `id`.

---

## 6. Política de historial (contrato; sin writer aún)

Cuando una persona reemplaza su video:

1. Iniciar transacción.
2. Localizar (y bloquear con `SELECT … FOR UPDATE` cuando exista writer) el registro activo de esa `person_id`.
3. Desactivar el registro anterior (`is_active = FALSE`, `updated_at = NOW()`).
4. Insertar una fila **nueva** con el nuevo `drive_file_id` y metadatos.
5. Confirmar transacción.

**Prohibido:** sobrescribir destructivamente `drive_file_id`, nombre, checksum, `modifiedTime` o tamaño de una fila histórica.

---

## 7. Política de duplicados (congelada)

- Un mismo `drive_file_id` nunca puede aparecer dos veces (constraint UNIQUE).
- Si el inventario encuentra dos archivos para el mismo documento, **ninguno** se selecciona automáticamente.
- No usar `modifiedTime` como desempate silencioso.
- El planner futuro deberá reportar `DUPLICATE_DOCUMENT`.
- Un duplicado bloquea la activación hasta resolución humana.

---

## 8. Formatos (política de inventario; no CHECK en tabla)

| Formato | Política MVP |
|--------|----------------|
| `.mp4` / `video/mp4` (H.264 + AAC esperado) | Candidato activable principal |
| WebM | Inventariable/reportable; no necesario para piloto |
| MOV / `video/quicktime` | Reportar incompatible; no activar automáticamente |

El codec real no se infiere solo de extensión/MIME; se verificará en diagnóstico posterior.

---

## 9. Timestamps

El proyecto **no** usa triggers globales de `updated_at` en tablas semejantes (p. ej. `mc_profile_evaluation`, `cv_evidence_evaluation`): writers hacen `updated_at = NOW()` explícito.

**Decisión para `person_video`:**

- `created_at`, `updated_at`, `synced_at` con `DEFAULT NOW()`.
- Sin trigger.
- Writers futuros deben actualizar `updated_at` (y `synced_at` en sync) explícitamente.

---

## 10. Mecanismo previsto de aplicación

Cuando exista entorno local representativo (misma familia que Organigrama OP / schema `core` + `organigrama`):

```powershell
# NO ejecutar en esta fase. Ejemplo futuro:
psql ... -v ON_ERROR_STOP=1 -f migrations/025_person_video.sql
```

Convención del repo: SQL manual con `BEGIN`/`COMMIT`; fallo visible si se re-ejecuta (sin `IF NOT EXISTS` en `CREATE TABLE`).

**Rollback manual** (solo sin datos productivos):

```sql
BEGIN;
DROP TABLE IF EXISTS organigrama.person_video;
COMMIT;
```

---

## 11. Estado actual

| Ítem | Estado |
|------|--------|
| Archivo SQL en repo | Sí (`025_person_video.sql`) |
| Aplicada en Cloud SQL (`core`) | **Sí — APLICADA_Y_VALIDADA (2026-08-03)**; sync inicial: **13** filas activas en `person_video` |
| Filas actuales esperadas post-fase | **13** activas (metadatos; sin binario) |
| Drive / sync / API | No implementados |

---

## 12. Consultas de validación futura (NO ejecutar ahora)

Placeholders: `:person_id`, `:document`, `:drive_file_id_*`. Sin documentos ni identidades reales.

### 1) Existencia de tabla

```sql
SELECT to_regclass('organigrama.person_video') AS person_video_regclass;
```

### 2) Columnas

```sql
SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'organigrama'
   AND table_name = 'person_video'
 ORDER BY ordinal_position;
```

### 3) FK

```sql
SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conrelid = 'organigrama.person_video'::regclass
   AND contype = 'f';
```

### 4) Índices

```sql
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'organigrama'
   AND tablename = 'person_video'
 ORDER BY indexname;
```

### 5) Unique parcial

```sql
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'organigrama'
   AND tablename = 'person_video'
   AND indexname = 'uq_person_video_active_person';
-- Esperado: UNIQUE ... (person_id) WHERE (is_active = true)
```

### 6) Inserción válida (transacción + rollback)

```sql
BEGIN;
INSERT INTO organigrama.person_video (
  person_id, document, drive_file_id, drive_file_name, mime_type, is_active
) VALUES (
  :person_id,           -- debe existir en core.person
  :document,            -- p. ej. 'DOC-PLACEHOLDER-001'
  'drive-file-id-valid-001',
  'DOC-PLACEHOLDER-001.mp4',
  'video/mp4',
  TRUE
);
-- Verificar SELECT ... WHERE drive_file_id = 'drive-file-id-valid-001'
ROLLBACK;  -- no dejar datos permanentes
```

### 7) FK inválida

```sql
BEGIN;
INSERT INTO organigrama.person_video (
  person_id, document, drive_file_id, drive_file_name, mime_type
) VALUES (
  -1,  -- person_id inexistente
  'DOC-PLACEHOLDER-001',
  'drive-file-id-fk-fail',
  'x.mp4',
  'video/mp4'
);
-- Esperado: error FK
ROLLBACK;
```

### 8) Segundo activo bloqueado

```sql
BEGIN;
-- Asumir ya existe un activo para :person_id (o insertarlo aquí)
INSERT INTO organigrama.person_video (
  person_id, document, drive_file_id, drive_file_name, mime_type, is_active
) VALUES (
  :person_id,
  :document,
  'drive-file-id-second-active',
  'y.mp4',
  'video/mp4',
  TRUE
);
-- Esperado: violación uq_person_video_active_person
ROLLBACK;
```

### 9) Múltiples históricos inactivos permitidos

```sql
BEGIN;
INSERT INTO organigrama.person_video (
  person_id, document, drive_file_id, drive_file_name, mime_type, is_active
) VALUES
  (:person_id, :document, 'drive-file-hist-001', 'a.mp4', 'video/mp4', FALSE),
  (:person_id, :document, 'drive-file-hist-002', 'b.mp4', 'video/mp4', FALSE),
  (:person_id, :document, 'drive-file-hist-003', 'c.mp4', 'video/mp4', TRUE);
-- Esperado: OK
ROLLBACK;
```

### 10) `drive_file_id` duplicado bloqueado

```sql
BEGIN;
INSERT INTO organigrama.person_video (
  person_id, document, drive_file_id, drive_file_name, mime_type, is_active
) VALUES
  (:person_id, :document, 'drive-file-dup', 'a.mp4', 'video/mp4', FALSE);
INSERT INTO organigrama.person_video (
  person_id, document, drive_file_id, drive_file_name, mime_type, is_active
) VALUES
  (:person_id, :document, 'drive-file-dup', 'b.mp4', 'video/mp4', FALSE);
-- Esperado: violación uq_person_video_drive_file_id
ROLLBACK;
```

### 11) Checks de campos vacíos

```sql
BEGIN;
INSERT INTO organigrama.person_video (
  person_id, document, drive_file_id, drive_file_name, mime_type
) VALUES (:person_id, '   ', 'drive-empty-doc', 'a.mp4', 'video/mp4');
-- Esperado: chk_person_video_document_nonempty
ROLLBACK;
```

### 12) Tamaño negativo bloqueado

```sql
BEGIN;
INSERT INTO organigrama.person_video (
  person_id, document, drive_file_id, drive_file_name, mime_type, drive_file_size
) VALUES (
  :person_id, :document, 'drive-neg-size', 'a.mp4', 'video/mp4', -1
);
-- Esperado: chk_person_video_drive_file_size_nonneg
ROLLBACK;
```

### 13) Reemplazo transaccional (patrón)

```sql
BEGIN;
UPDATE organigrama.person_video
   SET is_active = FALSE, updated_at = NOW()
 WHERE person_id = :person_id AND is_active = TRUE;

INSERT INTO organigrama.person_video (
  person_id, document, drive_file_id, drive_file_name, mime_type, is_active
) VALUES (
  :person_id, :document, 'drive-file-replacement', 'new.mp4', 'video/mp4', TRUE
);
-- Verificar: un solo is_active = TRUE; fila anterior conservada inactiva
ROLLBACK;
```

### 14) Rollback sin datos permanentes

Todas las inserciones de prueba anteriores terminan en `ROLLBACK`. Tras la sesión:

```sql
SELECT count(*) FROM organigrama.person_video
 WHERE drive_file_id LIKE 'drive-file-%' OR drive_file_id LIKE 'drive-%';
-- Esperado: 0 filas de prueba
```

---

## 13. Riesgos pendientes

1. Aplicar solo cuando exista BD con `core.person` real (FK).
2. Re-ejecución sin `IF NOT EXISTS` fallará a propósito — correcto.
3. Writers deben respetar historial (nunca UPDATE de identidad Drive en fila histórica).
4. Duplicados de documento en Drive quedan fuera de la DB hasta el planner (`DUPLICATE_DOCUMENT`).
5. Nombre de migración `025` asume que `024_login_apps_organigrama.sql` sigue siendo la última previa.
