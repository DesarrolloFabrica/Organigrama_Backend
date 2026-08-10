/**
 * Adapter runner P1 → persistencia 6G.
 * No contiene SQL de segmentación/IA; solo orquesta artefactos ya validados.
 */
import type { DataSource } from 'typeorm';
import {
  P1_CONTRACT_CODE,
  P1_WARNING_POLICY_VERSION,
} from './p1-persistence.constants';
import { computeConfigFingerprint } from './p1-config-fingerprint';
import { p1Error } from './p1-persistence.errors';
import {
  createP1PersistenceService,
  P1PersistenceService,
} from './p1-persistence.service';
import type { P1RunConfig, PlanRunResult } from './p1-persistence.types';
import {
  buildPersistBatchInputs,
  compareMemoryToDb,
  type EquivalenceReport,
  type P1MemoryArtifact,
} from './p1-memory-artifact';
import {
  loadP1MemoryArtifactFromPack,
  resolveCohortArtifactDir,
} from './p1-artifact-pack-loader';
import {
  P1_CONTRACT_VERSION,
  P1_PROMPT_VERSION,
  P1_SEGMENTER_NAME,
  P1_SEGMENTER_VERSION,
} from '../p1/p1.types';
import { BATCH_BUILDER_VERSION, VALIDATOR_VERSION } from '../../mc-observatory/observatory.constants';
import { assertMdeTarget, type MdeConnectionTarget } from '../p0/mde-guard';

export type PilotExecutionMode = 'DRY_RUN' | 'ARTIFACT_ONLY' | 'PERSIST_MDE';

export function buildPilotRunConfig(overrides: Partial<P1RunConfig> = {}): P1RunConfig {
  return {
    contractCode: P1_CONTRACT_CODE,
    contractVersion: P1_CONTRACT_VERSION,
    segmenterName: P1_SEGMENTER_NAME,
    segmenterVersion: P1_SEGMENTER_VERSION,
    promptVersion: P1_PROMPT_VERSION,
    modelProvider: 'google-genai',
    modelVersion: 'gemini-3.6-flash',
    batchBuilderVersion: BATCH_BUILDER_VERSION,
    validatorVersion: VALIDATOR_VERSION,
    warningPolicyVersion: P1_WARNING_POLICY_VERSION,
    resultOrigin: 'LAB',
    lineageKey: 'LAB',
    campaignId: 'MC1-P1-6H-PILOT',
    pipelineRunId: null,
    ...overrides,
  };
}

export type AdapterPersistResult = {
  plan: PlanRunResult;
  p1RunId: string | null;
  artifactSource: 'ARTIFACT_REUSED' | 'LIVE_RUN' | 'REUSE_DB';
  geminiInvoked: boolean;
  batchesPersisted: number;
  finalizeStatus: string | null;
  cursor: {
    advanced: boolean;
    noop: boolean;
    lineageKey: 'LAB';
  } | null;
  equivalence: EquivalenceReport | null;
  memoryMetrics: P1MemoryArtifact['metrics'] | null;
};

export class P1RunnerPersistenceAdapter {
  constructor(
    private readonly mode: PilotExecutionMode,
    private readonly persistence: P1PersistenceService | null,
    private readonly dataSource: DataSource | null,
  ) {
    if (mode === 'PERSIST_MDE') {
      if (!persistence?.hasDbWriter || !dataSource) {
        throw p1Error(
          'MODE_FORBIDS_PERSISTENCE',
          'PERSIST_MDE requires persistence writers',
        );
      }
    } else if (persistence?.hasDbWriter) {
      throw p1Error(
        'MODE_FORBIDS_PERSISTENCE',
        'non-persist modes must not hold DB writers',
      );
    }
  }

