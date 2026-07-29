# MC1.6.1C.2 — Implementación Diseño Visual V2

**Fecha:** 2026-07-28  
**Modo:** Cloud + código (versionado; V1 histórico intacto)  
**Prerequisito:** MC1.6.1C.1 (evidencia hermanos + dry-run V1)  
**Artefactos:** `tmp/mc161c2-dryruns/*-v2-{a,b}.json`, `tmp/mc161c1-integrity.json`

---

## 1. Resumen ejecutivo

Se publicó **Visual Design V2**:

| Componente | Versión | Hash |
|------------|---------|------|
| Pack mappings | `visual-design-mappings@1.1.0` | `089ae0f0b729b89c6b7bfbf231ebcde1dd681b9df9eb9d24822509fac825c14c` |
| Reglas PA2 | `pa2-visual-design-1.1.0` | `b3fe1faafbe22a9ee52d195c2d638a91b25a848e89cc67cd1ecebdee734846ff` |
| Algoritmo | `pa2-algo-lexico-v2` | anti-tool companion |

**Pack V1** (`mc1.6-visual-nidia-2026-07-27`) permanece **PUBLISHED** e inmutable (`bc29810c…`).  
Evaluación histórica Nidia **#3** (V1) **no fue mutada**; quedó `is_active=false` al persistir V2 **#5**.

**Veredicto:** **VISUAL DESIGN V2 APROBADO — REQUIERE MÁS PERFILES**  
Solo 2 perfiles con lectura metodológica defendible (Nidia ACTIVE; Garzón EMERGENT identidad). Falta tercer MATCH ACTIVE para estado CONSOLIDATED.

---

## 2. Cambios V2 vs V1

### Mappings (`mc-catalog.mapping-visual-design-v110.ts`)

- Nuevas keys profesionales: identidad, editorial extendida, gráfico institucional.
- InDesign: PRIMARY editorial 0.20 + SECONDARY digital 0.15 (V1: PRIMARY digital 0.55).
- `control_de_calidad_(qa)` → TRANSVERSAL (sin mapping).
- `adobe_creative_cloud`, `suite_adobe` → OUTSIDE (sin mapping).
- Distribución: 14 DOMAIN / 16 TRANSVERSAL / 15 OUTSIDE (45 total).

### PA2 (`pa2-visual-design-1.1.0`)

- `requireProfessionalCompanionForVisible: true` — tools solas → HIDDEN.
- Umbrales numéricos idénticos a V1 (`minimumActiveStrength=20`, coverage 0.45, etc.).
- Nuevos campos en breakdown: `professionalContribution`, `toolContribution`, `professionalEvidencedCount`.

### Infraestructura

- Registry: default VISUAL_DESIGN = V1.1.0; `resolveMcMappingPackByRelease()` para histórico.
- Reseed: `--force-reseed --i-confirm-reseed` con upsert (fix constraint `uq_mc_skill_domain_classification`).
- Scripts: `mc161c2-publish-v1-pack.ts`, `mc161c2-verify-skills.ts`.

---

## 3. Comandos ejecutados

```text
# Publicar release V1 (inmutabilidad)
node dist/database/scripts/mc161c2-publish-v1-pack.js

# Verificar keys en cv_skill
node dist/database/scripts/mc161c2-verify-skills.js

# Reseed mappings V2
npm run mc:mappings -- --seed --i-confirm-seed --domain=VISUAL_DESIGN \
  --force-reseed --i-confirm-reseed --catalogVersion=mc1.6-2026-07-27

# Dry-run V2 (×2 determinista)
npm run mc:evaluate -- --extraction-id=207 --domain=VISUAL_DESIGN \
  --rules-version=pa2-visual-design-1.1.0 --dry-run --out=tmp/mc161c2-dryruns/nidia-v2-a.json
# … (208, 209, 210, 211)

# Persistencia defendible
npm run mc:evaluate -- --extraction-id=207 --domain=VISUAL_DESIGN \
  --rules-version=pa2-visual-design-1.1.0 --i-confirm-evaluate
npm run mc:evaluate -- --extraction-id=209 --domain=VISUAL_DESIGN \
  --rules-version=pa2-visual-design-1.1.0 --i-confirm-evaluate
```

---

## 4. Dry-run V2 — comparación por persona

| Persona | ext | V1 (C.1) | V2 dry-run | Persistido |
|---------|-----|------------|------------|------------|
| Nidia | 207 | 1 ACTIVE / 2 EMERGENT | **1 ACTIVE / 1 EMERGENT**; default `VISUAL_GRAPHIC`; DIGITAL **HIDDEN** (anti-tool) | **Sí** (#5) |
| Garzón | 209 | todo HIDDEN | **0 ACTIVE / 3 EMERGENT**; rank1 `VISUAL_IDENTITY` (`diseno_de_identidad_visual` MODERATE) | **Sí** (#6) |
| Juan Pablo | 208 | 0 ACTIVE / 2 EMERGENT (solo InDesign) | **0 ACTIVE / 1 EMERGENT**; editorial/digital **HIDDEN** anti-tool | No |
| Correa | 210 | — | 0 ACTIVE / 1 EMERGENT | No (BORDERLINE) |
| Angulo | 211 | — | 0 ACTIVE / 1 EMERGENT | No (INSUFFICIENT) |

Dry-runs **deterministas** (pares `a`/`b` → mismo `evaluationContextHash`).

---

## 5. Persistencia post-check

Integridad (`mc161c1-integrity.js`):

- **Nidia:** `VISUAL_DESIGN#3:H:VISUAL_GRAPHIC` (histórico V1) + `VISUAL_DESIGN#5:A:VISUAL_GRAPHIC` (vigente V2).
- **Garzón:** `VISUAL_DESIGN#6:A:-` (sin default ACTIVE; warning `NO_DEFAULT_SPECIALTY`).
- **JP / Correa / Angulo:** sin PA2 persistido.
- Cadenas CV→extracción→enrichment→evidence: intactas.

---

## 6. Tests

```text
npx jest src/mc-catalog/mc-catalog.visual-design.spec.ts \
         src/mc-catalog/mc-evaluation-context.spec.ts \
         src/mc-catalog/mc-pa2.engine.spec.ts
```

36/36 OK — incluye pack V2, fingerprint PA2 V110, test anti-tool.

---

## 7. Archivos principales

| Área | Archivos |
|------|----------|
| Pack V2 | `mc-catalog.mapping-visual-design-v110.ts` |
| Pack V1 export | `mc-catalog.mapping-visual-design-v100.ts` (referencia) |
| Registry | `mc-catalog.mapping-registry.ts` |
| PA2 | `mc-pa2.config.ts`, `mc-pa2.algorithm.ts`, `mc-pa2.engine.ts`, `mc-pa2.types.ts` |
| Reseed | `mc-catalog.mapping.service.ts`, `mc-mappings-seed.ts` |
| Tests | `mc-catalog.visual-design.spec.ts`, `mc-evaluation-context.spec.ts`, `mc-pa2.engine.spec.ts` |
| Scripts | `mc161c2-publish-v1-pack.ts`, `mc161c2-verify-skills.ts` |

---

## 8. Próximos pasos (MC1.6.1D+)

1. Tercer perfil con ACTIVE defendible para CONSOLIDATED.
2. Revisar si override de baja cardinalidad debe aplicar a Garzón (IDENTITY EMERGENT por `minimumMappedSkills=2`).
3. API/FE: exponer `professionalEvidencedCount` en breakdown si se requiere transparencia anti-tool.
