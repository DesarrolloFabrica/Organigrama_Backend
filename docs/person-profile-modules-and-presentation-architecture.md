# Módulos del perfil y Presentación (video)

**Estado:** arquitectura aprobada para diseño (Fase 1).  
**Alcance:** documentación. Sin implementación de código, migraciones, endpoints, sync ni UI.  
**Fecha de diseño:** 2026-08-03.  
**Rama de contexto:** `feat/mc1-competencies-mvp` (repos Backend / Frontend).

---

## 1. Contexto

Organigrama OP muestra el detalle de una persona en el panel lateral `PersonDetailPanel` (`Organigrama_Frontend/src/features/org-chart/components/PersonDetailPanel.tsx`).

Hoy el panel, cuando el viewer tiene ficha completa y el nodo no es vacante, expone dos pestañas:

| Código actual | Etiqueta UI | Contenido |
|---------------|-------------|-----------|
| `ficha` | Ficha | Datos de perfil, contacto, CV (enlace Drive externo) |
| `competencias` | Competencias | `CompetenciesExplorer` (MC1 lectura) |

Se incorporará un tercer módulo:

| Código propuesto | Etiqueta UI | Contenido |
|------------------|-------------|-----------|
| `presentacion` | Presentación | Video embebido: la persona describe funciones / alcance / trabajo |

### Diferencia funcional frente a hojas de vida

| Aspecto | Hoja de vida (`person_cv`) | Presentación (`person_video`) |
|---------|----------------------------|-------------------------------|
| Almacenamiento origen | Google Drive (carpeta CV) | Google Drive (carpeta videos, distinta) |
| Match persona | Documento en nombre de archivo | Documento en nombre de archivo |
| Consumo UI | Enlace externo (`viewUrl` / nueva pestaña) | Reproductor HTML **dentro** del panel |
| Exposición Drive | `webViewLink` posible en API CV | **Prohibido** exponer `webViewLink` / iframe Drive |
| Binario | Descarga Buffer en pipelines CV | Proxy streaming con Range vía backend |
| Tabla | `organigrama.person_cv` | `organigrama.person_video` (nueva, separada) |

---

## 2. Decisiones aprobadas

> **Actualización (2026-08-05):** la decisión 2 quedó **superada por implementación**. Presentación es visible para cualquier usuario autenticado (no requiere ficha completa). Ficha/CV siguen jerárquicos. Detalle: [`../../docs/person-profile-video-visibility-audit.md`](../../docs/person-profile-video-visibility-audit.md).

1. La asociación video ↔ persona se hace **solo** por el número de documento al inicio del nombre de archivo. Carpeta, área, escuela, rol, cargo o jerarquía **no** determinan la pertenencia.
2. ~~La pestaña Presentación solo aparece si existe video y ficha completa.~~ **Vigente:** Presentación aparece si hay video activo y el viewer está autenticado; no exige `canViewFullProfile`.
3. Las vacantes **nunca** tienen Presentación.
4. El video se reproduce **dentro** del panel; sin autoplay; sin nueva pestaña; sin iframe Drive; sin redirección.
5. Al cambiar de persona, cerrar/minimizar el panel o cambiar de pestaña: **pausar y desmontar** el reproductor (sin audio en segundo plano).
6. Formato principal esperado: **MP4 H.264 + AAC**. Extensiones admitidas en inventario: `mp4`, `webm`, `mov`.
7. El binario **no** vive en PostgreSQL; no se guardan URLs públicas de Drive.
8. Presentación **no** acopla ni modifica árbol, `person_cv`, MC1, login Google ni fotos.
9. El sistema de pestañas se evoluciona a un registro pequeño de módulos (extensible), sin framework pesado.
10. Autenticación del `<video src>` mediante **ticket temporal firmado** (stateless), no el JWT de sesión en la URL.

---

## 3. Sistema de módulos del perfil

### 3.1 Estado actual (problema)

`PersonDetailLoaded` mantiene:

```ts
useState<"ficha" | "competencias">("ficha")
```

y JSX duplicado (`role="tab"` / `tabpanel`) con condiciones `hasFull && !isVacancy && activeTab === …`.

Ese union type rígido no escala a certificaciones, proyectos, etc.

### 3.2 Contrato propuesto (frontend)

Ubicación futura sugerida:

`src/features/org-chart/profile-modules/`

Tipos (nombres alineados al código existente; no imponer framework):

```ts
type ProfileModuleCode =
  | 'ficha'
  | 'competencias'
  | 'presentacion'
  // futuros: 'certificaciones' | 'proyectos' | 'publicaciones' | 'logros' | …

type ProfileModuleVisibilityContext = {
  personId: string
  hasFullProfile: boolean
  isVacancy: boolean
  /** Resultado lazy de probes (p. ej. hasVideo). */
  probes: {
    hasPresentation?: boolean | 'loading' | 'unknown'
  }
}

type ProfileModuleDefinition = {
  code: ProfileModuleCode
  label: string
  order: number
  /** Si false, el tab no se renderiza. */
  isAvailable: (ctx: ProfileModuleVisibilityContext) => boolean
  /** Montar contenido solo cuando el tab está activo. */
  lazyLoad: boolean
  /** Desmontar al salir del tab (obligatorio para multimedia). */
  unmountOnExit: boolean
  /** Icono opcional (componente o null). */
  icon?: React.ComponentType<{ className?: string }>
  render: (props: { personId: string }) => React.ReactNode
}
```

