/**
 * Valida conteos de personas únicas vs relaciones.
 * Uso: node scripts/validate-unique-people-counts.cjs
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
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"')))
      v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

async function signTechToken() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
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

async function api(urlPath, token) {
  const res = await fetch(`${API}${urlPath}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function main() {
  const env = loadEnv();
  const client = new pg.Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const sql = await client.query(`
    SELECT
      v.code,
      COUNT(DISTINCT person_id)::int AS personas_unicas,
      (SELECT COUNT(*)::int FROM organigrama.org_visual_relation r
       WHERE r.version_id = v.id AND r.is_active = true) AS relaciones_activas
    FROM organigrama.org_chart_version v
    JOIN (
      SELECT version_id, parent_person_id AS person_id
      FROM organigrama.org_visual_relation
      WHERE is_active = true
      UNION
      SELECT version_id, child_person_id AS person_id
      FROM organigrama.org_visual_relation
      WHERE is_active = true
    ) x ON x.version_id = v.id
    GROUP BY v.id, v.code
    ORDER BY v.code
  `);

  console.log('\n--- Personas únicas vs relaciones activas (SQL) ---');
  console.table(sql.rows);

  const token = await signTechToken();
  const root = await api('/api/org-chart/root', token);
  const rootId = root.json?.id;
  const summary = await api(`/api/org-chart/summary/${rootId}`, token);
  const areas = await api('/api/org-chart/summary/general-areas', token);

  console.log('\n--- API summary root ---');
  console.log(`rootId=${rootId}`);
  console.log(`general.totalPeople=${summary.json?.general?.totalPeople}`);
  console.log(
    `areas[0].totalPeople=${areas.json?.[0]?.totalPeople ?? 'n/a'} (primera área)`,
  );

  const checks = [
    sql.rows.every((r) => r.personas_unicas === 859),
    sql.rows.every((r) => r.relaciones_activas === 2841),
    (summary.json?.general?.totalPeople ?? 0) < 1000,
    (summary.json?.general?.totalPeople ?? 0) > 800,
  ];

  await client.end();
  const ok = checks.every(Boolean);
  console.log(`\nValidación: ${ok ? 'OK' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
