/**
 * Lookup Cloud persons for Felipe Guerrero team cohort.
 *   node scripts/mc1-felipe-team-lookup.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function parseEnv(filePath) {
  const o = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith("'") && v.endsWith("'")) ||
      (v.startsWith('"') && v.endsWith('"'))
    ) {
      v = v.slice(1, -1);
    }
    o[line.slice(0, i).trim()] = v;
  }
  return o;
}

(async () => {
  const root = path.join(__dirname, '..');
  const cloud = parseEnv(path.join(root, '.env'));
  const c = new Client({
    host: cloud.DB_HOST,
    port: Number(cloud.DB_PORT),
    user: cloud.DB_USERNAME,
    password: cloud.DB_PASSWORD,
    database: cloud.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const needles = [
    '%Felipe%Guerrero%',
    '%Rodr_guez Hurtado%',
    '%Gonz_lez Cabezas%',
    '%Tinajaca%',
    '%Mart_nez Pe_a%',
    '%Garz_n Ortiz%',
    '%Natalia%Gamba%',
    '%Natalia%Tin%',
  ];

  const people = await c.query(
    `
    SELECT p.id::text AS person_id, p.full_name, p.document,
           pc.id AS person_cv_id, pc.drive_file_id, pc.mime_type, pc.is_active
    FROM core.person p
    LEFT JOIN organigrama.person_cv pc
      ON pc.person_id = p.id AND pc.is_active = true
    WHERE ${needles.map((_, i) => `p.full_name ILIKE $${i + 1}`).join(' OR ')}
    ORDER BY p.full_name
    `,
    needles,
  );
  console.log(JSON.stringify({ people: people.rows }, null, 2));

  const cols = await c.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'organigrama' AND table_name = 'org_visual_relation'
    ORDER BY ordinal_position
  `);
  console.log(JSON.stringify({ relationCols: cols.rows.map((r) => r.column_name) }));

  const sample = await c.query(
    `SELECT * FROM organigrama.org_visual_relation LIMIT 2`,
  );
  console.log(
    JSON.stringify({
      relationSampleKeys: sample.rows[0] ? Object.keys(sample.rows[0]) : [],
      relationSample: sample.rows,
    }),
  );

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
