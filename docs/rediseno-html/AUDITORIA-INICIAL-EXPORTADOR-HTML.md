> **Documento histórico.** Auditoría de solo lectura del exportador HTML hecha el 24-nov-2026 sobre `c5f2a0f`, **antes** del rediseño. Sirvió de base para la primera entrega (`6736e60`). Las rutas `backend/…` se refieren al worktree `_integracion/backend`. Estado actual y pendientes: `docs/rediseno-html/README.md`.

# Auditoría técnica del exportador HTML de Organigrama (base para el rediseño UX/UI)

Fecha: 24-nov-2026. Solo lectura: no se modificó ningún archivo, rama, base de datos ni servicio.

## 0. Qué código se auditó (verificado)

| Pieza | Dónde | Estado |
|---|---|---|
| Backend en producción | worktree `_integracion/backend-fase2`, rama `fase3/excel-coordinaciones-20261124`, commit `c5f2a0f` | limpio, igual a `origin`; Cloud Run `organigrama-backend-robusto-c5f2a0f` al 100 % |
| Frontend en producción | worktree `_integracion/frontend`, commit `16b490d` | Cloud Run `organigrama-frontend-robusto-16b490d` al 100 % |
| Repos `Organigrama_Backend` / `Organigrama_Frontend` | rama `main` (`64a720f` / `a61ef0e`) | versión antigua, **no** es producción; no se tocaron |

Método de verificación:
- lectura del código;
- render local de la función pura con 196 personas sintéticas;
- medición del HTML real de producción **en memoria**: `dist` de c5f2a0f, sesión `default_transaction_read_only=on` y auditoría simulada que lanza error si alguien intenta escribir. Solo se imprimieron conteos agregados y el HTML no se guardó en disco;
- lectura REST de la configuración de Cloud Run.

El ejemplo versionado `test/qa/directory-export/samples/organigrama-ejemplo-sintetico.html` es del commit `130ef91` y **no refleja el código actual**.

---

## 1. Arquitectura actual del exportador HTML

```
Frontend (React)                                  Backend (NestJS)                                PostgreSQL (Cloud SQL)
OrgChartDirectoryExportBar ──fetch GET──▶ OrgChartController.exportActiveHtml
  (botón «Descargar HTML»)    Bearer JWT          │
                                                  ▼
                                   OrgChartDirectoryExportService.exportActiveHtml
                                     └ runAuditedExport('html')
                                         1. ensureCanExport ─────────────────────────────▶ core.person_permission
                                         2. buildHtmlFile
                                              └ loadPresentation
                                                  └ loadActiveDirectoryPeople   (COMPARTIDO con Excel)
                                                      └ loadActiveDirectoryRows (COMPARTIDO)
                                                          ├ versionService.resolveReadPlan(viewer, {})
                                                          └ inReadOnlySnapshot (REPEATABLE READ, READ ONLY)
                                                              ├ directorySql() ─────────────────▶ relaciones efectivas + core.person + catálogos
                                                              └ getRoleNameOverridesForVersion ─▶ overrides de cargo
                                                      └ resolveDirectoryPeople + shouldIncludeDirectoryRow
                                              └ buildOrgChartHtml(people, versionLabel, artwork)   (SOLO HTML, función pura)
                                         3. audit.record(SUCCESS) ───────────────────────▶ organigrama.org_chart_directory_export_audit
                                  ◀── StreamableFile text/html (attachment)
Blob → <a download> → archivo .html
```

Resumen:
- El HTML es **una sola cadena de texto** construida con *template literals* de TypeScript dentro de una función pura.
- No usa motor de plantillas ni componentes, y no hay JavaScript en el documento.
- No hay archivos `.css`, `.hbs`, `.ejs` ni recursos estáticos propios del exportador.

## 2. Flujo desde el botón hasta el archivo

1. **Ubicación del botón.** `OrgChartPage.tsx:367` y `OrgChartExplorePage.tsx:300` montan `<OrgChartDirectoryExportBar />`, debajo de `OrgChartVersionBar`.
2. **Visibilidad.**
   - El estado inicial sale de los permisos del JWT (`getDirectoryExportAccess(getAuthUser())`).
   - Al montar, el componente consulta `GET /api/org-chart/export/permissions`. El backend lo lee de BD y el resultado sincroniza la sesión guardada.
   - Sin permisos, la barra no se pinta.
3. **Clic.** `runDownload('html', downloadOrgChartHtml)`. El botón pasa a «Generando…» y se desactivan los dos botones (`OrgChartDirectoryExportBar.tsx:150-164`).
4. **Petición.** `requestOrgChartExport('html')` (`orgChartService.ts`):
   - hace `fetch(BASE_URL + '/api/org-chart/export/html')` con `Accept: text/html` y `Authorization: Bearer`;
   - un 403 lanza `DirectoryExportForbiddenError`: se resincronizan los permisos y se muestra «Acceso denegado…»;
   - un 401 muestra «Tu sesión expiró…»;
   - otro código muestra «No se pudo descargar el HTML (HTTP n)».
