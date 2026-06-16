/**
 * Bloquea históricos, valida estado de dos versiones y compara periodo vs current.
 * Uso: node scripts/validate-two-version-scope.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const pg = require('pg');
const { NestFactory } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { AppModule } = require('../dist/app.module');

const API = process.env.API_BASE_URL || 'http://localhost:3000';

function loadEnv() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
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

async function signTechToken() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const jwt = app.get(JwtService);
    return jwt.signAsync({
      personId: '1229',
      googleSubject: 'dev-1229',
      googleEmail: 'desarrollofabrica@cun.edu.co',
      eduEmail: 'desarrollofabrica@cun.edu.co',
      permissions: ['ORG_READ_ALL', 'ORG_ADMIN'],
    });
  } finally {
    await app.close();
  }
}

async function api(method, urlPath, token) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
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

async function queryDb(env, sql, params = []) {
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

function log(step, ok, detail = '') {
  const mark = ok ? 'OK' : 'FAIL';
  console.log(`[${mark}] ${step}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

async function main() {
  const env = loadEnv();

  await queryDb(
    env,
    `UPDATE organigrama.org_chart_version
     SET is_locked = true, updated_at = NOW()
     WHERE code IN ('periodo-febrero-junio-2026', 'snapshot-prueba-versionamiento')
       AND is_locked = false`,
  );

  const versions = await queryDb(
    env,
    `SELECT id, code, is_active, is_locked
     FROM organigrama.org_chart_version
     ORDER BY id`,
  );

  const counts = await queryDb(
    env,
    `SELECT v.id, v.code, v.is_active, v.is_locked, COUNT(r.id)::int AS rel_count
     FROM organigrama.org_chart_version v
     LEFT JOIN organigrama.org_visual_relation r ON r.version_id = v.id
     GROUP BY v.id, v.code, v.is_active, v.is_locked
     ORDER BY v.id`,
  );

  console.log('\n--- Versiones en BD ---');
  for (const row of counts.rows) {
    console.log(
      `  id=${row.id} code=${row.code} active=${row.is_active} locked=${row.is_locked} relaciones=${row.rel_count}`,
    );
  }

  const periodo = counts.rows.find((r) => r.code === 'periodo-febrero-junio-2026');
  const current = counts.rows.find((r) => r.code === 'current');
  const snapPrueba = counts.rows.find(
    (r) => r.code === 'snapshot-prueba-versionamiento',
  );

  const checks = [];

  checks.push(
    log(
      'periodo-febrero-junio-2026 locked',
      periodo?.is_locked === true,
      `is_locked=${periodo?.is_locked}`,
    ),
  );
  checks.push(
    log(
      'current activa',
      current?.is_active === true && current?.is_locked === false,
      `is_active=${current?.is_active} is_locked=${current?.is_locked}`,
    ),
  );
  checks.push(
    log(
      'periodo-febrero-junio-2026 tiene 2842 relaciones',
      periodo?.rel_count === 2842,
      `count=${periodo?.rel_count}`,
    ),
  );
  checks.push(
    log(
      'current tiene 2842 relaciones',
      current?.rel_count === 2842,
      `count=${current?.rel_count}`,
    ),
  );

  if (snapPrueba) {
    checks.push(
      log(
        'snapshot-prueba-versionamiento locked',
        snapPrueba.is_locked === true,
        `is_locked=${snapPrueba.is_locked}`,
      ),
    );
  }

  const token = await signTechToken();
  const compare = await api(
    'GET',
    `/api/org-chart/versions/compare?baseVersionId=${periodo.id}&targetVersionId=${current.id}`,
    token,
  );

  const summary = compare.json?.summary;
  checks.push(
    log(
      'GET /versions/compare (tech)',
      compare.status === 200 && summary,
      `status=${compare.status}`,
    ),
  );
  checks.push(
    log(
      'comparación added=0',
      summary?.added === 0,
      `added=${summary?.added}`,
    ),
  );
  checks.push(
    log(
      'comparación removed=0',
      summary?.removed === 0,
      `removed=${summary?.removed}`,
    ),
  );
  checks.push(
    log(
      'comparación moved=0',
      summary?.moved === 0,
      `moved=${summary?.moved}`,
    ),
  );

  if (summary) {
    console.log(
      `\nComparación ${compare.json.baseVersion.code} → ${compare.json.targetVersion.code}: added=${summary.added} removed=${summary.removed} moved=${summary.moved} unchanged=${summary.unchanged}`,
    );
  }

  const failed = checks.filter((ok) => !ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
