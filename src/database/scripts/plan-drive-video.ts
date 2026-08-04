/**
 * Script: npm run plan:drive-video
 *
 * Dry-run: cruza inventory.private.json con core.person + organigrama.person_video.
 * Solo SELECT. No escribe BD ni Drive. Sin TypeORM AppModule.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import {
  maskDocument,
  parsePlanDriveVideoArgs,
  printPlanDriveVideoHelp,
} from './utils/drive-video-plan-cli-args';
import { loadDriveVideoInventoryFile } from './utils/drive-video-plan-load';
import { buildDriveVideoPlan, toPlanPersonRow } from './utils/drive-video-planner';
import type {
  DriveVideoPlanPersonRow,
  DriveVideoPlanVideoRow,
} from './utils/drive-video-plan-types';
import { VACANCY_ROLE_NAMES_NORMALIZED } from '../../org-chart/org-chart-vacancy';

const TAG = '[DriveVideoPlan]';
const DEFAULT_INVENTORY = resolve(
  process.cwd(),
  'tmp/person-video-drive-inventory/inventory.private.json',
);
const OUT_DIR = resolve(process.cwd(), 'tmp/person-video-drive-plan');

function loadEnv(): Record<string, string> {
  // dotenv already loaded process.env; mirror .env keys used
  return process.env as Record<string, string>;
}

function createClient(env: Record<string, string>): Client {
  const host = env.DB_HOST || '';
  if (/^(localhost|127\.0\.0\.1)$/i.test(host)) {
    throw new Error('Destino local no permitido para este plan (se espera Cloud SQL).');
  }
  if ((env.DB_NAME || '').toLowerCase() === 'mc1_local') {
    throw new Error('Destino mc1_local no permitido.');
  }
  return new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    database: env.DB_NAME,
    user: env.DB_USERNAME,
    password: (env.DB_PASSWORD || '').replace(/^'|'$/g, ''),
    ssl:
      String(env.DB_SSL).toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
    connectionTimeoutMillis: 20000,
  });
}

async function assertDestination(client: Client): Promise<{
  database: string;
  user: string;
}> {
  const s = (
    await client.query(`
    SELECT current_database() AS db, current_user AS usr
  `)
  ).rows[0];
  if (s.db !== 'core') {
    throw new Error(`Destino incorrecto: current_database=${s.db} (esperado core)`);
  }
  const tables = await client.query(`
    SELECT
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='core' AND table_name='person') AS person,
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='organigrama' AND table_name='person_video') AS person_video
  `);
  if (!tables.rows[0].person || !tables.rows[0].person_video) {
    throw new Error('Faltan core.person u organigrama.person_video');
  }
  return { database: s.db, user: s.usr };
}

async function loadPersonsByDocuments(
  client: Client,
  documents: string[],
): Promise<Map<string, DriveVideoPlanPersonRow[]>> {
  const map = new Map<string, DriveVideoPlanPersonRow[]>();
  if (documents.length === 0) return map;

  const rows = (
    await client.query(
      `
      SELECT p.id::text AS id,
             p.document AS document,
             COALESCE(p.is_active, false) AS is_active,
             ro.name AS role_name,
             p.full_name AS full_name
        FROM core.person p
        LEFT JOIN core.role ro ON ro.id = p.role_id
       WHERE p.document = ANY($1::text[])
    `,
      [documents],
    )
  ).rows as Array<{
    id: string;
    document: string;
    is_active: boolean;
    role_name: string | null;
    full_name: string | null;
  }>;

  // vacancy roles constant used to keep SQL aligned with app (also applied in toPlanPersonRow)
  void VACANCY_ROLE_NAMES_NORMALIZED;

  for (const r of rows) {
    const person = toPlanPersonRow({
      id: r.id,
      document: r.document,
      is_active: Boolean(r.is_active),
      roleName: r.role_name,
      fullName: r.full_name,
    });
    // Do not keep fullName in memory for reports — strip after vacancy check
    const sanitized: DriveVideoPlanPersonRow = {
      ...person,
      fullName: null,
    };
    const list = map.get(sanitized.document) ?? [];
    list.push(sanitized);
    map.set(sanitized.document, list);
  }
  return map;
}

async function loadPersonVideos(client: Client): Promise<{
  rows: DriveVideoPlanVideoRow[];
  count: number;
}> {
  const count = Number(
    (await client.query(`SELECT count(*)::bigint AS c FROM organigrama.person_video`))
      .rows[0].c,
  );
  const rows = (
    await client.query(`
    SELECT id::text AS id,
           person_id::text AS person_id,
           document,
           drive_file_id,
           drive_file_name,
           mime_type,
           drive_modified_time::text AS drive_modified_time,
           drive_md5_checksum,
           drive_file_size,
           drive_relative_path,
           is_active
      FROM organigrama.person_video
  `)
  ).rows as Array<{
    id: string;
    person_id: string;
    document: string;
    drive_file_id: string;
    drive_file_name: string;
    mime_type: string;
    drive_modified_time: string | null;
    drive_md5_checksum: string | null;
    drive_file_size: string | number | null;
    drive_relative_path: string | null;
    is_active: boolean;
  }>;

  return {
    count,
    rows: rows.map((r) => ({
      id: r.id,
      person_id: r.person_id,
      document: r.document,
      drive_file_id: r.drive_file_id,
      drive_file_name: r.drive_file_name,
      mime_type: r.mime_type,
      drive_modified_time: r.drive_modified_time,
      drive_md5_checksum: r.drive_md5_checksum,
      drive_file_size:
        r.drive_file_size == null ? null : Number(r.drive_file_size),
      drive_relative_path: r.drive_relative_path,
      is_active: Boolean(r.is_active),
    })),
  };
}

async function main(): Promise<void> {
  const args = parsePlanDriveVideoArgs(process.argv.slice(2));
  if (args.mode === 'help') {
    printPlanDriveVideoHelp();
    return;
  }

  const inventoryPath = resolve(args.inventory ?? DEFAULT_INVENTORY);
  console.log(`${TAG} Dry-run planner (solo SELECT)`);
  console.log(`${TAG} inventory=${inventoryPath}`);

  let loaded = loadDriveVideoInventoryFile(inventoryPath);
  let items = loaded.items;
  if (args.document != null) {
    items = items.filter((i) => i.document === args.document);
  }
  if (args.maxItems != null) {
    items = items.slice(0, args.maxItems);
  }

  const documents = [
    ...new Set(
      items
        .filter((i) => i.validName && i.document)
        .map((i) => i.document as string),
    ),
  ];

  const env = loadEnv();
  const client = createClient(env);
  await client.connect();

  let personVideoBefore = -1;
  let personVideoAfter = -1;

  try {
    const dest = await assertDestination(client);
    console.log(`${TAG} database=${dest.database} user=${dest.user}`);

    const personsByDocument = await loadPersonsByDocuments(client, documents);
    const { rows: videos, count } = await loadPersonVideos(client);
    personVideoBefore = count;

    const result = buildDriveVideoPlan({
      items,
      personsByDocument,
      videos,
      inventorySource: inventoryPath,
      database: dest.database,
      personVideoRowsBefore: count,
    });

    personVideoAfter = Number(
      (await client.query(`SELECT count(*)::bigint AS c FROM organigrama.person_video`))
        .rows[0].c,
    );
    result.summary.personVideoRowsAfter = personVideoAfter;

    if (personVideoAfter !== personVideoBefore) {
      throw new Error(
        `INCIDENTE: person_video cambió de ${personVideoBefore} a ${personVideoAfter} filas durante dry-run`,
      );
    }

    mkdirSync(OUT_DIR, { recursive: true });
    const summaryPath = resolve(OUT_DIR, 'summary.json');
    const privatePath = resolve(OUT_DIR, 'plan.private.json');

    writeFileSync(
      summaryPath,
      `${JSON.stringify(result.summary, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      privatePath,
      `${JSON.stringify(
        {
          summary: result.summary,
          items: result.items.map((it) => ({
            action: it.action,
            reasons: it.reasons,
            personMatch: it.personMatch,
            eligibility: it.eligibility,
            document: it.document,
            personId: it.personId,
            driveFileId: it.driveFileId,
            driveFileName: it.driveFileName,
            relativePath: it.relativePath,
            mimeType: it.mimeType,
            formatClass: it.formatClass,
            size: it.size,
            md5Checksum: it.md5Checksum,
            modifiedTime: it.modifiedTime,
            activeVideoId: it.activeVideoId,
            compared: it.compared,
            renameHint: it.renameHint,
          })),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const s = result.summary;
    console.log('');
    console.log(`${TAG} Inventario procesado: ${s.inventoryTotal}`);
    console.log(`${TAG} Válidos / inválidos: ${s.validNames} / ${s.invalidNames}`);
    console.log(`${TAG} Personas con personId en plan: ${s.personsFound}`);
    console.log(`${TAG} PERSON_NOT_FOUND: ${s.personsNotFound}`);
    console.log(`${TAG} PERSON_MATCH_MULTIPLE: ${s.personsAmbiguous}`);
    console.log(`${TAG} PERSON_INACTIVE: ${s.personsInactive}`);
    console.log(`${TAG} VACANCY_NOT_ELIGIBLE: ${s.vacanciesExcluded}`);
    console.log(`${TAG} NEW: ${s.byAction.NEW}`);
    console.log(`${TAG} NO_CHANGE: ${s.byAction.NO_CHANGE}`);
    console.log(`${TAG} REPLACE: ${s.byAction.REPLACE}`);
    console.log(`${TAG} METADATA_CHANGED: ${s.byAction.METADATA_CHANGED}`);
    console.log(`${TAG} INVALID_NAME: ${s.byAction.INVALID_NAME}`);
    console.log(`${TAG} Otros bloqueos (agg): ${s.blockedOrReportOnly}`);
    console.log(
      `${TAG} person_video filas antes/después: ${personVideoBefore}/${personVideoAfter}`,
    );
    console.log(`${TAG} summary: ${summaryPath}`);
    console.log(`${TAG} private: ${privatePath}`);

    if (args.showNew) {
      for (const it of result.items.filter((i) => i.action === 'NEW')) {
        console.log(
          `${TAG} NEW personId=${it.personId} doc=${maskDocument(it.document)}`,
        );
      }
    }
    if (args.showReplacements) {
      for (const it of result.items.filter((i) => i.action === 'REPLACE')) {
        console.log(
          `${TAG} REPLACE personId=${it.personId} doc=${maskDocument(it.document)}`,
        );
      }
    }
    if (args.showErrors) {
      const errActions = new Set([
        'PERSON_NOT_FOUND',
        'PERSON_MATCH_MULTIPLE',
        'PERSON_INACTIVE',
        'VACANCY_NOT_ELIGIBLE',
        'INVALID_NAME',
        'DUPLICATE_DOCUMENT',
        'DRIVE_FILE_ALREADY_LINKED',
        'UNSUPPORTED_FORMAT',
        'MIME_EXTENSION_MISMATCH',
        'REPORT_ONLY',
      ]);
      for (const it of result.items.filter((i) => errActions.has(i.action))) {
        console.log(
          `${TAG} ${it.action} doc=${maskDocument(it.document)} reason=${it.reasons[0] ?? ''}`,
        );
      }
    }

    if (args.json) {
      console.log(JSON.stringify(s, null, 2));
    }

    console.log('');
    console.log(
      `${TAG} Dry-run OK. Solo SELECT. Drive no modificado. person_video sin cambios.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(`${TAG} ERROR:`, err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
