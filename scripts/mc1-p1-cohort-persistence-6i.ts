/**
 * FASE 6I — Validación de persistencia P1 en cohorte pequeña (snaps 2,6,7,5).
 * Lineage LAB · PERSIST_MDE · sin DEFAULT · sin P2 · sin Cloud.
 *
 *   npx ts-node --transpile-only scripts/mc1-p1-cohort-persistence-6i.ts --persist-mde --confirm
 *
 * Si packs OBS carecen de decisions, regenerar antes:
 *   npx ts-node --transpile-only scripts/mc1-p1-6i-regen.ts --snapshots=5,6,7 --confirm
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import {
  COHORT_6I_ROLES,
  COHORT_6I_SNAPSHOT_IDS,
  packHasDecisions,
  resolveCohortArtifactDir,
  type Cohort6ISnapshotId,
} from '../src/mc-pipeline/p1-persistence/p1-artifact-pack-loader';
import { P1RunnerPersistenceAdapter } from '../src/mc-pipeline/p1-persistence/p1-runner-persistence-adapter';
import { createP1PersistenceService } from '../src/mc-pipeline/p1-persistence/p1-persistence.service';

const ROOT = resolve(__dirname, '..');
const CAMPAIGN = 'MC1-P1-6I-COHORT';
const RUN_TAG = `6i-${Date.now()}`;

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

function parseArgs(argv: string[]) {
  return {
    persistMde: argv.includes('--persist-mde'),
    confirm: argv.includes('--confirm'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const mde = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const target = {
    host: mde.MDE_DB_HOST,
    port: Number(mde.MDE_DB_PORT),
    database: mde.MDE_DB_NAME,
  };
  try {
    assertMdeTarget(target);
  } catch {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'MDE_GUARD_FAILED' }));
    process.exit(2);
  }
  if (!args.persistMde || !args.confirm) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'PERSIST_MDE_REQUIRES_CONFIRM',
        hint: '--persist-mde --confirm',
      }),
    );
    process.exit(2);
  }

  // Preflight: decisions available for all cohort members
  const missingDecisions: string[] = [];
  for (const id of COHORT_6I_SNAPSHOT_IDS) {
    const dir = resolveCohortArtifactDir(ROOT, id);
    if (!dir || !packHasDecisions(dir)) missingDecisions.push(id);
  }
  if (missingDecisions.length) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'PACKS_MISSING_DECISIONS',
        snapshots: missingDecisions,
        hint: 'npx ts-node --transpile-only scripts/mc1-p1-6i-regen.ts --snapshots=5,6,7 --confirm',
      }),
    );
    process.exit(3);
  }

  const ds = new DataSource({
    type: 'postgres',
    host: target.host,
    port: Number(target.port),
    username: mde.MDE_DB_USERNAME,
    password: mde.MDE_DB_PASSWORD,
    database: target.database,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();

  const priorDefaults: Record<string, string | null> = {};
  for (const id of COHORT_6I_SNAPSHOT_IDS) {
    const rows = await ds.query(
      `SELECT p1_run_id FROM organigrama.mc_p1_run_cursor
        WHERE snapshot_id = $1 AND lineage_key = 'DEFAULT'`,
      [id],
    );
    priorDefaults[id] = rows[0]?.p1_run_id ?? null;
  }

  const adapter = P1RunnerPersistenceAdapter.create({
    mode: 'PERSIST_MDE',
    dataSource: ds,
    mdeTarget: target,
    confirmPersist: true,
  });
  const defaultMode = createP1PersistenceService({ mode: 'ARTIFACT_ONLY' });

  type MemberRow = {
    snapshot: string;
    role: string;
    plan: string;
    run: string | null;
    batches: number | null;
    finalStatus: string | null;
    cursor: boolean;
    equivalenceIdentical: boolean;
    diffs: Record<string, number | string>;
    reviewRequired: number;
    reviewItemsOpen: number;
    labVisibleP2: number;
    geminiInvoked: boolean;
    interrupt?: boolean;
  };

  const members: MemberRow[] = [];
  let interruptOk = false;

  try {
    for (const snapshotId of COHORT_6I_SNAPSHOT_IDS) {
      const role = COHORT_6I_ROLES[snapshotId as Cohort6ISnapshotId];
      const interrupt = snapshotId === '6';
      const result = await adapter.runSnapshotPilot({
        backendRoot: ROOT,
        snapshotId,
        pipelineRunId: `${RUN_TAG}-s${snapshotId}`,
        campaignId: CAMPAIGN,
        simulateBatchInterrupt: interrupt,
        deferCursor: false,
      });

      if (interrupt) interruptOk = result.batchesPersisted > 0 && result.equivalence?.identical === true;

      let reviewItemsOpen = 0;
      let labVisibleP2 = 0;
      if (result.p1RunId) {
        const ri = await ds.query(
          `SELECT COUNT(*)::int AS n FROM organigrama.mc_evidence_review_item
            WHERE p1_run_id = $1 AND queue_status = 'OPEN'`,
          [result.p1RunId],
        );
        reviewItemsOpen = ri[0].n;
        const vis = await ds.query(
          `SELECT COUNT(*)::int AS n FROM organigrama.v_mc_p1_canonical_evidence_for_p2
            WHERE p1_run_id = $1`,
          [result.p1RunId],
        );
        labVisibleP2 = vis[0].n;
      }

      const eq = result.equivalence;
      const diffOf = (metric: string) => {
        const row = eq?.rows.find((r) => r.metric === metric);
        return row?.diff ?? 'n/a';
      };

      members.push({
        snapshot: snapshotId,
        role,
        plan: result.plan.outcome,
        run: result.p1RunId,
        batches: result.batchesPersisted || result.memoryMetrics?.batchCount || null,
        finalStatus: result.finalizeStatus,
        cursor: result.cursor?.advanced === true || result.plan.outcome === 'REUSE',
        equivalenceIdentical: eq?.identical === true,
        diffs: {
          candidates: diffOf('candidates'),
          decisions: diffOf('decisions'),
          units: diffOf('units'),
          offsets: eq?.offsetsMatch ? 0 : 1,
          review: diffOf('reviewRequired'),
        },
        reviewRequired: result.memoryMetrics?.reviewRequired ?? 0,
        reviewItemsOpen,
        labVisibleP2,
        geminiInvoked: result.geminiInvoked,
        interrupt: interrupt || undefined,
      });
    }

    // Second full cohort pass → REUSE
    const reusePass: Array<{ snapshot: string; plan: string; gemini: boolean }> = [];
    for (const snapshotId of COHORT_6I_SNAPSHOT_IDS) {
      const r = await adapter.runSnapshotPilot({
        backendRoot: ROOT,
        snapshotId,
        pipelineRunId: `${RUN_TAG}-reuse-s${snapshotId}`,
        campaignId: CAMPAIGN,
      });
      reusePass.push({
        snapshot: snapshotId,
        plan: r.plan.outcome,
        gemini: r.geminiInvoked,
      });
    }

    // Aggregate totals
    const art = { candidates: 0, units: 0, explicit: 0, stronglySupported: 0, inferred: 0, reviewRequired: 0 };
    const kindArt: Record<string, number> = {};
    const bd = { candidates: 0, units: 0, explicit: 0, stronglySupported: 0, inferred: 0, reviewRequired: 0 };
    const kindBd: Record<string, number> = {};

    for (const m of members) {
      if (!m.run) continue;
      const mem = await adapter.loadMemoryArtifact({
        backendRoot: ROOT,
        snapshotId: m.snapshot,
      });
      art.candidates += mem.metrics.candidateCount;
      art.units += mem.metrics.unitCount;
      art.explicit += mem.metrics.explicit;
      art.stronglySupported += mem.metrics.stronglySupported;
      art.inferred += mem.metrics.inferred;
      art.reviewRequired += mem.metrics.reviewRequired;
      for (const [k, v] of Object.entries(mem.metrics.evidenceKindTotals)) {
        kindArt[k] = (kindArt[k] ?? 0) + v;
      }

      const row = await ds.query(
        `SELECT
           (SELECT COUNT(*)::int FROM organigrama.mc_evidence_candidate WHERE p1_run_id=$1) AS c,
           (SELECT COUNT(*)::int FROM organigrama.mc_evidence_unit WHERE p1_run_id=$1) AS u,
           (SELECT COUNT(*)::int FROM organigrama.mc_evidence_unit WHERE p1_run_id=$1 AND explicitness='EXPLICIT') AS ex,
           (SELECT COUNT(*)::int FROM organigrama.mc_evidence_unit WHERE p1_run_id=$1 AND explicitness='STRONGLY_SUPPORTED') AS st,
           (SELECT COUNT(*)::int FROM organigrama.mc_evidence_unit WHERE p1_run_id=$1 AND explicitness='INFERRED') AS inf,
           (SELECT COUNT(*)::int FROM organigrama.mc_evidence_candidate_decision WHERE p1_run_id=$1 AND decision='REVIEW_REQUIRED') AS rr`,
        [m.run],
      );
      bd.candidates += row[0].c;
      bd.units += row[0].u;
      bd.explicit += row[0].ex;
      bd.stronglySupported += row[0].st;
      bd.inferred += row[0].inf;
      bd.reviewRequired += row[0].rr;

      const kinds = await ds.query(
        `SELECT evidence_kind, COUNT(*)::int AS n FROM organigrama.mc_evidence_unit
          WHERE p1_run_id=$1 GROUP BY evidence_kind`,
        [m.run],
      );
      for (const k of kinds) {
        kindBd[k.evidence_kind] = (kindBd[k.evidence_kind] ?? 0) + k.n;
      }
    }

    const aggregateRows: Array<{
      metric: string;
      artifacts: number;
      bd: number;
      diff: number;
    }> = (
      [
        'candidates',
        'units',
        'explicit',
        'stronglySupported',
        'inferred',
        'reviewRequired',
      ] as const
    ).map((metric) => ({
      metric,
      artifacts: art[metric],
      bd: bd[metric],
      diff: bd[metric] - art[metric],
    }));
    for (const k of new Set([...Object.keys(kindArt), ...Object.keys(kindBd)])) {
      aggregateRows.push({
        metric: `kind:${k}`,
        artifacts: kindArt[k] ?? 0,
        bd: kindBd[k] ?? 0,
        diff: (kindBd[k] ?? 0) - (kindArt[k] ?? 0),
      });
    }

    // DEFAULT intact
    const defaultIntact: Record<string, boolean> = {};
    for (const id of COHORT_6I_SNAPSHOT_IDS) {
      const rows = await ds.query(
        `SELECT p1_run_id FROM organigrama.mc_p1_run_cursor
          WHERE snapshot_id = $1 AND lineage_key = 'DEFAULT'`,
        [id],
      );
      defaultIntact[id] =
        String(rows[0]?.p1_run_id ?? '') === String(priorDefaults[id] ?? '');
    }

    const snap6 = members.find((m) => m.snapshot === '6');
    const allIdentical = members.every((m) => m.equivalenceIdentical);
    const allCompleted = members.every(
      (m) =>
        m.finalStatus === 'COMPLETED' ||
        m.finalStatus === 'COMPLETED_WITH_WARNINGS' ||
        m.plan === 'REUSE',
    );
    const allReuse = reusePass.every((r) => r.plan === 'REUSE' && !r.gemini);
    const noLabInP2 = members.every((m) => m.labVisibleP2 === 0);
    const defaultsOk = Object.values(defaultIntact).every(Boolean);
    const aggregateOk = aggregateRows.every((r) => r.diff === 0);
    const snap6ReviewOk =
      !!snap6 &&
      snap6.reviewRequired === snap6.reviewItemsOpen &&
      snap6.reviewRequired >= 1;

    const accepted =
      allIdentical &&
      allCompleted &&
      allReuse &&
      noLabInP2 &&
      defaultsOk &&
      aggregateOk &&
      interruptOk &&
      snap6ReviewOk &&
      !defaultMode.hasDbWriter;

    const warnings: string[] = [];
    if (snap6 && snap6.reviewRequired !== 8) {
      warnings.push(
        `snap6 REVIEW_REQUIRED=${snap6.reviewRequired} (OBS signature had 8; pack regenerated may differ)`,
      );
    }

    const status = !accepted
      ? 'PERSISTENCE_CORRECTION_REQUIRED'
      : warnings.length
        ? 'P1_PERSISTENCE_VALIDATED_WITH_WARNINGS'
        : 'P1_PERSISTENCE_VALIDATED';

    console.log(
      JSON.stringify(
        {
          phase: '6I',
          status,
          defaultModeHasWriter: defaultMode.hasDbWriter,
          campaign: CAMPAIGN,
          lineage: 'LAB',
          members,
          snap6Review: {
            decisions: snap6?.reviewRequired ?? null,
            reviewItemsOpen: snap6?.reviewItemsOpen ?? null,
            labVisibleP2: snap6?.labVisibleP2 ?? null,
            artificialResolution: false,
          },
          aggregate: aggregateRows,
          idempotency: {
            reusePass,
            interruptOn: '6',
            interruptOk,
          },
          isolation: {
            labVisibleP2: members.map((m) => ({
              snapshot: m.snapshot,
              n: m.labVisibleP2,
            })),
            defaultIntact,
          },
          warnings,
          closure: accepted
            ? 'P1_PERSISTENCE_LAYER_ACCEPTED'
            : 'REPEAT_PHASE_6I',
        },
        null,
        2,
      ),
    );

    await ds.destroy();
    process.exit(accepted ? 0 : 1);
  } catch (e) {
    console.log(
      JSON.stringify({
        status: 'FAILED',
        error: String(e instanceof Error ? e.message : e).slice(0, 300),
      }),
    );
    await ds.destroy().catch(() => undefined);
    process.exit(1);
  }
}

main();
