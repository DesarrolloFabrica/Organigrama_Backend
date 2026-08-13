# MC1 LEGAL specialty foundation V1

Catálogo unificado: **1.12.0** (`LEGAL` specialties **1.0.0**, profile dimensions **8C.10**).

## Archivos

| Archivo | Rol |
|---|---|
| `src/mc-pipeline/catalog/mc1-specialties-legal-v1.json` | 5 specialties V1 |
| `src/mc-pipeline/catalog/mc1-professional-fields-v2.json` | Field `LEGAL` + aliases sourceKey |
| `src/mc-pipeline/catalog/specialties-visual-education.ts` | Load + scope 1.12.0 |
| `src/mc-pipeline/r1/r1-field-catalog-resolver.ts` | Resolución R1 histórico → catálogo |
| `src/mc-pipeline/p3/p3-context-loader.ts` | P3 fieldsToEvaluate |
| `src/mc-pipeline/profile/profile-assembler.ts` | Profile fieldsFromR1 |
| `src/mc-pipeline/profile/profile-dimensions.ts` | 6 radar dims |
| `src/mc-pipeline/profile/profile-skill-dimension-mapper.ts` | `mapLegal()` |
| `src/mc-pipeline/p3/p3-prompt-v1.ts` | Regla 16 LEGAL |
| `scripts/mc1-legal-complete.ts` | Validación live Edwar + Johana |

## Provenance audit

```
field.legal_administrative  →  LEGAL  (Edwar 1126)
field.legal_services        →  LEGAL  (Johana 1130)
```

P2/R1 históricos **no modificados**. Normalización solo en resolución P3/Profile.

## Tests

- `r1-field-catalog-resolver.spec.ts` — aliases
- `p3-specialty.spec.ts` — catálogo + P3 scope + sourceKey
- `profile-publication-gate.spec.ts` — gate primary/secondary LEGAL
- `profile-skill-dimension-mapper.spec.ts` — radar + controles negativos

## Ejecución validación

```bash
npx ts-node --transpile-only scripts/mc1-legal-complete.ts --confirm
```

Artefactos: `tmp/mc1-legal-complete/`
