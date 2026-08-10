import { P1_BATCH_RUNNING_LEASE_MS } from './p1-persistence.constants';
import {
  assertConfigFingerprint,
  assertWarningCodesAllowed,
} from './p1-config-fingerprint';
import { p1Error } from './p1-persistence.errors';
import type { P1RunRepository } from './p1-run.repository';
import type {
  FinalizeRunInput,
  FinalizeRunResult,
  PlanRunOptions,
  PlanRunResult,
  P1RunConfig,
  ResumeBatchPlan,
} from './p1-persistence.types';

export class P1RunLifecycleService {
  constructor(private readonly repo: P1RunRepository) {}

  async planRun(
    snapshotId: string,
    config: P1RunConfig,
    providedFingerprint?: string | null,
    options: PlanRunOptions = {},
  ): Promise<PlanRunResult> {
    const preferReuse = options.preferReuse !== false;
    const configFingerprint = assertConfigFingerprint(
      config,
      providedFingerprint,
    );

    const exists = await this.repo.snapshotExists(snapshotId);
    if (!exists) {
      throw p1Error('SNAPSHOT_NOT_FOUND', 'snapshot not found', { snapshotId });
    }

    if (preferReuse) {
      const reusable = await this.repo.findSatisfactoryRun(
        snapshotId,
        configFingerprint,
      );
      if (reusable) {
        return {
          outcome: 'REUSE',
          p1RunId: reusable.id,
          status: reusable.status as 'COMPLETED' | 'COMPLETED_WITH_WARNINGS',
          attemptNo: reusable.attempt_no,
          configFingerprint,
        };
      }
    }

    const open = await this.repo.findOpenRun(snapshotId, configFingerprint);
    if (open) {
      const samePipeline =
        options.resumeIfSamePipeline !== false &&
        !!config.pipelineRunId &&
        open.pipeline_run_id === config.pipelineRunId;
      if (samePipeline) {
        const missingBatchPlan = await this.buildResumePlan(open.id);
        return {
          outcome: 'RESUME',
          p1RunId: open.id,
          status: open.status as 'PLANNED' | 'RUNNING',
          attemptNo: open.attempt_no,
          configFingerprint,
          missingBatchPlan,
        };
      }
      return {
        outcome: 'CONFLICT',
        error: 'RUN_ALREADY_ACTIVE',
        openP1RunId: open.id,
        configFingerprint,
      };
    }

    try {
      return await this.repo.withTransaction(async (qr) => {
        const attemptNo = await this.repo.nextAttemptNo(
          snapshotId,
          configFingerprint,
          qr,
        );
        const row = await this.repo.insertPlannedRun(
          {
            snapshotId,
            attemptNo,
            configFingerprint,
            config: {
              contractVersion: config.contractVersion,
              segmenterName: config.segmenterName,
              segmenterVersion: config.segmenterVersion,
              promptVersion: config.promptVersion,
              modelProvider: config.modelProvider,
              modelVersion: config.modelVersion,
              batchBuilderVersion: config.batchBuilderVersion,
              validatorVersion: config.validatorVersion,
              resultOrigin: config.resultOrigin,
              campaignId: config.campaignId,
              pipelineRunId: config.pipelineRunId,
            },
          },
          qr,
        );
        return {
          outcome: 'CREATE' as const,
          p1RunId: row.id,
          status: 'PLANNED' as const,
          attemptNo: row.attempt_no,
          configFingerprint,
        };
      });
    } catch (e) {
      this.repo.mapDbError(e);
    }
  }

  async startRun(
    p1RunId: string,
    opts?: { campaignId?: string | null; pipelineRunId?: string | null },
  ) {
    const run = await this.repo.findRunById(p1RunId);
    if (!run) throw p1Error('RUN_NOT_FOUND', 'run not found', { p1RunId });
    if (run.status === 'COMPLETED' || run.status === 'COMPLETED_WITH_WARNINGS') {
      throw p1Error('RUN_ALREADY_COMPLETED', 'cannot start a completed run', {
        p1RunId,
      });
    }
    if (run.status !== 'PLANNED') {
      throw p1Error(
        'INVALID_RUN_TRANSITION',
        'startRun requires PLANNED status',
        { status: run.status },
      );
    }
    try {
      return await this.repo.updateRunStatus(p1RunId, 'RUNNING', {
        campaignId: opts?.campaignId,
        pipelineRunId: opts?.pipelineRunId,
      });
    } catch (e) {
      this.repo.mapDbError(e);
    }
  }

