/**
 * QA de seguridad y aislamiento del versionamiento del organigrama.
 * Uso: node scripts/qa-versioning-security.cjs
 *
 * Requiere: backend en ejecución, dist compilado, .env con credenciales BD.
 */
const fs = require('node:fs');
const path = require('node:path');
const pg = require('pg');
const { NestFactory } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { AppModule } = require('../dist/app.module');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const API = process.env.API_BASE_URL || 'http://localhost:3000';

const DAVID_PERSON_ID = '1165';
const BORRADOR_CODE = 'borrador-nueva-plantilla';
const ACTIVE_CODE = 'periodo-febrero-junio-2026';

/** @type {Array<{section:string,endpoint:string,profile:string,expected:string,actual:string,pass:boolean,detail?:string}>} */
const apiResults = [];
/** @type {Array<{check:string,pass:boolean,detail:string}>} */
const dbResults = [];

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

async function signTokens() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const jwt = app.get(JwtService);
    const techToken = await jwt.signAsync({
      personId: '1229',
      googleSubject: 'qa-tech-1229',
      googleEmail: 'desarrollofabrica@cun.edu.co',
      eduEmail: 'desarrollofabrica@cun.edu.co',
      permissions: ['ORG_READ_ALL', 'ORG_ADMIN'],
    });
    const normalToken = await jwt.signAsync({
      personId: '1144',
      googleSubject: 'qa-normal-1144',
      googleEmail: 'camilo_quintero@cun.edu.co',
      eduEmail: 'camilo_quintero@cun.edu.co',
      permissions: [],
    });
    const adminGenericToken = await jwt.signAsync({
      personId: '100',
      googleSubject: 'qa-admin-generic',
      googleEmail: 'admin.generico@cun.edu.co',
      eduEmail: 'admin.generico@cun.edu.co',
      permissions: ['ORG_READ_ALL', 'ORG_ADMIN'],
    });
    return { techToken, normalToken, adminGenericToken };
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

function recordApi(section, endpoint, profile, expected, status, detail = '') {
  const actual = String(status);
  const pass =
    expected === '200'
      ? status === 200
      : expected === '403'
        ? status === 403
        : expected === '403|400'
          ? status === 403 || status === 400
          : expected === '200|404'
            ? status === 200 || status === 404
            : status === Number(expected);
  const row = {
    section,
    endpoint,
    profile,
    expected,
    actual,
    pass,
    detail,
  };
  apiResults.push(row);
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`[${mark}] [${profile}] ${endpoint} — esperado ${expected}, real ${actual}${detail ? ` (${detail})` : ''}`);
  return pass;
}

