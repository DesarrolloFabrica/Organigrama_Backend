/**
 * Read-only cohort inventory for 8F (no PII in stdout).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';

const ROOT = resolve(__dirname, '..');

function loadEnv(path: string) {
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

function packExists(root: string, prefix: string): string | null {
  if (!existsSync(root)) return null;
  const dirs = readdirSync(root)
    .filter((n) => n.startsWith(prefix))
    .map((n) => join(root, n))
    .filter((p) => statSync(p).isDirectory())
    .sort();
  return dirs.length ? dirs[dirs.length - 1] : null;
}

async function main() {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const mde = loadEnv(resolve(ROOT, 'secrets/mc1-mde.local.env'));
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
      SELECT s.id::text AS snapshot_id,
             length(coalesce(s.normalized_text,'')) AS text_len,
             left(regexp_replace(coalesce(s.normalized_text,''), '\\s+', ' ', 'g'), 400) AS text_head
      FROM organigrama.mc_cv_snapshot s
      WHERE s.normalized_text IS NOT NULL
      ORDER BY s.id
      LIMIT 40
    `);
    const inventory = rows.map((r: { snapshot_id: string; text_len: number; text_head: string }) => {
      const head = String(r.text_head || '').toLowerCase();
      const hints: string[] = [];
      if (/react|node|typescript|backend|frontend|\bapi\b|software|desarrollador|engineer|java|python|nestjs/.test(head))
        hints.push('SE_HINT');
      if (/dise[nñ]o|illustr|photoshop|brand|editorial|gr[aá]fic|figma|indesign/.test(head))
        hints.push('VD_HINT');
      if (/docen|educ|instruc|curso|pedag|lms|moodle|formaci[oó]n|taller/.test(head))
        hints.push('ED_HINT');
      if (/admin|contab|finanzas|operaci|oficina|secretar|asistente|gestion|gestión|rrhh|humano/.test(head))
        hints.push('ADMIN_HINT');
      if (/investig|tesis|publicaci[oó]n|universidad|acad[eé]m|paper|journal/.test(head))
        hints.push('ACAD_HINT');
      if (/audiovis|video|cine|edici[oó]n de video|premiere|after effects/.test(head))
        hints.push('AV_HINT');
      if (/market|seo|campa[nñ]a digital|social media|community/.test(head))
        hints.push('MKT_HINT');
      return {
        snapshotId: r.snapshot_id,
        textLen: Number(r.text_len),
        hints,
        p1: !!(
          packExists(resolve(ROOT, 'tmp/mc1-p1-prototype'), `P1P-V11-6I-S${r.snapshot_id}-`) ||
          packExists(resolve(ROOT, 'tmp/mc1-p1-prototype'), `P1P-V11-S${r.snapshot_id}-`) ||
          (r.snapshot_id === '1' &&
            packExists(resolve(ROOT, 'tmp/mc1-p1-prototype'), 'P1P-V11-20260805205709-'))
        ),
        p2: !!packExists(resolve(ROOT, 'tmp/mc1-p2-functional'), `P2F-8A2-S${r.snapshot_id}-`),
        r1: !!packExists(resolve(ROOT, 'tmp/mc1-r1-functional'), `R1F-8A2-S${r.snapshot_id}-`),
        p3: !!packExists(resolve(ROOT, 'tmp/mc1-p3-functional'), `P3F-8B2-S${r.snapshot_id}-`),
        p4: !!packExists(resolve(ROOT, 'tmp/mc1-p4-functional'), `P4F-8D-S${r.snapshot_id}-`),
        prof: !!packExists(resolve(ROOT, 'tmp/mc1-profile-pilot'), `PROF-8E-S${r.snapshot_id}-`),
      };
    });
    console.log(JSON.stringify({ phase: '8F', inventory }, null, 2));
  } finally {
    await ds.destroy();
  }
}

main().catch((e) => {
  console.log(JSON.stringify({ status: 'FAILED', error: String(e.message || e).slice(0, 300) }));
  process.exit(1);
});
