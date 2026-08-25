# Operación y mantenimiento (Backend)

> Sync Drive, CLI MC1, permisos, diagnóstico API/DB.

[← Anterior](./09-deploy.md) · [Índice](./README.md)

Síntomas de UI / mapa: [Frontend — troubleshooting](https://github.com/DesarrolloFabrica/Organigrama_Frontend/blob/main/documentacion/09-operacion-y-troubleshooting.md).

## Troubleshooting rápido

| Síntoma | Dónde empezar |
|---------|----------------|
| Persona no aparece en el mapa | ¿Activa en `core.person`? ¿Relación en `org_visual_relation` / versión? `org-chart-tree.engine.ts`. [05](./05-organigrama-api.md) |
| Organigrama “incorrecto” | ¿Versión / overrides? ¿Legacy 410? `ORG_CHART_LEGACY_ENABLED` |
| CV no aparece | `sync:drive-cv`; match por documento; ¿viewer con ficha completa? Denegación = `{ hasCv: false }`. [06](./06-perfiles-cv-y-video.md) / [04](./04-autenticacion-y-permisos.md) |
| Video no aparece / no reproduce | Metadatos JWT vs ticket caducado; `person_video`; secreto ≠ JWT. [06](./06-perfiles-cv-y-video.md) |
| Competencias vacías en ficha | ¿Store? ¿Fallback PA2? ¿403 full profile? [07](./07-competencias-mc1.md) |
| Buscador sin gente | Universo + solo store; PA2-only no sale. [08](./08-buscador-competencias-api.md) |
| Permisos raros tras grant | Re-login (JWT). ¿`ORG_READ_ALL` vs solo `ORG_ADMIN`? [04](./04-autenticacion-y-permisos.md) |
| MC1 “no publicado” | No hay Publisher HTTP; CLI/escritura al store. Ver freeze Gemini abajo |

## Principios

- Cloud SQL = verdad de producto. **MDE no publica**.
- `mc1_local` (`:5433`) **≠** MDE (`:5434`).
- Pipeline MC1 **no** se dispara por HTTP.
- Tras cambiar `core.person_permission` → **re-login**.

## Organigrama

| Tarea | Cómo |
|-------|------|
| Permiso técnico global | `npm run org:grant-admin -- <correo@cun.edu.co>` |
| Snapshot de versión | `POST /api/org-chart/versions/snapshot` (allowlist) |
| Comparar versiones | `GET /api/org-chart/versions/compare` |
| Legacy 410 | `ORG_CHART_LEGACY_ENABLED=false` en Cloud Run |

## CV

```bash
npm run diag:drive-cv
npm run sync:drive-cv
```

Match **solo** por número de documento al inicio del filename.

Extracción / enrich / evidence (CLI, `GEMINI_API_KEY`):

```bash
npm run extract:cv-skills
npm run enrich:cv-skills
npm run evaluate:cv-evidence
```

Solo lectura: `mc:reconcile-drive-cv`, `mc:audit-extraction-lifecycle`.

## Video

```bash
npm run diag:drive-video
npm run plan:drive-video
npm run sync:drive-video
```

Runtime: fila activa en `organigrama.person_video` + ticket.

## MC1 — ejecución

```text
P0 → P1 → P2 → R1 → P3 → P4 → Profile/Gate → store
```

| Script | Etapa |
|--------|--------|
| `mc:p2-functional-pilot-7d` | P2 |
| `mc:r1-field-resolution-8a` | R1 |
| `mc:p3-specialty-discovery-8b` | P3 |
| `mc:p4-skill-discovery-8d` | P4 |
| `mc:profile-pilot-8e` / `mc:profile-validation-8f` | Profile |

PA2: `mc:catalog`, `mc:evaluate`, `mc:activate-competencies`, curated import/rollback.

**No existe** `McProfilePublisher`. Publicar = writers/scripts al store (o PA2 en transición).

Campañas locales **prohibidas** como escritura a Cloud. `MC1_SHADOW_*` off en producción.

## Coste Gemini — política vigente

Cerrada **2026-08-18** (`COST_OPTIMIZATION_CLOSED_KEEP_CAMILO_ONLY`). Hasta revocación explícita:

| Regla | Estado |
|-------|--------|
| Skip Gemini general en producción / Cloud | **NO APROBADO** |
| Allowlist “solo Camilo” | **NO activar** |
| Reuso por fingerprint exacto (P1–P4) | Permitido si input idéntico |
| Semantic reuse / shadow / skip determinista | **EXPERIMENTAL**; no en Cloud Run |
| Procesar en masa `MISSING_PROFILE` | **NO**, salvo campaña aprobada |

El número **141** `MISSING_PROFILE` es snapshot del corte 2026-08-18, no inventario eterno. Antes de runners masivos contra Cloud: confirmar freeze o excepción escrita.

## Baseline / dump (MDE)

Rol propuesto `mc1_baseline_reader`: SELECT-only, sin password en git. App Cloud Run y Cloud SQL pueden estar en proyectos distintos; pedir connection name al ops.

## Checklist post-cambio

1. Health `/api/health` (+ `/db` si aplica).
2. Legacy 410 si prod.
3. Un flujo autenticado: root + ficha.
4. Si tocó Drive: diag sync.
5. Si tocó MC1: store activo + people-search sample.

[← Anterior](./09-deploy.md) · [Índice](./README.md)
