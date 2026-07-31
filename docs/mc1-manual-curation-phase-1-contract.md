# MC1 Fase 1 — Contrato JSON de curaduría manual

**Fecha:** 2026-07-29  
**Auditoría base:** `docs/mc1-manual-curation-readiness-audit.md`  
**Alcance:** schema versionado + validador RO + CLI dry-run. Sin escrituras en BD.

---

## Decisiones tomadas

| Decisión | Detalle |
| -------- | ------- |
| Ubicación del módulo | `src/mc-catalog/curated-profile/` (contrato MC1; CLI en `database/scripts`) |
| `schemaVersion` | `mc1-curated-profile-1.0.0` |
| Origen tipado | Tipos **propios del contrato** (`MANUAL_CURATED`, `CHATGPT_HUMAN_REVIEW`, `REVIEWED`). No se añadieron a enums persistidos ni migraciones. |
| Dominio `PROPOSED` | **Error bloqueante** (no se crean dominios en el piloto). |
| Especialidad `PROPOSED` | **Warning** (se reporta; no se crea). PA2 seguirá mapeando por skill→specialty. Código inexistente ≠ creación automática. |
| Especialidad en dominio incorrecto / inactiva | **Error**. |
| Skill `PROPOSED` | **Warning** (no se crea en Fase 1). |
| Skill `AMBIGUOUS` / `INVALID` | **Error**. |
| Confianza del JSON | Seguridad de la **curaduría humana** (0..1). **No** es coverage/confidence/strength de PA2. |
| Persona | Resolución solo por `person.document` (override CLI opcional). No se confía en `person_id` externo. |
| Documento en fixture | `PLACEHOLDER_DOCUMENT`; cédula real vía `--document=` o archivo en `tmp/` (gitignore). |
| Escrituras | Prohibidas. CLI rechaza `--confirm`. |

### Mapping futuro → `cv_extraction` (Fase 2)

| Contrato | Extracción |
| -------- | ---------- |
| `source.type=MANUAL_CURATED` | `model='manual-curated'` |
| (versión contrato) | `prompt_version='manual-curated-v1'` |
| (versión importer) | `extractor_version='manual-1.0.0'` |
| tag en warnings | `source=MANUAL_CURATED` |
| `evidence[].text` + `sourceSection` | `cv_extraction_skill.evidence_items` (`EvidenceSourceType`) |

---

## Rutas de archivos

| Pieza | Ruta |
| ----- | ---- |
| Constantes / enums contrato | `src/mc-catalog/curated-profile/curated-profile.constants.ts` |
| Schema TS | `src/mc-catalog/curated-profile/curated-profile.schema.ts` |
| Tipos de reporte | `src/mc-catalog/curated-profile/curated-profile.types.ts` |
| Validación estructural | `src/mc-catalog/curated-profile/curated-profile.validate-structure.ts` |
| Lookup RO catálogo | `src/mc-catalog/curated-profile/curated-profile.catalog-lookup.ts` |
| Validador semántico | `src/mc-catalog/curated-profile/curated-profile.validate.ts` |
| Normalización | `src/mc-catalog/curated-profile/curated-profile.normalize.ts` |
| Fixture factory | `src/mc-catalog/curated-profile/curated-profile.fixture.ts` |
| CLI args | `src/mc-catalog/curated-profile/curated-profile.cli-args.ts` |
| CLI | `src/database/scripts/mc-validate-curated-profile.ts` |
| Fixture JSON | `src/database/scripts/fixtures/mc1-curated-profile.software.example.json` |
| Tests | `*.spec.ts` junto a cada módulo + `mc-validate-curated-profile.args.spec.ts` |

---

## Tipos y componentes reutilizados

| Existente | Uso |
| --------- | --- |
| `SkillType`, `SKILL_TYPES` | Tipado opcional de skill |
| `EvidenceSourceType`, `EVIDENCE_SOURCE_TYPES` | `evidence.sourceSection` |
| `toCanonicalKey` | Clave alineada a `cv_skill.normalized_key` / `alias_key` |
| `SAFE_SKILL_ALIASES` | Resolución inequívoca js→JavaScript, etc. |
| `maskDocument` | Logs/reportes sin cédula completa |
| Tablas `core.person`, `person_cv`, `cv_skill`, `cv_skill_alias`, `mc_domain`, `mc_specialty`, `mc_skill_specialty_mapping`, `mc_catalog_version` | Solo SELECT |
| Patrón CLI Nest (`NestFactory` + `DataSource`) | Igual que `mc:evaluate` / audits RO |

No se duplicaron enums de `cv_extraction.status` ni se inventó columna `source` en BD.

---

## Contrato final (resumen)

