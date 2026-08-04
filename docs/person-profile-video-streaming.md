# Streaming de video de presentación con HTTP Range (Fase 3C)

**Estado:** **IMPLEMENTADA_Y_VALIDADA** (2026-08-03)  
**Arquitectura:** [`person-profile-video-streaming-architecture.md`](./person-profile-video-streaming-architecture.md)  
**Ticket:** [`person-profile-video-stream-ticket.md`](./person-profile-video-stream-ticket.md)  
**API metadatos:** [`person-profile-video-api.md`](./person-profile-video-api.md)

---

## 1. Endpoint

```http
GET /api/org-chart/person/:personId/video/stream?ticket=<jwt-media>
```

| Aspecto | Valor |
|---------|--------|
| Auth | Solo `ticket` (`@Public()` respecto a JwtAuthGuard) |
| Bearer | No requerido / no suficiente |
| JWT sesión en query | Prohibido |
| Controlador | `OrgChartController.streamPersonVideo` |
| Servicio | `OrgChartVideoStreamService` |

---

## 2. Autenticación y revalidación

1. Verificar ticket (firma HS256, exp, purpose, versión, claims).
2. `targetPersonId` del ticket = `:personId` URL.
3. SELECT `person_video` por `personVideoId`: activo, `person_id` match, `drive_file_id`, MIME permitido.
4. Persona target activa y no vacante.
5. **No** reejecutar `canViewFullProfile` (autorización del ticket durante TTL).

---

## 3. Range

Parser: `org-chart-video-range.ts`

- Un rango `bytes=start-end` o `bytes=start-`
- Multi-range / suffix `bytes=-N` → **416**
- Sin Range → **200**
- Con Range válido → **206**

---

## 4. Headers

Comunes: `Content-Type`, `Accept-Ranges: bytes`, `Content-Disposition: inline`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`.

206: `Content-Range`, `Content-Length` del segmento cuando es confiable.

Sin ETag de Drive.

---

## 5. Drive

Cliente: `OrgChartVideoDriveStreamClient`

- OAuth readonly compartido (`createDriveCvClient` / `GOOGLE_DRIVE_CV_TOKEN_PATH`)
- `files.get` + `alt=media` + `responseType: 'stream'`
- Header `Range` opcional
- AbortSignal + timeout de apertura (`PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_MS`, default 20000)
- **No** Buffer completo; **no** disco; **no** `downloadCvPdfBuffer`

---

## 6. Pipeline y abort

`stream.pipeline(driveReadable, res)` + AbortController en `req`/`res` `close`.

Seek/cancel del cliente → `STREAM_CLIENT_ABORTED` (log), sin 5xx.

---

## 7. Timeout

`PERSON_VIDEO_STREAM_UPSTREAM_TIMEOUT_MS` — solo apertura upstream. No corta pipe activo.

Documentado en `.env.example`. **No** se modificó `.env` real.

---

## 8. Errores

| Caso | HTTP | code |
|------|------|------|
| Ticket ausente/inválido | 401 | `STREAM_TICKET_INVALID` |
| Ticket expirado | 401 | `STREAM_TICKET_EXPIRED` |
| Target/video/persona inválidos | 404 | `STREAM_*_NOT_FOUND` / mismatch |
| Range inválido | 416 | `STREAM_RANGE_INVALID` |
| Drive 403 | 502 | `STREAM_DRIVE_FORBIDDEN` |
| Timeout / cuota | 503 | `STREAM_DRIVE_TIMEOUT` / `RATE_LIMIT` |

Sin mensajes Google, fileId ni ticket en body.

---

## 9. Logging

Ids internos, status, Range normalizado, duración, upstream status, abort.  
**Nunca:** ticket, query completa, drive_file_id, PII, OAuth.

---

## 10. Contrato metadatos (definitivo)

```json
{
  "hasVideo": true,
  "fileName": "...",
  "mimeType": "video/mp4",
  "sizeBytes": 123,
  "lastSync": "...",
  "streamTicket": "...",
  "streamTicketExpiresAt": "...",
  "streamUrl": "/api/org-chart/person/:id/video/stream?ticket=..."
}
```

Sin `streamReady` / `ticketReady`. Negativo: `{ "hasVideo": false }`.

---

## 11. Pruebas

- Unitarias módulo video: **50 passed** (range, ticket, stream, metadatos).
- Smoke real (Nest :3099, secreto efímero en proceso, OAuth CV, Cloud SQL SELECT):
  - metadatos con `streamUrl`, sin flags legacy;
  - GET sin Range → **200** (abort tras ~2KB; no guardado a disco);
  - `bytes=0-1023` → **206**, 1024 bytes, `Content-Range` correcto;
  - `bytes=1024-2047` → **206**, 1024 bytes;
  - ticket inválido → 401 `STREAM_TICKET_INVALID`;
  - ticket expirado → 401 `STREAM_TICKET_EXPIRED`;
  - `person_video` **13/13** sin cambios.

---

## 12. Limitaciones

- Sin HEAD, ETag, multi-range, suffix ranges.
- Sin UI Presentación.
- Videos grandes: el cliente debe preferir Range; un GET completo es válido HTTP pero costoso.
- Renovación de ticket ante expiración: responsabilidad del frontend futuro.

---

## 13. Estado

**IMPLEMENTADA_Y_VALIDADA**
