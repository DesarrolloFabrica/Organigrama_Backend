/**
 * Canary Camilo — diseño. No arma ejecución. No llama Gemini.
 * failure = CANARY_ABORT, nunca Gemini fallback.
 */
import { FULL_CONTRACT_ADAPTER_VERSION } from './full-contract';
import { CANDIDATE_SET_V2_POLICY_VERSION } from './candidate-set-policy-v2';
import { CANDIDATE_2_POLICY_VERSION } from './skip-eligibility';
import { RESOLVER_CANDIDATE_2_VERSION } from '../experimental/deterministic-resolver/types';
import { LIMITED_ROLLOUT_KILL_SWITCH_ENV } from './limited-rollout';
import { isP2DeterministicAuthorityEnabled, isP2DeterministicSkipGeminiEnabled } from './flags';
import type { ReuseDecision } from '../semantic-reuse/types';

export const MC1_P2_CANARY_ENABLED_FLAG = 'MC1_P2_CANARY_ENABLED' as const;
export const MC1_P2_CANARY_PERSON_IDS_FLAG = 'MC1_P2_CANARY_PERSON_IDS' as const;
export const MC1_P2_CANARY_SNAPSHOT_IDS_FLAG = 'MC1_P2_CANARY_SNAPSHOT_IDS' as const;

/** Hardcoded off. Env no arma el canary en esta fase. */
export const MC1_P2_CANARY_ENABLED = false as const;

export const CAMILO_CANARY_IDENTITY = {
  personId: 1,
  snapshotId: '8',
  p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S8-20260810150132-32bbea26',
  expectedPrimaryField: 'SOFTWARE_ENGINEERING',
  resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
  policyVersion: CANDIDATE_2_POLICY_VERSION,
  candidateSetPolicyVersion: CANDIDATE_SET_V2_POLICY_VERSION,
  contractAdapterVersion: FULL_CONTRACT_ADAPTER_VERSION,
} as const;

/** Runner aislado. No arma flags productivos. */
export const CANARY_ISOLATED_RUNNER_ID = 'mc1-p2-semantic-reuse-canary' as const;

/** Pins del dry-run de diseño. La ejecución los re-verifica, no los asume. */
export const CAMILO_CANARY_PINS = {
  personId: 1,
  snapshotId: '8',
  p1EvidenceIdentity: '3de0dc60f9a6e539c65bf72e08192d98b5435e88146957e8d6439e6aec66ca0f',
  authorityFingerprint: 'e6d611723e7f7d64f6c5725ff74a66859c4a1bce180cd9ce0d9bce0ce8533362',
  p3SemanticFingerprint: '1bb29bfe4fe31040d318f6dee100435a5e4532ba1357da9448a9802964c20d6a',
  p4SemanticFingerprint: '23f090b4bacb871b53f2f3b42c5b9025d846463a87419717e1a091642c96838d',
  catalogVersion: '1.13.0',
  p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S8-20260810150132-32bbea26',
} as const;

export const HISTORICAL_P2_TOKENS_COUNTERFACTUAL = 18359 as const;

export const CANARY_NOT_CANDIDATES = {
  Johan: { personId: 2, snapshotId: '12', reason: 'P3/P4 RECOMPUTE_REQUIRED' },
  S19: { personId: 9019, snapshotId: '19', reason: 'P3/P4 RECOMPUTE_REQUIRED' },
} as const;

export type CanaryAbortReason =
  | 'CANARY_ABORT_SCOPE_MISMATCH'
  | 'CANARY_DISABLED'
  | 'KILL_SWITCH'
  | 'NOT_ALLOWLISTED'
  | 'SNAPSHOT_MISMATCH'
  | 'P1_IDENTITY_MISMATCH'
  | 'RESOLVER_VERSION_MISMATCH'
  | 'POLICY_VERSION_MISMATCH'
  | 'CANDIDATE_SET_POLICY_MISMATCH'
  | 'ADAPTER_VERSION_MISMATCH'
  | 'AUTHORITY_NOT_ELIGIBLE'
  | 'P3_PACK_MISSING'
  | 'P4_PACK_MISSING'
  | 'P3_REUSE_UNSAFE'
  | 'P4_REUSE_UNSAFE'
  | 'CATALOG_CHANGED'
  | 'AUTHORITY_FINGERPRINT_MISMATCH'
  | 'P3_FINGERPRINT_MISMATCH'
  | 'P4_FINGERPRINT_MISMATCH'
  | 'PROFILE_REASSEMBLY_UNAVAILABLE'
  | 'P2_SHAPE_MISMATCH'
  | 'P1_PACK_MISSING';

