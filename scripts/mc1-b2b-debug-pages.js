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
  const row = (
    await c.query(
      `SELECT pages, length(normalized_text) nlen, normalized_text
         FROM organigrama.mc_cv_snapshot WHERE id = 46`,
    )
  ).rows[0];
  const pages =
    typeof row.pages === 'string' ? JSON.parse(row.pages) : row.pages;
  const present = new Set();
  const re = /---PAGE\s+(\d+)---/gi;
  let m2;
  while ((m2 = re.exec(row.normalized_text))) present.add(Number(m2[1]));
  console.log(
    JSON.stringify(
      {
        pagesLen: pages?.length,
        pages: (pages || []).map((p, i) => ({
          n: p?.pageNumber ?? i + 1,
          chars: p?.characterCount,
          textLen: String(p?.text || '').trim().length,
          preview: String(p?.text || '')
            .trim()
            .slice(0, 60),
        })),
        presentPages: [...present],
        nlen: row.nlen,
      },
      null,
      2,
    ),
  );
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
