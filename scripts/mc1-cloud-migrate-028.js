/**
 * Apply / verify migration 028 on Cloud SQL.
 *   node scripts/mc1-cloud-migrate-028.js [--apply]
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
  const apply = process.argv.includes('--apply');
  const root = path.join(__dirname, '..');
  const e = loadEnv(path.join(root, '.env'));
  const c = new Client({
    host: e.DB_HOST,
    port: Number(e.DB_PORT || 5432),
    database: e.DB_NAME,
    user: e.DB_USERNAME,
    password: e.DB_PASSWORD,
    ssl:
      String(e.DB_SSL).toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
    connectionTimeoutMillis: 20000,
  });
  await c.connect();
  const id = await c.query(
    'select current_database() as db, current_user as usr',
  );
  console.log(
    JSON.stringify({ connected: true, cloud: id.rows[0], host: e.DB_HOST }),
  );

  const exists = await c.query(
    `select to_regclass('organigrama.mc1_person_profile_presentation') as rel`,
  );
  let tableExists = !!exists.rows[0]?.rel;

  if (!tableExists && apply) {
    const sqlPath = path.join(
      root,
      'migrations',
      '028_mc1_person_profile_presentation.sql',
    );
    const sql = fs.readFileSync(sqlPath, 'utf8');
    // Migration file has BEGIN/COMMIT; execute as one script.
    await c.query(sql);
    tableExists = true;
    console.log(JSON.stringify({ migrationApplied: true }));
  } else if (!tableExists) {
    console.log(
      JSON.stringify({
        migrationApplied: false,
        reason: 'TABLE_MISSING_PASS_--apply',
      }),
    );
    await c.end();
    process.exit(2);
  }

  const constraints = await c.query(`
    SELECT conname, contype
      FROM pg_constraint
     WHERE conrelid = 'organigrama.mc1_person_profile_presentation'::regclass
     ORDER BY conname
  `);
  const indexes = await c.query(`
    SELECT indexname, indexdef
      FROM pg_indexes
     WHERE schemaname = 'organigrama'
       AND tablename = 'mc1_person_profile_presentation'
     ORDER BY indexname
  `);
  const count = await c.query(
    `SELECT count(*)::int AS n FROM organigrama.mc1_person_profile_presentation`,
  );
  const activeUnique = indexes.rows.find((r) =>
    /uq_mc1_ppp_active_person/i.test(r.indexname),
  );

  const report = {
    status: 'OK',
    tableExists: true,
    constraints: constraints.rows,
    indexes: indexes.rows.map((r) => ({
      name: r.indexname,
      def: r.indexdef,
    })),
    uniqueActivePersonIndex: !!activeUnique,
    rowCount: count.rows[0].n,
  };
  fs.mkdirSync(path.join(root, 'tmp', 'mc1-haider-profile'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'tmp', 'mc1-haider-profile', 'migration-028-cloud.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await c.end();
})().catch((e) => {
  console.error(
    JSON.stringify({
      status: 'FAILED',
      error: String(e.message || e).slice(0, 500),
    }),
  );
  process.exit(1);
});
