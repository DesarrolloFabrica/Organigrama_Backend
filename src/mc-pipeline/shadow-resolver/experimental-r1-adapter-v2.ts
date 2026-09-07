/**
 * Adapter R1 experimental v2. PRIMARY + SECONDARIES solamente.
 * CONTEXT no entra a R1. No modifica r1-resolver productivo.
 */
import { createHash } from 'node:crypto';
import type { R1ContractEnvelope, R1ResolvedField } from '../r1/r1.types';
import { R1_CONTRACT_CODE, R1_CONTRACT_VERSION, R1_RULE_VERSION } from '../r1/r1.types';
import type { CandidateSetV2Result } from './candidate-set-v2';

const ADAPTER_VERSION = 'MC1.R1.EXPERIMENTAL.CANDIDATE_SET.2.0.0';

export const EXPERIMENTAL_ROUTING_TOKENS_V2 = {
  primaryStrong: 1,
  secondaryStrong: 0.4,
  secondarySupported: 0.35,
  competitor: 0.5,
  note: 'NOT_GEMINI_CONFIDENCE; CONTEXT_NOT_IN_R1',
} as const;

function fieldView(fieldCode: string, rank: number, routingToken: number): R1ResolvedField {
  return {
    fieldCode,
    sourceKey: fieldCode,
    catalogStatus: 'KNOWN',
    rank,
    confidence: routingToken,
    candidateId: `det-v2-${fieldCode}`,
  };
}

export function adaptCandidateSetV2ToExperimentalR1(
  set: CandidateSetV2Result,
): R1ContractEnvelope {
  let fieldResolutionStatus: R1ContractEnvelope['payload']['fieldResolutionStatus'] =
    'UNRESOLVED';
  let primaryField: R1ResolvedField | null = null;
  let secondaryFields: R1ResolvedField[] = [];
  let reasonCode = 'INIT';

  if (set.decision === 'AMBIGUOUS' && set.competitors.length >= 2) {
    fieldResolutionStatus = 'MULTI_FIELD';
    reasonCode = 'DETERMINISTIC_COMPETITORS';
    const ordered = [...set.competitors].sort(
      (a, b) =>
        b.independentSourceCount - a.independentSourceCount ||
        a.fieldCode.localeCompare(b.fieldCode),
    );
    primaryField = fieldView(ordered[0].fieldCode, 1, EXPERIMENTAL_ROUTING_TOKENS_V2.competitor);
    secondaryFields = ordered.slice(1).map((c, i) =>
      fieldView(c.fieldCode, i + 2, EXPERIMENTAL_ROUTING_TOKENS_V2.competitor),
    );
  } else if (set.decision === 'RESOLVED' && set.primary) {
    fieldResolutionStatus = 'RESOLVED';
    reasonCode = 'DETERMINISTIC_PRIMARY';
    primaryField = fieldView(
      set.primary.fieldCode,
      1,
      EXPERIMENTAL_ROUTING_TOKENS_V2.primaryStrong,
    );
    secondaryFields = set.secondaries.map((c, i) =>
      fieldView(
        c.fieldCode,
        i + 2,
        c.strength === 'STRONG'
          ? EXPERIMENTAL_ROUTING_TOKENS_V2.secondaryStrong
          : EXPERIMENTAL_ROUTING_TOKENS_V2.secondarySupported,
      ),
    );
  } else {
    fieldResolutionStatus = 'UNRESOLVED';
    reasonCode =
      set.decision === 'INSUFFICIENT_EVIDENCE' ? 'INSUFFICIENT_SIGNAL' : 'NO_CANDIDATES';
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
    decisionExplanation: `adapter=${ADAPTER_VERSION}; reason=${reasonCode}; p2=${set.decision}; contextOmitted=${set.contextFields.length}`,
    decisionCodes: [reasonCode, 'CONTEXT_NOT_IN_R1'],
    p2ExecutionId: `det-cset-v2-${set.snapshotId}`,
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
    campaignId: 'MC1-R1-EXPERIMENTAL-CSET-V2',
    pipelineRunId: `r1-cset-v2-${set.snapshotId}`,
    producedAt: '1970-01-01T00:00:00.000Z',
    abstained: fieldResolutionStatus === 'UNRESOLVED' || undefined,
    abstentionReason: fieldResolutionStatus === 'UNRESOLVED' ? reasonCode : undefined,
    errors: [],
    warnings: [
      {
        code: 'EXPERIMENTAL_R1_ADAPTER_V2',
        severity: 'INFO',
        messageSafe: 'CONTEXT fields are omitted from R1. Routing tokens are not Gemini confidence.',
      },
    ],
    payload,
  };
}

void R1_RULE_VERSION;