5. **Backend.**
   - `OrgChartController.exportActiveHtml` (`org-chart.controller.ts:208`), protegido por el guard JWT global, delega en `exportActiveHtml`.
   - `runAuditedExport` (`org-chart-directory-export.service.ts:374`) ejecuta tres pasos:
     1. Autoriza leyendo `core.person_permission`:
        - sin persona → 401;
        - si falla la consulta → 503 y auditoría `ERROR/PERMISSION_CHECK_FAILED`;
        - sin permiso → 403 y auditoría `DENIED/FORBIDDEN`.
     2. Genera. Si falla, audita `ERROR/GENERATION_FAILED`.
     3. Audita `SUCCESS` con `version_id` y `row_count`. Si esa escritura falla, responde 503 y **no entrega el archivo** (fail-closed).
6. **Respuesta.** `StreamableFile` con:
   - `Content-Type: text/html; charset=utf-8`;
   - `Content-Disposition: attachment; filename="organigrama-AAAA-MM-DD.html"`;
   - `Cache-Control: no-store, no-cache, must-revalidate`.

   `Content-Disposition` está expuesto por CORS (`main.ts:77` y `:198`), así que el frontend lee el nombre.
7. **Descarga en el navegador.**
   1. Se toma el nombre del encabezado (respaldo: `organigrama.html`).
   2. Se crean un `Blob` y un `File`, luego un `URL.createObjectURL`.
   3. Se hace clic en un `<a download>` temporal.
   4. La URL se revoca con un `setTimeout`.
8. **Nombre del archivo.**
   - Formato `organigrama-${directoryExportDateStamp()}.html`.
   - La fecha se calcula en `America/Bogota` (`org-chart-directory-export.util.ts:49`).
   - El archivo se regenera en cada petición. No hay caché, ETag ni almacenamiento.

## 3. Archivos y funciones responsables

| Capa | Archivo | Funciones / elementos | ¿Compartido con Excel? |
|---|---|---|---|
| Botón y descarga | `frontend/src/features/org-chart/components/OrgChartDirectoryExportBar.tsx` | `OrgChartDirectoryExportBar`, `runDownload`, `handleForbidden` | sí (misma barra) |
| | `frontend/src/features/org-chart/services/orgChartService.ts` | `DIRECTORY_EXPORT_REQUEST`, `requestOrgChartExport`, `downloadOrgChartExport`, `downloadOrgChartHtml`, `fetchDirectoryExportPermissions` | sí |
| | `frontend/src/features/org-chart/utils/directoryExportAccess.ts` | sincronización de permisos | sí |
| Entrega HTTP | `backend/src/org-chart/org-chart.controller.ts:203-217` | `exportActiveHtml` (`@Get('export/html')`, `@Header('Cache-Control')`) | patrón gemelo de `export/directory` |
| Permisos | `org-chart-directory-export.permissions.ts` | `DIRECTORY_EXPORT_PERMISSION.html = ORG_DIRECTORY_EXPORT_HTML` | sí |
| Auditoría | `org-chart-directory-export-audit.service.ts` | `record`, `recordBestEffort`, `errorName` | sí |
| Orquestación | `org-chart-directory-export.service.ts` | `exportActiveHtml` (358), `runAuditedExport` (374), `buildHtmlFile` (515), `frontendPublicBase` (698) | `runAuditedExport` sí; `buildHtmlFile` solo HTML |
| Preparación de datos | mismo archivo | `loadPresentation` (536) | **solo HTML**: proyecta 8 campos |
| | mismo archivo | `loadActiveDirectoryPeople` (567), `loadActiveDirectoryRows` (630), `inReadOnlySnapshot` (671), `directorySql` (121) | **compartido** |
| Jefes y cargo | `org-chart-directory-people.ts` | `resolveDirectoryPeople`, `placementRoleName` | **compartido** |
| Filtro de personas | `org-chart-directory-export.util.ts` | `shouldIncludeDirectoryRow`, `isRegularDocenteRole` | **compartido** |
| Escape | `org-chart-directory-export.util.ts:59` | `xmlEscape` | **compartido**: el Excel lo usa para XML |
| Fecha | `org-chart-directory-export.util.ts:49` | `directoryExportDateStamp` | compartido |
| Versión y plan | `org-chart-version.service.ts` | `resolveReadPlan` (377), `resolveVersionForRequest`, `resolveOverlaysForRequest` | compartido con todo el mapa |
| Relaciones efectivas | `org-chart-effective-relation.sql.ts` | `visualRelationSqlSource`, `composedRelationsCall` | compartido con el mapa |
| Overrides de cargo | `org-chart.service.ts` | `getRoleNameOverridesForVersion` | compartido con el mapa |
| **Presentación HTML** | **`org-chart-directory-presentation.ts` (756 líneas)** | ver abajo | **solo HTML** |
| Pestañas por coordinación | `org-chart-directory-coordinations.ts` | — | **solo Excel**; el HTML no lo usa |
| Recursos gráficos | `frontend/public/img/LogoOrganigramasOp.png`, `Submarino.png` | servidos por el frontend de Cloud Run | — |
| Pruebas | `org-chart-directory-presentation.spec.ts` (8 casos), `org-chart-export.http.spec.ts`, `org-chart-directory-export.service.spec.ts` | — | — |

