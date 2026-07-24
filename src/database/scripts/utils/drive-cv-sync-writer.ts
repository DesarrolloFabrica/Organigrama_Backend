/**
 * Escritura transaccional del plan Drive CV → organigrama.person_cv.
 * Separado del CLI para poder probarlo sin ejecutar main().
 */
import { DataSource, QueryRunner } from 'typeorm';
import type { SyncPlanItem } from './drive-cv-sync-planner';

async function assertDriveMetaColumns(ds: DataSource): Promise<void> {
  const rows = await ds.query<{ column_name: string }[]>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'organigrama'
        AND table_name = 'person_cv'
        AND column_name = 'drive_relative_path'`,
  );
  if (rows.length === 0) {
    throw new Error(
      'Faltan columnas de metadatos Drive en organigrama.person_cv. ' +
        'Aplica primero migrations/012_person_cv_drive_path_metadata.sql antes de --apply.',
    );
  }
}

function parseModifiedTime(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Cuenta filas afectadas vía RETURNING (array de rows) o rowCount crudo. */
export function extractReturningCount(result: unknown): number {
  if (result == null) return 0;
  if (typeof result === 'number') return result;
  if (Array.isArray(result)) {
    if (result.length === 2 && typeof result[1] === 'number') {
      return result[1];
    }
    return result.length;
  }
  if (typeof result === 'object' && 'rowCount' in result) {
    const rc = (result as { rowCount?: number }).rowCount;
    return typeof rc === 'number' ? rc : 0;
  }
  return 0;
}

function assertReturningCount(
  result: unknown,
  expected: number,
  context: string,
): void {
  const rowCount = extractReturningCount(result);
  if (rowCount !== expected) {
    throw new Error(
      `Inconsistencia al escribir (${context}): rowCount=${rowCount}, esperado=${expected}. Abortando transacción.`,
    );
  }
}

async function insertPersonCv(
  qr: QueryRunner,
  item: SyncPlanItem,
): Promise<void> {
  const person = item.person!;
  const file = item.driveFiles[0]!;
  await qr.query(
    `INSERT INTO organigrama.person_cv
        (person_id, document, drive_file_id, drive_file_name,
         drive_web_url, mime_type, is_active, synced_at,
         drive_parent_folder_id, drive_area_folder, drive_subarea_folder,
         drive_relative_path, drive_modified_time, drive_md5_checksum,
         drive_file_size)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(),
             $7, $8, $9, $10, $11, $12, $13)`,
    [
      person.id,
      item.document,
      file.driveFileId,
      file.driveFileName,
      file.driveWebUrl || '',
      file.mimeType,
      file.parentFolderId,
      file.areaFolder,
      file.subareaFolder,
      file.relativePath,
      parseModifiedTime(file.modifiedTime),
      file.md5Checksum,
      file.fileSize,
    ],
  );
}

async function updateMoved(
  qr: QueryRunner,
  item: SyncPlanItem,
): Promise<void> {
  const cv = item.personCv!;
  const file = item.driveFiles[0]!;
  const result = await qr.query(
    `UPDATE organigrama.person_cv
        SET drive_parent_folder_id = $2,
            drive_area_folder = $3,
            drive_subarea_folder = $4,
            drive_relative_path = $5,
            synced_at = NOW()
      WHERE id = $1 AND is_active = TRUE
      RETURNING id`,
    [
      cv.id,
      file.parentFolderId,
      file.areaFolder,
      file.subareaFolder,
      file.relativePath,
    ],
  );
  assertReturningCount(result, 1, `MOVED person_cv.id=${cv.id}`);
}

async function updateUpdated(
  qr: QueryRunner,
  item: SyncPlanItem,
): Promise<void> {
  const cv = item.personCv!;
  const file = item.driveFiles[0]!;
  const result = await qr.query(
    `UPDATE organigrama.person_cv
        SET document = $2,
            drive_file_id = $3,
            drive_file_name = $4,
            drive_web_url = $5,
            mime_type = $6,
            drive_parent_folder_id = $7,
            drive_area_folder = $8,
            drive_subarea_folder = $9,
            drive_relative_path = $10,
            drive_modified_time = $11,
            drive_md5_checksum = $12,
            drive_file_size = $13,
            synced_at = NOW()
      WHERE id = $1 AND is_active = TRUE
      RETURNING id`,
    [
      cv.id,
      item.document,
      file.driveFileId,
      file.driveFileName,
      file.driveWebUrl || '',
      file.mimeType,
      file.parentFolderId,
      file.areaFolder,
      file.subareaFolder,
      file.relativePath,
      parseModifiedTime(file.modifiedTime),
      file.md5Checksum,
      file.fileSize,
    ],
  );
  assertReturningCount(result, 1, `UPDATED person_cv.id=${cv.id}`);
}

/**
 * Desactiva person_cv activo sin tocar metadatos históricos ni eliminar filas.
 *
 * SQL:
 *   UPDATE organigrama.person_cv
 *   SET is_active = FALSE, synced_at = NOW()
 *   WHERE id = $1 AND is_active = TRUE
 *   RETURNING id;
 *
 * Espera exactamente 1 fila; si 0 → aborta la transacción.
 */
export async function deactivatePersonCv(
  qr: QueryRunner,
  item: SyncPlanItem,
): Promise<void> {
  const cv = item.personCv;
  if (!cv) {
    throw new Error(
      `DEACTIVATE inválido para document=${item.document}: falta person_cv.`,
    );
  }
  const result = await qr.query(
    `UPDATE organigrama.person_cv
        SET is_active = FALSE,
            synced_at = NOW()
      WHERE id = $1
        AND is_active = TRUE
      RETURNING id`,
    [cv.id],
  );
  assertReturningCount(result, 1, `DEACTIVATE person_cv.id=${cv.id}`);
}

export type ApplyPlanResult = {
  inserted: number;
  moved: number;
  updated: number;
  deactivated: number;
  deactivationsSkipped: number;
};

export async function applyDriveCvPlan(
  ds: DataSource,
  items: SyncPlanItem[],
  options: { deactivateMissing: boolean },
): Promise<ApplyPlanResult> {
  await assertDriveMetaColumns(ds);

  const writable = items.filter((i) => {
    if (
      i.action === 'INSERT' ||
      i.action === 'UPDATE_MOVED' ||
      i.action === 'UPDATE_UPDATED'
    ) {
      return true;
    }
    if (
      options.deactivateMissing &&
      (i.action === 'DEACTIVATE_MISSING' ||
        i.action === 'DEACTIVATE_DUPLICATE')
    ) {
      return true;
    }
    return false;
  });

  const proposedDeactivations = items.filter(
    (i) =>
      i.action === 'DEACTIVATE_MISSING' || i.action === 'DEACTIVATE_DUPLICATE',
  ).length;

  let inserted = 0;
  let moved = 0;
  let updated = 0;
  let deactivated = 0;

  const queryRunner = ds.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    for (const item of writable) {
      if (item.action === 'INSERT') {
        if (!item.person || !item.driveFiles[0]) {
          throw new Error(
            `NEW inválido para document=${item.document}: falta persona o archivo.`,
          );
        }
        await insertPersonCv(queryRunner, item);
        inserted += 1;
      } else if (item.action === 'UPDATE_MOVED') {
        if (!item.personCv || !item.driveFiles[0]) {
          throw new Error(
            `MOVED inválido para document=${item.document}: falta person_cv o archivo.`,
          );
        }
        await updateMoved(queryRunner, item);
        moved += 1;
      } else if (item.action === 'UPDATE_UPDATED') {
        if (!item.personCv || !item.driveFiles[0]) {
          throw new Error(
            `UPDATED inválido para document=${item.document}: falta person_cv o archivo.`,
          );
        }
        await updateUpdated(queryRunner, item);
        updated += 1;
      } else if (
        item.action === 'DEACTIVATE_MISSING' ||
        item.action === 'DEACTIVATE_DUPLICATE'
      ) {
        await deactivatePersonCv(queryRunner, item);
        deactivated += 1;
      }
    }
    await queryRunner.commitTransaction();
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }

  return {
    inserted,
    moved,
    updated,
    deactivated,
    deactivationsSkipped: options.deactivateMissing
      ? 0
      : proposedDeactivations,
  };
}