Registro estático ordenado (ejemplo conceptual):

| code | label | order | lazyLoad | unmountOnExit | isAvailable |
|------|-------|-------|----------|---------------|-------------|
| `ficha` | Ficha | 10 | false* | false | siempre si hay detalle; tablist solo si `hasFull && !vacancy` (hoy ficha también llena el cuerpo sin tabs) |
| `competencias` | Competencias | 20 | true | true | `hasFull && !vacancy` |
| `presentacion` | Presentación | 30 | true | true | `hasFull && !vacancy && probes.hasPresentation === true` |

\*La ficha puede seguir siendo el contenido por defecto fuera del tablist cuando no hay ficha completa (comportamiento actual).

### 3.3 Qué permanece en `PersonDetailPanel`

- Shell HUD (`EntityScanShell`), cabecera (foto, nombre, cargo, badges, cerrar/minimizar).
- Carga de `useOrgPersonDetail(personId)`.
- Reset de estado al cambiar persona (`key={personId}` ya presente + módulo activo → `ficha`).
- Orquestación del **tablist** a partir del registro de módulos.
- Contenedor `tabpanel` del módulo activo.

### 3.4 Qué se mueve a componentes por módulo

| Módulo | Componente |
|--------|------------|
| Ficha | Extraer cuerpo actual a `PersonFichaPanel` (o equivalente) |
| Competencias | Ya existe `CompetenciesExplorer` |
| Presentación | Nuevo `PersonPresentationPanel` |

### 3.5 Selección del módulo activo

- Estado: `activeModule: ProfileModuleCode` (string acotado por el registro, no union rígido infinito en el panel).
- Default al abrir / cambiar persona: `ficha`.
- Si el módulo activo deja de estar disponible (p. ej. Presentación desaparece al cambiar persona), fallback a `ficha`.

### 3.6 Reset al cambiar de persona

Ya existe `key={props.personId}` en `PersonDetailLoaded`. Mantenerlo.

Además:

1. `activeModule = 'ficha'`.
2. Invalidar probes (`hasPresentation` → `unknown` / refetch).
3. Desmontar cualquier `<video>` (garantizado por unmount del hijo + `unmountOnExit`).

### 3.7 Ocultar módulos no disponibles

- `isAvailable === false` → **no renderizar** el botón `role="tab"`.
- No reservar placeholder vacío en el tablist (evita tabs “fantasma”).
- Para Presentación: ocultación completa hasta confirmación `hasPresentation === true` (ver §8).

### 3.8 Desmontar multimedia

- Presentación: `unmountOnExit: true` → al cambiar de tab o persona el `<video>` se desmonta.
- En `useEffect` cleanup: `video.pause()`, `video.removeAttribute('src')`, `video.load()` opcional.
- Minimizar / cerrar panel: el árbol React del detalle se desmonta o deja de renderizar el loaded panel → misma limpieza.

### 3.9 Accesibilidad

Conservar patrón actual:

- Contenedor: `role="tablist"` + `aria-label="Secciones de la ficha"`.
- Botones: `role="tab"`, `aria-selected`, `aria-controls`, `id`.
- Panel: `role="tabpanel"`, `aria-labelledby`.
- Navegación teclado (fase de implementación): flechas entre tabs visibles; `Home`/`End` opcionales.

IDs estables sugeridos: `person-tab-{code}`, `person-panel-{code}`.

### 3.10 Evitar cargar todos los módulos al abrir

- Solo montar el `render` del módulo activo (y ficha como default).
- Competencias y Presentación: lazy (ya parcialmente cierto para competencias vía condición `activeTab ===`).
- Probe de disponibilidad de video: request **ligero** y **paralelo**, no bloqueante de la ficha (ver §8).

### 3.11 Complejidad

Abstracción mínima: un array de definiciones + un hook `useProfileModules(ctx)` que filtra y ordena. Sin plugin runtime, sin DI, sin code-splitting obligatorio en Fase 4A (puede añadirse `React.lazy` después si el bundle lo exige).

---

## 4. Contrato funcional de Presentación (estados UX)

### 4.1 Estados visibles

| Código | Nombre | Descripción |
|--------|--------|-------------|
| A | Disponible | Metadatos OK + `streamUrl` listo; reproductor montable |
| B | Cargando disponibilidad | Probe `GET …/video` en curso |
| C | Cargando reproductor | `<video>` montado; buffering / metadata |
| D | Error temporal de reproducción | Fallo de red/stream/ticket; reintentable |
| E | Video retirado o no disponible | Antes había video o expectativa rota; ya no hay activo |
| F | Acceso no permitido | Viewer sin ficha completa (anti-enumeración en API) |
| G | Archivo incompatible | MIME/codecs no reproducibles en el cliente |
| H | Persona vacante | Nodo `nodeKind === 'vacancy'` |

### 4.2 Qué provoca cada estado