  static create(opts: {
    mode: PilotExecutionMode;
    dataSource?: DataSource;
    mdeTarget?: MdeConnectionTarget;
    confirmPersist?: boolean;
  }): P1RunnerPersistenceAdapter {
    if (opts.mode === 'DRY_RUN') {
      return new P1RunnerPersistenceAdapter(
        opts.mode,
        createP1PersistenceService({ mode: 'DRY_RUN' }),
        null,
      );
    }
    if (opts.mode === 'ARTIFACT_ONLY') {
      // Puede usar DataSource solo-lectura para cargar snapshot/artefacto; sin writers.
      return new P1RunnerPersistenceAdapter(
        opts.mode,
        createP1PersistenceService({ mode: 'ARTIFACT_ONLY' }),
        opts.dataSource ?? null,
      );
    }
    if (!opts.confirmPersist) {
      throw p1Error(
        'MODE_FORBIDS_PERSISTENCE',
        'PERSIST_MDE requires explicit confirmation',
      );
    }
    if (!opts.mdeTarget || !opts.dataSource) {
      throw p1Error(
        'MODE_FORBIDS_PERSISTENCE',
        'PERSIST_MDE requires MDE DataSource',
      );
    }
    assertMdeTarget(opts.mdeTarget);
    return new P1RunnerPersistenceAdapter(
      'PERSIST_MDE',
      createP1PersistenceService({
        mode: 'PERSIST_MDE',
        dataSource: opts.dataSource,
      }),
      opts.dataSource,
    );
  }

  async loadMemoryArtifact(args: {
    backendRoot: string;
    snapshotId: string;
  }): Promise<P1MemoryArtifact> {
    if (!this.dataSource) {
      throw p1Error(
        'MODE_FORBIDS_PERSISTENCE',
        'artifact load requires DataSource to read snapshot text',
      );
    }
    const dir = resolveCohortArtifactDir(args.backendRoot, args.snapshotId);
    if (!dir) {
      throw p1Error(
        'PERSISTENCE_CONFLICT',
        `artifact pack missing for snapshot ${args.snapshotId}`,
      );
    }
    const snap = await this.dataSource.query(
      `SELECT id, normalized_text FROM organigrama.mc_cv_snapshot WHERE id = $1`,
      [args.snapshotId],
    );
    if (!snap[0]?.normalized_text) {
      throw p1Error('SNAPSHOT_NOT_FOUND', `snapshot ${args.snapshotId} missing normalized_text`);
    }
    const normalizedText = String(snap[0].normalized_text);
    return loadP1MemoryArtifactFromPack({
      artifactDir: dir,
      snapshotId: args.snapshotId,
      normalizedText,
    });
  }

  async loadSnapshot1MemoryArtifact(args: {
    backendRoot: string;
    snapshotId: string;
  }): Promise<P1MemoryArtifact> {
    if (args.snapshotId !== '1') {
      throw p1Error('PERSISTENCE_CONFLICT', 'loadSnapshot1MemoryArtifact only allows snapshotId=1');
    }
    return this.loadMemoryArtifact(args);
  }

