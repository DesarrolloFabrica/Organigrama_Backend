# Habilitar los exportadores HTML / Excel a personas autorizadas

Los informes contienen datos personales de toda la planta activa. Solo se
habilitan a personas **expresamente aprobadas** (administradores, directores o
analistas autorizados); el rol por sí solo no da acceso.

| Acción | Permiso | Botón en Organigrama |
|---|---|---|
| Informe visual de equipos (HTML) | `ORG_DIRECTORY_EXPORT_HTML` | **Descargar HTML** |
| Informe de planta activa (Excel) | `ORG_DIRECTORY_EXPORT_XLS` | **Descargar Excel** |

Los botones están en la barra «Directorio activo», bajo el encabezado de
`/org` y de `/org/team/:personId`. Sin permiso no se muestran.

## Requisitos verificados (solo lectura, 23-nov-2026)

- Migración 040 aplicada con éxito e idempotente sobre una copia del esquema
  de producción (sin datos) en PostgreSQL 18.
- El usuario de BD del backend puede crear en `organigrama`, insertar/borrar
  en `core.person_permission` y es dueño de esa tabla (necesario para los
  `COMMENT` de la 040).
- En producción: la tabla de auditoría aún no existe; 0 permisos de exportación.

## 1. Antes de empezar

1. Lista aprobada de personas y formato(s) por persona.
2. Backend y frontend desplegados desde las ramas de integración.
3. Respaldo/snapshot de Cloud SQL.

## 2. Aplicar la migración 040 (una vez, antes de conceder permisos)

Sin esta tabla toda descarga autorizada responde **503** (no se entrega un
archivo sin registro de auditoría).

```bash
psql "host=<DB_HOST> port=5432 dbname=core user=<DB_USERNAME> sslmode=require" \
  -v ON_ERROR_STOP=1 -f migrations/040_org_chart_directory_export_audit.sql
```

Comprobar:

```sql
SELECT to_regclass('organigrama.org_chart_directory_export_audit');  -- no NULL
```

## 3. Conceder ambos formatos a una persona autorizada

Desde el backend, con el `.env` de la base destino:

```bash
# 1) Simulación: no escribe nada
npm run org:grant-directory-export -- correo.autorizado@cun.edu.co --format=both --dry-run

# 2) Concesión real
npm run org:grant-directory-export -- correo.autorizado@cun.edu.co --format=both
```

- `--format=html` o `--format=xls` concede solo uno.
- Idempotente: repetirlo no duplica.
- Solo toca los dos códigos de exportación; si cambiara cualquier otro
  permiso (ORG_ADMIN, ORG_READ_ALL…), revierte la transacción.
- Salida con `person_id` y correo enmascarado.

El backend aplica el cambio de inmediato. En el frontend, los botones
aparecen al recargar Organigrama (la barra consulta los permisos vigentes al
cargar); no hace falta cerrar sesión.

## 4. Verificar

1. La persona entra a Organigrama y ve **Descargar HTML** y **Descargar Excel**.
2. Descarga ambos archivos.
3. Auditoría (solo metadatos):

```sql
SELECT person_id, export_format, result, version_id, row_count, created_at
  FROM organigrama.org_chart_directory_export_audit
 ORDER BY created_at DESC
 LIMIT 20;
```

## 5. Retirar el acceso

```bash
npm run org:grant-directory-export -- correo.autorizado@cun.edu.co --format=both --revoke
```

Efecto inmediato en el backend (403). Si la página está abierta, el siguiente
clic muestra «Acceso denegado» y retira el botón; al recargar ya no aparece.

## Intervención en producción

Procedimiento detallado, verificaciones SQL, respaldo y reversión: `docs/intervencion-exportadores/RUNBOOK.md`.

## Ensayo previo

`test/qa/directory-export/README.md` reproduce todo el flujo en un PostgreSQL
desechable con datos sintéticos.
