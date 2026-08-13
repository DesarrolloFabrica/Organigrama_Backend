/**
 * Inspección relaciones Ingrid 1145 vs organigrama visible.
 *   node scripts/mc1-service-inspect-relations.js
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

  const cols = await c.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema='organigrama' AND table_name='org_visual_relation'
      ORDER BY ordinal_position`,
  );

  const rel = await c.query(
    `SELECT r.id::text AS relation_id,
            r.child_person_id::text AS child_id,
            r.parent_person_id::text AS parent_id,
            r.is_active AS rel_active,
            r.relation_type,
            p.full_name,
            COALESCE(p.is_active, true) AS person_active,
            p.document,
            pc.id::text AS active_cv_id
       FROM organigrama.org_visual_relation r
       JOIN core.person p ON p.id = r.child_person_id
       LEFT JOIN organigrama.person_cv pc
         ON pc.person_id = p.id AND pc.is_active = true
      WHERE r.parent_person_id = 1145
      ORDER BY r.child_person_id, r.id`,
  );

  // Check if person has role/position labels
  const roleTables = await c.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='organigrama'
        AND (table_name ILIKE '%role%' OR table_name ILIKE '%position%'
             OR table_name ILIKE '%assignment%' OR table_name ILIKE '%visual%')
      ORDER BY table_name`,
  );

  const activeRel = rel.rows.filter((r) => r.rel_active !== false);
  const activePerson = activeRel.filter((r) => r.person_active !== false);
  const withDoc = activePerson.filter((r) => !!r.document);
  const withCv = activePerson.filter((r) => !!r.active_cv_id);

  const out = {
    columns: cols.rows,
    roleTables: roleTables.rows.map((r) => r.table_name),
    totalRelations: rel.rows.length,
    activeRelations: activeRel.length,
    activePersons: activePerson.length,
    withDocument: withDoc.length,
    withActiveCv: withCv.length,
    rows: rel.rows,
    filteredWithDoc: withDoc.map((r) => ({
      child_id: r.child_id,
      full_name: r.full_name,
      active_cv_id: r.active_cv_id,
      relation_type: r.relation_type,
    })),
  };
  const outDir = path.join(__dirname, '..', 'tmp', 'mc1-service-cohort');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'relations-inspect.json'),
    JSON.stringify(out, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        columns: cols.rows.map((c) => c.column_name),
        roleTables: out.roleTables,
        totalRelations: out.totalRelations,
        activeRelations: out.activeRelations,
        activePersons: out.activePersons,
        withDocument: out.withDocument,
        withActiveCv: out.withActiveCv,
        filteredWithDoc: out.filteredWithDoc,
      },
      null,
      2,
    ),
  );
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