  async getReusableRun(snapshotId: string, configFingerprint: string) {
    const row = await this.repo.findSatisfactoryRun(
      snapshotId,
      configFingerprint,
    );
    if (!row) return null;
    if (
      row.status !== 'COMPLETED' &&
      row.status !== 'COMPLETED_WITH_WARNINGS'
    ) {
      return null;
    }
    if (row.config_fingerprint !== configFingerprint) {
      throw p1Error(
        'CONFIG_FINGERPRINT_MISMATCH',
        'reusable run fingerprint mismatch',
      );
    }
    return row;
  }

  async resumeRun(p1RunId: string): Promise<{
    p1RunId: string;
    status: string;
    plan: ResumeBatchPlan;
  }> {
    const run = await this.repo.findRunById(p1RunId);
    if (!run) throw p1Error('RUN_NOT_FOUND', 'run not found', { p1RunId });
    if (run.status === 'COMPLETED' || run.status === 'COMPLETED_WITH_WARNINGS') {
      throw p1Error('RUN_ALREADY_COMPLETED', 'run already satisfactory', {
        p1RunId,
      });
    }
    if (run.status === 'CANCELLED') {
      throw p1Error(
        'INVALID_RUN_TRANSITION',
        'cannot resume CANCELLED run',
        { p1RunId },
      );
    }
    const plan = await this.buildResumePlan(p1RunId);
    return { p1RunId, status: run.status, plan };
  }

  async finalizeRun(input: FinalizeRunInput): Promise<FinalizeRunResult> {
    // claimedMetrics intentionally ignored — SoT is BD.
    void input.claimedMetrics;

    const run = await this.repo.findRunById(input.p1RunId);
    if (!run) {
      throw p1Error('RUN_NOT_FOUND', 'run not found', {
        p1RunId: input.p1RunId,
      });
    }
    if (run.status !== 'RUNNING') {
      if (
        run.status === 'COMPLETED' ||
        run.status === 'COMPLETED_WITH_WARNINGS'
      ) {
        throw p1Error('RUN_ALREADY_COMPLETED', 'run already finalized', {
          p1RunId: input.p1RunId,
        });
      }
      throw p1Error(
        'INVALID_RUN_TRANSITION',
        'finalizeRun requires RUNNING',
        { status: run.status },
      );
    }

    const warningCodes = assertWarningCodesAllowed(input.warningCodes ?? []);
    const metrics = await this.repo.readRunArtifactMetrics(input.p1RunId);

    if (metrics.reviewRequiredMissing > 0) {
      throw p1Error(
        'REVIEW_ITEM_REQUIRED',
        'REVIEW_REQUIRED decisions missing review items',
        { missing: metrics.reviewRequiredMissing },
      );
    }

    const wantsSatisfactory =
      input.preferredTerminal === 'COMPLETED' ||
      input.preferredTerminal === 'COMPLETED_WITH_WARNINGS';

    if (wantsSatisfactory || !input.preferredTerminal) {
      if (metrics.decisionCoverage < 1 || metrics.candidateCount < 1) {
        if (wantsSatisfactory) {
          throw p1Error(
            'INCOMPLETE_CANDIDATE_COVERAGE',
            'cannot close satisfactory with incomplete coverage',
            { coverage: metrics.decisionCoverage },
          );
        }
      }
      if (metrics.unsupportedSpanCount > 0 && wantsSatisfactory) {
        throw p1Error(
          'UNSUPPORTED_SPANS_PRESENT',
          'cannot close satisfactory with unsupported spans',
          { spans: metrics.unsupportedSpanCount },
        );
      }
      if (metrics.failedBatchCount > 0 && wantsSatisfactory) {
        throw p1Error(
          'INCOMPLETE_CANDIDATE_COVERAGE',
          'cannot COMPLETE with non-succeeded batches',
          { failedBatchCount: metrics.failedBatchCount },
        );
      }
    }

    let status = this.decideTerminalStatus({
      preferred: input.preferredTerminal,
      errorCode: input.errorCode,
      metrics,
      warningCodes,
    });

    if (status === 'COMPLETED' && warningCodes.length > 0) {
      status = 'COMPLETED_WITH_WARNINGS';
    }
    if (status === 'COMPLETED_WITH_WARNINGS' && warningCodes.length === 0) {
      status = 'COMPLETED';
    }

    // Auto path to COMPLETED* still requires physical eligibility
    if (
      (status === 'COMPLETED' || status === 'COMPLETED_WITH_WARNINGS') &&
      (metrics.decisionCoverage < 1 ||
        metrics.candidateCount < 1 ||
        metrics.unsupportedSpanCount > 0 ||
        metrics.failedBatchCount > 0)
    ) {
      throw p1Error(
        metrics.unsupportedSpanCount > 0
          ? 'UNSUPPORTED_SPANS_PRESENT'
          : 'INCOMPLETE_CANDIDATE_COVERAGE',
        'satisfactory close blocked by metrics from DB',
      );
    }

    try {
      await this.repo.updateRunStatus(input.p1RunId, status, {
        completedAt: new Date(),
        errorCode: input.errorCode ?? null,
        decisionCoverage: metrics.decisionCoverage,
        candidateCount: metrics.candidateCount,
        evidenceUnitCount: metrics.evidenceUnitCount,
        unsupportedSpanCount: metrics.unsupportedSpanCount,
        forbiddenTaxonomyHitCount: metrics.forbiddenTaxonomyHitCount,
        failedBatchCount: metrics.failedBatchCount,
        warningCodes,
      });
      return {
        p1RunId: input.p1RunId,
        status,
        metrics: {
          candidateCount: metrics.candidateCount,
          decisionCount: metrics.decisionCount,
          decisionCoverage: metrics.decisionCoverage,
          evidenceUnitCount: metrics.evidenceUnitCount,
          unsupportedSpanCount: metrics.unsupportedSpanCount,
          failedBatchCount: metrics.failedBatchCount,
          warningCodes,
        },
      };
    } catch (e) {
      this.repo.mapDbError(e);
    }
  }

