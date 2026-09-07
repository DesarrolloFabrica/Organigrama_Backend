/**
 * Runtime de autoridad determinística P2.
 * Un solo camino de código: producción (inactiva) y simulateAuthority.
 * Nunca salta Gemini. Nunca muta output productivo en esta fase.
 */
import { PROFESSIONAL_FIELD_CATALOG_VERSION } from '../catalog/professional-fields';
import { EXPERIMENTAL_RESOLVER_POLICY_V03 } from '../experimental/deterministic-resolver/experimental-policy-v03';
import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { canonicalEvidenceIdentity } from '../experimental/deterministic-resolver/shadow/fingerprint';
import {
  RESOLVER_CANDIDATE_2_VERSION,
  type ResolverEvidenceUnit,
} from '../experimental/deterministic-resolver/types';
import { evaluateP2AuthorityEligibility } from './authority-eligibility';
import {
  computeAuthorityFingerprint,
  type AuthorityLineage,
} from './authority-fingerprint';
import { DeterministicP2ReuseStore } from './authority-reuse-store';
import { buildCandidateSetV2, type CandidateSetV2Result } from './candidate-set-v2';
import { CANDIDATE_SET_POLICY_V2 } from './candidate-set-policy-v2';
import { adaptFullContractToExperimentalR1 } from './experimental-r1-full-adapter';
import {
  AUTHORITY_LATENCY_ALERT_MS,
  isP2DeterministicAuthorityEnabled,
  isP2DeterministicResolverEnabled,
  isP2DeterministicSkipGeminiEnabled,
} from './flags';
import { buildDeterministicFullContract, FULL_CONTRACT_ADAPTER_VERSION } from './full-contract';
import { evaluateFullContractEligibility } from './full-contract-eligibility';
import { buildEvidenceIdMap } from './full-contract-evidence';
import { contextRolesValid, p3ContextRuntime } from './p3-context-runtime';
import {
  CANDIDATE_2_POLICY_VERSION,
  evaluateP2SkipEligibility,
} from './skip-eligibility';
import { evaluateP2ContractSkipEligibilityV3 } from './skip-eligibility-v3';
import { isolateDeterministicAuthorityFailure } from './authority-failure';
import type { DeterministicFullContract } from './full-contract';
import type { ExperimentalR1Full } from './experimental-r1-full-adapter';
import type { P3FieldContextShadow } from './p3-shadow-context';

export const P2_DETERMINISTIC_AUTHORITY_EVENTS = [
  'P2_DETERMINISTIC_AUTHORITY_ELIGIBLE',
  'P2_DETERMINISTIC_AUTHORITY_SIMULATED',
  'P2_DETERMINISTIC_AUTHORITY_BLOCKED',
  'P2_DETERMINISTIC_FALLBACK_REQUIRED',
  'P2_DETERMINISTIC_REUSED',
  'P2_DETERMINISTIC_ERROR',
] as const;

export type P2DeterministicAuthorityEvent = (typeof P2_DETERMINISTIC_AUTHORITY_EVENTS)[number];

export const AUTHORITY_ALLOWLIST = {
  enabled: false,
  allowedFields: ['SOFTWARE_ENGINEERING', 'COMMUNICATIONS'] as const,
  allowedSnapshotIds: [] as string[],
};

export const AUTHORITY_DOMAIN_GATE = {
  enabled: false,
  allowedPrimaryFields: ['SOFTWARE_ENGINEERING', 'COMMUNICATIONS'] as const,
};

export type AuthorityRuntimeFlags = {
  resolverEnabled: boolean;
  authorityEnabled: boolean;
  skipEnabled: boolean;
};

export type AuthorityInjection = {
  throw?: boolean;
  malformedSet?: boolean;
  missingCatalog?: boolean;
  badFingerprint?: boolean;
  invalidContextRole?: boolean;
};

export type AuthorityRuntimeResult = {
  evaluated: boolean;
  authorityEligible: boolean;
  simulated: boolean;
  reused: boolean;
  error: boolean;
  event: P2DeterministicAuthorityEvent | 'DISABLED';
  fallback: 'FALLBACK_REQUIRED' | 'NONE_SIMULATED';
  fallbackReason: string[];
  replaceProduction: false;
  producedBy: 'DETERMINISTIC_RESOLVER' | null;
  productionUnaffected: true;
  p3ContextRuntime: 'P3_CONTEXT_RUNTIME_DISABLED';
  contract: DeterministicFullContract | null;
  r1: ExperimentalR1Full | null;
  p3: P3FieldContextShadow[];
  lineage: AuthorityLineage | null;
  timings: {
    resolverMs: number;
    candidateSetMs: number;
    contractAdapterMs: number;
    totalMs: number;
    latencyAlert: boolean;
  };
  flags: AuthorityRuntimeFlags;
  observability: {
    personId: string | null;
    snapshotId: string;
    authorityEligible: boolean;
    fallbackReason: string[];
    resolverVersion: string;
    policyVersion: string;
    fingerprint: string | null;
    durationMs: number;
  };
};

