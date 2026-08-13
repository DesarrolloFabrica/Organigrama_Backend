/**
 * Inspección amplia de relaciones visuales de Alberto (1352) y homónimos.
 *   node scripts/mc1-pd-inspect-relations.js
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

  const tables = await c.query(`
    SELECT table_schema, table_name
      FROM information_schema.tables
     WHERE table_schema NOT IN ('pg_catalog','information_schema')
       AND (table_name ILIKE '%visual%'
         OR table_name ILIKE '%version%'
         OR table_name ILIKE '%org_%')
     ORDER BY 1,2
  `);

  const versionTables = tables.rows.filter((t) =>
    /version|visual/i.test(t.table_name),
  );

  const out = { versionTables, versions: [], allRelations1352: [], homonyms: [], grandchildren: [], currentVersion: null };

  for (const t of versionTables) {
    const cols = await c.query(
      `SELECT column_name, data_type
         FROM information_schema.columns
        WHERE table_schema=$1 AND table_name=$2
        ORDER BY ordinal_position`,
      [t.table_schema, t.table_name],
    );
    out.versions.push({
      table: `${t.table_schema}.${t.table_name}`,
      columns: cols.rows.map((r) => r.column_name),
    });
  }

  // try common current-version tables
  for (const t of versionTables) {
    const full = `${t.table_schema}.${t.table_name}`;
    if (!/version/i.test(t.table_name)) continue;
    try {
      const rows = await c.query(`SELECT * FROM ${full} ORDER BY 1 DESC LIMIT 20`);
      out[`sample_${full.replace('.', '_')}`] = rows.rows;
    } catch (e) {
      out[`sample_err_${full.replace('.', '_')}`] = String(e.message).slice(0, 200);
    }
  }

  const allR = await c.query(`
    SELECT r.version_id::text, r.is_active AS rel_active,
           p.is_active AS child_active, p.id::text AS child_id,
           p.full_name, ro.name AS role_name
      FROM organigrama.org_visual_relation r
      JOIN core.person p ON p.id = r.child_person_id
      LEFT JOIN core.role ro ON ro.id = p.role_id
     WHERE r.parent_person_id = 1352
     ORDER BY r.version_id DESC, r.is_active DESC, p.full_name
  `);
  out.allRelations1352 = allR.rows;

  const hom = await c.query(`
    SELECT p.id::text, p.full_name, p.document, p.is_active, ro.name AS role_name
      FROM core.person p
      LEFT JOIN core.role ro ON ro.id = p.role_id
     WHERE p.full_name ILIKE '%Alberto%'
        OR p.full_name ILIKE '%Valencia%'
        OR ro.name ILIKE '%DESARROLLO PROFESIONAL%'
     ORDER BY p.id
  `);
  out.homonyms = hom.rows;

  const gc = await c.query(`
    WITH direct AS (
      SELECT DISTINCT child_person_id
        FROM organigrama.org_visual_relation
       WHERE parent_person_id = 1352 AND is_active = true AND version_id = 4
    )
    SELECT COUNT(DISTINCT r.child_person_id)::int AS grandchildren_active
      FROM organigrama.org_visual_relation r
      JOIN core.person p ON p.id = r.child_person_id AND p.is_active = true
     WHERE r.parent_person_id IN (SELECT child_person_id FROM direct)
       AND r.is_active = true
       AND r.version_id = 4
  `);
  out.grandchildren = gc.rows[0];

  // counts per parent named desarrollo profesional / alberto-like
  const otherParents = await c.query(`
    SELECT p.id::text AS parent_id, p.full_name, ro.name AS role_name,
           r.version_id::text,
           COUNT(DISTINCT r.child_person_id) FILTER (WHERE r.is_active AND ch.is_active)::int AS active_children
      FROM organigrama.org_visual_relation r
      JOIN core.person p ON p.id = r.parent_person_id
      JOIN core.person ch ON ch.id = r.child_person_id
      LEFT JOIN core.role ro ON ro.id = p.role_id
     WHERE ro.name ILIKE '%DESARROLLO PROFESIONAL%'
        OR p.full_name ILIKE '%Valencia%Zableh%'
        OR p.full_name ILIKE '%Alberto Mario%'
     GROUP BY p.id, p.full_name, ro.name, r.version_id
     ORDER BY active_children DESC
  `);
  out.otherParents = otherParents.rows;

  const outDir = path.join(__dirname, '..', 'tmp', 'mc1-pd-cohort');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'inspect-relations.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({
    versionTables: out.versions,
    allRelations1352Count: out.allRelations1352.length,
    allRelations1352: out.allRelations1352,
    grandchildren: out.grandchildren,
    otherParents: out.otherParents,
    homonyms: out.homonyms,
  }, null, 2));
  await c.end();
})().catch((e) => {
  console.error(String(e.stack || e).slice(0, 800));
  process.exit(1);
});
