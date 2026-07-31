# MC1 Fase 2 — Importación controlada de una persona

**Fecha:** 2026-07-29  
**Bases:** `mc1-manual-curation-readiness-audit.md`, `mc1-manual-curation-phase-1-contract.md`  
**Alcance:** importer CLI dry-run / execute + enrich sintético + evidence + PA2 + rollback. Sin frontend, sin endpoints, sin Gemini, sin migraciones.

---

## Arquitectura implementada

```text
JSON curado (1.0.0 | 1.1.0)
    ↓ validateCuratedProfile (Fase 1, RO)
    ↓ buildCuratedImportSkillPlan (política import)
    ↓ computeCuratedContentFingerprint
    ↓ [DRY-RUN] reporte READY | BLOCKED | NO_OP
    ↓ [EXECUTE --confirm]
create skills/mappings aprobados (TX)
    ↓
CvSkillsPersistenceService.persistSucceededExtraction
  model=manual-curated
  prompt_version=chatgpt-human-reviewed
  extractor_version=manual-import-1.0.0
  pdf_sha256=contentFingerprint
  → activa nueva, desactiva previa
    ↓
enrichment sintético (CvSkillsEnrichmentPersistenceService, sin Gemini)
    ↓
CvEvidencePersistenceService.runPersist({ activate:true })
    ↓
McPa2Service.evaluateProfileDomain({ persist:true })
    ↓
validar dominio/especialidades vs JSON
    ↓ (si falla) rollback compensatorio
post-verify lectura
```

**Orden vs unique `is_active`:** PA2 exige extracción activa. Por eso la nueva extracción se activa al completar (como el pipeline Gemini); la previa queda inactiva. Si PA2/evidence fallan, se desactiva la nueva y se reactiva la previa (compensating rollback). No hay TX única multi-servicio sin refactor; el rollback operativo cubre el fallo.

---

## Archivos creados / modificados

| Archivo | Rol |
| ------- | --- |
| `curated-profile.constants.ts` | 1.1.0, reviewDecision, mapping extracción |
| `curated-profile.schema.ts` | `reviewDecision` opcional |
| `curated-profile.validate-structure.ts` | versiones 1.0.0+1.1.0 |
| `curated-profile.fingerprint.ts` | firma sha256 |
| `curated-profile.import-policy.ts` | política catálogo import |
| `curated-profile.extract-builder.ts` | JSON → ExtractedCvSkills |
| `curated-profile.enrichment-builder.ts` | enrichment sintético |
| `curated-profile.activation.ts` | activate/deactivate/mappings |
| `curated-profile.importer.ts` | orquestación |
| `curated-profile.rollback.ts` | rollback manual |
| `curated-profile.import-cli-args.ts` | flags CLI |
| `mc-import-curated-profile.ts` | CLI import |
| `mc-rollback-curated-profile.ts` | CLI rollback |
| `docs/mc1-manual-curation-phase-2-single-import.md` | este doc |

---

## Contrato soportado

- `mc1-curated-profile-1.0.0` (sin `reviewDecision` → se asume `REUSE_EXISTING`; PROPOSED se omite)
- `mc1-curated-profile-1.1.0` (preferido) con:

```text
reviewDecision: REUSE_EXISTING | APPROVED_FOR_CREATION | OMIT | REJECTED
```

---

## Política de catálogo

| Entidad | Regla |
| ------- | ----- |
| Dominio EXISTING | OK |
| Dominio PROPOSED/INVALID/AMBIGUOUS | error bloqueante |
| Especialidad EXISTING | OK |
| Especialidad PROPOSED | **error** (más estricto que Fase 1 warning) |
| Skill EXISTING/ALIAS | reutilizar |
| Skill PROPOSED + APPROVED_FOR_CREATION | crear + mapping a especialidad |
| Skill PROPOSED sin aprobación | omitir + warning |
| AMBIGUOUS/INVALID | error |

---

