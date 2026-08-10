import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';

const ROOT = resolve(__dirname, '..');

function load(path: string) {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    out[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }
  return out;
}

async function main() {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const mde = load(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  assertMdeTarget({
    host: mde.MDE_DB_HOST,
    port: Number(mde.MDE_DB_PORT),
    database: mde.MDE_DB_NAME,
  });
  const ds = new DataSource({
    type: 'postgres',
    host: mde.MDE_DB_HOST,
    port: Number(mde.MDE_DB_PORT),
    username: mde.MDE_DB_USERNAME,
    password: mde.MDE_DB_PASSWORD,
    database: mde.MDE_DB_NAME,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();
  try {
    const rows = await ds.query(`
      SELECT id::text AS id,
        (normalized_text ~* '(react|nestjs|typescript|javascript|python|\\bjava\\b|backend|frontend|api rest|microservicio|software engineer|desarrollador de software|\\bsql\\b|postgres|docker|kubernetes)') AS se,
        (normalized_text ~* '(administrat|contabil|finanzas|operaciones|asistente administr|oficina|recursos humanos|\\brrhh\\b)') AS admin,
        (normalized_text ~* '(docen|pedagog|instruccional|curricul|universidad|investigaci|acad)') AS acad,
        (normalized_text ~* '(dise.o gr|branding|editorial|illustrator|photoshop|figma)') AS vd,
        (normalized_text ~* '(audiovis|vide.grafo|edici.n de video|productor audiovisual)') AS av,
        (normalized_text ~* '(marketing digital|community manager|seo|campa.a digital)') AS mkt
      FROM organigrama.mc_cv_snapshot
      WHERE normalized_text IS NOT NULL
      ORDER BY id
    `);
    console.log(JSON.stringify({ flags: rows }, null, 2));
  } finally {
    await ds.destroy();
  }
}

main().catch((e) => {
  console.log(JSON.stringify({ error: String(e.message || e).slice(0, 250) }));
  process.exit(1);
});
