/**
 * Full deterministic P2 contract experimental.
 * Compatible con readers P2 2.0.0: domainCandidates = PRIMARY + SECONDARIES only.
 * CONTEXT y COMPETITOR viven en extensiones. No es confidence Gemini.
 * No modifica p2.types productivo.
 */
import { createHash } from 'node:crypto';
import { PROFESSIONAL_FIELD_CATALOG_VERSION } from '../catalog/professional-fields';
import { canonicalEvidenceIdentity } from '../experimental/deterministic-resolver/shadow/fingerprint';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import { RESOLVER_CANDIDATE_2_VERSION } from '../experimental/deterministic-resolver/types';
import type { ResolverEvidenceUnit } from '../experimental/deterministic-resolver/types';
import {
  P2_CATALOG_POLICY_VERSION,
  P2_CONTRACT_CODE,
  P2_CONTRACT_VERSION,
  type P2CandidateStatus,
  type P2CatalogStatus,
  type P2ContractEnvelope,
  type P2DomainCandidate,
  type P2OutcomeStatus,
  type P2ReviewState,
} from '../p2/p2.types';
import {
  CANDIDATE_SET_POLICY_V2,
  type CandidateSetV2Role,
  type FieldEvidenceStrength,
} from './candidate-set-policy-v2';
import type { CandidateSetV2Member, CandidateSetV2Result } from './candidate-set-v2';
import { uniqueIds, type EvidenceIdMapRow } from './full-contract-evidence';

export const FULL_CONTRACT_CODE = 'MC1.P2.DETERMINISTIC_FULL_CONTRACT' as const;
export const FULL_CONTRACT_VERSION = '1.0.0' as const;
export const FULL_CONTRACT_ADAPTER_VERSION =
  'MC1.P2.DETERMINISTIC.FULL_CONTRACT.1.0.0' as const;

export type DeterministicFieldView = {
  fieldCode: string;
  role: CandidateSetV2Role;
  resolverStrength: FieldEvidenceStrength;
  candidateStatus: P2CandidateStatus;
  catalogStatus: P2CatalogStatus;
  supportingEvidenceIds: string[];
  independentSourceCount: number;
  reasonCodes: string[];
  differentialSignals: string[];
  sharedSignals: string[];
};

export type DeterministicCompetitorView = {
  competitorCode: string;
  support: number;
  reason: string;
  resolverStrength: FieldEvidenceStrength;
  supportingEvidenceIds: string[];
};

export type DeterministicFullContract = {
  contractCode: typeof FULL_CONTRACT_CODE;
  contractVersion: typeof FULL_CONTRACT_VERSION;
  adapterVersion: typeof FULL_CONTRACT_ADAPTER_VERSION;
  compatibleWith: { contractCode: typeof P2_CONTRACT_CODE; contractVersion: typeof P2_CONTRACT_VERSION };
  snapshotId: string;
  decision: CandidateSetV2Result['decision'];
  outcomeStatus: P2OutcomeStatus;
  reviewState: P2ReviewState;
  primary: DeterministicFieldView | null;
  secondaries: DeterministicFieldView[];
  contextFields: DeterministicFieldView[];
  competitors: DeterministicCompetitorView[];
  producedBy: 'DETERMINISTIC_RESOLVER';
  fingerprint: string;
  lineage: {
    evidenceIdScheme: 'RESOLVER_CANDIDATE_ID';
    mappedToCanonicalCeu: true;
    rows: EvidenceIdMapRow[];
  };
  p2CompatibleView: P2ContractEnvelope;
  warnings: string[];
  valid: boolean;
  invalidReasons: string[];
};

function toField(m: CandidateSetV2Member): DeterministicFieldView {
  return {
    fieldCode: m.fieldCode,
    role: m.role,
    resolverStrength: m.strength,
    candidateStatus: 'ACTIVE',
    catalogStatus: 'KNOWN',
    supportingEvidenceIds: uniqueIds(m.originEvidenceIds.length ? m.originEvidenceIds : m.supportingEvidenceIds),
    independentSourceCount: m.independentSourceCount,
    reasonCodes: m.reasonCodes,
    differentialSignals: m.differentialSignals,
    sharedSignals: m.sharedSignals,
  };
}

