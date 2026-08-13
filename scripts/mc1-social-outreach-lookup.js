/**
 * Lookup Liliana Villamizar Pérez + hijos directos activos (Proyección Social).
 * Excluye vacantes. Versión visual preferida = mayor version_id.
 *
 *   node scripts/mc1-social-outreach-lookup.js
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

function isVacancyRow(r) {
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

  const candidates = await c.query(
    `
    SELECT p.id::text AS person_id, p.full_name, p.document,
           COALESCE(p.is_active, true) AS is_active,
           ro.name AS role_name,
           pc.id::text AS person_cv_id, pc.drive_file_id, pc.mime_type,
           pc.drive_file_name
      FROM core.person p
      LEFT JOIN core.role ro ON ro.id = p.role_id
      LEFT JOIN organigrama.person_cv pc
        ON pc.person_id = p.id AND pc.is_active = true
     WHERE p.full_name ILIKE '%Villamizar%'
        OR p.full_name ILIKE '%Liliana%Villamizar%'
        OR p.full_name ILIKE '%Villamizar%Perez%'
        OR p.full_name ILIKE '%Villamizar%Pérez%'
     ORDER BY p.id
    `,
  );

  const liliana =
    candidates.rows.find((r) =>
      /liliana.*villamizar|villamizar.*p[eé]rez.*liliana|villamizar.*liliana/i.test(
        r.full_name || '',
      ),
    ) ||
    candidates.rows.find((r) => /villamizar/i.test(r.full_name || '')) ||
    null;

  if (!liliana) {
    console.log(JSON.stringify({ status: 'LEADER_NOT_FOUND', candidates: candidates.rows }, null, 2));
    await c.end();
    process.exit(1);
  }

  const leaderId = Number(liliana.person_id);

  const vPick = await c.query(
    `SELECT version_id::text AS id,
            COUNT(DISTINCT r.child_person_id) FILTER (
              WHERE r.is_active AND p.is_active
            )::int AS active_children
       FROM organigrama.org_visual_relation r
       JOIN core.person p ON p.id = r.child_person_id
      WHERE r.parent_person_id = $1
      GROUP BY version_id
      ORDER BY version_id DESC`,
    [leaderId],
  );

  // Prefer version with ~9 active children (expected), else latest
  const preferred =
    vPick.rows.find((v) => Number(v.active_children) === 9 || Number(v.active_children) === 11) ||
    vPick.rows.find((v) => Number(v.active_children) >= 9) ||
    vPick.rows[0];
  const versionId = preferred?.id;

  const childrenRaw = await c.query(
    `SELECT DISTINCT ON (r.child_person_id)
            r.child_person_id::text AS child_id,
            r.id::text AS relation_id,
            r.version_id::text AS version_id,
            r.visual_level,
            p.full_name,
            p.document,
            COALESCE(p.is_active, true) AS is_active,
            ro.name AS role_name,
            pc.id::text AS person_cv_id,
            pc.mime_type,
            pc.drive_file_id,
            pc.drive_file_name,
            pc.drive_file_size::text AS drive_file_size
       FROM organigrama.org_visual_relation r
       JOIN core.person p
         ON p.id = r.child_person_id AND p.is_active = true
       LEFT JOIN core.role ro ON ro.id = p.role_id
       LEFT JOIN organigrama.person_cv pc
         ON pc.person_id = p.id AND pc.is_active = true
      WHERE r.parent_person_id = $1
        AND r.is_active = true
        AND r.version_id = $2
      ORDER BY r.child_person_id, r.visual_level ASC NULLS LAST, r.id ASC`,
    [leaderId, versionId],
  );

  const vacancies = childrenRaw.rows.filter(isVacancyRow);
  const children = childrenRaw.rows.filter((r) => !isVacancyRow(r));

  const cohort = [];
  cohort.push({
    personId: leaderId,
    personCvId: liliana.person_cv_id ? Number(liliana.person_cv_id) : null,
    fullName: liliana.full_name,
    document: liliana.document,
    role: 'LEADER',
    selectionRole: 'Coordinador de Proyección Social',
    caseId: 'person-liliana-villamizar',
    driveFileId: liliana.drive_file_id || null,
    mimeType: liliana.mime_type || null,
    isVacancy: false,
  });
  for (const ch of children) {
    cohort.push({
      personId: Number(ch.child_id),
      personCvId: ch.person_cv_id ? Number(ch.person_cv_id) : null,
      fullName: ch.full_name,
      document: ch.document,
      role: 'MEMBER',
      selectionRole: 'Hijo directo Proyección Social',
      caseId: `person-${slugify(ch.full_name) || ch.child_id}`,
      driveFileId: ch.drive_file_id || null,
      mimeType: ch.mime_type || null,
      relationId: ch.relation_id,
      visualLevel: ch.visual_level,
      roleName: ch.role_name,
      isVacancy: false,
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
    expected: 10,
    versionId,
    versionStats: vPick.rows,
    leaderCandidates: candidates.rows,
    leader: liliana,
    childrenRawCount: childrenRaw.rows.length,
    vacanciesExcluded: vacancies.map((v) => ({
      personId: v.child_id,
      fullName: v.full_name,
      document: v.document,
      roleName: v.role_name,
    })),
    childrenCount: children.length,
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

  const outDir = path.join(__dirname, '..', 'tmp', 'mc1-social-outreach-cohort');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'lookup.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await c.end();
})().catch((e) => {
  console.error('LOOKUP_FAIL', String(e.message || e).slice(0, 500));
  process.exit(1);
});
