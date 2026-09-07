/**
 * Skip eligibility v3 — CONTEXT no bloquea skip.
 * No activa skip. skipGemini permanece false.
 *
 * PRIMARY_SKIP_ELIGIBLE puede coexistir con CONTEXT.
 * P2_CONTRACT_SKIP_ELIGIBLE exige candidate set seguro:
 * primary C2 skip + RESOLVED + sin COMPETITOR + secondaries de policy + contexts preservados.
 * CONTEXT no implica skip=false.
 */
import type { CandidateSetV2Result } from './candidate-set-v2';
import type { SkipEval } from './skip-eligibility';

export type ContractSkipV3Eval = {
  primarySkipEligible: boolean;
  contractSkipEligible: boolean;
  contractEligibility: 'P2_CONTRACT_SKIP_ELIGIBLE' | 'NOT_CONTRACT_SKIP_ELIGIBLE';
  candidateSetSafe: boolean;
  blockedByCandidateSet: boolean;
  geminiFallbackRequired: boolean;
  reasons: string[];
  wouldSkip: false;
};

export function evaluateP2ContractSkipEligibilityV3(args: {
  primarySkip: SkipEval;
  set: CandidateSetV2Result;
}): ContractSkipV3Eval {
  const reasons: string[] = [];
  const primarySkipEligible = args.primarySkip.eligibility === 'SKIP_ELIGIBLE';

  if (!primarySkipEligible) reasons.push('PRIMARY_NOT_SKIP_ELIGIBLE');
  if (args.set.decision !== 'RESOLVED' || !args.set.primary) {
    reasons.push('DECISION_NOT_RESOLVED');
  }
  if (args.set.competitors.length > 0) reasons.push('HAS_COMPETITOR');
  if (args.set.decision === 'AMBIGUOUS') reasons.push('COMPETITORS_REQUIRE_ABSTENTION');

  const unsafeSecondary = args.set.secondaries.some(
    (s) => s.independentSourceCount < 2 || s.originEvidenceIds.length === 0,
  );
  if (unsafeSecondary) reasons.push('UNSAFE_SECONDARY');

  const uniqueReasons = [...new Set(reasons)].sort();
  const candidateSetSafe =
    args.set.decision === 'RESOLVED' &&
    args.set.competitors.length === 0 &&
    !unsafeSecondary;
  const contractSkipEligible = uniqueReasons.length === 0;
  const blockedByCandidateSet = primarySkipEligible && !contractSkipEligible;

  return {
    primarySkipEligible,
    contractSkipEligible,
    contractEligibility: contractSkipEligible
      ? 'P2_CONTRACT_SKIP_ELIGIBLE'
      : 'NOT_CONTRACT_SKIP_ELIGIBLE',
    candidateSetSafe,
    blockedByCandidateSet,
    geminiFallbackRequired: !contractSkipEligible,
    reasons: uniqueReasons,
    wouldSkip: false,
  };
}
