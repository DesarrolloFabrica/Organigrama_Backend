/**
 * Reintento solo Jonh (1191) con pages alineadas a PARTIAL.
 * Leidy permanece EMPTY_DOCUMENT (sin OCR) — no reprocesar.
 *   node scripts/mc1-b2b-retry-jonh.js
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const env = {
  ...process.env,
  MC1_B2B_ONLY: '1191',
  NODE_ENV: 'development',
  MC1_ALLOW_ARTIFACT_LOCAL: 'true',
};
for (const k of Object.keys(env)) {
  if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete env[k];
}

const r = spawnSync(
  'npx',
  ['ts-node', '--transpile-only', 'scripts/mc1-b2b-cohort.ts', '--confirm'],
  { cwd: root, env, encoding: 'utf8', shell: true },
);
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(String(r.stderr).slice(-4000));
process.exit(r.status || 0);