Funciones de `org-chart-directory-presentation.ts`:

| Grupo | Funciones |
|---|---|
| Exportadas | `buildOrgChartHtml`, `buildPresentationForest`, `INACTIVE_BOSS_SECTION_ID`, tipos `PresentationPerson`, `PresentationArtwork` |
| Datos → árbol | `buildPresentationForest`, `presentParentIds`, `isUnderInactiveBossOnly`, `collectDescendants`, `descendantCount` |
| Agrupación y jefaturas | `buildAreaSections`, `pickCoordinator`, `rootPriority` |
| Heurísticas por nombre de cargo | `isDirectorRole`, `isCoordinatorRole`, `isLeaderRole`, `isStaffAnalystRole`, `isHierarchyAnchor`, `isFabricaArea`, `leaderBadge` |
| Render | `renderCard`, `renderPeopleGrid`, `renderHierarchyList`, `renderSubtreeSummary`, `renderTeamBlocks`, `renderAreaSection`, `renderInactiveBossSection` |
| Utilidades | `safePhotoUrl`, `initials`, `areaLabel`, `areaAnchor`, `normalizeRole` |

Contrato de entrada de la presentación, ya separado de la BD:

```ts
type PresentationPerson = {
  personId: string; bossIds: string[]; inactiveBossNames: string[];
  fullName: string; document: string; roleName: string; areaName: string; photoUrl: string;
};
buildOrgChartHtml(people: PresentationPerson[], versionLabel: string,
                  artwork: { logoUrl?: string; submarineUrl?: string }): string
```

## 4. Estructura real del documento

Medición del HTML de producción del 24-nov, en memoria, solo agregados:

| Métrica | Valor |
|---|---|
| Personas (`row_count`) | 196 |
| Tamaño | 107 437 bytes (≈105 KiB) |
| Tiempo de generación (desde local, incluida la latencia a Cloud SQL) | ≈1,7 s |
| Tarjetas `<article>` | 210: 182 personas aparecen una vez y 14 dos veces (la vista jerárquica y su área) |
| `<img>` | 205: 201 de `lh3.googleusercontent.com`; 4 del frontend en Cloud Run (logo, mascota y una foto) |
| Tarjetas con iniciales | 7: 5 personas sin foto y 2 con foto relativa descartada |
| Secciones | 1 vista jerárquica + 9 áreas; sección «jefe inactivo»: 0 |
| Enlaces del menú | 10 |
| `<script>` / `<link>` | 0 / 0 |
| Cajas de resumen | 9 |
| Personas con varios jefes / con jefe inactivo | 0 / 0 (las dos lógicas existen, pero hoy no se activan) |

Áreas en producción, en orden de tamaño:

| Área | Personas | Profundidad máxima local | Modo |
|---|---|---|---|
| OPERACION ACADEMICA | 62 | 2 | equipos |
| FABRICA Y DESARROLLO | 41 | 3 | equipos |
| PRACTICAS | 31 | 1 | plano |
| HOMOLOGACIONES | 14 | 1 | plano |
| ESPECIALIZACIONES | 13 | 1 | plano |
| PROYECCION SOCIAL | 13 (con 2 raíces locales) | 1 | plano |
| SABER PRO | 11 | 1 | plano |
| DIRECCION GENERAL DE OPERACIONES | 6 | 2 | equipos |
| B2B | 5 | 1 | plano |

### Esquema del árbol de secciones (HTML actual)

