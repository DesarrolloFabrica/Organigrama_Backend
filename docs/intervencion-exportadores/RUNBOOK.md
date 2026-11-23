# Intervención: habilitar exportadores HTML/Excel con datos reales

> **Estado: PREPARADO, NO EJECUTADO.** Requiere autorización explícita antes
> de los pasos marcados ✍️ (escritura sobre Cloud SQL).

## Destino (verificado en solo lectura, 23-nov-2026)

| Dato | Valor |
|---|---|
| Proyecto de Google Cloud (Cloud SQL) | **`it-fab-contenido-edu-6`** (certificado TLS del servidor: `CN=it-fab-contenido-edu-6:core-database`, emisor `Cloud SQL Server CA`) |
| Instancia Cloud SQL | **`core-database`**, IP pública `136.113.128.135`, puerto 5432 |
| Cloud Run / OAuth | número de proyecto `550902908078` (`organigrama-backend-550902908078`, cliente OAuth `550902908078-…`); no confirmado que sea el mismo proyecto que Cloud SQL — no afecta a esta intervención |
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
2. **Ingreso con Google, no con el acceso de desarrollo.** Con el acceso de
   desarrollo activo contra producción, cualquiera con el `.env` puede entrar
   como una persona autorizada sin Google.
   - `:3001` (integrado): **ya** con `DEV_LOGIN_ENABLED=false`
     (`POST /api/auth/dev-login` → 404; verificado el 23-nov-2026).
   - `:3000` (`main`, repo original): acepta el acceso de desarrollo contra
     producción y su código antiguo habilita el Excel a una lista fija de
     correos. **No debe estar corriendo** al conceder permisos: comprobar con
     `.\organigrama estado` (desde `C:\dev\Organigrama`) y, si aparece,
     `.\organigrama detener-main`. `.\organigrama iniciar` ya lo detiene.
3. **Respaldo `SUCCESSFUL`** de `core-database` (paso 3).
4. Comprobar el ingreso con Google en `http://localhost:5173` (versión robusta,
   `.\organigrama iniciar robusto` desde `C:\dev\Organigrama`) con una de las
   cuentas aprobadas antes de conceder. 5173 es el único origen local
   autorizado hoy en el cliente OAuth; 5174 y 5175 responden `origin_mismatch`
   (ver `_integracion\COMO-INICIAR.md`).
5. Momento de baja carga.

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

Consola: https://console.cloud.google.com/sql/instances/core-database/backups?project=it-fab-contenido-edu-6
→ **Create backup** (on-demand), descripción `antes-040-exportadores`.
Con `gcloud` operativo:

```bash
gcloud sql backups create --instance=core-database --project=it-fab-contenido-edu-6 --description="antes-040-exportadores"
gcloud sql backups list --instance=core-database --project=it-fab-contenido-edu-6 --limit=3   # estado SUCCESSFUL
```

Anotar el ID del respaldo y **no continuar** hasta verlo en estado
`SUCCESSFUL`. Restauración (último recurso):
`gcloud sql backups restore <ID> --restore-instance=core-database --project=it-fab-contenido-edu-6`.

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

## 6. ✍️ Conceder ambos permisos a las cuentas aprobadas

Lista aprobada (fase 7) — verificada en solo lectura el 23-nov-2026: las seis
existen, son únicas, están activas, están en el mapa vigente y no tienen
permisos de exportación. Los seis `--dry-run` terminaron con exit 0.

| Correo | person_id | Permisos previos |
|---|---|---|
| iron_fuentes@cun.edu.co | 1144 | (ninguno) |
| raul_valencia@cun.edu.co | 1082 | (ninguno) |
| sara_murillofo@cun.edu.co | 1268 | ORG_ADMIN, ORG_READ_ALL |
| cindy_russi@cun.edu.co | 1631 | ORG_READ_ALL |
| lorena_gomez@cun.edu.co | 1155 | ORG_ADMIN, ORG_READ_ALL |
| maria_ballen@cun.edu.co | 1870 | (ninguno) |

```bash
APROBADAS="iron_fuentes@cun.edu.co raul_valencia@cun.edu.co sara_murillofo@cun.edu.co cindy_russi@cun.edu.co lorena_gomez@cun.edu.co maria_ballen@cun.edu.co"

# a) Simulación (el servidor fuerza solo lectura)
for e in $APROBADAS; do
  PGOPTIONS="-c default_transaction_read_only=on" \
    node dist/database/scripts/grant-directory-export.js "$e" --format=both --dry-run || { echo "DETENER: $e"; break; }
done

# b) Concesión real (se detiene en el primer error)
for e in $APROBADAS; do
  node dist/database/scripts/grant-directory-export.js "$e" --format=both || { echo "DETENER: $e"; break; }
done

# c) Verificación persistida (solo lectura): 6 filas con ambos códigos,
#    0 concesiones fuera de la lista, total 12
$PSQL -f /repo/docs/intervencion-exportadores/03_verificar_cuentas_autorizadas.sql
```

Reversión de las seis: mismo bucle con `--format=both --revoke`.

### Cuenta individual (referencia)

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

## 7. Validación funcional en `localhost:5173`

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
