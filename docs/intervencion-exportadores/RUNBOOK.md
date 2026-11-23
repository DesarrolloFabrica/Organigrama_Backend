# Intervención: habilitar exportadores HTML/Excel con datos reales

> **Estado: PREPARADO, NO EJECUTADO.** Requiere autorización explícita antes
> de los pasos marcados ✍️ (escritura sobre Cloud SQL).

## Destino (verificado en solo lectura, 23-nov-2026)

| Dato | Valor |
|---|---|
| Proyecto de Google Cloud | número `550902908078` (Cloud Run `organigrama-backend-550902908078`, `organigrama-frontend-550902908078` y cliente OAuth `550902908078-…`) |
| Instancia Cloud SQL | IP pública `136.113.128.135`, puerto 5432 — **nombre de instancia: confirmarlo en la consola** (Cloud SQL → instancia con esa IP); `gcloud` local no funciona (falta Python) |
| Motor | PostgreSQL 18.6 |
| Base / esquemas | `core`; el backend usa `core`, `organigrama` y `vacancies` |
| Versión vigente | `id=4`, `periodo-agosto-2026`, «Versión actual»; sin overlays de coordinación; capa de excepciones disponible |
| Migración 040 | **no aplicada**; sin conflictos de nombres; privilegios suficientes |
| Permisos de exportación | **0** concedidos (`ORG_ADMIN` 3, `ORG_READ_ALL` 4, `ORG_CONTACT_READ_ALL` 2) |
| Informe esperado hoy | 196 personas (de 1.238 activas en el mapa; 1.042 excluidas por la regla de docentes/vacantes), 10 áreas, 1 raíz, 0 jefes fuera del informe |

## 0. Condiciones previas (obligatorias)

1. **Cuenta aprobada nominal.** Una persona concreta con correo propio
   `@cun.edu.co`. **No** usar la cuenta técnica compartida
   `desarrollofabrica@cun.edu.co`: la auditoría registraría las descargas a
   nombre de una cuenta que usan varias personas.
2. **Ingreso con Google, no con el acceso de desarrollo.** El backend local
   apunta a producción con `DEV_LOGIN_ENABLED=true`; con eso cualquiera que
   tenga el `.env` puede entrar como la persona autorizada sin Google. Para
   la prueba real, en `_integracion/backend/.env`:
   `DEV_LOGIN_ENABLED=false` y reiniciar el backend `:3001`.
3. **Liberar conexiones.** Cloud SQL tiene pocas conexiones disponibles; detener
   los backends locales que no se usen (p. ej. el de `main` en `:3000`).
4. Momento de baja carga.

## 1. Preparar el cliente `psql` (sin instalar nada)

Credenciales en un archivo temporal **fuera del repo** (no se versiona;
borrarlo al terminar):

```bash
# prod.env (ejemplo de contenido; valores del .env del backend)
PGHOST=136.113.128.135
PGPORT=5432
PGDATABASE=core
PGUSER=<DB_USERNAME>
PGPASSWORD=<DB_PASSWORD>
PGSSLMODE=require
PGAPPNAME=organigrama-intervencion-040
```

Desde `C:\dev\Organigrama\_integracion\backend` en Git Bash:

```bash
export MSYS_NO_PATHCONV=1
PSQL='docker run --rm -i --env-file /ruta/segura/prod.env -v C:/dev/Organigrama/_integracion/backend:/repo:ro postgres:18 psql -v ON_ERROR_STOP=1'
```

## 2. Pre-verificación (solo lectura)

```bash
$PSQL -c "SET default_transaction_read_only = on" -f /repo/docs/intervencion-exportadores/01_preverificacion.sql
```

Debe coincidir con los valores esperados del archivo. Si algo difiere, **parar**.

## 3. ✍️ Respaldo

Consola de Google Cloud → SQL → instancia `136.113.128.135` → **Backups** →
**Create backup** (on-demand), descripción `antes-040-exportadores`.
Con `gcloud` operativo:

```bash
gcloud sql backups create --instance=<INSTANCIA> --project=<PROYECTO> --description="antes-040-exportadores"
```

Anotar el ID del respaldo.

## 4. ✍️ Aplicar la migración 040

```bash
$PSQL -f /repo/migrations/040_org_chart_directory_export_audit.sql
```

- Crea `organigrama.org_chart_directory_export_audit` (+2 índices, 5 CHECK,
  FK a `core.person` y `organigrama.org_chart_version`) y documenta los
  códigos en los comentarios de `core.person_permission`.