```
<!DOCTYPE html> <html lang="es">
├─ <head>
│   ├─ meta charset=utf-8, meta viewport
│   ├─ <title>Organigrama OP — {versionLabel}</title>
│   └─ <style> (≈115 líneas, todo inline)
└─ <body>
    └─ div.layout                         (grid: 270px | 1fr)
        ├─ <nav>                          (sticky en escritorio)
        │   ├─ div.brand → img.logo + img.mascot           (remotas, del frontend)
        │   ├─ h1 «Organigrama OP»
        │   ├─ p.meta «{versionLabel} · {N} personas»
        │   ├─ a.nav-home → #org-root «Vista jerárquica» {N}
        │   ├─ a → #area-{i}-{slug} «{ÁREA}» {conteo}       × cada área
        │   └─ a → #jefe-registrado-inactivo                (condicional)
        └─ <main>
            ├─ section.hero#org-root
            │   ├─ p.kicker «Organización» · h2 «Jerarquía desde la Dirección»
            │   ├─ p.lead (texto fijo; menciona por nombre de pila al Coordinador General)
            │   └─ ul.org-tree > li.org-node                (renderHierarchyList)
            │        nivel 0: tarjeta líder completa + ul.org-kids (TODOS sus hijos)
            │        nivel 1: tarjeta mini + ul.org-kids (solo hijos «ancla»: director,
            │                 coordinador, líder, supervisor, analista operativo)
            │        nivel ≥2: tarjeta mini + div.summary-box (total, «Por área», «Por rol»)
            ├─ section.area#area-{i}-{slug}  × cada área   (renderAreaSection)
            │   ├─ header.area-head: p.kicker «Área · N personas» · h2 {ÁREA} · p.lead «Líder: …»
            │   ├─ MODO «EQUIPOS» (área con «fabrica» en el nombre, o con ≥3 niveles locales):
            │   │   ├─ div.leader-wrap > tarjeta líder
            │   │   ├─ h3.subhead «Equipos por líder · K reportes directos»
            │   │   ├─ div.teams
            │   │   │   ├─ div.team (por cada hijo con equipo)
            │   │   │   │   ├─ tarjeta líder · p.team-count «n en el equipo»
            │   │   │   │   ├─ div.people-grid (tarjetas mini de sus hojas)
            │   │   │   │   └─ div.team.nested (subequipos: tarjeta + conteo + grid de hijos)
            │   │   │   └─ div.people-grid (hijos directos sin equipo)
            │   │   └─ div.team por cada raíz local adicional
            │   └─ MODO «PLANO» (resto):
            │       ├─ div.leader-wrap > tarjeta líder (o «Sin líder de área.»)
            │       ├─ h3.subhead «Colaboradores · K»
            │       └─ div.people-grid (tarjetas mini, orden alfabético)
            └─ section.area#jefe-registrado-inactivo   (condicional; tarjetas con nota y resumen)

Tarjeta (renderCard):
article.card[.leader][.compact][.mini] style="--depth:n"
├─ img.photo (https, loading=lazy, alt="")  |  span.photo.initials «AB»
└─ div.card-body
    ├─ p.badge «Dirección|Coordinador|Líder|Analista|Colaborador|Líder del área»   (no en mini)
    ├─ h3 {nombre}
    ├─ p.role {cargo | «Sin cargo»}
    ├─ p.role {nota}                       (solo en la sección de jefe inactivo)
    ├─ p.doc «Cédula {documento}»          (SIEMPRE, en todas las tarjetas)
    └─ p.area-tag {área}                   (no en mini)
```

Respuestas puntuales:

| Elemento | Situación actual |
|---|---|
| Encabezado principal | No hay encabezado superior. La identidad está en la barra lateral: logo, mascota, «Organigrama OP», versión y total. |
| Elementos institucionales | Logo «Organigramas OP» y mascota (submarino), ambos remotos. No hay pie, fecha de generación visible ni aviso de confidencialidad. |
| Estructura de coordinaciones | No existe como tal. El HTML agrupa por **`core.area` de cada persona**, no por subárbol de coordinación como el Excel. |
| Jefes y subordinados | Vista jerárquica resumida arriba. En cada área, el líder y sus equipos (modo equipos) o una cuadrícula plana (modo plano). |
| Información por persona | Foto, insignia, nombre, cargo, **cédula** y área. No muestra correo, teléfono, jefe directo, sede ni enlaces. |
| Conexiones visuales | Solo un `border-left` cian en `.org-kids` y el anidamiento de cajas. No hay líneas tipo organigrama. |
| Distribución | Vertical: lista indentada y secciones apiladas. Horizontal solo dentro de las cuadrículas de tarjetas. |
| Pantallas pequeñas | Un único *breakpoint* a 900 px: el menú pasa arriba, deja de ser fijo y hay que desplazarse por 10 enlaces antes del contenido. |
| Impresión | No hay estilos de impresión. |

## 5. Estilos y componentes

- **CSS inline** en un único `<style>` dentro de `buildOrgChartHtml`. No hay archivos, frameworks ni variables de diseño (*tokens*).
- **Tema oscuro fijo** (`color-scheme: dark`):
  - fondo `#020617` con dos `radial-gradient` cian;
  - texto `#e2e8f0`;
  - secundarios `#94a3b8` y `#cbd5e1`;
  - acentos cian `#22d3ee`, `#67e8f9` y `#a5f3fc`;
  - líderes en ámbar `#f59e0b` y `#fbbf24`.

  Imita la paleta Tailwind *slate/cyan* de la aplicación. No hay modo claro.
