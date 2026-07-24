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

  const inventory = await inventoryCvPdfFiles(folderId);
  const { files: scopedFiles } = filterInventoryByArea(
    inventory.files,
    args.filter,
  );

  console.log(`${TAG} Conectando a la base de datos (solo lectura)...`);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);
    const plan = await buildDriveCvSyncPlan({
      dataSource: ds,
      files: inventory.files,
      filter: args.filter,
    });

    printInventoryAndPlanReport({
      tag: TAG,
      inventory,
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
