# FASE 11C — COMMUNICATIONS FOUR PERSON VALIDATION

Git-safe. Upstream P0–R1 reused from 11A. Catálogo COMM V1 / unified **1.6.0** unchanged post-run. Mapper COMM añadido **antes** de observar resultados (no optimizado después).

## Cohort

| caseId | snapshot | personId | R1 |
| --- | --- | --- | --- |
| person-katherin-araque | 16 | 1212 | MULTI_FIELD MKT primary + COMM secondary |
| person-danna-fierro | 17 | 1213 | MULTI_FIELD COMM primary + AV secondary |
| person-linda-aguilera | 18 | 1350 | MULTI_FIELD COMM primary + MKT + AV secondary |
| person-alejandra-sanabria | 19 | 1349 | MULTI_FIELD COMM primary + AV secondary |

## P3 (OBSERVED; WEAK noted)

| persona | Field | Specialty | estado | confidence |
| --- | --- | --- | --- | --- |
| Katherin | COMMUNICATIONS | CORPORATE_COMMUNICATIONS | OBSERVED | 0.85 |
| Katherin | COMMUNICATIONS | DIGITAL_COMMUNICATIONS | OBSERVED | 0.88 |
| Danna | COMMUNICATIONS | CORPORATE_COMMUNICATIONS | OBSERVED | 0.88 |
| Danna | COMMUNICATIONS | DIGITAL_COMMUNICATIONS | OBSERVED | 0.85 |
| Danna | AUDIOVISUAL_PRODUCTION | VIDEO_PRODUCTION | OBSERVED | 0.85 |
| Danna | AUDIOVISUAL_PRODUCTION | VIDEO_POST_PRODUCTION | WEAK | 0.65 |
| Linda | COMMUNICATIONS | CORPORATE_COMMUNICATIONS | OBSERVED | 0.88 |
| Linda | COMMUNICATIONS | DIGITAL_COMMUNICATIONS | OBSERVED | 0.92 |
| Linda | COMMUNICATIONS | PUBLIC_RELATIONS | WEAK | 0.55 |
| Linda | AUDIOVISUAL_PRODUCTION | VIDEO_PRODUCTION | OBSERVED | 0.85 |
| Linda | AUDIOVISUAL_PRODUCTION | VIDEO_POST_PRODUCTION | OBSERVED | 0.85 |
| Alejandra | COMMUNICATIONS | JOURNALISM | OBSERVED | 0.90 |
| Alejandra | COMMUNICATIONS | CORPORATE_COMMUNICATIONS | OBSERVED | 0.85 |
| Alejandra | COMMUNICATIONS | DIGITAL_COMMUNICATIONS | OBSERVED | 0.88 |
| Alejandra | AUDIOVISUAL_PRODUCTION | VIDEO_PRODUCTION | OBSERVED | 0.85 |
| Alejandra | AUDIOVISUAL_PRODUCTION | VIDEO_POST_PRODUCTION | OBSERVED | 0.88 |

DIGITAL_MARKETING: sin catálogo Specialty → gap (Katherin primary / Linda secondary). No inventado en 11C.

## Radar COMM (relativeCoverage)

| persona | Narrative | Oral | Writing | Audience | Planning | Digital | Spokesperson | evidenceVolume |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Katherin | 0 | 0 | 0 | 0 | 0 | **100** | 63.9 | HIGH (15) |
| Danna | 0 | 41.2 | 0 | 0 | 0 | **100** | 55.4 | HIGH (12) |
| Linda | 0 | 0 | 0 | 0 | 0 | **100** | 72.1 | HIGH (14) |
| Alejandra | **100** | 0 | 59.9 | 47.7 | 0 | 74.7 | 0 | HIGH (13) |

## Presentación frente a cámara

| persona | Skill emitida | Field | dimensión oral COMM | resultado |
| --- | --- | --- | --- | --- |
| Katherin | (ninguna) | — | 0 | Correcto (señal baja 11A) |
| Danna | `event_hosting_and_moderation` | COMMUNICATIONS | 41.2 | Skill COMM, no Specialty |
| Linda | `on_camera_presentation_and_voiceover` | AUDIOVISUAL_PRODUCTION | 0 | Skill AV, no Specialty |
| Alejandra | `on_camera_presentation_and_hosting` | AUDIOVISUAL_PRODUCTION | 0 | Skill AV (+ tool Teleprompter), no Specialty |

Nunca Specialty CONTENT_PRESENTER / HOST.

## Clasificación humana (agente)

| persona | clasificación | notas |
| --- | --- | --- |
| Katherin | PARTIAL_REPRESENTATION | MKT primary gap; COMM secondary Corporate+Digital; skills digitales con tinte campaña/analytics |
| Danna | GOOD_REPRESENTATION | COMM primary claro; oral/conducción en COMM; AV production/post separado |
| Linda | PARTIAL_REPRESENTATION | COMM fuerte; PR WEAK correcto; on-camera bajo AV; MKT gap |
| Alejandra | PARTIAL_REPRESENTATION | Journalism diferencia el perfil; on-camera bajo AV; skill `digital_marketing_*` léxico MKT bajo COMM |

## Validaciones obligatorias

1. COMMUNICATIONS produce perfiles diferentes: **sí** (Alejandra Journalism + Narrative; otras Digital-dominant; oral solo Danna en COMM)
2. Presentación frente a cámara = Skill, no Specialty: **sí**
3. DIGITAL_COMMUNICATIONS ≠ Marketing automático: **parcial** (specialty COMM distinta; léxico campaña/analytics a veces se cuela en skills)
4. AV permanece separado: **sí** (fields, specialties, tools)
5. Corporate/PR/Journalism no forzados: **sí** (PR solo WEAK Linda; Journalism solo Alejandra)
6. Tools separadas: **sí** (Canva, redes, CapCut, Premiere, Teleprompter, SEO…)
7. Cuatro personas no artificialmente iguales: **sí**

## Decisión

**COMMUNICATIONS_CATALOG_GENERALIZES**

Observaciones sin corrección de catálogo en 11C:
- Atribución P4 de on-camera a AV cuando MULTI_FIELD COMM+AV (Linda/Alejandra) — frontera aceptable; radar oral COMM solo si la skill cae en COMM.
- Léxico MKT residual en algunas skills DIGITAL_COMM — seguimiento en expansión Marketing, no cambio COMM V1.
- Ejes Narrative/Writing/Planning a menudo 0 por naming de skills + heurística mapper — no optimizar mapper post-resultado.

## Artefactos

- Script: `scripts/mc1-communications-cohort-11c.ts`
- Report: `tmp/mc1-communications-cohort-11c/cohort-report.json`
- Preview Grupo E + bindings snaps 16–19
- person-snapshot-index: 1212 / 1213 / 1350 / 1349

## Próxima fase recomendada

**NEXT_FIELD_DISCOVERY_OR_DIGITAL_MARKETING_EXPANSION**