function routingToken(role: CandidateSetV2Role, strength: FieldEvidenceStrength): number {
  if (role === 'PRIMARY') return 1;
  if (role === 'SECONDARY') return strength === 'STRONG' ? 0.4 : 0.35;
  return 0;
}

function toCompatibleCandidate(m: DeterministicFieldView, rank: number): P2DomainCandidate {
  return {
    candidateId: `det-${m.role.toLowerCase()}-${m.fieldCode}`,
    domainCode: m.fieldCode,
    proposedDomainKey: null,
    catalogStatus: 'KNOWN',
    candidateStatus: 'ACTIVE',
    confidence: routingToken(m.role, m.resolverStrength),
    rank,
    supportingEvidenceUnitIds: m.supportingEvidenceIds,
    contradictingEvidenceUnitIds: [],
    rationaleCode: 'SUPPORT_ACTION_CLUSTER',
    coverageRatio: 0,
    ambiguityFlags: [],
    producedBy: 'RULE_HINT',
  };
}

export function fullContractFingerprint(args: {
  units: ResolverEvidenceUnit[];
  fieldCatalogVersion: string;
  resolverVersion: string;
  candidateSetPolicyVersion: string;
  contractAdapterVersion: string;
}): string {
  return createHash('sha256')
    .update(
      stableStringify({
        p1Identity: canonicalEvidenceIdentity(args.units),
        fieldCatalogVersion: args.fieldCatalogVersion,
        resolverVersion: args.resolverVersion,
        candidateSetPolicyVersion: args.candidateSetPolicyVersion,
        contractAdapterVersion: args.contractAdapterVersion,
      }),
      'utf8',
    )
    .digest('hex');
}

