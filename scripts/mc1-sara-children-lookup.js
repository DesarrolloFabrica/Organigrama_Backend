/**
 * Resolve Sara Juliana + direct reports identity/CV in Cloud RO.
 *   node scripts/mc1-sara-children-lookup.js
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
  { key: 'sara', pattern: '%Sara%Juliana%Mart_nez%' },
  { key: 'diana', pattern: '%Diana%Marcela%Vargas%' },
  { key: 'maria', pattern: '%Mar_a%Ang_lica%Cruz%' },
  { key: 'sandra', pattern: '%Sandra%Carolina%Molano%' },
  { key: 'jhonatan', pattern: '%Jhonatan%David%M_rquez%' },
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
           pc.id AS person_cv_id, pc.drive_file_id, pc.mime_type,
           pc.drive_file_name, pc.is_active AS cv_active
      FROM core.person p
      LEFT JOIN organigrama.person_cv pc
        ON pc.person_id = p.id AND pc.is_active = true
     WHERE ${NEEDLES.map((_, i) => `p.full_name ILIKE $${i + 1}`).join(' OR ')}
     ORDER BY p.full_name
    `,
    NEEDLES.map((n) => n.pattern),
  );

  // Also try exact-ish alternate spellings
  const extra = await c.query(
    `
    SELECT p.id::text AS person_id, p.full_name, p.document,
           pc.id AS person_cv_id, pc.drive_file_id, pc.mime_type,
           pc.drive_file_name, pc.is_active AS cv_active
      FROM core.person p
      LEFT JOIN organigrama.person_cv pc
        ON pc.person_id = p.id AND pc.is_active = true
     WHERE p.full_name ILIKE '%Sara Juliana%'
        OR p.full_name ILIKE '%Marquez Betancur%'
        OR p.full_name ILIKE '%Márquez Betancur%'
        OR p.full_name ILIKE '%Molano Castro%'
        OR p.full_name ILIKE '%Cruz Guerrero%'
        OR p.full_name ILIKE '%Vargas Camargo%'
     ORDER BY p.id
    `,
  );

  const byId = new Map();
  for (const r of [...people.rows, ...extra.rows]) {
    byId.set(r.person_id, r);
  }
  const ids = [...byId.keys()].map(Number);

  let relations = [];
  if (ids.length) {
    const rel = await c.query(
      `
      SELECT parent_person_id::text, child_person_id::text, relation_type, is_active
        FROM organigrama.org_visual_relation
       WHERE parent_person_id = ANY($1::bigint[])
          OR child_person_id = ANY($1::bigint[])
      `,
      [ids],
    );
    relations = rel.rows;
  }

  // Find Sara as parent of GIF children
  const saraCandidates = [...byId.values()].filter((p) =>
    /sara.*juliana/i.test(p.full_name),
  );

  console.log(
    JSON.stringify(
      {
        cloudWrites: 0,
        people: [...byId.values()],
        saraCandidates,
        relations,
      },
      null,
      2,
    ),
  );
  await c.end();
})().catch((e) => {
  console.error('LOOKUP_FAIL', String(e.message || e).slice(0, 800));
  process.exit(1);
});