const POLICY = EXPERIMENTAL_RESOLVER_POLICY_V03;
const SKIP_OPTS = { candidate: 'C2' as const, policy: POLICY };

export function resolveAuthorityRuntimeFlags(
  overrides?: Partial<AuthorityRuntimeFlags>,
): AuthorityRuntimeFlags {
  return {
    resolverEnabled: overrides?.resolverEnabled ?? isP2DeterministicResolverEnabled(),
    authorityEnabled: overrides?.authorityEnabled ?? isP2DeterministicAuthorityEnabled(),
    skipEnabled: overrides?.skipEnabled ?? isP2DeterministicSkipGeminiEnabled(),
  };
}

/**
 * Precedence: authority AND skip AND kill-switch hardcoded.
 * skip=true accidental no basta. authority=false nunca es autoritativo.
 */
export function isAuthoritativeUseAllowed(flags: AuthorityRuntimeFlags): boolean {
  return (
    flags.authorityEnabled === true &&
    flags.skipEnabled === true &&
    isP2DeterministicAuthorityEnabled() &&
    isP2DeterministicSkipGeminiEnabled()
  );
}

function emptyTimings(totalMs: number): AuthorityRuntimeResult['timings'] {
  return {
    resolverMs: 0,
    candidateSetMs: 0,
    contractAdapterMs: 0,
    totalMs,
    latencyAlert: totalMs >= AUTHORITY_LATENCY_ALERT_MS,
  };
}

function disabledResult(snapshotId: string, personId: string | null, flags: AuthorityRuntimeFlags, started: number): AuthorityRuntimeResult {
  const totalMs = Date.now() - started;
  return {
    evaluated: false,
    authorityEligible: false,
    simulated: false,
    reused: false,
    error: false,
    event: 'DISABLED',
    fallback: 'FALLBACK_REQUIRED',
    fallbackReason: ['AUTHORITY_DISABLED'],
    replaceProduction: false,
    producedBy: null,
    productionUnaffected: true,
    p3ContextRuntime: 'P3_CONTEXT_RUNTIME_DISABLED',
    contract: null,
    r1: null,
    p3: [],
    lineage: null,
    timings: emptyTimings(totalMs),
    flags,
    observability: {
      personId,
      snapshotId,
      authorityEligible: false,
      fallbackReason: ['AUTHORITY_DISABLED'],
      resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
      policyVersion: CANDIDATE_2_POLICY_VERSION,
      fingerprint: null,
      durationMs: totalMs,
    },
  };
}

function fallbackResult(args: {
  snapshotId: string;
  personId: string | null;
  flags: AuthorityRuntimeFlags;
  started: number;
  reasons: string[];
  event: P2DeterministicAuthorityEvent;
  error: boolean;
  timings?: AuthorityRuntimeResult['timings'];
  simulated: boolean;
}): AuthorityRuntimeResult {
  const totalMs = Date.now() - args.started;
  const timings = args.timings ?? emptyTimings(totalMs);
  return {
    evaluated: true,
    authorityEligible: false,
    simulated: args.simulated,
    reused: false,
    error: args.error,
    event: args.event,
    fallback: 'FALLBACK_REQUIRED',
    fallbackReason: args.reasons,
    replaceProduction: false,
    producedBy: null,
    productionUnaffected: true,
    p3ContextRuntime: 'P3_CONTEXT_RUNTIME_DISABLED',
    contract: null,
    r1: null,
    p3: [],
    lineage: null,
    timings,
    flags: args.flags,
    observability: {
      personId: args.personId,
      snapshotId: args.snapshotId,
      authorityEligible: false,
      fallbackReason: args.reasons,
      resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
      policyVersion: CANDIDATE_2_POLICY_VERSION,
      fingerprint: null,
      durationMs: timings.totalMs,
    },
  };
}

