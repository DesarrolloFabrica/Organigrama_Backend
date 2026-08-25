# Entorno local (Backend)

> Cómo levantar el API y PostgreSQL. El Frontend se ejecuta en su propio repo.

[← Anterior](./01-arquitectura.md) · [Índice](./README.md) · [Siguiente →](./03-base-de-datos.md)

## Secuencia

```text
clone Backend → .env → PostgreSQL (schemas core/organigrama)
  → npm install → npm run start:dev → GET /api/health
```

El Frontend ([guía](https://github.com/DesarrolloFabrica/Organigrama_Frontend/blob/main/documentacion/02-entorno-local.md)) apunta a `VITE_API_BASE_URL=http://localhost:3000`.

**Acceso corporativo:** persona `@cun.edu.co` en `core.person`, `GOOGLE_CLIENT_ID`, base con datos reales (dump o instancia de desarrollo). Drive/Gemini solo para CLI de sync/extracción.

## Requisitos

| Requisito | Notas |
|-----------|--------|
| Node.js **22** | Igual que Dockerfile |
| PostgreSQL 16+ | App. MDE MC1 usa 18 en Docker aparte |
| Cuenta Google institucional | En `core.person` |

## Entornos (no mezclar)

| Nombre | Puerto | Uso |
|--------|--------|-----|
| App | API **3000**, PG **5432** | Producto local |
| MDE | `127.0.0.1:5434` | Experimentos MC1; **no** publica |
| `mc1_local` | `:5433` | **No** es el MDE |

## Variables (`.env` desde `.env.example`)

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=<DB_USER>
DB_PASSWORD=<DATABASE_PASSWORD>
DB_NAME=<DATABASE_NAME>
DB_SYNCHRONIZE=false
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
GOOGLE_CLIENT_ID=<GOOGLE_CLIENT_ID>
AUTH_JWT_SECRET=<YOUR_SECRET>
DEV_LOGIN_ENABLED=true
ORG_CHART_LEGACY_ENABLED=true
```

Otras: `PERSON_VIDEO_STREAM_TICKET_SECRET` (≥32, ≠ JWT), `GOOGLE_DRIVE_CV_TOKEN_PATH`, `ORG_ADMIN_EMAILS`, `ORG_CHART_VERSION_ADMIN_EMAILS`, `ORG_TECHNICAL_EMAILS`, `GEMINI_API_KEY` (CLI), `MC1_SHADOW_RESOLVER_ENABLED` (false).

Producción: `DEV_LOGIN_ENABLED` no `true`; `ORG_CHART_LEGACY_ENABLED=false`.

## PostgreSQL y migraciones

`docker-compose.yml` levanta Postgres 16 con base `organigrama`. Producción usa base **`core`**. Apunta `DB_*` al cluster **donde existan** schemas `core` + `organigrama`.

```bash
psql "<CONNECTION>" -v ON_ERROR_STOP=1 -f migrations/001_person_profile_state.sql
```

Lista: `migrations/001_*.sql` … `028_*.sql`. Nunca migrar Cloud desde MDE. `DB_SYNCHRONIZE=false` en bases compartidas/prod.

## Arranque

```bash
cp .env.example .env
# editar secretos
npm install
npm run start:dev
```

| Script | Uso |
|--------|-----|
| `npm run start:dev` | Nest watch |
| `npm run build` / `npm start` | Compilado |
| `npm test` | Jest |
| `npm run org:grant-admin` | Permisos técnicos |

Health: `GET http://localhost:3000/api/health` (+ `/db`, `/live`).

Login: Google vía Frontend, o `POST /api/auth/dev-login` solo si `NODE_ENV=development` **y** `DEV_LOGIN_ENABLED=true` (si no → **404**).

## MDE (opcional)

```bash
docker compose -f docker-compose.mc1-mde.yml --env-file secrets/mc1-mde.local.env up -d
```

No apuntes el API de producto a `:5434`. Detalle: [10-operacion-y-mantenimiento.md](./10-operacion-y-mantenimiento.md).

[← Anterior](./01-arquitectura.md) · [Índice](./README.md) · [Siguiente →](./03-base-de-datos.md)
