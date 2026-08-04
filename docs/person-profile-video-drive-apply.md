# Writer controlado — `organigrama.person_video` (Fase 2D)

**Estado:** **APLICADA_Y_VALIDADA** (2026-08-03)  
**Plan fuente:** [`person-profile-video-drive-plan.md`](./person-profile-video-drive-plan.md)  
**Arquitectura:** [`person-profile-modules-and-presentation-architecture.md`](./person-profile-modules-and-presentation-architecture.md)  
**API de lectura (Fase 3A):** [`person-profile-video-api.md`](./person-profile-video-api.md) — `GET /api/org-chart/person/:personId/video`

---

## 1. Separación planner / writer

| Capa | Comando | Efecto |
|------|---------|--------|
| Planner | `plan:drive-video` | Solo SELECT + plan JSON |
| Writer | `sync:drive-video` | Valida plan + precheck; escribe solo con flags dobles |

El writer **no** consulta Google Drive.

---

## 2. Políticas

- **NEW:** INSERT activo (metadatos).
- **REPLACE:** deactivate + INSERT (código listo; no usado en 1ª ejecución).
- **METADATA_CHANGED:** UPDATE in-place mismo `drive_file_id`.
- **INVALID_NAME:** omitir; no renombrar Drive.

---

## 3. Primera ejecución (autorizada)

Autorización: `AUTORIZO EJECUTAR LA SINCRONIZACIÓN INICIAL DE VIDEOS EN CLOUD SQL`

Comando:

```powershell
npm run sync:drive-video -- --execute --confirm-cloud-video-sync
```

| Campo | Valor |
|-------|-------|
| Plan hash | `9f569c9000532233d9cfa387a85d308309bf6cc104f30f201147dd28e3228647` |
| Transacción | **COMMIT** |
| Antes → después | **0 → 13** |
| Insertados | **13** |
| Omitidos INVALID_NAME | **1** |
| UPDATE/DELETE/REPLACE | **0** |
| Activas / inactivas | **13 / 0** |
| Personas / fileIds distintos | **13 / 13** |
| Filas del fileId inválido | **0** |

### Idempotencia

- Re-`sync` del mismo plan → **BLOCKED** (tabla no vacía; activos; fileIds vinculados).
- Re-`plan` → **NEW=0**; 13 ítems ya no son NEW; `INVALID_NAME=1`; filas estables en 13.

Reportes: `tmp/person-video-drive-apply/apply-summary.json`, `apply.private.json`.

---

## 4. CLI

```powershell
npm run sync:drive-video -- --json
npm run sync:drive-video -- --execute --confirm-cloud-video-sync
```

---

## 5. Pruebas unitarias

`npm test -- --testPathPatterns=drive-video` → 39 passed (sin Cloud).