| Estado | ¿Mostrar pestaña? | UI dentro del panel | Reintento |
|--------|-------------------|---------------------|-----------|
| A | Sí | Reproductor nativo | N/A |
| B | No* | — | Automático (probe) |
| C | Sí (ya visible) | Spinner / “Cargando video…” sobre área 16:9 | No |
| D | Sí | Mensaje + botón Reintentar | Sí |
| E | No (ocultar tab) o mensaje si se llegó mid-session | Si tab ya abierta: “Video no disponible” | Opcional re-probe |
| F | No | — (no revelar) | No |
| G | Sí (si metadatos dijeron disponible) | “Formato no compatible” | No (salvo otro archivo tras sync) |
| H | No | — | No |

\*Durante B la pestaña **no** aparece todavía (evita tab que luego desaparece). Ver estrategia anti-parpadeo en §8.

### 4.3 Reglas funcionales (checklist)

- [x] Pestaña solo si video disponible.
- [x] Solo con acceso a perfil completo; `ORG_READ_ALL` también.
- [x] Vacantes: nunca Presentación.
- [x] Sin autoplay.
- [x] Reproducción in-panel; `controls`; `playsInline`; fullscreen permitido.
- [x] Proporción 16:9; ancho de referencia ~420 px del sidebar actual.
- [x] Cambio de persona / cierre / minimizar / otra pestaña → pause + unmount.
- [x] Sin audio en background.

### 4.4 Ancho del panel (recomendación, no implementar aún)

El sidebar actual (~420 px) deja un área útil ~388 px → altura 16:9 ≈ **218 px**. Es usable, pero el video se siente pequeño en escritorio.

**Recomendación:** variante temporal de layout en escritorio cuando `activeModule === 'presentacion'`: ampliar el panel a ~560–640 px (o overlay modal estrecho anclado al sidebar), sin cambiar el mapa. En móvil: panel full-width ya existente; `playsInline` + fullscreen nativo.

No implementar el cambio de tamaño en Fases 2–3; evaluar en Fase 4B / 5.

---

## 5. Arquitectura Google Drive → persona → UI

```text
Carpeta raíz de videos (Drive)
        │
        ▼
Recorrido BFS recursivo (Shared Drive, paginación)
        │
        ▼
Inventario de archivos de video (MIME / extensión)
        │
        ▼
Parser de documento desde nombre
  ^(\d+)(?:[-_].+)?\.(mp4|webm|mov)$
        │
        ▼
Lookup core.person.document → person_id
        │
        ▼
Planner (dry-run / apply)
  - duplicados por cédula → bloqueo + reporte
  - drive_file_id único
  - replace = deactivate + insert
        │
        ▼
Persistencia organigrama.person_video
        │
        ▼
GET /api/org-chart/person/:id/video   (metadatos + ticket)
        │
        ▼
GET …/video/stream?ticket=…           (proxy Range → Drive)
        │
        ▼
<video> en PersonPresentationPanel
```

### 5.1 Reutilizar conceptualmente del sistema CV

- OAuth readonly (cuenta de servicio / token Drive CV pattern, **carpeta distinta**).
- BFS recursivo, paginación, Shared Drive.
- Dry-run, reporte JSON, activación/desactivación, metadatos Drive (`id`, `name`, `mimeType`, `size`, `modifiedTime`, `md5Checksum`, `parents`, ruta diagnóstica).

### 5.2 No reutilizar directamente

| Artefacto CV | Motivo |
|--------------|--------|
| Parser `dígitos.pdf` | Extensión y regex distintas |
| Tabla / writer `person_cv` | Dominio distinto; riesgo de acoplamiento |
| `viewUrl` / `webViewLink` | Presentación no abre Drive |
| Apertura nueva pestaña | Prohibido |
| Descarga completa a `Buffer` | Streaming por Range |

### 5.3 Regla preliminar de nombres

```regex
^(\d+)(?:[-_].+)?\.(mp4|webm|mov)$
```

**Acepta (ejemplos):**

- `1070007550.mp4`
- `1070007550-presentacion.mp4`
- `1070007550_nombre-persona.webm`
- `1070007550-foo_bar.mov`

**Rechaza:**

| Caso | Motivo |
|------|--------|
| `presentacion-1070007550.mp4` | Dígitos no al inicio |
| `1070007550.MP4` | Extensión case-sensitive (normalizar a lower en implementación) |
| `1070007550.avi` / `.mkv` | Extensión no permitida |
| `1070007550 presentacion.mp4` | Espacio sin `-`/`_` |
| `HV_1070007550.mp4` | Prefijo no numérico |
| `1070007550.pdf` | No es video |
| `1070007550..mp4` | No cumple el grupo opcional |
| Carpetas con solo cédula | No son archivos |

**Seguridad del match:** suficiente como filtro de inventario si se exige que el grupo 1 exista en `core.person.document` (match exacto, sin fuzzy). Riesgos residuales: dos personas no deben compartir documento; archivos de terceros con cédula ajena en el nombre se asociarían erróneamente — mitigar con carpeta raíz controlada + reporte de huérfanos / ambigüedades.

**Decisión pendiente:** normalización Unicode / trim / casefold de extensión; política si el documento en Core tiene ceros a la izquierda distintos.

### 5.4 Duplicados

Si dos archivos válidos matchean la misma cédula:

- **No** elegir automáticamente el más reciente.
- Bloquear aplicación; listar ambos en reporte.
- Resolución humana / renombrado en Drive.

