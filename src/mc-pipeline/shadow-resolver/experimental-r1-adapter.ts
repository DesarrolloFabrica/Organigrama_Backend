/**
 * Adapter R1 experimental. No modifica r1-resolver productivo.
 * No usa confidence Gemini. Roles determinísticos → envelope mínimo para P3 context.
 */
import { createHash } from 'node:crypto';
import type { R1ContractEnvelope, R1ResolvedField } from '../r1/r1.types';
import {
  R1_CONTRACT_CODE,
  R1_CONTRACT_VERSION,
  R1_RULE_VERSION,
} from '../r1/r1.types';
import type { CandidateSetResult } from './candidate-set';

const ADAPTER_VERSION = 'MC1.R1.EXPERIMENTAL.CANDIDATE_SET.1.0.0';

function fieldView(
  fieldCode: string,
  rank: number,
  routingToken: number,
): R1ResolvedField {
  return {
    fieldCode,
    sourceKey: fieldCode,
    catalogStatus: 'KNOWN',
    rank,
    confidence: routingToken,
    candidateId: `det-${fieldCode}`,
  };
}

/**
 * Routing tokens — NO son confidence Gemini.
 * PRIMARY=1.0 solo para cumplir el shape R1 (number).
 * SECONDARY=0.4 queda bajo el umbral productivo 0.75 para no parecer MULTI_FIELD
 * si alguien reutilizara el resolver productivo por error.
 */
export const EXPERIMENTAL_ROUTING_TOKENS = {
  primaryStrong: 1,
  secondaryStrong: 0.4,
  secondarySupported: 0.35,
  competitor: 0.5,
  note: 'NOT_GEMINI_CONFIDENCE',
} as const;

export function adaptCandidateSetToExperimentalR1(
  set: CandidateSetResult,
): R1ContractEnvelope {
  const primary = set.candidates.find((c) => c.role === 'PRIMARY_CANDIDATE');
  const secondaries = set.candidates.filter((c) => c.role === 'SECONDARY_CANDIDATE');
  const competitors = set.candidates.filter((c) => c.role === 'COMPETITOR');

  let fieldResolutionStatus: R1ContractEnvelope['payload']['fieldResolutionStatus'] =
    'UNRESOLVED';
  let primaryField: R1ResolvedField | null = null;
  let secondaryFields: R1ResolvedField[] = [];
  let reasonCode = 'INIT';

  if (set.decision === 'AMBIGUOUS' && competitors.length >= 2) {
    fieldResolutionStatus = 'MULTI_FIELD';
    reasonCode = 'DETERMINISTIC_COMPETITORS';
    const ordered = [...competitors].sort(
      (a, b) =>
        b.independentSourceCount - a.independentSourceCount ||
        a.fieldCode.localeCompare(b.fieldCode),
    );
    primaryField = fieldView(ordered[0].fieldCode, 1, EXPERIMENTAL_ROUTING_TOKENS.competitor);
    secondaryFields = ordered.slice(1).map((c, i) =>
      fieldView(c.fieldCode, i + 2, EXPERIMENTAL_ROUTING_TOKENS.competitor),
    );
  } else if (set.decision === 'RESOLVED' && primary) {
    fieldResolutionStatus = 'RESOLVED';
    reasonCode = 'DETERMINISTIC_PRIMARY';
    primaryField = fieldView(primary.fieldCode, 1, EXPERIMENTAL_ROUTING_TOKENS.primaryStrong);
    secondaryFields = secondaries.map((c, i) =>
      fieldView(
        c.fieldCode,
        i + 2,
        c.fieldStrength === 'STRONG'
          ? EXPERIMENTAL_ROUTING_TOKENS.secondaryStrong
          : EXPERIMENTAL_ROUTING_TOKENS.secondarySupported,
      ),
    );
  } else {
    fieldResolutionStatus = 'UNRESOLVED';
    reasonCode = set.decision === 'INSUFFICIENT_EVIDENCE' ? 'INSUFFICIENT_SIGNAL' : 'NO_CANDIDATES';
  }

  const payload = {
    fieldResolutionStatus,
    resolutionStatus:
      fieldResolutionStatus === 'RESOLVED'
        ? ('RESOLVED_PRIMARY' as const)
        : fieldResolutionStatus === 'MULTI_FIELD'
          ? ('MULTI_DOMAIN' as const)
          : ('INSUFFICIENT_EVIDENCE' as const),
    primaryField,
    secondaryFields,
    primaryDomainCode: primaryField?.fieldCode ?? null,
    secondaryDomainCodes: secondaryFields
      .map((s) => s.fieldCode)
      .filter((x): x is string => !!x),
    resolutionRuleVersion: ADAPTER_VERSION,
    configHash: createHash('sha256').update(ADAPTER_VERSION, 'utf8').digest('hex'),
    decisionExplanation: `adapter=${ADAPTER_VERSION}; reason=${reasonCode}; p2=${set.decision}`,
    decisionCodes: [reasonCode],
    p2ExecutionId: `det-cset-${set.snapshotId}`,
    p2OutcomeStatus: set.decision === 'RESOLVED' ? 'CANDIDATES_PRODUCED' : set.decision,
    snapshotId: set.snapshotId,
    provenance: {
      stageCode: 'R1' as const,
      mode: 'ARTIFACT_ONLY' as const,
      inputSource: 'P2_CONTRACT' as const,
      p2ArtifactDigest: null,
      generativeResultOrigin: 'RULES_ONLY' as const,
    },
  };

  return {
    contractCode: R1_CONTRACT_CODE,
    contractVersion: R1_CONTRACT_VERSION,
    stageCode: 'R1',
    registryFingerprint: createHash('sha256').update(ADAPTER_VERSION, 'utf8').digest('hex'),
    campaignId: 'MC1-R1-EXPERIMENTAL-CSET',
    pipelineRunId: `r1-cset-${set.snapshotId}`,
    producedAt: '1970-01-01T00:00:00.000Z',
    abstained: fieldResolutionStatus === 'UNRESOLVED' || undefined,
    abstentionReason: fieldResolutionStatus === 'UNRESOLVED' ? reasonCode : undefined,
    errors: [],
    warnings: [
      {
        code: 'EXPERIMENTAL_R1_ADAPTER',
        severity: 'INFO',
        messageSafe: 'Not production R1. Routing tokens are not Gemini confidence.',
      },
    ],
    payload,
  };
}

void R1_RULE_VERSION;