## Mapping extracción / enrichment / evidence / PA2

| JSON | Extracción | Enrichment | Evidence | PA2 |
| ---- | ---------- | ---------- | -------- | --- |
| source MANUAL_CURATED | `model=manual-curated` + warnings | model enricher manual | — | — |
| evidence.text | `evidence_items[].evidenceText` | copia ítems | input motor | scores |
| evidence.sourceSection | `sourceType` | `source_types` | pesos | — |
| confidence curaduría | `cv_extraction_skill.confidence` | no recalcula | distinto de PA2 | PA2 confidence propio |
| domain.code | — | — | — | `evaluateProfileDomain(domainCode)` |
| specialties[].code | category label | — | — | resultado vía mappings |

Drive sintético: `drive_file_id=manual-curated:<fp…>`, `drive_file_name=<doc>.curated.json` (cumple NOT NULL sin fingir Gemini).

---

## Idempotencia

- Firma = sha256(schemaVersion, personId, personCvId, dominio, especialidades, skills, evidencias normalizadas).
- Se usa como `pdf_sha256` + `raw_result.curatedImport.contentFingerprint`.
- Misma firma SUCCEEDED **activa** → `NO_OP`.
- Misma firma SUCCEEDED **inactiva** → `BLOCKED` salvo `--allow-reactivate-identical`.

---

## Comandos

```bash
# Dry-run (default)
npm run mc:import-curated-profile -- \
  --file=tmp/mc1-curated/person.json \
  --document=<CEDULA> \
  --out=tmp/mc1-curated/dry-run.json

# Execute
npm run mc:import-curated-profile -- \
  --file=tmp/mc1-curated/person.json \
  --document=<CEDULA> \
  --execute --confirm \
  --out=tmp/mc1-curated/execute.json

# Rollback
npm run mc:rollback-curated-profile -- \
  --document=<CEDULA> \
  [--extraction-id=...] \
  --execute --confirm
```

Flags: `--execute` y `--confirm` son mutuamente requeridos para escritura. `--no-verify` desactiva post-check. `--allow-reactivate-identical` para firma inactiva.

---

## Verificación post-execute

Automática (salvo `--no-verify`):

- extracción activa = nueva
- evaluación PA2 SUCCEEDED activa del dominio declarado
- especialidades ACTIVE/EMERGENT listadas

Consumo UI: mismos endpoints `professional-profile` + specialty detail + radar existentes.

---

## Rollback

1. Valida `model=manual-curated`.
2. Desactiva evaluaciones de esa extracción.
3. Desactiva extracción manual.
4. Reactiva `raw_result.curatedImport.previousExtractionId` si existe.
5. No borra skills/mappings de catálogo compartido.
6. Idempotente si ya está revertido.

---

## Procedimiento primera persona (cuando haya JSON definitivo)

1. Guardar JSON en `tmp/mc1-curated/person.json` (gitignore).
2. Dry-run con `--document=` real; corregir errors/warnings.
3. Revisar skills CREATE / mappings / dominio.
4. Execute `--execute --confirm`.
5. Abrir ficha → Competencias → radar.
6. Si falla: `mc:rollback-curated-profile --document=... --execute --confirm`.

**No ejecutar import real hasta tener JSON curado definitivo.**

---

## Limitaciones / riesgos

- Rollback compensatorio, no TX global multi-servicio.
- Skills nuevas quedan en catálogo global (no se eliminan en rollback).
- Mappings creados por import tampoco se eliminan.
- PA2 puede añadir especialidades extra (warning).
- Java puede no tener mapping SOFTWARE_BACKEND previo → se crea mapping mínimo.
- Enrichment sintético no reformula evidencia.

---

## Pruebas

```bash
npx jest --runInBand --testPathPatterns=curated-profile
```

Cubren: schema 1.0/1.1, política import, fingerprint, CLI flags, multi-persona, dry-run READY, NO_OP, masking.