---

## 6. Contrato conceptual de persistencia

### 6.1 Tabla `organigrama.person_video`

**Fase 2A — estado:** **COMPLETADA — APLICADA_Y_VALIDADA** (Cloud SQL `core`, 2026-08-03).

Detalle normativo: [`person-profile-video-persistence.md`](./person-profile-video-persistence.md)  
Migración: `migrations/025_person_video.sql` (SHA-256 `911f7a337a74ffc32be3b14f22945688e2904a8ae818f25befa3bc9e2af0fab3`).

Campos (contrato persistente):

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `BIGSERIAL` PK | Identificador interno API (`personVideoId`) |
| `person_id` | `BIGINT` FK → `core.person.id` `ON DELETE RESTRICT` | Dueño |
| `document` | `VARCHAR(80)` | Documento del match (auditoría; **no** exponer en API pública) |
| `drive_file_id` | `VARCHAR(255)` UNIQUE | Identidad Drive |
| `drive_file_name` | `VARCHAR(255)` | Nombre original |
| `mime_type` | `VARCHAR(120)` | p. ej. `video/mp4` |
| `drive_file_size` | `BIGINT` null | bytes; CHECK ≥ 0 |
| `drive_modified_time` | `TIMESTAMPTZ` null | de Drive |
| `drive_md5_checksum` | `VARCHAR(64)` null | si Drive lo provee |
| `drive_relative_path` | `TEXT` null | ruta diagnóstica desde raíz |
| `drive_parent_folder_id` | `VARCHAR(255)` null | diagnóstico |
| `is_active` | `BOOLEAN` | solo uno activo por persona (índice único parcial) |
| `created_at` / `updated_at` / `synced_at` | `TIMESTAMPTZ` | auditoría; `updated_at` sin trigger |

Índices / constraints (ver persistencia):

- `uq_person_video_drive_file_id`
- `uq_person_video_active_person` — `UNIQUE (person_id) WHERE is_active = TRUE`
- `ix_person_video_person_active`, `ix_person_video_document`
- CHECKs de no vacío (trim) y tamaño no negativo

### 6.2 Reglas

1. Varios registros históricos por persona; **uno** activo.
2. `drive_file_id` no se repite.
3. Reemplazo = desactivar anterior + insertar nuevo (nunca update in-place del file id si cambia el archivo).
4. Duplicados misma cédula en un apply → bloqueo + reporte `DUPLICATE_DOCUMENT`.
5. Sin binario en PG; sin URL pública.
6. MP4 H.264+AAC formato principal; otros MIME pueden persistirse pero la UI puede marcar estado G.

### 6.3 Separación obligatoria

No FK hacia `person_cv`. No columnas compartidas de negocio con MC1. Solo `person_id` hacia Core.

---

## 7. Contratos conceptuales de API

Base path (alineado a CV/competencias): `/api/org-chart/person/:personId/…`

Autenticación de sesión: JWT Bearer (igual que el resto del organigrama).  
Viewer: `OrgViewerContext` + mismas reglas de ficha completa que CV (`self` / descendiente / `ORG_READ_ALL`).

### 7.1 `GET /api/org-chart/person/:personId/video`

**Estado Fase 3A:** implementado — ver contrato operativo en [`person-profile-video-api.md`](./person-profile-video-api.md).

**Responsabilidad actual (3A):** disponibilidad + metadatos mínimos. **Sin** ticket ni `streamUrl`.

**Respuesta 200 (disponible) — Fase 3B:**

```json
{
  "hasVideo": true,
  "fileName": "Video de presentación",
  "mimeType": "video/mp4",
  "sizeBytes": 15485760,
  "lastSync": "2026-08-03T18:20:00.000Z",
  "streamReady": false,
  "ticketReady": true,
  "streamTicket": "<jwt-media>",
  "streamTicketExpiresAt": "2026-08-03T18:22:00.000Z"
}
```

**Respuesta 200 futura (tras 3C) — conceptual:**

```json
{
  "hasVideo": true,
  "personVideoId": "42",
  "fileName": "presentacion.mp4",
  "mimeType": "video/mp4",
  "sizeBytes": 15485760,
  "durationSeconds": null,
  "streamUrl": "/api/org-chart/person/123/video/stream?ticket=…",
  "ticketExpiresAt": "2026-08-03T18:20:00.000Z"
}
```

Notas:

- `fileName` puede ser un label sanitizado (no necesariamente el nombre Drive crudo si contiene documento). Preferible: nombre display genérico o stem sin cédula.
- `durationSeconds` opcional futuro (null al inicio).
- **No exponer:** `drive_file_id`, `drive_web_url`, `document`, rutas internas, credenciales, OAuth.

**Respuesta 200 anti-enumeración (sin permiso o sin video):**

Misma forma que CV:

```json
{ "hasVideo": false }
```

HTTP 200 (no 404) cuando el viewer **no** tiene permiso o no hay video — evita filtrar existencia.  
Alternativa aceptable solo si se alinea con otros endpoints del org-chart: 404 genérico **idéntico** para “sin permiso” y “sin video”; la preferencia de este diseño es **200 + `hasVideo: false`** (como `hasCv`).

### 7.2 `GET /api/org-chart/person/:personId/video/stream`

