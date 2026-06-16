const fs = require('node:fs');
const pg = require('pg');
const raw = fs.readFileSync('.env', 'utf8');
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
(async () => {
  const c = new pg.Client({
    host: env.DB_HOST,
    port: 5432,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const q = await c.query(`
    SELECT r.id, r.version_id, v.code,
      r.parent_person_id, parent_p.full_name AS parent_name, parent_p.is_active AS parent_ok,
      r.child_person_id, child_p.full_name AS child_name, child_p.is_active AS child_ok
    FROM organigrama.org_visual_relation r
    JOIN organigrama.org_chart_version v ON v.id = r.version_id
    LEFT JOIN core.person parent_p ON parent_p.id = r.parent_person_id
    LEFT JOIN core.person child_p ON child_p.id = r.child_person_id
    WHERE parent_p.id IS NULL OR child_p.id IS NULL
  `);
  console.table(q.rows);
  const rt = await c.query(`
    SELECT relation_type, COUNT(*)::int cnt
    FROM organigrama.org_visual_relation r
    JOIN organigrama.org_chart_version v ON v.id = r.version_id AND v.code = 'current'
    WHERE r.is_active = true GROUP BY relation_type
  `);
  console.log('relation_types:', rt.rows);
  await c.end();
})();
