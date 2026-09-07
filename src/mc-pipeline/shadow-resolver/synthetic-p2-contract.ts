/**
 * Contrato P2 sintético para skip determinístico futuro.
 * No se escribe a packs productivos. No llama Gemini.
 *
 * confidence NO es equivalencia Gemini: es un adapter de routing R1
 * (DETERMINISTIC_AUTHORITY_ROUTING_SCORE) porque R1 exige number >= 0.7.
 */
import type {
  P2ArtifactPayload,
  P2ContractEnvelope,
  P2DomainCandidate,
  P2RationaleCode,
} from '../p2/p2.types';
import {
  P2_CATALOG_POLICY_VERSION,
  P2_CONTRACT_CODE,
  P2_CONTRACT_VERSION,
} from '../p2/p2.types';
import type { FieldResolverResult } from '../experimental/deterministic-resolver/types';
import type { SkipEval } from './skip-eligibility';
import { SKIP_CANDIDATE_2_CODE } from './skip-eligibility';
import { SIMULATION_CREATED_AT } from '../experimental/deterministic-resolver/shadow/shadow-types';

export const DETERMINISTIC_P2_RATIONALE_MAP_VERSION =
  'MC1.P2.DETERMINISTIC.RATIONALE.1.0.0' as const;
export const DETERMINISTIC_AUTHORITY_ROUTING_SCORE = 1;
export const DETERMINISTIC_P2_SOURCE = 'DETERMINISTIC' as const;

export function mapDeterministicRationale(reasonCodes: string[]): P2RationaleCode {
  if (reasonCodes.includes('MULTI_ACTION_CLUSTER') || reasonCodes.includes('CLEAR_FIELD_MARGIN')) {
    return 'SUPPORT_ACTION_CLUSTER';
  }
  return 'SUPPORT_MIXED_KINDS';
}

export function buildSyntheticDeterministicP2(args: {
  historical: P2ContractEnvelope;
  p2: FieldResolverResult;
  skip: SkipEval;
  fingerprint: string;
}): {
  envelope: P2ContractEnvelope;
  valid: boolean;
  invalidReasons: string[];
} {
  const invalidReasons: string[] = [];
  const field = args.p2.resolvedFieldCode;
  if (args.p2.decision !== 'RESOLVED' || !field) {
    invalidReasons.push('NOT_RESOLVED');
  }
  if (args.skip.eligibility !== 'SKIP_ELIGIBLE') {
    invalidReasons.push('NOT_SKIP_ELIGIBLE');
  }
  const top = args.p2.candidateFields.find((c) => c.fieldCode === field);
  const supports = top?.originEvidenceIds ?? [];
  if (supports.length === 0) invalidReasons.push('NO_SUPPORTS');
  if (!args.skip.fingerprint || args.skip.fingerprint.length !== 64) {
    invalidReasons.push('INVALID_FINGERPRINT');
  }

  const candidate: P2DomainCandidate = {
    candidateId: 'det-rank1',
    domainCode: field,
    proposedDomainKey: null,
    catalogStatus: 'KNOWN',
    candidateStatus: 'ACTIVE',
    confidence: DETERMINISTIC_AUTHORITY_ROUTING_SCORE,
    rank: 1,
    supportingEvidenceUnitIds: supports,
    contradictingEvidenceUnitIds: [],
    rationaleCode: mapDeterministicRationale(args.p2.reasonCodes),
    coverageRatio: 0,
    ambiguityFlags: [],
    producedBy: 'RULE_HINT',
  };

  const hist = args.historical.payload;
  const payload: P2ArtifactPayload = {
    executionId: `det-${args.fingerprint.slice(0, 16)}`,
    configFingerprint: args.fingerprint,
    p1RunId: hist.p1RunId,
    snapshotId: hist.snapshotId,
    p1ArtifactDigest: hist.p1ArtifactDigest,
    p1ConfigFingerprint: hist.p1ConfigFingerprint,
    catalogPolicyVersion: P2_CATALOG_POLICY_VERSION,
    outcomeStatus: 'CANDIDATES_PRODUCED',
    domainCandidates: [candidate],
    evidenceDispositions: supports.map((id) => ({
      evidenceUnitId: id,
      decision: 'SUPPORTS' as const,
      candidateRefs: ['det-rank1'],
      policyCode: SKIP_CANDIDATE_2_CODE,
    })),
    reviewState: 'NOT_REQUIRED',
    maxCandidates: 1,
    artifactProvenance: {
      stageCode: 'P2',
      contractCode: P2_CONTRACT_CODE,
      contractVersion: P2_CONTRACT_VERSION,
      inputSource: hist.artifactProvenance.inputSource,
      generativeResultOrigin: 'REGENERATED',
      reasoningPolicyVersion: DETERMINISTIC_P2_RATIONALE_MAP_VERSION,
      generationPolicyVersion: SKIP_CANDIDATE_2_CODE,
      promptVersion: 'NONE_DETERMINISTIC',
      professionalFieldCatalogVersion:
        hist.artifactProvenance.professionalFieldCatalogVersion,
    },
  };

  const envelope: P2ContractEnvelope = {
    contractCode: P2_CONTRACT_CODE,
    contractVersion: P2_CONTRACT_VERSION,
    stageCode: 'P2',
    registryFingerprint: args.historical.registryFingerprint,
    campaignId: args.historical.campaignId,
    pipelineRunId: `det-c2-${hist.snapshotId}`,
    producedAt: SIMULATION_CREATED_AT,
    errors: [],
    warnings: [
      {
        code: 'P2_SOURCE_DETERMINISTIC',
        severity: 'INFO',
        messageSafe: 'Synthetic Candidate.2 skip contract. Not a production artifact.',
      },
      {
        code: 'CONFIDENCE_IS_ROUTING_ADAPTER',
        severity: 'WARNING',
        messageSafe: 'confidence=1 is DETERMINISTIC_AUTHORITY_ROUTING_SCORE, not Gemini confidence',
      },
      {
        code: 'COVERAGE_RATIO_NON_EQUIVALENT',
        severity: 'INFO',
        messageSafe: 'coverageRatio left at 0; NON_EQUIVALENT_METADATA',
      },
      {
        code: 'SINGLE_CANDIDATE_SET',
        severity: 'WARNING',
        messageSafe: 'Secondary Gemini candidates are not generated',
      },
      {
        code: 'SUPPORTS_USE_RESOLVER_EVIDENCE_IDS',
        severity: 'WARNING',
        messageSafe: 'supportingEvidenceUnitIds are P1 candidateIds, not ceu_ canonical ids',
      },
    ],
    payload,
  };

  return { envelope, valid: invalidReasons.length === 0, invalidReasons };
}