**Query:** `ticket` (obligatorio).  
**Headers in:** `Range` (opcional, recomendado por el browser).  
**Auth sesión:** el ticket **es** la credencial de este endpoint; no requerir Bearer en `<video>` (el ticket va en query). Opcionalmente aceptar Bearer+ticket en clientes no-video.

**Comportamiento:**

1. Validar firma / TTL / purpose del ticket.
2. Comprobar `viewerPersonId`, `targetPersonId`, `personVideoId` del ticket vs URL y fila activa.
3. Abrir stream Drive con Range reenviado.
4. Responder `200` (sin Range o archivo completo) o `206` (parcial).
5. Propagar `Content-Type`, `Accept-Ranges: bytes`, `Content-Length` / `Content-Range` cuando aplique.
6. Pipe stream; abortar upstream si el cliente cierra.

### 7.3 Matriz HTTP

| Situación | Endpoint | HTTP | Cuerpo / notas |
|-----------|----------|------|----------------|
| Sin sesión | video | 401 | estándar auth |
| Sin sesión | stream | 401 o 403 ticket | sin filtrar existencia de video |
| Sin permiso | video | 200 | `{ hasVideo: false }` |
| Sin permiso | stream | 404 | genérico (no 403 distintivo) |
| Sin video | video | 200 | `{ hasVideo: false }` |
| Sin video | stream | 404 | |
| Ticket inválido | stream | 401/403 | mensaje genérico |
| Ticket expirado | stream | 401/403 | cliente re-pide metadatos |
| Ticket de otro personId | stream | 404 | |
| Range válido | stream | 206 | Content-Range |
| Sin Range | stream | 200 | si Drive/proxy lo permiten; preferir que el cliente envíe Range |
| Range inválido | stream | 416 | |
| Archivo borrado en Drive | stream | 404/502 | marcar/desactivar en job posterior |
| MIME incompatible | video | 200 con flag o hasVideo según política | ver decisión pendiente §12 |
| Vacante | video | 200 | `{ hasVideo: false }` |

---

## 8. Autenticación del reproductor (ticket)

### 8.1 Problema

`<video src>` no envía `Authorization: Bearer`. El JWT de sesión **no** debe colocarse en la query string (logs, historial, Referer).

### 8.2 Opciones evaluadas

| Opción | Pros | Contras |
|--------|------|---------|
| JWT de sesión en query | Simple | Filtrado de secreto de larga vida; inaceptable |
| Token opaco en Redis/Memorystore | Revocación inmediata | Estado compartido entre instancias Cloud Run; infra extra |
| **Ticket JWT firmado stateless (recomendado)** | Multi-instancia Cloud Run; sin store; TTL corto | Revocación solo por TTL (aceptable para media) |

### 8.3 Recomendación: ticket firmado stateless

- Algoritmo: HS256 (o el stack JWT ya usado) con **secreto distinto** o `purpose`/`aud` criptográfico separado, p. ej. `VIDEO_STREAM_TICKET_SECRET` / claim `purpose: "org-video-stream"`.
- Claims mínimos:
  - `vid` — `personVideoId`
  - `tgt` — `targetPersonId`
  - `vwr` — `viewerPersonId`
  - `exp` — TTL corto (p. ej. **60–180 s**; configurable)
  - `jti` — id único (telemetría; no store obligatorio)
- El ticket **solo** autoriza `GET …/video/stream` para ese trío viewer/target/video.
- Múltiples requests Range durante la vigencia: **permitido**.
- No incluye credenciales Drive ni `drive_file_id` (el backend los resuelve por `personVideoId` activo).
- Renovación: el cliente, ante 401 en stream, vuelve a `GET …/video` (con Bearer) y actualiza `src`.

### 8.4 Flujo

```text
Browser (Bearer JWT)
  → GET /video
  ← { streamUrl con ticket, ticketExpiresAt }

Browser <video src=streamUrl>
  → GET /stream?ticket=…  (+ Range)
  ← 206 partial bytes from Drive proxy
```

---

## 9. Streaming y rendimiento

### 9.1 Proxy esperado

- Cliente Google APIs / `googleapis` con `responseType: 'stream'` (o equivalente HTTP Range a `alt=media`).
- Reenviar header `Range` del cliente a Drive.
- Propagar `Content-Type` del archivo activo.
- Propagar `Content-Length` cuando exista; `Accept-Ranges: bytes`; `Content-Range` en 206.
- Pipe sin acumular el archivo en memoria.
- `req.on('close')` → destroy stream upstream.
- Timeouts de socket acotados; límite superior de tamaño configurable (rechazar sync de archivos enormes; en stream, confiar en Range).
- No bloquear el event loop del mapa: el stream es I/O; evitar trabajo CPU pesado en el mismo handler.
- Concurrencia Cloud Run: cada stream ocupa una request; dimensionar `max instances` / concurrency; considerar límite de streams simultáneos por instancia.

### 9.2 Logs

| Sí | No |
|----|----|
| `personVideoId` interno | Ticket completo |
| status HTTP | JWT de sesión |
| bytes / Range servido | `document` |
| duración del handler | URL Drive / file id |
| errores Drive (código genérico) | Credenciales |
| viewer pseudonimizado (`viewerPersonId` hash o id interno ya usado en logs de org) | Contenido del video |