  /**
   * Persiste un snapshot desde pack reutilizable (sin Gemini en esta ruta).
   */
  async runSnapshotPilot(args: {
    backendRoot: string;
    snapshotId: string;
    pipelineRunId: string;
    campaignId?: string;
    simulateBatchInterrupt?: boolean;
    deferCursor?: boolean;
  }): Promise<AdapterPersistResult> {
    const memory = await this.loadMemoryArtifact({
      backendRoot: args.backendRoot,
      snapshotId: args.snapshotId,
    });

    if (this.mode !== 'PERSIST_MDE' || !this.persistence?.hasDbWriter) {
      return {
        plan: {
          outcome: 'CREATE',
          p1RunId: 'artifact-only',
          status: 'PLANNED',
          attemptNo: 0,
          configFingerprint: computeConfigFingerprint(
            buildPilotRunConfig({ pipelineRunId: args.pipelineRunId }),
          ),
        },
        p1RunId: null,
        artifactSource: 'ARTIFACT_REUSED',
        geminiInvoked: false,
        batchesPersisted: 0,
        finalizeStatus: null,
        cursor: null,
        equivalence: null,
        memoryMetrics: memory.metrics,
      };
    }

    const config = buildPilotRunConfig({
      pipelineRunId: args.pipelineRunId,
      campaignId: args.campaignId ?? 'MC1-P1-6I-COHORT',
      lineageKey: 'LAB',
      resultOrigin: 'LAB',
    });
    const fingerprint = computeConfigFingerprint(config);

    const plan = await this.persistence.planRun(
      args.snapshotId,
      config,
      fingerprint,
      { preferReuse: true, resumeIfSamePipeline: true },
    );

    if (plan.outcome === 'REUSE') {
      const equivalence = await this.compareToDb(plan.p1RunId, memory);
      return {
        plan,
        p1RunId: plan.p1RunId,
        artifactSource: 'REUSE_DB',
        geminiInvoked: false,
        batchesPersisted: 0,
        finalizeStatus: plan.status,
        cursor: null,
        equivalence,
        memoryMetrics: memory.metrics,
      };
    }

    if (plan.outcome === 'CONFLICT') {
      return {
        plan,
        p1RunId: null,
        artifactSource: 'ARTIFACT_REUSED',
        geminiInvoked: false,
        batchesPersisted: 0,
        finalizeStatus: null,
        cursor: null,
        equivalence: null,
        memoryMetrics: memory.metrics,
      };
    }

    const p1RunId = plan.p1RunId;
    if (plan.outcome === 'CREATE') {
      await this.persistence.startRun(p1RunId, {
        campaignId: config.campaignId,
        pipelineRunId: config.pipelineRunId,
      });
    }

    const batchInputs = buildPersistBatchInputs(memory);
    let batchesPersisted = 0;

    if (args.simulateBatchInterrupt && batchInputs.length >= 2) {
      const failIdx = batchInputs.length - 1;
      for (let i = 0; i < failIdx; i++) {
        await this.persistence.persistBatch(p1RunId, batchInputs[i]);
        batchesPersisted += 1;
      }
      const bad = {
        ...batchInputs[failIdx],
        candidates: batchInputs[failIdx].candidates.map((c, idx) =>
          idx === 0 ? { ...c, textHash: 'bad' } : c,
        ),
      };
      try {
        await this.persistence.persistBatch(p1RunId, bad);
      } catch {
        // expected rollback
      }
      const resume = await this.persistence.resumeRun(p1RunId);
      if (resume.plan.succeeded.length !== failIdx) {
        throw p1Error(
          'PERSISTENCE_CONFLICT',
          'resume succeeded count mismatch after interrupt',
          {
            expected: failIdx,
            got: resume.plan.succeeded.length,
          },
        );
      }
      await this.persistence.persistBatch(p1RunId, batchInputs[failIdx]);
      batchesPersisted += 1;
    } else {
      for (const input of batchInputs) {
        await this.persistence.persistBatch(p1RunId, input);
        batchesPersisted += 1;
      }
    }

    const finalized = await this.persistence.finalizeRun({
      p1RunId,
      warningCodes: memory.warningCodes,
      claimedMetrics: {
        candidateCount: 999999,
        decisionCoverage: 0,
      },
    });

    let cursor: AdapterPersistResult['cursor'] = null;
    if (!args.deferCursor) {
      const adv = await this.persistence.advanceCurrentCursor({
        snapshotId: args.snapshotId,
        lineageKey: 'LAB',
        p1RunId,
        promotedReason: 'INITIAL',
      });
      cursor = { advanced: true, noop: adv.noop, lineageKey: 'LAB' };
    }

    const equivalence = await this.compareToDb(p1RunId, memory);

    return {
      plan,
      p1RunId,
      artifactSource: 'ARTIFACT_REUSED',
      geminiInvoked: false,
      batchesPersisted,
      finalizeStatus: finalized.status,
      cursor,
      equivalence,
      memoryMetrics: memory.metrics,
    };
  }

  async runSnapshot1Pilot(args: {
    backendRoot: string;
    snapshotId: string;
    pipelineRunId: string;
    simulateBatchInterrupt?: boolean;
    deferCursor?: boolean;
  }): Promise<AdapterPersistResult> {
    if (args.snapshotId !== '1') {
      throw p1Error('PERSISTENCE_CONFLICT', 'runSnapshot1Pilot only allows snapshotId=1');
    }
    return this.runSnapshotPilot({
      ...args,
      campaignId: 'MC1-P1-6H-PILOT',
    });
  }

