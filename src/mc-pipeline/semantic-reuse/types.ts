/**
 * Contratos experimentales del semantic reuse gate.
 * No importar desde runners productivos P1–P4.
 */
export type P3FieldContract = 'PRODUCTION' | 'ROLE_AWARE';

export type SemanticCompareResult =
  | 'IDENTICAL'
  | 'METADATA_ONLY_CHANGE'
  | 'SEMANTIC_CHANGE'
  | 'UNPROVEN';

export type ReuseDecision =
  | 'SAFE_REUSE'
  | 'SAFE_REUSE_WITH_METADATA_CHANGE'
  | 'RECOMPUTE_REQUIRED'
  | 'REUSE_UNPROVEN';

export type P3FieldContext = {
  fieldCode: string;
  fieldRole?: string;
};

export type P3SemanticInput = {
  contract: P3FieldContract;
  evidenceIdentity: string;
  fieldContext: P3FieldContext[];
  r1FieldResolutionStatus: string;
  specialtyCatalogFingerprint: string;
  promptVersion: string;
  modelVersion: string;
  reasoningPolicyVersion: string;
  generationPolicyVersion: string;
  modelConfigFingerprint: string;
};

export type P4SpecialtySemantic = {
  specialtyCode: string;
  fieldCode: string;
  status: string;
  evaluationRole: string;
  publishableFromP3: boolean;
  routingEligible: boolean;
  p3Confidence?: number;
};

export type P4SemanticInput = {
  evidenceIdentity: string;
  specialties: P4SpecialtySemantic[];
  r1FieldResolutionStatus: string;
  specialtyCatalogFingerprint: string;
  promptVersion: string;
  routingPolicyVersion: string;
  reasoningPolicyVersion: string;
  generationPolicyVersion: string;
  modelVersion: string;
  modelConfigFingerprint: string;
};

export type SemanticLineage = {
  originalRunId: string | null;
  newRunId: string | null;
  originalProducer: string | null;
  newUpstreamProducer: string | null;
  oldResultIdentity: string | null;
  newResultIdentity: string | null;
};

export type SemanticReuseRecord = {
  reuseDecision: ReuseDecision;
  compare: SemanticCompareResult;
  semanticFingerprint: string;
  oldSemanticFingerprint: string;
  lineage: SemanticLineage;
  usageRelation: 'REUSED_UNDER_SEMANTIC_EQUIVALENCE' | null;
};

export function mapCompareToReuse(compare: SemanticCompareResult): ReuseDecision {
  if (compare === 'IDENTICAL') return 'SAFE_REUSE';
  if (compare === 'METADATA_ONLY_CHANGE') return 'SAFE_REUSE_WITH_METADATA_CHANGE';
  if (compare === 'SEMANTIC_CHANGE') return 'RECOMPUTE_REQUIRED';
  return 'REUSE_UNPROVEN';
}

export function metadataOnlyChanged(lineage: SemanticLineage): boolean {
  return (
    (lineage.originalProducer ?? '') !== (lineage.newUpstreamProducer ?? '') ||
    (lineage.oldResultIdentity ?? '') !== (lineage.newResultIdentity ?? '') ||
    (lineage.originalRunId ?? '') !== (lineage.newRunId ?? '')
  );
}
