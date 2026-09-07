import type { P2InputEvidenceUnit } from '../p2/p2.types';
import type { ResolverEvidenceUnit } from '../experimental/deterministic-resolver/types';

export function fromP2InputUnits(
  units: P2InputEvidenceUnit[],
): ResolverEvidenceUnit[] {
  return units.map((u) => ({
    evidenceId: u.primaryCandidateId || u.evidenceUnitId,
    candidateId: u.primaryCandidateId || u.evidenceUnitId,
    evidenceKind: u.evidenceKind,
    explicitness: u.explicitness,
    decision: 'ACCEPTED',
    normalizedActivity: u.normalizedActivity,
    object: u.object,
    toolOrMethod: u.toolOrMethod,
    result: u.result,
    scope: u.scope,
    temporalContext: u.temporalContext,
    pageNumber: u.pageNumber,
    startOffset: u.startOffset,
    endOffset: u.endOffset,
  }));
}
