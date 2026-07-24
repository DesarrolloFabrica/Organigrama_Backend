/**
 * Impresión compartida de inventario + plan Drive CV (diag y dry-run).
 */
import type { DriveCvInventoryStats } from './drive-cv-types';
import type {
  SyncPlanItem,
  SyncPlanResult,
  SyncPlanStatus,
} from './drive-cv-sync-planner';
import { summarizeByArea, summarizeBySubarea } from './drive-cv-sync-planner';

const SAMPLE_LIMIT = 20;

function printSample(tag: string, label: string, lines: string[]): void {
  console.log('');
  console.log(`${tag} ${label} (mostrando hasta ${SAMPLE_LIMIT}):`);
  if (lines.length === 0) {
    console.log(`${tag}   (ninguno)`);
    return;
  }
  for (const line of lines.slice(0, SAMPLE_LIMIT)) {
    console.log(`${tag}   - ${line}`);
  }
}

export function printInventoryAndPlanReport(params: {
  tag: string;
  inventory: DriveCvInventoryStats;
  plan: SyncPlanResult;
  scopedFilesCount: number;
  /** Si true, el apply ejecutaría DEACTIVATE_*. */
  deactivateMissingEnabled?: boolean;
}): void {
  const { tag, inventory, plan } = params;
  const validNames = inventory.files.filter((f) => f.document).length;
  const scopedDupDocs = plan.summary.byStatus.DUPLICATE_DOCUMENT;

  const docsFromPlan = new Set(
    plan.items
      .filter((i) => i.document && i.status !== 'MISSING_FROM_DRIVE')
      .map((i) => i.document as string),
  );

  console.log('');
  console.log(`${tag} ----- Inventario Drive -----`);
  console.log(`${tag} Carpeta raíz ID: ${inventory.rootFolderId}`);
  console.log(
    `${tag} Carpeta raíz nombre: ${inventory.rootFolderName ?? '(no disponible)'}`,
  );
  console.log(`${tag} Carpetas recorridas: ${inventory.foldersVisited}`);
  console.log(`${tag} Total PDFs: ${inventory.pdfCount}`);
  console.log(
    `${tag} Archivos no PDF ignorados: ${inventory.nonPdfFileCount}`,
  );
  console.log(`${tag} Nombres válidos (inventario completo): ${validNames}`);
  console.log(
    `${tag} Nombres inválidos (inventario completo): ${inventory.pdfCount - validNames}`,
  );

  if (plan.filtered) {
    console.log('');
    console.log(
      `${tag} Filtro activo: area=${plan.filter.area ?? '-'} school/subarea=${plan.filter.school ?? plan.filter.subarea ?? '-'}`,
    );
    console.log(
      `${tag} PDFs en alcance del filtro: ${params.scopedFilesCount}`,
    );
    console.log(
      `${tag} (Desactivaciones globales OMITIDAS: inventario filtrado)`,
    );
  }

  console.log('');
  console.log(`${tag} ----- Plan / cruce BD -----`);
  console.log(`${tag} Documentos únicos en alcance: ${docsFromPlan.size}`);
  console.log(`${tag} Duplicados (documentos): ${scopedDupDocs}`);
  console.log(
    `${tag} person_cv activos actuales: ${plan.activePersonCvTotal}`,
  );
  console.log(
    `${tag} Columnas metadatos Drive (migración 012): ${
      plan.hasDriveMetaColumns ? 'sí' : 'NO (comparación parcial)'
    }`,
  );

  const statuses: SyncPlanStatus[] = [
    'NEW',
    'UNCHANGED',
    'MOVED',
    'UPDATED',
    'PERSON_NOT_FOUND',
    'CORE_DOCUMENT_DUPLICATED',
    'DB_INCONSISTENCY',
    'DUPLICATE_DOCUMENT',
    'INVALID_FILENAME',
    'MISSING_FROM_DRIVE',
  ];

  console.log('');
  console.log(`${tag} Conteo por estado:`);
  for (const status of statuses) {
    console.log(`${tag}   ${status}: ${plan.summary.byStatus[status]}`);
  }

  console.log('');
  console.log(`${tag} Acciones propuestas:`);
  console.log(`${tag}   INSERT_NEW: ${plan.summary.insertCount}`);
  console.log(`${tag}   UPDATE_UPDATED: ${plan.summary.updateUpdatedCount}`);
  console.log(`${tag}   UPDATE_MOVED: ${plan.summary.updateMovedCount}`);
  console.log(`${tag}   UNCHANGED: ${plan.summary.unchangedCount}`);
  console.log(
    `${tag}   DEACTIVATE_MISSING: ${plan.summary.deactivateMissingCount}`,
  );
  console.log(
    `${tag}     · absent: ${plan.summary.deactivateByReason.absent}`,
  );
  console.log(
    `${tag}     · invalid_filename: ${plan.summary.deactivateByReason.invalid_filename}`,
  );
  console.log(
    `${tag}   DEACTIVATE_DUPLICATE: ${plan.summary.deactivateDuplicateCount}`,
  );
  console.log(
    `${tag}   OMIT_INVALID: ${plan.summary.byStatus.INVALID_FILENAME}`,
  );
  console.log(
    `${tag}   OMIT_PERSON_NOT_FOUND: ${plan.summary.byStatus.PERSON_NOT_FOUND}`,
  );
  console.log(
    `${tag}   OMIT_CORE_DUPLICATED: ${plan.summary.byStatus.CORE_DOCUMENT_DUPLICATED}`,
  );
  console.log(
    `${tag}   OMIT_DB_INCONSISTENCY: ${plan.summary.byStatus.DB_INCONSISTENCY}`,
  );
  console.log(`${tag}   Omitidos (otros REPORT_ONLY): ${plan.summary.omittedCount}`);

  const deactivateTotal =
    plan.summary.deactivateMissingCount +
    plan.summary.deactivateDuplicateCount;
  if (deactivateTotal > 0) {
    console.log('');
    console.log(
      `${tag} *** ADVERTENCIA: ${deactivateTotal} personas aparecerán como SIN HOJA DE VIDA después de aplicar la desactivación. ***`,
    );
    if (params.deactivateMissingEnabled) {
      console.log(
        `${tag} Flag --deactivate-missing ACTIVO: el --apply ejecutaría estas desactivaciones.`,
      );
    } else {
      console.log(
        `${tag} Para aplicar desactivaciones se requiere: --apply --deactivate-missing (inventario raíz, sin filtros).`,
      );
    }
    if (plan.summary.projectedActiveAfterFullApply != null) {
      console.log(
        `${tag} Activos finales esperados (proyección): ${plan.summary.projectedActiveAfterFullApply}`,
      );
      console.log(
        `${tag}   = ${plan.activePersonCvTotal} actuales - ${deactivateTotal} desactivaciones + ${plan.summary.insertCount} inserts`,
      );
    }
  }

  const areaMap = summarizeByArea(inventory.files);
  console.log('');
  console.log(`${tag} Resumen por área (inventario completo):`);
  const areaEntries = [...areaMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], 'es'),
  );
  if (areaEntries.length === 0) {
    console.log(`${tag}   (ninguno)`);
  } else {
    for (const [area, count] of areaEntries) {
      console.log(`${tag}   - ${area}: ${count}`);
    }
  }

  const subMap = summarizeBySubarea(inventory.files);
  console.log('');
  console.log(`${tag} Resumen por subárea (inventario completo):`);
  const subEntries = [...subMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], 'es'),
  );
  if (subEntries.length === 0) {
    console.log(`${tag}   (ninguno)`);
  } else {
    for (const [key, count] of subEntries) {
      console.log(`${tag}   - ${key}: ${count}`);
    }
  }

  printAnomalies(tag, plan.items);
}

