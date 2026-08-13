/**
 * Preflight Leidy Viviana Bernal León (Coordinador Operativo Académico).
 * Cloud RO + MDE snapshots. No writes.
 *
 *   node scripts/mc1-leidy-viviana-preflight.js
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

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'tmp', 'mc1-leidy-viviana-profile');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const cloud = loadEnv(path.join(ROOT, '.env'));
  const mde = loadEnv(path.join(ROOT, 'secrets', 'mc1-mde.local.env'));

  const cloudClient = new Client({
    host: cloud.DB_HOST,
    port: Number(cloud.DB_PORT || 5432),
    database: cloud.DB_NAME,
    user: cloud.DB_USERNAME,
    password: cloud.DB_PASSWORD,
    ssl:
      String(cloud.DB_SSL).toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });
  await cloudClient.connect();

  const person = await cloudClient.query(
    `
    SELECT p.id::text AS person_id,
           p.full_name,
           p.document,
           r.name AS role_name
      FROM core.person p
      LEFT JOIN core.role r ON r.id = p.role_id
     WHERE p.id = 1077
        OR p.document = '1070007550'
        OR p.full_name ILIKE '%LEIDY%VIVIANA%BERNAL%'
     ORDER BY CASE WHEN p.id = 1077 THEN 0 ELSE 1 END
     LIMIT 5
    `,
  );

  const target = person.rows[0];
  if (!target) {
    console.log(JSON.stringify({ status: 'NOT_FOUND' }, null, 2));
    await cloudClient.end();
    process.exit(2);
  }

  const cvs = await cloudClient.query(
    `
    SELECT id::text,
           drive_file_id,
           drive_file_name,
           mime_type,
           is_active,
           drive_file_size::text,
           synced_at
      FROM organigrama.person_cv
     WHERE person_id = $1
     ORDER BY is_active DESC, id DESC
    `,
    [target.person_id],
  );

  const active = cvs.rows.find((r) => r.is_active) || cvs.rows[0] || null;

  // Visual children under Leidy in active org version (do NOT process)
  const chartV = await cloudClient.query(
    `SELECT id::text FROM organigrama.org_chart_version
      WHERE is_active = true ORDER BY id DESC LIMIT 1`,
  );
  const versionId = chartV.rows[0]?.id || '4';

  const children = await cloudClient.query(
    `
    SELECT DISTINCT c.id::text AS person_id, c.full_name, r.name AS role_name
      FROM organigrama.org_visual_relation rel
      JOIN core.person c ON c.id = rel.child_person_id
      LEFT JOIN core.role r ON r.id = c.role_id
     WHERE rel.parent_person_id = $1
       AND rel.is_active = true
       AND rel.version_id = $2
     ORDER BY c.full_name
    `,
    [target.person_id, versionId],
  );

  await cloudClient.end();

  const mdeClient = new Client({
    host: mde.MDE_DB_HOST,
    port: Number(mde.MDE_DB_PORT),
    database: mde.MDE_DB_NAME,
    user: mde.MDE_DB_USERNAME,
    password: mde.MDE_DB_PASSWORD,
  });
  await mdeClient.connect();

  const snaps = await mdeClient.query(
    `
    SELECT id::text,
           person_id::text,
           person_cv_id::text,
           parse_status,
           page_count,
           char_length(COALESCE(normalized_text,'')) AS nlen,
           created_at
      FROM organigrama.mc_cv_snapshot
     WHERE person_id = $1
        OR person_cv_id = $2
     ORDER BY id DESC
     LIMIT 10
    `,
    [target.person_id, active?.id || 0],
  );

  await mdeClient.end();

  // Local packs
  const tmp = path.join(ROOT, 'tmp');
  const packDirs = [];
  for (const sub of [
    'mc1-p1-prototype',
    'mc1-p2-functional',
    'mc1-r1-functional',
    'mc1-p3-functional',
    'mc1-p4-functional',
    'mc1-profile-pilot',
  ]) {
    const dir = path.join(tmp, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      for (const s of snaps.rows) {
        if (name.includes(`-S${s.id}-`) || name.includes(`S${s.id}-`)) {
          packDirs.push({ stage: sub, snapshotId: s.id, pack: path.join(dir, name) });
        }
      }
    }
  }

  const report = {
    status: 'PREFLIGHT_OK',
    person: target,
    activeCv: active,
    allCvs: cvs.rows,
    visualChildrenExcluded: children.rows,
    mdeSnapshots: snaps.rows,
    localPacksMatchingSnapshots: packDirs,
    notes: {
      identityExpected: {
        name: 'LEIDY VIVIANA BERNAL LEÓN',
        document: '1070007550',
        personIdExpected: '1077',
      },
      doNotProcessChildren: true,
      cloudWrites: 0,
    },
  };

  fs.writeFileSync(
    path.join(OUT, 'preflight.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
