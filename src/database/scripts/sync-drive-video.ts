/**
 * Script: npm run sync:drive-video
 *
 * Aplica plan congelado → organigrama.person_video.
 * Default / sin ambos flags: solo validación + precheck SELECT.
 * Escritura: --execute --confirm-cloud-video-sync
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import type {
  DriveVideoApplyPlanFile,
  DriveVideoApplyPrecheckSummary,
} from './utils/drive-video-apply-types';
import { validateApprovedDriveVideoPlan } from './utils/drive-video-apply-validator';
import {
  parseSyncDriveVideoArgs,
  printSyncDriveVideoHelp,
} from './utils/drive-video-sync-cli-args';
import {
  applyNewPersonVideosInTransaction,
  type InventoryParentLookup,
} from './utils/drive-video-sync-writer';
import { isVacancyPerson } from '../../org-chart/org-chart-vacancy';

const TAG = '[DriveVideoSync]';
const DEFAULT_PLAN = resolve(
  process.cwd(),
  'tmp/person-video-drive-plan/plan.private.json',
);
const OUT_DIR = resolve(process.cwd(), 'tmp/person-video-drive-apply');

function maskIp(host: string | null): string | null {
  if (!host) return null;
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) return `${m[1]}.${m[2]}.***.${m[4]}`;
  return `${host.slice(0, 6)}…`;
}

function createClient(): Client {
  const host = process.env.DB_HOST || '';
  if (/^(localhost|127\.0\.0\.1)$/i.test(host)) {
    throw new Error('Destino local no permitido');
  }
  if ((process.env.DB_NAME || '').toLowerCase() === 'mc1_local') {
    throw new Error('mc1_local no permitido');
  }
  return new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: (process.env.DB_PASSWORD || '').replace(/^'|'$/g, ''),
    ssl:
      String(process.env.DB_SSL).toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
    connectionTimeoutMillis: 20000,
  });
}

function loadPlan(path: string): {
  plan: DriveVideoApplyPlanFile;
  raw: string;
} {
  const raw = readFileSync(path, 'utf8');
  const plan = JSON.parse(raw) as DriveVideoApplyPlanFile;
  return { plan, raw };
}

function loadParentLookup(inventorySource: string): InventoryParentLookup {
  const map: InventoryParentLookup = new Map();
  if (!inventorySource || !existsSync(inventorySource)) {
    return map;
  }
  const inv = JSON.parse(readFileSync(inventorySource, 'utf8')) as {
    items?: Array<{ driveFileId: string; parentFolderId?: string }>;
  };
  for (const it of inv.items ?? []) {
    map.set(it.driveFileId, {
      parentFolderId: it.parentFolderId ?? null,
    });
  }
  return map;
}

async function runCloudPrecheck(
  client: Client,
  planPath: string,
  plan: DriveVideoApplyPlanFile,
  raw: string,
): Promise<DriveVideoApplyPrecheckSummary> {
  const validation = validateApprovedDriveVideoPlan(plan, raw);
  const session = (
    await client.query(`
    SELECT current_database() AS db,
           current_user AS usr,
           inet_server_addr()::text AS addr,
           inet_server_port() AS port
  `)
  ).rows[0];

  if (session.db !== 'core') {
    validation.issues.push({
      code: 'DB_NOT_CORE',
      message: `current_database=${session.db}`,
    });
  }
  if (session.usr !== 'user-core') {
    validation.issues.push({
      code: 'USER_UNEXPECTED',
      message: `current_user=${session.usr}`,
    });
  }

  const schemas = (
    await client.query(`
    SELECT nspname FROM pg_namespace
     WHERE nspname IN ('core','organigrama') ORDER BY 1
  `)
  ).rows.map((r: { nspname: string }) => r.nspname);

  const tableExists = (
    await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema='organigrama' AND table_name='person_video'
    ) AS e
  `)
  ).rows[0].e;
  if (!tableExists) {
    throw new Error('organigrama.person_video ausente');
  }

  const rowCount = Number(
    (await client.query(`SELECT count(*)::bigint AS c FROM organigrama.person_video`))
      .rows[0].c,
  );
  if (rowCount !== 0) {
    validation.issues.push({
      code: 'TABLE_NOT_EMPTY',
      message: `person_video rows=${rowCount} esperado=0`,
    });
  }

  const constraints = (
    await client.query(`
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'organigrama.person_video'::regclass
  `)
  ).rows.map((r: { conname: string }) => r.conname);
  const indexes = (
    await client.query(`
    SELECT indexname FROM pg_indexes
     WHERE schemaname='organigrama' AND tablename='person_video'
  `)
  ).rows.map((r: { indexname: string }) => r.indexname);

  const constraintsOk = [
    'fk_person_video_person',
    'uq_person_video_drive_file_id',
  ].every((n) => constraints.includes(n));
  const indexesOk = [
    'uq_person_video_active_person',
    'ix_person_video_document',
    'ix_person_video_person_active',
  ].every((n) => indexes.includes(n));

  if (!constraintsOk) {
    validation.issues.push({
      code: 'CONSTRAINTS_MISSING',
      message: 'Faltan constraints esperados',
    });
  }
  if (!indexesOk) {
    validation.issues.push({
      code: 'INDEXES_MISSING',
      message: 'Faltan índices esperados',
    });
  }

  let personsStillActiveEligible = 0;
  let personsWithoutActiveVideo = 0;
  let driveFileIdsAbsent = 0;

  for (const it of validation.newItems) {
    const personId = it.personId!;
    const document = it.document!;
    const p = (
      await client.query(
        `
        SELECT p.id::text, p.document, COALESCE(p.is_active,false) AS is_active,
               ro.name AS role_name, p.full_name
          FROM core.person p
          LEFT JOIN core.role ro ON ro.id = p.role_id
         WHERE p.id = $1
      `,
        [personId],
      )
    ).rows[0] as
      | {
          id: string;
          document: string;
          is_active: boolean;
          role_name: string | null;
          full_name: string | null;
        }
      | undefined;

    if (!p || p.document !== document || !p.is_active) {
      validation.issues.push({
        code: 'PERSON_STATE',
        message: `Persona no elegible id=${personId}`,
      });
      continue;
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
      validation.issues.push({
        code: 'PERSON_VACANCY',
        message: `Vacante id=${personId}`,
      });
      continue;
    }
    personsStillActiveEligible += 1;

    const active = await client.query(
      `SELECT 1 FROM organigrama.person_video WHERE person_id=$1 AND is_active=TRUE LIMIT 1`,
      [personId],
    );
    if (active.rows.length === 0) personsWithoutActiveVideo += 1;
    else {
      validation.issues.push({
        code: 'HAS_ACTIVE_VIDEO',
        message: `Ya hay activo personId=${personId}`,
      });
    }

    const linked = await client.query(
      `SELECT 1 FROM organigrama.person_video WHERE drive_file_id=$1 LIMIT 1`,
      [it.driveFileId],
    );
    if (linked.rows.length === 0) driveFileIdsAbsent += 1;
    else {
      validation.issues.push({
        code: 'FILE_ALREADY_LINKED',
        message: `drive_file_id ya existe`,
      });
    }
  }

  if (personsStillActiveEligible !== validation.newItems.length) {
    validation.issues.push({
      code: 'ELIGIBLE_COUNT',
      message: `elegibles=${personsStillActiveEligible} new=${validation.newItems.length}`,
    });
  }

  const allOk = validation.issues.length === 0;

  return {
    generatedAt: new Date().toISOString(),
    planPath,
    planHash: validation.planHash,
    inventorySource: plan.summary.inventorySource,
    database: session.db,
    user: session.usr,
    serverAddrMasked: maskIp(session.addr),
    serverPort: session.port,
    schemas,
    personVideoExists: true,
    personVideoRowCount: rowCount,
    constraintsOk,
    indexesOk,
    newCandidates: validation.newItems.length,
    personsStillActiveEligible,
    personsWithoutActiveVideo,
    driveFileIdsAbsent,
    validationOk: allOk,
    issues: validation.issues,
    status: allOk ? 'READY_FOR_AUTHORIZATION' : 'BLOCKED',
    writeExecuted: false,
  };
}

async function main(): Promise<void> {
  const args = parseSyncDriveVideoArgs(process.argv.slice(2));
  if (args.mode === 'help') {
    printSyncDriveVideoHelp();
    return;
  }

  const planPath = resolve(args.planPath ?? DEFAULT_PLAN);
  console.log(`${TAG} plan=${planPath}`);
  console.log(
    `${TAG} mode=${args.dryRun ? 'precheck/dry-run (no write)' : 'EXECUTE WRITE'}`,
  );

  const { plan, raw } = loadPlan(planPath);
  const validation = validateApprovedDriveVideoPlan(plan, raw);
  if (!validation.ok) {
    console.error(`${TAG} Plan rechazado:`);
    for (const i of validation.issues) {
      console.error(`${TAG}  - ${i.code}: ${i.message}`);
    }
    process.exitCode = 2;
    return;
  }

  console.log(`${TAG} planHash=${validation.planHash}`);
  console.log(
    `${TAG} NEW=${validation.newItems.length} INVALID_NAME omitidos=${validation.omittedInvalidName.length}`,
  );

  const client = createClient();
  await client.connect();
  try {
    const precheck = await runCloudPrecheck(client, planPath, plan, raw);
    mkdirSync(OUT_DIR, { recursive: true });
    const precheckPath = resolve(OUT_DIR, 'precheck-summary.json');
    writeFileSync(precheckPath, `${JSON.stringify(precheck, null, 2)}\n`, 'utf8');
    console.log(`${TAG} precheck: ${precheckPath}`);
    console.log(`${TAG} status=${precheck.status}`);
    console.log(
      `${TAG} person_video rows=${precheck.personVideoRowCount} newCandidates=${precheck.newCandidates}`,
    );
    console.log(
      `${TAG} eligible=${precheck.personsStillActiveEligible} withoutActive=${precheck.personsWithoutActiveVideo} fileIdsAbsent=${precheck.driveFileIdsAbsent}`,
    );

    if (args.json) {
      console.log(JSON.stringify(precheck, null, 2));
    }

    if (!precheck.validationOk) {
      console.error(`${TAG} PRECHECK BLOQUEADO — no se escribe`);
      for (const i of precheck.issues) {
        console.error(`${TAG}  - ${i.code}: ${i.message}`);
      }
      process.exitCode = 3;
      return;
    }

    if (args.dryRun) {
      console.log('');
      console.log(
        `${TAG} Listo para autorización. No se ejecutó escritura.`,
      );
      console.log(
        `${TAG} Para aplicar: npm run sync:drive-video -- --execute --confirm-cloud-video-sync`,
      );
      return;
    }

    // WRITE PATH
    const parents = loadParentLookup(plan.summary.inventorySource);
    const applyResult = await applyNewPersonVideosInTransaction(
      client,
      validation.newItems,
      parents,
    );

    const applySummary = {
      generatedAt: new Date().toISOString(),
      planHash: validation.planHash,
      inventoryHash: existsSync(plan.summary.inventorySource)
        ? createHash('sha256')
            .update(readFileSync(plan.summary.inventorySource))
            .digest('hex')
        : null,
      database: precheck.database,
      expectedNew: validation.newItems.length,
      inserted: applyResult.inserted,
      omittedInvalidName: validation.omittedInvalidName.length,
      errors: [] as string[],
      rowsBefore: applyResult.rowsBefore,
      rowsAfter: applyResult.rowsAfter,
      status: 'APPLIED' as const,
    };

    writeFileSync(
      resolve(OUT_DIR, 'apply-summary.json'),
      `${JSON.stringify(applySummary, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      resolve(OUT_DIR, 'apply.private.json'),
      `${JSON.stringify(
        {
          ...applySummary,
          insertedPersonIds: applyResult.insertedPersonIds,
          newItems: validation.newItems.map((i) => ({
            personId: i.personId,
            document: i.document,
            driveFileId: i.driveFileId,
            driveFileName: i.driveFileName,
            relativePath: i.relativePath,
          })),
          omittedInvalidName: validation.omittedInvalidName.map((i) => ({
            driveFileId: i.driveFileId,
            driveFileName: i.driveFileName,
            renameHint: i.renameHint ?? null,
          })),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    console.log(
      `${TAG} APPLIED inserted=${applyResult.inserted} rows ${applyResult.rowsBefore}→${applyResult.rowsAfter}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(`${TAG} ERROR:`, err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
