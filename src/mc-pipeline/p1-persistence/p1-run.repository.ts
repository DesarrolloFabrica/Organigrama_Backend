import type { DataSource, QueryRunner } from 'typeorm';
import { p1Error } from './p1-persistence.errors';
import type { P1RunRow, P1RunStatus } from './p1-persistence.types';

type Q = DataSource | QueryRunner;

function db(q: Q) {
  return 'manager' in q && q.manager ? q : q;
}

export class P1RunRepository {
  constructor(private readonly dataSource: DataSource) {}

  async withTransaction<T>(fn: (qr: QueryRunner) => Promise<T>): Promise<T> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const result = await fn(qr);
      await qr.commitTransaction();
      return result;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async snapshotExists(snapshotId: string, qr?: QueryRunner): Promise<boolean> {
    const rows = await this.query(
      qr,
      `SELECT 1 FROM organigrama.mc_cv_snapshot WHERE id = $1 LIMIT 1`,
      [snapshotId],
    );
    return rows.length > 0;
  }

  async findRunById(p1RunId: string, qr?: QueryRunner): Promise<P1RunRow | null> {
    const rows = await this.query<P1RunRow>(
      qr,
      `SELECT * FROM organigrama.mc_p1_run WHERE id = $1`,
      [p1RunId],
    );
    return rows[0] ?? null;
  }

  async findSatisfactoryRun(
    snapshotId: string,
    configFingerprint: string,
    qr?: QueryRunner,
  ): Promise<P1RunRow | null> {
    const rows = await this.query<P1RunRow>(
      qr,
      `SELECT * FROM organigrama.mc_p1_run
        WHERE snapshot_id = $1
          AND config_fingerprint = $2
          AND status IN ('COMPLETED', 'COMPLETED_WITH_WARNINGS')
        LIMIT 1`,
      [snapshotId, configFingerprint],
    );
    return rows[0] ?? null;
  }

  async findOpenRun(
    snapshotId: string,
    configFingerprint: string,
    qr?: QueryRunner,
  ): Promise<P1RunRow | null> {
    const rows = await this.query<P1RunRow>(
      qr,
      `SELECT * FROM organigrama.mc_p1_run
        WHERE snapshot_id = $1
          AND config_fingerprint = $2
          AND status IN ('PLANNED', 'RUNNING')
        LIMIT 1`,
      [snapshotId, configFingerprint],
    );
    return rows[0] ?? null;
  }

