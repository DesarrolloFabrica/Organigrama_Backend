/**
 * Skip eligibility v2 — candidate-set contract.
 * No activa skip. skipGemini permanece false.
 *
 * PRIMARY_SKIP_ELIGIBLE = Candidate.2 skip (fase anterior).
 * P2_CONTRACT_SKIP_ELIGIBLE exige además candidate set seguro.
 * Si el primary es seguro y el set es incierto → Gemini fallback (no skip parcial).
 */
import type { CandidateSetResult } from './candidate-set';
import type { SkipEval } from './skip-eligibility';

export type ContractSkipEligibility =
  | 'P2_CONTRACT_SKIP_ELIGIBLE'
  | 'NOT_CONTRACT_SKIP_ELIGIBLE';

export type ContractSkipEval = {
  primarySkipEligible: boolean;
  contractSkipEligible: boolean;
  contractEligibility: ContractSkipEligibility;
  blockedByCandidateSet: boolean;
  geminiFallbackRequired: boolean;
  reasons: string[];
  wouldSkip: false;
};

export function evaluateP2ContractSkipEligibility(args: {
  primarySkip: SkipEval;
  set: CandidateSetResult;
}): ContractSkipEval {
  const reasons: string[] = [];
  const primarySkipEligible = args.primarySkip.eligibility === 'SKIP_ELIGIBLE';

  if (!primarySkipEligible) reasons.push('PRIMARY_NOT_SKIP_ELIGIBLE');
  if (args.set.decision !== 'RESOLVED' || !args.set.primaryCandidateCode) {
    reasons.push('DECISION_NOT_RESOLVED');
  }
  if (args.set.candidates.some((c) => c.role === 'COMPETITOR')) {
    reasons.push('HAS_COMPETITOR');
  }
  if (args.set.uncertain) reasons.push('CANDIDATE_SET_UNCERTAIN');
  if (args.set.thin.some((t) => t.reasonCodes.includes('THIN_SINGLE_SOURCE'))) {
    const boundaryThin = args.set.uncertainReasons.some((r) =>
      r.startsWith('THIN_BOUNDARY_'),
    );
    if (boundaryThin) reasons.push('THIN_BOUNDARY_SECONDARY');
  }

  const uniqueReasons = [...new Set(reasons)];
  const contractSkipEligible = uniqueReasons.length === 0;
  const blockedByCandidateSet = primarySkipEligible && !contractSkipEligible;

  return {
    primarySkipEligible,
    contractSkipEligible,
    contractEligibility: contractSkipEligible
      ? 'P2_CONTRACT_SKIP_ELIGIBLE'
      : 'NOT_CONTRACT_SKIP_ELIGIBLE',
    blockedByCandidateSet,
    geminiFallbackRequired: !contractSkipEligible,
    reasons: uniqueReasons.sort(),
    wouldSkip: false,
  };
}
