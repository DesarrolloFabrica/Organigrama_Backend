/**
 * DTO de respuesta para la consulta de hoja de vida (CV) de una persona.
 *
 * Se devuelve al frontend en:
 *   GET /api/org-chart/person/:personId/cv
 *
 * Los campos opcionales solo vienen cuando la persona SÍ tiene hoja de vida.
 */
export interface PersonCvResponseDto {
  /** true si la persona tiene un registro de CV activo en organigrama.person_cv. */
  hasCv: boolean;

  /** Nombre del archivo en Drive (drive_file_name). Solo si hasCv = true. */
  fileName?: string;

  /** URL para visualizar el PDF en Drive (drive_web_url). Solo si hasCv = true. */
  viewUrl?: string;

  /** Fecha de última sincronización (synced_at) en ISO 8601. Solo si hasCv = true. */
  lastSync?: string;
}
