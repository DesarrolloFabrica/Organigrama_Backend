# Ticket temporal de reproducción — video de presentación (Fase 3B)

**Estado:** **IMPLEMENTADA_Y_VALIDADA** (2026-08-03)  
**API metadatos:** [`person-profile-video-api.md`](./person-profile-video-api.md)  
**Arquitectura general:** [`person-profile-modules-and-presentation-architecture.md`](./person-profile-modules-and-presentation-architecture.md)  
**Streaming (3C):** [`person-profile-video-streaming.md`](./person-profile-video-streaming.md) — endpoint `…/video/stream` usa este ticket en cada Range.  
**Auditoría visibilidad emisión (2026-08-05):** [`../../docs/person-profile-video-visibility-audit.md`](../../docs/person-profile-video-visibility-audit.md)

---

## 1. Propósito

Autorizar de forma temporal y específica la reproducción de **un** video activo de **una** persona objetivo, para un viewer **autenticado** que obtuvo metadatos en `GET …/video`.

El ticket se emite cuando `hasVideo=true`. La emisión ya **no** exige `canViewFullProfile` (política global autenticada, 2026-08-05); sí exige JWT de sesión en el endpoint de metadatos. El formato del ticket (`sub`, `targetPersonId`, `personVideoId`, `purpose`, TTL, HS256) **no cambió**.

Ver: [`../../docs/person-profile-video-visibility-audit.md`](../../docs/person-profile-video-visibility-audit.md).

---

## 2. Amenazas que resuelve

| Amenaza | Mitigación |
|---------|------------|
| JWT de sesión en query de `<video>` (filtración en logs/Referer) | Ticket de media separado, corto TTL |
| URL permanente a Drive | No se expone `drive_file_id` ni URL |
| Token opaco en memoria de una sola instancia Cloud Run | JWT firmado stateless (multi-instancia) |
| Acceso a otro video / otra persona | Claims `targetPersonId` + `personVideoId` + `sub` |
| Reuso como sesión general | `purpose: person-video-stream` obligatorio |

---

## 3. Por qué no usar el JWT principal en la URL

El JWT de sesión vive mucho más tiempo, contiene identidad de login y a menudo se registra en proxies.  
El elemento `<video src>` no puede enviar `Authorization` de forma fiable; un ticket corto en query limita la ventana de abuso y no sustituye la sesión para el resto de la API.

---

## 4. Estrategia stateless

- Algoritmo: **HS256** (explícito; `algorithms: ['HS256']` en verify; **no** se acepta `none`).
- Secreto: `PERSON_VIDEO_STREAM_TICKET_SECRET` (dedicado; **sin** fallback a `AUTH_JWT_SECRET`).
- Sin persistencia en PostgreSQL.
- Sin estado en memoria de instancia.
- Compatible con varias réplicas Cloud Run.

---

## 5. Claims

| Claim | Significado |
|-------|-------------|
| `sub` | `viewerPersonId` |
| `targetPersonId` | Persona del video |
| `personVideoId` | PK interna de `organigrama.person_video` (solo dentro del ticket) |
| `purpose` | `person-video-stream` |
| `v` | `1` (versión de contrato) |
| `iat` / `exp` | Emisión / expiración (Unix seconds) |
| `jti` | UUID opcional (trazabilidad; no single-use en esta fase) |

**No** incluye: documento, nombres, correo, Drive ids/paths/URLs, checksum, permisos, JWT de sesión.

---

## 6. TTL

- Default: **120** segundos.
- Env: `PERSON_VIDEO_STREAM_TICKET_TTL_SECONDS`
- Rango: **30–600**; inválido o fuera de rango → 120 + warning (sin secretos).

El mismo ticket puede autorizar múltiples requests Range dentro del TTL (Fase 3C).  
No hay revocación ni single-use en 3B.

### Reutilización en HTTP Range (Fase 3C — implementada)

El endpoint `GET …/video/stream?ticket=…`:

- revalida firma/exp/purpose al **inicio** de cada request;
- el ticket **no** es single-use: N Ranges válidos mientras `now < exp`;
- si expira **durante** un body ya abierto, no se corta a mitad; **nuevas** requests → 401 `STREAM_TICKET_EXPIRED`;
- revalida fila `person_video` / persona / vacante en cada request.

Detalle operativo: [`person-profile-video-streaming.md`](./person-profile-video-streaming.md).

---

## 7. Secreto

- Env: `PERSON_VIDEO_STREAM_TICKET_SECRET`
- Mínimo **32** caracteres.
- No imprimir, no devolver en errores, no reportes, no BD.
- Si falta o es corto: **no se emite** ticket (`CONFIG_ERROR` → HTTP 503 en metadatos).
- Documentado en `.env.example`; **no** se modificó el `.env` real en esta fase.

---

## 8. Validación interna

`OrgChartVideoTicketService.verifyStreamTicket(ticket)` → payload tipado.

Códigos internos (aún no mapeados a HTTP de stream):

- `MISSING_TICKET`
- `INVALID_SIGNATURE`
- `EXPIRED_TICKET`
- `INVALID_PURPOSE`
- `INVALID_VERSION`
- `INVALID_CLAIMS`
- `CONFIG_ERROR`

La comprobación de que el video sigue `is_active` queda para **Fase 3C** (ver arquitectura de streaming).

---

## 9. Contrato API (metadatos)

### Actual (3B, implementado)

```json
{
  "hasVideo": true,
  "fileName": "Video de presentación",
  "mimeType": "video/mp4",
  "sizeBytes": 123,
  "lastSync": "…",
  "streamReady": false,
  "ticketReady": true,
  "streamTicket": "<jwt>",
  "streamTicketExpiresAt": "ISO-8601"
}
```

### Propuesto al implementar 3C (pendiente)

Eliminar `streamReady` / `ticketReady`; añadir `streamUrl`. Ver [`person-profile-video-streaming-architecture.md`](./person-profile-video-streaming-architecture.md).

Sin video / sin permiso / vacante: `{ "hasVideo": false }` (sin ticket).

- **No** `videoId` / `personVideoId` públicos.

---

## 10. Código

```
src/org-chart/video/
  org-chart-video-ticket.config.ts
  org-chart-video-ticket.service.ts
  org-chart-video-ticket.types.ts
  org-chart-video-ticket.service.spec.ts
```

Registrado en `OrgChartModule`. Sin consulta BD en el servicio de firma.

---

## 11. Pruebas

Unitarias: emisión, verify, TTL, claims, alteración, secreto incorrecto, expirado, purpose/versión, claims incompletos, TTL fuera de rango, secreto corto, `alg=none`, no emisión en anti-enumeración/vacante/sin video, no exposición de `personVideoId`/`drive_file_id` en JSON.

Validación real: SELECT + emisión/verificación con secreto **solo en proceso** (no persistido en `.env`); `person_video` 13/13 sin cambios.

---

## 12. Limitaciones

- Sin endpoint `/video/stream`.
- Sin Range / bytes / Drive.
- Sin revocación.
- Ticket usable solo cuando exista 3C.

---

## 13. Estado

**IMPLEMENTADA_Y_VALIDADA**
