/**
 * Validación de contrato UI (Haider + Sara) desde API Cloud store.
 * Complementa smoke HTTP: comprueba campos que renderiza Mc1PersonCompetenciesView.
 *
 *   node scripts/mc1-visual-contract-haider-sara.js
 */
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const API =
  'https://organigrama-backend-550902908078.us-central1.run.app';

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

function auditProfile(label, body) {
  const mc1 = body?.mc1Profile;
  const issues = [];
  if (!mc1) issues.push('NO_MC1_PROFILE');
  if (mc1?.status !== 'AVAILABLE') issues.push('STATUS_NOT_AVAILABLE');
  if (mc1?.source !== 'CLOUD_PRESENTATION_STORE') {
    issues.push(`SOURCE_${mc1?.source || 'MISSING'}`);
  }
  if (mc1?.source === 'ARTIFACT_ONLY_LOCAL') issues.push('ARTIFACT_ONLY_VISIBLE');
  const fields = mc1?.fields ?? [];
  if (!fields.length) issues.push('NO_FIELDS_TAB');
  for (const f of fields) {
    if (!f.code) issues.push('FIELD_WITHOUT_CODE');
    if (!f.specialties?.length) issues.push(`EMPTY_SPECIALTIES_${f.code}`);
    if (!f.tools) issues.push(`TOOLS_MISSING_${f.code}`);
    const skills = (f.specialties ?? []).flatMap((s) => s.skills ?? []);
    if (!skills.length) issues.push(`NO_SKILLS_${f.code}`);
    const dims = f.competencyMap?.dimensions ?? [];
    if (!dims.length) issues.push(`NO_RADAR_${f.code}`);
    if (/TAXONOMY_PENDING/i.test(JSON.stringify(f))) {
      issues.push(`TAXONOMY_PENDING_${f.code}`);
    }
  }
  const blob = JSON.stringify(mc1 ?? {});
  if (/ARTIFACT_ONLY/i.test(blob)) issues.push('ARTIFACT_ONLY_IN_PAYLOAD');
  if (/"status"\s*:\s*"WEAK"/i.test(blob)) issues.push('WEAK_PUBLIC');

  return {
    label,
    personId: body?.personId ?? null,
    primary: fields[0]?.code ?? null,
    specialties: fields.flatMap((f) =>
      (f.specialties ?? []).map((s) => s.code),
    ),
    skillCount: fields.reduce(
      (n, f) =>
        n +
        (f.specialties ?? []).reduce((m, s) => m + (s.skills?.length ?? 0), 0),
      0,
    ),
    toolCount: fields.reduce((n, f) => n + (f.tools?.length ?? 0), 0),
    radarAxes: (fields[0]?.competencyMap?.dimensions ?? []).map((d) => ({
      code: d.code,
      coverage: d.relativeCoverage,
    })),
    issues,
    ok: issues.length === 0,
  };
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
      `SELECT id::text AS person_id, edu_email FROM core.person
        WHERE LOWER(edu_email) LIKE 'desarrollofabrica%' LIMIT 1`,
    )
  ).rows[0];
  await cloud.end();

  const secret = getCloudJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    {
      personId: String(viewer.person_id),
      googleSubject: 'smoke-mc1-visual',
      googleEmail: viewer.edu_email,
      eduEmail: viewer.edu_email,
      permissions: ['ORG_READ_ALL', 'ORG_ADMIN'],
      iat: now,
      exp: now + 15 * 60,
    },
    secret,
  );

  const out = [];
  for (const [id, label] of [
    ['49', 'Haider'],
    ['52', 'Sara'],
  ]) {
    const res = await fetch(
      `${API}/api/org-chart/person/${id}/competencies/professional-profile`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const body = await res.json();
    out.push({ http: res.status, ...auditProfile(label, body) });
  }

  const feHtml = await (
    await fetch('https://organigrama-frontend-550902908078.us-central1.run.app/')
  ).text();
  const hasCompetencyChunk = /competency-explorer-/i.test(feHtml);
  const hasRadarChunk = /Mc1DimensionRadar-/i.test(feHtml);

  const report = {
    frontendRevision: 'organigrama-frontend-00045-6h4',
    frontendBundle: {
      hasCompetencyChunk,
      hasRadarChunk,
      htmlOk: feHtml.includes('index-'),
    },
    haider: out.find((x) => x.label === 'Haider'),
    sara: out.find((x) => x.label === 'Sara'),
    visualContractOk: out.every((x) => x.ok && x.http === 200),
  };
  fs.writeFileSync(
    path.join(
      __dirname,
      '..',
      'tmp',
      'mc1-haider-profile',
      'visual-contract-haider-sara.json',
    ),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.visualContractOk) process.exit(1);
})().catch((e) => {
  console.error(JSON.stringify({ status: 'FAILED', error: String(e.message || e) }));
  process.exit(1);
});