---

## 10. Contrato frontend

### 10.1 Piezas

| Pieza | Rol |
|-------|-----|
| `PersonPresentationPanel` | UI estados A–G; monta `<video>` solo en A/C/D retry |
| `usePersonPresentation(personId)` | React Query: `GET …/video` |
| Tipos | `PersonVideoAvailabilityResponse` |
| Query key | familia dedicada en `queryKeys` (no mezclar con CV/MC1) |

### 10.2 Elemento video

```html
<video
  controls
  playsInline
  preload="metadata"
  src="{streamUrl}"
/>
<!-- sin autoplay; poster opcional futuro -->
```

- Contenedor aspect-ratio `16 / 9`, width 100% del panel.
- Fullscreen: control nativo del browser.
- Cleanup en unmount (pause + clear src).

### 10.3 Cuándo consultar disponibilidad

**Recomendación: híbrido B suave**

1. Al abrir el detalle (tras tener `hasFull && !vacancy`), disparar en paralelo `GET …/video` **sin bloquear** el render de Ficha.
2. Mientras `isLoading` del probe: **no** insertar tab Presentación.
3. Cuando `hasVideo === true`: insertar tab (aparición diferida aceptable; un solo frame de cambio de tabs).
4. No montar `PersonPresentationPanel` hasta que el usuario seleccione Presentación (`lazyLoad` + `unmountOnExit`).

Esto evita retrasar la ficha y reduce parpadeo frente a mostrar un tab “Cargando…” que luego desaparece.

Alternativa descartada para v1: incluir `hasVideo` en `GET …/person/:id` (acopla y engorda la ficha).

### 10.4 Errores y reintento

- Fallo de probe: no mostrar tab (tratar como no disponible); log cliente discreto.
- Fallo de stream (D): mensaje + Reintentar → refetch metadatos (nuevo ticket) + remount video.
- Ticket expirado mid-play: refetch metadatos y reasignar `src` (seek best-effort).

### 10.5 Accesibilidad

- Tab “Presentación” con label claro.
- `<video>` con `aria-label` tipo “Video de presentación de {nombre}”.
- No depender solo del color para errores; texto + `role="status"` / `alert` según gravedad.

---

## 11. Separaciones obligatorias

Presentación **no modifica ni se acopla a:**

- Motor del árbol / root / node / children
- `org_visual_relation` / `core.hierarchy`
- `person_cv` y flujo de hojas de vida (solo reutiliza *patrones*)
- MC1 / competencias (salvo coexistir en el mismo tablist)
- Login Google / foto de perfil

**Puede reutilizar:** patrones OAuth Drive readonly, BFS, dry-run, `OrgViewerContext`, anti-enumeración estilo CV, shell del panel.

---

## 12. Seguridad (resumen)

1. Presentación: cualquier usuario autenticado (no requiere ficha completa). Ficha/CV: `canViewFullProfile` / `ORG_READ_ALL`.
2. Metadatos: no autenticado → 401; vacante/sin video → `hasVideo: false`; inexistente/inactiva → 404.
3. Sin URLs Drive al cliente.
4. Ticket de propósito único, TTL corto, secreto separado; `sub` = viewer autenticado.
5. Stream valida ticket ↔ personId ↔ video activo (sin revalidar jerarquía).
6. Logs sin secretos ni documento.
7. Carpeta Drive de videos con ACL mínima (cuenta de sync).

---

## 13. Plan de implementación por fases

### Fase 2A — Persistencia

**Estado:** **COMPLETADA — APLICADA_Y_VALIDADA** (Cloud SQL, 2026-08-03).

Detalle: [`person-profile-video-persistence.md`](./person-profile-video-persistence.md)

| | |
|--|--|
| **Objetivo** | Migración `person_video` + constraints + docs |
| **Archivos** | `migrations/025_person_video.sql`, docs de persistencia, spec estática |
| **Done** | SQL aplicado en Cloud `core`; constraints/índices verificados; pruebas con ROLLBACK; 0 filas |
| **Pruebas** | Spec estática + integridad transaccional en Cloud |
| **Riesgos** | Sync/Drive aún no implementados |
| **Rollback DDL** | `DROP TABLE organigrama.person_video` solo si se autoriza y no hay datos productivos |

### Fase 2B — Inventario Drive y parser (diagnóstico)

**Estado:** **IMPLEMENTADA_Y_EJECUTADA** (2026-08-03).

Detalle: [`person-profile-video-drive-inventory.md`](./person-profile-video-drive-inventory.md)

| | |
|--|--|
| **Objetivo** | Cliente Drive videos + parser + reporte inventario (sin escribir BD) |
| **Archivos** | `drive-video-*`, `diag-drive-video.ts`, `npm run diag:drive-video` |
| **Done** | Inventario real ejecutado; `summary.json` + `inventory.private.json`; tests parser/formato |
| **Hallazgos** | 16 carpetas; 14 videos mp4; 13 nombres válidos; 1 inválido; 0 duplicados |
| **Pruebas** | Unit parser/format; diag real OAuth CV |
| **Riesgos** | Archivos sin extensión; cuotas Drive |
| **Rollback** | Eliminar scripts/reportes tmp; sin estado en BD |

