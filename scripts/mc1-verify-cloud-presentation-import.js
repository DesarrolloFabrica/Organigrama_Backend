/**
 * Verify Cloud presentation store after import.
 *   node scripts/mc1-verify-cloud-presentation-import.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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

(async () => {
  const e = loadEnv(path.join(__dirname, '..', '.env'));
  const c = new Client({
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
  await c.connect();
  const rows = await c.query(`
    SELECT person_id::text,
           is_active,
           config_fingerprint,
           payload_json->>'status' AS status,
           payload_json->>'source' AS source,
           jsonb_array_length(payload_json->'fields') AS field_count,
           length(config_fingerprint) AS fp_len
      FROM organigrama.mc1_person_profile_presentation
     WHERE is_active = TRUE
     ORDER BY person_id::bigint
  `);
  const dup = await c.query(`
    SELECT person_id::text, count(*)::int AS n
      FROM organigrama.mc1_person_profile_presentation
     WHERE is_active = TRUE
     GROUP BY person_id
    HAVING count(*) > 1
  `);
  const report = {
    activeRows: rows.rows.length,
    uniquePersonIds: new Set(rows.rows.map((r) => r.person_id)).size,
    duplicateActive: dup.rows,
    allAvailable: rows.rows.every((r) => r.status === 'AVAILABLE'),
    allCloudSource: rows.rows.every(
      (r) => r.source === 'CLOUD_PRESENTATION_STORE',
    ),
    allFingerprint: rows.rows.every((r) => Number(r.fp_len) > 0),
    allActive: rows.rows.every((r) => r.is_active === true),
    rows: rows.rows,
  };
  console.log(JSON.stringify(report, null, 2));
  await c.end();
  if (
    !report.allAvailable ||
    !report.allCloudSource ||
    !report.allFingerprint ||
    report.duplicateActive.length ||
    report.activeRows !== report.uniquePersonIds
  ) {
    process.exit(1);
  }
})().catch((e) => {
  console.error(String(e.message || e).slice(0, 400));
  process.exit(1);
});
