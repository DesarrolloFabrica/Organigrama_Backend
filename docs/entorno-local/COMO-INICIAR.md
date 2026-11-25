# Organigrama — cómo iniciar y detener los entornos (versión robusta)

## Regla de oro

**Nunca** ejecutar `npm run start:dev` ni `npm run dev` dentro de:

- `C:\dev\Organigrama\Organigrama_Backend`
- `C:\dev\Organigrama\Organigrama_Frontend`

Son los repos originales en `main` (versión antigua). Todo se maneja con **un
solo comando**, desde `C:\dev\Organigrama`:

```powershell
cd C:\dev\Organigrama
.\organigrama estado
```

(`organigrama.cmd` llama a `_integracion\organigrama-dev.ps1`; funciona desde
PowerShell, CMD y las terminales de Cursor / VS Code.)

## Comandos

| Quiero… | Comando |
|---|---|
| Ver qué está corriendo (y si `main` se coló) | `.\organigrama estado` |
| Iniciar todo (robusto + QA) | `.\organigrama iniciar` |
| Iniciar solo la versión robusta | `.\organigrama iniciar robusto` |
| Iniciar solo QA | `.\organigrama iniciar qa` |
| Comprobar que lo que corre es la versión correcta | `.\organigrama verificar` |
| Reiniciar | `.\organigrama reiniciar` (o `reiniciar robusto` / `reiniciar qa`) |
| Recompilar el backend y reiniciar | `.\organigrama reiniciar todo -Compilar` |
| Detener todo | `.\organigrama detener` |
| Detener solo uno | `.\organigrama detener robusto` / `.\organigrama detener qa` |
| Cerrar `main` si se arrancó por error | `.\organigrama detener-main` |

Qué hace `iniciar`, en orden:

1. Detiene cualquier proceso de `main` que encuentre escuchando (sin cerrar
   la terminal donde se arrancó).
2. Verifica los worktrees: rama `integracion/organigrama-exportadores-20261123`
   en backend y frontend, commit actual y cambios pendientes.
