# Organigrama: continuidad del trabajo (corte del 27-nov-2026)

Documento para retomar el trabajo desde otro computador o en otra conversación. No contiene credenciales. Si algo de aquí contradice al código o a Cloud Run, manda lo verificado; actualice este documento.

## 1. Estado actual

- **Producción:** la versión robusta de Organigrama más todo lo entregado hasta el 27-nov-2026.
  - Base robusta: mapa, Orbit, MC1, Presentación y videos, PersonContactEditor y exportadores HTML/Excel con permisos y auditoría.
  - Rediseño del HTML v1 y ajuste de analistas.
  - Vacantes de Orbit en el panel y en el mapa.
  - Versionamiento visible solo para la cuenta de desarrollo.
- **Pendiente de desplegar, ya publicado:** requisiciones de la Coordinación General con el emblema de su coordinación. Corresponde al backend `d90e9fb` y al frontend `450aa7f`; ver §5.
- **`main` está obsoleta en ambos repositorios.** No es la base del trabajo, no se modifica y no se fusiona.
  - Backend `main` = `64a720f`, frontend `main` = `a61ef0e`.
  - Las ramas de trabajo **no** descienden de `main`.
- No hay GitHub Actions ni triggers de Cloud Build: un `push` **no despliega**. Los despliegues son manuales (ver §5 y `docs/DEPLOY_PRODUCCION.md`).

## 2. Frontend

| Dato | Valor |
|---|---|
| Repositorio | https://github.com/DesarrolloFabrica/Organigrama_Frontend |
| Rama de trabajo | `feat/vacantes-por-coordinacion-20261125` |
| Punta publicada | `450aa7ffb3e415f749177b752c1e27fcaecc1113` (`450aa7f`). Añade el emblema de la coordinación junto a cada vacante del resumen. **No desplegada** |
| En producción | `122d969` → `organigrama-frontend-robusto-122d969` (tag `vacantes`), al 100 % desde el 26-nov-2026 |
| Revisión para revertir | `organigrama-frontend-robusto-16b490d` (tag `robusto`) |
| Worktree original | `C:\dev\Organigrama\_integracion\frontend` |

Linaje de la rama:

| Commit | Contenido |
|---|---|
| `16b490d` | Robusta: mapa, Orbit, MC1, Presentación y videos, PersonContactEditor y botones HTML/Excel por permiso (rama `integracion/organigrama-exportadores-20261123`) |
| `0b7a7b6` | Panel con requisiciones del nodo |
| `ab46ccd` | Indicador «Plazas solicitadas» |
| `b8f4afc` | Vacantes de Orbit como tarjetas en el mapa |
| `af841e7` | La tarjeta de requisición dice solo «Vacante» |
| `122d969` | Selector de versiones solo para la cuenta de desarrollo (**producción**) |
| `450aa7f` | Emblema de la coordinación junto a cada vacante |

## 3. Backend

| Dato | Valor |
|---|---|
| Repositorio | https://github.com/DesarrolloFabrica/Organigrama_Backend |
| **Rama base de trabajo** | **`integracion/organigrama-20261127`**, en `64198073efd04fb8865791d652b36df5eda0055f` (`6419807`) más este commit de documentación |
| En producción | `f2a4ffb` → `organigrama-backend-robusto-f2a4ffb` (tag `analistas-juntas`), al 100 % desde el 27-nov-2026 16:03 |
| Revisión para revertir | `organigrama-backend-robusto-0f13a17` (tag `vacantes`) |
| Worktree original | `C:\dev\Organigrama\_integracion\backend-integrado` |

La rama base une las dos líneas que salieron de `0f13a17`: vacantes (`d90e9fb`) y el ajuste de analistas (`f2a4ffb`, aplicado con `cherry-pick -x` como `6419807`). **Los próximos despliegues del backend salen de esta rama.**

Linaje lineal:

| Commit | Contenido |
|---|---|
| `d060340` | Integración robusta |
| `2928dee` | Fase 2: los exportadores leen datos vigentes |
| `c5f2a0f` | Fase 3: Excel con 10 pestañas |
| `6736e60` | Rediseño HTML v1 |
| `cc30ecf` | Docs de continuidad del 24-nov |
| `b4b3a71` | Requisiciones de Orbit con el alcance del nodo del panel |
| `ee48a2d` | Corrección del seed de requisiciones de QA |
| `0f13a17` | Versionamiento solo para la cuenta de desarrollo |
| `d90e9fb` | Alcance `direction`: la Coordinación General recibe las requisiciones de sus coordinaciones, y cada requisición trae `coordination` |
| `6419807` | Analistas juntos en la vista jerárquica del HTML (= `f2a4ffb`) |

Ramas anteriores conservadas en GitHub, sin cambios:
- `rediseno-html/etapa1-iconos-20261124`;
- `rediseno-html/analistas-juntas-20261127`;
- `feat/vacantes-por-coordinacion-20261125`, que en GitHub sigue en `0f13a17` (su `d90e9fb` está dentro de la rama base);
- `fase3/…`, `fase2/…` e `integracion/organigrama-exportadores-20261123`.

## 4. Funcionalidades terminadas

- **Exportador Excel** (`GET /api/org-chart/export/directory`).
  - Tiene 10 pestañas: Base general, Dirección y 8 coordinaciones.
  - Los datos se leen vigentes en cada descarga.
  - Valida permisos en `core.person_permission` y registra la auditoría *fail-closed*.
- **Exportador HTML** (`GET /api/org-chart/export/html`).
  - Mismos datos, permisos y auditoría que el Excel.
  - Rediseño v1: iconos oficiales incrustados, color por coordinación con contraste WCAG, menú LED, vista jerárquica en azul profundo y sin JavaScript.
  - Analistas juntos al final de su grupo en la vista jerárquica.
  - Detalle en `docs/rediseno-html/README.md`.
- **Vacantes de Orbit** (`/api/org-chart/vacancies`).
  - Panel con las requisiciones del nodo seleccionado, con su alcance.
  - Indicador «Plazas solicitadas» y tarjetas «Vacante» en el mapa.
  - Pendiente de despliegue: la Coordinación General (alcance `direction`) ve sus requisiciones, con el emblema de su coordinación.
- **Versionamiento** (selector y vistas de versiones): solo para `desarrollofabrica@cun.edu.co`. El resto ve la versión oficial.

## 5. Despliegue en producción

- **Proyecto y región:** `it-fab-contenido-edu-5`, `us-central1`.
- **Servicios:** `organigrama-backend` y `organigrama-frontend`.
- **Revisiones del backend conservadas, con su tag:**

  | Tag | Revisión | Uso |
  |---|---|---|
  | `analistas-juntas` | `…-robusto-f2a4ffb` | Activa |
  | `vacantes` | `…-robusto-0f13a17` | Reversión inmediata |
  | `html-v1` | `…-robusto-6736e60` | Anterior |
  | `fase3` | `…-robusto-c5f2a0f` | Anterior |
  | `fase2` | `…-robusto-2928dee` | Anterior |
  | `robusto` | `…-robusto-d060340` | Anterior |
  | `candidate` | `organigrama-backend-00113-hep` | Anterior |

- **Revisiones del frontend:** `organigrama-frontend-robusto-122d969` (tag `vacantes`, activa) y `…-robusto-16b490d` (tag `robusto`).
- **Reversión, solo ante una regresión crítica:**

  ```powershell
  gcloud run services update-traffic organigrama-backend  --to-revisions=organigrama-backend-robusto-0f13a17=100  --region=us-central1 --project=it-fab-contenido-edu-5
  gcloud run services update-traffic organigrama-frontend --to-revisions=organigrama-frontend-robusto-16b490d=100 --region=us-central1 --project=it-fab-contenido-edu-5
  ```

- **Procedimiento usado para el backend:**
  1. `git archive <sha>` a una carpeta limpia (`_integracion\tmp\publicacion-backend-<sha>`).
  2. `gcloud run deploy organigrama-backend --source <carpeta> --no-traffic --tag=<tag> --revision-suffix=robusto-<sha> --update-labels=commit=<sha>`, sin `--set-env-vars`, para que la revisión herede la configuración.
  3. Validar: estado `Ready`, configuración idéntica a la revisión anterior, sondas sin sesión (salud 200, exportadores 401, `dev-login` 404) y logs.
  4. `update-traffic` al 100 %.
