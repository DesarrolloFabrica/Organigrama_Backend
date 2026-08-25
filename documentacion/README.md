# Organigrama Backend — documentación

> API NestJS de Organigrama OP: organigrama, fichas, CV, video, competencias (MC1) y permisos.

Este repositorio es la **autoridad de seguridad y datos**. El Frontend consume DTOs ya redactados.

Repositorio hermano: [Organigrama_Frontend](https://github.com/DesarrolloFabrica/Organigrama_Frontend) · su guía: [documentacion/](https://github.com/DesarrolloFabrica/Organigrama_Frontend/blob/main/documentacion/README.md).

## Lectura rápida

1. Prefijo HTTP: `/api`. Guard JWT global (salvo rutas `@Public`).
2. Datos: PostgreSQL schemas `core` + `organigrama` (+ `vacancies`).
3. MC1 en producto = **store** `mc1_person_profile_presentation` + reader; pipeline P1–P4 = **CLI**.
4. Video stream = `@Public` + **ticket** (no acceso abierto).
5. Legacy `GET /api/org-chart` y `/team/:id` → **410** si `ORG_CHART_LEGACY_ENABLED=false`.

## Stack

NestJS 11 · TypeORM · PostgreSQL · Google OAuth · Drive · Cloud Run · Secret Manager · Gemini (CLI)

## Estructura relevante

```text
src/
├── auth/              # Google → JWT, guards
├── org-chart/         # árbol, ficha, CV, video, competencies, people-search
├── mc-pipeline/       # P0 Nest + P1–P4/R1/profile (CLI)
├── mc-catalog/        # PA2 legado
├── profile/           # onboarding
└── main.ts            # prefijo /api, health/live
migrations/            # SQL 001…028
scripts/               # runners mc:* y utilidades
docs/                  # contratos/ops especializados (video, people-search, manifesto)
```

## Índice

| Tema | Documento |
|------|-----------|
| [Arquitectura](./01-arquitectura.md) | Módulos Nest, límites productivo/CLI/experimental |
| [Entorno local](./02-entorno-local.md) | Postgres, env, `start:dev` |
| [Base de datos](./03-base-de-datos.md) | Schemas y modelo conceptual |
| [Autenticación y permisos](./04-autenticacion-y-permisos.md) | JWT, `ORG_*`, matriz de acceso |
| [Organigrama API](./05-organigrama-api.md) | Endpoints lazy, versiones, legacy |
| [Perfiles, CV y video](./06-perfiles-cv-y-video.md) | Drive, tickets, stream |
| [Competencias MC1](./07-competencias-mc1.md) | Store, CLI, PA2, experimental |
| [Buscador API](./08-buscador-competencias-api.md) | People-search, facets, AND |
| [Deploy](./09-deploy.md) | Docker, Cloud Run, smoke |
| [Operación](./10-operacion-y-mantenimiento.md) | Sync, CLI, troubleshooting |

## Onboarding

1. [Entorno local](./02-entorno-local.md)
2. [Arquitectura](./01-arquitectura.md) + [BD](./03-base-de-datos.md)
3. [Permisos](./04-autenticacion-y-permisos.md)
4. [Organigrama API](./05-organigrama-api.md) + [CV/video](./06-perfiles-cv-y-video.md)
5. [MC1](./07-competencias-mc1.md) + [Buscador](./08-buscador-competencias-api.md)

Código: `src/app.module.ts`, `src/main.ts`.

## Glosario (Backend)

| Término | Significado |
|---------|-------------|
| **MC1** | Competencias por evidencia de CV |
| **PA2** | Agregador legado; fallback de ficha |
| **P0–P4 / R1** | Etapas de pipeline (CLI salvo P0 en Nest) |
| **Cloud Store** | `mc1_person_profile_presentation` |
| **Reader** | `readMc1PersonProfile` |
| **ORG_READ_ALL** | Visibilidad global de fichas |
| **Visual Relation** | `org_visual_relation` (mapa) |

[Siguiente →](./01-arquitectura.md)
