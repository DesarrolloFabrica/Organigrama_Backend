/**
 * MC1.6.1B.2 — Aplica migración 021 (trazabilidad evaluación).
 * Requiere --i-confirm-migrate. No reescribe resultados PA2.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

const TAG = '[MC1.6.1B.2 Migrate]';
const FILE = '021_mc_evaluation_context.sql';

function isLocalHost(host: string | undefined): boolean {
  if (!host) return true;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('::1')
  );
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

  const path = resolve(process.cwd(), 'migrations', FILE);
  const sql = readFileSync(path, 'utf8');
  console.log(`${TAG} SQL preview (${sql.length} chars):\n${sql.slice(0, 500)}…\n`);

  const client = new Client({
    host,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD?.replace(/^'|'$/g, ''),
    ssl,
  });
  await client.connect();
  try {
    await client.query(sql);
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='organigrama' AND table_name='mc_profile_evaluation'
          AND column_name IN (
            'mapping_pack_code','mapping_pack_version','source_hash',
            'algorithm_version','evaluation_context_hash'
          )
        ORDER BY column_name`,
    );
    const table = await client.query(
      `SELECT 1 FROM information_schema.tables
        WHERE table_schema='organigrama' AND table_name='mc_mapping_pack_release'`,
    );
    const out = {
      phase: 'MC1.6.1B.2',
      file: FILE,
      columns: cols.rows.map((r: { column_name: string }) => r.column_name),
      packReleaseTable: (table.rowCount ?? 0) > 0,
      at: new Date().toISOString(),
    };
    mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
    writeFileSync(
      resolve(process.cwd(), 'tmp/mc161b2-migration.json'),
      JSON.stringify(out, null, 2),
    );
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
