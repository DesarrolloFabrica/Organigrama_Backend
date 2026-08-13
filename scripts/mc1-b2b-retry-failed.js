/**
 * Reintento Jonh + Leidy. Borra EMPTY_DOCUMENT de Leidy en MDE y reejecuta cohort filtrado.
 *   node scripts/mc1-b2b-retry-failed.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv(p) {
  const o = {};
  if (!fs.existsSync(p)) return o;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (!l || l.startsWith('#')) continue;
    const i = l.indexOf('=');
    if (i <= 0) continue;
    o[l.slice(0, i).trim()] = l
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }
  return o;
}

(async () => {
  const root = path.join(__dirname, '..');
  const m = loadEnv(path.join(root, 'secrets', 'mc1-mde.local.env'));
  if (
    !['127.0.0.1', 'localhost', '::1'].includes(String(m.MDE_DB_HOST)) ||
    Number(m.MDE_DB_PORT) !== 5434 ||
    !String(m.MDE_DB_NAME).includes('_mde')
  ) {
    throw new Error('REFUSING_NON_MDE_TARGET');
  }

  const c = new Client({
    host: m.MDE_DB_HOST,
    port: Number(m.MDE_DB_PORT),
    database: m.MDE_DB_NAME,
    user: m.MDE_DB_USERNAME,
    password: m.MDE_DB_PASSWORD,
  });
  await c.connect();
  const del = await c.query(
    `DELETE FROM organigrama.mc_cv_snapshot
      WHERE id = 49 AND person_cv_id = 195 AND parse_status = 'EMPTY_DOCUMENT'
      RETURNING id::text, parse_status`,
  );
  console.log(JSON.stringify({ deletedLeidyEmpty: del.rows }, null, 2));
  await c.end();

  const env = {
    ...process.env,
    MC1_B2B_ONLY: '1191,1197',
    NODE_ENV: 'development',
    MC1_ALLOW_ARTIFACT_LOCAL: 'true',
  };
  // Clear DB_* so cohort uses MDE
  for (const k of Object.keys(env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete env[k];
  }

  const r = spawnSync(
    'npx',
    ['ts-node', '--transpile-only', 'scripts/mc1-b2b-cohort.ts', '--confirm'],
    { cwd: root, env, encoding: 'utf8', shell: true },
  );
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr.slice(-3000));
  process.exit(r.status || 0);
})().catch((e) => {
  console.error('RETRY_FAIL', String(e.message || e).slice(0, 400));
  process.exit(1);
});
