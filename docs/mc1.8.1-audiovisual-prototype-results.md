# MC1.8.1 — Resultados del prototipo · Producción Audiovisual

**Fecha:** 2026-07-28  
**Dominio:** `AUDIOVISUAL_PRODUCTION`  
**Plan:** [`mc1.8.1-audiovisual-prototype-plan.md`](mc1.8.1-audiovisual-prototype-plan.md)

---

## 1. Implementación realizada

| Componente | Artefacto | Versión / hash |
|------------|-----------|----------------|
| Catálogo MC1 | `mc1-domains` | `mc1.8-2026-07-28` · `3e939fb2…b50e52` |
| Dominio | `AUDIOVISUAL_PRODUCTION` | 3 especialidades núcleo |
| Mapping pack | `audiovisual-production-mappings` | **1.0.0** · `f75ae6ee…08870` |
| Regla PA2 | `pa2-audiovisual-production-1.0.0` | config `4bf15ef3…dc468` · algo `pa2-algo-lexico-v2` |
| Tests | `mc-catalog.audiovisual.spec.ts` | 15 casos nuevos |
| Seed BD | catálogo id=3, mappings AV, eval id=**7** (Santiago) | 2026-07-28 |

**Sin cambios:** packs/reglas publicados de SOFTWARE y VISUAL_DESIGN.

---

## 2. Catálogo

- **Dominio único:** `AUDIOVISUAL_PRODUCTION` (sin duplicar `AUDIOVISUAL`, `AV`, `MULTIMEDIA`).
- **Especialidades implementadas:** `AV_EDITING`, `AV_MOTION`, `AV_POST` (lifecycle `ACTIVE`).
- **Reservadas (solo documentación / OUTSIDE en pack):** `AV_PRODUCTION`, `AV_PHOTOGRAPHY`, `AV_SOUND`, `AV_STREAMING`.

---

## 3. Vocabulario del pack (evidencia real)

### 3.1 Skills profesionales mapeadas

| skill_key | Tipo | Especialidad | Evidencia |
|-----------|------|--------------|-----------|
| `edicion_de_video` | PROFESSIONAL_KNOWLEDGE | AV_EDITING | Santiago MOD; Juan Pablo WEAK |
| `motion_graphics` | PROFESSIONAL_KNOWLEDGE | AV_MOTION | Santiago MOD |
| `animacion_2d` | PROFESSIONAL_KNOWLEDGE | AV_MOTION | Santiago MOD 64.5 |
| `animacion_2d/3d` | PROFESSIONAL_KNOWLEDGE | AV_MOTION | Juan Pablo MOD 64.5 |
| `ajuste_de_color` | PROFESSIONAL_KNOWLEDGE | AV_POST | Santiago MOD |

### 3.2 Tools (peso ≤ 0.25)

| skill_key | Especialidad | Notas |
|-----------|--------------|-------|
| `adobe_premiere` | AV_EDITING | Santiago |
| `adobe_premiere_pro` | AV_EDITING | Juan Pablo MOD |
| `davinci_resolve` | AV_EDITING (PRIMARY) + AV_POST (SECONDARY) | Santiago MOD |
| `capcut` | AV_EDITING | Juan Pablo MOD |
| `adobe_after_effects` | AV_MOTION | Juan Pablo MOD; no activa sola |

### 3.3 Aliases operativos (claves distintas, misma práctica)

- `adobe_premiere` / `adobe_premiere_pro`
- `animacion_2d` / `animacion_2d/3d`

**No creados:** aliases para `multimedia`, `producción`, `animación` genérica.

### 3.4 OUTSIDE explícitos (frontera)

`adobe_indesign`, `manuales_de_identidad_corporativa`, `ispring`, `e-mail_marketing`, `fotografia_comercial`, audio DAWs, `streaming`, `adobe_suite` genérico.

---

## 4. Mapping pack

