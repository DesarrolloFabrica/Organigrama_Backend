/**
 * Script: npm run diag:drive-cv-compare -- --sourceFolderId=... --targetFolderId=...
 *
 * Compara dos árboles de Drive (p. ej. carpeta plana antigua vs jerárquica nueva)
 * por documento (cédula). SOLO LECTURA.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { extractDocument } from './utils/drive-cv-document';
import { parseDriveCvCliArgs } from './utils/drive-cv-cli-args';
import { inventoryCvPdfFiles } from './utils/google-drive-cv-client';
import type { DriveCvFile } from './utils/drive-cv-types';

const TAG = '[DriveCV:compare]';

export type CompareStatus =
  | 'SAME_FILE_ID'
  | 'SAME_CONTENT_DIFFERENT_ID'
  | 'DIFFERENT_CONTENT'
  | 'ONLY_SOURCE'
  | 'ONLY_TARGET'
  | 'DUPLICATE_SOURCE'
  | 'DUPLICATE_TARGET'
  | 'INVALID_SOURCE'
  | 'INVALID_TARGET';

export type CompareItem = {
  document: string | null;
  status: CompareStatus;
  sourceFiles: DriveCvFile[];
  targetFiles: DriveCvFile[];
  reasons: string[];
};

function groupValidByDocument(
  files: DriveCvFile[],
): Map<string, DriveCvFile[]> {
  const map = new Map<string, DriveCvFile[]>();
  for (const f of files) {
    const doc = f.document ?? extractDocument(f.driveFileName);
    if (!doc) continue;
    const list = map.get(doc) ?? [];
    list.push(f);
    map.set(doc, list);
  }
  return map;
}

function sameMd5(a: DriveCvFile, b: DriveCvFile): boolean {
  const x = (a.md5Checksum ?? '').trim().toLowerCase();
  const y = (b.md5Checksum ?? '').trim().toLowerCase();
  return !!x && !!y && x === y;
}

function sameSize(a: DriveCvFile, b: DriveCvFile): boolean {
  return (
    a.fileSize != null && b.fileSize != null && a.fileSize === b.fileSize
  );
}

/**
 * Compara dos inventarios por documento. Exportada para tests unitarios.
 */
export function compareDriveCvInventories(
  sourceFiles: DriveCvFile[],
  targetFiles: DriveCvFile[],
): CompareItem[] {
  const items: CompareItem[] = [];

  for (const f of sourceFiles) {
    if (f.document) continue;
    items.push({
      document: null,
      status: 'INVALID_SOURCE',
      sourceFiles: [f],
      targetFiles: [],
      reasons: ['invalid_filename_source'],
    });
  }
  for (const f of targetFiles) {
    if (f.document) continue;
    items.push({
      document: null,
      status: 'INVALID_TARGET',
      sourceFiles: [],
      targetFiles: [f],
      reasons: ['invalid_filename_target'],
    });
  }

  const sourceByDoc = groupValidByDocument(sourceFiles);
  const targetByDoc = groupValidByDocument(targetFiles);
  const allDocs = new Set([...sourceByDoc.keys(), ...targetByDoc.keys()]);

  for (const document of [...allDocs].sort()) {
    const sourceList = sourceByDoc.get(document) ?? [];
    const targetList = targetByDoc.get(document) ?? [];

    if (sourceList.length > 1) {
      items.push({
        document,
        status: 'DUPLICATE_SOURCE',
        sourceFiles: sourceList,
        targetFiles: targetList,
        reasons: [`source_count=${sourceList.length}`],
      });
      continue;
    }
    if (targetList.length > 1) {
      items.push({
        document,
        status: 'DUPLICATE_TARGET',
        sourceFiles: sourceList,
        targetFiles: targetList,
        reasons: [`target_count=${targetList.length}`],
      });
      continue;
    }

    if (sourceList.length === 1 && targetList.length === 0) {
      items.push({
        document,
        status: 'ONLY_SOURCE',
        sourceFiles: sourceList,
        targetFiles: [],
        reasons: ['missing_in_target'],
      });
      continue;
    }
    if (sourceList.length === 0 && targetList.length === 1) {
      items.push({
        document,
        status: 'ONLY_TARGET',
        sourceFiles: [],
        targetFiles: targetList,
        reasons: ['missing_in_source'],
      });
      continue;
    }

    const s = sourceList[0];
    const t = targetList[0];

    if (s.driveFileId === t.driveFileId) {
      items.push({
        document,
        status: 'SAME_FILE_ID',
        sourceFiles: [s],
        targetFiles: [t],
        reasons: ['identical_drive_file_id'],
      });
      continue;
    }

    if (sameMd5(s, t)) {
      items.push({
        document,
        status: 'SAME_CONTENT_DIFFERENT_ID',
        sourceFiles: [s],
        targetFiles: [t],
        reasons: ['md5_match'],
      });
      continue;
    }

    // Sin md5 en ambos: si tamaño coincide lo tratamos como mismo contenido probable.
    if (sameSize(s, t) && !s.md5Checksum && !t.md5Checksum) {
      items.push({
        document,
        status: 'SAME_CONTENT_DIFFERENT_ID',
        sourceFiles: [s],
        targetFiles: [t],
        reasons: ['size_match_no_md5'],
      });
      continue;
    }

    items.push({
      document,
      status: 'DIFFERENT_CONTENT',
      sourceFiles: [s],
      targetFiles: [t],
      reasons: ['file_id_and_checksum_differ'],
    });
  }

  return items;
}

