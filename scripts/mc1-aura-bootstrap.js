/**
 * Bootstrap cohorte Aura Escuela de Transformación Empresarial Cloud RO → MDE.
 * Lee tmp/mc1-aura-business-transformation-branch/lookup.json
 *
 *   node scripts/mc1-aura-lookup.js
 *   node scripts/mc1-aura-bootstrap.js
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
  const rootDir = path.join(__dirname, '..');
  const lookupPath = path.join(
    rootDir,
    'tmp',
    'mc1-aura-business-transformation-branch',
    'lookup.json',
  );
  if (!fs.existsSync(lookupPath)) {
    throw new Error('Run node scripts/mc1-aura-lookup.js first');
  }
  const lookup = JSON.parse(fs.readFileSync(lookupPath, 'utf8'));
  const COHORT = lookup.cohort || [];
  const ids = COHORT.map((c) => c.personId);

  const root = loadEnv(path.join(rootDir, '.env'));
  const mde = loadEnv(path.join(rootDir, 'secrets', 'mc1-mde.local.env'));
  if (
    !['127.0.0.1', 'localhost', '::1'].includes(String(mde.MDE_DB_HOST)) ||
    Number(mde.MDE_DB_PORT) !== 5434 ||
    !String(mde.MDE_DB_NAME).includes('_mde')
  ) {
    throw new Error('REFUSING_NON_MDE_TARGET');
  }

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
  const local = new Client({
    host: mde.MDE_DB_HOST,
    port: Number(mde.MDE_DB_PORT),
    database: mde.MDE_DB_NAME,
    user: mde.MDE_DB_USERNAME,
    password: mde.MDE_DB_PASSWORD,
  });
  await cloud.connect();
  await local.connect();

  const people = await cloud.query(
    `SELECT id, document, full_name, COALESCE(is_active, true) AS is_active
       FROM core.person WHERE id = ANY($1::bigint[]) ORDER BY id`,
    [ids],
  );
  // Copy ALL person_cv rows (active + inactive) for EMPTY recovery alternatives
  const cvs = await cloud.query(
    `SELECT pc.id, pc.person_id, pc.document, pc.drive_file_id, pc.drive_file_name,
            pc.drive_web_url, pc.mime_type, pc.is_active, pc.synced_at,
            pc.drive_parent_folder_id, pc.drive_area_folder, pc.drive_subarea_folder,
            pc.drive_relative_path, pc.drive_modified_time, pc.drive_md5_checksum,
            pc.drive_file_size, pc.created_at
       FROM organigrama.person_cv pc
      WHERE pc.person_id = ANY($1::bigint[])
      ORDER BY pc.id`,
    [ids],
  );

  await local.query('BEGIN');
  try {
    for (const p of people.rows) {
      await local.query(
        `INSERT INTO core.person (id, document, full_name, is_active)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE
           SET document=EXCLUDED.document, full_name=EXCLUDED.full_name, is_active=EXCLUDED.is_active`,
        [p.id, p.document, p.full_name, p.is_active],
      );
    }
    if (people.rows.length) {
      await local.query(
        `SELECT setval(pg_get_serial_sequence('core.person','id'),
                GREATEST((SELECT MAX(id) FROM core.person), 1))`,
      );
    }
    for (const cv of cvs.rows) {
      await local.query(
        `INSERT INTO organigrama.person_cv (
           id, person_id, document, drive_file_id, drive_file_name, drive_web_url,
           mime_type, is_active, synced_at, drive_parent_folder_id, drive_area_folder,
           drive_subarea_folder, drive_relative_path, drive_modified_time,
           drive_md5_checksum, drive_file_size, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (id) DO UPDATE SET
           person_id=EXCLUDED.person_id, document=EXCLUDED.document,
           drive_file_id=EXCLUDED.drive_file_id, drive_file_name=EXCLUDED.drive_file_name,
           drive_web_url=EXCLUDED.drive_web_url, mime_type=EXCLUDED.mime_type,
           is_active=EXCLUDED.is_active, synced_at=EXCLUDED.synced_at,
           drive_parent_folder_id=EXCLUDED.drive_parent_folder_id,
           drive_area_folder=EXCLUDED.drive_area_folder,
           drive_subarea_folder=EXCLUDED.drive_subarea_folder,
           drive_relative_path=EXCLUDED.drive_relative_path,
           drive_modified_time=EXCLUDED.drive_modified_time,
           drive_md5_checksum=EXCLUDED.drive_md5_checksum,
           drive_file_size=EXCLUDED.drive_file_size`,
        [
          cv.id,
          cv.person_id,
          cv.document,
          cv.drive_file_id,
          cv.drive_file_name,
          cv.drive_web_url,
          cv.mime_type,
          cv.is_active,
          cv.synced_at,
          cv.drive_parent_folder_id,
          cv.drive_area_folder,
          cv.drive_subarea_folder,
          cv.drive_relative_path,
          cv.drive_modified_time,
          cv.drive_md5_checksum,
          cv.drive_file_size,
          cv.created_at,
        ],
      );
    }
    if (cvs.rows.length) {
      await local.query(
        `SELECT setval(pg_get_serial_sequence('organigrama.person_cv','id'),
                GREATEST((SELECT MAX(id) FROM organigrama.person_cv), 1))`,
      );
    }
    await local.query('COMMIT');
  } catch (e) {
    await local.query('ROLLBACK');
    throw e;
  }

  const frozen = COHORT.map((s) => {
    const p = people.rows.find((x) => Number(x.id) === s.personId);
    const cv = cvs.rows
      .filter((x) => Number(x.person_id) === s.personId && x.is_active)
      .sort((a, b) => Number(b.id) - Number(a.id))[0];
    return {
      personId: s.personId,
      label: s.fullName,
      role: s.selectionRole,
      caseId: s.caseId,
      cohortRole: s.role,
      fullName: p?.full_name ?? s.fullName,
      document: p?.document ?? s.document,
      personCvId: cv?.id ? Number(cv.id) : s.personCvId,
      ready: !!(
        p &&
        cv?.drive_file_id &&
        String(cv.mime_type || '').toLowerCase().includes('pdf')
      ),
    };
  });

  const outDir = path.join(rootDir, 'tmp', 'mc1-aura-business-transformation-branch');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'bootstrap.json'),
    JSON.stringify(
      {
        cloudWrites: 0,
        versionId: lookup.versionId,
        expected: lookup.expected,
        peopleCopied: people.rows.length,
        cvsCopied: cvs.rows.length,
        withCv: frozen.filter((f) => f.ready).length,
        withoutCv: frozen.filter((f) => !f.ready),
        frozen,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        peopleCopied: people.rows.length,
        cvsCopied: cvs.rows.length,
        ready: frozen.filter((f) => f.ready).length,
        withoutCv: frozen.filter((f) => !f.ready).map((f) => f.personId),
      },
      null,
      2,
    ),
  );
  await cloud.end();
  await local.end();
})().catch((e) => {
  console.error('BOOTSTRAP_FAIL', String(e.message || e).slice(0, 400));
  process.exit(1);
});