| Campo | Valor |
|-------|-------|
| Código | `audiovisual-production-mappings` |
| Versión | `1.0.0` |
| Fingerprint (hash) | `f75ae6ee11f7924d0d35fa8ef0a82248d41732b946c3e349826443adc5e08870` |
| Clasificaciones | 36 (10 DOMAIN + 6 TRANSVERSAL + 20 OUTSIDE) |
| Mappings | 11 (incluye `davinci_resolve` dual EDITING/POST) |
| Estado | Publicado en BD bajo catálogo `mc1.8-2026-07-28` |

---

## 5. Regla PA2

| Campo | Valor |
|-------|-------|
| Código | `pa2-audiovisual-production-1.0.0` |
| Estrategia | LEXICOGRAPHIC + `requireProfessionalCompanionForVisible` |
| Algoritmo | `pa2-algo-lexico-v2` (mismo motor que Visual 1.1.0) |
| Umbrales | coverage ≥ 0.45, strength ≥ 20, min mapped/evidenced ≥ 2 |
| config_hash | `4bf15ef3c5b97667b6c83aede977b4d007ae86de68b2462002cf4838429dc468` |

---

## 6. Dry-runs

### 6.1 Santiago — `1000944247` (ext **216**)

| Campo | Valor |
|-------|-------|
| Clasificación | **MATCH** |
| Default | `AV_EDITING` |
| ACTIVE | **3** (EDITING, MOTION, POST) |
| EMERGENT / HIDDEN | 0 / 0 |
| source_hash | `a684d873…b40ca04` |
| evaluation_context_hash | `44f518ed…a0447` |
| Artefacto | `tmp/mc181-santiago-dryrun.json` |

**Por qué ACTIVE en EDITING:** `edicion_de_video` MODERATE (profesional) + tools Premiere/DaVinci con peso bajo; `professionalEvidencedCount ≥ 1`; strength 50.34 ≥ 20.

**Por qué MOTION ACTIVE:** `animacion_2d` + `motion_graphics` ambos MODERATE profesionales; sin dependencia de tools.

**Por qué POST ACTIVE:** `ajuste_de_color` MODERATE + DaVinci secundario; contribución profesional dominante.

### 6.2 Juan Pablo — `1022445625` (ext **208**)

| Campo | Valor |
|-------|-------|
| Clasificación | **MATCH / BORDERLINE AUDIOVISUAL** |
| Default | `AV_MOTION` |
| ACTIVE | **1** (MOTION) |
| EMERGENT | **1** (EDITING — strength 14.83 < 20) |
| HIDDEN | **1** (POST — sin mappings evidenciados) |
| Artefacto | `tmp/mc181-juanpablo-dryrun.json` |

**Por qué MOTION ACTIVE:** `animacion_2d/3d` MODERATE 64.5 (profesional) + AE tool; companion profesional cumple anti-tool.

**Por qué EDITING EMERGENT (no ACTIVE):** Premiere + CapCut MODERATE pero `edicion_de_video` WEAK (strength 1); strength agregado 14.83 < umbral 20 — tools no inflan a ACTIVE.

**Por qué POST HIDDEN:** sin evidencia de color/post en este perfil.

---

## 7. Análisis de frontera (Visual Design)

| Verificación | Resultado |
|--------------|-----------|
| Premiere no activa Diseño Visual | OK — `adobe_premiere_pro` OUTSIDE pack Visual |
| After Effects solo no activa AV_MOTION | OK — test + Juan Pablo requiere `animacion_2d/3d` |
| Photoshop/Illustrator no convierten perfil en AV | OK — no mapeados en pack AV |
| Motion Graphics en Audiovisual | OK — `motion_graphics` → AV_MOTION |
| iSpring / identidad no inflan AV | OK — OUTSIDE en pack AV |
| `multimedia` aislado no activa todo | OK — sin mapping genérico |

**Nota operativa:** tras activar catálogo `mc1.8`, los mappings de VISUAL_DESIGN deben re-sembrarse para el nuevo `catalog_version_id` antes de dry-runs cruzados en BD. Las regresiones de pack/hash están cubiertas por Jest (81 tests `mc-catalog`).

