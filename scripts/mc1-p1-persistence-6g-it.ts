/**
 * FASE 6G — Suite de integración MDE para capa de persistencia P1.
 * Fixtures sintéticos (hashes); sin PII / texto CV / prompts / secretos en salida.
 *
 *   npx ts-node --transpile-only scripts/mc1-p1-persistence-6g-it.ts
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { P1_WARNING_POLICY_VERSION } from '../src/mc-pipeline/p1-persistence/p1-persistence.constants';
import { P1PersistenceError } from '../src/mc-pipeline/p1-persistence/p1-persistence.errors';
import { createP1PersistenceService } from '../src/mc-pipeline/p1-persistence/p1-persistence.service';
import { computeConfigFingerprint } from '../src/mc-pipeline/p1-persistence/p1-config-fingerprint';
import type {
  PersistBatchInput,
  P1RunConfig,
} from '../src/mc-pipeline/p1-persistence/p1-persistence.types';

const ROOT = resolve(__dirname, '..');
const PIPELINE_PREFIX = `6g-it-${Date.now()}`;

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

function fp(seed: string) {
  return createHash('sha256').update(seed).digest('hex');
}

type Check = { name: string; ok: boolean; detail?: string };

function ok(name: string, detail?: string): Check {
  return { name, ok: true, detail };
}
function fail(name: string, detail?: string): Check {
  return { name, ok: false, detail };
}

async function expectCode(
  name: string,
  code: string,
  fn: () => Promise<unknown>,
): Promise<Check> {
  try {
    await fn();
    return fail(name, 'expected error');
  } catch (e) {
    if (e instanceof P1PersistenceError && e.code === code) {
      return ok(name, code);
    }
    return fail(
      name,
      String(e instanceof Error ? e.message : e).slice(0, 160),
    );
  }
}

function baseConfig(overrides: Partial<P1RunConfig> = {}): P1RunConfig {
  return {
    contractCode: 'MC1.P1.EVIDENCE',
    contractVersion: '2.0.0',
    segmenterName: 'deterministic-evidence-candidate-segmenter',
    segmenterVersion: '1.1.0',
    promptVersion: 'MC1.P1.PROMPT.PROTOTYPE.1.1.0',
    modelProvider: 'google-genai',
    modelVersion: 'gemini-3.6-flash',
    batchBuilderVersion: '1.0.0',
    validatorVersion: '1.0.0',
    warningPolicyVersion: P1_WARNING_POLICY_VERSION,
    resultOrigin: 'LAB',
    lineageKey: 'LAB',
    campaignId: null,
    pipelineRunId: `${PIPELINE_PREFIX}-default`,
    ...overrides,
  };
}

function happyBatch(
  batchId: string,
  seed: string,
  opts?: { reviewRequired?: boolean; inferred?: boolean },
): PersistBatchInput {
  const c1 = `c-${seed}-1`;
  const review = opts?.reviewRequired === true;
  const inferred = opts?.inferred === true;
  const decision = review ? 'REVIEW_REQUIRED' : 'ACCEPTED';
  const units = review
    ? []
    : [
        {
          primaryCandidateId: c1,
          pageNumber: 1,
          startOffset: 10,
          endOffset: 20,
          spanTextHash: fp(`${seed}-span`),
          evidenceKind: 'ACTION',
          explicitness: (inferred ? 'INFERRED' : 'EXPLICIT') as
            | 'EXPLICIT'
            | 'INFERRED',
          decision: 'ACCEPTED' as const,
          reviewGate: (inferred ? 'PENDING_REVIEW' : 'NOT_REQUIRED') as
            | 'NOT_REQUIRED'
            | 'PENDING_REVIEW',
          contentFingerprint: fp(`${seed}-content`),
          normalizedActivity: 'SYNTH_ACTIVITY',
        },
      ];
  return {
    batchId,
    pageRangeStart: 1,
    pageRangeEnd: 1,
    candidates: [
      {
        candidateId: c1,
        pageNumber: 1,
        startOffset: 10,
        endOffset: 20,
        textHash: fp(`${seed}-text`),
        candidateType: 'SENTENCE',
      },
    ],
    decisions: [
      {
        candidateId: c1,
        decision,
        reasonCode: review ? 'NEEDS_REVIEW' : 'OK',
        reviewRequired: review,
      },
    ],
    units,
    validationStatus: 'OK',
    unsupportedSpanCount: 0,
  };
}

async function cleanup(ds: DataSource) {
  const like = `${PIPELINE_PREFIX}%`;
  await ds.transaction(async (manager) => {
    // Triggers de inmutabilidad bloquean DELETE en runs terminales — bypass solo MDE/lab.
    await manager.query(`SET LOCAL session_replication_role = 'replica'`);
    await manager.query(
      `DELETE FROM organigrama.mc_evidence_review_item
        WHERE p1_run_id IN (
          SELECT id FROM organigrama.mc_p1_run WHERE pipeline_run_id LIKE $1
        )`,
      [like],
    );
    await manager.query(
      `DELETE FROM organigrama.mc_evidence_unit_candidate_link
        WHERE p1_run_id IN (
          SELECT id FROM organigrama.mc_p1_run WHERE pipeline_run_id LIKE $1
        )`,
      [like],
    );
    await manager.query(
      `DELETE FROM organigrama.mc_evidence_unit
        WHERE p1_run_id IN (
          SELECT id FROM organigrama.mc_p1_run WHERE pipeline_run_id LIKE $1
        )`,
      [like],
    );
    await manager.query(
      `DELETE FROM organigrama.mc_evidence_candidate_decision
        WHERE p1_run_id IN (
          SELECT id FROM organigrama.mc_p1_run WHERE pipeline_run_id LIKE $1
        )`,
      [like],
    );
    await manager.query(
      `DELETE FROM organigrama.mc_evidence_candidate
        WHERE p1_run_id IN (
          SELECT id FROM organigrama.mc_p1_run WHERE pipeline_run_id LIKE $1
        )`,
      [like],
    );
    await manager.query(
      `DELETE FROM organigrama.mc_evidence_batch
        WHERE p1_run_id IN (
          SELECT id FROM organigrama.mc_p1_run WHERE pipeline_run_id LIKE $1
        )`,
      [like],
    );
    await manager.query(
      `DELETE FROM organigrama.mc_p1_run_cursor
        WHERE p1_run_id IN (
          SELECT id FROM organigrama.mc_p1_run WHERE pipeline_run_id LIKE $1
        )
        OR previous_p1_run_id IN (
          SELECT id FROM organigrama.mc_p1_run WHERE pipeline_run_id LIKE $1
        )`,
      [like],
    );
    await manager.query(
      `DELETE FROM organigrama.mc_p1_run WHERE pipeline_run_id LIKE $1`,
      [like],
    );
  });
}

async function main() {
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
  const checks: Check[] = [];

  // Modes without writer
  const dry = createP1PersistenceService({ mode: 'DRY_RUN' });
  checks.push(
    dry.hasDbWriter === false
      ? ok('mode_dry_run_no_writer')
      : fail('mode_dry_run_no_writer'),
  );
  const art = createP1PersistenceService({ mode: 'ARTIFACT_ONLY' });
  checks.push(
    art.hasDbWriter === false
      ? ok('mode_artifact_only_no_writer')
      : fail('mode_artifact_only_no_writer'),
  );

  const snap = await ds.query(
    `SELECT id FROM organigrama.mc_cv_snapshot ORDER BY id ASC LIMIT 1`,
  );
  if (!snap[0]) {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'NO_SNAPSHOT', checks }));
    await ds.destroy();
    process.exit(3);
  }
  const snapshotId = String(snap[0].id);
  const svc = createP1PersistenceService({ mode: 'PERSIST_MDE', dataSource: ds });

  const priorDefaultCursor = await ds.query(
    `SELECT p1_run_id, previous_p1_run_id, promoted_reason
       FROM organigrama.mc_p1_run_cursor
      WHERE snapshot_id = $1 AND lineage_key = 'DEFAULT'`,
    [snapshotId],
  );
  const priorLabCursor = await ds.query(
    `SELECT p1_run_id, previous_p1_run_id, promoted_reason
       FROM organigrama.mc_p1_run_cursor
      WHERE snapshot_id = $1 AND lineage_key = 'LAB'`,
    [snapshotId],
  );

  try {
    await cleanup(ds);

    // --- A lifecycle CREATE → start → finalize ---
    const cfgA = baseConfig({
      pipelineRunId: `${PIPELINE_PREFIX}-A`,
      // unique fingerprint via validatorVersion
      validatorVersion: `1.0.0-A-${randomUUID().slice(0, 8)}`,
    });
    const fpA = computeConfigFingerprint(cfgA);
    const planA = await svc.planRun(snapshotId, cfgA, fpA);
    checks.push(
      planA.outcome === 'CREATE'
        ? ok('A_create', planA.p1RunId)
        : fail('A_create', planA.outcome),
    );
    if (planA.outcome === 'CREATE') {
      await svc.startRun(planA.p1RunId);
      await svc.persistBatch(planA.p1RunId, happyBatch('b1', 'A1'));
      const fin = await svc.finalizeRun({
        p1RunId: planA.p1RunId,
        claimedMetrics: { candidateCount: 999, decisionCoverage: 0 },
      });
      checks.push(
        fin.status === 'COMPLETED' && fin.metrics.candidateCount === 1
          ? ok('A_finalize_ignores_claimed')
          : fail(
              'A_finalize_ignores_claimed',
              `${fin.status}:cand=${fin.metrics.candidateCount}:cov=${fin.metrics.decisionCoverage}`,
            ),
      );

      const reuse = await svc.planRun(snapshotId, cfgA, fpA);
      checks.push(
        reuse.outcome === 'REUSE'
          ? ok('A_reuse')
          : fail('A_reuse', reuse.outcome),
      );
    }

    // CONFLICT concurrent open
    const cfgC = baseConfig({
      pipelineRunId: `${PIPELINE_PREFIX}-C1`,
      validatorVersion: `1.0.0-C-${randomUUID().slice(0, 8)}`,
    });
    const fpC = computeConfigFingerprint(cfgC);
    const c1 = await svc.planRun(snapshotId, cfgC, fpC);
    const c2 = await svc.planRun(
      snapshotId,
      { ...cfgC, pipelineRunId: `${PIPELINE_PREFIX}-C2` },
      fpC,
    );
    checks.push(
      c1.outcome === 'CREATE' && c2.outcome === 'CONFLICT'
        ? ok('A_conflict')
        : fail('A_conflict', `${c1.outcome}/${c2.outcome}`),
    );

    // RESUME same pipeline
    if (c1.outcome === 'CREATE') {
      const resume = await svc.planRun(snapshotId, cfgC, fpC, {
        resumeIfSamePipeline: true,
      });
      checks.push(
        resume.outcome === 'RESUME'
          ? ok('A_resume')
          : fail('A_resume', resume.outcome),
      );
      await svc.failRun(c1.p1RunId, 'TEST_FAIL');
    }

    // new attempt after FAILED
    const afterFail = await svc.planRun(
      snapshotId,
      { ...cfgC, pipelineRunId: `${PIPELINE_PREFIX}-C3` },
      fpC,
    );
    checks.push(
      afterFail.outcome === 'CREATE' && afterFail.attemptNo >= 2
        ? ok('A_new_attempt_after_failed', String(afterFail.attemptNo))
        : fail('A_new_attempt_after_failed', afterFail.outcome),
    );
    if (afterFail.outcome === 'CREATE') {
      await svc.cancelRun(afterFail.p1RunId);
    }

    // --- B atomicity ---
    const cfgB = baseConfig({
      pipelineRunId: `${PIPELINE_PREFIX}-B`,
      validatorVersion: `1.0.0-B-${randomUUID().slice(0, 8)}`,
    });
    const planB = await svc.planRun(
      snapshotId,
      cfgB,
      computeConfigFingerprint(cfgB),
    );
    if (planB.outcome === 'CREATE') {
      await svc.startRun(planB.p1RunId);
      const bad = happyBatch('bad', 'Bbad');
      bad.candidates[0].textHash = 'not-a-valid-hash';
      checks.push(
        await expectCode('B_atomic_rollback', 'PERSISTENCE_CONFLICT', () =>
          svc.persistBatch(planB.p1RunId, bad),
        ),
      );
      const counts = await ds.query(
        `SELECT
           (SELECT COUNT(*)::int FROM organigrama.mc_evidence_candidate WHERE p1_run_id=$1) AS c,
           (SELECT COUNT(*)::int FROM organigrama.mc_evidence_candidate_decision WHERE p1_run_id=$1) AS d,
           (SELECT COUNT(*)::int FROM organigrama.mc_evidence_unit WHERE p1_run_id=$1) AS u,
           (SELECT COUNT(*)::int FROM organigrama.mc_evidence_review_item WHERE p1_run_id=$1) AS r`,
        [planB.p1RunId],
      );
      checks.push(
        counts[0].c === 0 &&
          counts[0].d === 0 &&
          counts[0].u === 0 &&
          counts[0].r === 0
          ? ok('B_zero_artifacts_after_rollback')
          : fail('B_zero_artifacts_after_rollback', JSON.stringify(counts[0])),
      );

      const good = await svc.persistBatch(
        planB.p1RunId,
        happyBatch('b-ok', 'Bok', { reviewRequired: true }),
      );
      checks.push(
        good.reviewItemCount >= 1
          ? ok('B_review_required_open')
          : fail('B_review_required_open'),
      );
      const again = await svc.persistBatch(
        planB.p1RunId,
        happyBatch('b-ok', 'Bok', { reviewRequired: true }),
      );
      checks.push(again.noop === true ? ok('B_succeeded_noop') : fail('B_succeeded_noop'));
      await svc.finalizeRun({ p1RunId: planB.p1RunId }); // PARTIAL or COMPLETED with RR
    }

    // --- C finalization guards ---
    const cfgF = baseConfig({
      pipelineRunId: `${PIPELINE_PREFIX}-F`,
      validatorVersion: `1.0.0-F-${randomUUID().slice(0, 8)}`,
    });
    const planF = await svc.planRun(
      snapshotId,
      cfgF,
      computeConfigFingerprint(cfgF),
    );
    if (planF.outcome === 'CREATE') {
      await svc.startRun(planF.p1RunId);
      const orphanCand = happyBatch('f1', 'F1');
      // persist then mark failed another batch path
      await svc.persistBatch(planF.p1RunId, orphanCand);
      // incomplete: add candidate without decision via raw would break; instead markBatchFailed extra
      await svc.markBatchFailed({
        p1RunId: planF.p1RunId,
        batchId: 'f-fail',
        errorCode: 'BATCH_ERR',
      });
      checks.push(
        await expectCode(
          'C_failed_batch_blocks_completed',
          'INCOMPLETE_CANDIDATE_COVERAGE',
          () =>
            svc.finalizeRun({
              p1RunId: planF.p1RunId,
              preferredTerminal: 'COMPLETED',
            }),
        ),
      );
      // PARTIAL should work
      const partial = await svc.finalizeRun({
        p1RunId: planF.p1RunId,
        preferredTerminal: 'PARTIAL',
      });
      checks.push(
        partial.status === 'PARTIAL'
          ? ok('C_partial_ok')
          : fail('C_partial_ok', `${partial.status}`),
      );
    }

    const cfgW = baseConfig({
      pipelineRunId: `${PIPELINE_PREFIX}-W`,
      validatorVersion: `1.0.0-W-${randomUUID().slice(0, 8)}`,
    });
    const planW = await svc.planRun(
      snapshotId,
      cfgW,
      computeConfigFingerprint(cfgW),
    );
    if (planW.outcome === 'CREATE') {
      await svc.startRun(planW.p1RunId);
      await svc.persistBatch(planW.p1RunId, happyBatch('w1', 'W1'));
      checks.push(
        await expectCode('C_unknown_warning', 'UNKNOWN_WARNING_CODE', () =>
          svc.finalizeRun({
            p1RunId: planW.p1RunId,
            warningCodes: ['NOT_A_REAL_WARNING'],
          }),
        ),
      );
      const withWarn = await svc.finalizeRun({
        p1RunId: planW.p1RunId,
        warningCodes: ['HIGH_REVIEW_RATIO'],
      });
      checks.push(
        withWarn.status === 'COMPLETED_WITH_WARNINGS'
          ? ok('C_completed_with_warnings')
          : fail(
              'C_completed_with_warnings',
              `${withWarn.status}:${JSON.stringify(withWarn.metrics.warningCodes)}`,
            ),
      );
    }

    // incomplete coverage: start run with no batches
    const cfgI = baseConfig({
      pipelineRunId: `${PIPELINE_PREFIX}-I`,
      validatorVersion: `1.0.0-I-${randomUUID().slice(0, 8)}`,
    });
    const planI = await svc.planRun(
      snapshotId,
      cfgI,
      computeConfigFingerprint(cfgI),
    );
    if (planI.outcome === 'CREATE') {
      await svc.startRun(planI.p1RunId);
      checks.push(
        await expectCode(
          'C_incomplete_coverage',
          'INCOMPLETE_CANDIDATE_COVERAGE',
          () =>
            svc.finalizeRun({
              p1RunId: planI.p1RunId,
              preferredTerminal: 'COMPLETED',
            }),
        ),
      );
      const p = await svc.finalizeRun({ p1RunId: planI.p1RunId });
      checks.push(
        p.status === 'PARTIAL'
          ? ok('C_auto_partial')
          : fail('C_auto_partial', `${p.status}`),
      );
    }

    // --- D cursor ---
    const cfgD = baseConfig({
      pipelineRunId: `${PIPELINE_PREFIX}-D`,
      validatorVersion: `1.0.0-D-${randomUUID().slice(0, 8)}`,
      lineageKey: 'LAB',
    });
    const planD = await svc.planRun(
      snapshotId,
      cfgD,
      computeConfigFingerprint(cfgD),
    );
    let runD = '';
    if (planD.outcome === 'CREATE') {
      await svc.startRun(planD.p1RunId);
      await svc.persistBatch(planD.p1RunId, happyBatch('d1', 'D1'));
      await svc.finalizeRun({ p1RunId: planD.p1RunId });
      runD = planD.p1RunId;
      const adv1 = await svc.advanceCurrentCursor({
        snapshotId,
        lineageKey: 'LAB',
        p1RunId: runD,
        promotedReason: 'INITIAL',
      });
      checks.push(!adv1.noop ? ok('D_cursor_reconcile') : fail('D_cursor_reconcile'));
      const adv2 = await svc.advanceCurrentCursor({
        snapshotId,
        lineageKey: 'LAB',
        p1RunId: runD,
        promotedReason: 'INITIAL',
      });
      checks.push(adv2.noop ? ok('D_cursor_idempotent') : fail('D_cursor_idempotent'));
    }

    // reject FAILED target
    const cfgDf = baseConfig({
      pipelineRunId: `${PIPELINE_PREFIX}-Df`,
      validatorVersion: `1.0.0-Df-${randomUUID().slice(0, 8)}`,
    });
    const planDf = await svc.planRun(
      snapshotId,
      cfgDf,
      computeConfigFingerprint(cfgDf),
    );
    if (planDf.outcome === 'CREATE') {
      await svc.startRun(planDf.p1RunId);
      await svc.failRun(planDf.p1RunId, 'X');
      checks.push(
        await expectCode('D_cursor_rejects_failed', 'CURSOR_TARGET_NOT_ELIGIBLE', () =>
          svc.advanceCurrentCursor({
            snapshotId,
            lineageKey: 'LAB',
            p1RunId: planDf.p1RunId,
            promotedReason: 'MANUAL',
          }),
        ),
      );
    }

    // supersession keeps previous run intact
    const cfgD2 = baseConfig({
      pipelineRunId: `${PIPELINE_PREFIX}-D2`,
      validatorVersion: `1.0.0-D2-${randomUUID().slice(0, 8)}`,
      lineageKey: 'LAB',
    });
    const planD2 = await svc.planRun(
      snapshotId,
      cfgD2,
      computeConfigFingerprint(cfgD2),
    );
    if (planD2.outcome === 'CREATE' && runD) {
      await svc.startRun(planD2.p1RunId);
      await svc.persistBatch(planD2.p1RunId, happyBatch('d2', 'D2'));
      await svc.finalizeRun({ p1RunId: planD2.p1RunId });
      await svc.advanceCurrentCursor({
        snapshotId,
        lineageKey: 'LAB',
        p1RunId: planD2.p1RunId,
        promotedReason: 'SUPERSEDE',
      });
      const old = await ds.query(
        `SELECT status FROM organigrama.mc_p1_run WHERE id=$1`,
        [runD],
      );
      const cur = await ds.query(
        `SELECT p1_run_id, previous_p1_run_id FROM organigrama.mc_p1_run_cursor
          WHERE snapshot_id=$1 AND lineage_key='LAB'`,
        [snapshotId],
      );
      checks.push(
        old[0]?.status === 'COMPLETED' &&
          cur[0]?.p1_run_id === planD2.p1RunId &&
          cur[0]?.previous_p1_run_id === runD
          ? ok('D_supersession_keeps_previous')
          : fail('D_supersession_keeps_previous', JSON.stringify({ old, cur })),
      );
    }

    // --- E canonical reader (DEFAULT lineage) ---
    const cfgE = baseConfig({
      pipelineRunId: `${PIPELINE_PREFIX}-E`,
      validatorVersion: `1.0.0-E-${randomUUID().slice(0, 8)}`,
      lineageKey: 'DEFAULT',
      resultOrigin: 'PIPELINE',
    });
    const planE = await svc.planRun(
      snapshotId,
      cfgE,
      computeConfigFingerprint(cfgE),
    );
    if (planE.outcome === 'CREATE') {
      await svc.startRun(planE.p1RunId);
      const batch = happyBatch('e1', 'E1', { inferred: true });
      const persisted = await svc.persistBatch(planE.p1RunId, batch);
      await svc.finalizeRun({ p1RunId: planE.p1RunId });
      await svc.advanceCurrentCursor({
        snapshotId,
        lineageKey: 'DEFAULT',
        p1RunId: planE.p1RunId,
        promotedReason: 'INITIAL',
      });

      const openRows = await svc.getCanonicalEvidenceForP2({ snapshotId });
      const mineOpen = openRows.filter((r) => r.p1_run_id === planE.p1RunId);
      checks.push(
        mineOpen.length === 0
          ? ok('E_open_review_excluded')
          : fail('E_open_review_excluded', String(mineOpen.length)),
      );

      // approve review via fixture SQL (not product resolution API)
      await ds.query(
        `UPDATE organigrama.mc_evidence_review_item
            SET queue_status='RESOLVED', resolution='APPROVED',
                resolved_at=NOW(), actor_id='6g-fixture',
                resolution_reason_code='TEST_APPROVE'
          WHERE p1_run_id=$1 AND queue_status='OPEN'`,
        [planE.p1RunId],
      );
      const approved = await svc.getCanonicalEvidenceForP2({ snapshotId });
      const mine = approved.filter((r) => r.p1_run_id === planE.p1RunId);
      checks.push(
        mine.length === 1
          ? ok('E_approved_included')
          : fail('E_approved_included', String(mine.length)),
      );
      const ids = new Set(mine.map((r) => r.evidence_unit_id));
      checks.push(
        ids.size === mine.length
          ? ok('E_no_duplicates')
          : fail('E_no_duplicates'),
      );

      await ds.query(
        `UPDATE organigrama.mc_evidence_review_item
            SET resolution='REJECTED', resolution_reason_code='TEST_REJECT'
          WHERE p1_run_id=$1 AND resolution='APPROVED'`,
        [planE.p1RunId],
      );
      const rejected = await svc.getCanonicalEvidenceForP2({ snapshotId });
      checks.push(
        rejected.filter((r) => r.p1_run_id === planE.p1RunId).length === 0
          ? ok('E_rejected_excluded')
          : fail('E_rejected_excluded'),
      );
      void persisted;
    }

    // modes forbid on dry
    checks.push(
      await expectCode('F_dry_forbids_plan', 'MODE_FORBIDS_PERSISTENCE', () =>
        dry.planRun(snapshotId, baseConfig()),
      ),
    );
  } finally {
    await cleanup(ds);

    // Restaurar cursores previos del snapshot (no dejar MDE alterado).
    await ds.query(
      `DELETE FROM organigrama.mc_p1_run_cursor
        WHERE snapshot_id = $1 AND lineage_key IN ('DEFAULT','LAB')`,
      [snapshotId],
    );
    if (priorDefaultCursor[0]) {
      await ds.query(
        `INSERT INTO organigrama.mc_p1_run_cursor
           (snapshot_id, lineage_key, p1_run_id, previous_p1_run_id, promoted_reason)
         VALUES ($1,'DEFAULT',$2,$3,$4)`,
        [
          snapshotId,
          priorDefaultCursor[0].p1_run_id,
          priorDefaultCursor[0].previous_p1_run_id,
          priorDefaultCursor[0].promoted_reason,
        ],
      );
    }
    if (priorLabCursor[0]) {
      await ds.query(
        `INSERT INTO organigrama.mc_p1_run_cursor
           (snapshot_id, lineage_key, p1_run_id, previous_p1_run_id, promoted_reason)
         VALUES ($1,'LAB',$2,$3,$4)`,
        [
          snapshotId,
          priorLabCursor[0].p1_run_id,
          priorLabCursor[0].previous_p1_run_id,
          priorLabCursor[0].promoted_reason,
        ],
      );
    }

    const residual = await ds.query(
      `SELECT COUNT(*)::int AS n FROM organigrama.mc_p1_run WHERE pipeline_run_id LIKE $1`,
      [`${PIPELINE_PREFIX}%`],
    );
    checks.push(
      residual[0].n === 0
        ? ok('mde_clean_no_6g_rows')
        : fail('mde_clean_no_6g_rows', String(residual[0].n)),
    );
    await ds.destroy();
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(
    JSON.stringify(
      {
        status:
          failed.length === 0
            ? 'READY_FOR_P1_RUNNER_INTEGRATION'
            : 'FAILED',
        failedCount: failed.length,
        checks,
      },
      null,
      2,
    ),
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      status: 'FAILED',
      error: String(e instanceof Error ? e.message : e).slice(0, 200),
    }),
  );
  process.exit(1);
});
