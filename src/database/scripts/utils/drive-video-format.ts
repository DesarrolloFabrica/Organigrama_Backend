/**
 * Clasificación de formatos para inventario de videos de presentación.
 */

export type DriveVideoFormatClass =
  | 'SUPPORTED_MVP'
  | 'INVENTORY_ONLY'
  | 'INCOMPATIBLE_MVP'
  | 'NON_VIDEO';

export function classifyDriveVideoFormat(params: {
  mimeType: string;
  extension: string | null;
}): DriveVideoFormatClass {
  const mime = (params.mimeType || '').trim().toLowerCase();
  const ext = (params.extension || '').trim().toLowerCase();

  const isMp4 =
    ext === 'mp4' || mime === 'video/mp4' || mime.endsWith('/mp4');
  if (isMp4) {
    return 'SUPPORTED_MVP';
  }

  const isWebm = ext === 'webm' || mime === 'video/webm';
  if (isWebm) {
    return 'INVENTORY_ONLY';
  }

  const isMov =
    ext === 'mov' ||
    mime === 'video/quicktime' ||
    mime.includes('quicktime');
  if (isMov) {
    return 'INCOMPATIBLE_MVP';
  }

  if (mime.startsWith('video/')) {
    return 'INCOMPATIBLE_MVP';
  }

  // Extensión de video conocida sin MIME video/* (p. ej. application/octet-stream)
  if (ext === 'mp4' || ext === 'webm' || ext === 'mov') {
    if (ext === 'mp4') return 'SUPPORTED_MVP';
    if (ext === 'webm') return 'INVENTORY_ONLY';
    return 'INCOMPATIBLE_MVP';
  }

  return 'NON_VIDEO';
}

/**
 * Detecta inconsistencia MIME vs extensión cuando ambas aportan señal de formato.
 */
export function mimeExtensionInconsistent(params: {
  mimeType: string;
  extension: string | null;
}): boolean {
  const mime = (params.mimeType || '').trim().toLowerCase();
  const ext = (params.extension || '').trim().toLowerCase();
  if (!ext || !mime.startsWith('video/')) {
    return false;
  }
  if (ext === 'mp4' && mime !== 'video/mp4' && !mime.endsWith('/mp4')) {
    return true;
  }
  if (ext === 'webm' && mime !== 'video/webm') {
    return true;
  }
  if (
    ext === 'mov' &&
    mime !== 'video/quicktime' &&
    !mime.includes('quicktime')
  ) {
    return true;
  }
  return false;
}
