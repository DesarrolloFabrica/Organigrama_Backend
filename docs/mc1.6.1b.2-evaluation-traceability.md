# MC1.6.1B.2 — Trazabilidad y reproducibilidad del motor MC1

**Fecha:** 2026-07-27  
**Modo:** migración aditiva + backfill metadatos · **sin recalibrar PA2** · **sin hermanos** · **sin nuevos dominios**

Política: [`docs/mc1-domain-versioning-policy.md`](./mc1-domain-versioning-policy.md)

---

## 1. Resumen ejecutivo

Se fortaleció la trazabilidad de cada evaluación PA2 para identificar de forma inequívoca: evidencia (`source_hash`), mapping pack (`code`+`version`+hash), regla, algoritmo y `evaluation_context_hash`.

**Resultados funcionales intactos:**

| Persona | Dominio | Principal | Estado |
|---------|---------|-----------|--------|
| Camilo (#4) | SOFTWARE | SOFTWARE_BACKEND | idéntico en dry-run |
| Nidia (#3) | VISUAL_DESIGN | VISUAL_GRAPHIC | idéntico (1/2/2) |
| Johan (#2) | — | — | NOT_EVALUATED |

---

## 2. Preflight

Integridad: `dup_active=0`, `no_results=0`, `null_hashes=0` (campos previos).

| Eval | Activa | Regla | mapping_hash | source (ext=enr) |
|------|--------|-------|--------------|------------------|
| 1 | no | pa2-software-1.0.0 | c58af992… | aeee9c55… |
| 2 | no | pa2-software-1.1.0 | c58af992… | aeee9c55… |
| 3 | **sí** | pa2-visual-design-1.0.0 | bc29810c… | 467d7dbe… |
| 4 | **sí** | pa2-software-1.1.0 | c58af992… | aeee9c55… |

Artefacto: `tmp/mc161b2-preflight.json`

---

## 3. Esquema anterior

`mc_profile_evaluation` tenía `engine_rules_version`, `config_hash`, `mapping_hash` — sin pack version, sin source_hash, sin algorithm_version, sin context hash. Packs solo en código.

---

## 4. Esquema nuevo

### Tabla `mc_mapping_pack_release`

`(pack_code, pack_version)` único + `content_hash` + status `DRAFT|PUBLISHED|RETIRED`.

### Columnas nuevas en `mc_profile_evaluation` (nullable → backfill)

- `mapping_pack_code`
- `mapping_pack_version`
- `source_hash`
- `algorithm_version`
- `evaluation_context_hash`

---

## 5. Migración

Archivo: `migrations/021_mc_evaluation_context.sql`  
Script: `npm run mc:migrate-021 -- --i-confirm-migrate`  
Aplicada Cloud: **OK** (`tmp/mc161b2-migration.json`)  
Reversible: DROP COLUMN / DROP TABLE documentado en el SQL.

---

## 6. Backfill

| Evaluation ID | Persona | Dominio | Pack | Source hash | Acción |
|---------------|---------|---------|------|-------------|--------|
| 1 | Camilo | SOFTWARE | RECONSTRUIBLE | RECONSTRUIBLE | BACKFILL |
| 2 | Camilo | SOFTWARE | RECONSTRUIBLE | RECONSTRUIBLE | BACKFILL |
| 3 | Nidia | VISUAL_DESIGN | RECONSTRUIBLE | RECONSTRUIBLE | BACKFILL |
| 4 | Camilo | SOFTWARE | RECONSTRUIBLE | RECONSTRUIBLE | BACKFILL |

Todos `context_complete` tras backfill. **No** se tocáron métricas ni specialty_result.

---

## 7. Pack versioning

| pack_code | pack_version | content_hash |
|-----------|--------------|--------------|
| software-mappings | mc1.1-camilo-2026-07-27 | c58af992…5549911 |
| visual-design-mappings | mc1.6-visual-nidia-2026-07-27 | bc29810c…ff0ed3a |

Seed falla si mismo version + hash distinto (`publishOrAssertPackRelease`).

---

## 8. PA2 algorithm versioning

| Regla | algorithm_version | config_hash congelado |
|-------|-------------------|------------------------|
| pa2-software-1.0.0 | pa2-algo-weighted-v1 | 0ee343d7… |
| pa2-software-1.1.0 | pa2-algo-lexico-v1 | c61ad54a… |
| pa2-visual-design-1.0.0 | pa2-algo-lexico-v1 | 1ed2a80a… |

`assertMcPa2RuleFingerprint` bloquea mutación silenciosa.

---

## 9. Hashes

- `mapping_hash` / `config_hash`: **sin cambio** (dry-run ≡ persistido).
- `evaluation_context_hash`: nuevo, determinista (tests).
- Nidia context: `4b45a9bfae0906914c2c18d1686954b79b159273b1b5c221d90f8a967d7f319c`
- Camilo #4 context: `e110d73e03cf8cce0d5b5c35dde5d2a030a0bf874d93d262017680af25398b35`

---

## 10–11. Camilo / Nidia antes/después

Dry-run post-cambio ≡ artefactos persistidos previos (`camiloIdentical=true`, `nidiaIdentical=true`).

---

## 12. Históricas conservadas

Eval #1 y #2 siguen existiendo, `is_active=false`, resultados intactos, ahora con metadatos de contexto.

---

## 13. Tests

`mc-evaluation-context.spec` + engine/visual/competencies → **48 passed**.

---

## 14. Builds

`nest build` OK.

---

## 15. Archivos modificados (principales)

- `migrations/021_mc_evaluation_context.sql`
- `mc-pa2.algorithm.ts`, `mc-evaluation-context.ts` (+spec)
- `mc-pa2.service.ts`, `mc-catalog.mapping.service.ts`, `mapping-registry.ts`
- entities + `app.module.ts` + API audit DTO
- scripts migrate/backfill/preflight
- `docs/mc1-domain-versioning-policy.md`
- este informe

---

## 16. Riesgos pendientes

| Ítem | Pri |
|------|-----|
| `OUTSIDE_SOFTWARE_DOMAIN` no renombrado | P1 (3er dominio) |
| Registry de packs aún en código | P1 |
| Orden radar FE hardcodeado | P1 |
| Fingerprint lexico no versiona el bytecode del comparador más allá del descriptor de criterios | P2 aceptable |

---

## 17. Veredicto

**APROBADO.**

> Cada evaluación de MC1 identifica de forma inequívoca la evidencia, el catálogo, el mapping pack, la regla, el algoritmo y la configuración exacta con los que fue calculada.
