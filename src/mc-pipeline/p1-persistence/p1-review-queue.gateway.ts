import type { QueryRunner } from 'typeorm';
import type {
  PersistDecisionInput,
} from './p1-persistence.types';

/**
 * Frontera mínima: crea items OPEN. Sin resolución humana.
 */
export class P1ReviewQueueGateway {
  async insertOpenItemsForBatch(
    qr: QueryRunner,
    args: {
      p1RunId: string;
      snapshotId: string;
      decisions: PersistDecisionInput[];
      units: Array<{
        id: string;
        primaryCandidateId: string;
        reviewGate: string;
        explicitness: string;
      }>;
    },
  ): Promise<number> {
    let count = 0;

    for (const d of args.decisions) {
      if (d.decision === 'REVIEW_REQUIRED' || d.decision === 'AMBIGUOUS') {
        await qr.query(
          `INSERT INTO organigrama.mc_evidence_review_item (
             p1_run_id, snapshot_id, subject_type, subject_id,
             trigger_code, queue_status
           ) VALUES ($1,$2,'CANDIDATE',$3,$4,'OPEN')`,
          [
            args.p1RunId,
            args.snapshotId,
            d.candidateId,
            d.decision === 'AMBIGUOUS'
              ? 'AMBIGUOUS'
              : 'DECISION_REVIEW_REQUIRED',
          ],
        );
        count += 1;
      }
    }

    for (const u of args.units) {
      if (
        u.reviewGate === 'PENDING_REVIEW' ||
        u.explicitness === 'INFERRED'
      ) {
        await qr.query(
          `INSERT INTO organigrama.mc_evidence_review_item (
             p1_run_id, snapshot_id, subject_type, subject_id,
             trigger_code, queue_status
           ) VALUES ($1,$2,'EVIDENCE_UNIT',$3,'INFERRED_UNIT','OPEN')`,
          [args.p1RunId, args.snapshotId, u.id],
        );
        count += 1;
      }
    }

    return count;
  }

  /** Stub futuro — no resuelve. */
  async listOpenForRun(_p1RunId: string): Promise<never[]> {
    return [];
  }
}