  async failRun(p1RunId: string, errorCode: string) {
    return this.terminalAbort(p1RunId, 'FAILED', errorCode);
  }

  async cancelRun(p1RunId: string, errorCode = 'CANCELLED_BY_CALLER') {
    return this.terminalAbort(p1RunId, 'CANCELLED', errorCode);
  }

  private async terminalAbort(
    p1RunId: string,
    status: 'FAILED' | 'CANCELLED',
    errorCode: string,
  ) {
    const run = await this.repo.findRunById(p1RunId);
    if (!run) throw p1Error('RUN_NOT_FOUND', 'run not found', { p1RunId });
    if (
      run.status === 'COMPLETED' ||
      run.status === 'COMPLETED_WITH_WARNINGS'
    ) {
      throw p1Error('RUN_ALREADY_COMPLETED', 'cannot abort completed run');
    }
    if (run.status !== 'PLANNED' && run.status !== 'RUNNING') {
      throw p1Error('INVALID_RUN_TRANSITION', 'run already terminal');
    }
    // CANCELLED allowed from PLANNED; FAILED typically from RUNNING.
    if (status === 'FAILED' && run.status === 'PLANNED') {
      await this.repo.updateRunStatus(p1RunId, 'RUNNING');
    }
    try {
      return await this.repo.updateRunStatus(p1RunId, status, {
        completedAt: new Date(),
        errorCode,
      });
    } catch (e) {
      this.repo.mapDbError(e);
    }
  }

  private decideTerminalStatus(args: {
    preferred?: FinalizeRunInput['preferredTerminal'];
    errorCode?: string | null;
    metrics: Awaited<ReturnType<P1RunRepository['readRunArtifactMetrics']>>;
    warningCodes: string[];
  }) {
    if (args.preferred === 'CANCELLED') return 'CANCELLED' as const;
    if (args.preferred === 'FAILED' || args.errorCode) return 'FAILED' as const;
    if (args.preferred === 'PARTIAL') return 'PARTIAL' as const;

    const okCoverage =
      args.metrics.candidateCount > 0 &&
      args.metrics.decisionCoverage === 1 &&
      args.metrics.unsupportedSpanCount === 0 &&
      args.metrics.failedBatchCount === 0;

    if (okCoverage) {
      return args.warningCodes.length > 0
        ? ('COMPLETED_WITH_WARNINGS' as const)
        : ('COMPLETED' as const);
    }
    return 'PARTIAL' as const;
  }

  private async buildResumePlan(p1RunId: string): Promise<ResumeBatchPlan> {
    const batches = await this.repo.listBatches(p1RunId);
    const now = Date.now();
    const plan: ResumeBatchPlan = {
      succeeded: [],
      failed: [],
      aborted: [],
      pending: [],
      runningActive: [],
      runningAbandoned: [],
    };
    for (const b of batches) {
      switch (b.status) {
        case 'SUCCEEDED':
          plan.succeeded.push(b.batch_id);
          break;
        case 'FAILED':
          plan.failed.push(b.batch_id);
          break;
        case 'ABORTED':
          plan.aborted.push(b.batch_id);
          break;
        case 'PENDING':
          plan.pending.push(b.batch_id);
          break;
        case 'RUNNING': {
          const started = b.started_at
            ? new Date(b.started_at).getTime()
            : 0;
          const abandoned =
            started > 0 && now - started > P1_BATCH_RUNNING_LEASE_MS;
          if (abandoned) plan.runningAbandoned.push(b.batch_id);
          else plan.runningActive.push(b.batch_id);
          break;
        }
        default:
          plan.pending.push(b.batch_id);
      }
    }
    return plan;
  }
}
