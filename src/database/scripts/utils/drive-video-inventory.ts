/**
 * Inventario BFS recursivo de videos en Google Drive (solo lectura / diagnóstico).
 *
 * Reutiliza autenticación OAuth readonly del flujo CV (`createDriveCvClient`).
 * No descarga contenido, no escribe BD, no modifica Drive.
 */
import type { drive_v3 } from 'googleapis';
import {
  createDriveCvClient,
  DRIVE_FOLDER_MIME,
  getDriveFolderMeta,
} from './google-drive-cv-client';
import { parseDriveVideoFileName } from './drive-video-document';
import {
  classifyDriveVideoFormat,
  mimeExtensionInconsistent,
} from './drive-video-format';
import type {
  DriveVideoDuplicateGroup,
  DriveVideoInventoryItem,
  DriveVideoInventoryReport,
  DriveVideoInventorySummary,
} from './drive-video-types';
import type { DriveVideoFormatClass } from './drive-video-format';

type ListedChild = {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  modifiedTime: string | null;
  md5Checksum: string | null;
  size: number | null;
};

/**
 * Lista hijos directos con campos mínimos del contrato (sin webViewLink).
 */
export async function listVideoFolderChildren(
  folderId: string,
  options?: { drive?: drive_v3.Drive; pathLabel?: string },
): Promise<ListedChild[]> {
  const drive = options?.drive ?? createDriveCvClient();
  const pathLabel = options?.pathLabel ?? folderId;
  const query = `'${folderId}' in parents and trashed = false`;
  const children: ListedChild[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const response = await drive.files.list({
        q: query,
        fields:
          'nextPageToken, files(id, name, mimeType, parents, modifiedTime, md5Checksum, size)',
        pageSize: 1000,
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageToken,
      });

      for (const file of response.data.files ?? []) {
        const sizeRaw = file.size;
        let size: number | null = null;
        if (sizeRaw != null && sizeRaw !== '') {
          const n = Number(sizeRaw);
          size = Number.isFinite(n) ? n : null;
        }
        children.push({
          id: file.id ?? '',
          name: file.name ?? '',
          mimeType: file.mimeType ?? '',
          parents: file.parents ?? [],
          modifiedTime: file.modifiedTime ?? null,
          md5Checksum: file.md5Checksum ?? null,
          size,
        });
      }
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Error listando hijos de Drive (video) folderId=${folderId} path="${pathLabel}": ${message}`,
    );
  }

  return children.filter((c) => c.id);
}

function emptyFormatCounts(): Record<DriveVideoFormatClass, number> {
  return {
    SUPPORTED_MVP: 0,
    INVENTORY_ONLY: 0,
    INCOMPATIBLE_MVP: 0,
    NON_VIDEO: 0,
  };
}

function buildDuplicateGroups(
  items: DriveVideoInventoryItem[],
): DriveVideoDuplicateGroup[] {
  const byDoc = new Map<string, DriveVideoInventoryItem[]>();
  for (const item of items) {
    if (!item.validName || !item.document) continue;
    // Solo videos (no NON_VIDEO) para duplicados de documento
    if (item.formatClass === 'NON_VIDEO') continue;
    const list = byDoc.get(item.document) ?? [];
    list.push(item);
    byDoc.set(item.document, list);
  }

  const groups: DriveVideoDuplicateGroup[] = [];
  for (const [document, list] of byDoc) {
    if (list.length < 2) continue;
    groups.push({
      document,
      count: list.length,
      fileIds: list.map((i) => i.driveFileId),
      names: list.map((i) => i.driveFileName),
      relativePaths: list.map((i) => i.relativePath),
    });
  }
  groups.sort((a, b) => b.count - a.count || a.document.localeCompare(b.document));
  return groups;
}

export type InventoryDriveVideosOptions = {
  rootFolderId: string;
  /** Tope opcional de archivos no-carpeta inventariados. */
  maxItems?: number;
  drive?: drive_v3.Drive;
};

/**
 * BFS recursivo bajo la carpeta raíz de videos.
 */
export async function inventoryDriveVideos(
  options: InventoryDriveVideosOptions,
): Promise<DriveVideoInventoryReport> {
  const rootFolderId = options.rootFolderId.trim();
  if (!rootFolderId) {
    throw new Error('rootFolderId vacío: no se puede inventariar videos.');
  }

  const client = options.drive ?? createDriveCvClient();
  let rootFolderName: string | null = null;
  try {
    const meta = await getDriveFolderMeta(rootFolderId, client);
    rootFolderName = meta.name;
  } catch {
    rootFolderName = null;
  }

  const items: DriveVideoInventoryItem[] = [];
  const visited = new Set<string>();
  let totalChildrenListed = 0;
  let truncated = false;

  type QueueItem = { folderId: string; folderPath: string[] };
  const queue: QueueItem[] = [{ folderId: rootFolderId, folderPath: [] }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.folderId)) continue;
    visited.add(current.folderId);

    const pathLabel =
      current.folderPath.length > 0 ? current.folderPath.join('/') : '(raíz)';

    const children = await listVideoFolderChildren(current.folderId, {
      drive: client,
      pathLabel,
    });
    totalChildrenListed += children.length;

    for (const child of children) {
      if (child.mimeType === DRIVE_FOLDER_MIME) {
        queue.push({
          folderId: child.id,
          folderPath: [...current.folderPath, child.name],
        });
        continue;
      }

      if (
        options.maxItems != null &&
        options.maxItems >= 0 &&
        items.length >= options.maxItems
      ) {
        truncated = true;
        queue.length = 0;
        break;
      }

      const parsed = parseDriveVideoFileName(child.name);
      const formatClass = classifyDriveVideoFormat({
        mimeType: child.mimeType,
        extension: parsed.extension,
      });
      const inconsistent = mimeExtensionInconsistent({
        mimeType: child.mimeType,
        extension: parsed.extension,
      });

      const relativePath =
        current.folderPath.length > 0
          ? `${current.folderPath.join('/')}/${child.name}`
          : child.name;

      items.push({
        driveFileId: child.id,
        driveFileName: child.name,
        mimeType: child.mimeType,
        parents: child.parents,
        parentFolderId: current.folderId,
        relativePath,
        folderPath: [...current.folderPath],
        modifiedTime: child.modifiedTime,
        md5Checksum: child.md5Checksum,
        size: child.size,
        document: parsed.document,
        extension: parsed.extension,
        validName: parsed.validName,
        nameReason: parsed.reason,
        formatClass,
        mimeExtensionInconsistent: inconsistent,
      });
    }
  }

  items.sort((a, b) => {
    const byPath = a.relativePath.localeCompare(b.relativePath, 'es');
    if (byPath !== 0) return byPath;
    return a.driveFileId.localeCompare(b.driveFileId);
  });

  const byFormatClass = emptyFormatCounts();
  for (const item of items) {
    byFormatClass[item.formatClass] += 1;
  }

  const totalVideos =
    byFormatClass.SUPPORTED_MVP +
    byFormatClass.INVENTORY_ONLY +
    byFormatClass.INCOMPATIBLE_MVP;

  const videoItems = items.filter((i) => i.formatClass !== 'NON_VIDEO');
  const validNameCount = videoItems.filter((i) => i.validName).length;
  const invalidNameCount = videoItems.filter((i) => !i.validName).length;

  const duplicateDocuments = buildDuplicateGroups(items);
  const uniqueDocSet = new Set(
    videoItems.filter((i) => i.validName && i.document).map((i) => i.document!),
  );

  const summary: DriveVideoInventorySummary = {
    generatedAt: new Date().toISOString(),
    rootFolderId,
    rootFolderName,
    foldersVisited: visited.size,
    totalChildrenListed,
    totalFiles: items.length,
    totalVideos,
    byFormatClass,
    validNameCount,
    invalidNameCount,
    uniqueDocuments: uniqueDocSet.size,
    duplicateDocumentCount: duplicateDocuments.reduce((s, g) => s + g.count, 0),
    duplicateGroups: duplicateDocuments.length,
    mimeExtensionInconsistentCount: items.filter(
      (i) => i.mimeExtensionInconsistent,
    ).length,
    truncated,
    maxItems: options.maxItems ?? null,
  };

  const invalidNames = videoItems
    .filter((i) => !i.validName)
    .map((i) => ({
      driveFileId: i.driveFileId,
      driveFileName: i.driveFileName,
      relativePath: i.relativePath,
      mimeType: i.mimeType,
      reason: i.nameReason,
      formatClass: i.formatClass,
    }));

  return {
    summary,
    duplicateDocuments,
    invalidNames,
    items,
  };
}

export function getDriveVideoFolderIdFromEnv(): string {
  const folderId = process.env.GOOGLE_DRIVE_VIDEO_FOLDER_ID?.trim();
  if (!folderId) {
    throw new Error(
      'Falta GOOGLE_DRIVE_VIDEO_FOLDER_ID (o pase --folderId). ' +
        'Defina el ID de la carpeta raíz de videos de presentación.',
    );
  }
  return folderId;
}