export function buildDeterministicFullContract(args: {
  set: CandidateSetV2Result;
  units: ResolverEvidenceUnit[];
  evidenceMap: EvidenceIdMapRow[];
  historical?: P2ContractEnvelope | null;
}): DeterministicFullContract {
  const warnings: string[] = [
    'EXPERIMENTAL_FULL_CONTRACT',
    'CONFIDENCE_ON_COMPATIBLE_VIEW_IS_ROUTING_TOKEN_NOT_GEMINI',
    'CONTEXT_NOT_IN_DOMAIN_CANDIDATES',
    'SUPPORTS_ARE_RESOLVER_CANDIDATE_IDS',
  ];
  const invalidReasons: string[] = [];
  const primary = args.set.primary ? toField(args.set.primary) : null;
  const secondaries = args.set.secondaries.map(toField);
  const contextFields = args.set.contextFields.map((m) => ({
    ...toField(m),
    candidateStatus: 'WEAK' as const,
  }));
  const competitors = args.set.competitors.map((m) => ({
    competitorCode: m.fieldCode,
    support: m.independentSourceCount,
    reason: m.reasonCodes[0] ?? 'AMBIGUOUS_COMPETITOR',
    resolverStrength: m.strength,
    supportingEvidenceIds: uniqueIds(m.originEvidenceIds),
  }));

  if (contextFields.some((c) => secondaries.some((s) => s.fieldCode === c.fieldCode))) {
    invalidReasons.push('CONTEXT_PROMOTED_TO_SECONDARY');
  }
  const allSupports = [
    ...(primary?.supportingEvidenceIds ?? []),
    ...secondaries.flatMap((s) => s.supportingEvidenceIds),
    ...contextFields.flatMap((c) => c.supportingEvidenceIds),
  ];
  if (allSupports.length !== uniqueIds(allSupports).length) {
    warnings.push('DUPLICATE_SUPPORT_IDS_DEDUPLICATED');
  }
  const known = new Set(args.evidenceMap.map((r) => r.resolverEvidenceId));
  if (allSupports.some((id) => !known.has(id))) invalidReasons.push('LINEAGE_UNMAPPED');

  let outcomeStatus: P2OutcomeStatus = 'INSUFFICIENT_SIGNAL';
  let reviewState: P2ReviewState = 'SUGGESTED';
  if (args.set.decision === 'RESOLVED' && primary) {
    outcomeStatus = 'CANDIDATES_PRODUCED';
    reviewState = 'NOT_REQUIRED';
  } else if (args.set.decision === 'AMBIGUOUS') {
    outcomeStatus = 'CANDIDATES_PRODUCED';
    reviewState = 'REQUIRED';
    warnings.push('AMBIGUOUS_NOT_AUTHORITATIVE');
  } else {
    outcomeStatus = 'INSUFFICIENT_SIGNAL';
    reviewState = 'REQUIRED';
  }

  const fingerprint = fullContractFingerprint({
    units: args.units,
    fieldCatalogVersion: PROFESSIONAL_FIELD_CATALOG_VERSION,
    resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
    candidateSetPolicyVersion: CANDIDATE_SET_POLICY_V2.policyVersion,
    contractAdapterVersion: FULL_CONTRACT_ADAPTER_VERSION,
  });

  const domainCandidates: P2DomainCandidate[] = [];
  if (primary) domainCandidates.push(toCompatibleCandidate(primary, 1));
  secondaries.forEach((s, i) => domainCandidates.push(toCompatibleCandidate(s, i + 2)));

  const hist = args.historical?.payload;
  const p2CompatibleView: P2ContractEnvelope = {
    contractCode: P2_CONTRACT_CODE,
    contractVersion: P2_CONTRACT_VERSION,
    stageCode: 'P2',
    registryFingerprint: fingerprint,
    campaignId: args.historical?.campaignId ?? 'MC1-P2-DET-FULL',
    pipelineRunId: `det-full-${args.set.snapshotId}`,
    producedAt: '1970-01-01T00:00:00.000Z',
    abstained: args.set.decision !== 'RESOLVED' || undefined,
    abstentionReason: args.set.decision !== 'RESOLVED' ? args.set.decision : undefined,
    errors: [],
    warnings: warnings.map((code) => ({
      code,
      severity: 'INFO' as const,
      messageSafe: code,
    })),
    payload: {
      executionId: `det-full-${fingerprint.slice(0, 16)}`,
      configFingerprint: fingerprint,
      p1RunId: hist?.p1RunId ?? `pack:${args.set.snapshotId}`,
      snapshotId: args.set.snapshotId,
      p1ArtifactDigest: hist?.p1ArtifactDigest ?? fingerprint,
      p1ConfigFingerprint: hist?.p1ConfigFingerprint,
      catalogPolicyVersion: P2_CATALOG_POLICY_VERSION,
      outcomeStatus,
      domainCandidates,
      evidenceDispositions: uniqueIds(allSupports).map((id) => ({
        evidenceUnitId: id,
        decision: 'SUPPORTS' as const,
        candidateRefs: domainCandidates
          .filter((c) => c.supportingEvidenceUnitIds.includes(id))
          .map((c) => c.candidateId),
        policyCode: FULL_CONTRACT_ADAPTER_VERSION,
      })),
      reviewState,
      maxCandidates: Math.max(1, domainCandidates.length),
      artifactProvenance: {
        stageCode: 'P2',
        contractCode: P2_CONTRACT_CODE,
        contractVersion: P2_CONTRACT_VERSION,
        inputSource: hist?.artifactProvenance.inputSource ?? 'P1_PACK_ARTIFACT_ONLY_LAB',
        generativeResultOrigin: 'REGENERATED',
        reasoningPolicyVersion: FULL_CONTRACT_ADAPTER_VERSION,
        generationPolicyVersion: FULL_CONTRACT_ADAPTER_VERSION,
        promptVersion: 'NONE_DETERMINISTIC',
        professionalFieldCatalogVersion: PROFESSIONAL_FIELD_CATALOG_VERSION,
      },
    },
  };

  return {
    contractCode: FULL_CONTRACT_CODE,
    contractVersion: FULL_CONTRACT_VERSION,
    adapterVersion: FULL_CONTRACT_ADAPTER_VERSION,
    compatibleWith: { contractCode: P2_CONTRACT_CODE, contractVersion: P2_CONTRACT_VERSION },
    snapshotId: args.set.snapshotId,
    decision: args.set.decision,
    outcomeStatus,
    reviewState,
    primary,
    secondaries,
    contextFields,
    competitors,
    producedBy: 'DETERMINISTIC_RESOLVER',
    fingerprint,
    lineage: {
      evidenceIdScheme: 'RESOLVER_CANDIDATE_ID',
      mappedToCanonicalCeu: true,
      rows: args.evidenceMap,
    },
    p2CompatibleView,
    warnings,
    valid: invalidReasons.length === 0,
    invalidReasons,
  };
}
