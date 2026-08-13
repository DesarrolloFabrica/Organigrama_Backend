/**
 * Lookup Aura Marcela Royero Vergara (1297) + hijos directos visuales v4.
 * Escuela de Transformación Empresarial — hijos directos solamente (no nietos).
 *
 *   node scripts/mc1-aura-lookup.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const IMAGE_REF = [
  'Jimmy Cifuentes Sanchez',
  'Pedro Nilson Flores Lopez',
  'Clara Patricia Garcia Aguilar',
  'David Arturo Conto Lopez',
  'Laura Marcela Gonzalez Vargas',
  'Christian David Rodriguez Arias',
  'Lizeth Jurley Marin Guerrero',
  'Lorena Aldana Forero',
];

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
    .slice(0, 48);
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

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchesImage(img, bdName) {
  const ni = normName(img);
  const nb = normName(bdName);
  if (ni === nb) return true;
  const imgTokens = ni.split(' ').filter(Boolean);
  const bdTokens = nb.split(' ').filter(Boolean);
  if (imgTokens.length >= 2 && bdTokens.length >= 2) {
    if (
      bdTokens.includes(imgTokens[0]) &&
      bdTokens.includes(imgTokens[imgTokens.length - 1])
    ) {
      return true;
    }
  }
  return (
    nb.includes(imgTokens.slice(0, 2).join(' ')) ||
    ni.includes(bdTokens.slice(0, 2).join(' '))
  );
}

(async () => {
  const rootDir = path.join(__dirname, '..');
  const outDir = path.join(rootDir, 'tmp', 'mc1-aura-business-transformation-branch');
  fs.mkdirSync(outDir, { recursive: true });

  const root = loadEnv(path.join(rootDir, '.env'));
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
     WHERE p.id = 1297
        OR p.full_name ILIKE '%ROYERO%VERGARA%'
        OR p.full_name ILIKE '%AURA%MARCELA%ROYERO%'
     ORDER BY CASE WHEN p.id = 1297 THEN 0 ELSE 1 END, p.id
    `,
  );

  const aura =
    candidates.rows.find((r) => Number(r.person_id) === 1297) ||
    candidates.rows.find((r) =>
      /aura\s+marcela\s+royero/i.test(r.full_name || ''),
    ) ||
    null;

  if (!aura) {
    console.log(
      JSON.stringify(
        { status: 'LEADER_NOT_FOUND', candidates: candidates.rows },
        null,
        2,
      ),
    );
    await c.end();
    process.exit(1);
  }

  const leaderId = Number(aura.person_id);
  const chartV = await c.query(
    `SELECT id::text, code, name, is_active, period_label
       FROM organigrama.org_chart_version
      WHERE is_active = true
      ORDER BY id DESC
      LIMIT 1`,
  );
  const versionId = chartV.rows[0]?.id || '4';

  const leidyLink = await c.query(
    `SELECT r.id::text AS relation_id, r.parent_person_id::text,
            parent.full_name AS parent_name
       FROM organigrama.org_visual_relation r
       JOIN core.person parent ON parent.id = r.parent_person_id
      WHERE r.child_person_id = $1
        AND r.is_active = true
        AND r.version_id = $2
      ORDER BY r.id`,
    [leaderId, versionId],
  );

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

  const children = [...byId.values()].map((r) => {
    const vacancy = isVacancyRow(r);
    return {
      personId: Number(r.child_id),
      fullName: r.full_name,
      document: r.document,
      roleName: r.role_name,
      isActive: !!r.is_active,
      isVacancy: vacancy,
      personCvId: r.person_cv_id ? Number(r.person_cv_id) : null,
      driveFileId: r.drive_file_id || null,
      driveFileName: r.drive_file_name || null,
      mimeType: r.mime_type || null,
      sources: r.sources,
      hasCv: !!r.person_cv_id,
      caseId: `person-${slugify(r.full_name)}-${r.child_id}`,
      selectionRole: r.role_name || 'Hijo directo Escuela de Transformación Empresarial',
      role: 'MEMBER',
    };
  });

  children.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));

  const leader = {
    personId: Number(aura.person_id),
    fullName: aura.full_name,
    document: aura.document,
    roleName: aura.role_name,
    isActive: !!aura.is_active,
    isVacancy: false,
    personCvId: aura.person_cv_id ? Number(aura.person_cv_id) : null,
    driveFileId: aura.drive_file_id || null,
    driveFileName: aura.drive_file_name || null,
    mimeType: aura.mime_type || null,
    sources: ['LEADER'],
    hasCv: !!aura.person_cv_id,
    caseId: `person-aura-marcela-royero-vergara-${aura.person_id}`,
    selectionRole: aura.role_name || 'COORDINADOR ESCUELA DE TRANSFORMACION EMPRESARIAL',
    role: 'LEADER',
  };

  const activeChildren = children.filter((c) => !c.isVacancy);
  const vacancies = children.filter((c) => c.isVacancy);
  const withCv = [leader, ...activeChildren].filter((c) => c.hasCv);
  const withoutCv = [leader, ...activeChildren].filter((c) => !c.hasCv);

  const bdNorms = activeChildren.map((c) => ({
    personId: c.personId,
    fullName: c.fullName,
    n: normName(c.fullName),
  }));
  const imageMatched = [];
  const imageMissingInBd = [];
  const matchedPersonIds = new Set();
  for (const img of IMAGE_REF) {
    const hit = bdNorms.find((b) => matchesImage(img, b.fullName));
    if (hit && !matchedPersonIds.has(hit.personId)) {
      matchedPersonIds.add(hit.personId);
      imageMatched.push({ image: img, bd: hit.fullName, personId: hit.personId });
    } else if (!hit) {
      if (!IMAGE_REF.some((other) => other !== img && matchesImage(other, img))) {
        imageMissingInBd.push(img);
      }
    }
  }
  const bdExtraVsImage = activeChildren.filter(
    (c) => !matchedPersonIds.has(c.personId),
  );

  const cohortIds = [leader, ...activeChildren].map((c) => c.personId);
  const allCvs = await c.query(
    `SELECT pc.id::text AS person_cv_id, pc.person_id::text, pc.is_active,
            pc.drive_file_id, pc.drive_file_name, pc.mime_type, pc.document
       FROM organigrama.person_cv pc
      WHERE pc.person_id = ANY($1::bigint[])
      ORDER BY pc.person_id, pc.id`,
    [cohortIds],
  );

  const driveDupes = [];
  const byDrive = new Map();
  for (const cv of allCvs.rows) {
    const df = cv.drive_file_id;
    if (!df) continue;
    if (!byDrive.has(df)) byDrive.set(df, []);
    byDrive.get(df).push(cv);
  }
  for (const [driveFileId, rows] of byDrive.entries()) {
    const personIds = [...new Set(rows.map((r) => r.person_id))];
    if (personIds.length > 1) {
      driveDupes.push({ driveFileId, personIds, rows });
    }
  }

  const documentPreflight = [leader, ...activeChildren].map((person) => {
    const rows = allCvs.rows.filter((r) => Number(r.person_id) === person.personId);
    const active = rows.filter((r) => r.is_active);
    const inactive = rows.filter((r) => !r.is_active);
    let status = 'NO_CV';
    if (active.length === 1) status = 'WITH_CV';
    else if (active.length > 1) status = 'DOCUMENT_ANOMALY';
    else if (inactive.length) status = 'DOCUMENT_ANOMALY';
    return {
      personId: person.personId,
      fullName: person.fullName,
      status,
      activePersonCvId: person.personCvId,
      activeCvCount: active.length,
      inactiveCvCount: inactive.length,
      driveFileId: person.driveFileId,
      allCvIds: rows.map((r) => Number(r.person_cv_id)),
    };
  });

  const cohort = [leader, ...activeChildren].map((c) => ({
    personId: c.personId,
    personCvId: c.personCvId,
    fullName: c.fullName,
    document: c.document,
    role: c.role,
    selectionRole: c.selectionRole,
    caseId: c.caseId,
    isVacancy: false,
    hasCv: c.hasCv,
  }));

  const report = {
    status: 'LOOKUP_OK',
    orgChartVersion: chartV.rows[0] || null,
    versionId,
    leader,
    parentContext: {
      leidyPersonId: 1077,
      leidyStatus: 'LEIDY_PROFILE_VALIDATED_DO_NOT_REPROCESS',
      visualParents: leidyLink.rows,
    },
    childrenAll: children,
    activeChildren,
    vacancies,
    withCv,
    withoutCv,
    driveFileDuplicates: driveDupes,
    documentPreflight,
    imageComparison: {
      imageRefCount: 8,
      imageRefVariants: IMAGE_REF.length,
      matched: imageMatched,
      inImageNotInBd: imageMissingInBd,
      inBdNotInImage: bdExtraVsImage.map((c) => ({
        personId: c.personId,
        fullName: c.fullName,
      })),
    },
    counts: {
      expectedFromImage: 8,
      bdActiveChildren: activeChildren.length,
      vacancies: vacancies.length,
      withCv: withCv.length,
      withoutCv: withoutCv.length,
      cohortSize: cohort.length,
    },
    cohort,
    doNotProcess: {
      leidy: true,
      vivianaBranch: true,
      mairaBranch: true,
      andresBranch: true,
      carlosBranch: true,
      grandchildren: true,
      otherLeidyBranches: ['601', '1078', '1079', '1080'],
    },
    contextualControls: {
      escuelaTransformacionEmpresarialNotDomain: true,
      transformationBusinessContextOverclassification: true,
    },
  };

  fs.writeFileSync(path.join(outDir, 'lookup.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(outDir, 'document-preflight.json'),
    JSON.stringify(documentPreflight, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
