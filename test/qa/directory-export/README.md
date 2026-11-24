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
  -n core -n organigrama -n vacancies > schema.sql
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
for f in 00_marcar_base_qa 01_seed_sintetico 02_alias_cuenta_desarrollo 03_catalogos_completos 04_perfiles_desarrollo 05_presentaciones_mc1 06_casos_relaciones; do
  docker cp test/qa/directory-export/$f.sql organigrama-qa-exports:/tmp/$f.sql
  docker exec organigrama-qa-exports psql -U qa -d organigrama_qa -v ON_ERROR_STOP=1 -f /tmp/$f.sql
done
```

- `00`: marca la base como no productiva (`organigrama.environment = qa`); requisito del acceso por correo. Reiniciar el backend QA después.
- `01`: planta sintética. Se niega a correr si `core.person` contiene
  personas no sintéticas. Incluye la raíz `1144` porque el backend fija la
  raíz del mapa en `ORG_CHART_ROOT_PERSON_ID`.
- `02`: alias de ingreso de desarrollo `desarrollofabrica@cun.edu.co` →
  persona ficticia 900199, **sin** ORG_ADMIN ni permisos implícitos.
- `03`: catálogos y skills sintéticos para que el Excel tenga las 26
  columnas con valor.
- `04`: perfiles de desarrollo (usuario general y exportadores HTML/Excel/ambos) y videos ficticios.
- `05`: perfiles MC1 **publicados** sintéticos (`organigrama.mc1_person_profile_presentation`)
  para el **Explorador de Competencias**: Analista Uno y Dos (Ingeniería de
  software), Exportador Ambos (Gestión de proyectos). La Directora queda **sin**
  perfil publicado a propósito: con perfil publicado, la pestaña Competencias
  muestra la vista de perfil profesional en lugar del radar del motor, y así QA
  cubre las dos vistas.
  Se regenera con `node test/qa/directory-export/mc1/generar-presentaciones-mc1.js`
  (valida cada payload con el validador real del backend; requiere `dist`).
  Se niega a correr si la base no está marcada como QA.
- `06`: casos de relaciones que el exportador debe representar como el mapa:
  persona con **dos jefes** (con override de cargo por arista en una sola
  ubicación), persona con **jefe inactivo** (y su equipo), **hijo por
  posición** y un **overlay de coordinación** activo (raíz 900104, sin equipo
  en la versión global) con override de cargo por persona: DOCENTE en la
  versión global y COORDINADOR en el overlay (debe ganar el overlay).

> **No usar** `scripts/mc1-import-person-profile-presentation.ts` para QA:
> ese script siempre lee el `.env` de la raíz del repositorio, que en el
> worktree apunta a **producción**.

Competencias MC1 sintéticas de la pestaña «Competencias» (motor real, desde
el directorio QA):

```bash
node <repo>/dist/database/scripts/mc-catalog-seed.js --seed --activate --i-confirm-seed
node <repo>/dist/database/scripts/mc-mappings-seed.js --seed --i-confirm-seed
for f in test/qa/directory-export/mc1/qa-mc1-*.json; do
  node <repo>/dist/database/scripts/mc-import-curated-profile.js --file=$f --execute --confirm
done
```

Guía de uso, perfiles y cambio de usuario: `DESARROLLO_LOCAL.md`.

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
# El código trae desarrollofabrica@ en la lista por defecto de versionamiento;
# en QA se restringe a una persona sintética para que el alias no la herede.
ORG_CHART_VERSION_ADMIN_EMAILS=qa_sintetico_directora@cun.edu.co
ORG_ADMIN_EMAILS=
```

En este equipo el directorio QA es `C:\dev\Organigrama\_integracion\qa-backend`
y el arranque/parada lo hace el lanzador oficial (ver
`C:\dev\Organigrama\_integracion\COMO-INICIAR.md`):

```powershell
cd C:\dev\Organigrama
.\organigrama iniciar qa      # Docker (si está detenido) + backend :3002 + frontend :5175
.\organigrama detener qa      # conserva el contenedor y sus datos
```

Equivalente manual (otro equipo):

```bash
node <repo>/dist/main.js            # desde el directorio QA
VITE_API_BASE_URL=http://localhost:3002 \
VITE_ORG_CHART_VERSION_ADMIN_EMAILS=qa_sintetico_directora@cun.edu.co \
  npx vite --port 5175 --strictPort # frontend (modo dev: incluye el formulario de desarrollo)
```

## Ingreso manual

1. Abrir http://localhost:5175
2. En «Acceso dev (correo en base de datos)» escribir
   `desarrollofabrica@cun.edu.co` (o cualquier `qa_sintetico_*@cun.edu.co`)
   y pulsar **Entrar con correo**.

El formulario solo existe en `vite dev` y el endpoint `/api/auth/dev-login`
responde 404 con `NODE_ENV=production`: no llega a builds productivos.

## 5. Permisos y comprobaciones

```bash
# desde el directorio QA (usa su .env)
node <repo>/dist/database/scripts/grant-directory-export.js qa_sintetico_analista1@cun.edu.co --format=html --dry-run
node <repo>/dist/database/scripts/grant-directory-export.js qa_sintetico_analista1@cun.edu.co --format=html
node <repo>/dist/database/scripts/grant-directory-export.js qa_sintetico_directora@cun.edu.co --format=both
node <repo>/dist/database/scripts/grant-directory-export.js qa_sintetico_directora@cun.edu.co --format=html --revoke
node <repo>/dist/database/scripts/grant-directory-export.js desarrollofabrica@cun.edu.co --format=both   # alias QA
```

Esperado:

| Usuario | Permisos | HTML | Excel | Botones |
|---|---|---|---|---|
| sin permisos | — | 403 | 403 | ninguno |
| administrador (`ORG_ADMIN`) | sin específicos | 403 | 403 | ninguno |
| analista | HTML | 200 | 403 | HTML |
| directora | ambos | 200 | 200 | ambos |
| directora tras `--revoke html` (mismo JWT) | Excel | 403 inmediato | 200 | Excel (tras 403: "Acceso denegado") |

Informes: 8 personas activas en la planta sintética (9 con el alias de `02`), sin el docente ni la
persona inactiva. Auditoría en `organigrama.org_chart_directory_export_audit`
(SUCCESS / DENIED con versión y filas, sin datos personales).

Archivos de referencia generados así: `samples/`.

## 6. Limpieza

```bash
docker rm -f organigrama-qa-exports
```
