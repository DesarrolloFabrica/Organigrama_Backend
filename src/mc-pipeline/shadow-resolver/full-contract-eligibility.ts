/**
 * P2_FULL_CONTRACT_SKIP_ELIGIBLE — no activa skip.
 * Todo P2 determinístico o fallback Gemini completo. Sin autoridad parcial.
 */
import type { SkipEval } from './skip-eligibility';
import type { ContractSkipV3Eval } from './skip-eligibility-v3';
import type { DeterministicFullContract } from './full-contract';
import type { ExperimentalR1Full } from './experimental-r1-full-adapter';

export type FullContractEligibility = {
  primarySkipEligible: boolean;
  candidateSetSafe: boolean;
  r1AdapterSafe: boolean;
  contextPreserved: boolean;
  noUnresolvedCompetitor: boolean;
  lineageValid: boolean;
  contractValid: boolean;
  fullContractSkipEligible: boolean;
  eligibility: 'P2_FULL_CONTRACT_SKIP_ELIGIBLE' | 'NOT_FULL_CONTRACT_SKIP_ELIGIBLE';
  fallback: 'GEMINI_FALLBACK_REQUIRED' | 'NONE_SIMULATED';
  blockedBy: string[];
  wouldSkip: false;
};

export function evaluateFullContractEligibility(args: {
  primarySkip: SkipEval;
  contractV3: ContractSkipV3Eval;
  contract: DeterministicFullContract;
  r1: ExperimentalR1Full;
}): FullContractEligibility {
  const blockedBy: string[] = [];
  const primarySkipEligible = args.primarySkip.eligibility === 'SKIP_ELIGIBLE';
  if (!primarySkipEligible) blockedBy.push('PRIMARY_NOT_SKIP_ELIGIBLE');
  if (!args.contractV3.candidateSetSafe) blockedBy.push('CANDIDATE_SET_NOT_SAFE');
  if (args.contract.decision !== 'RESOLVED' || !args.contract.primary) {
    blockedBy.push('DECISION_NOT_RESOLVED');
  }
  if (args.contract.competitors.length > 0) blockedBy.push('UNRESOLVED_COMPETITOR');
  if (!args.contract.valid) blockedBy.push('CONTRACT_INVALID');
  if (args.contract.invalidReasons.includes('LINEAGE_UNMAPPED')) blockedBy.push('LINEAGE_INVALID');
  if (args.r1.envelope.payload.fieldResolutionStatus !== 'RESOLVED') {
    blockedBy.push('R1_NOT_RESOLVED');
  }
  if (args.r1.contextInflatedR1) blockedBy.push('CONTEXT_INFLATED_R1');
  const r1Seconds = new Set(
    (args.r1.envelope.payload.secondaryFields ?? [])
      .map((s) => s.fieldCode)
      .filter((x): x is string => !!x),
  );
  if (args.contract.contextFields.some((c) => r1Seconds.has(c.fieldCode))) {
    blockedBy.push('CONTEXT_IN_R1_SECONDARIES');
  }
  const contextPreserved = args.contract.contextFields.every((c) =>
    args.r1.contextFields.some((x) => x.fieldCode === c.fieldCode),
  );
  if (!contextPreserved) blockedBy.push('CONTEXT_NOT_PRESERVED');
  if (args.contract.secondaries.some((s) => s.independentSourceCount < 2)) {
    blockedBy.push('UNSAFE_SECONDARY');
  }

  const unique = [...new Set(blockedBy)].sort();
  const full = unique.length === 0;
  return {
    primarySkipEligible,
    candidateSetSafe: args.contractV3.candidateSetSafe,
    r1AdapterSafe: !args.r1.contextInflatedR1 && args.r1.envelope.payload.fieldResolutionStatus === 'RESOLVED',
    contextPreserved,
    noUnresolvedCompetitor: args.contract.competitors.length === 0,
    lineageValid: !args.contract.invalidReasons.includes('LINEAGE_UNMAPPED'),
    contractValid: args.contract.valid,
    fullContractSkipEligible: full,
    eligibility: full
      ? 'P2_FULL_CONTRACT_SKIP_ELIGIBLE'
      : 'NOT_FULL_CONTRACT_SKIP_ELIGIBLE',
    fallback: full ? 'NONE_SIMULATED' : 'GEMINI_FALLBACK_REQUIRED',
    blockedBy: unique,
    wouldSkip: false,
  };
}
