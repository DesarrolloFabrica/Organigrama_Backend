/**
 * Diag 10A — resolve three real persons by name (technical IDs only).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';

const ROOT = resolve(__dirname, '..');

const NAMES = [
  { caseId: 'person-santiago-vanegas', nameLike: '%Santiago%Vanegas%Garc%' },
  { caseId: 'person-juan-pablo-sanabria', nameLike: '%Juan%Pablo%Sanabria%' },
  { caseId: 'person-camilo-ramirez', nameLike: '%Camilo%Ram%rez%Vargas%' },
];

function loadEnvFile(path: string) {
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
  const mde = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
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
  const out: unknown[] = [];
  try {
    for (const n of NAMES) {
      const resolved = await ds.query(
        `
        SELECT
          p.id AS person_id,
          p.document,
          pc.id AS person_cv_id,
          (
            SELECT s.id::text
            FROM organigrama.mc_cv_snapshot s
            WHERE s.person_cv_id = pc.id AND s.parse_status = 'PARSED'
              AND s.normalized_text IS NOT NULL AND length(s.normalized_text) > 0
            ORDER BY s.created_at DESC NULLS LAST, s.id DESC
            LIMIT 1
          ) AS ready_snapshot_id,
          (
            SELECT count(*)::int
            FROM organigrama.mc_cv_snapshot s
            WHERE s.person_cv_id = pc.id
          ) AS snapshot_count
        FROM core.person p
        LEFT JOIN organigrama.person_cv pc
          ON pc.person_id = p.id AND pc.is_active = true
        WHERE p.full_name ILIKE $1
        ORDER BY p.id
        LIMIT 5
        `,
        [n.nameLike],
      );
      out.push({
        caseId: n.caseId,
        matches: (resolved ?? []).map((r: Record<string, unknown>) => ({
          personId: r.person_id,
          document: r.document,
          personCvId: r.person_cv_id ?? null,
          readySnapshotId: r.ready_snapshot_id ?? null,
          snapshotCount: r.snapshot_count ?? 0,
        })),
      });
    }
  } finally {
    await ds.destroy();
  }
  console.log(JSON.stringify({ phase: '10A-diag', results: out }, null, 2));
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      status: 'FAILED',
      error: String(e instanceof Error ? e.message : e).slice(0, 400),
    }),
  );
  process.exit(1);
});
