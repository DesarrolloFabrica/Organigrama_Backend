/**
 * Lookup Supervisor B2B + 4 auxiliares.
 *   node scripts/mc1-b2b-lookup.js
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

const NEEDLES = [
  { key: 'jonh', re: /jonh.*cuevas|cuevas.*mu[nñ]oz|john.*cuevas/i },
  { key: 'paula', re: /paula.*ortiz|ortiz.*andapi/i },
  { key: 'jeimy', re: /jeimy.*naranjo|naranjo.*jeimy|naranjo.*herrera/i },
  { key: 'leidy', re: /leidy.*gonzalez|gonzalez.*olaya|gonz[aá]lez olaya/i },
  { key: 'yenny', re: /yenny.*paez|p[aá]ez.*castro|paez castro/i },
];

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

  const people = await c.query(
    `
    SELECT p.id::text AS person_id, p.full_name, p.document,
           COALESCE(p.is_active, true) AS is_active,
           pc.id::text AS person_cv_id, pc.drive_file_id, pc.mime_type,
           pc.drive_file_name, pc.is_active AS cv_active
      FROM core.person p
      LEFT JOIN organigrama.person_cv pc
        ON pc.person_id = p.id AND pc.is_active = true
     WHERE p.full_name ILIKE '%Cuevas%'
        OR p.full_name ILIKE '%Andapi%'
        OR p.full_name ILIKE '%Naranjo%Herrera%'
        OR p.full_name ILIKE '%Naranjo%'
        OR p.full_name ILIKE '%Olaya%'
        OR p.full_name ILIKE '%Paez%Castro%'
        OR p.full_name ILIKE '%Páez%Castro%'
        OR p.full_name ILIKE '%Ortiz%Andapi%'
        OR p.full_name ILIKE '%Jeimy%'
        OR p.full_name ILIKE '%Yenny%Paola%'
        OR p.full_name ILIKE '%Jonh%Cesar%'
        OR p.full_name ILIKE '%John%Cesar%'
     ORDER BY p.id
    `,
  );

  const matched = {};
  for (const n of NEEDLES) {
    matched[n.key] = people.rows.filter((r) => n.re.test(r.full_name || ''));
  }

  // Prefer Jonh/John Cuevas as supervisor; resolve children if found
  const jonh =
    matched.jonh.find((r) => /supervisor|b2b/i.test(r.full_name || '')) ||
    matched.jonh[0] ||
    null;

  let children = [];
  if (jonh) {
    const rel = await c.query(
      `
      SELECT DISTINCT ON (r.child_person_id)
             r.child_person_id::text AS child_id,
             p.full_name,
             COALESCE(r.is_active, true) AS rel_active,
             COALESCE(p.is_active, true) AS is_active,
             pc.id::text AS person_cv_id,
             pc.mime_type,
             pc.drive_file_id
        FROM organigrama.org_visual_relation r
        JOIN core.person p ON p.id = r.child_person_id
        LEFT JOIN organigrama.person_cv pc
          ON pc.person_id = p.id AND pc.is_active = true
       WHERE r.parent_person_id = $1
       ORDER BY r.child_person_id, pc.id DESC NULLS LAST
      `,
      [Number(jonh.person_id)],
    );
    children = rel.rows;
  }

  const out = {
    cloudWrites: 0,
    candidates: people.rows,
    matched,
    supervisor: jonh,
    children,
  };
  const outDir = path.join(__dirname, '..', 'tmp', 'mc1-b2b-cohort');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'lookup.json'),
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
  await c.end();
})().catch((e) => {
  console.error('LOOKUP_FAIL', String(e.message || e).slice(0, 400));
  process.exit(1);
});
