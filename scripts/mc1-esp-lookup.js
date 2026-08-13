/**
 * Lookup Tania Lizeth Rocha Contreras + hijos directos visuales
 * (Escuela de Especializaciones, v activa).
 *
 * Unión: org_visual_relation.parent = Tania
 *      + org_visual_relation_position_child del slot que Tania ocupa
 *
 * Excluye vacantes, inactivos y DOCENTES (alcance EXCLUDED_TEACHING_SCOPE).
 * Docentes NO son NO_CV ni anomalía documental.
 *
 *   node scripts/mc1-esp-lookup.js
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

/**
 * Docente de alcance (hoja de vida docente).
 * No captura coordinadores/auxiliares/analistas aunque mencionen "docente".
 */
function isTeachingScope(r) {
  const role = String(r.role_name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!role) return false;
  if (/COORDINADOR|AUXILIAR|ANALISTA|ASISTENTE|LIDER|LÍDER|GESTOR|DIRECTOR/.test(role)) {
    return false;
  }
  if (/^DOCENTE\b/.test(role)) return true;
  if (/^PROFESOR\b/.test(role)) return true;
  if (/^CATEDRATICO\b/.test(role)) return true;
  if (/\bDOCENTE\b/.test(role) && !/COORDIN/.test(role)) return true;
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
     WHERE p.full_name ILIKE '%Rocha%Contreras%'
        OR p.full_name ILIKE '%Tania Lizeth%Rocha%'
        OR p.full_name ILIKE '%Tania%Rocha%'
     ORDER BY p.id
    `,
  );

  const tania =
    candidates.rows.find((r) =>
      /tania\s+lizeth\s+rocha\s+contreras/i.test(r.full_name || ''),
    ) ||
    candidates.rows.find((r) => /tania.*rocha/i.test(r.full_name || '')) ||
    null;

  if (!tania) {
    console.log(
      JSON.stringify({ status: 'LEADER_NOT_FOUND', candidates: candidates.rows }, null, 2),
    );
    await c.end();
    process.exit(1);
  }

  const leaderId = Number(tania.person_id);

  const chartV = await c.query(
    `SELECT id::text, code, name, is_active, period_label
       FROM organigrama.org_chart_version
      WHERE is_active = true
      ORDER BY id DESC
      LIMIT 1`,
  );
  const versionId = chartV.rows[0]?.id || '4';

  const relChildren = await c.query(
    `SELECT DISTINCT ON (r.child_person_id)
            r.child_person_id::text AS child_id,
            r.id::text AS relation_id,
            'ORG_VISUAL_RELATION' AS source,
            p.full_name, p.document,
            COALESCE(p.is_active, true) AS is_active,
            ro.name AS role_name,
            pc.id::text AS person_cv_id, pc.mime_type, pc.drive_file_id, pc.drive_file_name
       FROM organigrama.org_visual_relation r
       JOIN core.person p ON p.id = r.child_person_id AND p.is_active = true
       LEFT JOIN core.role ro ON ro.id = p.role_id
       LEFT JOIN organigrama.person_cv pc
         ON pc.person_id = p.id AND pc.is_active = true
      WHERE r.parent_person_id = $1
        AND r.is_active = true
        AND r.version_id = $2
      ORDER BY r.child_person_id, r.id`,
    [leaderId, versionId],
  );

  const slot = await c.query(
    `SELECT r.id::text AS slot_relation_id, r.parent_person_id::text,
            parent.full_name AS parent_name
       FROM organigrama.org_visual_relation r
       JOIN core.person parent ON parent.id = r.parent_person_id
      WHERE r.child_person_id = $1
        AND r.is_active = true
        AND r.version_id = $2`,
    [leaderId, versionId],
  );
  const slotId = slot.rows[0]?.slot_relation_id || null;

  const posChildren = slotId
    ? await c.query(
        `SELECT DISTINCT ON (pc.child_person_id)
                pc.child_person_id::text AS child_id,
                pc.id::text AS relation_id,
                'POSITION_CHILD' AS source,
                pc.is_active AS rel_active,
                p.full_name, p.document,
                COALESCE(p.is_active, true) AS is_active,
                ro.name AS role_name,
                pcv.id::text AS person_cv_id, pcv.mime_type,
                pcv.drive_file_id, pcv.drive_file_name
           FROM organigrama.org_visual_relation_position_child pc
           JOIN core.person p ON p.id = pc.child_person_id AND p.is_active = true
           LEFT JOIN core.role ro ON ro.id = p.role_id
           LEFT JOIN organigrama.person_cv pcv
             ON pcv.person_id = p.id AND pcv.is_active = true
          WHERE pc.parent_relation_id = $1
            AND pc.version_id = $2
            AND pc.is_active = true
          ORDER BY pc.child_person_id, pc.id`,
        [slotId, versionId],
      )
    : { rows: [] };

  const byId = new Map();
  for (const r of relChildren.rows) {
    byId.set(r.child_id, { ...r, sources: [r.source] });
  }
  for (const r of posChildren.rows) {
    if (byId.has(r.child_id)) {
      byId.get(r.child_id).sources.push(r.source);
    } else {
      byId.set(r.child_id, { ...r, sources: [r.source] });
    }
  }

  const union = [...byId.values()];
  const vacancies = union.filter(isVacancyRow);
  const activeChildren = union.filter((r) => !isVacancyRow(r));
  const teachers = activeChildren.filter(isTeachingScope);
  const nonTeachers = activeChildren.filter((r) => !isTeachingScope(r));

  const roleHistogram = {};
  for (const r of activeChildren) {
    const k = r.role_name || '(sin rol)';
    roleHistogram[k] = (roleHistogram[k] || 0) + 1;
  }

  const cohort = [];
  cohort.push({
    personId: leaderId,
    personCvId: tania.person_cv_id ? Number(tania.person_cv_id) : null,
    fullName: tania.full_name,
    document: tania.document,
    role: 'LEADER',
    selectionRole: 'Coordinador Escuela de Especializaciones',
    caseId: `person-${slugify(tania.full_name)}-${leaderId}`,
    driveFileId: tania.drive_file_id || null,
    mimeType: tania.mime_type || null,
    roleName: tania.role_name,
    isVacancy: false,
    isTeachingScope: false,
    sources: ['LEADER'],
  });
  for (const ch of nonTeachers) {
    cohort.push({
      personId: Number(ch.child_id),
      personCvId: ch.person_cv_id ? Number(ch.person_cv_id) : null,
      fullName: ch.full_name,
      document: ch.document,
      role: 'MEMBER',
      selectionRole: 'Hijo directo Escuela Especializaciones (no docente)',
      caseId: `person-${slugify(ch.full_name)}-${ch.child_id}`,
      driveFileId: ch.drive_file_id || null,
      mimeType: ch.mime_type || null,
      relationId: ch.relation_id,
      roleName: ch.role_name,
      isVacancy: false,
      isTeachingScope: false,
      sources: ch.sources,
    });
  }

  const ids = cohort.map((m) => m.personId);
  const allCvs =
    ids.length > 0
      ? await c.query(
          `SELECT id::text, person_id::text, drive_file_id, drive_file_name,
                  mime_type, drive_file_size::text, is_active
             FROM organigrama.person_cv
            WHERE person_id = ANY($1::bigint[])
            ORDER BY person_id, is_active DESC, id DESC`,
          [ids],
        )
      : { rows: [] };

  const driveCounts = {};
  for (const m of cohort) {
    if (!m.driveFileId) continue;
    driveCounts[m.driveFileId] = driveCounts[m.driveFileId] || [];
    driveCounts[m.driveFileId].push(m.personId);
  }
  const sharedDriveFiles = Object.entries(driveCounts)
    .filter(([, pids]) => pids.length > 1)
    .map(([fileId, pids]) => ({ driveFileId: fileId, personIds: pids }));

  const nameCounts = {};
  for (const m of cohort) {
    const k = String(m.fullName || '').toUpperCase().trim();
    nameCounts[k] = nameCounts[k] || [];
    nameCounts[k].push(m.personId);
  }
  const duplicateNames = Object.entries(nameCounts)
    .filter(([, pids]) => pids.length > 1)
    .map(([fullName, personIds]) => ({ fullName, personIds }));

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

  const excludedTeaching = teachers.map((t) => ({
    personId: Number(t.child_id),
    fullName: t.full_name,
    document: t.document,
    roleName: t.role_name,
    sources: t.sources,
    reason: 'EXCLUDED_TEACHING_SCOPE',
  }));

  const out = {
    cloudWrites: 0,
    versionId,
    chartVersion: chartV.rows[0] || null,
    slot: slot.rows[0] || null,
    leaderCandidates: candidates.rows,
    leader: tania,
    relChildrenCount: relChildren.rows.length,
    posChildrenCount: posChildren.rows.length,
    roleHistogram,
    vacanciesExcluded: vacancies.map((v) => ({
      personId: v.child_id,
      fullName: v.full_name,
      document: v.document,
      roleName: v.role_name,
      sources: v.sources,
    })),
    excludedTeachingScope: excludedTeaching,
    childrenActiveTotal: activeChildren.length,
    teachersExcluded: teachers.length,
    nonTeachersEligible: nonTeachers.length,
    childrenCount: nonTeachers.length,
    found: cohort.length,
    withCv: withCv.length,
    withoutCv: withoutCv.map((m) => ({
      personId: m.personId,
      fullName: m.fullName,
      document: m.document,
      roleName: m.roleName || null,
      sources: m.sources,
    })),
    sharedDriveFiles,
    duplicateNames,
    peopleWithMultipleCvs,
    cohort,
  };

  const outDir = path.join(__dirname, '..', 'tmp', 'mc1-esp-cohort');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'lookup.json'), JSON.stringify(out, null, 2));
  console.log(
    JSON.stringify(
      {
        status: 'OK',
        leader: {
          id: tania.person_id,
          name: tania.full_name,
          role: tania.role_name,
          hasCv: !!tania.person_cv_id,
          personCvId: tania.person_cv_id,
        },
        versionId,
        chartVersion: chartV.rows[0] || null,
        slot: slot.rows[0] || null,
        relChildren: relChildren.rows.length,
        posChildren: posChildren.rows.length,
        roleHistogram,
        preflight: {
          coordinadora: 1,
          hijosActivosTotales: activeChildren.length,
          docentesActivosExcluidos: teachers.length,
          noDocentesActivosElegibles: nonTeachers.length,
          vacantesExcluidas: vacancies.length,
          cohorteMc1Efectiva: cohort.length,
        },
        vacancies: out.vacanciesExcluded.map((v) => ({
          name: v.fullName,
          role: v.roleName,
        })),
        teachersSample: excludedTeaching.slice(0, 15).map((t) => ({
          id: t.personId,
          name: t.fullName,
          role: t.roleName,
        })),
        teachersMore: Math.max(0, excludedTeaching.length - 15),
        eligible: cohort.map((m) => ({
          id: m.personId,
          name: m.fullName,
          role: m.roleName || m.role,
          cv: m.personCvId,
          sources: m.sources,
        })),
        withCv: withCv.length,
        withoutCv: withoutCv.length,
        withoutCvNames: withoutCv.map((m) => m.fullName),
        duplicateNames,
        sharedDriveFiles,
        peopleWithMultipleCvs: peopleWithMultipleCvs.length,
      },
      null,
      2,
    ),
  );
  await c.end();
})().catch((e) => {
  console.error('LOOKUP_FAIL', String(e.message || e).slice(0, 500));
  process.exit(1);
});
