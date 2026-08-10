# Writer controlado — `organigrama.person_video` (Fase 2D)

**Estado:** **IMPLEMENTADA_PENDIENTE_APPLY** (soporte incremental 2026-08-05)  
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

## 2. Carga inicial vs sincronización incremental

| | Carga inicial (2026-08-03) | Incremental |
|--|--|--|
| Inventario | Completo (p. ej. 14) | Completo o filtrado `--document=` |
| `personVideoRowsBefore` | 0 | N ≥ 0 (estado live al planificar) |
| NEW | Cualquier N ≥ 1 coherente con el plan | Igual |
| Tabla poblada | Solo si snapshot = 0 | Permitida si `liveRowCount === personVideoRowsBefore` |

**Ya no existen** expectativas fijas globales `14 / 13 / 1 / 0`. El apply valida coherencia **derivada del propio plan** y un **snapshot live** de `person_video`.

---

## 3. Políticas

- **NEW:** INSERT activo (metadatos) — única acción que escribe este writer.
- **REPLACE / METADATA_CHANGED:** código preparado; **bloqueados** en validación de apply.
- **INVALID_NAME / NO_CHANGE / REPORT_ONLY:** permitidos en el plan; no escriben.
- Otras acciones de bloqueo en el plan → rechazan el apply completo.

---

## 4. Validaciones derivadas del plan

Antes de cualquier escritura:

1. `inventoryTotal === items.length`
2. `summary.byAction[action] ===` conteo real por acción
3. Agregados: `validNames`, `invalidNames`, `personsFound`, `blockedOrReportOnly`, `writableWouldBe.*`
4. `personVideoRowsBefore` / `After` enteros ≥ 0; dry-run ⇒ `After === Before`
5. Al menos un `NEW` (`NO_WRITABLE_NEW` si 0 — idle, no destructivo)
6. Integridad de cada NEW (campos, `video/mp4`, `SUPPORTED_MVP`, sin dupes, sin URLs públicas)
7. Destino estable: `database === 'core'`
8. SHA-256 del plan crudo en precheck / apply summary (inmutabilidad del archivo; no sustituye el snapshot)

---

## 5. Snapshot live

```text
liveRowCount === plan.summary.personVideoRowsBefore
```

Si diverge → `PLAN_SNAPSHOT_STALE` (solo conteos, sin PII).  
Obliga a **regenerar el plan**; no se ajusta el JSON automáticamente.

---

## 6. Precheck por cada NEW

SELECT: persona existe, activa, documento exacto, no vacante, sin video activo, `drive_file_id` libre; tabla/constraints OK.  
Elegibles debe igualar `newItems.length`. Cualquier fallo bloquea todo el apply (sin inserts parciales).

---

## 7. Idempotencia

| Escenario | Resultado |
|-----------|-----------|
| Plan parcial 1 NEW válido | `READY_FOR_AUTHORIZATION` |
| Apply de ese plan | INSERT N; filas before→before+N |
| Re-sync del mismo plan | `PLAN_SNAPSHOT_STALE` / activo / fileId ligado — 0 escrituras |
| Re-plan tras apply | `NEW=0` → `NO_WRITABLE_NEW` (exit 0) |
| Plan completo inicial | Válido solo si el snapshot coincide con el estado para el que se generó |

---

## 8. Primera ejecución masiva (histórico)

Autorización: `AUTORIZO EJECUTAR LA SINCRONIZACIÓN INICIAL DE VIDEOS EN CLOUD SQL`

| Campo | Valor |
|-------|-------|
| Plan hash | `9f569c9000532233d9cfa387a85d308309bf6cc104f30f201147dd28e3228647` |
| Antes → después | **0 → 13** |
| Insertados | **13** |
| Omitidos INVALID_NAME | **1** |

Ese plan histórico sigue siendo válido **solo** si `person_video` vuelve al estado del snapshot (p. ej. 0 filas). Con 13 filas actuales, el mismo JSON debe bloquearse.

---

## 9. CLI — sync puntual por documento

```powershell
# Inventario (si hace falta refrescar Drive readonly)
npm run diag:drive-video

# Plan parcial
npm run plan:drive-video -- --document=1000810767

# Precheck sin escritura
npm run sync:drive-video -- --plan=tmp/person-video-drive-plan/plan.private.json

# Apply (solo tras READY_FOR_AUTHORIZATION y autorización explícita)
npm run sync:drive-video -- --plan=tmp/person-video-drive-plan/plan.private.json --execute --confirm-cloud-video-sync
```

No existe `--skip-validation`.

---

## 10. Pruebas unitarias

`npm test -- --testPathPatterns=drive-video` — sin escritura Cloud en CI unitaria.
