import type { QueryRunner } from 'typeorm';
import { P1_WARNING_POLICY_VERSION } from './p1-persistence.constants';
import { P1PersistenceError, p1Error } from './p1-persistence.errors';
import type { P1RunRepository } from './p1-run.repository';
import type { P1ReviewQueueGateway } from './p1-review-queue.gateway';
import type {
  MarkBatchFailedInput,
  PersistBatchInput,
  PersistBatchResult,
} from './p1-persistence.types';

export class P1ArtifactWriter {
  constructor(
    private readonly repo: P1RunRepository,
    private readonly reviewGateway: P1ReviewQueueGateway,
  ) {}

  async persistBatch(
    p1RunId: string,
    input: PersistBatchInput,
  ): Promise<PersistBatchResult> {
    const run = await this.repo.findRunById(p1RunId);
    if (!run) throw p1Error('RUN_NOT_FOUND', 'run not found', { p1RunId });
    if (run.status !== 'RUNNING') {
      throw p1Error(
        'INVALID_RUN_TRANSITION',
        'persistBatch requires RUNNING run',
        { status: run.status },
      );
    }

    const existing = await this.repo.getBatch(p1RunId, input.batchId);
    if (existing?.status === 'SUCCEEDED') {
      return {
        p1RunId,
        batchId: input.batchId,
        candidateCount: input.candidates.length,
        decisionCount: input.decisions.length,
        unitCount: input.units.length,
        reviewItemCount: 0,
        noop: true,
      };
    }

    this.assertBatchPayload(p1RunId, run.snapshot_id, input);

    try {
      return await this.repo.withTransaction(async (qr) => {
        await this.upsertBatchRow(qr, p1RunId, input, 'RUNNING');

        for (const c of input.candidates) {
          await qr.query(
            `INSERT INTO organigrama.mc_evidence_candidate (
               p1_run_id, candidate_id, snapshot_id, page_number,
               start_offset, end_offset, text_hash, character_count,
               candidate_type, block_type, parent_heading_candidate_id, batch_id
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [
              p1RunId,
              c.candidateId,
              run.snapshot_id,
              c.pageNumber,
              c.startOffset,
              c.endOffset,
              c.textHash,
              c.endOffset - c.startOffset,
              c.candidateType,
              c.blockType ?? null,
              c.parentHeadingCandidateId ?? null,
              input.batchId,
            ],
          );
        }

        for (const d of input.decisions) {
          await qr.query(
            `INSERT INTO organigrama.mc_evidence_candidate_decision (
               p1_run_id, candidate_id, decision, reason_code,
               review_required, batch_id
             ) VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              p1RunId,
              d.candidateId,
              d.decision,
              d.reasonCode,
              d.reviewRequired ?? d.decision === 'REVIEW_REQUIRED',
              input.batchId,
            ],
          );
        }

        const unitIds: Array<{
          id: string;
          primaryCandidateId: string;
          reviewGate: string;
          explicitness: string;
        }> = [];

        for (const u of input.units) {
          const provenance = {
            ...(u.provenance ?? {}),
            warningPolicyVersion: P1_WARNING_POLICY_VERSION,
            configFingerprint: run.config_fingerprint,
          };
          const rows = await qr.query(
            `INSERT INTO organigrama.mc_evidence_unit (
               p1_run_id, snapshot_id, primary_candidate_id, page_number,
               start_offset, end_offset, span_text_hash, evidence_kind,
               explicitness, decision, review_gate, normalized_activity,
               object, tool_or_method, result, scope, temporal_context,
               content_fingerprint, confidence_extraction, confidence_span_integrity,
               batch_id, provenance
             ) VALUES (
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb
             ) RETURNING id`,
            [
              p1RunId,
              run.snapshot_id,
              u.primaryCandidateId,
              u.pageNumber,
              u.startOffset,
              u.endOffset,
              u.spanTextHash,
              u.evidenceKind,
              u.explicitness,
              u.decision,
              u.reviewGate,
              u.normalizedActivity ?? null,
              u.object ?? null,
              u.toolOrMethod ?? null,
              u.result ?? null,
              u.scope ?? null,
              u.temporalContext ?? null,
              u.contentFingerprint,
              u.confidenceExtraction ?? null,
              u.confidenceSpanIntegrity ?? null,
              input.batchId,
              JSON.stringify(provenance),
            ],
          );
          const unitId = rows[0].id as string;
          unitIds.push({
            id: unitId,
            primaryCandidateId: u.primaryCandidateId,
            reviewGate: u.reviewGate,
            explicitness: u.explicitness,
          });

          for (const link of u.secondaryLinks ?? []) {
            await qr.query(
              `INSERT INTO organigrama.mc_evidence_unit_candidate_link (
                 evidence_unit_id, p1_run_id, candidate_id, link_role, overlap_ratio
               ) VALUES ($1,$2,$3,$4,$5)`,
              [
                unitId,
                p1RunId,
                link.candidateId,
                link.linkRole,
                link.overlapRatio ?? null,
              ],
            );
          }
        }

        const reviewItemCount = await this.reviewGateway.insertOpenItemsForBatch(
          qr,
          {
            p1RunId,
            snapshotId: run.snapshot_id,
            decisions: input.decisions,
            units: unitIds,
          },
        );

        await this.markBatchSucceededInTx(qr, p1RunId, input);

        return {
          p1RunId,
          batchId: input.batchId,
          candidateCount: input.candidates.length,
          decisionCount: input.decisions.length,
          unitCount: input.units.length,
          reviewItemCount,
        };
      });
    } catch (e) {
      if (e instanceof P1PersistenceError) throw e;
      this.repo.mapDbError(e);
    }
  }

  async markBatchFailed(input: MarkBatchFailedInput): Promise<void> {
    const run = await this.repo.findRunById(input.p1RunId);
    if (!run) {
      throw p1Error('RUN_NOT_FOUND', 'run not found', {
        p1RunId: input.p1RunId,
      });
    }
    if (run.status !== 'RUNNING') {
      throw p1Error(
        'INVALID_RUN_TRANSITION',
        'markBatchFailed requires RUNNING',
      );
    }
    const existing = await this.repo.getBatch(input.p1RunId, input.batchId);
    if (existing?.status === 'SUCCEEDED') {
      throw p1Error(
        'BATCH_ALREADY_SUCCEEDED',
        'cannot fail a succeeded batch',
      );
    }
    // errorCode is structural only — never persist CV/prompt/raw payload.
    void input.errorCode;
    try {
      await this.repo.withTransaction(async (qr) => {
        await qr.query(
          `INSERT INTO organigrama.mc_evidence_batch (
             p1_run_id, batch_id, page_range_start, page_range_end,
             candidate_count, status, attempt_count, validation_status,
             unsupported_span_count, forbidden_taxonomy_hit_count,
             started_at, finished_at
           ) VALUES ($1,$2,1,1,0,$3,1,$4,$5,$6,NOW(),NOW())
           ON CONFLICT (p1_run_id, batch_id) DO UPDATE SET
             status = EXCLUDED.status,
             validation_status = EXCLUDED.validation_status,
             unsupported_span_count = EXCLUDED.unsupported_span_count,
             forbidden_taxonomy_hit_count = EXCLUDED.forbidden_taxonomy_hit_count,
             finished_at = NOW()`,
          [
            input.p1RunId,
            input.batchId,
            input.status ?? 'FAILED',
            input.validationStatus ?? 'SCHEMA_INVALID',
            input.unsupportedSpanCount ?? 0,
            input.forbiddenTaxonomyHitCount ?? 0,
          ],
        );
      });
    } catch (e) {
      this.repo.mapDbError(e);
    }
  }

  private assertBatchPayload(
    p1RunId: string,
    snapshotId: string,
    input: PersistBatchInput,
  ) {
    void snapshotId;
    const candIds = new Set(input.candidates.map((c) => c.candidateId));
    if (input.decisions.length !== input.candidates.length) {
      throw p1Error(
        'BATCH_RUN_MISMATCH',
        'decisions must be 1:1 with candidates in batch',
      );
    }
    for (const d of input.decisions) {
      if (!candIds.has(d.candidateId)) {
        throw p1Error(
          'BATCH_RUN_MISMATCH',
          'decision candidate not in batch',
          { candidateId: d.candidateId },
        );
      }
    }
    for (const u of input.units) {
      if (!candIds.has(u.primaryCandidateId)) {
        throw p1Error(
          'BATCH_RUN_MISMATCH',
          'unit primary candidate not in batch',
          { candidateId: u.primaryCandidateId },
        );
      }
      for (const link of u.secondaryLinks ?? []) {
        if (!candIds.has(link.candidateId)) {
          throw p1Error(
            'BATCH_RUN_MISMATCH',
            'link candidate not in batch',
            { candidateId: link.candidateId },
          );
        }
      }
    }
    void p1RunId;
  }

  private async upsertBatchRow(
    qr: QueryRunner,
    p1RunId: string,
    input: PersistBatchInput,
    status: string,
  ) {
    await qr.query(
      `INSERT INTO organigrama.mc_evidence_batch (
         p1_run_id, batch_id, page_range_start, page_range_end,
         candidate_count, status, attempt_count, validation_status,
         unsupported_span_count, forbidden_taxonomy_hit_count,
         raw_output_ref, started_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (p1_run_id, batch_id) DO UPDATE SET
         status = EXCLUDED.status,
         candidate_count = EXCLUDED.candidate_count,
         attempt_count = organigrama.mc_evidence_batch.attempt_count + 1,
         validation_status = EXCLUDED.validation_status,
         unsupported_span_count = EXCLUDED.unsupported_span_count,
         forbidden_taxonomy_hit_count = EXCLUDED.forbidden_taxonomy_hit_count,
         raw_output_ref = EXCLUDED.raw_output_ref,
         started_at = COALESCE(organigrama.mc_evidence_batch.started_at, NOW())`,
      [
        p1RunId,
        input.batchId,
        input.pageRangeStart,
        input.pageRangeEnd,
        input.candidates.length,
        status,
        input.attemptCount ?? 1,
        input.validationStatus ?? 'NOT_VALIDATED',
        input.unsupportedSpanCount ?? 0,
        input.forbiddenTaxonomyHitCount ?? 0,
        input.rawOutputRef ?? null,
      ],
    );
  }

  private async markBatchSucceededInTx(
    qr: QueryRunner,
    p1RunId: string,
    input: PersistBatchInput,
  ) {
    await qr.query(
      `UPDATE organigrama.mc_evidence_batch SET
         status = 'SUCCEEDED',
         validation_status = $3,
         unsupported_span_count = $4,
         forbidden_taxonomy_hit_count = $5,
         finished_at = COALESCE($6, NOW())
       WHERE p1_run_id = $1 AND batch_id = $2`,
      [
        p1RunId,
        input.batchId,
        input.validationStatus ?? 'OK',
        input.unsupportedSpanCount ?? 0,
        input.forbiddenTaxonomyHitCount ?? 0,
        input.latencyFinishedAt ?? null,
      ],
    );
  }
}
