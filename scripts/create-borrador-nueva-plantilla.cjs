/**
 * Crea borrador-nueva-plantilla desde current y valida estado de versiones.
 * Uso: node scripts/create-borrador-nueva-plantilla.cjs
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
  code: 'borrador-nueva-plantilla',
  name: 'Borrador nueva plantilla',
  periodLabel: 'Nueva plantilla (borrador)',
  description:
    'Versión de trabajo para preparar cambios no oficiales del organigrama. No visible para usuarios normales.',
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

function log(step, ok, detail = '') {
  const mark = ok ? 'OK' : 'FAIL';
  console.log(`[${mark}] ${step}${detail ? ` — ${detail}` : ''}`);
  return ok;
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
    console.log('[OK] borrador-nueva-plantilla ya existía (409)');
    const versions = await api('GET', '/api/org-chart/versions', token);
    const existing = Array.isArray(versions.json)
      ? versions.json.find((v) => v.code === SNAPSHOT_BODY.code)
      : null;
    create = { status: 200, json: existing };
  } else if (create.status === 200 || create.status === 201) {
    console.log(
      `[OK] Borrador creado id=${create.json?.id} code=${create.json?.code}`,
    );
  } else {
    console.error('[FAIL] Crear borrador', create.status, create.json);
    process.exit(1);
  }

  const borradorId = create.json?.id;
  if (!borradorId) {
    console.error('[FAIL] No se obtuvo id del borrador');
    process.exit(1);
  }

  const counts = await queryDb(
    env,
    `SELECT v.id, v.code, v.is_active, v.is_locked,
            COUNT(r.id)::int AS relaciones_totales,
            COUNT(*) FILTER (WHERE r.is_active = true)::int AS relaciones_activas
     FROM organigrama.org_chart_version v
     LEFT JOIN organigrama.org_visual_relation r ON r.version_id = v.id
     GROUP BY v.id, v.code, v.is_active, v.is_locked
     ORDER BY v.id`,
  );

  console.log('\n--- Versiones en BD ---');
  for (const row of counts.rows) {
    console.log(
      `  id=${row.id} code=${row.code} active=${row.is_active} locked=${row.is_locked} totales=${row.relaciones_totales} activas=${row.relaciones_activas}`,
    );
  }

  const current = counts.rows.find((r) => r.code === 'current');
  const periodo = counts.rows.find((r) => r.code === 'periodo-febrero-junio-2026');
  const borrador = counts.rows.find((r) => r.code === 'borrador-nueva-plantilla');

  const checks = [
    log('current activa', current?.is_active === true, `is_active=${current?.is_active}`),
    log('current no locked', current?.is_locked === false, `is_locked=${current?.is_locked}`),
    log('current 2842 relaciones', current?.relaciones_totales === 2842, `count=${current?.relaciones_totales}`),
    log('periodo locked', periodo?.is_locked === true, `is_locked=${periodo?.is_locked}`),
    log('periodo 2842 relaciones', periodo?.relaciones_totales === 2842, `count=${periodo?.relaciones_totales}`),
    log('borrador existe', Boolean(borrador), `id=${borrador?.id}`),
    log('borrador no activo', borrador?.is_active === false, `is_active=${borrador?.is_active}`),
    log('borrador no locked', borrador?.is_locked === false, `is_locked=${borrador?.is_locked}`),
    log('borrador 2842 relaciones', borrador?.relaciones_totales === 2842, `count=${borrador?.relaciones_totales}`),
    log(
      'borrador igual a current (activas)',
      borrador?.relaciones_activas === current?.relaciones_activas,
      `borrador=${borrador?.relaciones_activas} current=${current?.relaciones_activas}`,
    ),
  ];

  const compare = await api(
    'GET',
    `/api/org-chart/versions/compare?baseVersionId=${current.id}&targetVersionId=${borrador.id}`,
    token,
  );
  const summary = compare.json?.summary;
  checks.push(
    log(
      'compare current vs borrador added=0',
      summary?.added === 0,
      `added=${summary?.added}`,
    ),
    log(
      'compare current vs borrador removed=0',
      summary?.removed === 0,
      `removed=${summary?.removed}`,
    ),
    log(
      'compare current vs borrador moved=0',
      summary?.moved === 0,
      `moved=${summary?.moved}`,
    ),
  );

  console.log(`\n>>> ID borrador para pruebas: ${borrador.id} (code=borrador-nueva-plantilla)`);

  const failed = checks.filter((ok) => !ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
