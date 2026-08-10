# MC1 — FASE 9D Software specialty application + real person validation

Git-safe. Snapshot 8 only. No CV text.

## Pipeline

| Stage | Action |
| --- | --- |
| P0/P1/P2/R1 | **REUSED** (R1 pack `R1F-8A2-S8-20260810151310-e59a8ed6`) |
| P3 | **CREATED** `P3F-8B2-S8-20260810154010-8f86a69b` — SPECIALTIES_OBSERVED |
| P4 | **CREATED** `P4F-8D-S8-20260810154035-770ac4be` — SKILLS_OBSERVED |
| Profile | **CREATED** `PROF-8E-S8-20260810154035` |
| Catalog | SOFTWARE_ENGINEERING V1 via unified **1.4.0** (unchanged post-run) |

## P3 specialties

| Specialty | Status | Confidence | Evidence units |
| --- | --- | --- | --- |
| FRONTEND_ENGINEERING | OBSERVED | 0.95 | 10 |
| BACKEND_ENGINEERING | OBSERVED | 0.95 | 10 |
| PLATFORM_DEVOPS_ENGINEERING | WEAK | 0.70 | 7 |
| MOBILE_ENGINEERING | (not emitted) | — | — |
| FULL_STACK_ENGINEERING | never produced | — | — |

Profile assembly includes **OBSERVED only** (`weakHiddenFromPrimary`). Derived presentation label: **Perfil Full Stack** (not a stored specialty).

## P4 skills (OBSERVED specialties only)

| Specialty | Skill | Status | Evid. | Tools (signals) |
| --- | --- | --- | --- | --- |
| FRONTEND | frontend_web_development | OBSERVED | 8 | React, Next.js, Angular, … |
| FRONTEND | responsive_ui_component_development | OBSERVED | 3 | React, Next.js |
| BACKEND | api_design_and_development | OBSERVED | 9 | Node.js, NestJS, Express, .NET, … |
| BACKEND | database_design_and_management | OBSERVED | 6 | PostgreSQL, MySQL, MongoDB, … |
| BACKEND | authentication_and_access_control_implementation | OBSERVED | 3 | — |

## Radar (formula 8E unchanged)

| Dimension | rawScore | relativeCoverage |
| --- | --- | --- |
| Frontend | 7.16 | 59.6 |
| Backend | 12.02 | 100 |
| Bases de datos | 3.892 | 32.4 |
| APIs e integración | 4.996 | 41.6 |
| Cloud / infraestructura | 0 | 0 |
| Ingeniería y calidad | 0 | 0 |
| IA aplicada | 0 | 0 |

Cloud at 0 is consistent with Platform remaining WEAK (no P4 skills under PLATFORM). Quality/AI not surfaced as distinct skills in this run.

## Preview

- Before 9B.2: PARTIAL_PROFILE (Field only)
- After 9D: **PROFILE_AVAILABLE** (`person-camilo`)
- Field: Ingeniería de Software
- Specialties: Frontend + Backend
- Descriptor: Perfil Full Stack
- evidenceVolume: HIGH

## Decision

**SOFTWARE_PROFILE_MODEL_ACCEPTED**

Next: PROCESS_NEXT_REAL_PERSON
