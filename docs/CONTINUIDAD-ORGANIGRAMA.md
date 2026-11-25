# Organigrama: continuidad del trabajo (corte del 24-nov-2026)

Documento para retomar el trabajo desde otro computador o en otra conversación. No contiene credenciales. Si algo de aquí contradice al código o a Cloud Run, manda lo verificado; actualice este documento.

## 1. Estado actual

- **Producción:** la versión robusta de Organigrama (mapa, Orbit, MC1, Presentación y videos, PersonContactEditor y exportadores HTML/Excel con permisos y auditoría) más la **primera entrega del rediseño HTML**, aprobada visualmente con datos reales el 24-nov-2026.
- **`main` está obsoleta en ambos repositorios.** No es la base del trabajo, no se modifica y no se fusiona.
  - Backend `main` = `64a720f`, frontend `main` = `a61ef0e`.
  - Las ramas robustas **no** descienden de `main`.
- No hay GitHub Actions ni triggers de Cloud Build: un `push` **no despliega**. Los despliegues son manuales con `gcloud run deploy --source` (ver `docs/DEPLOY_PRODUCCION.md`).

## 2. Frontend robusto

| Dato | Valor |
|---|---|
| Repositorio | https://github.com/DesarrolloFabrica/Organigrama_Frontend |
| Rama | `integracion/organigrama-exportadores-20261123` |
| SHA | `16b490dc0190e3ca9bd18e1fcf464bff7ac98120` (`16b490d`) |
| En producción | `organigrama-frontend-robusto-16b490d`, al 100 % |
| Worktree original | `C:\dev\Organigrama\_integracion\frontend` |

Contiene el mapa organizacional, Orbit, MC1 (competencias), Presentación y videos, PersonContactEditor y la barra «Directorio activo» con los botones HTML y Excel. Los botones dependen de los permisos de exportación y se resincronizan tras un 403.

## 3. Backend con el rediseño HTML

| Dato | Valor |
|---|---|
| Repositorio | https://github.com/DesarrolloFabrica/Organigrama_Backend |
| Rama | `rediseno-html/etapa1-iconos-20261124` |
| SHA del código desplegado | `6736e601b7dae2c5f48e60280dd48c94fa8ede04` (`6736e60`) |
| Punta de la rama | `6736e60` + 1 commit solo de documentación y herramientas (no cambia `src/`) |
| En producción | `organigrama-backend-robusto-6736e60` (tag `html-v1`), al 100 % |
| Worktree original | `C:\dev\Organigrama\_integracion\backend-html` |

Linaje lineal de la rama:

| Commit | Contenido |
|---|---|
| `d060340` | Integración robusta (rama `integracion/organigrama-exportadores-20261123`) |
| `2928dee` | Fase 2: los exportadores leen datos vigentes (rama `fase2/…`) |
| `c5f2a0f` | Fase 3: Excel con 10 pestañas (rama `fase3/excel-coordinaciones-20261124`) |
| `6736e60` | Rediseño HTML v1 |
| `6736e60` + 1 | Documentación |

## 4. Funcionalidades terminadas

- **Exportador Excel** (`GET /api/org-chart/export/directory`).
  - Tiene 10 pestañas: Base general, Dirección y 8 coordinaciones.
  - Los datos se leen vigentes en cada descarga.
  - Valida permisos en `core.person_permission` y registra la auditoría *fail-closed*.
- **Exportador HTML** (`GET /api/org-chart/export/html`). Mismos datos, permisos y auditoría, con el rediseño v1:
  - iconos oficiales incrustados;
  - color por coordinación con contraste WCAG;
  - espaciado y tipografía;
  - menú LED;
  - vista jerárquica en azul profundo;
  - sin JavaScript.
- **Frontend robusto completo**, ver §2.

## 5. Despliegue en producción