export function evaluateDeterministicAuthority(args: {
  snapshotId: string;
  personId?: string | number;
  units: ResolverEvidenceUnit[];
  artifactIdentity: string;
  simulateAuthority?: boolean;
  flags?: Partial<AuthorityRuntimeFlags>;
  reuseStore?: DeterministicP2ReuseStore;
  inject?: AuthorityInjection;
}): AuthorityRuntimeResult {
  const started = Date.now();
  const personId = args.personId == null ? null : String(args.personId);
  const flags = resolveAuthorityRuntimeFlags(args.flags);
  const simulate = args.simulateAuthority === true;

  if (!flags.resolverEnabled && !simulate && !flags.authorityEnabled) {
    return disabledResult(args.snapshotId, personId, flags, started);
  }

  try {
    if (args.inject?.throw) throw new Error('injected resolver throw');
    if (args.inject?.missingCatalog) {
      return fallbackResult({
        snapshotId: args.snapshotId,
        personId,
        flags,
        started,
        reasons: ['CATALOG_INCOMPATIBLE'],
        event: 'P2_DETERMINISTIC_FALLBACK_REQUIRED',
        error: false,
        simulated: simulate,
      });
    }
    if (args.inject?.badFingerprint) {
      return fallbackResult({
        snapshotId: args.snapshotId,
        personId,
        flags,
        started,
        reasons: ['FINGERPRINT_FAILED'],
        event: 'P2_DETERMINISTIC_ERROR',
        error: true,
        simulated: simulate,
      });
    }

    const authorityFingerprint = computeAuthorityFingerprint({ units: args.units });
    const cached = args.reuseStore?.lookup(authorityFingerprint);
    if (cached && cached.snapshotId === args.snapshotId) {
      const totalMs = Date.now() - started;
      const timings = emptyTimings(totalMs);
      return {
        evaluated: true,
        authorityEligible: true,
        simulated: simulate,
        reused: true,
        error: false,
        event: 'P2_DETERMINISTIC_REUSED',
        fallback: 'NONE_SIMULATED',
        fallbackReason: [],
        replaceProduction: false,
        producedBy: 'DETERMINISTIC_RESOLVER',
        productionUnaffected: true,
        p3ContextRuntime: 'P3_CONTEXT_RUNTIME_DISABLED',
        contract: null,
        r1: null,
        p3: [],
        lineage: {
          snapshotId: args.snapshotId,
          p1EvidenceIdentity: canonicalEvidenceIdentity(args.units),
          catalogFingerprint: PROFESSIONAL_FIELD_CATALOG_VERSION,
          resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
          policyVersion: CANDIDATE_2_POLICY_VERSION,
          candidateSetPolicyVersion: CANDIDATE_SET_POLICY_V2.policyVersion,
          contractAdapterVersion: FULL_CONTRACT_ADAPTER_VERSION,
          authorityFingerprint,
        },
        timings,
        flags,
        observability: {
          personId,
          snapshotId: args.snapshotId,
          authorityEligible: true,
          fallbackReason: [],
          resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
          policyVersion: CANDIDATE_2_POLICY_VERSION,
          fingerprint: authorityFingerprint,
          durationMs: totalMs,
        },
      };
    }

    const t0 = Date.now();
    const c2 = resolveFieldsHardened({
      snapshotId: args.snapshotId,
      units: args.units,
      policy: POLICY,
      resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
    });
    const resolverMs = Date.now() - t0;

    const t1 = Date.now();
    let set: CandidateSetV2Result = buildCandidateSetV2({ p2: c2, units: args.units, policy: POLICY });
    if (args.inject?.malformedSet) {
      set = { ...set, decision: 'RESOLVED', primary: null, candidateSetSafe: false };
    }
    const candidateSetMs = Date.now() - t1;

    const t2 = Date.now();
    const evidenceMap = buildEvidenceIdMap({
      units: args.units,
      artifactIdentity: args.artifactIdentity,
    });
    const contract = buildDeterministicFullContract({
      set,
      units: args.units,
      evidenceMap,
    });
    const r1 = adaptFullContractToExperimentalR1(set);
    const p3Wrap = p3ContextRuntime({ r1, contract });
    let p3 = p3Wrap.fields;
    if (args.inject?.invalidContextRole) {
      p3 = [{ fieldCode: 'VISUAL_DESIGN', role: 'OBSERVED' as P3FieldContextShadow['role'], source: 'P2_CONTEXT' }];
    }
    const contractAdapterMs = Date.now() - t2;
    const totalMs = Date.now() - started;
    const timings = {
      resolverMs,
      candidateSetMs,
      contractAdapterMs,
      totalMs,
      latencyAlert: totalMs >= AUTHORITY_LATENCY_ALERT_MS,
    };

    if (!contract.valid || args.inject?.malformedSet) {
      isolateDeterministicAuthorityFailure('INVALID_CONTRACT');
      return fallbackResult({
        snapshotId: args.snapshotId,
        personId,
        flags,
        started,
        reasons: contract.invalidReasons.length ? contract.invalidReasons : ['INVALID_CONTRACT'],
        event: 'P2_DETERMINISTIC_FALLBACK_REQUIRED',
        error: false,
        timings,
        simulated: simulate,
      });
    }
    if (!contextRolesValid(p3) || args.inject?.invalidContextRole) {
      return fallbackResult({
        snapshotId: args.snapshotId,
        personId,
        flags,
        started,
        reasons: ['INVALID_CONTEXT_ROLE'],
        event: 'P2_DETERMINISTIC_FALLBACK_REQUIRED',
        error: false,
        timings,
        simulated: simulate,
      });
    }

    const lineage: AuthorityLineage = {
      snapshotId: args.snapshotId,
      p1EvidenceIdentity: canonicalEvidenceIdentity(args.units),
      catalogFingerprint: PROFESSIONAL_FIELD_CATALOG_VERSION,
      resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
      policyVersion: CANDIDATE_2_POLICY_VERSION,
      candidateSetPolicyVersion: CANDIDATE_SET_POLICY_V2.policyVersion,
      contractAdapterVersion: FULL_CONTRACT_ADAPTER_VERSION,
      authorityFingerprint,
    };

    const primarySkip = evaluateP2SkipEligibility(c2, args.units, SKIP_OPTS);
    const v3 = evaluateP2ContractSkipEligibilityV3({ primarySkip, set });
    const full = evaluateFullContractEligibility({ primarySkip, contractV3: v3, contract, r1 });
    const elig = evaluateP2AuthorityEligibility({
      resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
      policyVersion: CANDIDATE_2_POLICY_VERSION,
      full,
      contract,
      r1,
    });

    let reused = false;
    if (args.reuseStore && elig.authorityEligible) {
      args.reuseStore.insert({
        authorityFingerprint,
        snapshotId: args.snapshotId,
        producedBy: 'DETERMINISTIC_RESOLVER',
        primary: contract.primary?.fieldCode ?? null,
        secondaries: contract.secondaries.map((s) => s.fieldCode),
        context: contract.contextFields.map((c) => c.fieldCode),
        decision: contract.decision,
      });
    }

    void isAuthoritativeUseAllowed(flags);

    let event: P2DeterministicAuthorityEvent;
    if (elig.authorityEligible && simulate) event = 'P2_DETERMINISTIC_AUTHORITY_SIMULATED';
    else if (elig.authorityEligible) event = 'P2_DETERMINISTIC_AUTHORITY_ELIGIBLE';
    else event = 'P2_DETERMINISTIC_FALLBACK_REQUIRED';

    return {
      evaluated: true,
      authorityEligible: elig.authorityEligible,
      simulated: simulate && elig.authorityEligible,
      reused,
      error: false,
      event,
      fallback: elig.authorityEligible ? 'NONE_SIMULATED' : 'FALLBACK_REQUIRED',
      fallbackReason: elig.blockedBy,
      replaceProduction: false,
      producedBy: elig.authorityEligible ? 'DETERMINISTIC_RESOLVER' : null,
      productionUnaffected: true,
      p3ContextRuntime: 'P3_CONTEXT_RUNTIME_DISABLED',
      contract,
      r1,
      p3,
      lineage,
      timings,
      flags,
      observability: {
        personId,
        snapshotId: args.snapshotId,
        authorityEligible: elig.authorityEligible,
        fallbackReason: elig.blockedBy,
        resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
        policyVersion: CANDIDATE_2_POLICY_VERSION,
        fingerprint: authorityFingerprint,
        durationMs: timings.totalMs,
      },
    };
  } catch (err) {
    isolateDeterministicAuthorityFailure(err);
    return fallbackResult({
      snapshotId: args.snapshotId,
      personId,
      flags,
      started,
      reasons: ['DETERMINISTIC_ERROR', err instanceof Error ? err.message : 'unknown'],
      event: 'P2_DETERMINISTIC_ERROR',
      error: true,
      simulated: simulate,
    });
  }
}

void AUTHORITY_ALLOWLIST;
void AUTHORITY_DOMAIN_GATE;
