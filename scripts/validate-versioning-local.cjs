const fs = require('node:fs');
const path = require('node:path');
const pg = require('pg');
const { NestFactory } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { AppModule } = require('../dist/app.module');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

function loadEnv() {
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnv();
const API = process.env.API_BASE_URL || 'http://localhost:3000';

async function signTokens() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const jwt = app.get(JwtService);
    const techToken = await jwt.signAsync({
      personId: '1229',
      googleSubject: 'dev-1229',
      googleEmail: 'desarrollofabrica@cun.edu.co',
      eduEmail: 'desarrollofabrica@cun.edu.co',
      permissions: ['ORG_READ_ALL', 'ORG_ADMIN'],
    });
    const normalToken = await jwt.signAsync({
      personId: '1144',
      googleSubject: 'dev-1144',
      googleEmail: 'camilo_quintero@cun.edu.co',
      eduEmail: 'camilo_quintero@cun.edu.co',
      permissions: [],
    });
    return { techToken, normalToken };
  } finally {
    await app.close();
  }
}

async function api(method, urlPath, token, body) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function queryDb(sql, params = []) {
  const client = new pg.Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}

const results = [];

function log(step, ok, detail = '') {
  const mark = ok ? 'OK' : 'FAIL';
  const line = `[${mark}] ${step}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
  results.push({ step, ok, detail });
}

async function main() {
  console.log(`API base: ${API}`);

  const { techToken, normalToken } = await signTokens();

  const health = await api('GET', '/api/health');
  log('GET /api/health', health.status === 200 && health.json?.ok === true, `status=${health.status}`);

  const versions = await api('GET', '/api/org-chart/versions', techToken);
  log(
    'GET /api/org-chart/versions (tech)',
    versions.status === 200 && Array.isArray(versions.json),
    `status=${versions.status} count=${Array.isArray(versions.json) ? versions.json.length : 0}`,
  );

  const root = await api('GET', '/api/org-chart/root', techToken);
  log(
    'GET /api/org-chart/root',
    root.status === 200 && root.json?.id,
    `status=${root.status} rootId=${root.json?.id} children=${root.json?.children?.length ?? 0}`,
  );

  const rootCode = await api('GET', '/api/org-chart/root?versionCode=current', techToken);
  log(
    'GET /api/org-chart/root?versionCode=current',
    rootCode.status === 200 && rootCode.json?.id === root.json?.id,
    `status=${rootCode.status}`,
  );

  const rootVid = await api('GET', '/api/org-chart/root?versionId=1', techToken);
  log(
    'GET /api/org-chart/root?versionId=1',
    rootVid.status === 200 && rootVid.json?.id === root.json?.id,
    `status=${rootVid.status}`,
  );

  const snapshotBody = {
    sourceVersionId: 1,
    code: 'snapshot-prueba-versionamiento',
    name: 'Snapshot prueba versionamiento',
    periodLabel: 'Prueba',
    description: 'Snapshot temporal para validar versionamiento',
  };

  const snapshot = await api('POST', '/api/org-chart/versions/snapshot', techToken, snapshotBody);
  if (snapshot.status === 409) {
    log(
      'POST /api/org-chart/versions/snapshot',
      true,
      'ya existía (409) — se validará versión existente',
    );
  } else {
    log(
      'POST /api/org-chart/versions/snapshot',
      snapshot.status === 201 || snapshot.status === 200,
      `status=${snapshot.status} id=${snapshot.json?.id}`,
    );
  }

  const versionsAfter = await api('GET', '/api/org-chart/versions', techToken);
  const snap = Array.isArray(versionsAfter.json)
    ? versionsAfter.json.find((v) => v.code === snapshotBody.code)
    : null;
  log(
    'Snapshot visible en listado',
    Boolean(snap),
    snap ? `id=${snap.id} isActive=${snap.isActive}` : 'no encontrado',
  );

  const normalVersions = await api('GET', '/api/org-chart/versions', normalToken);
  log(
    'GET /api/org-chart/versions (normal)',
    normalVersions.status === 403,
    `status=${normalVersions.status}`,
  );

  const normalRootVid = await api('GET', '/api/org-chart/root?versionId=1', normalToken);
  log(
    'GET /api/org-chart/root?versionId=1 (normal)',
    normalRootVid.status === 403,
    `status=${normalRootVid.status}`,
  );

  const dbVersions = await queryDb(
    `SELECT id, code, name, is_active, is_locked
     FROM organigrama.org_chart_version
     ORDER BY id`,
  );
  const dbCounts = await queryDb(
    `SELECT v.id, v.code, v.is_active, COUNT(r.id)::int AS rel_count
     FROM organigrama.org_chart_version v
     LEFT JOIN organigrama.org_visual_relation r ON r.version_id = v.id
     GROUP BY v.id, v.code, v.is_active
     ORDER BY v.id`,
  );

  const current = dbCounts.rows.find((r) => r.code === 'current');
  const snapRow = dbCounts.rows.find((r) => r.code === snapshotBody.code);
  const currentStillActive = dbVersions.rows.some((r) => r.code === 'current' && r.is_active);

  log('BD: current activa', currentStillActive, `is_active=${current?.is_active}`);
  log('BD: relaciones current', current?.rel_count === 2842, `count=${current?.rel_count}`);
  log('BD: relaciones snapshot', snapRow?.rel_count === 2842, `count=${snapRow?.rel_count ?? 'n/a'}`);

  console.log('\n--- Resumen BD versiones ---');
  for (const row of dbCounts.rows) {
    console.log(`  id=${row.id} code=${row.code} active=${row.is_active} relaciones=${row.rel_count}`);
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nResultado: ${results.length - failed}/${results.length} checks OK`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