### Fase 2C — Planner y dry-run

**Estado:** **IMPLEMENTADA_Y_EJECUTADA** (2026-08-03).

Detalle: [`person-profile-video-drive-plan.md`](./person-profile-video-drive-plan.md)

| | |
|--|--|
| **Objetivo** | Plan activate/deactivate/block-duplicates sin apply |
| **Archivos** | `drive-video-plan*`, `drive-video-planner*`, `plan-drive-video.ts` |
| **Done** | Dry-run real: 13 NEW, 1 INVALID_NAME; `person_video` 0→0 |
| **Pruebas** | 26 tests drive-video (parser+format+planner) |
| **Riesgos** | Archivo sin extensión pendiente de renombre operativo |
| **Rollback** | Sin estado BD; borrar reportes tmp |

### Fase 2D — Escritura controlada

**Estado:** **APLICADA_Y_VALIDADA** (carga inicial 2026-08-03) + **IMPLEMENTADA_PENDIENTE_APPLY** (soporte incremental 2026-08-05).

Detalle: [`person-profile-video-drive-apply.md`](./person-profile-video-drive-apply.md)

| | |
|--|--|
| **Objetivo** | Apply controlado de NEW (transacción única); inicial e incremental |
| **Archivos** | `drive-video-apply-*`, `drive-video-sync-writer.ts`, `sync-drive-video.ts` |
| **Done** | 13 INSERT COMMIT inicial (0→13); validador sin métricas fijas 14/13/1/0; snapshot live `personVideoRowsBefore`; planes parciales `--document=` |
| **Pruebas** | Suite `drive-video` (parciales, snapshot stale, rollback mock, idempotencia) |
| **Riesgos** | Plan stale si no se regenera tras otro apply; INVALID_NAME fuera hasta renombre Drive |
| **Rollback** | Solo procedimiento manual autorizado (metadatos productivos en `person_video`) |

### Fase 3A — Metadatos API y seguridad

| | |
|--|--|
| **Estado** | **IMPLEMENTADA_Y_VALIDADA** (2026-08-03) |
| **Objetivo** | `GET …/video` con visibilidad y anti-enumeración |
| **Archivos** | `src/org-chart/video/*`, método en `org-chart.controller.ts`, docs API |
| **Done** | Paridad de permisos con CV; sin leak de Drive ids; `streamReady: false` |
| **Pruebas** | 16 unit tests + GET real A/B + 401/404; `person_video` 13/13 sin cambios |
| **Detalle** | [`person-profile-video-api.md`](./person-profile-video-api.md) |
| **Riesgos** | Divergencia futura con `OrgChartVisibilityService` |
| **Rollback** | No registrar ruta / feature flag |
| **Siguiente** | Fase 3C.0 / 3C streaming |

### Fase 3B — Ticket temporal

| | |
|--|--|
| **Estado** | **IMPLEMENTADA_Y_VALIDADA** (2026-08-03) |
| **Objetivo** | Emitir y validar ticket firmado HS256 |
| **Archivos** | `org-chart-video-ticket.*`, emisión en `OrgChartVideoService` |
| **Done** | TTL 120s, purpose, claims; rechazo alterado/expirado; sin `streamUrl` |
| **Pruebas** | Specs crypto/claims + integración SELECT/emisión |
| **Detalle** | [`person-profile-video-stream-ticket.md`](./person-profile-video-stream-ticket.md) |
| **Riesgos** | Reloj skew; secreto no configurado → 503 |
| **Rollback** | Quitar emisión; 503 si falta secreto |
| **Siguiente** | Fase 3C.0 arquitectura → 3C implementación |

### Fase 3C.0 — Arquitectura del streaming (HTTP Range)

| | |
|--|--|
| **Estado** | **ARQUITECTURA_COMPLETA** (2026-08-03) |
| **Objetivo** | Cerrar diseño de `GET …/video/stream` sin código |
| **Detalle** | [`person-profile-video-streaming-architecture.md`](./person-profile-video-streaming-architecture.md) |
| **Done** | Flujo auth, Range 200/206/416, Drive stream, pipeline, errores, FE, pruebas, decisiones |
| **Siguiente** | Fase 3C implementación |

### Fase 3C — Streaming Range

| | |
|--|--|
| **Estado** | **IMPLEMENTADA_Y_VALIDADA** (2026-08-03) |
| **Objetivo** | Proxy stream con 206 |
| **Archivos** | `org-chart-video-stream*`, `org-chart-video-range*`, `org-chart-video-drive-stream.client.ts` |
| **Done** | 200/206 Range; pipeline; ticket-only; smoke real 1024-byte ranges |
| **Pruebas** | 50 unit + smoke Cloud/Drive readonly |
| **Detalle** | [`person-profile-video-streaming.md`](./person-profile-video-streaming.md) |
| **Riesgos** | Egress videos grandes; renovación ticket en FE |
| **Rollback** | Quitar ruta stream; metadatos sin `streamUrl` |
| **Diseño** | [`person-profile-video-streaming-architecture.md`](./person-profile-video-streaming-architecture.md) |

### Fase 4A — Sistema extensible de módulos

