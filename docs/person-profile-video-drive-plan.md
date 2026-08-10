# Planner dry-run — videos de presentación (Drive × Core × person_video)

**Fase:** 2C  
**Estado:** **IMPLEMENTADA_Y_EJECUTADA** (2026-08-03)  
**Inventario fuente:** [`person-profile-video-drive-inventory.md`](./person-profile-video-drive-inventory.md)  
**Persistencia:** [`person-profile-video-persistence.md`](./person-profile-video-persistence.md)

---

## 1. Propósito

Cruzar el inventario local de Drive (`inventory.private.json`) con:

- `core.person.document` (match exacto, string);
- `organigrama.person_video` (estado actual);

para producir un **plan dry-run** de acciones futuras **sin escribir** en PostgreSQL ni en Drive.

---

## 2. Separación inventario / planner / writer

| Capa | Comando | I/O |
|------|---------|-----|
| Inventario Drive | `diag:drive-video` | Solo Drive readonly → JSON en `tmp/` |
| Planner | `plan:drive-video` | Lee JSON + **SELECT** Cloud → plan en `tmp/` |
| Writer (2D) | `sync:drive-video` | Valida plan + snapshot live; escribe solo NEW con flags dobles |

No se reconsulta Drive de forma obligatoria en el planner.

**Planes parciales:** `--document=<doc>` limita el inventario cargado (p. ej. un único video nuevo). El summary refleja ese subconjunto (`inventoryTotal`, `NEW`, `personVideoRowsBefore` = filas live al planificar).

---

## 3. Fuente del inventario

Default:

`tmp/person-video-drive-inventory/inventory.private.json`

Validación previa: `items[]` con `driveFileId`, `driveFileName`, `document`, `mimeType`, `formatClass`, `relativePath`, `size`, `md5Checksum`, `modifiedTime`, `validName`, etc. Si es inválido o vacío → aborta.

---

## 4. Cruce por documento

1. Documento del parser como **string** (sin `Number()`, sin quitar ceros).
2. `WHERE p.document = ANY($1::text[])` exacto.
3. Política activa: `core.person.is_active`.
4. Vacantes: misma regla que Organigrama (`isVacancyPerson` / rol / `VAC-%` / nombre `VACANTE…`).

No usa nombre, correo, área, escuela, rol (salvo vacancy), cargo, ruta ni jerarquía para el match.

---

## 5. Acciones

`NEW`, `NO_CHANGE`, `REPLACE`, `METADATA_CHANGED`, `DUPLICATE_DOCUMENT`, `DRIVE_FILE_ALREADY_LINKED`, `PERSON_NOT_FOUND`, `PERSON_MATCH_MULTIPLE`, `PERSON_INACTIVE`, `VACANCY_NOT_ELIGIBLE`, `INVALID_NAME`, `UNSUPPORTED_FORMAT`, `MIME_EXTENSION_MISMATCH`, `REPORT_ONLY`.

Criterio contenido vs activo:

- mismo `drive_file_id` + checksum (o size+modifiedTime) + meta estable → `NO_CHANGE`;
- mismo `drive_file_id` + meta distinta → `METADATA_CHANGED` (writer futuro: UPDATE vs historial — **pendiente**);
- distinto `drive_file_id` con activo → `REPLACE` (deactivate + insert en transacción futura).

Casos ambiguos **nunca** generan escritura automática.

---

## 6. Privacidad

| Archivo | Contenido |
|---------|-----------|
| `tmp/person-video-drive-plan/summary.json` | Solo métricas agregadas |
| `tmp/person-video-drive-plan/plan.private.json` | document, personId, drive ids, rutas, acciones (gitignored vía `tmp/`) |

Consola: documentos enmascarados. Sin nombres, correos, teléfonos, URLs Drive, tokens.

---

## 7. CLI

```powershell
npm run plan:drive-video -- --help
npm run plan:drive-video -- --json --show-new --show-errors
npm run plan:drive-video -- --inventory=tmp/person-video-drive-inventory/inventory.private.json
# Plan puntual (incremental)
npm run plan:drive-video -- --document=1000810767
```

Rechaza `--apply` / `--execute` / flags de escritura.

Tras un apply, regenerar el plan es **obligatorio** antes de otro sync: el snapshot (`personVideoRowsBefore`) y las acciones (`NEW` → `NO_CHANGE`) deben reflejar la BD actual.

---

## 8. Pruebas

```powershell
npm test -- --testPathPatterns=drive-video --runInBand
```

Cubren NEW/NO_CHANGE/REPLACE/METADATA_CHANGED, matches de persona, vacante, inválidos, duplicados, formatos, carga de inventario, summary dry-run. **Sin PostgreSQL** en unit tests.

---

## 9. Resultado real del dry-run (2026-08-03)

| Métrica | Valor |
|---------|------:|
| Base | `core` / `user-core` (Cloud) |
| Videos procesados | 14 |
| Nombres válidos / inválidos | 13 / 1 |
| Personas con `personId` | 13 |
| PERSON_NOT_FOUND | 0 |
| PERSON_MATCH_MULTIPLE | 0 |
| PERSON_INACTIVE | 0 |
| VACANCY_NOT_ELIGIBLE | 0 |
| NEW | **13** |
| NO_CHANGE / REPLACE / METADATA_CHANGED | 0 |
| INVALID_NAME | **1** |
| `person_video` antes / después | **0 / 0** |

El archivo inválido (nombre solo dígitos sin extensión) tiene hint operativo `NNNN-presentacion.mp4` en el plan privado; **no** se renombró en Drive.

---

## 10. Writer (Fase 2D) — inicial e incremental

Writer documentado en [`person-profile-video-drive-apply.md`](./person-profile-video-drive-apply.md).

El apply **ya no** acopla métricas fijas del dry-run inicial (14/13/1/0). Valida coherencia del plan + snapshot live de `person_video`.

Plan histórico de la primera aplicación (válido solo en el estado en que se generó):

- **13 NEW** + **1 INVALID_NAME** con `personVideoRowsBefore=0`

Flags de escritura: `--execute --confirm-cloud-video-sync` (ambos). Sin bypass de validación.

Políticas 2D:

- Solo **NEW** escribe en esta versión del CLI
- `METADATA_CHANGED` / `REPLACE` → bloqueados en validación (código writer preparado, no autorizado aún)
- `INVALID_NAME` → omitir
- `NEW=0` tras re-plan → `NO_WRITABLE_NEW` (idle)

Estado tabla tras carga inicial: **13** activos. Syncs posteriores son incrementales (regenerar plan).
