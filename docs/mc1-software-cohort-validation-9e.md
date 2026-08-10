# MC1 — FASE 9E Software Engineering cohort validation

Git-safe. caseId + snapshotId only. No documents, CV text, or roles as evidence.

## Cohort technical IDs

| caseId | snapshot | CV | pipeline |
| --- | --- | --- | --- |
| person-camilo | 8 | yes | REUSED (9D profile) |
| person-zuany | 9 | yes | P0→P1→P2→R1→P3→P4→Profile CREATED |
| person-jose | 10 | yes | full CREATED |
| person-alejandro | 11 | yes | full CREATED |
| person-johan | 12 | yes | full CREATED |

Specialty catalog SOFTWARE_ENGINEERING V1 / unified **1.4.0** — unchanged post-run.

## Results (summary)

| caseId | R1 | Specialties OBSERVED | Skills | Radar dominant | Class |
| --- | --- | --- | --- | --- | --- |
| person-camilo | SE RESOLVED | FE + BE | 5 | Backend 100 | GOOD |
| person-zuany | SE RESOLVED | FE + BE (Platform WEAK) | 3 | Frontend 100 | GOOD |
| person-jose | SE RESOLVED | FE only (BE/Platform WEAK) | 2 | Frontend 100 | PARTIAL |
| person-alejandro | SE RESOLVED | BE + Platform (FE WEAK) | 5 | APIs 100 | GOOD |
| person-johan | SE+VD MULTI_FIELD | FE + BE (+ UX on VD) | 4+2 | Frontend/Backend 100 | GOOD |

## Radar relativeCoverage (SE field)

| caseId | FE | BE | DB | APIs | Cloud | Quality | AI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| camilo | 59.6 | 100 | 32.4 | 41.6 | 0 | 0 | 0 |
| zuany | 100 | 43 | 33.2 | 43 | 43 | 0 | 0 |
| jose | 100 | 93.2* | 93.2* | 93.2* | 0 | 0 | 0 |
| alejandro | 19.5 | 89.4 | 60.8 | 100 | 90.9 | 30.1 | 0 |
| johan | 100 | 100 | 48.9 | 48.4 | 63.8 | 0 | 0 |

\* jose: BE/DB/APIs inflated by skill→dimension keyword mapping from a FRONTEND skill (`rest_api_integration`); specialty layer correctly kept Backend as WEAK.

## Hypotheses

1. Catalog reusable — **yes** (5/5 SE primary or multi with SE)
2. Camilo not overfit — **yes** (distinct shapes)
3. FE/BE differentiate — **yes**
4. QA via Quality dimension / skills — **partial** (alejandro CI/CD → Quality 30; no QA specialty)
5. Cloud ≠ auto Platform — **yes** (WEAK vs OBSERVED discipline)
6. Role ≠ Field evidence — **yes** (Johan MULTI_FIELD, not forced by leadership)
7. Radar differentiates — **yes** (with jose mapper caveat)

## Decision

**SOFTWARE_CATALOG_GENERALIZES**

Next: PROCESS_NEXT_FIELD_OR_REAL_PERSON
