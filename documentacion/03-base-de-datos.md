# Base de datos

> Modelo conceptual: schemas, tablas relevantes y migraciones.

[← Anterior](./02-entorno-local.md) · [Índice](./README.md) · [Siguiente →](./04-autenticacion-y-permisos.md)

## Modelo mental

```text
PERSON (core)
  ├── ROLE / AREA / … (hierarchy.level ≠ mapa visual)
  ├── PERSON_PERMISSION (ORG_READ_ALL / ORG_ADMIN)
  ├── ORG_VISUAL_RELATION (árbol UI)
  ├── PERSON_PROFILE_STATE
  ├── PERSON_CV / PERSON_VIDEO
  └── MC1 store / PA2
```

## Schemas

| Schema | Rol |
|--------|-----|
| `core` | Personas, catálogos, permisos |
| `organigrama` | Árbol, perfil OP, CV, video, MC1 |
| `vacancies` | Vacantes |

TypeORM + SQL crudo (video/MC1 store). `DB_SYNCHRONIZE=false` en prod. Cambios: `migrations/*.sql` vía `psql`.

## ACTIVE — personas y árbol

- `core.person`, catálogos (`role`, `area`, …), `core.person_permission`
- `organigrama.org_visual_relation`, versiones, overrides
- `vacancies.vacancy`
- Motor: `src/org-chart/org-chart-tree.engine.ts`
- **LEGACY:** entity `OrgRelation` no alimenta el árbol

## ACTIVE — perfil, CV, video

- `person_profile_state` (onboarding)
- `person_cv` — metadatos; match Drive por **documento en filename**; sync `sync:drive-cv`
- `person_video` (mig. `025`) — sin entity TypeORM; solo `drive_file_id`

## MC1

| Pieza | Estado | Mig. |
|-------|--------|------|
| `mc1_person_profile_presentation` | **ACTIVE** producto + buscador | `028` |
| `mc_profile_evaluation` (+ specialty) | **LEGACY** fallback ficha | `018`–`023` |
| `mc_cv_snapshot` | **ACTIVE** P0 | `026` |
| `mc_p1_run` / `mc_evidence_*` | **ACTIVE** P1 CLI | `027` |
| `mc_pipeline_run` | **NO IMPLEMENTADO** | — |

Buscador: solo store. Ficha: store → fallback PA2.

## Migrar

1. Revisar `migrations/NNN_*.sql`
2. `psql` al destino correcto (nunca MDE → Cloud)
3. Versionar filas nuevas; no mutar catálogos publicados in-place ([política](../docs/mc1-domain-versioning-policy.md))

[← Anterior](./02-entorno-local.md) · [Índice](./README.md) · [Siguiente →](./04-autenticacion-y-permisos.md)