- **Proyecto y región:** `it-fab-contenido-edu-5`, `us-central1`.
- **Servicios:** `organigrama-backend` y `organigrama-frontend`.
- **Revisiones del backend conservadas, con su tag:**

  | Tag | Revisión | Uso |
  |---|---|---|
  | `html-v1` | `…-robusto-6736e60` | Activa |
  | `fase3` | `…-robusto-c5f2a0f` | Reversión inmediata |
  | `fase2` | `…-robusto-2928dee` | Anterior |
  | `robusto` | `…-robusto-d060340` | Anterior |
  | `candidate` | `organigrama-backend-00113-hep` | Anterior |

- **Reversión del backend (solo ante una regresión crítica):**

  ```powershell
  gcloud run services update-traffic organigrama-backend --to-revisions=organigrama-backend-robusto-c5f2a0f=100 --region=us-central1 --project=it-fab-contenido-edu-5
  ```

- **Reglas:**
  - producción es de solo lectura;
  - Cloud SQL, permisos (`core.person_permission`), auditoría, el tráfico de Cloud Run, el *push* a `main` y el cliente OAuth requieren autorización explícita;
  - las cuentas técnicas no se usan para descargas reales.
- **Horario de Cloud SQL:** la instancia se apaga a las 22:00 (Colombia) de lunes a jueves.

## 6. Cómo levantar el proyecto localmente

