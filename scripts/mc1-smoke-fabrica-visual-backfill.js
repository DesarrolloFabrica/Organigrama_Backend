/**
 * Read-only post-import verification for the Fábrica Visual Design backfill.
 *
 *   node scripts/mc1-smoke-fabrica-visual-backfill.js
 */
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const API = 'https://organigrama-backend-550902908078.us-central1.run.app';
const PARENT_PERSON_ID = '1206';
const TARGETS = [
  '1163',
  '1164',
  '1166',
  '1167',
  '1168',
  '1169',
  '1170',
  '1175',
  '1176',
  '1179',
  '1182',
  '1184',
  '1186',
  '1188',
  '1190',
];

function loadEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    out[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function latestBatch() {
  const dir = path.join(ROOT, 'tmp', 'mc1-fabrica-visual-backfill');
  const files = fs
    .readdirSync(dir)
    .filter((name) =>
      /^mc1-fabrica-visual-presentation-backfill-.*\.json$/.test(name),
    )
    .map((name) => ({
      path: path.join(dir, name),
      modifiedAt: fs.statSync(path.join(dir, name)).mtimeMs,
    }))
    .sort((left, right) => right.modifiedAt - left.modifiedAt);
  if (!files[0]) throw new Error('BACKFILL_BATCH_NOT_FOUND');
  return files[0].path;
}

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify(payload));
  const unsigned = `${header}.${body}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(unsigned)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${unsigned}.${signature}`;
}

function cloudJwtSecret() {
  const raw = execSync(
    'gcloud run services describe organigrama-backend --project=it-fab-contenido-edu-5 --region=us-central1 --format=json',
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  const service = JSON.parse(raw);
  const variables = service.spec?.template?.spec?.containers?.[0]?.env ?? [];
  const entry = variables.find(
    (variable) => variable.name === 'AUTH_JWT_SECRET',
  );
  if (!entry?.value) throw new Error('AUTH_JWT_SECRET_MISSING');
  return entry.value;
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { invalidJson: true, preview: text.slice(0, 160) };
  }
  return { status: response.status, body };
}

