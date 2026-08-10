# FASE 10C — AUDIOVISUAL THREE PERSON VALIDATION

Git-safe. Upstream P0–R1 reused from 10A. Catalog AV V1 / unified **1.5.0** unchanged post-run.

## Cohort

| caseId | snapshot | personId | R1 |
| --- | --- | --- | --- |
| person-santiago-vanegas | 13 | 1172 | MULTI_FIELD AV + VD |
| person-juan-pablo-sanabria | 14 | 1176 | MULTI_FIELD VD + AV |
| person-camilo-ramirez | 15 | 1221 | RESOLVED AV |

## P3 (OBSERVED shown; WEAK noted)

| persona | Specialty | estado | confidence |
| --- | --- | --- | --- |
| Santiago | VIDEO_PRODUCTION | OBSERVED | 0.90 |
| Santiago | VIDEO_POST_PRODUCTION | OBSERVED | 0.95 |
| Santiago | PHOTOGRAPHY | WEAK | 0.50 |
| Santiago | MOTION_DESIGN (VD) | OBSERVED | 0.95 |
| Santiago | GRAPHIC_DESIGN (VD) | OBSERVED | 0.85 |
| Juan Pablo | VIDEO_PRODUCTION | OBSERVED | 0.90 |
| Juan Pablo | PHOTOGRAPHY | OBSERVED | 0.90 |
| Juan Pablo | VIDEO_POST_PRODUCTION | WEAK | 0.75 |
| Juan Pablo | AUDIO_PRODUCTION | WEAK | 0.75 |
| Juan Pablo | GRAPHIC_DESIGN (VD) | OBSERVED | 0.95 |
| Juan Pablo | BRAND_IDENTITY_DESIGN (VD) | OBSERVED | 0.90 |
| Juan Pablo | MOTION_DESIGN (VD) | WEAK | 0.75 |
| Camilo Ramírez | VIDEO_PRODUCTION | OBSERVED | 0.95 |
| Camilo Ramírez | PHOTOGRAPHY | OBSERVED | 0.85 |
| Camilo Ramírez | VIDEO_POST_PRODUCTION | WEAK | 0.72 |

## Radar AV (relativeCoverage)

| persona | Preprod | Captura | Producción | Edición | Acabado | Audio | Entrega | evidenceVolume |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Santiago | 0 | 45.7 | 45.7 | **100** | 54.3 | 45.7 | 0 | MEDIUM (7) |
| Juan Pablo | 0 | 46.4 | 0 | **100** | 39.8 | 53.6 | 0 | MEDIUM (9) |
| Camilo Ramírez | 52.8 | **100** | 56.3 | 18.3 | 0 | 100* | 0 | HIGH (16) |

\*Camilo `AV_AUDIO=100` es **falso positivo del mapper**: regex `/audio/` coincide con la subcadena de “audiovisual”. **No corregido en 10C** (no optimizar post-resultado).

## Clasificación humana (agente)

| persona | clasificación | notas |
| --- | --- | --- |
| Santiago | GOOD_REPRESENTATION | AV primary + VD secondary; post fuerte; motion en VD |
| Juan Pablo | PARTIAL_REPRESENTATION | VD primary claro; AV secondary ok; skill motion bajo VIDEO_PRODUCTION (frontera) |
| Camilo Ramírez | GOOD_REPRESENTATION / PARTIAL por radar Audio | AV dominante captura/producción; Audio radar inflado por mapper |

## Validaciones obligatorias

1. Perfiles AV diferentes: **sí**
2. VIDEO_PRODUCTION vs POST distinguibles: **sí** (Santiago ambas; JP/Camilo prod OBSERVED, post WEAK)
3. PHOTOGRAPHY solo con práctica: **sí** (Santiago WEAK; JP/Camilo OBSERVED)
4. AUDIO_PRODUCTION solo con práctica: **sí** (solo JP WEAK; nadie OBSERVED)
5. Motion bajo VD: **parcial** — Specialty MOTION_DESIGN en Santiago (VD); JP skill motion bajo AV VIDEO_PRODUCTION
6. Marketing/Comms fuera: **sí** (no en R1 evaluado / no specialties)
7. Tools separadas: **sí** (Premiere, Resolve, AE, CapCut, Blender, etc. como signals)

## Decisión

**ONE_TARGETED_CORRECTION_REQUIRED** — corregir mapper `audio` vs `audiovisual` (word-boundary). Catálogo AV no se toca.

Opcional seguimiento: atribución P4 de motion skills bajo VIDEO_PRODUCTION cuando MOTION_DESIGN es WEAK en VD.

## Artefactos

- Report: `tmp/mc1-audiovisual-cohort-10c/cohort-report.json`
- Preview Grupo D + bindings snaps 13–15
- person-snapshot-index: 1172/1176/1221
