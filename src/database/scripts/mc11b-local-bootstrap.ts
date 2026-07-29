/**
 * Bootstrap esquema MC1 en PostgreSQL local (puerto 5433).
 *
 * npm run mc:local:bootstrap -- --i-confirm-bootstrap
 *
 * Aplica:
 *   migrations/local/000_mc1_local_prerequisites.sql
 *   011, 014, 015, 018, 019, 020, 021, 022
 *
 * Requiere DB_HOST local (usar .env.mc1-local).
 */
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Client } from 'pg';
import { assertLocalDatabaseHost } from '../local/assert-local-db-host';

const TAG = '[MC1 Local Bootstrap]';

const MIGRATION_FILES = [
  'local/000_mc1_local_prerequisites.sql',
  '011_cv_skills_persistence.sql',
  '014_cv_skill_enrichment.sql',
  '015_cv_evidence_evaluation.sql',
  '018_mc_competency_catalog.sql',
  '019_mc_skill_specialty_mapping.sql',
  '020_mc_profile_evaluation.sql',
  '021_mc_evaluation_context.sql',
  '022_mc_profile_evaluation_domain_qualification.sql',
  '023_mc_evaluation_set.sql',
];

function loadEnv(): void {
  const envArg = process.argv.find((a) => a.startsWith('--env-file='));
  const envPath = envArg
    ? resolve(process.cwd(), envArg.slice('--env-file='.length))
    : resolve(process.cwd(), '.env.mc1-local');
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true, quiet: true });
    console.log(`${TAG} env=${envPath}`);
  } else {
    throw new Error(`${TAG} falta ${envPath}`);
  }
  delete process.env.DB_SCHEMA;
  process.env.DB_SSL = 'false';
}

async function main(): Promise<void> {
  loadEnv();
  if (!process.argv.includes('--i-confirm-bootstrap')) {
    throw new Error('Requiere --i-confirm-bootstrap');
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

  await client.connect();
  const applied: string[] = [];
  try {
    const info = await client.query(
      'SELECT current_database() AS db, current_user AS u, version() AS v',
    );
    console.log(`${TAG} connected`, info.rows[0]);

    for (const file of MIGRATION_FILES) {
      const full = resolve(process.cwd(), 'migrations', file);
      const sql = readFileSync(full, 'utf8');
      console.log(`${TAG} applying ${file}…`);
      try {
        await client.query(sql);
        applied.push(file);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Re-run seguro solo para prerequisites IF NOT EXISTS; migraciones
        // estrictas fallan a propósito si ya existen.
        if (
          file.includes('000_mc1_local') ||
          /already exists/i.test(msg)
        ) {
          console.warn(`${TAG} skip/partial ${file}: ${msg.split('\n')[0]}`);
          applied.push(`${file} (skip)`);
          continue;
        }
        throw err;
      }
    }

    const cols = await client.query(
      `SELECT column_name, data_type, character_maximum_length, is_nullable
         FROM information_schema.columns
        WHERE table_schema='organigrama'
          AND table_name='mc_profile_evaluation'
          AND column_name='domain_qualification'`,
    );
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='organigrama'
          AND table_name IN (
            'mc_profile_evaluation','mc_profile_specialty_result',
            'cv_extraction','cv_skill_enrichment','cv_evidence_evaluation'
          )
        ORDER BY table_name`,
    );

    const out = {
      phase: 'MC1.1B-local-bootstrap',
      host,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      applied,
      domainQualification: cols.rows[0] ?? null,
      tables: tables.rows.map((r: { table_name: string }) => r.table_name),
      at: new Date().toISOString(),
    };
    mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
    writeFileSync(
      resolve(process.cwd(), 'tmp/mc11b-local-bootstrap.json'),
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
