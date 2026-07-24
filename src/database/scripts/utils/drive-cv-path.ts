/**
 * Construcción pura de ruta relativa / metadatos de área (para inventario y tests).
 */
import { extractDocument } from './drive-cv-document';
import type { DriveCvFile } from './drive-cv-types';

export function buildRelativePath(
  folderPath: string[],
  fileName: string,
): string {
  return [...folderPath, fileName].join('/');
}

/** Arma un DriveCvFile a partir de path de carpetas + metadatos de archivo. */
export function buildDriveCvFile(params: {
  driveFileId: string;
  driveFileName: string;
  parentFolderId: string;
  folderPath: string[];
  driveWebUrl?: string;
  mimeType?: string;
  modifiedTime?: string | null;
  md5Checksum?: string | null;
  fileSize?: number | null;
}): DriveCvFile {
  const folderPath = [...params.folderPath];
  return {
    driveFileId: params.driveFileId,
    driveFileName: params.driveFileName,
    driveWebUrl: params.driveWebUrl ?? '',
    mimeType: params.mimeType ?? 'application/pdf',
    document: extractDocument(params.driveFileName),
    parentFolderId: params.parentFolderId,
    areaFolder: folderPath[0] ?? null,
    subareaFolder: folderPath[1] ?? null,
    relativePath: buildRelativePath(folderPath, params.driveFileName),
    folderPath,
    modifiedTime: params.modifiedTime ?? null,
    md5Checksum: params.md5Checksum ?? null,
    fileSize: params.fileSize ?? null,
  };
}
