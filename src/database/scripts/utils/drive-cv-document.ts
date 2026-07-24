/**
 * Regla única de identificación de cédula desde el nombre de un PDF de CV.
 *
 * Acepta: trim externo + uno o más dígitos + ".pdf" (case insensitive).
 * Rechaza: puntos/guiones/prefijos/sufijos o cualquier carácter no dígito
 * antes de la extensión.
 */

/**
 * Extrae el documento (solo dígitos) desde el nombre del archivo.
 * @returns documento o null si el nombre no cumple la regla estricta.
 */
export function extractDocumentFromCvFileName(fileName: string): string | null {
  const trimmed = fileName.trim();
  const match = /^(\d+)\.pdf$/i.exec(trimmed);
  return match ? match[1] : null;
}

/** Alias estable usado por sync/diag/client. */
export const extractDocument = extractDocumentFromCvFileName;
