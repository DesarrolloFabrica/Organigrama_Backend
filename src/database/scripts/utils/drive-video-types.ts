/**
 * Tipos del inventario diagnóstico de videos de presentación (Drive).
 * Separado de drive-cv-types / person_cv.
 */

import type { DriveVideoFormatClass } from './drive-video-format';

export type DriveVideoInventoryItem = {
  driveFileId: string;
  driveFileName: string;
  mimeType: string;
  parents: string[];
  parentFolderId: string;
  relativePath: string;
  folderPath: string[];
  modifiedTime: string | null;
  md5Checksum: string | null;
  size: number | null;
  document: string | null;
  extension: string | null;
  validName: boolean;
  nameReason: string | null;
  formatClass: DriveVideoFormatClass;
  mimeExtensionInconsistent: boolean;
};

export type DriveVideoDuplicateGroup = {
  document: string;
  count: number;
  fileIds: string[];
  names: string[];
  relativePaths: string[];
};

export type DriveVideoInventorySummary = {
  generatedAt: string;
  rootFolderId: string;
  rootFolderName: string | null;
  foldersVisited: number;
  totalChildrenListed: number;
  totalFiles: number;
  totalVideos: number;
  byFormatClass: Record<DriveVideoFormatClass, number>;
  validNameCount: number;
  invalidNameCount: number;
  uniqueDocuments: number;
  duplicateDocumentCount: number;
  duplicateGroups: number;
  mimeExtensionInconsistentCount: number;
  truncated: boolean;
  maxItems: number | null;
};

export type DriveVideoInventoryReport = {
  summary: DriveVideoInventorySummary;
  duplicateDocuments: DriveVideoDuplicateGroup[];
  invalidNames: Array<{
    driveFileId: string;
    driveFileName: string;
    relativePath: string;
    mimeType: string;
    reason: string | null;
    formatClass: DriveVideoFormatClass;
  }>;
  items: DriveVideoInventoryItem[];
};