function formatDeactivateLine(i: SyncPlanItem): string {
  const paths = i.driveFiles.map((f) => f.relativePath).join(' | ');
  const invalid = (i.invalidCandidates ?? [])
    .map((f) => f.relativePath)
    .join(' | ');
  return (
    `person_id=${i.person?.id ?? i.personCv?.person_id ?? '?'} ` +
    `doc=${i.document ?? '?'} ` +
    `name="${i.person?.full_name ?? '?'}" ` +
    `email=${i.person?.edu_email ?? '?'} ` +
    `person_cv.id=${i.personCv?.id ?? '?'} ` +
    `file=${i.personCv?.drive_file_name ?? '?'} ` +
    `motivo=${i.deactivateReason ?? i.reasons.join(',')} ` +
    (paths ? `rutas=[${paths}] ` : '') +
    (invalid ? `invalid_candidates=[${invalid}]` : '')
  );
}

function printAnomalies(tag: string, items: SyncPlanItem[]): void {
  printSample(
    tag,
    'DEACTIVATE_MISSING',
    items
      .filter((i) => i.action === 'DEACTIVATE_MISSING')
      .map(formatDeactivateLine),
  );

  printSample(
    tag,
    'DEACTIVATE_DUPLICATE',
    items
      .filter((i) => i.action === 'DEACTIVATE_DUPLICATE')
      .map(formatDeactivateLine),
  );

  printSample(
    tag,
    'Duplicados (rutas completas)',
    items
      .filter((i) => i.status === 'DUPLICATE_DOCUMENT')
      .map((i) => {
        const paths = i.driveFiles.map((f) => f.relativePath).join(' | ');
        return `${i.document}: ${paths} action=${i.action}`;
      }),
  );

  printSample(
    tag,
    'INVALID_FILENAME',
    items
      .filter((i) => i.status === 'INVALID_FILENAME')
      .map((i) => i.driveFiles[0]?.relativePath ?? '(?)'),
  );

  printSample(
    tag,
    'PERSON_NOT_FOUND',
    items
      .filter((i) => i.status === 'PERSON_NOT_FOUND')
      .map((i) => `${i.document} → ${i.driveFiles[0]?.relativePath ?? ''}`),
  );

  printSample(
    tag,
    'CORE_DOCUMENT_DUPLICATED (sin desactivar)',
    items
      .filter((i) => i.status === 'CORE_DOCUMENT_DUPLICATED')
      .map((i) => i.document ?? ''),
  );

  printSample(
    tag,
    'DB_INCONSISTENCY (sin desactivar)',
    items
      .filter((i) => i.status === 'DB_INCONSISTENCY')
      .map(
        (i) =>
          `${i.document} person_id=${i.person?.id ?? '?'} (${i.reasons.join(',')})`,
      ),
  );

  printSample(
    tag,
    'NEW',
    items
      .filter((i) => i.status === 'NEW')
      .map(
        (i) =>
          `${i.document} → ${i.driveFiles[0]?.relativePath ?? ''} person=${i.person?.id} (${i.reasons.join(',')})`,
      ),
  );

  printSample(
    tag,
    'MOVED',
    items
      .filter((i) => i.status === 'MOVED')
      .map(
        (i) =>
          `${i.document}: ${i.personCv?.drive_relative_path ?? '(sin ruta)'} → ${i.driveFiles[0]?.relativePath} (${i.reasons.join(',')})`,
      ),
  );

  printSample(
    tag,
    'UPDATED',
    items
      .filter((i) => i.status === 'UPDATED')
      .map(
        (i) =>
          `${i.document}: ${i.reasons.join(',')} → ${i.driveFiles[0]?.relativePath}`,
      ),
  );
}