---

## 8. Tests y regresiones

| Suite | Resultado |
|-------|-----------|
| `npm test -- mc-catalog` | **81/81 PASS** |
| Catálogo AV (unicidad, radar) | PASS |
| Pack (hash, validación, registry) | PASS |
| PA2 (anti-tool, fronteras, determinismo) | PASS |
| Fingerprints publicados (5 reglas) | PASS |
| Software / Visual packs congelados | PASS |

---

## 9. Trazabilidad

Cada evaluación incluye: `catalog_version`, `mapping_pack_code`, `mapping_pack_version`, `mapping_hash`, `engine_rules_version`, `config_hash`, `algorithm_version`, `source_hash`, `evaluation_context_hash`, `extraction_id`, `enrichment_id`, `evidence_evaluation_id`.

Evaluación persistida Santiago: **evaluation_id=7**.

---

## 10. Decisión de persistencia

| Candidato | Persistido | Justificación |
|-----------|------------|---------------|
| Santiago (216) | **Sí** | MATCH defendible; 3 ACTIVE con contribución profesional; gates cumplidos |
| Juan Pablo (208) | **No** | Validación dry-run; BORDERLINE en EDITING; rol de frontera documentado |

**Gates:**

- [x] Santiago resultado profesional defendible
- [x] Ninguna especialidad ACTIVE solo-tools
- [x] Juan Pablo sin inflación generalizada (1 ACTIVE)
- [x] Tests mc-catalog sin regresión de hashes Software/Visual
- [x] Hashes deterministas
- [x] Tests pasan

---

## 11. Madurez metodológica recomendada (post-prototipo)

| Especialidad | Discovery | Prototype MC1.8.1 |
|--------------|-----------|-------------------|
| AV_EDITING | EMERGENT | **SUPPORTED** — 2 perfiles; PA2 semilla ACTIVE |
| AV_MOTION | EMERGENT | **SUPPORTED** — evidencia profesional en ambos |
| AV_POST | EMERGENT | **EMERGENT** — 1 skill profesional; ACTIVE solo en semilla fuerte |

---

## 12. Hallazgos y vacíos

**Confirmados:**

- El núcleo EDITING/MOTION/POST es evaluable con motor genérico PA2.
- Anti-tool evita ACTIVE en EDITING tool-led (Juan Pablo).
- `davinci_resolve` dual mapping EDITING+POST es trazable.

**Vacíos:**

- Sin perfil OUTSIDE Visual puro en dry-run BD (pendiente MC1.8.1C).
- AV_POST con corpus profesional delgado (solo `ajuste_de_color`).
- Re-seed mappings Software/Visual bajo `mc1.8` para evaluaciones cruzadas en prod.

---

## 13. Próximos pasos

1. MC1.8.1C Validating: perfiles OUTSIDE Visual + BORDERLINE DI.
2. Re-sembrar mappings Software/Visual en catálogo activo `mc1.8`.
3. Evaluar bump pack `1.0.1` si aparecen aliases recurrentes en corpus ampliado.
4. AV_PHOTOGRAPHY / AV_SOUND / AV_STREAMING: permanecen RESERVED.

---

## 14. Veredicto final

| Campo | Valor |
|-------|-------|
| Dominio | `AUDIOVISUAL_PRODUCTION` |
| Estado | **PROTOTYPE** |
| Mapping pack | `audiovisual-production-mappings@1.0.0` |
| PA2 | `pa2-audiovisual-production-1.0.0` |
| Santiago | **MATCH** — 3 ACTIVE |
| Juan Pablo | **MATCH / BORDERLINE** — 1 ACTIVE, 1 EMERGENT |
| Persistencia | Santiago sí; Juan Pablo no |
| Regresiones Jest | No |
| **Veredicto** | **GO CON AJUSTES** (re-seed mappings hermanos; ampliar corpus POST) |

---

**Resultados:** MC1.8.1 · Producción Audiovisual · PROTOTYPE · 2026-07-28
