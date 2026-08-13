/**
 * Lookup Haider Yesid Bello Melo + org children for branch coverage.
 *   node scripts/mc1-haider-lookup.js
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
  const root = loadEnv(path.join(__dirname, '..', '.env'));
  const c = new Client({
    host: root.DB_HOST,
    port: Number(root.DB_PORT || 5432),
    database: root.DB_NAME,
    user: root.DB_USERNAME,
    password: root.DB_PASSWORD,
    ssl:
      String(root.DB_SSL).toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });
  await c.connect();

  const people = await c.query(
    `
    SELECT p.id::text AS person_id, p.full_name, p.document,
           pc.id AS person_cv_id, pc.drive_file_id, pc.mime_type,
           pc.drive_file_name, pc.is_active AS cv_active
      FROM core.person p
      LEFT JOIN organigrama.person_cv pc
        ON pc.person_id = p.id AND pc.is_active = true
     WHERE p.full_name ILIKE '%Haider%Bello%'
        OR p.full_name ILIKE '%Haider%Yesid%'
        OR p.full_name ILIKE '%Bello Melo%'
     ORDER BY p.id
    `,
  );

  const haider = people.rows.find((r) =>
    /haider/i.test(r.full_name || ''),
  );
  let children = [];
  if (haider) {
    const rel = await c.query(
      `
      SELECT r.child_person_id::text AS child_id, p.full_name, r.is_active,
             pc.id AS person_cv_id, pc.mime_type, pc.drive_file_id
        FROM organigrama.org_visual_relation r
        JOIN core.person p ON p.id = r.child_person_id
        LEFT JOIN organigrama.person_cv pc
          ON pc.person_id = p.id AND pc.is_active = true
       WHERE r.parent_person_id = $1
       ORDER BY r.child_person_id
      `,
      [Number(haider.person_id)],
    );
    children = rel.rows;
  }

  console.log(
    JSON.stringify(
      { cloudWrites: 0, people: people.rows, haider, children },
      null,
      2,
    ),
  );
  await c.end();
})().catch((e) => {
  console.error('LOOKUP_FAIL', String(e.message || e).slice(0, 800));
  process.exit(1);
});
