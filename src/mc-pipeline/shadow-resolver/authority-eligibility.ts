/**
 * Authority eligibility v4 + estados shadow.
 * skipGemini permanece false. Nunca autoridad real.
 */
import {
  CANDIDATE_2_POLICY_VERSION,
  CANDIDATE_2_RESOLVER_VERSION,
} from './skip-eligibility';
import type { FullContractEligibility } from './full-contract-eligibility';
import type { DeterministicFullContract } from './full-contract';
import type { ExperimentalR1Full } from './experimental-r1-full-adapter';
import { isDeterministicSkipGeminiEnabled } from './flags';

export type AuthorityShadowState =
  | 'SHADOW_ONLY'
  | 'AUTHORITY_ELIGIBLE'
  | 'AUTHORITY_SIMULATED'
  | 'FALLBACK_REQUIRED';

export type P3ContextClass = 'EXACT' | 'COMPATIBLE' | 'NARROWER' | 'BROADER' | 'CONFLICTING';

export type AuthorityEligibilityV4 = {
  shadowMode: 'SHADOW_ONLY';
  state: AuthorityShadowState;
  authorityEligible: boolean;
  eligibility: 'P2_AUTHORITY_ELIGIBLE' | 'NOT_AUTHORITY_ELIGIBLE';
  fallback: 'FALLBACK_REQUIRED' | 'NONE_SIMULATED';
  blockedBy: string[];
  p3Class: P3ContextClass;
  wouldActivateAuthority: false;
};

export function evaluateP2AuthorityEligibility(args: {
  resolverVersion: string;
  policyVersion: string;
  full: FullContractEligibility;
  contract: DeterministicFullContract;
  r1: ExperimentalR1Full;
  p3Class?: P3ContextClass;
}): AuthorityEligibilityV4 {
  const blockedBy: string[] = [];
  if (isDeterministicSkipGeminiEnabled()) blockedBy.push('SKIP_FLAG_MUST_STAY_FALSE');
  if (args.resolverVersion !== CANDIDATE_2_RESOLVER_VERSION) {
    blockedBy.push('RESOLVER_VERSION_NOT_APPROVED');
  }
  if (args.policyVersion !== CANDIDATE_2_POLICY_VERSION) {
    blockedBy.push('POLICY_VERSION_NOT_APPROVED');
  }
  if (!args.full.fullContractSkipEligible) blockedBy.push('FULL_CONTRACT_NOT_ELIGIBLE');
  if (!args.full.primarySkipEligible) blockedBy.push('PRIMARY_NOT_SAFE');
  if (!args.full.candidateSetSafe) blockedBy.push('CANDIDATE_SET_NOT_SAFE');
  if (!args.full.r1AdapterSafe) blockedBy.push('R1_NOT_COMPATIBLE');
  if (!args.full.contextPreserved) blockedBy.push('CONTEXT_NOT_SAFE');
  if (!args.full.noUnresolvedCompetitor) blockedBy.push('UNRESOLVED_COMPETITOR');
  if (!args.full.lineageValid) blockedBy.push('LINEAGE_INVALID');
  if (!args.full.contractValid) blockedBy.push('INVALID_CONTRACT');
  if (args.contract.decision === 'AMBIGUOUS') blockedBy.push('AMBIGUOUS');
  if (args.contract.decision === 'INSUFFICIENT_EVIDENCE') blockedBy.push('INSUFFICIENT');
  if (args.r1.contextInflatedR1) blockedBy.push('CONTEXT_INFLATED_R1');
  if (args.p3Class && args.p3Class !== 'EXACT' && args.p3Class !== 'COMPATIBLE') {
    blockedBy.push(`P3_CONTEXT_${args.p3Class}`);
  }

  const unique = [...new Set(blockedBy)].sort();
  const ok = unique.length === 0;
  return {
    shadowMode: 'SHADOW_ONLY',
    state: ok ? 'AUTHORITY_ELIGIBLE' : 'FALLBACK_REQUIRED',
    authorityEligible: ok,
    eligibility: ok ? 'P2_AUTHORITY_ELIGIBLE' : 'NOT_AUTHORITY_ELIGIBLE',
    fallback: ok ? 'NONE_SIMULATED' : 'FALLBACK_REQUIRED',
    blockedBy: unique,
    p3Class: args.p3Class ?? 'EXACT',
    wouldActivateAuthority: false,
  };
}