export type CanaryGateDecision = 'CANARY_DRY_RUN_READY' | 'CANARY_ABORT';

export type CanaryPreconditionsInput = {
  personId: number;
  snapshotId: string;
  p1EvidenceIdentity: string;
  pinnedP1EvidenceIdentity: string;
  authorityFingerprint: string;
  pinnedAuthorityFingerprint: string;
  p3SemanticFingerprint: string;
  pinnedP3SemanticFingerprint: string;
  p4SemanticFingerprint: string;
  pinnedP4SemanticFingerprint: string;
  resolverVersion: string;
  policyVersion: string;
  candidateSetPolicyVersion: string;
  contractAdapterVersion: string;
  catalogVersion: string;
  pinnedCatalogVersion: string;
  authorityEligible: boolean;
  p3PackExists: boolean;
  p4PackExists: boolean;
  p3Reuse: ReuseDecision;
  p4Reuse: ReuseDecision;
  profileReassemblyAvailable: boolean;
  canaryEnabled?: boolean;
  killPermits?: boolean;
};

export function isP2CanaryEnabled(): false {
  void process.env[MC1_P2_CANARY_ENABLED_FLAG];
  void process.env[MC1_P2_CANARY_PERSON_IDS_FLAG];
  void process.env[MC1_P2_CANARY_SNAPSHOT_IDS_FLAG];
  return MC1_P2_CANARY_ENABLED;
}

export function canaryKillSwitchPermits(override?: boolean): boolean {
  if (override === false) return false;
  if (override === true) return true;
  const env = process.env[LIMITED_ROLLOUT_KILL_SWITCH_ENV]?.trim().toLowerCase();
  if (env === 'false' || env === '0' || env === 'kill') return false;
  return false;
}

export function productionCanaryArmed(): false {
  void isP2DeterministicAuthorityEnabled();
  void isP2DeterministicSkipGeminiEnabled();
  return false;
}

export function isSafeReuse(d: ReuseDecision): boolean {
  return d === 'SAFE_REUSE' || d === 'SAFE_REUSE_WITH_METADATA_CHANGE';
}

export function isCamiloCanaryIdentity(args: { personId: number; snapshotId: string }): boolean {
  return (
    args.personId === CAMILO_CANARY_IDENTITY.personId &&
    args.snapshotId === CAMILO_CANARY_IDENTITY.snapshotId
  );
}

/** Hard lock de scope. No usa el nombre. */
export function assertCanaryScope(args: { personId: number; snapshotId: string }): {
  ok: true;
} | { ok: false; reason: 'CANARY_ABORT_SCOPE_MISMATCH' } {
  if (!isCamiloCanaryIdentity(args)) {
    return { ok: false, reason: 'CANARY_ABORT_SCOPE_MISMATCH' };
  }
  return { ok: true };
}

export type P2CanaryShapeInput = {
  decision?: string | null;
  authorityEligible: boolean;
  primary: string | null;
  secondaries: string[];
  context: string[];
  producedBy: string | null;
  valid?: boolean;
};

export function assertP2CanaryShape(p2: P2CanaryShapeInput): {
  ok: true;
} | { ok: false; reason: 'P2_SHAPE_MISMATCH'; mismatches: string[] } {
  const mismatches: string[] = [];
  if (p2.decision !== 'RESOLVED') mismatches.push(`decision=${p2.decision}`);
  if (p2.authorityEligible !== true) mismatches.push('authorityEligible=false');
  if (p2.primary !== CAMILO_CANARY_IDENTITY.expectedPrimaryField) {
    mismatches.push(`primary=${p2.primary}`);
  }
  if (p2.secondaries.length !== 0) mismatches.push(`secondaries=${p2.secondaries.join(',')}`);
  if (p2.context.length !== 0) mismatches.push(`context=${p2.context.join(',')}`);
  if (p2.producedBy !== 'DETERMINISTIC_RESOLVER') mismatches.push(`producedBy=${p2.producedBy}`);
  if (p2.valid !== true) mismatches.push('contract.valid=false');
  if (mismatches.length) return { ok: false, reason: 'P2_SHAPE_MISMATCH', mismatches };
  return { ok: true };
}

