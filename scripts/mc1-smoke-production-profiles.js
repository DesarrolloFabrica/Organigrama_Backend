/**
 * Smoke API producción — professional-profile (rama Haider).
 * Minta JWT corto con AUTH_JWT_SECRET de Cloud Run (no imprime el secreto).
 *
 *   node scripts/mc1-smoke-production-profiles.js
 */
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const API =
  'https://organigrama-backend-550902908078.us-central1.run.app';

const TARGETS = [
  { personId: '49', label: 'Haider', expectField: 'DATA_ANALYTICS' },
  { personId: '52', label: 'Sara', expectField: 'DATA_ANALYTICS' },
  { personId: '1307', label: 'Natalia VD', expectField: 'VISUAL_DESIGN' },
  { personId: '1305', label: 'Victor AV', expectField: 'AUDIOVISUAL_PRODUCTION' },
  { personId: '1210', label: 'Maria EDU', expectField: 'EDUCATION' },
  { personId: '1', label: 'Camilo SE', expectField: 'SOFTWARE_ENGINEERING' },
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
  await cloud.end();
  if (!viewer) throw new Error('VIEWER_PERSON_NOT_FOUND');

  const secret = getCloudJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    {
      personId: String(viewer.person_id),
      googleSubject: 'smoke-mc1-production',
      googleEmail: viewer.edu_email,
      eduEmail: viewer.edu_email,
      permissions: ['ORG_READ_ALL', 'ORG_ADMIN'],
      iat: now,
      exp: now + 15 * 60,
    },
    secret,
  );

  const results = [];
  for (const t of TARGETS) {
    const url = `${API}/api/org-chart/person/${t.personId}/competencies/professional-profile`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 200) };
    }
    const mc1 = body?.mc1Profile ?? body?.presentation ?? null;
    const fields = mc1?.fields ?? [];
    const fieldCodes = fields.map((f) => f.code);
    const weakPublic = JSON.stringify(fields).includes('"status":"WEAK"');
    const skills = fields.flatMap((f) =>
      (f.specialties ?? []).flatMap((s) => s.skills ?? []),
    );
    const tools = fields.flatMap((f) => f.tools ?? []);
    const radarDims = fields.flatMap(
      (f) => f.competencyMap?.dimensions ?? [],
    );
    results.push({
      personId: t.personId,
      label: t.label,
      http: res.status,
      status: mc1?.status ?? body?.availabilityStatus ?? null,
      source: mc1?.source ?? null,
      fieldCodes,
      hasExpectedField: fieldCodes.includes(t.expectField),
      specialtyCount: fields.reduce(
        (n, f) => n + (f.specialties?.length ?? 0),
        0,
      ),
      skillCount: skills.length,
      toolCount: tools.length,
      radarAxisCount: radarDims.length,
      noWeakPublic: !weakPublic,
      noArtifactOnly: mc1?.source !== 'ARTIFACT_ONLY_LOCAL',
      ok:
        res.status === 200 &&
        mc1?.status === 'AVAILABLE' &&
        mc1?.source === 'CLOUD_PRESENTATION_STORE' &&
        fieldCodes.includes(t.expectField) &&
        !weakPublic,
    });
  }

  const report = {
    viewerPersonId: viewer.person_id,
    backendRevision: 'organigrama-backend-00094-h6p',
    allOk: results.every((r) => r.ok),
    results,
  };
  fs.mkdirSync(path.join(__dirname, '..', 'tmp', 'mc1-haider-profile'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(
      __dirname,
      '..',
      'tmp',
      'mc1-haider-profile',
      'smoke-production-api.json',
    ),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.allOk) process.exit(1);
})().catch((e) => {
  console.error(
    JSON.stringify({
      status: 'FAILED',
      error: String(e.message || e).slice(0, 400),
    }),
  );
  process.exit(1);
});
