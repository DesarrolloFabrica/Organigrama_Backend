# Política de versionamiento MC1 — dominios, mapping packs y PA2

**Fase:** MC1.6.1B.2  
**Estado:** normativa operativa (obligatoria antes de hermanos Visual / 3er dominio)

---

## 1. Principios

1. Las evaluaciones históricas **nunca** se actualizan in-place (métricas/resultados).
2. Una nueva evaluación = **nuevo registro**; la anterior deja de ser vigente (`is_active=false`).
3. Toda evaluación debe identificar de forma inequívoca:
   - evidencia (`source_hash`)
   - catálogo (`catalog_version_id` / version)
   - mapping pack (`mapping_pack_code` + `mapping_pack_version` + `mapping_hash`)
   - regla PA2 (`engine_rules_version` + `config_hash`)
   - algoritmo (`algorithm_version`)
   - contexto compuesto (`evaluation_context_hash`)
4. **Nunca** mutar un pack o una regla ya publicada con el mismo identificador de versión.

---

## 2. Cómo nace un dominio

1. Definir dominio + especialidades en la definición de catálogo (nueva `MC_CATALOG_VERSION`).
2. Seed catálogo (`mc:catalog --seed --activate`).
3. Crear mapping pack + `packCode` + `mappingRulesVersion` y registrarlo.
4. Publicar release en `mc_mapping_pack_release` (vía seed mappings).
5. Crear regla PA2 `pa2-<dominio>-x.y.z` + fingerprint congelado.
6. Evaluar semilla con `--dry-run` → `--i-confirm-evaluate`.
7. Tests de pack/hash/API/FE (orden radar).

---

## 3. Mapping pack — ciclo de vida

Tabla: `organigrama.mc_mapping_pack_release`

| Estado | Significado |
|--------|-------------|
| **DRAFT** | Borrador (reserva; no usar en prod aún) |
| **PUBLISHED** | Inmutable. Mismo `(pack_code, pack_version)` ⇒ mismo `content_hash` |
| **RETIRED** | No se puede reseedar ni usar para nuevas evaluaciones |

### Publicación

Al hacer `mc:mappings --seed`:

- Si no existe release → se crea `PUBLISHED` con hash del pack.
- Si existe y el hash coincide → OK (idempotente).
- Si existe y el hash **difiere** → **ERROR**. Crear nueva `pack_version`.

### Convención de nombres

| Dominio | pack_code | Ejemplo version |
|---------|-----------|-----------------|
| SOFTWARE | `software-mappings` | `mc1.1-camilo-2026-07-27` |
| VISUAL_DESIGN | `visual-design-mappings` | `mc1.6-visual-nidia-2026-07-27` |

---

## 4. Cuándo crear una nueva versión de pack

Crear **nueva** `pack_version` si cambia:

- un mapping (skill ↔ specialty)
- un peso
- un `mappingType`
- una clasificación / exclusión
- el conjunto de skills del pack

No crear versión nueva por:

- comentarios / rationale cosmético (si no entra al hash)
- rename visible de skill name (el hash usa `skillKey`/`skillType`)

---

## 5. Versionamiento PA2

### Identificadores

| Campo | Ejemplo | Rol |
|-------|---------|-----|
| `engine_rules_version` | `pa2-visual-design-1.0.0` | Label de regla de negocio |
| `algorithm_version` | `pa2-algo-lexico-v1` | Implementación del ranking |
| `config_hash` | sha256(config) | Umbrales/pesos de la regla |
| algorithm fingerprint | sha256(algo+criterios) | Congela orden lexico |

### Política de bump

| Cambio | Tipo | Acción |
|--------|------|--------|
| Logging, validación extra, refactor sin cambio semántico | **PATCH** | Mismo rule + algorithm; actualizar docs |
| Desempate, orden lexico, tratamiento tools, umbral ACTIVE | **MINOR** | Nuevo `pa2-…-x.(y+1).0` + nuevo fingerprint |
| Fórmula strength/coverage, modelo de especialidades incompatible | **MAJOR** | Nuevo `pa2-…-(x+1).0.0` y/o nuevo `algorithm_version` |

Fingerprints publicados viven en `mc-pa2.algorithm.ts` como **constantes**.  
Si el código de config diverge del fingerprint → `assertMcPa2RuleFingerprint` **falla**.

---

## 6. Reevaluar personas

1. Dry-run con `--rules-version` y dominio explícitos.
2. Comparar default / ACTIVE / EMERGENT / métricas / hashes de mapping+config.
3. Persist con `--i-confirm-evaluate`.
4. La evaluación previa del mismo `person_id + domain_code` pasa a `is_active=false`.
5. Resultados históricos y specialty_result **permanecen**.

---

## 7. Auditar una evaluación histórica

Servicio: `McPa2Service.reportHistoricalContext(evaluationId)`

Estados:

- `context_complete` — columnas de contexto persistidas
- `context_partially_reconstructible` — faltan columnas pero se pueden reconstruir sin ambigüedad
- `context_incomplete` — no hay relación inequívoca

API producto sigue devolviendo solo la **vigente**; el audit opcional incluye pack/source/algorithm/context cuando existen.

---

## 8. Qué nunca modificar in-place

- Filas de `mc_profile_evaluation` SUCCEEDED (métricas/resultados)
- `mc_profile_specialty_result` de evaluaciones finalizadas
- Pack `PUBLISHED` (mismo code+version)
- Fingerprint de una regla publicada
- Criterios de `pa2-algo-lexico-v1` sin bump de algorithm

---

## 9. Ejemplo Visual Design v1 → v2

```text
visual-design-mappings @ mc1.6-visual-nidia-2026-07-27
pa2-visual-design-1.0.0  +  pa2-algo-lexico-v1
        ↓
evaluación Nidia #3  (vigente → luego histórica)
  source_hash = 467d7dbe…f86f3a6
  mapping_pack_version = mc1.6-visual-nidia-2026-07-27
  evaluation_context_hash = <sha256>

Hermanos / refinamiento:
  → nuevo pack mc1.6.1-visual-siblings-…
  → opcional pa2-visual-design-1.1.0 si cambian umbrales
        ↓
nueva evaluación Nidia #N (vigente)
        ↓
#3 permanece histórica (is_active=false), consultable en BD / reportHistoricalContext
```

---

## 10. OUTSIDE_SOFTWARE_DOMAIN

Enum legacy en clasificaciones. Semántica real = “fuera del dominio evaluado”.  
**No renombrado en MC1.6.1B.2** (riesgo de constraint DB + seeds).  
Pendiente P1 antes del 3er dominio: generalizar a `OUTSIDE_DOMAIN` con migración de constraint + dual-read.
