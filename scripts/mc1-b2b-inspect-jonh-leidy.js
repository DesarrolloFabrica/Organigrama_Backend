const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv(p) {
  const o = {};
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
  const m = loadEnv(path.join(__dirname, '..', 'secrets', 'mc1-mde.local.env'));
  const c = new Client({
    host: m.MDE_DB_HOST,
    port: Number(m.MDE_DB_PORT),
    database: m.MDE_DB_NAME,
    user: m.MDE_DB_USERNAME,
    password: m.MDE_DB_PASSWORD,
  });
  await c.connect();
  const rows = await c.query(
    `SELECT id::text, person_cv_id::text, parse_status, page_count,
            length(COALESCE(normalized_text,'')) nlen,
            left(COALESCE(normalized_text,''), 400) AS sample,
            sectioned_content IS NULL AS sectioned_null
       FROM organigrama.mc_cv_snapshot
      WHERE person_cv_id IN (197, 195)
      ORDER BY id DESC`,
  );
  console.log(JSON.stringify(rows.rows, null, 2));
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
