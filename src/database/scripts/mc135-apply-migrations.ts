/**
 * MC1.3.5 — Aplica migraciones 018–020 completas (equivalente a psql -f).
 * No fragmenta SQL. Requiere --i-confirm-migrate.
 *
 * Uso:
 *   npx ts-node -r tsconfig-paths/register src/database/scripts/mc135-apply-migrations.ts --i-confirm-migrate
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

const TAG = '[MC1.3.5 Migrate]';
const FILES = [
  '018_mc_competency_catalog.sql',
  '019_mc_skill_specialty_mapping.sql',
  '020_mc_profile_evaluation.sql',
] as const;

function isLocalHost(host: string | undefined): boolean {
  if (!host) return true;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('::1')
  );
}

async function tableExists(
  client: Client,
  table: string,
): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'organigrama' AND table_name = $1 LIMIT 1`,
    [table],
  );
  return r.rowCount !== null && r.rowCount > 0;
}

async function validate018(client: Client): Promise<string[]> {
  const errors: string[] = [];
  for (const t of ['mc_catalog_version', 'mc_domain', 'mc_specialty']) {
    if (!(await tableExists(client, t))) errors.push(`missing ${t}`);
  }
  const cons = await client.query(
    `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'organigrama'
        AND t.relname = 'mc_specialty'
        AND c.conname = 'chk_mc_specialty_lifecycle_status'`,
  );
  const def = cons.rows[0]?.def ?? '';
  if (!def.includes('ACTIVE') || !def.includes('EXPERIMENTAL')) {
    errors.push('lifecycle constraint missing ACTIVE/EXPERIMENTAL');
  }
  if (def.includes('EMERGENT')) {
    errors.push('lifecycle constraint incorrectly allows EMERGENT');
  }
  return errors;
}

async function validate019(client: Client): Promise<string[]> {
  const errors: string[] = [];
  for (const t of [
    'mc_skill_domain_classification',
    'mc_skill_specialty_mapping',
  ]) {
    if (!(await tableExists(client, t))) errors.push(`missing ${t}`);
  }
  const weight = await client.query(
    `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'organigrama'
        AND t.relname = 'mc_skill_specialty_mapping'
        AND c.conname LIKE '%weight%'`,
  );
  if (!weight.rows.length) errors.push('weight constraint not found');
  return errors;
}

async function validate020(client: Client): Promise<string[]> {
  const errors: string[] = [];
  for (const t of [
    'mc_profile_evaluation',
    'mc_profile_specialty_result',
  ]) {
    if (!(await tableExists(client, t))) errors.push(`missing ${t}`);
  }
  const idx = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname = 'organigrama'
        AND tablename = 'mc_profile_evaluation'
        AND indexdef ILIKE '%is_active%'`,
  );
  if (!idx.rows.length) {
    errors.push('active evaluation unique index not found');
  }
  return errors;
}

async function main() {
  const confirm = process.argv.includes('--i-confirm-migrate');
  if (!confirm) {
    throw new Error('Requiere --i-confirm-migrate');
  }

  const host = process.env.DB_HOST;
  if (isLocalHost(host)) {
    throw new Error(`Host parece local (${host}). Abort.`);
  }

  const ssl =
    String(process.env.DB_SSL).toLowerCase() === 'true'
      ? { rejectUnauthorized: false }
      : undefined;

  const client = new Client({
    host,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD?.replace(/^'|'$/g, ''),
    ssl,
  });

  await client.connect();
  console.log(
    `${TAG} connected db=${process.env.DB_NAME} host=${host?.split('.')[0]}.x.x.…`,
  );

  const results: Array<{
    file: string;
    ok: boolean;
    errors: string[];
  }> = [];

  try {
    for (const file of FILES) {
      const path = resolve(process.cwd(), 'migrations', file);
      const sql = readFileSync(path, 'utf8');
      console.log(`${TAG} applying ${file} (${sql.length} chars)…`);
      await client.query(sql);
      console.log(`${TAG} applied ${file}`);

      let errors: string[] = [];
      if (file.startsWith('018')) errors = await validate018(client);
      if (file.startsWith('019')) errors = await validate019(client);
      if (file.startsWith('020')) errors = await validate020(client);

      results.push({ file, ok: errors.length === 0, errors });
      if (errors.length) {
        console.error(`${TAG} VALIDATION FAILED after ${file}:`, errors);
        writeFileSync(
          resolve(
            process.cwd(),
            'tmp/cv-attributes/mc1.3.5-migration-partial.json',
          ),
          JSON.stringify({ stoppedAt: file, results }, null, 2),
        );
        process.exit(4);
      }
      console.log(`${TAG} validated ${file}`);
    }

    const out = {
      phase: 'MC1.3.5',
      step: 'migrations',
      at: new Date().toISOString(),
      results,
      status: 'SUCCESS',
    };
    writeFileSync(
      resolve(process.cwd(), 'tmp/cv-attributes/mc1.3.5-migrations.json'),
      JSON.stringify(out, null, 2),
    );
    console.log(`${TAG} ALL OK`, JSON.stringify(out, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(TAG, e instanceof Error ? e.message : e);
  process.exit(1);
});
