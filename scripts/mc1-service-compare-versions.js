/**
 * Compara versiones visuales para Ingrid 1145.
 *   node scripts/mc1-service-compare-versions.js
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

  let versionMeta = null;
  try {
    versionMeta = await c.query(
      `SELECT id::text, name, is_active, is_published, created_at, updated_at
         FROM organigrama.org_visual_version ORDER BY id`,
    );
  } catch (e) {
    versionMeta = { error: String(e.message || e), rows: [] };
  }

  const byVersion = await c.query(
    `SELECT r.version_id::text AS version_id,
            COUNT(*)::int AS rels,
            COUNT(*) FILTER (WHERE r.is_active)::int AS active_rels,
            COUNT(DISTINCT r.child_person_id)::int AS distinct_children,
            COUNT(DISTINCT r.child_person_id) FILTER (
              WHERE r.is_active AND p.is_active
            )::int AS active_person_children
       FROM organigrama.org_visual_relation r
       JOIN core.person p ON p.id = r.child_person_id
      WHERE r.parent_person_id = 1145
      GROUP BY r.version_id
      ORDER BY r.version_id`,
  );

  const v4 = await c.query(
    `SELECT DISTINCT ON (r.child_person_id)
            r.child_person_id::text AS child_id,
            p.full_name,
            p.document,
            p.is_active AS person_active,
            r.is_active AS rel_active,
            pc.id::text AS cv_id
       FROM organigrama.org_visual_relation r
       JOIN core.person p ON p.id = r.child_person_id
       LEFT JOIN organigrama.person_cv pc ON pc.person_id = p.id AND pc.is_active
      WHERE r.parent_person_id = 1145
        AND r.version_id = 4
        AND r.is_active = true
        AND p.is_active = true
      ORDER BY r.child_person_id`,
  );

  const v3 = await c.query(
    `SELECT DISTINCT ON (r.child_person_id)
            r.child_person_id::text AS child_id,
            p.full_name,
            p.document,
            pc.id::text AS cv_id
       FROM organigrama.org_visual_relation r
       JOIN core.person p ON p.id = r.child_person_id AND p.is_active
       LEFT JOIN organigrama.person_cv pc ON pc.person_id = p.id AND pc.is_active
      WHERE r.parent_person_id = 1145
        AND r.version_id = 3
        AND r.is_active = true
      ORDER BY r.child_person_id`,
  );

  // How org-chart resolves published version
  let published = null;
  try {
    published = await c.query(
      `SELECT id::text, name, is_active, is_published
         FROM organigrama.org_visual_version
        WHERE is_published = true OR is_active = true
        ORDER BY is_published DESC, is_active DESC, id DESC`,
    );
  } catch (e) {
    published = { error: String(e.message || e) };
  }

  const out = {
    versionMeta: versionMeta.rows || versionMeta,
    byVersion: byVersion.rows,
    published: published.rows || published,
    v4Children: v4.rows,
    v4Count: v4.rows.length,
    v3Count: v3.rows.length,
    v3Only: v3.rows
      .filter((a) => !v4.rows.some((b) => b.child_id === a.child_id))
      .map((r) => ({ id: r.child_id, name: r.full_name })),
    v4Only: v4.rows
      .filter((a) => !v3.rows.some((b) => b.child_id === a.child_id))
      .map((r) => ({ id: r.child_id, name: r.full_name })),
  };
  fs.mkdirSync(path.join(__dirname, '..', 'tmp', 'mc1-service-cohort'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(__dirname, '..', 'tmp', 'mc1-service-cohort', 'versions.json'),
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
