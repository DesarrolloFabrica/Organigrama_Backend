# MC1 — Specialty catalog AUDIOVISUAL_PRODUCTION v1.0.0

**Fase:** 10B  
**Estado:** ACTIVE (foundation; apply in 10C)  
**Field:** `AUDIOVISUAL_PRODUCTION`  
**JSON:** `src/mc-pipeline/catalog/mc1-specialties-audiovisual-production-v1.json`

## Principio

| Nivel | Pregunta |
| --- | --- |
| Professional Field | ¿Produce obras audiovisuales temporales? |
| Specialty | ¿Qué tipo de profesional AV representa? |
| Skill | ¿Qué capacidad concreta demuestra? |
| Dimension | ¿En qué aspecto se concentra la evidencia? |

**No** convertir tools en specialties.  
**No** duplicar `VISUAL_DESIGN` / `MOTION_DESIGN` dentro de AV.

## Specialties V1

| Code | Nombre |
| --- | --- |
| `VIDEO_PRODUCTION` | Producción de video |
| `VIDEO_POST_PRODUCTION` | Postproducción de video |
| `PHOTOGRAPHY` | Fotografía |
| `AUDIO_PRODUCTION` | Producción de audio audiovisual |

## Excluidos / diferidos

| Concepto | Destino |
| --- | --- |
| Motion graphics | VISUAL_DESIGN → MOTION_DESIGN |
| Animation | DEFER (borde con VD) |
| Content production | REJECT (genérico) |
| Audiovisual direction | DEFER (capability) |
| Cinematography | skill cluster bajo VIDEO_PRODUCTION |
| Live/streaming | skill bajo VIDEO_PRODUCTION (V1) |

## Dimensiones de radar

`AV_PREPRODUCTION`, `AV_CAPTURE`, `AV_PRODUCTION_REALIZATION`, `AV_EDITING_MONTAGE`, `AV_VISUAL_FINISHING`, `AV_AUDIO`, `AV_DELIVERY`

Ver `docs/mc1-competency-map-dimensions.md` y foundation `docs/mc1-audiovisual-production-specialty-foundation-10b.md`.