```text
schemaVersion
source { type, method, reviewStatus, reviewedAt?, notes? }
person { document }
profile { primaryDomainCode, summary? }
domain { code, name?, confidence }
specialties[] {
  code, name?, confidence,
  skills[] {
    canonicalName, displayName?, skillType?, confidence,
    evidence[] { text, evidenceType, sourceSection? }
  }
}
warnings[]?
notes[]?
```

`catalogStatus` **no** se exige en el input: lo calcula el validador en el reporte.

---

## Ejemplo JSON

Ver fixture: `src/database/scripts/fixtures/mc1-curated-profile.software.example.json`.

Incluye:

- dominio `SOFTWARE`
- especialidad `SOFTWARE_BACKEND`
- skill existente (`Java`)
- alias (`js`)
- skill propuesta (`Mc1PilotHypotheticalFramework`)
- evidencias EXPLICIT/CONTEXTUAL

---

## Reglas de validación

### Estructura

- versión exacta; enums de source; confidence 0..1
- listas no vacías (especialidades, skills, evidencias)
- duplicados de especialidad/skill → error
- evidencia vacía → error; corta/duplicada/heurística de cargo → warning

### Persona / CV

- documento → `core.person` (1 fila)
- `person_cv` activo requerido; múltiples → warning (usa menor id)

### Catálogo

- dominio activo en catálogo `is_active` → EXISTING; ausente → PROPOSED + **error**
- especialidad: EXISTING / PROPOSED(warning) / INVALID(error)
- skills: EXISTING | ALIAS | PROPOSED(warning) | AMBIGUOUS(error) | INVALID(error)
- warning si skill resuelta sin mapping a la especialidad declarada

---

## Clasificación errores vs warnings

| Código | Severidad |
| ------ | --------- |
| `SCHEMA_VERSION`, `CONFIDENCE_*`, `EVIDENCE_*` (vacía/requerida), `SKILL_DUPLICATE`, `SPECIALTY_DUPLICATE`, `DOMAIN_*` bloqueantes, `PERSON_NOT_FOUND`, `PERSON_CV_MISSING`, `SPECIALTY_WRONG_DOMAIN`, `SKILL_AMBIGUOUS` | error |
| `SKILL_PROPOSED`, `SPECIALTY_PROPOSED`, `SKILL_ALIAS_RESOLVED`, `SKILL_NO_SPECIALTY_MAPPING`, `EVIDENCE_ROLE_HEURISTIC`, `PERSON_CV_MULTIPLE`, `SPECIALTY_EXPERIMENTAL` | warning |

`valid = errors.length === 0` (warnings no invalidan).

---

## Comando

```bash
cd Organigrama_Backend
npm run mc:validate-curated-profile -- --file=src/database/scripts/fixtures/mc1-curated-profile.software.example.json --document=<CEDULA> --out=tmp/mc1-curated/report.json
```

- Exit code `1` si hay errores bloqueantes.
- No acepta `--confirm`.
- Solo SELECT.

---

## Salida esperada (forma)

```json
{
  "valid": true,
  "person": {
    "personId": "…",
    "documentMasked": "******7890",
    "personCvId": "…"
  },
  "domain": { "inputCode": "SOFTWARE", "status": "EXISTING", "matchedDomainId": "…" },
  "specialties": [{ "inputCode": "SOFTWARE_BACKEND", "status": "EXISTING" }],
  "skills": {
    "existing": [],
    "resolvedAliases": [],
    "proposed": [],
    "ambiguous": [],
    "invalid": []
  },
  "errors": [],
  "warnings": []
}
```

---

## Pruebas

```bash
npx jest --runInBand --testPathPatterns=curated-profile
npx jest --runInBand --testPathPatterns=mc-validate-curated-profile.args
```

Cubren: JSON válido/inválido, confidence, dominio, especialidad fuera de dominio, duplicados, sin evidencia, alias, propuesta, persona/CV, CLI args sin `--confirm`.

---

## Limitaciones

- No inserta extracción/enrichment/evidence/PA2.
- No crea skills/dominios/especialidades.
- Heurística de cargo es léxica (warnings), no NLP.
- Integración real CLI↔BD no está en CI (requiere `.env` + red); unitarios usan mocks de lookup.
- `mc_evaluation_set` (023) no se usa.

---

## Pendiente Fase 2

1. Importer CLI con dry-run + `--i-confirm-import`.
2. Persistir `cv_extraction` con mapping de versiones manuales.
3. Enrichment sintético desde evidencias curadas.
4. Encadenar `evaluate:cv-evidence` + `mc:evaluate`.
5. Extender mappings si skills PROPOSED deben entrar al radar.
6. (Opcional) columna/campo `source` tipado en BD.
