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
| Writer (futuro 2D) | TBD con `--i-confirm-apply` | Transacciones controladas |

No se reconsulta Drive de forma obligatoria en el planner.

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
```

Rechaza `--apply` / `--execute` / flags de escritura.

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

## 10. Writer (Fase 2D) y bloqueos residuales

Writer documentado en [`person-profile-video-drive-apply.md`](./person-profile-video-drive-apply.md).

Plan real aceptado para la primera aplicación:

- **13 NEW**
- **1 INVALID_NAME** omitido (no bloquea NEW; renombre Drive pendiente)

Flags de escritura: `--execute --confirm-cloud-video-sync` (ambos).

Políticas ya congeladas en 2D:

- `METADATA_CHANGED` → UPDATE in-place del mismo `drive_file_id`
- `REPLACE` → deactivate + insert (fuera del alcance de la 1ª ejecución)
- `INVALID_NAME` → omitir

Pendiente humano: ~~autorización explícita para ejecutar el apply~~ **hecho** — ver [`person-profile-video-drive-apply.md`](./person-profile-video-drive-apply.md) (**APLICADA_Y_VALIDADA**, 13 filas activas).
