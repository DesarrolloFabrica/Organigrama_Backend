/**
 * Reintento Jonh (1191) + Leidy (1197) tras fallos de snapshot.
 * - Jonh: PARTIAL con texto → pipeline OK
 * - Leidy: borra EMPTY_DOCUMENT en MDE y recrea P0
 *
 *   npx ts-node --transpile-only scripts/mc1-b2b-retry-failed.ts --confirm
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-b2b-cohort');

function loadEnvFile(path: string, allow: Set<string> | null = null) {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (allow && !allow.has(k)) continue;
    out[k] = v;
  }
  return out;
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'REQUIRES_CONFIRM' }));
    process.exit(2);
  }

  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const driveAllow = new Set([
    'GOOGLE_DRIVE_CV_FOLDER_ID',
    'GOOGLE_DRIVE_CV_TOKEN_PATH',
    'GOOGLE_DRIVE_CV_AUTH_MODE',
    'GOOGLE_DRIVE_CV_OAUTH_CLIENT_PATH',
  ]);
  const driveEnv = loadEnvFile(resolve(ROOT, '.env'), driveAllow);
  for (const [k, v] of Object.entries(driveEnv)) {
    if (!process.env[k]?.trim()) process.env[k] = v;
  }
  process.env.NODE_ENV = 'development';
  process.env.MC1_ALLOW_ARTIFACT_LOCAL = 'true';

  const mdeEnv = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const mde = {
    host: mdeEnv.MDE_DB_HOST,
    port: Number(mdeEnv.MDE_DB_PORT),
    database: mdeEnv.MDE_DB_NAME,
    username: mdeEnv.MDE_DB_USERNAME,
    password: mdeEnv.MDE_DB_PASSWORD,
  };
  assertMdeTarget(mde);

  const ds = new DataSource({
    type: 'postgres',
    host: mde.host,
    port: mde.port,
    username: mde.username,
    password: mde.password,
    database: mde.database,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();
  try {
    // Invalidate EMPTY Leidy snapshot so P0 recreates
    const del = await ds.query(
      `DELETE FROM organigrama.mc_cv_snapshot
        WHERE id = 49 AND person_cv_id = 195 AND parse_status = 'EMPTY_DOCUMENT'
        RETURNING id::text, parse_status`,
    );
    console.log(JSON.stringify({ deletedLeidyEmpty: del }, null, 2));
  } finally {
    await ds.destroy();
  }

  // Dynamic import of process path: spawn cohort for two people only via env filter
  process.env.MC1_B2B_ONLY = '1191,1197';
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(
    'npx',
    ['ts-node', '--transpile-only', 'scripts/mc1-b2b-cohort.ts', '--confirm'],
    {
      cwd: ROOT,
      env: process.env,
      encoding: 'utf8',
      shell: true,
    },
  );
  console.log(r.stdout || '');
  if (r.stderr) console.error(r.stderr.slice(-2000));
  if (r.status !== 0) process.exit(r.status || 1);

  // Merge retry results into cohort-report
  const reportPath = join(OUT_DIR, 'cohort-report.json');
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, 'retry-note.json'),
    JSON.stringify(
      {
        retried: ['1191', '1197'],
        afterRetryDecision: report.decision,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(String(e?.stack || e).slice(0, 600));
  process.exit(1);
});