- **Tipografía:** `"Segoe UI", sans-serif`, del sistema y sin fuentes web. En macOS, Linux y móviles cae en la sans-serif por defecto.
- **Tamaños muy pequeños:**

  | Elemento | Tamaño |
  |---|---|
  | Insignia | 9 px |
  | Cargo, cédula y área | 10 px |
  | Nombre | 11–12 px |
  | Menú | 12 px |
  | `h2` | 22 px |

- **Componentes:**
  - tarjeta: `grid` 48/52/36 px + texto;
  - `people-grid`: `repeat(auto-fill, minmax(180px, 1fr))`;
  - `team`, `team.nested` y `summary-box` (borde discontinuo);
  - `org-tree` / `org-kids`.
- **Estilos sin efecto (código muerto):**
  - la clase `.compact` se aplica, pero no tiene reglas;
  - `style="--depth:n"` no se usa en el CSS;
  - `AreaSection.depth` se calcula y no se usa.

## 6. Interacciones existentes

- **No hay JavaScript.** Solo enlaces ancla del menú (`#org-root`, `#area-…`), estilos `:hover` y `:focus` del menú, `position: sticky` y `scroll-margin-top`.

| Capacidad | ¿Existe? |
|---|---|
| Menú o índice | Sí: barra lateral con conteos |
| Expandir o contraer | No |
| Búsqueda | No; solo el Ctrl+F del navegador |
| Filtros (por área, cargo o sede) | No |
| Enlaces en nombres o tarjetas | No; las tarjetas no tienen `id`, así que no se puede enlazar a una persona |
| Navegación entre secciones | Solo desde el menú. No hay «siguiente/anterior» ni migas de pan |
| Volver a la vista general | Solo el enlace «Vista jerárquica» del menú fijo; en móvil no hay «volver arriba» |
| Coordinación grande | Cuadrículas largas sin agrupación interna en modo plano (p. ej., 31 personas de Prácticas sin jerarquía) |

## 7. Personas, equipos y jerarquías

### Lógica compartida con el Excel

Vive en el servicio, `people.ts` y `util.ts`.

- **Versión activa.** `resolveReadPlan(viewer, {})`:
  - parámetros vacíos → versión global activa (`getActiveVersion`);
  - overlays de coordinación activos;
  - Planta de Orbit, que en producción está activa (`ORG_CHART_PLANTA_OVERLAY_ENABLED=true`);
  - excepciones publicadas, si existe la capa.

  Ignora `versionId` y `versionCode` de la URL. **No depende de quién descarga**: no hay redacción por visibilidad jerárquica; el único control es el permiso. La etiqueta es `"{name} · {code} (activa)"`.
- **Relaciones.** `directorySql()` lee las aristas efectivas del mismo plan que el mapa (función SQL `org_chart_effective_relations_published` / `_planta`). Cada fila es una **ubicación**:
  - arista directa (rango 0);
  - hijo por posición, que cuelga del ocupante (rango 1);
  - raíz (rango 2).
- **Selección de personas:**
  - `core.person.is_active = true`. El jefe se une sin filtrar `is_active` para detectar jefes inactivos.
  - Luego `shouldIncludeDirectoryRow` excluye:
    - vacantes (por nombre, documento `VAC-` o cargo de vacante);
    - **docentes de planta**: cargo que contiene «docente» y no «líder».

  Hoy salen 196 elegibles.
- **Cargo.** `getRoleNameOverridesForVersion`, en la misma instantánea, con esta precedencia: override por arista > override por persona (overlay > global) > cargo base. Si las ubicaciones de una persona dan cargos distintos, se usa el cargo de la persona.
- **Jefes.** Todos los jefes efectivos distintos, ordenados por nombre (`resolveDirectoryPeople`).
- **Coherencia.** Transacción `REPEATABLE READ READ ONLY`: personas, aristas y cargos salen de la misma foto aunque Orbit escriba durante la generación.

### Lógica exclusiva del HTML

Vive en `presentation.ts` y está basada en heurísticas.

