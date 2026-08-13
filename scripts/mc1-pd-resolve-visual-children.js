/**
 * Resuelve hijos visuales directos de Alberto:
 * - org_visual_relation parent=Alberto (v activa)
 * - org_visual_relation_position_child del slot que Alberto ocupa (Raúl→Alberto)
 *
 *   node scripts/mc1-pd-resolve-visual-children.js
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

function isVacancy(r) {
  const name = String(r.full_name || '').toUpperCase();
  const role = String(r.role_name || '').toUpperCase();
  const doc = String(r.document || '').toUpperCase();
  if (name.includes('VACANTE') || name.startsWith('VACANTE')) return true;
  if (role.includes('VACANTE') || role.includes('PLAZA DISPONIBLE')) return true;
  if (doc.startsWith('VAC-') || doc.startsWith('VACANTE')) return true;
  return false;
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

  const versionId = 4;
  const albertoId = 1352;

  const relChildren = await c.query(
    `SELECT DISTINCT ON (r.child_person_id)
            r.child_person_id::text AS person_id,
            r.id::text AS relation_id,
            'ORG_VISUAL_RELATION' AS source,
            p.full_name, p.document, p.is_active,
            ro.name AS role_name,
            pc.id::text AS person_cv_id, pc.drive_file_id, pc.mime_type
       FROM organigrama.org_visual_relation r
       JOIN core.person p ON p.id = r.child_person_id
       LEFT JOIN core.role ro ON ro.id = p.role_id
       LEFT JOIN organigrama.person_cv pc
         ON pc.person_id = p.id AND pc.is_active = true
      WHERE r.parent_person_id = $1
        AND r.is_active = true
        AND r.version_id = $2
      ORDER BY r.child_person_id, r.id`,
    [albertoId, versionId],
  );

  const slot = await c.query(
    `SELECT r.id::text AS slot_relation_id, r.parent_person_id::text,
            parent.full_name AS parent_name
       FROM organigrama.org_visual_relation r
       JOIN core.person parent ON parent.id = r.parent_person_id
      WHERE r.child_person_id = $1
        AND r.is_active = true
        AND r.version_id = $2`,
    [albertoId, versionId],
  );

  const slotId = slot.rows[0]?.slot_relation_id || null;

  const posChildren = slotId
    ? await c.query(
        `SELECT DISTINCT ON (pc.child_person_id)
                pc.child_person_id::text AS person_id,
                pc.id::text AS position_child_id,
                pc.parent_relation_id::text AS parent_relation_id,
                'POSITION_CHILD' AS source,
                pc.is_active AS rel_active,
                p.full_name, p.document, p.is_active,
                ro.name AS role_name,
                pcv.id::text AS person_cv_id, pcv.drive_file_id, pcv.mime_type
           FROM organigrama.org_visual_relation_position_child pc
           JOIN core.person p ON p.id = pc.child_person_id
           LEFT JOIN core.role ro ON ro.id = p.role_id
           LEFT JOIN organigrama.person_cv pcv
             ON pcv.person_id = p.id AND pcv.is_active = true
          WHERE pc.parent_relation_id = $1
            AND pc.version_id = $2
          ORDER BY pc.child_person_id, pc.is_active DESC, pc.id`,
        [slotId, versionId],
      )
    : { rows: [] };

  const byId = new Map();
  for (const r of relChildren.rows) {
    byId.set(r.person_id, { ...r, sources: [r.source] });
  }
  for (const r of posChildren.rows) {
    if (byId.has(r.person_id)) {
      byId.get(r.person_id).sources.push(r.source);
      byId.get(r.person_id).rel_active =
        byId.get(r.person_id).rel_active !== false && r.rel_active !== false;
    } else {
      byId.set(r.person_id, { ...r, sources: [r.source] });
    }
  }

  const all = [...byId.values()];
  const vacancies = all.filter(isVacancy);
  const inactiveRel = all.filter((r) => r.rel_active === false && !isVacancy(r));
  const inactivePerson = all.filter((r) => r.is_active === false && !isVacancy(r));
  const active = all.filter(
    (r) => !isVacancy(r) && r.is_active !== false && r.rel_active !== false,
  );

  const summary = {
    albertoId,
    versionId,
    slot: slot.rows[0] || null,
    relChildrenCount: relChildren.rows.length,
    posChildrenCount: posChildren.rows.length,
    posActive: posChildren.rows.filter((r) => r.rel_active !== false && r.is_active !== false && !isVacancy(r)).length,
    posInactiveRel: posChildren.rows.filter((r) => r.rel_active === false).length,
    unionCount: all.length,
    vacancies: vacancies.map((v) => ({ id: v.person_id, name: v.full_name, role: v.role_name })),
    inactiveRel: inactiveRel.map((v) => ({ id: v.person_id, name: v.full_name, rel_active: v.rel_active })),
    inactivePerson: inactivePerson.map((v) => ({ id: v.person_id, name: v.full_name })),
    activeCount: active.length,
    cohortTotalWithLeader: active.length + 1,
    withCv: active.filter((r) => r.person_cv_id).length,
    withoutCv: active.filter((r) => !r.person_cv_id).map((r) => ({
      id: r.person_id,
      name: r.full_name,
      role: r.role_name,
      sources: r.sources,
    })),
    activeMembers: active.map((r) => ({
      id: r.person_id,
      name: r.full_name,
      role: r.role_name,
      hasCv: !!r.person_cv_id,
      personCvId: r.person_cv_id,
      sources: r.sources,
    })),
  };

  const outDir = path.join(__dirname, '..', 'tmp', 'mc1-pd-cohort');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'visual-children-resolution.json'),
    JSON.stringify({ summary, relChildren: relChildren.rows, posChildren: posChildren.rows }, null, 2),
  );
  console.log(JSON.stringify(summary, null, 2));
  await c.end();
})().catch((e) => {
  console.error(String(e.stack || e).slice(0, 1000));
  process.exit(1);
});
