/**
 * Parser de nombres de archivos de video de presentación (independiente de CV).
 *
 * Regla: ^(\d+)(?:[-_].+)?\.(mp4|webm|mov)$
 * El documento se conserva como string (sin convertir a número).
 */

export type DriveVideoNameParseResult = {
  document: string | null;
  extension: string | null;
  validName: boolean;
  reason: string | null;
};

const VIDEO_NAME_RE = /^(\d+)(?:[-_].+)?\.(mp4|webm|mov)$/i;

/**
 * Parsea el nombre de archivo (basename). No usa carpeta ni ruta.
 */
export function parseDriveVideoFileName(
  fileName: string,
): DriveVideoNameParseResult {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return {
      document: null,
      extension: null,
      validName: false,
      reason: 'EMPTY_NAME',
    };
  }

  const match = VIDEO_NAME_RE.exec(trimmed);
  if (!match) {
    return {
      document: null,
      extension: null,
      validName: false,
      reason: 'INVALID_PATTERN',
    };
  }

  return {
    document: match[1],
    extension: match[2].toLowerCase(),
    validName: true,
    reason: null,
  };
}