- **Requisitos:** Git, Node 24 / npm 11 (probado con 24.18 y 11.16) y Google Chrome. Docker solo para QA. `gcloud` solo para operar Cloud Run; en Windows, usarlo desde PowerShell.
- **Disposición recomendada:** worktrees bajo `C:\dev\Organigrama\_integracion\`, nunca en los clones que están en `main`:
  - `Organigrama_Backend\` en `main` (no usar) → worktrees `_integracion\backend` (robusto base) y `_integracion\backend-html` (rediseño);
  - `Organigrama_Frontend\` en `main` (no usar) → worktree `_integracion\frontend` (robusto).
- **Configuración que no está en Git** (se crea a mano en cada computador y no se sube nunca):

  | Archivo | Contenido |
  |---|---|
  | Backend `.env` (plantilla `.env.example`) | Ver la lista de abajo |
  | Frontend `.env.development.local` | `VITE_API_BASE_URL=http://localhost:3001` |

  Valores obligatorios del `.env` del backend:
  - `PORT=3001`;
  - `DEV_LOGIN_ENABLED=false`;
  - `API_PUBLIC_BASE_URL=http://localhost:3001`;
  - `ORG_CHART_PHOTO_TEST_URL` en :3001;
  - `CORS_ORIGIN=http://localhost:5173,http://localhost:5174`;
  - la base `DB_*` (Cloud SQL `core-database`);
  - `AUTH_JWT_SECRET`, `PERSON_VIDEO_STREAM_TICKET_SECRET` y las rutas **absolutas** a las credenciales de Google (`GOOGLE_SERVICE_ACCOUNT_KEY_PATH`, `GOOGLE_DRIVE_CV_*`).

  Las credenciales de Google viven en `Organigrama_Backend\secrets\`, carpeta ignorada por Git. Se trasladan por un canal seguro, nunca por Git.
- **Fotos de perfil locales** (`public/profile-photos/*.webp`): no se versionan porque son de personas reales.
- **Login local:** solo funciona con Google en `http://localhost:5173`, el único origen autorizado en el cliente OAuth. El frontend se arranca con `--strictPort`.

### 6.1. Ejecución manual: rediseño HTML con datos reales (solo lectura)

```powershell
# Backend del rediseño en :3001. No arrancar a la vez el backend de _integracion\backend.
cd C:\dev\Organigrama\_integracion\backend-html
npm run build
npm run start            # node dist/main.js, lee .env (PORT=3001)

# En otra terminal: frontend robusto en :5173
cd C:\dev\Organigrama\_integracion\frontend
npx vite --port 5173 --strictPort
# Abrir http://localhost:5173 → Google → «Descargar HTML» en la barra «Directorio activo».
# La descarga escribe una fila de auditoría en producción, igual que en la nube.
# El archivo descargado contiene datos reales: no versionarlo ni compartirlo.
```

### 6.2. Lanzador del entorno robusto (opcional)

Respaldo y restauración en `docs/entorno-local/README.md`. Arranca la versión robusta base (`_integracion\backend` en `d060340` + `_integracion\frontend`) y QA:

```powershell
cd C:\dev\Organigrama
.\organigrama estado
.\organigrama iniciar robusto
.\organigrama detener
```

### 6.3. Sin base de datos: vista previa sintética del HTML

Ver `docs/rediseno-html/README.md` §3. El comando es `node scripts/vista-previa-html-sintetica.cjs <salida.html>`, y el SHA-256 esperado con el código de 6736e60 es `785965b2…`.

## 7. Recuperar las ramas desde GitHub

```powershell
git -C C:\dev\Organigrama\Organigrama_Backend  fetch origin --prune
git -C C:\dev\Organigrama\Organigrama_Frontend fetch origin --prune

# Los worktrees nuevos crean la rama local con seguimiento de origin y no tocan las carpetas existentes
git -C C:\dev\Organigrama\Organigrama_Backend  worktree add C:\dev\Organigrama\_integracion\backend-html rediseno-html/etapa1-iconos-20261124
git -C C:\dev\Organigrama\Organigrama_Frontend worktree add C:\dev\Organigrama\_integracion\frontend    integracion/organigrama-exportadores-20261123

# Verificaciones
git -C C:\dev\Organigrama\_integracion\frontend rev-parse HEAD                     # 16b490dc0190e3ca9bd18e1fcf464bff7ac98120
git -C C:\dev\Organigrama\_integracion\backend-html diff --stat 6736e60 HEAD -- src  # vacío: el código es el desplegado
```

El procedimiento completo y comentado, que conserva los cambios locales existentes, verifica los SHA, instala dependencias y crea la configuración sin sobrescribir, está en **`docs/entorno-local/RECUPERAR-EN-OTRO-COMPUTADOR.md`**.

## 8. Archivos relevantes del exportador HTML

Ver la tabla en `docs/rediseno-html/README.md` §2. Los puntos de entrada son:

- **Cadena de la descarga:** `src/org-chart/org-chart.controller.ts` (`export/html`) → `org-chart-directory-export.service.ts` (`exportActiveHtml` → `runAuditedExport` → `buildHtmlFile`) → `org-chart-directory-presentation.ts` (`buildOrgChartHtml`).
- **Estilos e iconos:** `src/org-chart/html-export/`.
- **Datos compartidos con el Excel**, que no se tocan en el rediseño: `loadActiveDirectoryPeople`, `directorySql`, `resolveDirectoryPeople`, `shouldIncludeDirectoryRow` y `xmlEscape`.

## 9. Estado del rediseño UX/UI

| Etapa | Contenido | Estado |
|---|---|---|
| Auditoría | Estado previo al rediseño | Terminada: `docs/rediseno-html/AUDITORIA-INICIAL-EXPORTADOR-HTML.md` |
| Etapa 1 | Iconos | Desplegada y aprobada |
| Etapa 2 | Color y espaciado | Desplegada y aprobada: `docs/rediseno-html/COLORES-Y-ESPACIADO.md` |
| Etapa 2.1 | Menú LED y vista jerárquica | Desplegada y aprobada |

La siguiente etapa no se ha iniciado. Una rama nueva conviene crearla desde la punta de `rediseno-html/etapa1-iconos-20261124`.

## 10. Próximas mejoras pendientes (requieren aprobación)

Ver `docs/rediseno-html/README.md` §4 y §5. En resumen:

1. **Decisiones pendientes:** conservar la cédula, agrupar por área o por coordinación, datos de contacto, fotos incrustadas e impresión o PDF.
2. **Corrección del pintado:** pintar de forma recursiva para corregir la omisión por profundidad.
3. **Texto fijo:** quitar el nombre propio de la vista jerárquica.
4. **Accesibilidad e impresión.**
5. **Fecha de generación** visible y aviso de uso interno.
6. **Búsqueda o filtros**, solo si se aprueban: implicarían JavaScript y CSP.
