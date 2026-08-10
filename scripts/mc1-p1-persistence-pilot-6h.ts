/**
 * FASE 6H — Piloto P1 persistido en MDE (snapshot 1, lineage LAB).
 *
 * Modo predeterminado: ARTIFACT_ONLY (sin writers).
 * Persistencia: --persist-mde --confirm
 *
 *   npx ts-node --transpile-only scripts/mc1-p1-persistence-pilot-6h.ts
 *   npx ts-node --transpile-only scripts/mc1-p1-persistence-pilot-6h.ts --persist-mde --confirm
 *
 * Sin PII / texto CV / prompts / secretos / raw Gemini en la salida.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { createP1PersistenceService } from '../src/mc-pipeline/p1-persistence/p1-persistence.service';
import {
  P1RunnerPersistenceAdapter,
  buildPilotRunConfig,
} from '../src/mc-pipeline/p1-persistence/p1-runner-persistence-adapter';
import { computeConfigFingerprint } from '../src/mc-pipeline/p1-persistence/p1-config-fingerprint';

const ROOT = resolve(__dirname, '..');
const PIPELINE_ID = `6h-pilot-snap1-${Date.now()}`;

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

  const mode = args.persistMde ? 'PERSIST_MDE' : 'ARTIFACT_ONLY';
  if (mode === 'PERSIST_MDE' && !args.confirm) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'PERSIST_MDE_REQUIRES_CONFIRM',
        hint: 'pass --persist-mde --confirm',
      }),
    );
    process.exit(2);
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

  const priorDefault = await ds.query(
    `SELECT p1_run_id, previous_p1_run_id, promoted_reason
       FROM organigrama.mc_p1_run_cursor
      WHERE snapshot_id = 1 AND lineage_key = 'DEFAULT'`,
  );
  const priorLab = await ds.query(
    `SELECT p1_run_id, previous_p1_run_id, promoted_reason
       FROM organigrama.mc_p1_run_cursor
      WHERE snapshot_id = 1 AND lineage_key = 'LAB'`,
  );

  const adapter = P1RunnerPersistenceAdapter.create({
    mode,
    dataSource: ds,
    mdeTarget: target,
    confirmPersist: args.confirm,
  });

  const defaultModeCheck = createP1PersistenceService({ mode: 'ARTIFACT_ONLY' });
  const report: Record<string, unknown> = {
    phase: '6H',
    defaultMode: 'ARTIFACT_ONLY',
    executedMode: mode,
    defaultHasDbWriter: defaultModeCheck.hasDbWriter,
    executedHasDbWriter: mode === 'PERSIST_MDE',
    snapshotId: '1',
    lineage: 'LAB',
    geminiInvoked: false,
    artifactPolicy: 'ARTIFACT_REUSED',
  };

  try {
    if (mode === 'ARTIFACT_ONLY') {
      const mem = await adapter.loadSnapshot1MemoryArtifact({
        backendRoot: ROOT,
        snapshotId: '1',
      });
      report.status = 'ARTIFACT_ONLY_OK';
      report.memoryMetrics = mem.metrics;
      report.prototypeId = mem.prototypeId;
      report.source = mem.source;
      console.log(JSON.stringify(report, null, 2));
      await ds.destroy();
      process.exit(0);
    }

    // --- Persist path ---
    const run1 = await adapter.runSnapshot1Pilot({
      backendRoot: ROOT,
      snapshotId: '1',
      pipelineRunId: PIPELINE_ID,
      simulateBatchInterrupt: true,
      deferCursor: true,
    });

    if (!run1.p1RunId || !run1.equivalence?.identical) {
      report.status = 'INTEGRATION_CORRECTION_REQUIRED';
      report.run1 = {
        plan: run1.plan.outcome,
        finalizeStatus: run1.finalizeStatus,
        equivalence: run1.equivalence,
        batchesPersisted: run1.batchesPersisted,
      };
      console.log(JSON.stringify(report, null, 2));
      await ds.destroy();
      process.exit(1);
    }

    const cursorReconcile = await adapter.reconcileLabCursor('1', run1.p1RunId);

    // Segunda ejecución → REUSE, sin Gemini, sin duplicar
    const run2 = await adapter.runSnapshot1Pilot({
      backendRoot: ROOT,
      snapshotId: '1',
      pipelineRunId: `${PIPELINE_ID}-retry`,
    });

    const labInCanonical = await ds.query(
      `SELECT COUNT(*)::int AS n
         FROM organigrama.v_mc_p1_canonical_evidence_for_p2
        WHERE p1_run_id = $1`,
      [run1.p1RunId],
    );
    const afterDefault = await ds.query(
      `SELECT p1_run_id FROM organigrama.mc_p1_run_cursor
        WHERE snapshot_id = 1 AND lineage_key = 'DEFAULT'`,
    );
    const labCursor = await ds.query(
      `SELECT p1_run_id FROM organigrama.mc_p1_run_cursor
        WHERE snapshot_id = 1 AND lineage_key = 'LAB'`,
    );
    const runRow = await ds.query(
      `SELECT status, decision_coverage, unsupported_span_count, failed_batch_count,
              config_fingerprint, attempt_no
         FROM organigrama.mc_p1_run WHERE id = $1`,
      [run1.p1RunId],
    );
    const batchStatuses = await ds.query(
      `SELECT status, COUNT(*)::int AS n FROM organigrama.mc_evidence_batch
        WHERE p1_run_id = $1 GROUP BY status`,
      [run1.p1RunId],
    );

    const expectedFp = computeConfigFingerprint(
      buildPilotRunConfig({ pipelineRunId: PIPELINE_ID }),
    );
    // fingerprint ignores pipelineRunId — same fp for retry
    void expectedFp;

    const defaultIntact =
      String(priorDefault[0]?.p1_run_id ?? '') ===
      String(afterDefault[0]?.p1_run_id ?? '');

    const accepted =
      run1.equivalence.identical &&
      run2.plan.outcome === 'REUSE' &&
      run2.geminiInvoked === false &&
      Number(labInCanonical[0].n) === 0 &&
      defaultIntact &&
      labCursor[0]?.p1_run_id === run1.p1RunId &&
      cursorReconcile.second.noop === true &&
      Number(runRow[0].decision_coverage) === 1 &&
      Number(runRow[0].unsupported_span_count) === 0 &&
      (runRow[0].status === 'COMPLETED' ||
        runRow[0].status === 'COMPLETED_WITH_WARNINGS');

    report.status = accepted
      ? run1.finalizeStatus === 'COMPLETED_WITH_WARNINGS'
        ? 'P1_PERSISTENCE_PILOT_ACCEPTED_WITH_WARNINGS'
        : 'P1_PERSISTENCE_PILOT_ACCEPTED'
      : 'INTEGRATION_CORRECTION_REQUIRED';
    report.execution = {
      plan: run1.plan.outcome,
      p1RunId: run1.p1RunId,
      attemptNo: runRow[0]?.attempt_no,
      artifactSource: run1.artifactSource,
      geminiInvoked: run1.geminiInvoked,
      batchesPersisted: run1.batchesPersisted,
      batchStatuses,
      finalizeStatus: run1.finalizeStatus,
      decisionCoverage: Number(runRow[0]?.decision_coverage),
      unsupportedSpans: Number(runRow[0]?.unsupported_span_count),
      configFingerprintPrefix: String(runRow[0]?.config_fingerprint ?? '').slice(0, 12),
    };
    report.equivalence = {
      identical: run1.equivalence.identical,
      rows: run1.equivalence.rows,
      decisions: run1.equivalence.decisionsMatch,
      units: run1.equivalence.unitsMatch,
      offsets: run1.equivalence.offsetsMatch,
      kinds: run1.equivalence.kindsMatch,
      explicitness: run1.equivalence.explicitnessMatch,
      links: run1.equivalence.linksMatch,
      duplicates: run1.equivalence.duplicates,
    };
    report.idempotency = {
      secondPlan: run2.plan.outcome,
      secondGemini: run2.geminiInvoked,
      interruptSimulated: true,
      cursorFirstNoop: cursorReconcile.first.noop,
      cursorSecondNoop: cursorReconcile.second.noop,
    };
    report.canonicalView = {
      labRunVisibleForP2: Number(labInCanonical[0].n) > 0,
      defaultCursorIntact: defaultIntact,
      labCursorPointsToPilot: labCursor[0]?.p1_run_id === run1.p1RunId,
    };
    report.priorLabRestoredHint =
      priorLab[0] && priorLab[0].p1_run_id !== run1.p1RunId
        ? 'LAB cursor superseded prior lab pointer; history retained via previous_p1_run_id'
        : 'LAB cursor set/kept for pilot';

    console.log(JSON.stringify(report, null, 2));
    await ds.destroy();
    process.exit(accepted ? 0 : 1);
  } catch (e) {
    console.log(
      JSON.stringify({
        status: 'FAILED',
        error: String(e instanceof Error ? e.message : e).slice(0, 240),
      }),
    );
    await ds.destroy().catch(() => undefined);
    process.exit(1);
  }
}

main();