| | |
|--|--|
| **Estado** | **IMPLEMENTADA_Y_VALIDADA** (2026-08-03) |
| **Objetivo** | Registro de módulos; refactor tabs sin cambiar UX Ficha/Competencias |
| **Archivos** | `Organigrama_Frontend/.../profile-modules/*`, `PersonDetailPanel.tsx` |
| **Done** | Contrato tipado; lazy/unmount; Presentación en tipo pero no visible |
| **Pruebas** | Vitest `profile-modules.spec.ts` + build frontend |
| **Detalle FE** | [`../../Organigrama_Frontend/docs/person-profile-modules.md`](../../Organigrama_Frontend/docs/person-profile-modules.md) |
| **Riesgos** | Regresión visual HUD |
| **Rollback** | Revert commit frontend del registro |
| **Siguiente** | Fase 4B pestaña Presentación |

### Fase 4B — Pestaña y reproductor Presentación

| | |
|--|--|
| **Estado** | **IMPLEMENTADA_CON_BLOQUEOS** (2026-08-03) — FE completo; smoke stream requiere `PERSON_VIDEO_STREAM_TICKET_SECRET` local |
| **Objetivo** | Tab condicional + `PersonPresentationPanel` + stream ticketed |
| **Archivos** | `PersonPresentationPanel`, `useOrgPersonVideo`, `personVideoStreamUrl`, ensanche overlay 600px |
| **Done** | Probe no bloquea Ficha; renovación ticket; 1 auto-retry; unmount limpia audio; sin Drive/iframe/Blob |
| **Pruebas** | Vitest streamUrl/rules/parse/modules + build FE |
| **Detalle FE** | [`../../Organigrama_Frontend/docs/person-profile-presentation.md`](../../Organigrama_Frontend/docs/person-profile-presentation.md) |
| **Riesgos** | Codecs móviles; ticket mid-play; egress Drive |
| **Rollback** | Quitar `presentacion` del registro + hook |
| **Siguiente** | Fase 5 piloto / hardening |

### Fase 5 — Piloto y hardening

| | |
|--|--|
| **Objetivo** | Piloto con N personas reales; límites tamaño; métricas; posible ensanche panel |
| **Archivos** | docs ops; ajustes timeout/concurrency; opcional layout ancho |
| **Done** | Checklist piloto; sin leaks; seek estable |
| **Pruebas** | Smoke browser real; carga concurrente acotada |
| **Riesgos** | Coste egress; codecs móviles |
| **Rollback** | Desactivar sync apply; `hasVideo` fuerza false vía flag |

---

## 14. Riesgos globales

1. **Egress / cuotas Drive** en Cloud Run al reproducir videos grandes.
2. **Codecs:** `.mov` / perfiles H.265 pueden fallar en algunos browsers (estado G).
3. **TTL del ticket** vs buffering largo: renovación necesaria.
4. **Duplicados de cédula** en carpeta Drive bloquean sync hasta resolución humana.
5. **Confusión operativa** con carpeta de CVs si se reutiliza la misma raíz (debe ser carpeta distinta).
6. **Anti-enumeración** mal implementada (404 vs 200) filtra PII de proceso.
7. **Acoplamiento accidental** a `person_cv` si se copia el writer sin aislar.

---

## 15. Decisiones pendientes (confirmación humana)

1. **TTL exacto del ticket** (propuesta: 120 s) y política de renovación mid-play.
2. **Nombre de variable de entorno** del secreto del ticket y rotación.
3. **Carpeta raíz Drive** de videos (ID) y si comparte el mismo OAuth client que CV o uno dedicado.
4. **Límite máximo de tamaño** de archivo aceptado en sync (p. ej. 200 MB) y duración máxima objetivo.
5. **MIME incompatible en metadatos:** ¿`hasVideo: false` o `hasVideo: true` + `playable: false`?
6. **Sanitización de `fileName`** en API (¿strip de cédula siempre?).
7. **Ensanche del panel** en escritorio: **sí en 4B** (~600 px con Presentación).
8. **¿Persistir `durationSeconds`?** (requiere probe ffprobe o metadatos externos; fuera de v1 sugerido).
9. **Extensión `.mov`:** ¿aceptar en inventario desde el día 1 o solo `mp4`/`webm`?
10. **Normalización de documento:** trim, quitar ceros a la izquierda, case — alinear con `person_cv`.
11. **Número de migración:** confirmar `025` tras `024_login_apps_organigrama.sql`.
12. **¿El probe de video se cachea en React Query** y con qué `staleTime`? → **sí, 5 min**; ticket se renueva al entrar / error.

---

## 16. Referencias internas

- Panel actual: `Organigrama_Frontend/src/features/org-chart/components/PersonDetailPanel.tsx`
- CV API (anti-enumeración / visibilidad): `Organigrama_Backend/src/org-chart/org-chart-cv.service.ts`
- Visibilidad: `docs/organigrama-core.md` § Visibilidad jerárquica
- Patrones Drive CV (referencia, no reutilizar writers): `src/database/scripts/utils/drive-cv-*`
- Metadatos path CV: `migrations/012_person_cv_drive_path_metadata.sql`

---

## 17. Fuera de alcance de esta fase

- Código funcional, migraciones, endpoints, tickets reales, variables de entorno, sync Drive, cambios UI, commits/push, Cloud SQL, cambios a `person_cv` o MC1.
