/**
 * Tipos / contrato de GET /api/org-chart/person/:personId/video
 *
 * Fase 3C: metadatos + ticket + streamUrl.
 */

export type PersonVideoUnavailableResponse = {
  hasVideo: false;
};

export type PersonVideoAvailableResponse = {
  hasVideo: true;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  lastSync: string | null;
  /** JWT de media (purpose person-video-stream). No es el JWT de sesión. */
  streamTicket: string;
  streamTicketExpiresAt: string;
  /** Path relativo al endpoint de stream (incluye ticket). */
  streamUrl: string;
};

export type PersonVideoResponseDto =
  | PersonVideoUnavailableResponse
  | PersonVideoAvailableResponse;

/** Fila mínima leída de organigrama.person_video (nunca se expone cruda). */
export type PersonVideoActiveRow = {
  id: string;
  drive_file_name: string | null;
  mime_type: string | null;
  drive_file_size: string | number | null;
  synced_at: Date | string | null;
};