- Idempotente: si se repite, solo avisa que los índices ya existen.
- Impacto: segundos; bloqueo breve (SHARE ROW EXCLUSIVE) sobre `core.person`
  y `organigrama.org_chart_version` al crear las FK. No modifica datos.
- El backend de Cloud Run actual no usa esta tabla: no cambia su comportamiento.

## 5. ✍️ Post-verificación

```bash
$PSQL -v person_id=<PERSON_ID_APROBADO> -f /repo/docs/intervencion-exportadores/02_postverificacion.sql
```

La parte B inserta una fila de prueba y la **revierte**; al final debe quedar
`filas_tras_prueba = 0`.

## 6. ✍️ Conceder ambos permisos a la cuenta aprobada

Desde `C:\dev\Organigrama\_integracion\backend` (usa su `.env`, que apunta a
producción). Usar `node dist/...` directamente (no `npm run`, que recompila
`dist` mientras el backend `:3001` lo está usando):

```bash
# a) Simulación, con la sesión forzada a solo lectura por el servidor
PGOPTIONS="-c default_transaction_read_only=on" \
  node dist/database/scripts/grant-directory-export.js <correo.aprobado@cun.edu.co> --format=both --dry-run

# b) Concesión real
node dist/database/scripts/grant-directory-export.js <correo.aprobado@cun.edu.co> --format=both
```

Esperado: `PERMISOS FINALES` = los previos + `ORG_DIRECTORY_EXPORT_HTML`,
`ORG_DIRECTORY_EXPORT_XLS`; ningún otro código cambia (si cambiara, el script
revierte la transacción y termina con error).

## 7. Validación funcional en `localhost:5174`

1. Cerrar sesión e ingresar **con Google** con la cuenta aprobada.
2. Ver la barra «Directorio activo» con **Descargar Excel** y **Descargar HTML**.
3. Descargar ambos archivos.
4. Coherencia (sin abrir datos personales en pantallas compartidas):
   - Excel: 196 filas de personas (± cambios de planta del día), título con
     «Versión actual · periodo-agosto-2026 (activa)».
   - HTML: las mismas personas por área (10 áreas).
5. Auditoría (solo metadatos):

```bash
$PSQL -c "SELECT person_id, export_format, result, version_id, row_count, created_at FROM organigrama.org_chart_directory_export_audit ORDER BY id DESC LIMIT 10"
```

   Esperado: 2 filas `SUCCESS`, `version_id = 4`, `row_count` = 196 (o el
   conteo del día) para ambos formatos.

6. Cuentas no autorizadas: ingresar con otra cuenta sin permisos → sin
   botones; las llamadas directas responden 403 y quedan como `DENIED`.

```bash
$PSQL -c "SELECT count(*) FROM core.person_permission WHERE permission_code LIKE 'ORG_DIRECTORY_EXPORT_%'"   # = 2 (una persona, dos códigos)
```

## 8. Manejo de los archivos reales

- Se descargan en la carpeta de descargas del navegador, **no en el repo**.
- No adjuntarlos a chats, tickets, correos ni carpetas compartidas.
- Borrarlos al terminar la verificación (vaciar también la papelera).
- Los repos ignoran `organigrama-20*.html` y `organigrama-activo-20*.xls`
  por si se copian por error.
- Los logs del backend solo registran `personId`, formato, versión y filas.

## 9. Reversión

En orden, deteniéndose cuando el problema quede resuelto:

1. **Retirar el acceso** (inmediato; los botones desaparecen al recargar):
   ```bash
   node dist/database/scripts/grant-directory-export.js <correo.aprobado@cun.edu.co> --format=both --revoke
   ```
2. **Retirar la migración** (opcional; conserve antes la auditoría con
   `\copy … TO 'auditoria-exportaciones.csv' CSV HEADER`):
   ```bash
   $PSQL -f /repo/docs/intervencion-exportadores/99_reversion_040.sql
   ```
   Se niega a correr si quedan permisos de exportación concedidos.
3. **Restaurar el respaldo** del paso 3 (último recurso; revierte también
   cualquier otro cambio posterior en la base).

## 10. Cierre

- Volver a `DEV_LOGIN_ENABLED` según se necesite para el trabajo local.
- Borrar `prod.env`.
- Registrar: ID del respaldo, hora de aplicación, persona autorizada
  (`person_id`), resultado de las verificaciones.