3. Si `dist` es más antiguo que el código fuente, recompila el backend.
4. Arranca los procesos en segundo plano (logs en `_integracion\logs\`) y
   devuelve el control a la terminal.
5. Verifica y termina en **LISTO** o en **NO LISTO** (código de salida 1). No
   dice LISTO si falla cualquiera de estas comprobaciones:
   - configuración del robusto: `DEV_LOGIN_ENABLED=false`;
     `API_PUBLIC_BASE_URL` y `ORG_CHART_PHOTO_TEST_URL` en :3001 (si apuntaran
     a :3000, las fotos se pedirían al backend de `main`); CORS del puerto
     del frontend;
   - credenciales de Drive (videos, CV) y de Workspace (foto desde Google en
     Mis datos): con ruta absoluta, existentes y **fuera de Git**. Hoy se leen
     en su lugar desde `Organigrama_Backend\secrets\`, carpeta ignorada por
     Git; no se copian;
   - rutas modernas presentes (401 sin sesión):
     - organigrama, versiones, change-token (Orbit) y fotos;
     - competencias, perfil profesional y explorador;
     - video y stream;
     - exportadores HTML, Excel y permisos;
     - Mis datos;
   - acceso por correo bloqueado en el robusto y habilitado solo en QA;
   - frontend robusto completo y apuntando a su backend: explorador, Mis datos,
     pestañas Presentación y Competencias, radar y botones HTML y Excel;
   - un `.env` editado después de arrancar el backend (hay que reiniciar).

## Entornos

| Entorno | URL | Backend | Datos | Ingreso |
|---|---|---|---|---|
| Robusto | **http://localhost:5173** | :3001 (`_integracion\backend`) | Cloud SQL producción (`core-database`) | **solo Google** |
| QA | http://localhost:5175 | :3002 (`_integracion\qa-backend` → mismo código) | PostgreSQL Docker `127.0.0.1:5434`, sintéticos | correo `qa_sintetico_*` o Google* |

\* Google en 5175 requiere el cambio pendiente en Google Cloud (abajo).

- El robusto usa **5173** porque es el único puerto local autorizado hoy en
  el cliente OAuth de Google. El frontend se arranca con `--strictPort`: si
  5173 está ocupado, falla en vez de saltar a otro puerto.
- Si alguien arranca por error el frontend de `main`, Vite lo mueve a 5174
  (5173 ya está ocupado). `.\organigrama estado` lo marca en rojo como
  **MAIN** y `.\organigrama detener-main` lo cierra.
- El script se niega a iniciar el robusto si `backend\.env` no tiene
  `DEV_LOGIN_ENABLED=false`, y lo detiene si el backend reportara el acceso
  por correo habilitado.
- El backend además bloquea por su cuenta el acceso por correo contra
  cualquier base que no esté marcada como QA (ver
  `backend\test\qa\directory-export\DESARROLLO_LOCAL.md`).
- Los datos de QA (contenedor `organigrama-qa-exports`) se conservan al
  detener e iniciar; `detener` no borra el contenedor.
- Usuarios de QA y cómo cambiar de perfil: `DESARROLLO_LOCAL.md`.

## Cuántas personas debe mostrar

El «Resumen general» de la raíz cuenta las personas activas bajo la raíz
(1144) en la versión vigente `periodo-agosto-2026` (id 4).

| Versión del código | Fuente de relaciones | Personas bajo la raíz (23-nov-2026) |
|---|---|---|
| **Robusta** (5173) | versión 4 + Planta Activa de Orbit + excepciones/supresiones | **1225** (194 no docentes + 1031 docentes) |
| `main` (antigua) | solo la tabla de la versión 4 | 975 |
| Robusta, versión histórica 3 seleccionada | tabla de la versión 3 (sin Planta) | 510 |

- La diferencia de 250 entre robusta y `main` la aportan los 280 registros de
  Planta de Orbit (`core.planta_org_override`), que `main` no conoce. Nadie
  aparece solo en `main`.
- El Excel no se compara con este número: excluye docentes de planta y
  vacantes.
- Auditoría repetible, de solo lectura y solo con conteos (usa `backend\.env`):

```powershell
node C:\dev\Organigrama\_integracion\auditoria\conteo-personas-readonly.js
node C:\dev\Organigrama\_integracion\auditoria\raiz-por-version-readonly.js
```

## En Cursor / VS Code

**Opción A — workspace (recomendada):** `File → Open Workspace from File…` →
`C:\dev\Organigrama\organigrama-robusto.code-workspace`.

- Muestra solo los worktrees robustos (`_integracion\backend`,
  `_integracion\frontend`) y la carpeta de scripts. Los repos originales
  quedan ocultos.
- Las terminales nuevas abren en `C:\dev\Organigrama`, donde `.\organigrama`
  funciona y `npm run dev` no tiene nada que arrancar.

**Opción B — tareas:** con `C:\dev\Organigrama` abierto, usar
`Terminal → Run Task…` y elegir una tarea `Organigrama: …` (iniciar, estado,
verificar, detener, reiniciar y recompilar, detener main).
`Ctrl+Shift+B` ejecuta «iniciar».

En ambos casos, cerrar las terminales que hayan quedado ubicadas en
`Organigrama_Backend` / `Organigrama_Frontend`.

> Si el navegador abre `localhost:5174` y ve un botón Excel sin botón HTML,
> sin «Mis datos», sin Presentación ni Competencias, y menos personas, está
> viendo **`main`**: se arrancó con `npm run dev` en `Organigrama_Frontend`,
> y Vite lo movió a 5174 porque el robusto ocupa 5173. Además, su backend
> (:3000) acepta el acceso por correo contra producción. Ejecute
> `.\organigrama detener-main` y use http://localhost:5173.

## Google OAuth (`Error 400: origin_mismatch`)

- Cliente OAuth: `550902908078-fvabjtle954fqr6alhofdv7fvvr4bcbv.apps.googleusercontent.com`.
- Proyecto: número `550902908078`. La pantalla de consentimiento se llama «cargar-lms».
- Orígenes locales comprobados con una prueba real del popup (23-nov-2026):

| Origen | Resultado |
|---|---|
| `http://localhost:5173` | aceptado (muestra «Acceder con Google») |
| `http://localhost:5174` | `origin_mismatch` |
| `http://localhost:5175` | `origin_mismatch` |

**Cambio pendiente, requiere autorización.** Solo si se quiere usar Google
también en 5174 o 5175:

1. Google Cloud Console → proyecto `550902908078` → **APIs y servicios →
   Credenciales** → ID de cliente OAuth 2.0 `550902908078-fvabjtle954…`.
   Enlace directo:
   `https://console.cloud.google.com/apis/credentials/oauthclient/550902908078-fvabjtle954fqr6alhofdv7fvvr4bcbv.apps.googleusercontent.com?project=550902908078`
2. En **Orígenes autorizados de JavaScript** → **Agregar URI**:
   - `http://localhost:5174` (robusto en un puerto alterno), y opcionalmente
   - `http://localhost:5175` (Google en QA).
3. No tocar los **URI de redireccionamiento** ni el secreto: el login usa el
   popup de Google Identity Services, que solo valida el origen.
4. Guardar. Google indica que el cambio puede tardar de 5 minutos a unas
   horas en aplicarse.
5. Después: `.\organigrama iniciar robusto -PuertoFrontend 5174`. El CORS del
   backend 3001 ya admite 5173 y 5174.

Mientras tanto, usar **http://localhost:5173**.
