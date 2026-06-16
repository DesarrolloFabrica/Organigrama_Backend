/**
 * Crea snapshot de respaldo y valida versiones en BD.
 * Uso: node scripts/create-periodo-snapshot.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const pg = require('pg');
const { NestFactory } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { AppModule } = require('../dist/app.module');

const API = process.env.API_BASE_URL || 'http://localhost:3000';

const SNAPSHOT_BODY = {
  sourceVersionId: 1,
  code: 'periodo-febrero-junio-2026',
  name: 'Periodo febrero - junio 2026',
  periodLabel: 'Febrero - junio 2026',
  description:
    'Snapshot histórico del organigrama correspondiente al periodo febrero - junio 2026, creado antes de modificar significativamente la plantilla.',
};

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

async function api(method, urlPath, token, body) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
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

async function queryDb(env, sql) {
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
    return await client.query(sql);
  } finally {
    await client.end();
  }
}

async function main() {
  const env = loadEnv();
  const token = await signTechToken();

  let create = await api(
    'POST',
    '/api/org-chart/versions/snapshot',
    token,
    SNAPSHOT_BODY,
  );

  if (create.status === 409) {
    console.log('[OK] Snapshot periodo-febrero-junio-2026 ya existía (409)');
  } else if (create.status === 200 || create.status === 201) {
    console.log(
      `[OK] Snapshot creado id=${create.json?.id} code=${create.json?.code}`,
    );
  } else {
    console.error('[FAIL] Crear snapshot', create.status, create.json);
    process.exit(1);
  }

  const counts = await queryDb(
    env,
    `SELECT v.id, v.code, v.is_active, COUNT(r.id)::int AS rel_count
     FROM organigrama.org_chart_version v
     LEFT JOIN organigrama.org_visual_relation r ON r.version_id = v.id
     GROUP BY v.id, v.code, v.is_active
     ORDER BY v.id`,
  );

  console.log('\n--- Versiones en BD ---');
  for (const row of counts.rows) {
    console.log(
      `  id=${row.id} code=${row.code} active=${row.is_active} relaciones=${row.rel_count}`,
    );
  }

  const checks = [
    {
      name: 'periodo-febrero-junio-2026 existe',
      ok: counts.rows.some((r) => r.code === 'periodo-febrero-junio-2026'),
    },
    {
      name: 'periodo-febrero-junio-2026 tiene 2842 relaciones',
      ok:
        counts.rows.find((r) => r.code === 'periodo-febrero-junio-2026')
          ?.rel_count === 2842,
    },
    {
      name: 'current sigue activa',
      ok: counts.rows.some((r) => r.code === 'current' && r.is_active),
    },
    {
      name: 'current tiene 2842 relaciones',
      ok: counts.rows.find((r) => r.code === 'current')?.rel_count === 2842,
    },
    {
      name: 'snapshot-prueba-versionamiento sigue existiendo',
      ok: counts.rows.some((r) => r.code === 'snapshot-prueba-versionamiento'),
    },
  ];

  console.log('\n--- Validación ---');
  let failed = 0;
  for (const check of checks) {
    const mark = check.ok ? 'OK' : 'FAIL';
    console.log(`[${mark}] ${check.name}`);
    if (!check.ok) failed += 1;
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
