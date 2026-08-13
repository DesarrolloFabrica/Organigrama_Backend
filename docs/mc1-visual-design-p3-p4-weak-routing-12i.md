# MC1 — FASE 12I: WEAK routing context P3→P4 (implementación)

**Decisión:** `P3_P4_WEAK_ROUTING_VALIDATED`  
**Modo:** ARTIFACT_ONLY · P4 Gemini LIVE · sin reejecutar P1/P2/P3 · sin promoción WEAK→OBSERVED

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/mc-pipeline/p4/p4.types.ts` | Contrato `1.1.0`; roles `AUTHORITATIVE_TARGET` / `ROUTING_CANDIDATE`; hints; `P4_ROUTING_POLICY_VERSION=12H.1` |
| `src/mc-pipeline/p4/p4-context-loader.ts` | `resolveP4SpecialtiesEvaluated` (OBSERVED+WEAK); warning routing |
| `src/mc-pipeline/p4/p4-prompt-v1.ts` | Delta roles + prefer most-specific eligible |
| `src/mc-pipeline/p4/p4-normalize.ts` | Abstención WEAK-only; hints; `p3Unchanged` |
| `src/mc-pipeline/p4/p4-runner.ts` | Fingerprint routing; no Gemini si no hay AUTHORITATIVE |
| `src/mc-pipeline/p4/p4-artifact-writer.ts` | Persist hints / routingPolicyVersion |
| `src/mc-pipeline/profile/profile-pack-loader.ts` | Filtro radar: skills solo bajo P3 OBSERVED |
| `src/mc-pipeline/profile/profile-assembler.ts` | Pasa P3 OBSERVED keys al filtro |
| `src/mc-pipeline/p4/p4-skill.spec.ts` | Tests 12I (11) |
| `scripts/mc1-visual-design-p4-weak-routing-12i.ts` | Reejecución controlada |

**No tocados:** mapper 12E, Publication Gate, catálogo, R1.

---

## Versión contractual

| | Before | After |
|--|--------|-------|
| Contract | `1.0.0` | `1.1.0` |
| Prompt | `MC1.P4.PROMPT.FUNCTIONAL.1.0.0` | `MC1.P4.PROMPT.FUNCTIONAL.1.1.0` |
| Routing policy | — | `12H.1` |

---

## Delta exacto del prompt

Añadido (solo):

- `EVALUATION ROLES`: AUTHORITATIVE_TARGET vs ROUTING_CANDIDATE
- ROUTING_CANDIDATE = placement-only; no confirma specialty; no publica
- `Prefer the most specific evidence-supported specialty among eligible targets`
- No inventar skills para todo WEAK; zero skills bajo candidate es válido
- Regla 13–14: preferir sibling específico vs GRAPHIC; hints opcionales
- Shape JSON + `specialtyCorroborationHints`

---

## Tests

`npx jest src/mc-pipeline/p4/p4-skill.spec.ts` → **11 passed**

Cobertura: OBSERVED→AUTHORITATIVE; WEAK→ROUTING; NOT_EMITTED excluido; WEAK-only abstains; GRAPHIC+MOTION routing; skill/hint no mutan P3; hint no publica; filtro radar; OBSERVED estable; legacy tools/generics.

---

## Ejecución LIVE

- Modelo: `gemini-3.6-flash`
- Snapshots: 24,25,27,28,30,31,32,33 (R1/P3 reusados 12F)
- Fingerprints P4 (sha256 config) por snapshot en `tmp/mc1-visual-design-p4-weak-routing-12i/validation-report.json`
- Artefacto: `tmp/mc1-visual-design-p4-weak-routing-12i/`

---

## Before / after — 6× P3_CONTEXT_LOSS

| Caso | Before | After | Veredicto |
|------|--------|-------|-----------|
| Darío motion | GRAPHIC | **MOTION_DESIGN** | ROUTING_FIXED |
| Diego illustration | GRAPHIC | **ILLUSTRATION** | ROUTING_FIXED |
| Diego editorial | GRAPHIC | **EDITORIAL_DESIGN** | ROUTING_FIXED |
| Hari brand | GRAPHIC | **BRAND_IDENTITY_DESIGN** | ROUTING_FIXED |
| Luis editorial | GRAPHIC | **EDITORIAL_DESIGN** | ROUTING_FIXED |
| Oswaldo motion | GRAPHIC | **MOTION_DESIGN** | ROUTING_FIXED |

**6/6** con evidencia suficiente.

---

## Controles UPSTREAM_DRIFT

| Caso | Sibling ausente | Resultado |
|------|-----------------|-----------|
| Luis ilustración | ILLUSTRATION | NO_RESCUE_OK (sigue GRAPHIC; no inventado) |
| Oswaldo identidad | BRAND | NO_RESCUE_OK |

---

## Controles OBSERVED

| Caso | After parent | Veredicto |
|------|--------------|-----------|
| Hermida UX | UX_PRODUCT_DESIGN | STABLE (rename EN; needle false-negative corregido en reporte) |
| Juliana editorial | EDITORIAL_DESIGN | STABLE |
| Laura brand | BRAND_IDENTITY_DESIGN | STABLE |
| Laura illustration | ILLUSTRATION | STABLE |

---

## specialtyCorroborationHints

Emitidos cuando skill cae bajo ROUTING_CANDIDATE (WEAK), p.ej.:

- Darío → MOTION_DESIGN ← `video_editing_and_animation`
- Diego → EDITORIAL + ILLUSTRATION
- Hari → BRAND_IDENTITY_DESIGN
- Luis → EDITORIAL_DESIGN
- Oswaldo → MOTION (+ UX débil)

Todos: `p3Status: WEAK`, `doesNotMutateP3: true`, `p3Unchanged: true`.

---

## Publication Gate

Sin cambios. Specialties públicas siguen `listObservedP3Specialties` (solo OBSERVED).  
Ej. Darío: chips GRAPHIC+UX; **MOTION no publicado** pese a skill+hint.

---

## Radar

Filtro en:

`profile-pack-loader.listObservedP4Skills(p4, observedP3)` ← llamado desde `assembleProfilePilot`.

Skills parentadas solo bajo WEAK **no** entran a skills públicas ni ejes.  
Mapper 12E intacto.  
Ej. Darío: skill motion en P4 interno; radar sin eje motion por esa skill.

---

## Anomalías

1. Hermida: rename skill EN → falso negativo del matcher del script (placement correcto).
2. Hints de corroboración presentes; **no** consumidos para promoción (diseño diferido).

---

## Decisión

**P3_P4_WEAK_ROUTING_VALIDATED**

Nota: el script automatizado marcó `controlsOk=false` por falso negativo del needle en Hermida (rename EN `User Interface & Experience Design` sin match a `ux|ui|…`). Inspección del pack P4 post-12I: skill OBSERVED bajo `UX_PRODUCT_DESIGN` — control estable. Needle del script ampliado a `interface|experience` para reejecuciones futuras.
