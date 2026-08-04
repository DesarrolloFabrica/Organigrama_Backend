/**
 * Script: npm run diag:drive-video
 *
 * Inventario diagnóstico recursivo de videos en Google Drive.
 * SOLO LECTURA: no PostgreSQL, no TypeORM, no escritura en Drive,
 * no descarga de binarios.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseDiagDriveVideoArgs,
  printDiagDriveVideoHelp,
} from './utils/drive-video-cli-args';
import {
  getDriveVideoFolderIdFromEnv,
  inventoryDriveVideos,
} from './utils/drive-video-inventory';

const TAG = '[DriveVideo]';
const OUT_DIR = resolve(process.cwd(), 'tmp/person-video-drive-inventory');

async function main(): Promise<void> {
  const args = parseDiagDriveVideoArgs(process.argv.slice(2));
  if (args.mode === 'help') {
    printDiagDriveVideoHelp();
    return;
  }

  const folderId = (args.folderId ?? getDriveVideoFolderIdFromEnv()).trim();

  console.log(`${TAG} Inventario diagnóstico (solo lectura, BFS recursivo)`);
  console.log(`${TAG} folderId=${folderId}`);
  console.log(
    `${TAG} Auth: mismo OAuth readonly que CV (GOOGLE_DRIVE_CV_TOKEN_PATH)`,
  );
  if (args.maxItems != null) {
    console.log(`${TAG} max-items=${args.maxItems}`);
  }

  const report = await inventoryDriveVideos({
    rootFolderId: folderId,
    maxItems: args.maxItems ?? undefined,
  });

  mkdirSync(OUT_DIR, { recursive: true });

  const summaryPath = resolve(OUT_DIR, 'summary.json');
  const privatePath = resolve(OUT_DIR, 'inventory.private.json');

  writeFileSync(summaryPath, `${JSON.stringify(report.summary, null, 2)}\n`, 'utf8');
  writeFileSync(
    privatePath,
    `${JSON.stringify(
      {
        summary: report.summary,
        duplicateDocuments: report.duplicateDocuments,
        invalidNames: report.invalidNames,
        items: report.items,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const s = report.summary;
  console.log('');
  console.log(`${TAG} Raíz: ${s.rootFolderName ?? '(sin nombre)'} / ${s.rootFolderId}`);
  console.log(`${TAG} Carpetas visitadas: ${s.foldersVisited}`);
  console.log(`${TAG} Archivos (no carpeta): ${s.totalFiles}`);
  console.log(`${TAG} Videos (todas clases video): ${s.totalVideos}`);
  console.log(`${TAG} Formatos:`);
  console.log(`${TAG}   SUPPORTED_MVP (mp4):     ${s.byFormatClass.SUPPORTED_MVP}`);
  console.log(`${TAG}   INVENTORY_ONLY (webm):   ${s.byFormatClass.INVENTORY_ONLY}`);
  console.log(`${TAG}   INCOMPATIBLE_MVP:        ${s.byFormatClass.INCOMPATIBLE_MVP}`);
  console.log(`${TAG}   NON_VIDEO:               ${s.byFormatClass.NON_VIDEO}`);
  console.log(`${TAG} Nombres válidos (videos):  ${s.validNameCount}`);
  console.log(`${TAG} Nombres inválidos (videos): ${s.invalidNameCount}`);
  console.log(`${TAG} Documentos únicos:         ${s.uniqueDocuments}`);
  console.log(`${TAG} Grupos duplicados:         ${s.duplicateGroups}`);
  console.log(`${TAG} Docs en grupos dup:        ${s.duplicateDocumentCount}`);
  console.log(`${TAG} MIME/ext inconsistentes:   ${s.mimeExtensionInconsistentCount}`);
  if (s.truncated) {
    console.log(`${TAG} AVISO: inventario truncado por --max-items`);
  }
  console.log('');
  console.log(`${TAG} Reporte: ${summaryPath}`);
  console.log(`${TAG} Privado: ${privatePath} (gitignored vía tmp/)`);

  if (args.showDuplicates && report.duplicateDocuments.length > 0) {
    console.log('');
    console.log(`${TAG} Duplicados por documento:`);
    for (const g of report.duplicateDocuments) {
      console.log(
        `${TAG}   doc=${g.document} count=${g.count} files=${g.names.join(' | ')}`,
      );
    }
  }

  if (args.showInvalid && report.invalidNames.length > 0) {
    console.log('');
    console.log(`${TAG} Nombres inválidos (videos):`);
    for (const inv of report.invalidNames.slice(0, 100)) {
      console.log(
        `${TAG}   ${inv.relativePath} (${inv.reason ?? 'INVALID'}) [${inv.formatClass}]`,
      );
    }
    if (report.invalidNames.length > 100) {
      console.log(
        `${TAG}   … +${report.invalidNames.length - 100} más (ver inventory.private.json)`,
      );
    }
  }

  if (args.json) {
    console.log('');
    console.log(JSON.stringify(report.summary, null, 2));
  }

  console.log('');
  console.log(
    `${TAG} Diagnóstico finalizado. No se consultó PostgreSQL ni se escribió en Drive.`,
  );
}

main().catch((err: unknown) => {
  const status =
    (err as { code?: number; response?: { status?: number } })?.code ??
    (err as { response?: { status?: number } })?.response?.status;

  console.error('');
  if (status === 403) {
    console.error(
      `${TAG} ERROR 403: Acceso denegado a la carpeta de videos. ` +
        'La cuenta OAuth readonly de CV no tiene permiso sobre GOOGLE_DRIVE_VIDEO_FOLDER_ID. ' +
        'No se intentaron otras credenciales.',
    );
  } else if (status === 404) {
    console.error(
      `${TAG} ERROR 404: Carpeta de videos no encontrada. Verifique --folderId / GOOGLE_DRIVE_VIDEO_FOLDER_ID.`,
    );
  } else {
    console.error(`${TAG} ERROR:`, err instanceof Error ? err.message : err);
  }
  process.exitCode = 1;
});