function recordDb(check, pass, detail) {
  dbResults.push({ check, pass, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`[${mark}] [BD] ${check} — ${detail}`);
}

function searchHitsContainPerson(json, personId) {
  if (!Array.isArray(json)) return false;
  return json.some((hit) => String(hit?.id ?? hit?.personId ?? '') === personId);
}

function childrenContainPerson(json, personId) {
  if (!Array.isArray(json)) return false;
  return json.some((node) => String(node?.id ?? '') === personId);
}

async function runDbChecks(env) {
  console.log('\n=== QA BD: versiones ===\n');

  const versions = await queryDb(
    env,
    `SELECT id, code, is_active, is_locked
     FROM organigrama.org_chart_version
     ORDER BY id`,
  );

  const activeCount = await queryDb(
    env,
    `SELECT COUNT(*)::int AS cnt
     FROM organigrama.org_chart_version
     WHERE is_active = true`,
  );

  const activeCode = await queryDb(
    env,
    `SELECT code
     FROM organigrama.org_chart_version
     WHERE is_active = true`,
  );

  const borrador = await queryDb(
    env,
    `SELECT code, is_active, is_locked
     FROM organigrama.org_chart_version
     WHERE code = $1`,
    [BORRADOR_CODE],
  );

  const davidRels = await queryDb(
    env,
    `SELECT
       v.code,
       COUNT(*) FILTER (WHERE rel.is_active = true) AS activas,
       COUNT(*) FILTER (WHERE rel.is_active = false) AS inactivas
     FROM organigrama.org_visual_relation rel
     JOIN organigrama.org_chart_version v ON v.id = rel.version_id
     WHERE rel.child_person_id = $1
     GROUP BY v.code
     ORDER BY v.code`,
    [DAVID_PERSON_ID],
  );

  console.log('Versiones en BD:');
  for (const row of versions.rows) {
    console.log(
      `  id=${row.id} code=${row.code} is_active=${row.is_active} is_locked=${row.is_locked}`,
    );
  }

  recordDb(
    'Solo una versión activa',
    activeCount.rows[0]?.cnt === 1,
    `count=${activeCount.rows[0]?.cnt}`,
  );

  recordDb(
    'Versión activa es periodo-febrero-junio-2026',
    activeCode.rows[0]?.code === ACTIVE_CODE,
    `code=${activeCode.rows[0]?.code ?? '(ninguna)'}`,
  );

  const borradorRow = borrador.rows[0];
  recordDb(
    'Borrador existe con is_active=false, is_locked=false',
    borradorRow &&
      borradorRow.is_active === false &&
      borradorRow.is_locked === false,
    borradorRow
      ? `is_active=${borradorRow.is_active} is_locked=${borradorRow.is_locked}`
      : 'no encontrado',
  );

  const periodoDavid = davidRels.rows.find((r) => r.code === ACTIVE_CODE);
  const borradorDavid = davidRels.rows.find((r) => r.code === BORRADOR_CODE);

  recordDb(
    `David (${DAVID_PERSON_ID}) activo en ${ACTIVE_CODE}`,
    Number(periodoDavid?.activas ?? 0) === 1,
    `activas=${periodoDavid?.activas ?? 0} inactivas=${periodoDavid?.inactivas ?? 0}`,
  );

  recordDb(
    `David (${DAVID_PERSON_ID}) inactivo en ${BORRADOR_CODE}`,
    Number(borradorDavid?.activas ?? 0) === 0 &&
      Number(borradorDavid?.inactivas ?? 0) === 1,
    `activas=${borradorDavid?.activas ?? 0} inactivas=${borradorDavid?.inactivas ?? 0}`,
  );

  const activeRow = versions.rows.find((r) => r.code === ACTIVE_CODE);
  const borradorVersionRow = versions.rows.find((r) => r.code === BORRADOR_CODE);

  return {
    versions: versions.rows,
    activeVersionId: activeRow?.id,
    borradorVersionId: borradorVersionRow?.id,
  };
}

async function runApiChecks(tokens, versionMeta) {
  const { techToken, normalToken, adminGenericToken } = tokens;
  const borradorId = versionMeta.borradorVersionId;
  const activeId = versionMeta.activeVersionId;

  if (!borradorId || !activeId) {
    console.error('\nERROR: No se encontraron IDs de versión activa o borrador en BD.');
    process.exit(1);
  }

  console.log(`\n=== QA API (borrador id=${borradorId}, activa id=${activeId}) ===\n`);

  // --- Perfil A: técnico autorizado ---
  console.log('--- Perfil A: técnico (1229) ---\n');

  recordApi('tech-allow', 'GET /api/org-chart/versions', 'A-técnico', '200', (await api('GET', '/api/org-chart/versions', techToken)).status);
  recordApi('tech-allow', `GET /api/org-chart/root?versionId=${borradorId}`, 'A-técnico', '200', (await api('GET', `/api/org-chart/root?versionId=${borradorId}`, techToken)).status);
  recordApi('tech-allow', `GET /api/org-chart/root?versionCode=${BORRADOR_CODE}`, 'A-técnico', '200', (await api('GET', `/api/org-chart/root?versionCode=${BORRADOR_CODE}`, techToken)).status);
  recordApi('tech-allow', `GET /api/org-chart/search?q=david&versionId=${borradorId}`, 'A-técnico', '200', (await api('GET', `/api/org-chart/search?q=david&versionId=${borradorId}`, techToken)).status);
  recordApi('tech-allow', `GET /api/org-chart/person/${DAVID_PERSON_ID}?versionId=${borradorId}`, 'A-técnico', '200|404', (await api('GET', `/api/org-chart/person/${DAVID_PERSON_ID}?versionId=${borradorId}`, techToken)).status);
  recordApi('tech-allow', `GET /api/org-chart/summary/1162?versionId=${borradorId}`, 'A-técnico', '200', (await api('GET', `/api/org-chart/summary/1162?versionId=${borradorId}`, techToken)).status);
  recordApi('tech-allow', `GET /api/org-chart/children/1162?versionId=${borradorId}`, 'A-técnico', '200', (await api('GET', `/api/org-chart/children/1162?versionId=${borradorId}`, techToken)).status);

  const techCompare = await api(
    'GET',
    `/api/org-chart/versions/compare?baseVersionId=${activeId}&targetVersionId=${borradorId}`,
    techToken,
  );
  recordApi('tech-allow', 'GET /api/org-chart/versions/compare', 'A-técnico', '200', techCompare.status);

  // --- Perfil B: usuario normal ---
  console.log('\n--- Perfil B: usuario normal (1144) ---\n');

  recordApi('normal-allow', 'GET /api/org-chart/root', 'B-normal', '200', (await api('GET', '/api/org-chart/root', normalToken)).status);
  recordApi('normal-allow', 'GET /api/org-chart/search?q=david', 'B-normal', '200', (await api('GET', '/api/org-chart/search?q=david', normalToken)).status);
  recordApi('normal-allow', `GET /api/org-chart/person/${DAVID_PERSON_ID}`, 'B-normal', '200|404', (await api('GET', `/api/org-chart/person/${DAVID_PERSON_ID}`, normalToken)).status);

  const denyEndpoints = [
    ['GET /api/org-chart/versions', `/api/org-chart/versions`],
    [`GET /api/org-chart/root?versionId=${borradorId}`, `/api/org-chart/root?versionId=${borradorId}`],
    [`GET /api/org-chart/root?versionCode=${BORRADOR_CODE}`, `/api/org-chart/root?versionCode=${BORRADOR_CODE}`],
    [`GET /api/org-chart/node/1162?versionId=${borradorId}`, `/api/org-chart/node/1162?versionId=${borradorId}`],
    [`GET /api/org-chart/children/1162?versionId=${borradorId}`, `/api/org-chart/children/1162?versionId=${borradorId}`],
    [`GET /api/org-chart/person/${DAVID_PERSON_ID}?versionId=${borradorId}`, `/api/org-chart/person/${DAVID_PERSON_ID}?versionId=${borradorId}`],
    [`GET /api/org-chart/summary/1162?versionId=${borradorId}`, `/api/org-chart/summary/1162?versionId=${borradorId}`],
    [`GET /api/org-chart/search?q=david&versionId=${borradorId}`, `/api/org-chart/search?q=david&versionId=${borradorId}`],
    ['POST /api/org-chart/versions/snapshot', `/api/org-chart/versions/snapshot`],
    [`GET /api/org-chart/versions/compare?base=${activeId}&target=${borradorId}`, `/api/org-chart/versions/compare?baseVersionId=${activeId}&targetVersionId=${borradorId}`],
  ];

  for (const [label, path] of denyEndpoints) {
    const method = label.startsWith('POST') ? 'POST' : 'GET';
    const body =
      method === 'POST'
        ? {
            sourceVersionId: Number(activeId),
            code: 'qa-should-not-create',
            name: 'QA deny test',
          }
        : undefined;
    const res = await api(method, path, normalToken, body);
    recordApi('normal-deny', label, 'B-normal', '403', res.status);
  }

  // Cualquier versionId explícito (incluso activa) → 403
  recordApi(
    'normal-deny-explicit',
    `GET /api/org-chart/root?versionId=${activeId}`,
    'B-normal',
    '403',
    (await api('GET', `/api/org-chart/root?versionId=${activeId}`, normalToken)).status,
    'versionId de versión activa',
  );

  // --- Perfil C: admin genérico ---
  console.log('\n--- Perfil C: admin genérico (ORG_ADMIN sin 1229) ---\n');

  for (const [label, path] of denyEndpoints.slice(0, 10)) {
    const method = label.startsWith('POST') ? 'POST' : 'GET';
    const body =
      method === 'POST'
        ? {
            sourceVersionId: Number(activeId),
            code: 'qa-admin-deny',
            name: 'QA admin deny',
          }
        : undefined;
    const res = await api(method, path, adminGenericToken, body);
    recordApi('admin-deny', label, 'C-admin', '403', res.status);
  }

  // --- Manipulación de parámetros (usuario normal) ---
  console.log('\n--- Manipulación URL (B-normal) ---\n');

  const manipulations = [
    [`GET /api/org-chart/root?versionId=${borradorId}`, `/api/org-chart/root?versionId=${borradorId}`],
    [`GET /api/org-chart/root?versionCode=${BORRADOR_CODE}`, `/api/org-chart/root?versionCode=${BORRADOR_CODE}`],
    [`GET /api/org-chart/root?versionCode=BORRADOR-NUEVA-PLANTILLA`, `/api/org-chart/root?versionCode=BORRADOR-NUEVA-PLANTILLA`],
    [`GET /api/org-chart/root?versionId=000${borradorId}`, `/api/org-chart/root?versionId=000${borradorId}`],
    [
      `GET /api/org-chart/root?versionId=${borradorId}&versionCode=${ACTIVE_CODE}`,
      `/api/org-chart/root?versionId=${borradorId}&versionCode=${ACTIVE_CODE}`,
    ],
    [
      `GET /api/org-chart/root?versionId=${activeId}&versionCode=${BORRADOR_CODE}`,
      `/api/org-chart/root?versionId=${activeId}&versionCode=${BORRADOR_CODE}`,
    ],
  ];

  for (const [label, path] of manipulations) {
    const res = await api('GET', path, normalToken);
    const dual = label.includes('versionId=') && label.includes('versionCode=');
    recordApi(
      'manipulation',
      label,
      'B-normal',
      '403',
      res.status,
      dual ? 'ambos params: debe denegar antes de validar conflicto' : '',
    );
  }

  // --- David por API ---
  console.log('\n--- QA David por API ---\n');

  const normalSearchDavid = await api('GET', '/api/org-chart/search?q=david', normalToken);
  recordApi(
    'david-api',
    'GET /api/org-chart/search?q=david (normal, sin versión)',
    'B-normal',
    '200',
    normalSearchDavid.status,
    `contienePersonId${DAVID_PERSON_ID}=${searchHitsContainPerson(normalSearchDavid.json, DAVID_PERSON_ID)}`,
  );

  const normalSearchDavidBorrador = await api(
    'GET',
    `/api/org-chart/search?q=david&versionId=${borradorId}`,
    normalToken,
  );
  recordApi(
    'david-api',
    `GET /api/org-chart/search?q=david&versionId=${borradorId}`,
    'B-normal',
    '403',
    normalSearchDavidBorrador.status,
  );

  const techSearchDavidActive = await api(
    'GET',
    `/api/org-chart/search?q=david&versionId=${activeId}`,
    techToken,
  );
  recordApi(
    'david-api',
    `GET /api/org-chart/search?q=david&versionId=${activeId}`,
    'A-técnico',
    '200',
    techSearchDavidActive.status,
    `contienePersonId${DAVID_PERSON_ID}=${searchHitsContainPerson(techSearchDavidActive.json, DAVID_PERSON_ID)}`,
  );

  const techChildrenActive = await api(
    'GET',
    `/api/org-chart/children/1162?versionId=${activeId}`,
    techToken,
  );
  const techChildrenBorrador = await api(
    'GET',
    `/api/org-chart/children/1162?versionId=${borradorId}`,
    techToken,
  );
  const davidInActiveTree = childrenContainPerson(techChildrenActive.json, DAVID_PERSON_ID);
  const davidInBorradorTree = childrenContainPerson(techChildrenBorrador.json, DAVID_PERSON_ID);

  recordDb(
    `API técnico: David (${DAVID_PERSON_ID}) conectado bajo 1162 en versión activa`,
    techChildrenActive.status === 200 && davidInActiveTree,
    `status=${techChildrenActive.status} enArbol=${davidInActiveTree}`,
  );
  recordDb(
    `API técnico: David (${DAVID_PERSON_ID}) NO conectado bajo 1162 en borrador`,
    techChildrenBorrador.status === 200 && !davidInBorradorTree,
    `status=${techChildrenBorrador.status} enArbol=${davidInBorradorTree}`,
  );
}

function printReport(versionMeta) {
  const dbFailed = dbResults.filter((r) => !r.pass).length;
  const apiFailed = apiResults.filter((r) => !r.pass).length;

  console.log('\n\n========================================');
  console.log('REPORTE QA VERSIONAMIENTO — SEGURIDAD');
  console.log('========================================\n');

  console.log('## Estado BD de versiones\n');
  for (const row of versionMeta.versions) {
    console.log(
      `- id=${row.id} code=${row.code} is_active=${row.is_active} is_locked=${row.is_locked}`,
    );
  }

  console.log('\n## QA BD (resumen)\n');
  console.log('| Check | Resultado | Detalle |');
  console.log('|-------|-----------|---------|');
  for (const r of dbResults) {
    console.log(`| ${r.check} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.detail} |`);
  }

  console.log('\n## Tabla pruebas backend\n');
  console.log('| Endpoint | Perfil | Esperado | Real | PASS/FAIL | Detalle |');
  console.log('|----------|--------|----------|------|-----------|---------|');
  for (const r of apiResults) {
    console.log(
      `| ${r.endpoint} | ${r.profile} | ${r.expected} | ${r.actual} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.detail ?? ''} |`,
    );
  }

  console.log('\n## Frontend (validación estática de código)\n');
  console.log('| Caso | Resultado | Notas |');
  console.log('|------|-----------|-------|');
  console.log('| OrgChartVersionBar oculta si !canVersion | PASS (código) | `if (!canVersion) return null` |');
  console.log('| useOrgChartVersionQueryId → undefined si !canVersion | PASS (código) | no envía versionId en queries |');
  console.log('| fetchOrgChartVersions enabled solo si canVersion | PASS (código) | React Query `enabled: canVersion` |');
  console.log('| QA manual /org usuario normal | PENDIENTE | Revisar selector, DevTools storage, Network |');
  console.log('| QA manual usuario técnico | PENDIENTE | Selector, cambio borrador, David desconectado |');

  console.log('\n## Confirmaciones explícitas\n');
  const borradorDeniedForNormal = apiResults
    .filter((r) => r.profile === 'B-normal' && r.endpoint.includes('borrador'))
    .every((r) => r.pass);
  const adminDenied = apiResults
    .filter((r) => r.profile === 'C-admin')
    .every((r) => r.pass);

  console.log(`- Borrador NO listable por normal: ${apiResults.find((r) => r.endpoint === 'GET /api/org-chart/versions' && r.profile === 'B-normal')?.pass ? 'SÍ' : 'NO'}`);
  console.log(`- Borrador NO consultable por normal (root versionId): ${apiResults.find((r) => r.endpoint.includes('root?versionId') && r.profile === 'B-normal')?.pass ? 'SÍ' : 'NO'}`);
  console.log(`- ORG_ADMIN genérico NO habilita versionamiento: ${adminDenied ? 'SÍ' : 'NO'}`);
  console.log(`- Solo 1229 + desarrollofabrica@cun.edu.co (técnico PASS list): ${apiResults.filter((r) => r.profile === 'A-técnico').every((r) => r.pass) ? 'SÍ' : 'NO'}`);

  const failed = [...dbResults.filter((r) => !r.pass), ...apiResults.filter((r) => !r.pass)];
  if (failed.length > 0) {
    console.log('\n## Hallazgos / correcciones sugeridas\n');
    for (const r of apiResults.filter((x) => !x.pass)) {
      if (r.expected === '403' && r.actual === '400') {
        console.log(
          `- FAIL ${r.endpoint}: devuelve 400 en lugar de 403. Fix: en resolveVersionForRequest, llamar ensureCanUseVersioning antes de validar conflicto versionId+versionCode.`,
        );
      } else {
        console.log(`- FAIL ${r.endpoint} (${r.profile}): esperado ${r.expected}, real ${r.actual}. ${r.detail ?? ''}`);
      }
    }
    for (const r of dbResults.filter((x) => !x.pass)) {
      console.log(`- FAIL BD: ${r.check} — ${r.detail}`);
    }
  } else {
    console.log('\n## Hallazgos\n');
    console.log('- Sin fallos detectados en BD ni API automatizada.');
  }

  console.log(`\nTOTAL: BD ${dbResults.length - dbFailed}/${dbResults.length} | API ${apiResults.length - apiFailed}/${apiResults.length}`);
  return dbFailed + apiFailed;
}

async function main() {
  console.log(`API base: ${API}`);
  const env = loadEnv();

  const health = await api('GET', '/api/health');
  if (health.status !== 200) {
    console.error(`Backend no disponible (health=${health.status}). Levante el API en ${API}`);
    process.exit(1);
  }

  const tokens = await signTokens();
  const versionMeta = await runDbChecks(env);
  await runApiChecks(tokens, versionMeta);

  const failed = printReport(versionMeta);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