| Aspecto | Regla actual |
|---|---|
| Proyección de datos | `loadPresentation` pasa solo 8 campos. La consulta SQL trae 26 (dirección, nacimiento, contactos de emergencia, *skills*…), pero no llegan al HTML. |
| Árbol | `buildPresentationForest`: la persona se pinta bajo cada jefe presente y en los totales cuenta una vez. Si nadie de su conjunto es su jefe, es raíz. |
| Grupos | Por `areaName` (`core.area`), con «Sin área» por defecto. **No usa** las reglas de coordinación del Excel. Diferencia comprobada hoy: OPERACION ACADEMICA tiene 62 en el HTML y 63 en el Excel, y PROYECCION SOCIAL 13 frente a 12. Es el caso documentado de la persona clasificada por su jefe efectivo en el Excel. |
| Orden de áreas | Primera aparición en un recorrido en profundidad del árbol global. Los hijos se ordenan por prioridad (director, luego coordinador, luego resto) y por nombre. |
| Responsable del área | `pickCoordinator`: entre las raíces locales, prefiere un cargo con «coordinador» o «director», luego el subárbol más grande, luego el nombre. |
| Quién sale en la vista jerárquica | Nivel 0 y 1 completos; desde el nivel 1, solo cargos con «director», «coordinador», «líder», «supervisor» o «analista operativo». |
| Modo de área | «Equipos» si el área contiene «fabrica» o tiene ≥3 niveles locales; si no, «plano». |
| Insignias | Por palabras clave del cargo (`leaderBadge`). |
| Jefe inactivo | Quien solo cuelga de jefes inactivos va a una sección aparte «Jefe registrado inactivo» y también a su área. |
| Excluidos del HTML | Los mismos que el Excel (vacantes, docentes de planta, inactivos). Nadie más. |

## 8. Dependencias externas y funcionamiento sin conexión

- **Sin dependencias de código:** no hay librerías JS, CSS externo, fuentes web ni CDN. El HTML abre sin servidor.
- **Imágenes remotas.** Los 205 `<img>` se piden por Internet al abrir el archivo:
  - fotos: `organigrama.person_profile_state.profile_photo_url` usada tal cual. Hoy 188 personas la tienen en `lh3.googleusercontent.com`;
  - logo y mascota: `${CORS_ORIGIN}/img/…`, la URL pública del frontend. Si falta la variable, hay una URL de respaldo fija en el código (`FRONTEND_PUBLIC_FALLBACK`).
- **Sin conexión:**
  - el texto, la estructura y el estilo funcionan;
  - las imágenes quedan rotas y se ve un círculo vacío, porque `alt=""` y no hay respaldo a iniciales al fallar la carga.
- **Fotos relativas descartadas.** `safePhotoUrl` solo acepta `https://`: 2 personas con foto relativa salen con iniciales, aunque el mapa sí muestra su foto. El mapa resuelve esas rutas con `resolvePublicPhotoUrl` y `getPublicAssetBaseUrl`.
- **Degradación con el tiempo.** Las URL de Google cambian cuando la persona cambia de foto, así que los archivos antiguos pierden imágenes.
- **Privacidad.** Al abrir el archivo, el navegador contacta a Google y al frontend (IP y hora). No se envía `Referer` desde `file://`.

## 9. Problemas UX/UI detectados

1. **Omisión silenciosa de personas (defecto latente, verificado con datos sintéticos).**
   - En modo «equipos», `renderTeamBlocks` solo pinta hasta 3 niveles bajo el líder del área.
   - Una persona 4 o más niveles por debajo **no aparece en ninguna parte del HTML**, pero sí cuenta en los totales y en la auditoría.
   - Hoy Fábrica tiene profundidad 3, justo en el límite, y no falta nadie (0 personas sin pintar). Un nivel más en Orbit o en el organigrama haría desaparecer personas.
2. **Dos agrupaciones distintas.** El HTML agrupa por área registrada y el Excel por coordinación (jerarquía). El mismo día, una persona sale en coordinaciones distintas según el archivo.
3. **Texto fijo con un nombre propio.** El párrafo de la vista jerárquica menciona por nombre de pila al Coordinador General. Quedará mal si cambia la persona.
4. **Jerarquía perdida en el modo plano.** Áreas de 31 personas se ven como cuadrícula alfabética sin subestructura.
5. **Tipografía muy pequeña** (9–10 px) y alta densidad: lectura difícil, sobre todo en pantallas pequeñas.
6. **Sin búsqueda, filtros, colapso ni enlaces a personas.** Ubicar a alguien depende del Ctrl+F.
7. **Duplicación sin aviso.** 14 personas aparecen dos veces (vista general y área) con la misma tarjeta; no hay vínculo entre ambas.
8. **Contexto del documento.** Falta la fecha y hora de generación visibles. Tampoco hay leyenda de insignias ni aviso de uso interno o confidencialidad.
9. **Móvil.** El menú de 10 enlaces empuja el contenido y no hay «volver arriba» ni índice plegable.
10. **Iniciales inconsistentes.** Se ven iniciales solo cuando no hay URL; si la URL falla, queda un círculo vacío.
11. **Accesibilidad:**
    - los nombres usan `h3` y los subtítulos de sección también (jerarquía de encabezados ambigua);
    - `h1` está dentro de `<nav>`;
    - no hay enlace para saltar al contenido;
    - `nav` no tiene `aria-label`;
    - `:focus` quita el `outline` (solo cambia el color del borde);
    - tema oscuro sin alternativa;
    - las iniciales se leen letra por letra.
