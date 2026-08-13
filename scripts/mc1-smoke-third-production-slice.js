/**
 * Smoke API producción — tercer slice MC1 + competency people search.
 *   node scripts/mc1-smoke-third-production-slice.js
 */
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const API =
  'https://organigrama-backend-550902908078.us-central1.run.app';

const TARGETS = [
  { personId: '1297', label: 'Aura', expectField: 'EDUCATION' },
  { personId: '1084', label: 'Jimmy', expectField: 'FINANCE_ADMIN' },
  { personId: '1085', label: 'Pedro', expectField: 'EDUCATION' },
  { personId: '1102', label: 'Clara', expectField: 'EDUCATION' },
  { personId: '1107', label: 'David', expectField: 'EDUCATION' },
  { personId: '1116', label: 'Christian', expectField: 'EDUCATION' },
  { personId: '1118', label: 'Lizeth', expectField: 'EDUCATION' },
  { personId: '1121', label: 'Lorena', expectField: 'EDUCATION' },
];

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

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${sig}`;
}

function getCloudJwtSecret() {
  const raw = execSync(
    'gcloud run services describe organigrama-backend --project=it-fab-contenido-edu-5 --region=us-central1 --format=json',
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  const j = JSON.parse(raw);
  const env = j.spec?.template?.spec?.containers?.[0]?.env || [];
  const hit = env.find((e) => e.name === 'AUTH_JWT_SECRET');
  if (!hit?.value) throw new Error('AUTH_JWT_SECRET_MISSING');
  return hit.value;
}

async function fetchJson(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body };
}

(async () => {
  const e = loadEnv(path.join(__dirname, '..', '.env'));
  const cloud = new Client({
    host: e.DB_HOST,
    port: Number(e.DB_PORT || 5432),
    database: e.DB_NAME,
    user: e.DB_USERNAME,
    password: e.DB_PASSWORD,
    ssl:
      String(e.DB_SSL).toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });
  await cloud.connect();
  const viewer = (
    await cloud.query(
      `SELECT id::text AS person_id, edu_email, full_name
         FROM core.person
        WHERE LOWER(edu_email) = LOWER($1)
           OR LOWER(edu_email) LIKE 'desarrollofabrica%'
        ORDER BY id
        LIMIT 1`,
      ['desarrollofabrica@cun.edu.co'],
    )
  ).rows[0];
  if (!viewer) throw new Error('VIEWER_NOT_FOUND');

  const secret = getCloudJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    {
      personId: String(viewer.person_id),
      googleSubject: 'smoke-mc1-third-slice',
      googleEmail: viewer.edu_email,
      eduEmail: viewer.edu_email,
      permissions: ['ORG_READ_ALL', 'ORG_ADMIN'],
      iat: now,
      exp: now + 15 * 60,
    },
    secret,
  );

  const profileResults = [];
  for (const t of TARGETS) {
    const { status, body } = await fetchJson(
      `${API}/api/org-chart/person/${t.personId}/competencies/professional-profile`,
      token,
    );
    const mc1 = body?.mc1Profile ?? body?.presentation ?? null;
    const fields = mc1?.fields || [];
    const codes = fields.map((f) => f.code || f.fieldCode).filter(Boolean);
    const source = mc1?.source || null;
    const ok =
      status === 200 &&
      mc1?.status === 'AVAILABLE' &&
      codes.includes(t.expectField) &&
      source === 'CLOUD_PRESENTATION_STORE';
    profileResults.push({
      ...t,
      http: status,
      ok,
      source,
      status: mc1?.status ?? null,
      fieldCodes: codes,
    });
  }

  const searchEmpty = await fetchJson(
    `${API}/api/org-chart/competency-people-search`,
    token,
  );
  const searchEdu = await fetchJson(
    `${API}/api/org-chart/competency-people-search?domain=EDUCATION`,
    token,
  );

  const report = {
    decision: 'MC1_THIRD_PRODUCTION_SLICE_SMOKE',
    backendRevision: 'organigrama-backend-00095-5ss',
    frontendRevision: 'organigrama-frontend-00046-6bh',
    tag: '20260812-101519',
    profiles: profileResults,
    profilesOk: profileResults.filter((r) => r.ok).length,
    profilesTotal: profileResults.length,
    search: {
      emptyHttp: searchEmpty.status,
      emptyOk:
        searchEmpty.status === 200 &&
        Array.isArray(searchEmpty.body?.facets?.domains) &&
        searchEmpty.body.facets.domains.length > 0,
      eduHttp: searchEdu.status,
      eduTotal: searchEdu.body?.total ?? null,
      eduPeople: searchEdu.body?.people?.length ?? null,
      eduOk:
        searchEdu.status === 200 &&
        Number(searchEdu.body?.total ?? 0) > 0 &&
        Array.isArray(searchEdu.body?.people),
      samplePersonIds: (searchEdu.body?.people || [])
        .slice(0, 5)
        .map((p) => p.personId),
    },
  };

  const outDir = path.join(__dirname, '..', 'tmp', 'mc1-third-production-slice');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'smoke-report.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  );
  console.log(JSON.stringify(report, null, 2));
  await cloud.end();

  if (
    report.profilesOk !== report.profilesTotal ||
    !report.search.emptyOk ||
    !report.search.eduOk
  ) {
    process.exit(1);
  }
})().catch((err) => {
  console.error(String(err?.stack || err).slice(0, 800));
  process.exit(1);
});