function countByStatus(items: CompareItem[]): Record<CompareStatus, number> {
  const statuses: CompareStatus[] = [
    'SAME_FILE_ID',
    'SAME_CONTENT_DIFFERENT_ID',
    'DIFFERENT_CONTENT',
    'ONLY_SOURCE',
    'ONLY_TARGET',
    'DUPLICATE_SOURCE',
    'DUPLICATE_TARGET',
    'INVALID_SOURCE',
    'INVALID_TARGET',
  ];
  const out = Object.fromEntries(statuses.map((s) => [s, 0])) as Record<
    CompareStatus,
    number
  >;
  for (const item of items) out[item.status] += 1;
  return out;
}

async function main(): Promise<void> {
  const args = parseDriveCvCliArgs(process.argv.slice(2));
  const sourceFolderId = args.sourceFolderId?.trim();
  const targetFolderId = args.targetFolderId?.trim();

  if (!sourceFolderId || !targetFolderId) {
    console.error(
      `${TAG} Uso: npm run diag:drive-cv-compare -- --sourceFolderId=<id> --targetFolderId=<id>`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`${TAG} Source: ${sourceFolderId}`);
  console.log(`${TAG} Target: ${targetFolderId}`);
  console.log(`${TAG} Inventariando source (recursivo)...`);
  const sourceInv = await inventoryCvPdfFiles(sourceFolderId);
  console.log(
    `${TAG} Source OK: name=${sourceInv.rootFolderName} pdfs=${sourceInv.pdfCount} folders=${sourceInv.foldersVisited}`,
  );

  console.log(`${TAG} Inventariando target (recursivo)...`);
  const targetInv = await inventoryCvPdfFiles(targetFolderId);
  console.log(
    `${TAG} Target OK: name=${targetInv.rootFolderName} pdfs=${targetInv.pdfCount} folders=${targetInv.foldersVisited}`,
  );

  const items = compareDriveCvInventories(sourceInv.files, targetInv.files);
  const counts = countByStatus(items);

  console.log('');
  console.log(`${TAG} ----- Comparación por documento -----`);
  for (const [status, n] of Object.entries(counts)) {
    console.log(`${TAG}   ${status}: ${n}`);
  }

  const sample = (status: CompareStatus) =>
    items.filter((i) => i.status === status).slice(0, 15);

  console.log('');
  console.log(`${TAG} Muestra ONLY_SOURCE:`);
  for (const i of sample('ONLY_SOURCE')) {
    console.log(
      `${TAG}   - ${i.document} path=${i.sourceFiles[0]?.relativePath}`,
    );
  }

  console.log('');
  console.log(`${TAG} Muestra ONLY_TARGET:`);
  for (const i of sample('ONLY_TARGET')) {
    console.log(
      `${TAG}   - ${i.document} path=${i.targetFiles[0]?.relativePath}`,
    );
  }

  console.log('');
  console.log(`${TAG} Muestra SAME_FILE_ID:`);
  for (const i of sample('SAME_FILE_ID')) {
    console.log(
      `${TAG}   - ${i.document} ${i.sourceFiles[0]?.relativePath} → ${i.targetFiles[0]?.relativePath}`,
    );
  }

  console.log('');
  console.log(`${TAG} Muestra SAME_CONTENT_DIFFERENT_ID:`);
  for (const i of sample('SAME_CONTENT_DIFFERENT_ID')) {
    console.log(
      `${TAG}   - ${i.document} src=${i.sourceFiles[0]?.driveFileId} tgt=${i.targetFiles[0]?.driveFileId}`,
    );
  }

  console.log('');
  console.log(`${TAG} Muestra DIFFERENT_CONTENT:`);
  for (const i of sample('DIFFERENT_CONTENT')) {
    console.log(
      `${TAG}   - ${i.document} srcSize=${i.sourceFiles[0]?.fileSize} tgtSize=${i.targetFiles[0]?.fileSize}`,
    );
  }

  console.log('');
  console.log(`${TAG} Comparación finalizada (solo lectura).`);
}

const isCliEntrypoint =
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  require.main === module;

if (isCliEntrypoint) {
  main().catch((err: unknown) => {
    console.error(
      `${TAG} ERROR: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  });
}
