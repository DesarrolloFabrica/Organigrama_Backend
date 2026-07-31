/**
 * Script: npm run diag:drive-cv
 *
 * Diagnóstico de SOLO LECTURA: inventario recursivo de Drive + plan de sync
 * (misma lógica que sync:drive-cv --dry-run).
 *
 * NO escribe en BD ni modifica Drive.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import {
  parseDriveCvCliArgs,
  printDiagDriveCvHelp,
} from './utils/drive-cv-cli-args';
import { filterInventoryByArea } from './utils/drive-cv-sync-planner';
import { buildDriveCvSyncPlan } from './utils/drive-cv-sync-planner';
import { printInventoryAndPlanReport } from './utils/drive-cv-report';
import { inventoryCvPdfFiles } from './utils/google-drive-cv-client';

const TAG = '[DriveCV]';

async function main(): Promise<void> {
  const args = parseDriveCvCliArgs(process.argv.slice(2));
  if (args.mode === 'help') {
    printDiagDriveCvHelp();
    return;
  }

  const folderId = args.folderId;
  console.log(`${TAG} Conectando a Google Drive (solo lectura, recursivo)...`);
  if (folderId) {
    console.log(`${TAG} Override --folderId=${folderId}`);
  }
  if (args.document) {
    console.log(`${TAG} --document=${args.document}`);
  }

  const inventory = await inventoryCvPdfFiles(folderId);
  const filesForPlan = args.document
    ? inventory.files.filter((f) => f.document === args.document)
    : inventory.files;
  const { files: scopedFiles } = filterInventoryByArea(
    filesForPlan,
    args.filter,
  );

  if (args.document) {
    console.log(
      `${TAG} PDFs con documento ${args.document}: ${filesForPlan.length}`,
    );
    for (const f of filesForPlan) {
      console.log(`${TAG}   - ${f.relativePath} (${f.driveFileId})`);
    }
    if (filesForPlan.length === 0) {
      console.error('');
      console.error(
        `${TAG} No se encontró ${args.document}.pdf bajo la carpeta raíz.`,
      );
      console.error(
        `${TAG} Raíz: ${inventory.rootFolderName ?? '(sin nombre)'} / ${inventory.rootFolderId}`,
      );
      console.error(`${TAG} PDFs totales en raíz: ${inventory.pdfCount}`);
      process.exitCode = 1;
      return;
    }
  }

  console.log(`${TAG} Conectando a la base de datos (solo lectura)...`);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);
    const plan = await buildDriveCvSyncPlan({
      dataSource: ds,
      files: filesForPlan,
      filter: args.filter,
      includeMissingFromDrive: args.document ? false : undefined,
    });

    printInventoryAndPlanReport({
      tag: TAG,
      inventory: args.document
        ? {
            ...inventory,
            pdfCount: filesForPlan.length,
            files: filesForPlan,
          }
        : inventory,
      plan,
      scopedFilesCount: scopedFiles.length,
      deactivateMissingEnabled: false,
    });

    console.log('');
    console.log(
      `${TAG} Diagnóstico finalizado (solo lectura: no se modificó la base de datos).`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  const status =
    (err as { code?: number; response?: { status?: number } })?.code ??
    (err as { response?: { status?: number } })?.response?.status;

  console.error('');
  if (status === 403) {
    console.error(
      `${TAG} ERROR 403: Acceso denegado. Verifica permisos de la carpeta y scope drive.readonly.`,
    );
  } else if (status === 404) {
    console.error(
      `${TAG} ERROR 404: Carpeta no encontrada. Verifica GOOGLE_DRIVE_CV_FOLDER_ID / --folderId.`,
    );
  } else {
    console.error(
      `${TAG} ERROR: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  process.exit(1);
});
