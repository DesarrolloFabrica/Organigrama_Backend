# QA aislado de los exportadores HTML / Excel

Valida permisos (`ORG_DIRECTORY_EXPORT_HTML` / `ORG_DIRECTORY_EXPORT_XLS`),
el script `org:grant-directory-export`, la auditoría (migración 040) y las
descargas, **sin tocar producción**: base PostgreSQL desechable en Docker con
el esquema real (solo estructura) y datos 100 % sintéticos.

## 1. Base desechable

```bash
docker run -d --name organigrama-qa-exports \
  -e POSTGRES_USER=qa -e POSTGRES_PASSWORD=qa_local_only -e POSTGRES_DB=organigrama_qa \
  -p 127.0.0.1:5434:5432 postgres:18
```

## 2. Esquema (sin datos)

Copiar solo la **estructura** de `core` y `organigrama` (incluye las funciones
de Planta y excepciones). Es de solo lectura sobre el origen y no trae filas:

```bash
# Variables PG* del origen en un archivo temporal (borrarlo después):
#   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, PGSSLMODE=require,
#   PGOPTIONS=-c default_transaction_read_only=on
docker run --rm --env-file origen-solo-lectura.env postgres:18 \
  pg_dump --schema-only --no-owner --no-privileges --no-comments \
  -n core -n organigrama > schema.sql
grep -cE '^(INSERT|COPY) ' schema.sql   # debe ser 0
```

Restaurar y aplicar la migración nueva (Git Bash: `export MSYS_NO_PATHCONV=1`):

```bash
docker cp schema.sql organigrama-qa-exports:/tmp/schema.sql
docker exec organigrama-qa-exports psql -U qa -d organigrama_qa -v ON_ERROR_STOP=1 -q -f /tmp/schema.sql
docker cp migrations/040_org_chart_directory_export_audit.sql organigrama-qa-exports:/tmp/040.sql
docker exec organigrama-qa-exports psql -U qa -d organigrama_qa -v ON_ERROR_STOP=1 -f /tmp/040.sql
```

## 3. Datos sintéticos

```bash
docker cp test/qa/directory-export/01_seed_sintetico.sql organigrama-qa-exports:/tmp/seed.sql
docker exec organigrama-qa-exports psql -U qa -d organigrama_qa -v ON_ERROR_STOP=1 -f /tmp/seed.sql
```

El seed se niega a correr si `core.person` contiene personas no sintéticas.
Incluye la raíz `1144` porque el backend fija la raíz del mapa en
`ORG_CHART_ROOT_PERSON_ID`.

## 4. Backend contra la base QA

Usar un directorio de trabajo propio con un `.env` que apunte **solo** a
`127.0.0.1:5434` (nunca el `.env` del repo) y un enlace `src` al código
(los catálogos MC1 se leen de `src/`):

```
PORT=3002
DB_HOST=127.0.0.1
DB_PORT=5434
DB_NAME=organigrama_qa
DB_SCHEMA=core
DB_USERNAME=qa
DB_PASSWORD=qa_local_only
DB_SSL=false
AUTH_JWT_SECRET=<secreto solo QA>
DEV_LOGIN_ENABLED=true
CORS_ORIGIN=http://localhost:5175
PERSON_VIDEO_STREAM_TICKET_SECRET=<secreto solo QA>
```

```bash
node <repo>/dist/main.js            # desde el directorio QA
VITE_API_BASE_URL=http://localhost:3002 npx vite --port 5175   # frontend
```

## 5. Permisos y comprobaciones

```bash
# desde el directorio QA (usa su .env)
node <repo>/dist/database/scripts/grant-directory-export.js qa_sintetico_analista1@cun.edu.co --format=html --dry-run
node <repo>/dist/database/scripts/grant-directory-export.js qa_sintetico_analista1@cun.edu.co --format=html
node <repo>/dist/database/scripts/grant-directory-export.js qa_sintetico_directora@cun.edu.co --format=both
node <repo>/dist/database/scripts/grant-directory-export.js qa_sintetico_directora@cun.edu.co --format=html --revoke
```

Esperado:

| Usuario | Permisos | HTML | Excel | Botones |
|---|---|---|---|---|
| sin permisos | — | 403 | 403 | ninguno |
| administrador (`ORG_ADMIN`) | sin específicos | 403 | 403 | ninguno |
| analista | HTML | 200 | 403 | HTML |
| directora | ambos | 200 | 200 | ambos |
| directora tras `--revoke html` (mismo JWT) | Excel | 403 inmediato | 200 | Excel (tras 403: "Acceso denegado") |

Informes: 8 personas activas en la planta sintética, sin el docente ni la
persona inactiva. Auditoría en `organigrama.org_chart_directory_export_audit`
(SUCCESS / DENIED con versión y filas, sin datos personales).

## 6. Limpieza

```bash
docker rm -f organigrama-qa-exports
```
