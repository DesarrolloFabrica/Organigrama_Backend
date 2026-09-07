/**
 * Adapter R1 experimental sobre full contract.
 * CONTEXT viaja separado. No modifica r1-resolver productivo.
 */
import { adaptCandidateSetV2ToExperimentalR1 } from './experimental-r1-adapter-v2';
import type { CandidateSetV2Result } from './candidate-set-v2';
import type { R1ContractEnvelope } from '../r1/r1.types';
import type { FieldEvidenceStrength } from './candidate-set-policy-v2';

export type ExperimentalR1Full = {
  envelope: R1ContractEnvelope;
  primary: string | null;
  secondaries: string[];
  resolutionStatus: R1ContractEnvelope['payload']['fieldResolutionStatus'];
  ambiguity: { present: boolean; competitorCodes: string[] };
  contextFields: Array<{
    fieldCode: string;
    role: 'CONTEXT';
    strength: FieldEvidenceStrength;
  }>;
  contextInflatedR1: boolean;
};

export function adaptFullContractToExperimentalR1(
  set: CandidateSetV2Result,
): ExperimentalR1Full {
  const envelope = adaptCandidateSetV2ToExperimentalR1(set);
  const r1Seconds = (envelope.payload.secondaryFields ?? [])
    .map((s) => s.fieldCode)
    .filter((x): x is string => !!x);
  const contextFields = set.contextFields.map((c) => ({
    fieldCode: c.fieldCode,
    role: 'CONTEXT' as const,
    strength: c.strength,
  }));
  const contextInflatedR1 = contextFields.some((c) => r1Seconds.includes(c.fieldCode));
  return {
    envelope,
    primary: envelope.payload.primaryField?.fieldCode ?? null,
    secondaries: r1Seconds,
    resolutionStatus: envelope.payload.fieldResolutionStatus,
    ambiguity: {
      present: envelope.payload.fieldResolutionStatus === 'MULTI_FIELD' || set.decision === 'AMBIGUOUS',
      competitorCodes: set.competitors.map((c) => c.fieldCode).sort(),
    },
    contextFields,
    contextInflatedR1,
  };
}
