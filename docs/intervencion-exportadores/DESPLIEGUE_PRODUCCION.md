# Despliegue de la versión robusta + exportadores en producción

> **Estado: PREPARADO, NO EJECUTADO.** Cada paso marcado ✍️ modifica
> producción y requiere autorización explícita. Si un control falla, **parar**
> y no continuar con el paso siguiente.

Complementa `RUNBOOK.md` (scripts SQL y concesión de permisos) con el orden de
despliegue de código. Verificado en solo lectura el 24-nov-2026.

## 0. Punto de partida

| Elemento | Valor |
|---|---|
| Cloud Run (backend y frontend) | proyecto `it-fab-contenido-edu-5` (número `550902908078`), región `us-central1` |
| Revisiones con tráfico hoy | `organigrama-backend-00126-pk9` y `organigrama-frontend-00069-2tv` = código de `copia-main` (exportadores por **lista fija de 5 correos**, sin auditoría) |
| Etiquetas existentes | `candidate` → `organigrama-backend-00113-hep` (0 % de tráfico, pero con URL propia) |
| Cloud SQL | `it-fab-contenido-edu-6:us-central1:core-database`, base `core` |
| Encendido de Cloud SQL | Cloud Scheduler: se apaga 22:00 (lun–jue) y sáb 00:00; se enciende 07:00 (lun–vie) |
| Respaldos automáticos | 09:00 UTC (04:00 Colombia), con la instancia apagada → **último exitoso: 10-nov** |
| Código a desplegar | backend `integracion/organigrama-exportadores-20261123` @ `eb17acf`, frontend @ `ad4de54` (o el HEAD aprobado; anotar el SHA exacto) |

## 1. Condiciones previas (todas obligatorias)

1. Autorizaciones escritas: respaldo, migración 040, 12 concesiones, push,
   despliegue y retiro de etiquetas antiguas.
2. Decisión tomada sobre `PersonContactEditor` (conservar con permiso
   explícito o retirar). El despliegue robusto **no** lo incluye hoy.
3. Aprobación institucional del tratamiento de datos personales del Excel
   (26 columnas) y del HTML (cédula y foto).
4. Ventana con Cloud SQL encendida: lunes a jueves entre 07:00 y 21:00
   (margen antes del apagado de las 22:00). Un backend nuevo no arranca sin base.
5. `gcloud auth login` interactivo hecho por quien ejecuta.
6. `main` local detenido y `Organigrama_Backend\.env` con
   `DEV_LOGIN_ENABLED=false` (`.\organigrama verificar` lo comprueba).

## 2. ✍️ Respaldo manual (obligatorio)

```bash
gcloud sql backups create --instance=core-database --project=it-fab-contenido-edu-6 \
  --description="antes-robusto-040-AAAAMMDD"
gcloud sql backups list --instance=core-database --project=it-fab-contenido-edu-6 --limit=3
```

- **No continuar** hasta ver el respaldo nuevo en estado `SUCCESSFUL`.
  Anotar su ID y la hora.
- Sin respaldos automáticos recientes, este respaldo manual es el único punto
  de restauración fiable. No sustituirlo por la recuperación a un punto en el
  tiempo.

## 3. ✍️ Base de datos (no cambia el comportamiento del código actual)

El backend desplegado hoy no usa la tabla 040 ni los permisos nuevos: estos
pasos no afectan a producción hasta que cambie el tráfico.

1. Pre-verificación: `01_preverificacion.sql` (solo lectura). Debe coincidir.
2. Migración: `migrations/040_org_chart_directory_export_audit.sql`.
3. Post-verificación: `02_postverificacion.sql` → `filas_tras_prueba = 0`.

## 4. ✍️ Permisos ANTES del cambio de tráfico (sin intervalo sin descargas)

Se conceden **12 concesiones en total**: 6 cuentas × 2 formatos
(`ORG_DIRECTORY_EXPORT_HTML` y `ORG_DIRECTORY_EXPORT_XLS`). No hay una
"primera cuenta" más 12: son 12 filas en total.

Se conceden **antes** de dar tráfico al backend nuevo. El código actual las
ignora; el nuevo las encuentra ya presentes en cuanto recibe tráfico, así que
nadie autorizado queda sin descarga durante la transición.

