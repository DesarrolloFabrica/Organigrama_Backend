/**
 * Lectura post-6I de runs/cursors MDE (sin secretos en stdout).
 *   npx ts-node --transpile-only scripts/mc1-p1-6i-mde-check.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';

const ROOT = resolve(__dirname, '..');
const RUNS = [
  '6948ae7f-119e-4b32-a24c-f7fe7c2aa7c2',
  'e2bc4630-afbb-497b-8a83-be99e047e0a5',
  'cb8a8fac-e0f8-4488-8f4d-d21fab3e7fa7',
  '857262cc-59d7-487f-9565-1814ea8fb312',
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
  const mde = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  assertMdeTarget({
    host: mde.MDE_DB_HOST,
    port: Number(mde.MDE_DB_PORT),
    database: mde.MDE_DB_NAME,
  });
  const c = new Client({
    host: mde.MDE_DB_HOST,
    port: Number(mde.MDE_DB_PORT),
    user: mde.MDE_DB_USERNAME,
    password: mde.MDE_DB_PASSWORD,
    database: mde.MDE_DB_NAME,
  });
  await c.connect();
  try {
    const runs = await c.query(
      `SELECT id, snapshot_id, status, decision_coverage,
              unsupported_span_count, attempt_no, result_origin, campaign_id,
              (SELECT COUNT(*)::int FROM organigrama.mc_evidence_batch b WHERE b.p1_run_id=r.id) AS batches,
              (SELECT COUNT(*)::int FROM organigrama.mc_evidence_review_item i
                 WHERE i.p1_run_id=r.id AND i.queue_status='OPEN') AS review_open,
              (SELECT COUNT(*)::int FROM organigrama.v_mc_p1_canonical_evidence_for_p2 v
                 WHERE v.p1_run_id=r.id) AS p2_visible
         FROM organigrama.mc_p1_run r
        WHERE id = ANY($1::uuid[])
        ORDER BY snapshot_id`,
      [RUNS],
    );
    const cursors = await c.query(
      `SELECT snapshot_id::text, lineage_key, p1_run_id::text
         FROM organigrama.mc_p1_run_cursor
        WHERE snapshot_id = ANY($1::bigint[])
        ORDER BY snapshot_id, lineage_key`,
      [[2, 5, 6, 7]],
    );
    const lab = await c.query(
      `SELECT COUNT(*)::int AS n FROM organigrama.mc_p1_run
        WHERE result_origin='LAB' AND campaign_id='MC1-P1-6I-COHORT'`,
    );
    const defaults = await c.query(
      `SELECT COUNT(*)::int AS n FROM organigrama.mc_p1_run
        WHERE result_origin='PIPELINE' AND snapshot_id = ANY($1::bigint[])`,
      [[2, 5, 6, 7]],
    );
    console.log(
      JSON.stringify(
        {
          runs: runs.rows,
          cursors: cursors.rows,
          lab6iRuns: lab.rows[0].n,
          defaultRunsForCohort: defaults.rows[0].n,
        },
        null,
        2,
      ),
    );
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      status: 'FAILED',
      error: String(e instanceof Error ? e.message : e).slice(0, 240),
    }),
  );
  process.exit(1);
});