  async reconcileLabCursor(snapshotId: string, p1RunId: string) {
    if (!this.persistence) {
      throw p1Error('MODE_FORBIDS_PERSISTENCE', 'no persistence');
    }
    const first = await this.persistence.advanceCurrentCursor({
      snapshotId,
      lineageKey: 'LAB',
      p1RunId,
      promotedReason: 'INITIAL',
    });
    const second = await this.persistence.advanceCurrentCursor({
      snapshotId,
      lineageKey: 'LAB',
      p1RunId,
      promotedReason: 'INITIAL',
    });
    return { first, second };
  }

  private async compareToDb(
    p1RunId: string,
    memory: P1MemoryArtifact,
  ): Promise<EquivalenceReport> {
    if (!this.dataSource) {
      throw p1Error('MODE_FORBIDS_PERSISTENCE', 'no dataSource');
    }
    const counts = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*)::int FROM organigrama.mc_evidence_candidate WHERE p1_run_id=$1) AS candidates,
         (SELECT COUNT(*)::int FROM organigrama.mc_evidence_candidate_decision WHERE p1_run_id=$1) AS decisions,
         (SELECT COUNT(*)::int FROM organigrama.mc_evidence_unit WHERE p1_run_id=$1) AS units,
         (SELECT COUNT(*)::int FROM organigrama.mc_evidence_batch WHERE p1_run_id=$1) AS batches,
         (SELECT COUNT(*)::int FROM organigrama.mc_evidence_candidate_decision WHERE p1_run_id=$1 AND decision='ACCEPTED') AS accepted,
         (SELECT COUNT(*)::int FROM organigrama.mc_evidence_candidate_decision WHERE p1_run_id=$1 AND decision LIKE 'REJECTED%') AS rejected,
         (SELECT COUNT(*)::int FROM organigrama.mc_evidence_candidate_decision WHERE p1_run_id=$1 AND decision='REVIEW_REQUIRED') AS review_required,
         (SELECT COUNT(*)::int FROM organigrama.mc_evidence_unit_candidate_link WHERE p1_run_id=$1) AS links,
         (SELECT decision_coverage FROM organigrama.mc_p1_run WHERE id=$1) AS coverage,
         (SELECT unsupported_span_count FROM organigrama.mc_p1_run WHERE id=$1) AS spans,
         (SELECT warning_codes FROM organigrama.mc_p1_run WHERE id=$1) AS warnings`,
      [p1RunId],
    );
    const candidates = await this.dataSource.query(
      `SELECT candidate_id, start_offset, end_offset, text_hash
         FROM organigrama.mc_evidence_candidate WHERE p1_run_id=$1`,
      [p1RunId],
    );
    const decisions = await this.dataSource.query(
      `SELECT candidate_id, decision
         FROM organigrama.mc_evidence_candidate_decision WHERE p1_run_id=$1`,
      [p1RunId],
    );
    const units = await this.dataSource.query(
      `SELECT primary_candidate_id, start_offset, end_offset, evidence_kind,
              explicitness, span_text_hash, content_fingerprint
         FROM organigrama.mc_evidence_unit WHERE p1_run_id=$1`,
      [p1RunId],
    );
    const row = counts[0];
    const warnings = Array.isArray(row.warnings)
      ? row.warnings.map(String)
      : typeof row.warnings === 'string'
        ? (JSON.parse(row.warnings) as string[])
        : [];

    let explicit = 0;
    let stronglySupported = 0;
    let inferred = 0;
    for (const u of units as Array<{ explicitness: string }>) {
      if (u.explicitness === 'EXPLICIT') explicit += 1;
      else if (u.explicitness === 'STRONGLY_SUPPORTED') stronglySupported += 1;
      else if (u.explicitness === 'INFERRED') inferred += 1;
    }

    return compareMemoryToDb({
      memory,
      bd: {
        candidateCount: row.candidates,
        decisionCount: row.decisions,
        unitCount: row.units,
        batchCount: row.batches,
        accepted: row.accepted,
        rejected: row.rejected,
        reviewRequired: row.review_required,
        decisionCoverage: Number(row.coverage),
        unsupportedSpanCount: Number(row.spans),
        warningCodes: warnings,
        explicit,
        stronglySupported,
        inferred,
        candidates,
        decisions,
        units,
        linkCount: row.links,
      },
    });
  }
}
