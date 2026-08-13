/**
 * Lookup Ingrid + hijos directos en la versión visual activa del organigrama.
 *   node scripts/mc1-service-lookup.js
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

function slugify(name) {
  return String(name || 'child')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
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

  // Resolve current org visual version (same heuristic as org-chart if possible)
  const versions = await c.query(
    `SELECT id::text, name, is_active, created_at
       FROM organigrama.org_visual_version
      ORDER BY is_active DESC, created_at DESC NULLS LAST, id DESC
      LIMIT 5`,
  ).catch(async () => {
    // fallback: distinct version_ids from relations for parent 1145
    const v = await c.query(
      `SELECT version_id::text AS id, COUNT(*)::int AS n,
              COUNT(*) FILTER (WHERE is_active) AS active_n
         FROM organigrama.org_visual_relation
        WHERE parent_person_id = 1145
        GROUP BY version_id
        ORDER BY active_n DESC, n DESC`,
    );
    return { rows: v.rows.map((r) => ({ ...r, is_active: true, name: null })) };
  });

  // Prefer highest version_id whose active direct reports match organigram (v4 = 14).
  const vPick = await c.query(
    `SELECT version_id::text AS id,
            COUNT(DISTINCT r.child_person_id) FILTER (
              WHERE r.is_active AND p.is_active
            )::int AS active_person_children
       FROM organigrama.org_visual_relation r
       JOIN core.person p ON p.id = r.child_person_id
      WHERE r.parent_person_id = 1145
      GROUP BY version_id
      ORDER BY version_id DESC`,
  );
  const preferred =
    vPick.rows.find((v) => Number(v.active_person_children) === 14) ||
    vPick.rows[0];
  const versionId = preferred?.id || versionId;

  const leader = await c.query(
    `SELECT p.id::text AS person_id, p.full_name, p.document,
            COALESCE(p.is_active, true) AS is_active,
            pc.id::text AS person_cv_id, pc.drive_file_id, pc.mime_type,
            pc.drive_file_name, pc.drive_file_size::text
       FROM core.person p
       LEFT JOIN organigrama.person_cv pc
         ON pc.person_id = p.id AND pc.is_active = true
      WHERE p.id = 1145`,
  );

  const children = await c.query(
    `SELECT DISTINCT ON (r.child_person_id)
            r.child_person_id::text AS child_id,
            r.id::text AS relation_id,
            r.version_id::text AS version_id,
            r.visual_level,
            p.full_name,
            p.document,
            COALESCE(p.is_active, true) AS is_active,
            pc.id::text AS person_cv_id,
            pc.mime_type,
            pc.drive_file_id,
            pc.drive_file_name,
            pc.drive_file_size::text AS drive_file_size
       FROM organigrama.org_visual_relation r
       JOIN core.person p
         ON p.id = r.child_person_id AND p.is_active = true
       LEFT JOIN organigrama.person_cv pc
         ON pc.person_id = p.id AND pc.is_active = true
      WHERE r.parent_person_id = 1145
        AND r.is_active = true
        AND r.version_id = $1
      ORDER BY r.child_person_id, r.visual_level ASC NULLS LAST, r.id ASC`,
    [versionId],
  );

  const ingrid = leader.rows[0];
  const cohort = [];
  if (ingrid) {
    cohort.push({
      personId: Number(ingrid.person_id),
      personCvId: ingrid.person_cv_id ? Number(ingrid.person_cv_id) : null,
      fullName: ingrid.full_name,
      document: ingrid.document,
      role: 'LEADER',
      selectionRole: 'Líder de Servicio',
      caseId: 'person-ingrid-juliana-vargas',
      driveFileId: ingrid.drive_file_id || null,
      mimeType: ingrid.mime_type || null,
    });
  }
  for (const ch of children.rows) {
    cohort.push({
      personId: Number(ch.child_id),
      personCvId: ch.person_cv_id ? Number(ch.person_cv_id) : null,
      fullName: ch.full_name,
      document: ch.document,
      role: 'MEMBER',
      selectionRole: 'Hijo directo Líder de Servicio',
      caseId: `person-${slugify(ch.full_name) || ch.child_id}`,
      driveFileId: ch.drive_file_id || null,
      mimeType: ch.mime_type || null,
      relationId: ch.relation_id,
      visualLevel: ch.visual_level,
    });
  }

  const ids = cohort.map((m) => m.personId);
  const allCvs = await c.query(
    `SELECT id::text, person_id::text, drive_file_id, drive_file_name,
            mime_type, drive_file_size::text, is_active
       FROM organigrama.person_cv
      WHERE person_id = ANY($1::bigint[])
      ORDER BY person_id, is_active DESC, id DESC`,
    [ids],
  );

  const driveCounts = {};
  for (const m of cohort) {
    if (!m.driveFileId) continue;
    driveCounts[m.driveFileId] = driveCounts[m.driveFileId] || [];
    driveCounts[m.driveFileId].push(m.personId);
  }
  const sharedDriveFiles = Object.entries(driveCounts)
    .filter(([, pids]) => pids.length > 1)
    .map(([fileId, pids]) => ({ driveFileId: fileId, personIds: pids }));

  const multiCv = {};
  for (const cv of allCvs.rows) {
    multiCv[cv.person_id] = multiCv[cv.person_id] || [];
    multiCv[cv.person_id].push({
      personCvId: cv.id,
      isActive: cv.is_active,
      driveFileId: cv.drive_file_id,
      driveFileName: cv.drive_file_name,
    });
  }
  const peopleWithMultipleCvs = Object.entries(multiCv)
    .filter(([, list]) => list.length > 1)
    .map(([personId, list]) => ({ personId, cvs: list }));

  const withCv = cohort.filter((m) => m.personCvId);
  const withoutCv = cohort.filter((m) => !m.personCvId);

  const out = {
    cloudWrites: 0,
    expected: 15,
    versionId,
    versionsSample: versions.rows,
    leader: ingrid,
    childrenCount: children.rows.length,
    found: cohort.length,
    withCv: withCv.length,
    withoutCv: withoutCv.map((m) => ({
      personId: m.personId,
      fullName: m.fullName,
      document: m.document,
    })),
    sharedDriveFiles,
    peopleWithMultipleCvs,
    cohort,
  };

  const outDir = path.join(__dirname, '..', 'tmp', 'mc1-service-cohort');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'lookup.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await c.end();
})().catch((e) => {
  console.error('LOOKUP_FAIL', String(e.message || e).slice(0, 500));
  process.exit(1);
});