  async nextAttemptNo(
    snapshotId: string,
    configFingerprint: string,
    qr: QueryRunner,
  ): Promise<number> {
    // Advisory lock scoped to fingerprint pair (hashtext collision-tolerant with recheck).
    await qr.query(
      `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
      [String(snapshotId), configFingerprint],
    );
    const rows = await this.query<{ m: number | null }>(
      qr,
      `SELECT MAX(attempt_no)::int AS m FROM organigrama.mc_p1_run
        WHERE snapshot_id = $1 AND config_fingerprint = $2`,
      [snapshotId, configFingerprint],
    );
    return (rows[0]?.m ?? 0) + 1;
  }

  async insertPlannedRun(
    params: {
      snapshotId: string;
      attemptNo: number;
      configFingerprint: string;
      config: {
        contractVersion: string;
        segmenterName: string;
        segmenterVersion: string;
        promptVersion: string;
        modelProvider: string;
        modelVersion: string;
        batchBuilderVersion: string;
        validatorVersion: string;
        resultOrigin: string;
        campaignId?: string | null;
        pipelineRunId?: string | null;
      };
    },
    qr: QueryRunner,
  ): Promise<P1RunRow> {
    const rows = await this.query<P1RunRow>(
      qr,
      `INSERT INTO organigrama.mc_p1_run (
         snapshot_id, attempt_no, config_fingerprint,
         contract_version, segmenter_name, segmenter_version,
         prompt_version, model_provider, model_version,
         batch_builder_version, validator_version,
         status, result_origin, campaign_id, pipeline_run_id
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PLANNED',$12,$13,$14
       )
       RETURNING *`,
      [
        params.snapshotId,
        params.attemptNo,
        params.configFingerprint,
        params.config.contractVersion,
        params.config.segmenterName,
        params.config.segmenterVersion,
        params.config.promptVersion,
        params.config.modelProvider,
        params.config.modelVersion,
        params.config.batchBuilderVersion,
        params.config.validatorVersion,
        params.config.resultOrigin,
        params.config.campaignId ?? null,
        params.config.pipelineRunId ?? null,
      ],
    );
    return rows[0];
  }

  async updateRunStatus(
    p1RunId: string,
    status: P1RunStatus,
    extra: {
      completedAt?: Date | null;
      errorCode?: string | null;
      decisionCoverage?: number;
      candidateCount?: number;
      evidenceUnitCount?: number;
      unsupportedSpanCount?: number;
      forbiddenTaxonomyHitCount?: number;
      failedBatchCount?: number;
      warningCodes?: unknown;
      campaignId?: string | null;
      pipelineRunId?: string | null;
    } = {},
    qr?: QueryRunner,
  ): Promise<P1RunRow> {
    await this.exec(
      qr,
      `UPDATE organigrama.mc_p1_run SET
         status = $2,
         completed_at = COALESCE($3, completed_at),
         error_code = COALESCE($4, error_code),
         decision_coverage = COALESCE($5, decision_coverage),
         candidate_count = COALESCE($6, candidate_count),
         evidence_unit_count = COALESCE($7, evidence_unit_count),
         unsupported_span_count = COALESCE($8, unsupported_span_count),
         forbidden_taxonomy_hit_count = COALESCE($9, forbidden_taxonomy_hit_count),
         failed_batch_count = COALESCE($10, failed_batch_count),
         warning_codes = COALESCE($11::jsonb, warning_codes),
         campaign_id = COALESCE($12, campaign_id),
         pipeline_run_id = COALESCE($13, pipeline_run_id)
       WHERE id = $1`,
      [
        p1RunId,
        status,
        extra.completedAt ?? null,
        extra.errorCode ?? null,
        extra.decisionCoverage ?? null,
        extra.candidateCount ?? null,
        extra.evidenceUnitCount ?? null,
        extra.unsupportedSpanCount ?? null,
        extra.forbiddenTaxonomyHitCount ?? null,
        extra.failedBatchCount ?? null,
        extra.warningCodes != null ? JSON.stringify(extra.warningCodes) : null,
        extra.campaignId ?? null,
        extra.pipelineRunId ?? null,
      ],
    );
    const row = await this.findRunById(p1RunId, qr);
    if (!row) {
      throw p1Error('RUN_NOT_FOUND', 'run not found after update', { p1RunId });
    }
    return row;
  }

  async listBatches(
    p1RunId: string,
    qr?: QueryRunner,
  ): Promise<
    Array<{
      batch_id: string;
      status: string;
      started_at: Date | null;
      finished_at: Date | null;
    }>
  > {
    return this.query(
      qr,
      `SELECT batch_id, status, started_at, finished_at
         FROM organigrama.mc_evidence_batch
        WHERE p1_run_id = $1
        ORDER BY created_at ASC`,
      [p1RunId],
    );
  }

  async getBatch(
    p1RunId: string,
    batchId: string,
    qr?: QueryRunner,
  ): Promise<{ batch_id: string; status: string } | null> {
    const rows = await this.query<{ batch_id: string; status: string }>(
      qr,
      `SELECT batch_id, status FROM organigrama.mc_evidence_batch
        WHERE p1_run_id = $1 AND batch_id = $2`,
      [p1RunId, batchId],
    );
    return rows[0] ?? null;
  }

  async readRunArtifactMetrics(p1RunId: string, qr?: QueryRunner) {
    const cand = await this.query<{ n: string }>(
      qr,
      `SELECT COUNT(*)::text AS n FROM organigrama.mc_evidence_candidate WHERE p1_run_id = $1`,
      [p1RunId],
    );
    const dec = await this.query<{ n: string }>(
      qr,
      `SELECT COUNT(*)::text AS n FROM organigrama.mc_evidence_candidate_decision WHERE p1_run_id = $1`,
      [p1RunId],
    );
    const units = await this.query<{ n: string }>(
      qr,
      `SELECT COUNT(*)::text AS n FROM organigrama.mc_evidence_unit WHERE p1_run_id = $1`,
      [p1RunId],
    );
    const spans = await this.query<{ n: string }>(
      qr,
      `SELECT COALESCE(SUM(unsupported_span_count),0)::text AS n
         FROM organigrama.mc_evidence_batch WHERE p1_run_id = $1`,
      [p1RunId],
    );
    const tax = await this.query<{ n: string }>(
      qr,
      `SELECT COALESCE(SUM(forbidden_taxonomy_hit_count),0)::text AS n
         FROM organigrama.mc_evidence_batch WHERE p1_run_id = $1`,
      [p1RunId],
    );
    const failed = await this.query<{ n: string }>(
      qr,
      `SELECT COUNT(*)::text AS n FROM organigrama.mc_evidence_batch
        WHERE p1_run_id = $1 AND status IS DISTINCT FROM 'SUCCEEDED'`,
      [p1RunId],
    );
    const rrMissing = await this.query<{ n: string }>(
      qr,
      `SELECT COUNT(*)::text AS n
         FROM organigrama.mc_evidence_candidate_decision d
        WHERE d.p1_run_id = $1
          AND d.decision = 'REVIEW_REQUIRED'
          AND NOT EXISTS (
            SELECT 1 FROM organigrama.mc_evidence_review_item ri
             WHERE ri.p1_run_id = d.p1_run_id
               AND ri.subject_type = 'CANDIDATE'
               AND ri.subject_id = d.candidate_id
               AND ri.queue_status IN ('OPEN','IN_PROGRESS','RESOLVED','WAIVED')
          )`,
      [p1RunId],
    );
    const candidateCount = Number(cand[0]?.n ?? 0);
    const decisionCount = Number(dec[0]?.n ?? 0);
    const decisionCoverage =
      candidateCount === 0
        ? 0
        : Number((decisionCount / candidateCount).toFixed(5));
    return {
      candidateCount,
      decisionCount,
      decisionCoverage,
      evidenceUnitCount: Number(units[0]?.n ?? 0),
      unsupportedSpanCount: Number(spans[0]?.n ?? 0),
      forbiddenTaxonomyHitCount: Number(tax[0]?.n ?? 0),
      failedBatchCount: Number(failed[0]?.n ?? 0),
      reviewRequiredMissing: Number(rrMissing[0]?.n ?? 0),
    };
  }

  async getCursor(
    snapshotId: string,
    lineageKey: string,
    qr?: QueryRunner,
  ): Promise<{ p1_run_id: string; previous_p1_run_id: string | null } | null> {
    const rows = await this.query<{
      p1_run_id: string;
      previous_p1_run_id: string | null;
    }>(
      qr,
      `SELECT p1_run_id, previous_p1_run_id FROM organigrama.mc_p1_run_cursor
        WHERE snapshot_id = $1 AND lineage_key = $2`,
      [snapshotId, lineageKey],
    );
    return rows[0] ?? null;
  }

  async upsertCursor(
    params: {
      snapshotId: string;
      lineageKey: string;
      p1RunId: string;
      previousP1RunId: string | null;
      promotedReason: string;
    },
    qr?: QueryRunner,
  ): Promise<void> {
    await this.exec(
      qr,
      `INSERT INTO organigrama.mc_p1_run_cursor (
         snapshot_id, lineage_key, p1_run_id, previous_p1_run_id, promoted_reason, promoted_at
       ) VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (snapshot_id, lineage_key) DO UPDATE SET
         previous_p1_run_id = organigrama.mc_p1_run_cursor.p1_run_id,
         p1_run_id = EXCLUDED.p1_run_id,
         promoted_reason = EXCLUDED.promoted_reason,
         promoted_at = NOW()`,
      [
        params.snapshotId,
        params.lineageKey,
        params.p1RunId,
        params.previousP1RunId,
        params.promotedReason,
      ],
    );
  }

  mapDbError(e: unknown): never {
    const msg = String(e instanceof Error ? e.message : e);
    if (msg.includes('uq_mc_p1_run_open_fingerprint')) {
      throw p1Error('RUN_ALREADY_ACTIVE', 'open run already exists for config');
    }
    if (msg.includes('uq_mc_p1_run_satisfactory_fingerprint')) {
      throw p1Error('RUN_ALREADY_COMPLETED', 'satisfactory run already exists');
    }
    if (msg.includes('illegal status transition')) {
      throw p1Error('INVALID_RUN_TRANSITION', 'illegal run status transition');
    }
    if (msg.includes('warning_codes contains unknown')) {
      throw p1Error('UNKNOWN_WARNING_CODE', 'warning code rejected by DDL');
    }
    if (msg.includes('REVIEW_REQUIRED decisions require review_item')) {
      throw p1Error('REVIEW_ITEM_REQUIRED', 'missing review item for REVIEW_REQUIRED');
    }
    if (msg.includes('decision_coverage')) {
      throw p1Error('INCOMPLETE_CANDIDATE_COVERAGE', 'decision coverage invalid');
    }
    if (msg.includes('unsupported_span_count')) {
      throw p1Error('UNSUPPORTED_SPANS_PRESENT', 'unsupported spans present');
    }
    if (
      msg.includes('mc_p1_run_cursor') ||
      msg.includes('requires satisfactory run')
    ) {
      throw p1Error('CURSOR_TARGET_NOT_ELIGIBLE', 'cursor target not eligible');
    }
    throw p1Error('PERSISTENCE_CONFLICT', 'persistence conflict', {
      cause: msg.slice(0, 120),
    });
  }

  private async query<T>(
    qr: QueryRunner | undefined,
    sql: string,
    params: unknown[],
  ): Promise<T[]> {
    const target = qr ?? this.dataSource;
    const result = await target.query(sql, params);
    return result as T[];
  }

  private async exec(
    qr: QueryRunner | undefined,
    sql: string,
    params: unknown[],
  ): Promise<void> {
    const target = qr ?? this.dataSource;
    await target.query(sql, params);
  }
}

// silence unused helper warning if tree-shaken oddly
void db;
