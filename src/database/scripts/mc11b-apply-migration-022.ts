/**
 * MC1.1B — Aplica migración 022 SOLO en BD local.
 *
 * npm run mc:migrate-022 -- --i-confirm-migrate --env-file=.env.mc1-local
 */
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { assertLocalDatabaseHost } from '../local/assert-local-db-host';

const TAG = '[MC1.1B Migrate 022]';
const FILE = '022_mc_profile_evaluation_domain_qualification.sql';

function loadEnv(): void {
  const envArg = process.argv.find((a) => a.startsWith('--env-file='));
  const envPath = envArg
    ? resolve(process.cwd(), envArg.slice('--env-file='.length))
    : resolve(process.cwd(), '.env.mc1-local');
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true, quiet: true });
  } else {
    throw new Error(`${TAG} falta ${envPath}`);
  }
  delete process.env.DB_SCHEMA;
  process.env.DB_SSL = 'false';
}

async function main() {
  loadEnv();
  const confirm = process.argv.includes('--i-confirm-migrate');
  if (!confirm) {
    throw new Error('Requiere --i-confirm-migrate');
  }

  const host = process.env.DB_HOST;
  assertLocalDatabaseHost(host);

  const client = new Client({
    host,
    port: Number(process.env.DB_PORT || 5433),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD?.replace(/^'|'$/g, ''),
  });

  const path = resolve(process.cwd(), 'migrations', FILE);
  const sql = readFileSync(path, 'utf8');
  console.log(`${TAG} aplicando ${FILE} en ${host}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

  await client.connect();
  try {
    await client.query(sql);
    const cols = await client.query(
      `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'organigrama'
          AND table_name = 'mc_profile_evaluation'
          AND column_name = 'domain_qualification'`,
    );
    const chk = await client.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conname = 'chk_mc_profile_eval_domain_qualification'`,
    );
    const nullHist = await client.query(
      `SELECT COUNT(*)::int AS n
         FROM organigrama.mc_profile_evaluation
        WHERE domain_qualification IS NULL`,
    );
    const out = {
      phase: 'MC1.1B',
      file: FILE,
      host,
      column: cols.rows[0] ?? null,
      constraint: chk.rows[0] ?? null,
      historicalNullCount: nullHist.rows[0]?.n ?? null,
      at: new Date().toISOString(),
    };
    mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
    writeFileSync(
      resolve(process.cwd(), 'tmp/mc11b-migration-022.json'),
      JSON.stringify(out, null, 2),
    );
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(TAG, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
