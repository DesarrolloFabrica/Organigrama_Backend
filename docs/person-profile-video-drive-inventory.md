# Inventario diagnóstico Drive — videos de presentación

**Fase:** 2B  
**Estado:** **IMPLEMENTADA_Y_EJECUTADA** (2026-08-03)  
**Arquitectura:** [`person-profile-modules-and-presentation-architecture.md`](./person-profile-modules-and-presentation-architecture.md)  
**Persistencia:** [`person-profile-video-persistence.md`](./person-profile-video-persistence.md) (`person_video` existe; **0 escrituras** en esta fase)  
**Planner dry-run (Fase 2C):** [`person-profile-video-drive-plan.md`](./person-profile-video-drive-plan.md) — el inventario de esta fase fue la fuente del cruce real.  
**Writer (Fase 2D):** [`person-profile-video-drive-apply.md`](./person-profile-video-drive-apply.md) — carga inicial **APLICADA_Y_VALIDADA** (13 NEW); apply incremental seguro (validación derivada del plan + snapshot live; sin métricas fijas 14/13/1/0).

---

## 1. Objetivo

Inventariar de forma recursiva y de **solo lectura** los archivos bajo la carpeta raíz de videos en Google Drive, clasificar formatos y validar nombres según el contrato de documento al inicio del filename.

No escribe PostgreSQL, no modifica Drive, no descarga binarios, no implementa planner/API/streaming/UI.

---

## 2. Arquitectura

```text
GOOGLE_DRIVE_VIDEO_FOLDER_ID / --folderId
        │
        ▼
OAuth readonly (mismo token que CV: GOOGLE_DRIVE_CV_TOKEN_PATH)
        │
        ▼
BFS + paginación + Shared Drive (listVideoFolderChildren)
        │
        ▼
parseDriveVideoFileName + classifyDriveVideoFormat
        │
        ▼
tmp/person-video-drive-inventory/
  summary.json
  inventory.private.json   ← gitignored (tmp/)
```

### Reutilizado del flujo CV (sin modificar el pipeline CV)

| Pieza | Uso |
|-------|-----|
| `createDriveCvClient` | Auth OAuth readonly |
| `getDriveFolderMeta` | Nombre de carpeta raíz |
| `DRIVE_FOLDER_MIME` | Detectar carpetas |
| `GOOGLE_DRIVE_CV_TOKEN_PATH` | Token existente |

### Específico de video (separado)

| Archivo | Rol |
|---------|-----|
| `drive-video-document.ts` | Parser de nombre |
| `drive-video-format.ts` | Clasificación MIME/ext |
| `drive-video-inventory.ts` | BFS + agregados |
| `drive-video-cli-args.ts` | Args CLI |
| `drive-video-types.ts` | Tipos reporte |
| `diag-drive-video.ts` | Entrypoint CLI |

No se reutiliza el parser `dígitos.pdf`, ni writers/`person_cv`, ni `webViewLink` en el reporte.

---

## 3. Parser

Regla:

```regex
^(\d+)(?:[-_].+)?\.(mp4|webm|mov)$
```

(case-insensitive en extensión; `trim` del nombre)

Resultado:

| Campo | Significado |
|-------|-------------|
| `document` | Grupo 1 como **string** (sin `Number()`) |
| `extension` | `mp4` \| `webm` \| `mov` en minúsculas |
| `validName` | boolean |
| `reason` | `null` \| `EMPTY_NAME` \| `INVALID_PATTERN` |

La carpeta / área / escuela **no** intervienen.

---

## 4. Formatos

| Clase | Criterio |
|-------|----------|
| `SUPPORTED_MVP` | `.mp4` / `video/mp4` |
| `INVENTORY_ONLY` | `.webm` / `video/webm` |
| `INCOMPATIBLE_MVP` | `.mov` / quicktime / otros `video/*` |
| `NON_VIDEO` | resto |

También se marca `mimeExtensionInconsistent` cuando MIME `video/*` y extensión no coinciden.

---

## 5. Duplicados

Si dos o más **videos** tienen el mismo `document` con nombre válido:

- se agrupan en `duplicateDocuments`;
- **no** se elige ganador;
- el planner futuro deberá emitir `DUPLICATE_DOCUMENT`.

---

## 6. CLI

```powershell
npm run diag:drive-video -- --help
npm run diag:drive-video -- --folderId=1uaFSvbaNVvCnZ4tVI4JHzquoTnZrA0Ah
npm run diag:drive-video -- --folderId=... --json --show-invalid --show-duplicates
npm run diag:drive-video -- --max-items=50
```

Variable opcional: `GOOGLE_DRIVE_VIDEO_FOLDER_ID` (alternativa a `--folderId`).

**No existe `--apply`.**

Autenticación: misma cuenta OAuth readonly de hojas de vida. Si 403 → detener; no probar otras credenciales.

---

## 7. Reportes

Directorio: `tmp/person-video-drive-inventory/` (cubierto por `tmp/` en `.gitignore`)

| Archivo | Contenido |
|---------|-----------|
| `summary.json` | Conteos y metadatos de raíz (sin listado completo) |
| `inventory.private.json` | Items con document, fileId, nombre, ruta, mime, size, checksum, modifiedTime, clasificación |

---

## 8. Resultado del diagnóstico ejecutado

| Campo | Valor |
|-------|-------|
| Fecha (UTC) | 2026-08-03T20:17:23.359Z |
| Carpeta raíz | `VideosPresentacion_Organigrama` |
| Folder ID | `1uaFSvbaNVvCnZ4tVI4JHzquoTnZrA0Ah` |
| Carpetas visitadas | **16** |
| Archivos (no carpeta) | **14** |
| Videos | **14** |
| SUPPORTED_MVP (mp4) | **14** |
| webm / mov / non-video | **0** |
| Nombres válidos | **13** |
| Nombres inválidos | **1** (archivo video sin patrón `dígitos…ext`, p. ej. solo cédula sin extensión) |
| Documentos únicos | **13** |
| Grupos duplicados | **0** |
| MIME/ext inconsistentes | **0** |
| Truncado | no |
| PostgreSQL | **no consultado** |
| Escritura Drive | **ninguna** |
| Escritura `person_video` | **ninguna** |

---

## 9. Comandos de prueba unitaria

```powershell
npm test -- --testPathPatterns=drive-video --runInBand
```
