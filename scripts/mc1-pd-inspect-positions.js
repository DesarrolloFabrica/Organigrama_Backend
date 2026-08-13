/**
 * Inspección position_child + cargos prácticas/empleabilidad + versión activa.
 *   node scripts/mc1-pd-inspect-positions.js
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

  const chartVersions = await c.query(
    `SELECT id::text, code, name, is_active, is_locked, period_label
       FROM organigrama.org_chart_version
      ORDER BY id DESC`,
  );

  const albertoRels = await c.query(
    `SELECT r.id::text AS relation_id, r.version_id::text, r.is_active,
            r.parent_person_id::text, r.child_person_id::text,
            r.relation_type, r.visual_level
       FROM organigrama.org_visual_relation r
      WHERE r.parent_person_id = 1352 OR r.child_person_id = 1352
      ORDER BY r.version_id, r.id`,
  );

  const posUnderAlbertoRels = await c.query(
    `SELECT pc.id::text, pc.version_id::text, pc.parent_relation_id::text,
            pc.child_person_id::text, pc.relation_type, pc.visual_level,
            pc.is_active, p.full_name, p.is_active AS person_active,
            ro.name AS role_name, pcv.id::text AS person_cv_id
       FROM organigrama.org_visual_relation_position_child pc
       JOIN core.person p ON p.id = pc.child_person_id
       LEFT JOIN core.role ro ON ro.id = p.role_id
       LEFT JOIN organigrama.person_cv pcv
         ON pcv.person_id = p.id AND pcv.is_active = true
      WHERE pc.parent_relation_id IN (
              SELECT r.id FROM organigrama.org_visual_relation r
               WHERE r.parent_person_id = 1352 OR r.child_person_id = 1352
            )
      ORDER BY pc.version_id, p.full_name`,
  );

  const posAnyAlberto = await c.query(
    `SELECT pc.id::text, pc.version_id::text, pc.parent_relation_id::text,
            pc.child_person_id::text, pc.is_active, p.full_name, ro.name AS role_name
       FROM organigrama.org_visual_relation_position_child pc
       JOIN core.person p ON p.id = pc.child_person_id
       LEFT JOIN core.role ro ON ro.id = p.role_id
       JOIN organigrama.org_visual_relation r ON r.id = pc.parent_relation_id
      WHERE r.parent_person_id = 1352
      ORDER BY pc.is_active DESC, p.full_name`,
  );

  const practiceRoles = await c.query(
    `SELECT p.id::text, p.full_name, p.is_active, ro.name AS role_name,
            pc.id::text AS person_cv_id,
            parent.full_name AS visual_parent_name,
            parent.id::text AS visual_parent_id,
            r.version_id::text, r.is_active AS rel_active
       FROM core.person p
       LEFT JOIN core.role ro ON ro.id = p.role_id
       LEFT JOIN organigrama.person_cv pc
         ON pc.person_id = p.id AND pc.is_active = true
       LEFT JOIN organigrama.org_visual_relation r
         ON r.child_person_id = p.id AND r.is_active = true
       LEFT JOIN core.person parent ON parent.id = r.parent_person_id
      WHERE ro.name ILIKE '%PRACTICA%'
         OR ro.name ILIKE '%EMPLEABIL%'
         OR ro.name ILIKE '%APOYO LABORAL%'
         OR ro.name ILIKE '%ORIENTACI%LABOR%'
         OR ro.name ILIKE '%DESARROLLO PROFESIONAL%'
         OR ro.name ILIKE '%PSICOLOG%ORGANIZ%'
         OR ro.name ILIKE '%FACILITADOR%'
      ORDER BY ro.name, p.full_name`,
  );

  const overrides = await c.query(
    `SELECT o.id::text, o.version_id::text, o.relation_id::text,
            o.assignment_status, o.assignment_label, o.is_active,
            ro.name AS role_override, r.parent_person_id::text, r.child_person_id::text,
            p.full_name AS child_name
       FROM organigrama.org_visual_relation_override o
       LEFT JOIN organigrama.org_visual_relation r ON r.id = o.relation_id
       LEFT JOIN core.role ro ON ro.id = o.role_id_override
       LEFT JOIN core.person p ON p.id = r.child_person_id
      WHERE r.parent_person_id = 1352 OR r.child_person_id = 1352
      ORDER BY o.version_id`,
  );

  const out = {
    chartVersions: chartVersions.rows,
    albertoRels: albertoRels.rows,
    posUnderAlbertoRels: posUnderAlbertoRels.rows,
    posAnyAlberto: posAnyAlberto.rows,
    practiceRoles: practiceRoles.rows,
    overrides: overrides.rows,
  };
  const outDir = path.join(__dirname, '..', 'tmp', 'mc1-pd-cohort');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'inspect-positions.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({
    chartVersions: chartVersions.rows,
    albertoRelCount: albertoRels.rows.length,
    posUnderCount: posUnderAlbertoRels.rows.length,
    posAnyAlbertoCount: posAnyAlberto.rows.length,
    posAnyAlberto: posAnyAlberto.rows,
    practiceRoleCount: practiceRoles.rows.length,
    practiceRoles: practiceRoles.rows.map((r) => ({
      id: r.id,
      name: r.full_name,
      role: r.role_name,
      parentId: r.visual_parent_id,
      parent: r.visual_parent_name,
      version: r.version_id,
      relActive: r.rel_active,
      hasCv: !!r.person_cv_id,
    })),
    overrides: overrides.rows,
  }, null, 2));
  await c.end();
})().catch((e) => {
  console.error(String(e.stack || e).slice(0, 1000));
  process.exit(1);
});
