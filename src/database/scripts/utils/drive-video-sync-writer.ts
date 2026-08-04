/**
 * Writer PostgreSQL para organigrama.person_video (Fase 2D).
 * Separado del pipeline CV. Usa `pg` Client explícito.
 */
import type { Client } from 'pg';
import { isVacancyPerson } from '../../../org-chart/org-chart-vacancy';
import type { DriveVideoApplyPlanItem } from './drive-video-apply-types';

export type InventoryParentLookup = Map<
  string,
  { parentFolderId: string | null }
>;

export type ApplyNewVideosResult = {
  inserted: number;
  rowsBefore: number;
  rowsAfter: number;
  insertedPersonIds: string[];
};

function parseModifiedTime(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Revalida en BD cada NEW (SELECT + locks) e inserta en una sola transacción.
 * Rollback total si falla cualquiera.
 */
export async function applyNewPersonVideosInTransaction(
  client: Client,
  newItems: DriveVideoApplyPlanItem[],
  parentByFileId: InventoryParentLookup,
): Promise<ApplyNewVideosResult> {
  if (newItems.length === 0) {
    throw new Error('No hay acciones NEW para aplicar');
  }

  const rowsBefore = Number(
    (await client.query(`SELECT count(*)::bigint AS c FROM organigrama.person_video`))
      .rows[0].c,
  );

  await client.query('BEGIN');
  try {
    // Lock order estable por personId
    const sorted = [...newItems].sort((a, b) =>
      String(a.personId).localeCompare(String(b.personId)),
    );

    for (const it of sorted) {
      const personId = it.personId!;
      const document = it.document!;

      const personRes = await client.query(
        `
        SELECT p.id::text AS id,
               p.document,
               COALESCE(p.is_active, false) AS is_active,
               ro.name AS role_name,
               p.full_name AS full_name
          FROM core.person p
          LEFT JOIN core.role ro ON ro.id = p.role_id
         WHERE p.id = $1
         FOR UPDATE OF p
      `,
        [personId],
      );
      if (personRes.rows.length !== 1) {
        throw new Error(`Persona ausente id=${personId}`);
      }
      const p = personRes.rows[0] as {
        id: string;
        document: string;
        is_active: boolean;
        role_name: string | null;
        full_name: string | null;
      };
      if (p.document !== document) {
        throw new Error(
          `Documento divergente personId=${personId} (plan vs core)`,
        );
      }
      if (!p.is_active) {
        throw new Error(`Persona inactiva personId=${personId}`);
      }
      const vacancy = isVacancyPerson(
        {
          document: p.document,
          full_name: p.full_name ?? '',
          role_id: null,
        },
        p.role_name ? { name: p.role_name } : null,
      );
      if (vacancy) {
        throw new Error(`Persona vacante personId=${personId}`);
      }

      const active = await client.query(
        `
        SELECT id::text
          FROM organigrama.person_video
         WHERE person_id = $1 AND is_active = TRUE
         FOR UPDATE
      `,
        [personId],
      );
      if (active.rows.length > 0) {
        throw new Error(`Ya existe video activo personId=${personId}`);
      }

      const linked = await client.query(
        `
        SELECT id::text, person_id::text
          FROM organigrama.person_video
         WHERE drive_file_id = $1
         FOR UPDATE
      `,
        [it.driveFileId],
      );
      if (linked.rows.length > 0) {
        throw new Error(`drive_file_id ya registrado file=${it.driveFileId}`);
      }

      const parent =
        parentByFileId.get(it.driveFileId)?.parentFolderId ?? null;

      await client.query(
        `
        INSERT INTO organigrama.person_video (
          person_id, document, drive_file_id, drive_file_name, mime_type,
          drive_modified_time, drive_md5_checksum, drive_file_size,
          drive_parent_folder_id, drive_relative_path,
          is_active, created_at, updated_at, synced_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6::timestamptz, $7, $8,
          $9, $10,
          TRUE, NOW(), NOW(), NOW()
        )
      `,
        [
          personId,
          document,
          it.driveFileId,
          it.driveFileName,
          it.mimeType,
          parseModifiedTime(it.modifiedTime),
          it.md5Checksum,
          it.size,
          parent,
          it.relativePath,
        ],
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  }

  const rowsAfter = Number(
    (await client.query(`SELECT count(*)::bigint AS c FROM organigrama.person_video`))
      .rows[0].c,
  );

  return {
    inserted: newItems.length,
    rowsBefore,
    rowsAfter,
    insertedPersonIds: newItems.map((i) => i.personId!),
  };
}

/**
 * REPLACE futuro (no usado en primera ejecución).
 * Desactiva activo + inserta nuevo en la misma transacción del caller.
 */
export async function replacePersonVideoInTransaction(
  client: Client,
  args: {
    personId: string;
    document: string;
    newItem: DriveVideoApplyPlanItem;
    parentFolderId: string | null;
  },
): Promise<void> {
  const locked = await client.query(
    `
    SELECT id::text
      FROM organigrama.person_video
     WHERE person_id = $1 AND is_active = TRUE
     FOR UPDATE
  `,
    [args.personId],
  );
  if (locked.rows.length !== 1) {
    throw new Error(`REPLACE requiere exactamente 1 activo personId=${args.personId}`);
  }
  await client.query(
    `
    UPDATE organigrama.person_video
       SET is_active = FALSE, updated_at = NOW()
     WHERE person_id = $1 AND is_active = TRUE
  `,
    [args.personId],
  );
  await client.query(
    `
    INSERT INTO organigrama.person_video (
      person_id, document, drive_file_id, drive_file_name, mime_type,
      drive_modified_time, drive_md5_checksum, drive_file_size,
      drive_parent_folder_id, drive_relative_path,
      is_active, created_at, updated_at, synced_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6::timestamptz, $7, $8,
      $9, $10,
      TRUE, NOW(), NOW(), NOW()
    )
  `,
    [
      args.personId,
      args.document,
      args.newItem.driveFileId,
      args.newItem.driveFileName,
      args.newItem.mimeType,
      parseModifiedTime(args.newItem.modifiedTime),
      args.newItem.md5Checksum,
      args.newItem.size,
      args.parentFolderId,
      args.newItem.relativePath,
    ],
  );
}

/**
 * METADATA_CHANGED futuro: UPDATE in-place del mismo drive_file_id.
 */
export async function updatePersonVideoMetadataInTransaction(
  client: Client,
  args: {
    personId: string;
    driveFileId: string;
    driveFileName: string;
    mimeType: string;
    modifiedTime: string | null;
    md5Checksum: string | null;
    size: number | null;
    parentFolderId: string | null;
    relativePath: string;
  },
): Promise<void> {
  const res = await client.query(
    `
    UPDATE organigrama.person_video
       SET drive_file_name = $3,
           mime_type = $4,
           drive_modified_time = $5::timestamptz,
           drive_md5_checksum = $6,
           drive_file_size = $7,
           drive_parent_folder_id = $8,
           drive_relative_path = $9,
           updated_at = NOW(),
           synced_at = NOW()
     WHERE person_id = $1
       AND is_active = TRUE
       AND drive_file_id = $2
     RETURNING id
  `,
    [
      args.personId,
      args.driveFileId,
      args.driveFileName,
      args.mimeType,
      parseModifiedTime(args.modifiedTime),
      args.md5Checksum,
      args.size,
      args.parentFolderId,
      args.relativePath,
    ],
  );
  if (res.rowCount !== 1) {
    throw new Error(
      `METADATA_CHANGED no actualizó 1 fila personId=${args.personId} file=${args.driveFileId}`,
    );
  }
}
