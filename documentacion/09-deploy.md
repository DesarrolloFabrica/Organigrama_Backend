# Deploy (Backend)

> Build Docker, Cloud Run, migraciones, smoke y rollback del API.

[← Anterior](./08-buscador-competencias-api.md) · [Índice](./README.md) · [Siguiente →](./10-operacion-y-mantenimiento.md)

Deploy del SPA: [Frontend — deploy](https://github.com/DesarrolloFabrica/Organigrama_Frontend/blob/main/documentacion/08-deploy.md).

El deploy es **manual**. No hay `cloudbuild.yaml` de producto en este repo.

## Fases

| Fase | Tipo | Qué hacer |
|------|------|-----------|
| **BUILD** | MANUAL | `docker build` Backend |
| **MIGRATION** | CLI / MANUAL | `psql` de `migrations/*.sql` contra Cloud SQL si aplica |
| **DEPLOY** | MANUAL | Push imagen + `gcloud run` / env / secretos + tráfico 100 % |
| **POST-DEPLOY** | CLI / MANUAL | Smoke health, legacy 410, root |
| **ROLLBACK** | MANUAL | Tráfico Cloud Run a revisión anterior |

Servicio típico: imagen Node 22 Alpine; `node dist/main.js` en **8080** (`PORT` lo inyecta Cloud Run). Región habitual `us-central1`. API y Cloud SQL **pueden** estar en proyectos GCP distintos.

## Build

```bash
docker build -t organigrama-backend:<TAG> .
```

No copia `.env` a la imagen. Secretos → Cloud Run + Secret Manager.

Checklist: [docs/DEPLOY_PRODUCCION.md](../docs/DEPLOY_PRODUCCION.md).

## Variables de producción (nombres)

No pegar valores reales.

| Variable | Notas |
|----------|--------|
| `NODE_ENV=production` | |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` | Cloud SQL; `DB_NAME` típico `core` |
| `DB_SYNCHRONIZE=false` | Obligatorio |
| `AUTH_JWT_SECRET` | Obligatorio |
| `GOOGLE_CLIENT_ID` | Mismo cliente que el FE |
| `CORS_ORIGIN` | Origen HTTPS del frontend |
| `ORG_CHART_LEGACY_ENABLED=false` | Si falta/vacío → legacy **habilitado** |
| `DEV_LOGIN_ENABLED` | No `true` |
| `PERSON_VIDEO_STREAM_TICKET_SECRET` | ≥32 chars; **≠** `AUTH_JWT_SECRET` |
| `GOOGLE_DRIVE_CV_TOKEN_PATH` | Ver Secret Manager |
| `ORG_ADMIN_EMAILS` / `ORG_CHART_VERSION_ADMIN_EMAILS` / `ORG_TECHNICAL_EMAILS` | |
| `MC1_SHADOW_*` | **Ausentes** en prod |

## Secret Manager

| Ítem | Configuración |
|------|---------------|
| Nombre | `organigrama-google-drive-oauth-token` |
| Montaje | `/secrets/google-drive-token.json` |
| Env | `GOOGLE_DRIVE_CV_TOKEN_PATH=/secrets/google-drive-token.json` |
| IAM | SA Cloud Run con `secretmanager.secretAccessor` |

## Migraciones

Aplicar `migrations/*.sql` con `psql` contra Cloud SQL **antes** o en ventana acordada, **nunca** desde MDE. Orden: `001` … `028`. No hay script npm de producto que las aplique todas.

## Secuencia típica

1. Migraciones si el corte las requiere.
2. Imagen + env + secreto Drive + `ORG_CHART_LEGACY_ENABLED=false`.
3. Smoke API.
4. Coordinar rebuild FE con URL del backend ya desplegado.

## Smoke

Sustituye `<API>` y `<TOKEN>`.

| Check | Esperado |
|-------|----------|
| `GET <API>/api/health` | 200 |
| `GET <API>/api/health/live` | JSON ok (expone `dbHost`, no password) |
| `GET <API>/api/health/db` | 200 si SQL responde |
| `GET <API>/api/org-chart` con JWT | **410** |
| `GET <API>/api/org-chart/team/<id>` con JWT | **410** |
| Sin JWT en legacy | **401** |
| `GET <API>/api/org-chart/root` con JWT | 200 |
| `GET …/competency-people-search` sin JWT | 401 |
| `GET …/person/:id/video` sin JWT | 401 |

## Qué no desplegar

- Flags shadow / skip Gemini / authority canary.
- Apuntar el API de producto al Postgres MDE (`:5434`).
- Árboles `*_isolated` como fuente de verdad.

[← Anterior](./08-buscador-competencias-api.md) · [Índice](./README.md) · [Siguiente →](./10-operacion-y-mantenimiento.md)