1. Simulación de las seis (`--dry-run`, sesión en solo lectura) → seis exit 0.
2. Concesión de las seis (`--format=both`), deteniéndose en el primer error.
3. `03_verificar_cuentas_autorizadas.sql`: seis filas con ambos códigos,
   `concesiones_fuera_de_la_lista = 0`, `total_concesiones_exportacion = 12`.

Comandos exactos: `RUNBOOK.md`, paso 6.

## 5. ✍️ Publicación del código

1. Push de las ramas de integración como **ramas nuevas** (no sobre `main`).
2. Exportación limpia de cada commit aprobado (no desde los worktrees):
   ```bash
   git -C <repo-backend>  archive --format=tar eb17acf | tar -x -C <dir-limpio-backend>
   git -C <repo-frontend> archive --format=tar ad4de54 | tar -x -C <dir-limpio-frontend>
   ```
3. Controles sobre la exportación (sección 8, controles A).

## 6. ✍️ Backend: sin tráfico → pruebas → tráfico

```bash
gcloud run deploy organigrama-backend --source <dir-limpio-backend> \
  --region=us-central1 --project=it-fab-contenido-edu-5 \
  --no-traffic --tag=robusto --labels=commit=eb17acf
```

`--source` crea una revisión nueva con la configuración actual del servicio
(variables, volumen `/secrets`, cuenta de servicio). No pasar `--set-env-vars`.

Pruebas en `https://robusto---organigrama-backend-…run.app` (sin sesión):

| Ruta | Esperado |
|---|---|
| `GET /api/health/live` | 200 |
| `GET /api/org-chart/export/permissions` | 401 (existe: autorización nueva) |
| `GET /api/org-chart/change-token` | 401 |
| `GET /api/org-chart/competency-people-search` | 401 |
| `GET /api/auth/dev-login/status` y `POST /api/auth/dev-login` | 404 |
| `PATCH /api/profile/person/1` | 404 si se retira `PersonContactEditor`; 401 si se conserva |

Después:

```bash
gcloud run services update-traffic organigrama-backend \
  --to-revisions=<REVISION_NUEVA>=100 --region=us-central1 --project=it-fab-contenido-edu-5
```

Transición (backend nuevo + frontend antiguo, minutos):

- `lorena_gomez`, `maria_ballen`, `raul_valencia`, `sara_murillofo`: ven los
  botones (lista antigua del frontend) y descargan (permisos ya concedidos).
- `desarrollofabrica@`: ve los botones, recibe 403 y queda `DENIED` en la
  auditoría. Es lo esperado.
- `iron_fuentes`, `cindy_russi`: verán los botones al desplegar el frontend.

## 7. ✍️ Frontend

```bash
gcloud run deploy organigrama-frontend --source <dir-limpio-frontend> \
  --region=us-central1 --project=it-fab-contenido-edu-5 \
  --no-traffic --tag=robusto --labels=commit=ad4de54
```

La URL con etiqueta llama al backend de producción y no está en CORS ni en
OAuth: no sirve para probar el ingreso. Revisar su bundle (controles B) y dar
tráfico:

```bash
gcloud run services update-traffic organigrama-frontend \
  --to-revisions=<REVISION_NUEVA>=100 --region=us-central1 --project=it-fab-contenido-edu-5
```

## 8. Controles: los exportadores por lista fija deben desaparecer

**A. Código exportado (antes de desplegar)**: todo debe dar 0 coincidencias.

```bash
# backend
test ! -e src/org-chart/org-chart-directory-export.constants.ts
grep -rn "DEFAULT_ORG_CHART_DIRECTORY_EXPORT_EMAILS\|ORG_CHART_DIRECTORY_EXPORT_EMAILS\|isOrgChartDirectoryExportEmail" src
# frontend
test ! -e src/features/org-chart/utils/canDownloadOrgDirectory.ts
grep -rn "canDownloadOrgDirectory\|VITE_ORG_CHART_DIRECTORY_EXPORT_EMAILS" src
```

**B. Lo desplegado**

1. Etiqueta `commit` de cada revisión = SHA aprobado.
2. Bundle público del frontend: contiene `export/permissions` y
   `ORG_DIRECTORY_EXPORT_HTML`; el fragmento de exportadores **no** contiene
   `lorena_gomez@cun.edu.co` ni `maria_ballen@cun.edu.co`.
   (`desarrollofabrica@`, `iron_fuentes@`, `raul_valencia@` y `haider_bello@`
   sí pueden aparecer: son la lista de versionamiento, otra función.)
