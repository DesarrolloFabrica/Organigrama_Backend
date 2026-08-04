# API de disponibilidad de video de presentación (Fases 3A–3C)

**Estado metadatos (3A):** **IMPLEMENTADA_Y_VALIDADA**  
**Estado ticket (3B):** **IMPLEMENTADA_Y_VALIDADA**  
**Estado stream (3C):** **IMPLEMENTADA_Y_VALIDADA** — [`person-profile-video-streaming.md`](./person-profile-video-streaming.md)  
**Arquitectura streaming:** [`person-profile-video-streaming-architecture.md`](./person-profile-video-streaming-architecture.md)  
**Ticket:** [`person-profile-video-stream-ticket.md`](./person-profile-video-stream-ticket.md)  
**Arquitectura módulos:** [`person-profile-modules-and-presentation-architecture.md`](./person-profile-modules-and-presentation-architecture.md)

---

## Endpoint metadatos

```http
GET /api/org-chart/person/:personId/video
```

Auth: JWT de sesión. Visibilidad: `canViewFullProfile`.

### Contrato definitivo

```ts
type PersonVideoResponse =
  | { hasVideo: false }
  | {
      hasVideo: true;
      fileName: string;
      mimeType: string;
      sizeBytes: number | null;
      lastSync: string | null;
      streamTicket: string;
      streamTicketExpiresAt: string;
      streamUrl: string;
    };
```

Sin `streamReady` / `ticketReady`. Sin `videoId` / Drive ids públicos.

`streamUrl` es relativo y usa `encodeURIComponent(ticket)`.

### Endpoint stream

```http
GET /api/org-chart/person/:personId/video/stream?ticket=<jwt>
```

Detalle: [`person-profile-video-streaming.md`](./person-profile-video-streaming.md).
