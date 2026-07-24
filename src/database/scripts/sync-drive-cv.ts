/**
 * Script: npm run sync:drive-cv -- --dry-run | --apply [--deactivate-missing]
 *
 * Sincroniza hojas de vida (inventario recursivo Drive → organigrama.person_cv).
 *
 * - Sin flags: ayuda + exit 1 (no escribe).
 * - --dry-run: plan; no escribe. Con --deactivate-missing muestra DEACTIVATE propuestas.
 * - --apply: INSERT NEW / UPDATE MOVED|UPDATED.
 * - --apply --deactivate-missing: además desactiva MISSING / DUPLICATE (inventario raíz).
 *
 * NO elimina filas ni extracciones. NO toca CORE_DOCUMENT_DUPLICATED / DB_INCONSISTENCY.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import {
  parseDriveCvCliArgs,
  printSyncDriveCvHelp,
} from './utils/drive-cv-cli-args';
import {
  buildDriveCvSyncPlan,
  filterInventoryByArea,
  type SyncPlanItem,
} from './utils/drive-cv-sync-planner';
import { printInventoryAndPlanReport } from './utils/drive-cv-report';
import { applyDriveCvPlan } from './utils/drive-cv-sync-writer';
import { inventoryCvPdfFiles } from './utils/google-drive-cv-client';
import type { DriveCvFile } from './utils/drive-cv-types';

const TAG = '[DriveCV:sync]';

function highlightConflicts(items: SyncPlanItem[]): void {
  const conflictStatuses = new Set([
    'DUPLICATE_DOCUMENT',
    'CORE_DOCUMENT_DUPLICATED',
    'DB_INCONSISTENCY',
  ]);
  const conflicts = items.filter((i) => conflictStatuses.has(i.status));
  if (conflicts.length === 0) return;

  console.log('');
  console.log(
    `${TAG} *** CONFLICTOS / OMISIONES RELEVANTES: ${conflicts.length} ***`,
  );
  for (const item of conflicts.slice(0, 30)) {
    const paths = item.driveFiles
      .map((f: DriveCvFile) => f.relativePath)
      .join(' | ');
    console.log(
      `${TAG}   [${item.status}] action=${item.action} ${item.document ?? '(sin doc)'} ${paths}`,
    );
  }
}

async function main(): Promise<void> {
  const args = parseDriveCvCliArgs(process.argv.slice(2));

  if (args.mode === 'help' || args.mode === 'diag') {
    printSyncDriveCvHelp();
    console.error('');
    console.error(
      `${TAG} Debes indicar --dry-run o --apply. Sin flags no se escribe nada.`,
    );
    process.exitCode = 1;
    return;
  }

  const folderId = args.folderId;
  console.log(`${TAG} Modo: ${args.mode}`);
  console.log(
    `${TAG} --deactivate-missing: ${args.deactivateMissing ? 'sí' : 'no'}`,
  );
  console.log(`${TAG} Conectando a Google Drive (recursivo)...`);
  if (folderId) {
    console.log(`${TAG} Override --folderId=${folderId}`);
  }

  const inventory = await inventoryCvPdfFiles(folderId);
  const { files: scopedFiles } = filterInventoryByArea(
    inventory.files,
    args.filter,
  );

  console.log(`${TAG} Conectando a la base de datos...`);
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
      deactivateMissingEnabled: args.deactivateMissing,
    });

    highlightConflicts(plan.items);

    if (args.mode === 'dry-run') {
      console.log('');
      console.log(
        `${TAG} DRY-RUN: no se abrió transacción; no se insertó ni actualizó ni desactivó nada.`,
      );
      if (plan.deactivationsProposed && !args.deactivateMissing) {
        console.log(
          `${TAG} Nota: hay desactivaciones propuestas; el apply requerirá --deactivate-missing.`,
        );
      }
      return;
    }

    // --apply
    const proposedDeact =
      plan.summary.deactivateMissingCount +
      plan.summary.deactivateDuplicateCount;

    console.log('');
    console.log(
      `${TAG} APPLY: inserts=${plan.summary.insertCount} moved=${plan.summary.updateMovedCount} updated=${plan.summary.updateUpdatedCount} unchanged=${plan.summary.unchangedCount} deactivate_proposed=${proposedDeact} omitidos=${plan.summary.omittedCount}`,
    );

    if (proposedDeact > 0 && !args.deactivateMissing) {
      console.log('');
      console.log(
        `${TAG} *** Desactivaciones OMITIDAS (${proposedDeact}): falta --deactivate-missing. ***`,
      );
      console.log(
        `${TAG} Se aplicarán solo INSERT/UPDATE. Las personas seguirán con CV activo hasta el apply con el flag.`,
      );
    }

    const result = await applyDriveCvPlan(ds, plan.items, {
      deactivateMissing: args.deactivateMissing,
    });

    console.log('');
    console.log(`${TAG} ----- Resultado APPLY -----`);
    console.log(`${TAG} Insertados (NEW): ${result.inserted}`);
    console.log(`${TAG} Actualizados (MOVED): ${result.moved}`);
    console.log(`${TAG} Actualizados (UPDATED): ${result.updated}`);
    console.log(`${TAG} Desactivados: ${result.deactivated}`);
    if (result.deactivationsSkipped > 0) {
      console.log(
        `${TAG} Desactivaciones omitidas (sin flag): ${result.deactivationsSkipped}`,
      );
    }
    console.log(`${TAG} Sincronización finalizada.`);
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
      `${TAG} ERROR 403: Acceso denegado a Drive. Verifica permisos y scope.`,
    );
  } else if (status === 404) {
    console.error(
      `${TAG} ERROR 404: Carpeta no encontrada. Verifica folder ID.`,
    );
  } else {
    console.error(
      `${TAG} ERROR: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  process.exit(1);
});
