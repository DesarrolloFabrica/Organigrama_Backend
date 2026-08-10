# MC1 — Specialty catalog SOFTWARE_ENGINEERING v1.0.0

**Fase:** 9C  
**Estado:** ACTIVE (foundation; not yet applied via P3/P4)  
**Field:** `SOFTWARE_ENGINEERING`  
**JSON:** `src/mc-pipeline/catalog/mc1-specialties-software-engineering-v1.json`

## Principio

| Nivel | Pregunta |
| --- | --- |
| Professional Field | ¿Práctica de construcción/evolución de software? |
| Specialty | ¿Qué tipo reconocible de profesional/práctica de software? |
| Skill | ¿Qué capacidad concreta demuestra? |
| Dimension (radar) | ¿En qué aspecto se concentra la evidencia? |

**No** convertir dimensiones del radar en specialties.  
**No** convertir tools (React, NestJS, Docker, GCP, …) en specialties.

## Specialties V1

| Code | Nombre |
| --- | --- |
| `FRONTEND_ENGINEERING` | Ingeniería Frontend |
| `BACKEND_ENGINEERING` | Ingeniería Backend |
| `MOBILE_ENGINEERING` | Ingeniería de aplicaciones móviles |
| `PLATFORM_DEVOPS_ENGINEERING` | Platform / DevOps Engineering |

## Explicitamente fuera de V1

| Concepto | Destino |
| --- | --- |
| Full Stack | Co-observación FRONTEND + BACKEND |
| Software Architecture | Capability avanzada (skill futuro) |
| QA / Test Automation | Skill → dimensión Ingeniería y calidad |
| Data Engineering | Otro Field (DATA_ANALYTICS / Data) |
| AI Software Engineering | Dimensión `SE_APPLIED_AI` + skills |
| Bases de datos / APIs / Cloud como “specialty” | Dimensiones de radar |

## Dimensiones de radar (conservadas 8C)

`SE_FRONTEND`, `SE_BACKEND`, `SE_DATA_STORES`, `SE_APIS_INTEGRATION`, `SE_CLOUD_INFRA`, `SE_ENG_QUALITY`, `SE_APPLIED_AI`

Una specialty puede contribuir a varias dimensiones (ej. BACKEND → Backend, Bases de datos, APIs, Cloud, Calidad).

## Fronteras

- **vs IT_SYSTEMS:** operar/soportar infra ≠ construir software.
- **vs DATA_ANALYTICS:** usar SQL/dashboards/analizar ≠ ingeniería de software de producto.

Ver revisión completa: `docs/mc1-software-engineering-specialty-foundation-9c.md`.
