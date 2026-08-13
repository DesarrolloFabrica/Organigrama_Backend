/**
 * Cobertura rama coordinación Haider → Sara / Johan / Felipe.
 * Solo lectura Cloud RO + artefactos. No reprocesa.
 *   node scripts/mc1-haider-branch-coverage.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const HAIDER = 49;
const LEADS = new Set([2, 52, 1303]); // Johan, Sara, Felipe

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

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

(async () => {
  const rootDir = path.join(__dirname, '..');
  const root = loadEnv(path.join(rootDir, '.env'));
  const cloud = new Client({
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
  await cloud.connect();

  const direct = await cloud.query(
    `
    SELECT DISTINCT ON (r.child_person_id)
           r.child_person_id::text AS person_id,
           p.full_name,
           COALESCE(p.is_active, true) AS is_active,
           pc.id::text AS person_cv_id,
           pc.mime_type,
           pc.drive_file_id
      FROM organigrama.org_visual_relation r
      JOIN core.person p ON p.id = r.child_person_id
      LEFT JOIN organigrama.person_cv pc
        ON pc.person_id = p.id AND pc.is_active = true
     WHERE r.parent_person_id = $1
       AND COALESCE(r.is_active, true) = true
     ORDER BY r.child_person_id, pc.id DESC NULLS LAST
    `,
    [HAIDER],
  );

  const underLeads = await cloud.query(
    `
    SELECT DISTINCT ON (r.child_person_id)
           r.parent_person_id::text AS lead_id,
           r.child_person_id::text AS person_id,
           p.full_name,
           COALESCE(p.is_active, true) AS is_active,
           pc.id::text AS person_cv_id,
           pc.mime_type,
           pc.drive_file_id
      FROM organigrama.org_visual_relation r
      JOIN core.person p ON p.id = r.child_person_id
      LEFT JOIN organigrama.person_cv pc
        ON pc.person_id = p.id AND pc.is_active = true
     WHERE r.parent_person_id = ANY($1::bigint[])
       AND COALESCE(r.is_active, true) = true
     ORDER BY r.child_person_id, pc.id DESC NULLS LAST
    `,
    [[...LEADS]],
  );

  const haiderRow = await cloud.query(
    `SELECT id::text AS person_id, full_name, COALESCE(is_active,true) AS is_active
       FROM core.person WHERE id = $1`,
    [HAIDER],
  );
  const haiderCv = await cloud.query(
    `SELECT id::text AS person_cv_id, mime_type, drive_file_id
       FROM organigrama.person_cv
      WHERE person_id = $1 AND is_active = true
      ORDER BY id DESC LIMIT 1`,
    [HAIDER],
  );
  await cloud.end();

  const known = {
    '49': {
      status: 'COMPLETE',
      note: 'HAIDER_PROFILE_VALIDATED · DATA_ANALYTICS',
      source: 'tmp/mc1-haider-profile/phase-verdict.json',
    },
    '52': {
      status: 'COMPLETE',
      note: 'DATA_ANALYTICS_OPERATIONAL_SARA_VALIDATED',
      source: 'tmp/mc1-sara-data-analytics-complete/phase-verdict.json',
    },
    '1207': {
      status: 'COMPLETE',
      note: 'DIGITAL_MARKETING_OPERATIONAL_DIANA_VALIDATED',
      source: 'tmp/mc1-diana-digital-marketing-complete/phase-verdict.json',
    },
    '1210': {
      status: 'COMPLETE',
      note: 'EDUCATION · Sara children',
      source: 'tmp/mc1-sara-children-live/cohort-report.json',
    },
    '1211': {
      status: 'COMPLETE_WITH_DRIFT',
      note: 'EDUCATION+AV · Sara children (cohort WITH_DRIFT)',
      source: 'tmp/mc1-sara-children-live/cohort-report.json',
    },
    '1217': {
      status: 'COMPLETE_WITH_DRIFT',
      note: 'EDUCATION+FA · Sara children (cohort WITH_DRIFT)',
      source: 'tmp/mc1-sara-children-live/cohort-report.json',
    },
    '2': {
      status: 'COMPLETE',
      note: 'VISUAL_DESIGN primary + SE · software cohort 9e',
      source: 'tmp/mc1-software-cohort-9e/cohort-report.json',
    },
    '1': {
      status: 'COMPLETE',
      note: 'SOFTWARE_ENGINEERING · software cohort 9e',
      source: 'tmp/mc1-software-cohort-9e/cohort-report.json',
    },
    '3': {
      status: 'COMPLETE',
      note: 'SOFTWARE_ENGINEERING · software cohort 9e',
      source: 'tmp/mc1-software-cohort-9e/cohort-report.json',
    },
    '4': {
      status: 'COMPLETE',
      note: 'SOFTWARE_ENGINEERING · software cohort 9e',
      source: 'tmp/mc1-software-cohort-9e/cohort-report.json',
    },
    '5': {
      status: 'COMPLETE',
      note: 'SOFTWARE_ENGINEERING · software cohort 9e',
      source: 'tmp/mc1-software-cohort-9e/cohort-report.json',
    },
    '1303': {
      status: 'TAXONOMY_BLOCKED',
      note: 'DIGITAL_MARKETING PRIMARY_TAXONOMY_PENDING (no reprocesado tras DM 1.8.0)',
      source: 'tmp/mc1-felipe-team-cohort/cohort-report.json',
    },
    '1305': {
      status: 'COMPLETE_WITH_DRIFT',
      note: 'AUDIOVISUAL_PRODUCTION · Felipe team',
      source: 'tmp/mc1-felipe-team-cohort/cohort-report.json',
    },
    '1306': {
      status: 'COMPLETE_WITH_DRIFT',
      note: 'AUDIOVISUAL_PRODUCTION + PUBLICATION_DRIFT',
      source: 'tmp/mc1-felipe-team-cohort/cohort-report.json',
    },
    '1307': {
      status: 'COMPLETE_WITH_DRIFT',
      note: 'VISUAL_DESIGN · Felipe team',
      source: 'tmp/mc1-felipe-team-cohort/cohort-report.json',
    },
    '1308': {
      status: 'COMPLETE_WITH_DRIFT',
      note: 'AUDIOVISUAL_PRODUCTION · Felipe team',
      source: 'tmp/mc1-felipe-team-cohort/cohort-report.json',
    },
    '1309': {
      status: 'COMPLETE_WITH_DRIFT',
      note: 'AUDIOVISUAL_PRODUCTION · Felipe team',
      source: 'tmp/mc1-felipe-team-cohort/cohort-report.json',
    },
  };

  function enrich(row, depth, leadId) {
    const id = String(row.person_id);
    const name = String(row.full_name || '').replace(/\n/g, ' ').trim();
    const isVacancy = name.toUpperCase().includes('VACANTE');
    const hasCv = !!(
      row.person_cv_id &&
      row.drive_file_id &&
      String(row.mime_type || '')
        .toLowerCase()
        .includes('pdf')
    );
    const k = known[id];
    let profileStatus = 'NOT_PROCESSED';
    if (k) profileStatus = k.status;
    else if (isVacancy) profileStatus = 'N/A_VACANCY';
    else if (!hasCv) profileStatus = 'NO_ACTIVE_CV';

    return {
      personId: id,
      depth,
      leadId: leadId ? String(leadId) : null,
      fullName: name,
      isActive: !!row.is_active,
      personCvId: row.person_cv_id ?? null,
      hasCv,
      profileStatus,
      detail: k?.note ?? null,
      artifact: k?.source ?? null,
    };
  }

  const haider = enrich(
    {
      person_id: haiderRow.rows[0].person_id,
      full_name: haiderRow.rows[0].full_name,
      is_active: haiderRow.rows[0].is_active,
      person_cv_id: haiderCv.rows[0]?.person_cv_id,
      mime_type: haiderCv.rows[0]?.mime_type,
      drive_file_id: haiderCv.rows[0]?.drive_file_id,
    },
    0,
    null,
  );

  const directs = direct.rows.map((r) => enrich(r, 1, HAIDER));
  const descendants = underLeads.rows.map((r) =>
    enrich(r, 2, r.lead_id),
  );

  const scoped = [haider, ...directs.filter((d) => LEADS.has(Number(d.personId))), ...descendants];
  const otherDirects = directs.filter((d) => !LEADS.has(Number(d.personId)));

  const tally = (arr) => ({
    persons: arr.length,
    processed: arr.filter((p) =>
      ['COMPLETE', 'COMPLETE_WITH_DRIFT', 'TAXONOMY_BLOCKED'].includes(
        p.profileStatus,
      ),
    ).length,
    profilesComplete: arr.filter((p) => p.profileStatus === 'COMPLETE').length,
    profilesCompleteWithDrift: arr.filter(
      (p) => p.profileStatus === 'COMPLETE_WITH_DRIFT',
    ).length,
    profilesTaxonomyBlocked: arr.filter(
      (p) => p.profileStatus === 'TAXONOMY_BLOCKED',
    ).length,
    missingCv: arr.filter((p) => p.profileStatus === 'NO_ACTIVE_CV'),
    notProcessedWithCv: arr.filter(
      (p) => p.profileStatus === 'NOT_PROCESSED' && p.hasCv,
    ),
  });

  const byLead = {
    sara: {
      lead: directs.find((d) => d.personId === '52'),
      children: descendants.filter((d) => d.leadId === '52'),
    },
    johan: {
      lead: directs.find((d) => d.personId === '2'),
      children: descendants.filter((d) => d.leadId === '2'),
    },
    felipe: {
      lead: directs.find((d) => d.personId === '1303'),
      children: descendants.filter((d) => d.leadId === '1303'),
    },
  };

  const summary = {
    cloudWrites: 0,
    reprocessed: false,
    scope:
      'Haider + Sara/Johan/Felipe + sus reportes directos (excluye fábrica bajo vacantes 1205/1206/1215)',
    haider,
    scopedTally: tally(scoped),
    otherDirectReportsOfHaider: otherDirects.map((d) => ({
      personId: d.personId,
      fullName: d.fullName,
      profileStatus: d.profileStatus,
      hasCv: d.hasCv,
      note:
        d.profileStatus === 'N/A_VACANCY'
          ? 'Vacante de coordinación — fuera del cierre Sara/Johan/Felipe'
          : d.profileStatus === 'NO_ACTIVE_CV'
            ? 'Sin CV activo'
            : 'No incluido en líneas Sara/Johan/Felipe',
    })),
    lines: {
      sara: {
        ...byLead.sara,
        tally: tally(
          [byLead.sara.lead, ...byLead.sara.children].filter(Boolean),
        ),
      },
      johan: {
        ...byLead.johan,
        tally: tally(
          [byLead.johan.lead, ...byLead.johan.children].filter(Boolean),
        ),
      },
      felipe: {
        ...byLead.felipe,
        tally: tally(
          [byLead.felipe.lead, ...byLead.felipe.children].filter(Boolean),
        ),
      },
    },
    cohortDecisions: {
      haider: readJson(
        path.join(rootDir, 'tmp', 'mc1-haider-profile', 'phase-verdict.json'),
      )?.decision,
      saraChildren: readJson(
        path.join(rootDir, 'tmp', 'mc1-sara-children-live', 'cohort-report.json'),
      )?.decision,
      saraDaComplete: readJson(
        path.join(
          rootDir,
          'tmp',
          'mc1-sara-data-analytics-complete',
          'phase-verdict.json',
        ),
      )?.decision,
      dianaDmComplete: readJson(
        path.join(
          rootDir,
          'tmp',
          'mc1-diana-digital-marketing-complete',
          'phase-verdict.json',
        ),
      )?.decision,
      felipeTeam: readJson(
        path.join(rootDir, 'tmp', 'mc1-felipe-team-cohort', 'cohort-report.json'),
      )?.decision,
      johanSoftware: 'mc1-software-cohort-9e DONE (Johan + SE team)',
    },
    people: scoped.sort(
      (a, b) => a.depth - b.depth || Number(a.personId) - Number(b.personId),
    ),
  };

  const outDir = path.join(rootDir, 'tmp', 'mc1-haider-profile');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'branch-coverage.json'),
    JSON.stringify(summary, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        scopedTally: summary.scopedTally,
        otherDirectReportsOfHaider: summary.otherDirectReportsOfHaider,
        lines: {
          sara: summary.lines.sara.tally,
          johan: summary.lines.johan.tally,
          felipe: summary.lines.felipe.tally,
        },
        cohortDecisions: summary.cohortDecisions,
        people: summary.people.map((p) => ({
          personId: p.personId,
          depth: p.depth,
          leadId: p.leadId,
          fullName: p.fullName,
          profileStatus: p.profileStatus,
          detail: p.detail,
        })),
        missingCv: summary.scopedTally.missingCv.map((p) => p.fullName),
        notProcessedWithCv: summary.scopedTally.notProcessedWithCv.map(
          (p) => `${p.personId} ${p.fullName}`,
        ),
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error('COVERAGE_FAIL', String(e.message || e).slice(0, 500));
  process.exit(1);
});