(async () => {
  const batchPath = latestBatch();
  const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
  const fingerprints = new Map(
    batch.profiles.map((profile) => [
      String(profile.personId),
      String(profile.configFingerprint),
    ]),
  );
  const env = loadEnv(path.join(ROOT, '.env'));
  const cloud = new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    database: env.DB_NAME,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    ssl:
      String(env.DB_SSL).toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });
  await cloud.connect();

  try {
    const viewer = (
      await cloud.query(
        `SELECT id::text AS person_id, edu_email
           FROM core.person
          WHERE LOWER(edu_email) = LOWER($1)
             OR LOWER(edu_email) LIKE 'desarrollofabrica%'
          ORDER BY id
          LIMIT 1`,
        ['desarrollofabrica@cun.edu.co'],
      )
    ).rows[0];
    if (!viewer) throw new Error('VIEWER_NOT_FOUND');

    const targetRows = (
      await cloud.query(
        `
        SELECT m.id::text AS presentation_id,
               m.person_id::text,
               p.full_name,
               m.config_fingerprint,
               m.produced_at,
               m.imported_at,
               m.payload_json->>'status' AS status,
               m.payload_json->>'source' AS source,
               COUNT(*) OVER (PARTITION BY m.person_id)::int AS active_rows_for_person,
               EXISTS (
                 SELECT 1
                   FROM jsonb_array_elements(m.payload_json->'fields') field
                  WHERE field->>'code' = 'VISUAL_DESIGN'
               ) AS has_visual_design,
               EXISTS (
                 SELECT 1
                   FROM organigrama.org_visual_relation relation
                   JOIN organigrama.org_chart_version version
                     ON version.id = relation.version_id
                    AND version.is_active = TRUE
                  WHERE relation.is_active = TRUE
                    AND relation.parent_person_id = $2::bigint
                    AND relation.child_person_id = m.person_id
               ) AS direct_child_of_fabrica
          FROM organigrama.mc1_person_profile_presentation m
          JOIN core.person p ON p.id = m.person_id AND p.is_active = TRUE
         WHERE m.is_active = TRUE
           AND m.person_id = ANY($1::bigint[])
         ORDER BY m.person_id
        `,
        [TARGETS, PARENT_PERSON_ID],
      )
    ).rows;

    const totals = (
      await cloud.query(
        `
        SELECT COUNT(*) FILTER (WHERE m.is_active = TRUE)::int AS active_profiles,
               COUNT(*) FILTER (
                 WHERE m.is_active = TRUE
                   AND EXISTS (
                     SELECT 1
                       FROM jsonb_array_elements(m.payload_json->'fields') field
                      WHERE field->>'code' = 'VISUAL_DESIGN'
                   )
               )::int AS active_visual_profiles,
               COUNT(*) FILTER (
                 WHERE m.is_active = TRUE
                   AND EXISTS (
                     SELECT 1
                       FROM jsonb_array_elements(m.payload_json->'fields') field
                      WHERE field->>'code' = 'VISUAL_DESIGN'
                   )
                   AND EXISTS (
                     SELECT 1
                       FROM organigrama.org_visual_relation relation
                       JOIN organigrama.org_chart_version version
                         ON version.id = relation.version_id
                        AND version.is_active = TRUE
                      WHERE relation.is_active = TRUE
                        AND relation.parent_person_id = $1::bigint
                        AND relation.child_person_id = m.person_id
                   )
               )::int AS fabrica_visual_profiles
          FROM organigrama.mc1_person_profile_presentation m
        `,
        [PARENT_PERSON_ID],
      )
    ).rows[0];

    const duplicateActive = (
      await cloud.query(`
        SELECT person_id::text, COUNT(*)::int AS row_count
          FROM organigrama.mc1_person_profile_presentation
         WHERE is_active = TRUE
         GROUP BY person_id
        HAVING COUNT(*) > 1
      `)
    ).rows;

    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(
      {
        personId: String(viewer.person_id),
        googleSubject: 'smoke-mc1-fabrica-visual-backfill',
        googleEmail: viewer.edu_email,
        eduEmail: viewer.edu_email,
        permissions: ['ORG_READ_ALL', 'ORG_ADMIN'],
        iat: now,
        exp: now + 15 * 60,
      },
      cloudJwtSecret(),
    );

    const profileChecks = [];
    for (const personId of TARGETS) {
      const response = await fetchJson(
        `${API}/api/org-chart/person/${personId}/competencies/professional-profile`,
        token,
      );
      const presentation =
        response.body?.mc1Profile ?? response.body?.presentation ?? null;
      const fieldCodes = (presentation?.fields ?? []).map(
        (field) => field.code,
      );
      profileChecks.push({
        personId,
        http: response.status,
        status: presentation?.status ?? null,
        source: presentation?.source ?? null,
        fieldCodes,
        ok:
          response.status === 200 &&
          presentation?.status === 'AVAILABLE' &&
          presentation?.source === 'CLOUD_PRESENTATION_STORE' &&
          fieldCodes.includes('VISUAL_DESIGN'),
      });
    }

    const search = await fetchJson(
      `${API}/api/org-chart/competency-people-search?domain=VISUAL_DESIGN&pageSize=50`,
      token,
    );
    const searchPersonIds = (search.body?.people ?? []).map((person) =>
      String(person.personId),
    );
    const missingFromSearch = TARGETS.filter(
      (personId) => !searchPersonIds.includes(personId),
    );

    const dbTargetsOk =
      targetRows.length === TARGETS.length &&
      targetRows.every(
        (row) =>
          row.status === 'AVAILABLE' &&
          row.source === 'CLOUD_PRESENTATION_STORE' &&
          row.has_visual_design === true &&
          row.direct_child_of_fabrica === true &&
          Number(row.active_rows_for_person) === 1 &&
          fingerprints.get(String(row.person_id)) === row.config_fingerprint,
      );
    const apiProfilesOk = profileChecks.every((profile) => profile.ok);
    const searchOk =
      search.status === 200 &&
      Number(search.body?.total) === Number(totals.active_visual_profiles) &&
      missingFromSearch.length === 0;
    const allOk =
      dbTargetsOk &&
      apiProfilesOk &&
      searchOk &&
      duplicateActive.length === 0 &&
      Number(totals.fabrica_visual_profiles) === TARGETS.length;

    const report = {
      decision: 'MC1_FABRICA_VISUAL_BACKFILL_VERIFIED',
      verifiedAt: new Date().toISOString(),
      batchPath,
      allOk,
      database: {
        dbTargetsOk,
        targetCount: targetRows.length,
        activeProfiles: Number(totals.active_profiles),
        activeVisualProfiles: Number(totals.active_visual_profiles),
        fabricaVisualProfiles: Number(totals.fabrica_visual_profiles),
        duplicateActive,
        insertedRows: targetRows.map((row) => ({
          presentationId: row.presentation_id,
          personId: row.person_id,
          fullName: row.full_name,
          configFingerprint: row.config_fingerprint,
          producedAt: row.produced_at,
          importedAt: row.imported_at,
        })),
      },
      api: {
        apiProfilesOk,
        profileChecks,
        searchHttp: search.status,
        searchTotal: search.body?.total ?? null,
        searchReturned: searchPersonIds.length,
        missingFromSearch,
        searchOk,
      },
      rollback: {
        method:
          'Set is_active=FALSE only for the listed presentationId values after rechecking their configFingerprint.',
        presentationIds: targetRows.map((row) => row.presentation_id),
      },
    };
    const outDir = path.join(ROOT, 'tmp', 'mc1-fabrica-visual-backfill');
    const reportPath = path.join(outDir, 'post-import-verification.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(
      JSON.stringify(
        {
          status: allOk ? 'VERIFIED' : 'FAILED',
          reportPath,
          dbTargetsOk,
          apiProfilesOk,
          searchOk,
          targetCount: targetRows.length,
          activeProfiles: Number(totals.active_profiles),
          activeVisualProfiles: Number(totals.active_visual_profiles),
          fabricaVisualProfiles: Number(totals.fabrica_visual_profiles),
          duplicateActive: duplicateActive.length,
          searchHttp: search.status,
          searchTotal: search.body?.total ?? null,
          missingFromSearch,
        },
        null,
        2,
      ),
    );
    if (!allOk) process.exitCode = 1;
  } finally {
    await cloud.end();
  }
})().catch((error) => {
  console.error(
    JSON.stringify({
      status: 'FAILED',
      error: String(error?.stack || error).slice(0, 800),
    }),
  );
  process.exit(1);
});