12. **Impresión inutilizable.** Los navegadores no imprimen fondos por defecto: queda texto casi blanco sobre papel blanco, sin control de saltos de página.

## 10. Riesgos técnicos y de seguridad

| Riesgo | Situación actual | Riesgo en un rediseño |
|---|---|---|
| Datos personales | Cada tarjeta muestra la **cédula** (210 veces). Las otras 18 columnas sensibles de la consulta **no** llegan al HTML. | Añadir campos (correo, teléfono…) amplía la exposición de un archivo que circula fuera del sistema. **Decisión del usuario:** ¿se conserva la cédula? |
| Inyección HTML/JS | `xmlEscape` escapa `& < > "` en todo texto y atributo; los atributos van entre comillas dobles; las URL solo aceptan `https://` y `"` → `%22`; los anclajes van saneados (*slug*); no hay JS. **Correcto hoy.** No escapa `'` (sin impacto hoy) y **no hay prueba** con nombres maliciosos. | Es el **mayor riesgo**: incrustar datos en `<script>` (JSON) exige serializar escapando `<`, `>`, `&`, ` ` y ` `. Añadir `onclick`/`href` dinámicos exige validar esquemas. Conviene una CSP en `<meta>`. |
| Fotos sin conexión | Remotas. | Incrustar en base64 eleva el tamaño (≈2–6 MB para 196 personas) y obliga al servidor a descargar de Google: tiempos de espera, fallos y concurrencia. |
| Dependencias externas | Ninguna de código. | Un CDN (fuentes o librerías) rompe el funcionamiento sin conexión y filtra la apertura del archivo; mejor incrustar o no usar. |
| Tamaño | ≈105 KiB. | Holgado. Vigilar si se duplican las tarjetas por vista. |
| Rendimiento | Cuatro construcciones de bosque y `collectDescendants` por nodo: trivial con 196. `visit()` copia el conjunto `seen` y duplica subárboles bajo cada jefe: con muchas personas de varios jefes (hoy 0) crecería mucho. | JS de búsqueda sobre 200–1300 nodos es trivial; evitar re-renderizados masivos del DOM. |
| Navegadores | CSS grid, custom properties y `loading=lazy`: navegadores modernos. | Mantener JS ES2017 sin *transpilar* y probar en Chrome, Edge, Safari y Firefox; los visores de correo y Drive pueden bloquear `<script>`, así que hay que mejorar de forma progresiva (que funcione sin JS). |
| Responsividad y accesibilidad | Ver §9. | Requisitos explícitos (WCAG AA). |
| Impresión | Inexistente. | Añadir `@media print`. |
| Permisos y auditoría | `runAuditedExport` y `ensureCanExport` son independientes del render. `row_count` = personas únicas (`people.length`). | **No tocar** el controlador ni `runAuditedExport`; mantener la semántica de `row_count`. |
| Afectación al Excel | Compartidos: `loadActiveDirectoryPeople`, `loadActiveDirectoryRows`, `directorySql`, `resolveDirectoryPeople`, `shouldIncludeDirectoryRow`, **`xmlEscape`**, `directoryExportDateStamp`. | No editar esos símbolos para el rediseño. En especial, no «mejorar» `xmlEscape`: el Excel SpreadsheetML depende de él. Crear un escapador HTML propio. |
| Pruebas | `presentation.spec` y `export.http.spec` comprueban cadenas y clases concretas. | El rediseño romperá esas aserciones; hay que reescribirlas por invariantes (ver §12). |
| Código con nombres reales | Los comentarios y el texto fijo citan a personas concretas. | Eliminar en el rediseño. |

## 11. Qué se puede rediseñar sin tocar la lógica de negocio

La separación **ya existe en lo esencial**: todo el documento sale de `buildOrgChartHtml(PresentationPerson[], versionLabel, artwork)`, que es una función pura, sin BD ni Nest.

**Rediseño libre** (solo `org-chart-directory-presentation.ts` y, como mucho, los parámetros de `buildHtmlFile`):
- estructura del documento, CSS, tema, tipografía, tarjetas e impresión;
- navegación, búsqueda, filtros y colapso (con JS incrustado);
- eliminar la cédula o ocultarla, y eliminar el texto fijo con nombre;
- corregir la omisión por profundidad (renderizado recursivo);
- arreglar la accesibilidad y el respaldo de imágenes a iniciales.

**Mezclado dentro de la presentación** (técnicamente es presentación, pero cambia lo que el usuario entiende como estructura): agrupar por área en vez de por coordinación, la elección del líder, las heurísticas por palabras del cargo, el modo equipos/plano y la sección de jefe inactivo. Se puede cambiar sin tocar datos, pero cada cambio **debe decidirse explícitamente**.