- **Procedimiento del frontend** (26-nov): `gcloud storage cp` del `git archive` a `gs://…_cloudbuild/source/`, luego `builds submit --region=us-central1`, después `deploy --image`.
- **`gcloud`:** en Windows, usarlo desde PowerShell. Si pide reautenticarse: `gcloud auth login desarrollofabrica@cun.edu.co`.
- **Reglas:**
  - producción es de solo lectura;
  - Cloud SQL, permisos (`core.person_permission`), auditoría, tráfico de Cloud Run, *push* a `main` y el cliente OAuth requieren autorización explícita;
  - las cuentas técnicas no se usan para descargas reales.
- **Horario de Cloud SQL:** la instancia se apaga a las 22:00 (Colombia) de lunes a jueves.

## 6. Cómo levantar el proyecto localmente

- **Requisitos:** Git, Node 24 / npm 11 (probado con 24.18 y 11.16) y Google Chrome. Docker solo para QA.
- **Disposición recomendada:** worktrees bajo `C:\dev\Organigrama\_integracion\`, nunca en los clones que están en `main`:
  - `Organigrama_Backend\` (en `main`, no usar) → worktree **`_integracion\backend-integrado`** (rama base);
  - `Organigrama_Frontend\` (en `main`, no usar) → worktree **`_integracion\frontend`** (rama `feat/vacantes-por-coordinacion-20261125`).
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
  - `AUTH_JWT_SECRET`, `PERSON_VIDEO_STREAM_TICKET_SECRET` y las rutas **absolutas** a las credenciales de Google.

  Las credenciales de Google viven en `Organigrama_Backend\secrets\`, carpeta ignorada por Git. Se trasladan por un canal seguro, nunca por Git.
- **Fotos de perfil locales** (`public/profile-photos/*.webp`): no se versionan porque son de personas reales.
- **Login local:** solo funciona con Google en `http://localhost:5173`, el único origen autorizado en el cliente OAuth.

### 6.1. Ejecución manual con datos reales (solo lectura)

```powershell
# Terminal 1: backend en :3001
cd C:\dev\Organigrama\_integracion\backend-integrado
npm run build
npm run start            # node dist/main.js, lee .env (PORT=3001)

# Terminal 2: frontend en :5173
cd C:\dev\Organigrama\_integracion\frontend
npx vite --port 5173 --strictPort
# http://localhost:5173 → Google. Toda descarga escribe auditoría en producción.
# Los archivos descargados contienen datos reales: no versionarlos.
```

### 6.2. Lanzador `.\organigrama` (opcional, con un desfase conocido)

Respaldo y restauración en `docs/entorno-local/README.md`. El lanzador tiene rutas fijas:
- espera `_integracion\backend` y `_integracion\frontend` en la rama `integracion/organigrama-exportadores-20261123`;
- desde el 26-nov esos worktrees están en `feat/vacantes-por-coordinacion-20261125`, así que `verificar` puede marcar la rama como inesperada;
- no conoce `_integracion\backend-integrado`.

Para trabajar con la rama base, use §6.1.

### 6.3. QA sintético de vacantes

Guía en `docs/entorno-local/QA-VACANTES.md`: Docker 5436, backend 3012 y frontend 5176, con datos 100 % sintéticos.

### 6.4. Sin base de datos: vista previa sintética del HTML

Ver `docs/rediseno-html/README.md` §3: `node scripts/vista-previa-html-sintetica.cjs <salida.html>`. El SHA-256 esperado es `785965b2…`; el ajuste de analistas no lo cambia, porque los datos sintéticos no tienen líderes bajo la Coordinación General.

### 6.5. Pruebas

- **Backend:** `npx jest` da 1596 en verde. Fallan 17 tests en 8 suites de MC1 (`mc-catalog`, `mc-pipeline`), que ya fallaban antes de este trabajo.
  - Exportador: `npx jest src/org-chart/html-export src/org-chart/org-chart-directory src/org-chart/org-chart-export.http` (159 pruebas).
- **Frontend:** `npx vitest run --config vitest.config.ts` (318 en verde) y `npx tsc -b`. **vitest debe correrse desde PowerShell**: desde Git Bash falla con el error «reading 'config'».

## 7. Recuperar las ramas desde GitHub

El procedimiento completo y comentado está en **`docs/entorno-local/RECUPERAR-EN-OTRO-COMPUTADOR.md`**:
- conserva los cambios locales existentes;
- verifica los SHA;
- instala dependencias;
- crea la configuración sin sobrescribir.

Resumen:

```powershell
git -C C:\dev\Organigrama\Organigrama_Backend  fetch origin --prune
git -C C:\dev\Organigrama\Organigrama_Frontend fetch origin --prune
git -C C:\dev\Organigrama\Organigrama_Backend  worktree add C:\dev\Organigrama\_integracion\backend-integrado integracion/organigrama-20261127
git -C C:\dev\Organigrama\Organigrama_Frontend worktree add C:\dev\Organigrama\_integracion\frontend         feat/vacantes-por-coordinacion-20261125
```

Ojo: con `git -C <repo> worktree add`, una ruta **relativa** se resuelve dentro del repositorio. Use siempre rutas absolutas.

## 8. Archivos relevantes del exportador HTML

Ver la tabla en `docs/rediseno-html/README.md` §2. Los puntos de entrada son:

- **Cadena de la descarga:** `src/org-chart/org-chart.controller.ts` (`export/html`) → `org-chart-directory-export.service.ts` (`exportActiveHtml` → `runAuditedExport` → `buildHtmlFile`) → `org-chart-directory-presentation.ts` (`buildOrgChartHtml`).
- **Estilos e iconos:** `src/org-chart/html-export/`.
- **SQL de ubicaciones:** desde `0f13a17` está en `org-chart-directory-placements.sql.ts`.
- **Datos compartidos con el Excel**, que no se tocan en el rediseño: `loadActiveDirectoryPeople`, `directorySql`, `resolveDirectoryPeople`, `shouldIncludeDirectoryRow` y `xmlEscape`.

## 9. Estado del rediseño UX/UI

| Etapa | Contenido | Estado |
|---|---|---|
| Auditoría | Estado previo al rediseño | Terminada: `docs/rediseno-html/AUDITORIA-INICIAL-EXPORTADOR-HTML.md` |
| Etapa 1 | Iconos | Desplegada y aprobada |
| Etapa 2 | Color y espaciado | Desplegada y aprobada: `docs/rediseno-html/COLORES-Y-ESPACIADO.md` |
| Etapa 2.1 | Menú LED y vista jerárquica | Desplegada y aprobada |
| Ajuste del 27-nov | Analistas juntos | Desplegado y aprobado |

La siguiente etapa no se ha iniciado. Las ramas nuevas conviene crearlas desde la punta de `integracion/organigrama-20261127`.

## 10. Próximos pasos

1. **Desplegar la pareja `d90e9fb` + `450aa7f`**, es decir, las requisiciones de la Coordinación General con el emblema.
   - El backend sale de la rama base (incluye el ajuste de analistas) y el frontend de la punta de su rama.
   - Requiere autorización.
2. **Pruebas pendientes del usuario:** el versionamiento en pantalla con su cuenta y con la de desarrollo, y una descarga real del Excel por coordinaciones.
3. **Decisiones del rediseño HTML:** conservar la cédula, agrupar por área o por coordinación, datos de contacto, fotos incrustadas e impresión o PDF.
4. **Correcciones técnicas del HTML:**
   - pintar de forma recursiva, para corregir la omisión por profundidad;
   - quitar el nombre propio de la vista jerárquica;
   - accesibilidad, impresión, fecha de generación visible y aviso de uso interno.
5. **Lanzador local:** actualizar la rama esperada y añadir `backend-integrado`, si se quiere seguir usando `.\organigrama`.