/**
 * Fail-closed. Ningún camino emite Gemini fallback.
 * canaryEnabled/killPermits se evalúan para ejecución futura; el dry-run
 * de diseño puede omitirlos (skipDryRunFlags).
 */
export function evaluateCanaryPreconditions(
  input: CanaryPreconditionsInput,
  opts?: { skipExecutionFlags?: boolean },
): {
  decision: CanaryGateDecision;
  blockedBy: CanaryAbortReason[];
  geminiFallback: 'DISABLED_FOR_CANARY';
} {
  const blockedBy: CanaryAbortReason[] = [];
  const canaryEnabled = input.canaryEnabled ?? isP2CanaryEnabled();
  const killPermits = input.killPermits ?? canaryKillSwitchPermits();
  if (!opts?.skipExecutionFlags) {
    if (!canaryEnabled) blockedBy.push('CANARY_DISABLED');
    if (!killPermits) blockedBy.push('KILL_SWITCH');
  }
  if (!isCamiloCanaryIdentity({ personId: input.personId, snapshotId: input.snapshotId })) {
    blockedBy.push('NOT_ALLOWLISTED');
  }
  if (input.snapshotId !== CAMILO_CANARY_IDENTITY.snapshotId) blockedBy.push('SNAPSHOT_MISMATCH');
  if (input.p1EvidenceIdentity !== input.pinnedP1EvidenceIdentity) {
    blockedBy.push('P1_IDENTITY_MISMATCH');
  }
  if (input.resolverVersion !== CAMILO_CANARY_IDENTITY.resolverVersion) {
    blockedBy.push('RESOLVER_VERSION_MISMATCH');
  }
  if (input.policyVersion !== CAMILO_CANARY_IDENTITY.policyVersion) {
    blockedBy.push('POLICY_VERSION_MISMATCH');
  }
  if (input.candidateSetPolicyVersion !== CAMILO_CANARY_IDENTITY.candidateSetPolicyVersion) {
    blockedBy.push('CANDIDATE_SET_POLICY_MISMATCH');
  }
  if (input.contractAdapterVersion !== CAMILO_CANARY_IDENTITY.contractAdapterVersion) {
    blockedBy.push('ADAPTER_VERSION_MISMATCH');
  }
  if (input.catalogVersion !== input.pinnedCatalogVersion) blockedBy.push('CATALOG_CHANGED');
  if (!input.authorityEligible) blockedBy.push('AUTHORITY_NOT_ELIGIBLE');
  if (input.authorityFingerprint !== input.pinnedAuthorityFingerprint) {
    blockedBy.push('AUTHORITY_FINGERPRINT_MISMATCH');
  }
  if (!input.p3PackExists) blockedBy.push('P3_PACK_MISSING');
  if (!input.p4PackExists) blockedBy.push('P4_PACK_MISSING');
  if (!isSafeReuse(input.p3Reuse)) blockedBy.push('P3_REUSE_UNSAFE');
  if (!isSafeReuse(input.p4Reuse)) blockedBy.push('P4_REUSE_UNSAFE');
  if (input.p3SemanticFingerprint !== input.pinnedP3SemanticFingerprint) {
    blockedBy.push('P3_FINGERPRINT_MISMATCH');
  }
  if (input.p4SemanticFingerprint !== input.pinnedP4SemanticFingerprint) {
    blockedBy.push('P4_FINGERPRINT_MISMATCH');
  }
  if (!input.profileReassemblyAvailable) blockedBy.push('PROFILE_REASSEMBLY_UNAVAILABLE');
  return {
    decision: blockedBy.length === 0 ? 'CANARY_DRY_RUN_READY' : 'CANARY_ABORT',
    blockedBy,
    geminiFallback: 'DISABLED_FOR_CANARY',
  };
}

export const CANARY_EXECUTION_CONTRACT = {
  mode: 'manual/offline controlled',
  requestDriven: false,
  geminiFallback: 'DISABLED_FOR_CANARY',
  failure: 'CANARY_ABORT',
  expectedGeminiCalls: 0,
  expectedGeminiTokens: 0,
  cloudWrites: false,
  apiChanges: false,
  frontendChanges: false,
  rollbackNow: 'no-op',
  futureRollback: 'kill switch disables canary',
  actualExecutionThisPhase: false,
} as const;
