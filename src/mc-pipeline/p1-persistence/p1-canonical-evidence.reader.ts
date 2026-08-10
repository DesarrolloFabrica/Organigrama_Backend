import type { DataSource } from 'typeorm';
import type { CanonicalEvidenceRow } from './p1-persistence.types';

/**
 * Solo lectura. Consulta exclusivamente la vista canónica P2.
 * No accede a tablas base mc_evidence_* / mc_p1_run.
 */
export class P1CanonicalEvidenceReader {
  constructor(private readonly dataSource: DataSource) {}

  async getCanonicalEvidenceForP2(filters?: {
    snapshotId?: string;
  }): Promise<CanonicalEvidenceRow[]> {
    if (filters?.snapshotId) {
      return this.dataSource.query(
        `SELECT evidence_unit_id, p1_run_id, snapshot_id, primary_candidate_id,
                page_number, start_offset, end_offset, span_text_hash,
                evidence_kind, explicitness, review_gate, content_fingerprint,
                lineage_key, run_status
           FROM organigrama.v_mc_p1_canonical_evidence_for_p2
          WHERE snapshot_id = $1`,
        [filters.snapshotId],
      );
    }
    return this.dataSource.query(
      `SELECT evidence_unit_id, p1_run_id, snapshot_id, primary_candidate_id,
              page_number, start_offset, end_offset, span_text_hash,
              evidence_kind, explicitness, review_gate, content_fingerprint,
              lineage_key, run_status
         FROM organigrama.v_mc_p1_canonical_evidence_for_p2`,
    );
  }
}
