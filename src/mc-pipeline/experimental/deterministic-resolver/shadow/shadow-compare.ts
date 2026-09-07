import type {
  ProductionP2Snapshot,
  ProductionP3Snapshot,
  ShadowComparison,
  ShadowComparisonClass,
  ShadowDecision,
  ShadowDecisionStatus,
  ShadowP3Decision,
} from './shadow-types';
import { SHADOW_NAMESPACE } from './shadow-types';

function reviewIfResolvedMismatch(
  decision: ShadowDecisionStatus,
  comparisonClass: ShadowComparisonClass,
): boolean {
  if (decision !== 'RESOLVED') return false;
  return (
    comparisonClass === 'SHADOW_FALSE_POSITIVE_CANDIDATE' ||
    comparisonClass === 'PRODUCTION_ABSTAINED'
  );
}

/**
 * Compara shadow vs canónico. No asume que producción/Gemini tiene razón.
 */
export function compareShadowP2(args: {
  personId: number;
  snapshotId: string;
  shadow: ShadowDecision;
  production: ProductionP2Snapshot;
}): ShadowComparison {
  const { shadow, production } = args;
  let comparisonClass: ShadowComparisonClass;
  let note: string | null = null;

  if (shadow.decision === 'RESOLVED') {
    const code = shadow.candidateCode;
    if (code && code === production.rank1) {
      comparisonClass = 'EXACT_MATCH';
    } else if (code && production.active.includes(code)) {
      comparisonClass = 'COMPATIBLE_MATCH';
      note = 'Shadow RESOLVED is historically ACTIVE but not rank-1';
    } else if (!production.rank1 && production.active.length === 0) {
      comparisonClass = 'PRODUCTION_ABSTAINED';
      note = 'Shadow resolved; canonical pack has no ACTIVE field';
    } else {
      comparisonClass = 'SHADOW_FALSE_POSITIVE_CANDIDATE';
      note = 'Shadow RESOLVED disagrees with canonical rank-1/active — review; production is not gold';
    }
  } else if (shadow.decision === 'AMBIGUOUS') {
    comparisonClass =
      shadow.reasonCodes.includes('COMPETING_FIELDS') ||
      shadow.reasonCodes.includes('INSUFFICIENT_DIFFERENTIAL_SIGNAL')
        ? 'LEGITIMATE_AMBIGUITY'
        : 'SHADOW_ABSTAINED';
    note = `competitors=${shadow.competitors.join(',')}`;
  } else if (production.active.length > 0) {
    comparisonClass = shadow.reasonCodes.includes('CATALOG_GAP')
      ? 'CATALOG_GAP'
      : 'SHADOW_FALSE_NEGATIVE_CANDIDATE';
  } else {
    comparisonClass = 'EXACT_MATCH';
  }

  return {
    namespace: SHADOW_NAMESPACE,
    notAProductionResult: true,
    phase: 'P2',
    personId: args.personId,
    snapshotId: args.snapshotId,
    shadowDecision: shadow.decision,
    productionDecision: production.rank1
      ? `ACTIVE rank-1 ${production.rank1}`
      : 'NO_ACTIVE_FIELD',
    comparisonClass,
    candidateCode: shadow.candidateCode,
    needsHumanReview: reviewIfResolvedMismatch(shadow.decision, comparisonClass),
    note,
  };
}

export function compareShadowP3(args: {
  personId: number;
  snapshotId: string;
  shadow: ShadowP3Decision;
  production: ProductionP3Snapshot;
}): ShadowComparison {
  const { shadow, production } = args;
  let comparisonClass: ShadowComparisonClass;
  let note: string | null = null;

  if (shadow.decision === 'RESOLVED') {
    if (production.status === 'OBSERVED') {
      comparisonClass = 'EXACT_MATCH';
    } else if (production.status === 'WEAK') {
      comparisonClass = 'COMPATIBLE_MATCH';
      note = 'Canonical WEAK; shadow RESOLVED is compatible, not automatic gold';
    } else {
      comparisonClass = 'SHADOW_FALSE_POSITIVE_CANDIDATE';
      note = 'Shadow RESOLVED / canonical NOT_EMITTED — review candidate';
    }
  } else if (shadow.decision === 'AMBIGUOUS') {
    comparisonClass =
      shadow.reasonCodes.includes('FIELD_NOT_UNIQUELY_RESOLVED') ||
      shadow.reasonCodes.includes('SINGLE_SOURCE_THIN') ||
      shadow.reasonCodes.includes('COMPETING_FIELDS')
        ? 'LEGITIMATE_AMBIGUITY'
        : 'SHADOW_ABSTAINED';
  } else if (production.status === 'OBSERVED') {
    comparisonClass = shadow.reasonCodes.includes('CATALOG_GAP')
      ? 'CATALOG_GAP'
      : 'SHADOW_FALSE_NEGATIVE_CANDIDATE';
    note = 'Canonical OBSERVED; shadow did not resolve — production is not automatically correct';
  } else if (production.status === 'WEAK') {
    comparisonClass = 'SHADOW_ABSTAINED';
  } else {
    comparisonClass = 'EXACT_MATCH';
  }

  return {
    namespace: SHADOW_NAMESPACE,
    notAProductionResult: true,
    phase: 'P3',
    personId: args.personId,
    snapshotId: args.snapshotId,
    shadowDecision: shadow.decision,
    productionDecision: production.status,
    comparisonClass,
    candidateCode: shadow.specialtyCode,
    needsHumanReview: reviewIfResolvedMismatch(shadow.decision, comparisonClass),
    note,
  };
}