**Requiere tocar el servicio**, fuera de la presentación pura:
- **Agrupar igual que el Excel.** Reutilizar `groupDirectoryByCoordination` exige pasar `placements` a la presentación. Es solo lectura, pero cambia la firma de `loadPresentation` y `buildHtmlFile`.
- **Fotos incrustadas.** Añade una fase de descarga de imágenes en el servidor.
- **Mostrar campos nuevos.** Amplía `PresentationPerson` y la exposición de datos.

**No tocar:** controlador, permisos, auditoría, `directorySql`, `resolveDirectoryPeople`, `shouldIncludeDirectoryRow`, `xmlEscape`, plan de versión, frontend principal ni Excel.

## 12. Recomendaciones de arquitectura para el nuevo diseño

Propuesta de capas (no implementada):

```
[1 Datos]        loadActiveDirectoryPeople (INTACTO, compartido con Excel)
      │
[2 Proyección]   loadPresentation → PresentationPerson[]  (+ placements solo si se decide agrupar como el Excel)
      │
[3 Modelo vista] buildOrgChartViewModel(people, meta) → { meta, sections, tree, stats }   ← función pura, probada
      │                 sin HTML: decide grupos, responsables, orden, conteos, duplicados
[4 Render]       renderOrgChartDocument(viewModel, assets) → string
      │                 plantillas con un único escapador HTML propio (p. ej. etiqueta html`` con autoescape)
[5 Estilos]      org-chart-html.styles.ts (constante) o .css copiado como asset de Nest
[6 Interacción]  org-chart-html.client.ts → JS vanilla incrustado, mejora progresiva
      │                 los datos para búsqueda salen del DOM (data-*) o de <script type="application/json"> serializado de forma segura
[7 Entrega]      buildHtmlFile + runAuditedExport + controlador (INTACTOS salvo el nombre de la función de render)
```

Recomendaciones concretas:

1. **Archivos nuevos en lugar de editar los compartidos**, por ejemplo `org-chart-html/view-model.ts`, `render.ts`, `styles.ts`, `client.ts` y `escape.ts`. `buildHtmlFile` solo cambia la función que llama.
2. **Reversión doble:**
   - Cloud Run ya ofrece revisiones etiquetadas (`fase3` → `fase2` → `robusto`);
   - además, se puede conservar el renderizador actual seleccionable por variable de entorno (p. ej. `ORG_CHART_HTML_LAYOUT=v1|v2`) durante la transición.
3. **Pruebas por invariantes** en vez de comparar cadenas:
   - toda persona elegible aparece al menos una vez (habría detectado la omisión por profundidad);
   - los totales coinciden con `row_count`;
   - escape con nombres maliciosos (`<script>`, `"onerror=`, `</script>`, ` `);
   - no hay URL que no sean `https:`/`data:`;
   - presupuesto de tamaño;
   - sin red: ningún `<script src>` ni `<link>` externo;
   - CSP presente.
4. **CSP en `<meta>`:** `default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'sha256-…'` (*hash* del script incrustado).
5. **Fotos.**
   - Fase A: remotas, con respaldo a iniciales al fallar (`onerror` o capa CSS) y resolviendo las rutas relativas igual que el mapa.
   - Fase B, opcional: miniaturas WebP de 64–96 px incrustadas en base64, con límite de concurrencia y tiempo, y respaldo a iniciales.
6. **Mejora progresiva.** Sin JS, el documento debe seguir siendo un índice navegable y completo, porque Drive, Outlook y algunos visores bloquean scripts.
7. **Accesibilidad e impresión como requisitos:**
   - `h1` en el encabezado y `h2` por sección; los nombres no deben usar encabezados;
   - enlace para saltar al contenido y foco visible;
   - mínimo 12–14 px;
   - `@media print` en claro, con `break-inside: avoid`;
   - opción de tema claro.
8. **Eliminar los nombres propios** del texto y de los comentarios. Llevar las palabras clave de cargos a un solo módulo de reglas.
9. **Decisiones pendientes del usuario antes de diseñar:**
   1. ¿Se mantiene la cédula?
   2. ¿El HTML agrupa por área (como hoy) o por coordinación (como el Excel)?
   3. ¿Se añade algún dato de contacto?
   4. ¿Fotos remotas o incrustadas?
   5. ¿Hace falta impresión o PDF?

### Artefactos de esta auditoría (scratchpad, no versionados)

- `html-audit/render-sintetico.ts`: renderiza el HTML actual con 196 personas sintéticas → `organigrama-sintetico-actual.html` (95 KB, sin datos reales, útil para que el diseñador vea el documento).
- `html-audit/profundidad.ts`: reproduce la omisión por profundidad.
- `html-audit/medir-html-prod-readonly.js`: métricas agregadas de producción (solo lectura, en memoria).
