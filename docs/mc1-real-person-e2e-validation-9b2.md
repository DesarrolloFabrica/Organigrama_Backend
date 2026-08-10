# MC1 — FASE 9B.2 First real person E2E validation

Git-safe. No CV text, titles, or sensitive payload.

## Scope

End-to-end ARTIFACT_ONLY run for real-person case `person-camilo` (MDE lookup by document only). Pipeline evidence only; no human hypothesis as input.

## Identity (technical)

| Key | Value |
| --- | --- |
| personCvId | 187 |
| snapshotId | 8 |
| snapshot | HIGH_FIDELITY / PARSED (P0 created then reused) |
| P0 | CREATED once, then REUSED_EXISTING_PARSED |
| preview caseId | person-camilo |
| binding | `tmp/mc1-profile-preview/real-person-bindings.json` → snapshotId `8` |

## Pipeline origins

| Stage | Origin | Pack / notes |
| --- | --- | --- |
| P1 | REUSED | `P1P-V11-6I-S8-20260810150132-32bbea26` — 101 units, COMPLETED |
| P2 | CREATED | `P2F-8A2-S8-20260810151310-e59a8ed6` — CANDIDATES_PRODUCED |
| R1 | CREATED | `R1F-8A2-S8-20260810151310-e59a8ed6` — RESOLVED / RESOLVED_CLEAR_LEAD |
| P3 | CREATED | `P3F-8B2-S8-20260810151310-5f016189` — ABSTAINED_NO_FIELD (SE out of specialty scope) |
| P4 | ABSTAINED | `P4F-8D-S8-20260810151310-d5875d49` — ABSTAINED_NO_OBSERVED_SPECIALTY, geminiInvoked=false |
| Profile | CREATED | `PROF-8E-S8-20260810151310` — Field only + catalog gap warning |

### Provenance fingerprints (P2)

- executionId: `e59a8ed6-1f6a-4305-9ddb-ecf4d72a0eeb`
- configFingerprint: `5ae5b290702480e1c01c03362aa79e27f7d4da0622b323e0c294de84e47d2b99`
- p1ArtifactDigest: `33ef1ea6bbf0e4763b849e8fece8ed6686c1d1d4d89c396902a8b0f57d93cf8b`
- p2ArtifactDigest: `c6ef45587d32260b0496b52ea94eb73d7cd08b17fb61b0bcb381e2e7464e3499`
- generativeResultOrigin: LIVE

## Professional Field

P2 candidates (ACTIVE):

1. SOFTWARE_ENGINEERING @ 0.94 (supportCount 63)
2. IT_SYSTEMS @ 0.62
3. DATA_ANALYTICS @ 0.58
4. PROJECT_PROGRAM_MGMT @ 0.45

R1 primary: SOFTWARE_ENGINEERING (secondaries retained as listed).

Human classification: **GOOD_FIELD_REPRESENTATION** — clear lead on software construction practice clusters; secondary fields look transversal, not competing primaries.

Prompts were **not** changed after observing the result.

## Taxonomic coverage

- Specialty catalog for SOFTWARE_ENGINEERING: **not available**
- Gap code: `SPECIALTY_CATALOG_NOT_AVAILABLE:SOFTWARE_ENGINEERING`
- P3: abstained (no in-scope field for specialty evaluation)
- P4: abstained (no OBSERVED specialties); no artificial skills

## Preview

- availability: **PARTIAL_PROFILE** (was PIPELINE_NOT_READY before binding)
- Field shown: Ingeniería de Software (PRIMARY)
- Specialties: empty → UI “Catálogo de especialidades pendiente…”
- Skills: none
- Radar: axes present at 0; UI hides chart when no positive coverage

## Guardrails checked

- Title/area not used as pipeline evidence
- No specialty/skill catalog invented for Software
- No P1/P2/R1/P3/P4 prompt edits post-run
- No Cloud / Publisher / persistence of P2–P4/profile
- Other real persons not processed

## Decision

**SOFTWARE_FIELD_VALIDATED_NEEDS_CATALOG**

## Recommended next phase

**FASE 9C — SOFTWARE ENGINEERING SPECIALTY + DIMENSION EXPANSION**