3. Cuenta sin permiso de exportación → sin botones; llamada directa → 403 y
   fila `DENIED`.
4. Variable `ORG_CHART_DIRECTORY_EXPORT_EMAILS`: no definida en Cloud Run.

**C. Revisiones antiguas accesibles**

- Una revisión con etiqueta conserva su URL aunque tenga 0 % de tráfico.
  `candidate` (00113) y cualquier etiqueta sobre 00126 o 00069 exponen código
  antiguo.
- Tras el periodo de estabilización acordado: ✍️
  `gcloud run services update-traffic organigrama-backend --remove-tags=candidate,robusto …`
  y lo mismo en el frontend para `robusto`.
- Volver a revisar: `gcloud run services describe … --format="value(status.traffic)"`
  no debe mostrar etiquetas sobre revisiones antiguas.

## 9. Pruebas funcionales en producción

Sin mostrar datos personales en pantallas compartidas:

- Organigrama: 1.225 personas bajo la raíz; versión histórica 3 (510).
- Orbit: change-token y excepciones (Sara y Johan bajo Haider; sin segundo Haider).
- MC1: radar, perfil profesional y explorador.
- Presentación (niveles) y video (reproducción y salto); fotos.
- Mis datos (lectura; editar solo con la propia cuenta).
- Cuenta autorizada: ambos botones; Excel ≈196 filas, título «Versión actual ·
  periodo-agosto-2026 (activa)»; HTML con las mismas personas. Auditoría:
  2 filas `SUCCESS`, `version_id = 4`. Borrar los archivos descargados.
- Cuenta no autorizada: sin botones, 403 y `DENIED`.
- Memoria del backend en Cloud Run (límite 512 MiB) durante las descargas.

## 10. Reversión: tres operaciones independientes

### A. Aplicación (Cloud Run): inmediata, no toca la base

Primero el frontend y después el backend:

```bash
gcloud run services update-traffic organigrama-frontend --to-revisions=organigrama-frontend-00069-2tv=100 --region=us-central1 --project=it-fab-contenido-edu-5
gcloud run services update-traffic organigrama-backend  --to-revisions=organigrama-backend-00126-pk9=100  --region=us-central1 --project=it-fab-contenido-edu-5
```

- Vuelven los exportadores por lista fija (5 correos, sin auditoría) y el
  `PersonContactEditor` antiguo.
- La tabla 040 y las 12 concesiones quedan en la base sin efecto, porque el
  código antiguo no las usa.

### B. Permisos: inmediata, independiente del código

```bash
node dist/database/scripts/grant-directory-export.js <correo> --format=both --revoke   # por cada una de las 6
```

- Con el código nuevo, los botones desaparecen al recargar.
- Con el código antiguo no tiene efecto: ese código autoriza por lista, no por permisos.
- Verificar con `03_verificar_cuentas_autorizadas.sql` → `total = 0`.

### C. Base de datos: solo si hace falta deshacer el esquema

1. **Retirar la 040**:
   - antes, revocar los permisos (B) y exportar la auditoría a CSV;
   - después, ejecutar `99_reversion_040.sql`, que se niega a correr si quedan permisos.
2. **Restaurar el respaldo** del paso 2, solo como último recurso:
   - **Preferible:** restaurar en una **instancia nueva** y copiar solo lo necesario.
   - **Sobre `core-database`:** revierte **todo** lo escrito después del
     respaldo, incluidos los datos de Orbit y la actividad de usuarios, y
     requiere una ventana de corte. Necesita autorización expresa aparte.

No hay que restaurar la base para revertir el código ni los permisos.

## 11. Cierre

- Registrar:
  - SHA desplegados y nombres de revisión;
  - ID del respaldo;
  - horas de cada paso;
  - resultado de los controles 8A, 8B y 8C.
- Borrar `prod.env` y los archivos descargados.
- `DEV_LOGIN_ENABLED=false` en todo backend conectado a producción; no se reactiva.
- Recomendado (autorización aparte): mover la hora de los respaldos
  automáticos a la franja en que Cloud SQL está encendida.
