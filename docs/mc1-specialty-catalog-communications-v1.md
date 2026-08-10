# MC1 — Specialty catalog COMMUNICATIONS v1.0.0

**Fase:** 11B  
**Estado:** ACTIVE (foundation; apply in 11C)  
**Field:** `COMMUNICATIONS`  
**JSON:** `src/mc-pipeline/catalog/mc1-specialties-communications-v1.json`

## Principio

| Nivel | Pregunta |
| --- | --- |
| Professional Field | ¿Práctica de comunicar (informar, narrar, representar, relacionar)? |
| Specialty | ¿Qué tipo reconocible de profesional de la comunicación? |
| Skill | ¿Qué capacidad concreta demuestra? |
| Dimension | ¿En qué aspecto se concentra la evidencia? |

**No** crear `CONTENT_PRESENTER` / `HOST` / `ON_CAMERA_PRESENTATION` como Specialty.  
**No** convertir tools en specialties.

## Specialties V1

| Code | Nombre |
| --- | --- |
| `CORPORATE_COMMUNICATIONS` | Comunicación corporativa / institucional |
| `DIGITAL_COMMUNICATIONS` | Comunicación digital |
| `PUBLIC_RELATIONS` | Relaciones públicas |
| `JOURNALISM` | Periodismo |

## Excluidos / diferidos

| Concepto | Destino |
| --- | --- |
| CONTENT_COMMUNICATION | REJECT (genérico) |
| ON_CAMERA_PRESENTATION / HOST / CONTENT_PRESENTER | Skill / capability |
| INTERNAL_COMMUNICATIONS | MERGE → CORPORATE_COMMUNICATIONS |
| COPYWRITING | Skill |
| COMMUNITY_COMMUNICATION | skills bajo DIGITAL_COMMUNICATIONS |

## Dimensiones de radar

`COMM_MESSAGE_NARRATIVE`, `COMM_ORAL_PRESENTATION`, `COMM_WRITING`, `COMM_AUDIENCE_RELATIONS`, `COMM_PLANNING`, `COMM_DIGITAL_CHANNELS`, `COMM_SPOKESPERSONSHIP`

Ver foundation `docs/mc1-communications-specialty-foundation-11b.md`.
