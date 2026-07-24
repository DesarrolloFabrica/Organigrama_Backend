/**
 * Tipos compartidos del inventario recursivo de hojas de vida en Google Drive.
 */

/** PDF (u otro archivo) inventariado con ruta relativa desde la carpeta raíz. */
export type DriveCvFile = {
  driveFileId: string;
  driveFileName: string;
  driveWebUrl: string;
  mimeType: string;
  /** Cédula extraída del nombre, o null si el nombre es inválido. */
  document: string | null;
  parentFolderId: string;
  /** folderPath[0] o null si el PDF cuelga directo de la raíz. */
  areaFolder: string | null;
  /** folderPath[1] o null. */
  subareaFolder: string | null;
  /** Ruta relativa completa incluyendo el nombre del PDF. */
  relativePath: string;
  /** Nombres de carpetas desde la raíz hasta el padre del archivo (sin el PDF). */
  folderPath: string[];
  modifiedTime: string | null;
  md5Checksum: string | null;
  fileSize: number | null;
};

/** Hijo crudo de una carpeta (PDF, carpeta u otro). */
export type DriveFolderChild = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  parents: string[];
  modifiedTime: string | null;
  md5Checksum: string | null;
  size: number | null;
};

/** Resumen del recorrido recursivo (antes de cruzar con BD). */
export type DriveCvInventoryStats = {
  rootFolderId: string;
  rootFolderName: string | null;
  foldersVisited: number;
  pdfCount: number;
  nonPdfFileCount: number;
  files: DriveCvFile[];
};

/** Alias histórico (metadatos mínimos). Preferir DriveCvFile. */
export type DriveCvPdfFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
};

export function toLegacyDriveCvPdfFile(file: DriveCvFile): DriveCvPdfFile {
  return {
    id: file.driveFileId,
    name: file.driveFileName,
    mimeType: file.mimeType,
    webViewLink: file.driveWebUrl || null,
  };
}
