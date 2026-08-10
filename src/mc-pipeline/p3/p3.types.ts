/**
 * P3 Specialty Discovery — tipos ARTIFACT_ONLY (FASE 8B).
 */
export const P3_CONTRACT_CODE = 'MC1.P3.SPECIALTY_DISCOVERY' as const;
export const P3_CONTRACT_VERSION = '1.0.0' as const;
export const P3_PROMPT_VERSION = 'MC1.P3.PROMPT.FUNCTIONAL.1.0.0' as const;
export const P3_REASONING_POLICY_VERSION = '8B.1' as const;
export const P3_GENERATION_POLICY_VERSION = '8B.1' as const;

export type P3OutcomeStatus =
  | 'SPECIALTIES_OBSERVED'
  | 'NO_SPECIALTY_EVIDENCE'
  | 'INSUFFICIENT_SIGNAL'
  | 'REVIEW_REQUIRED'
  | 'ABSTAINED_NO_FIELD';

export type P3SpecialtyStatus = 'OBSERVED' | 'WEAK' | 'REJECTED';

export type P3RationaleCode =
  | 'COHERENT_PRACTICE_CLUSTER'
  | 'MIXED_KIND_SUPPORT'
  | 'THIN_BUT_TRACABLE'
  | 'TOOL_ONLY_REJECTED'
  | 'OUT_OF_FIELD_REJECTED'
  | 'SINGLE_UNIT_INSUFFICIENT'
  | 'CATALOG_GAP_SIGNAL';

export type P3ObservedSpecialty = {
  specialtyCode: string;
  parentFieldCode: string;
  status: P3SpecialtyStatus;
  confidence: number;
  supportingEvidenceUnitIds: string[];
  rationaleCode: P3RationaleCode;
};

export type P3FieldResult = {
  fieldCode: string;
  observedSpecialties: P3ObservedSpecialty[];
  notes?: string;
};

export type P3ArtifactPayload = {
  executionId: string;
  snapshotId: string;
  configFingerprint: string;
  specialtyCatalogVersion: string;
  r1FieldResolutionStatus: 'RESOLVED' | 'MULTI_FIELD' | 'UNRESOLVED';
  fieldsEvaluated: string[];
  outcomeStatus: P3OutcomeStatus;
  fieldResults: P3FieldResult[];
  r1Unchanged: true;
  r1PackDir?: string;
  p1ArtifactDigest?: string;
  artifactProvenance: {
    stageCode: 'P3';
    contractCode: typeof P3_CONTRACT_CODE;
    contractVersion: typeof P3_CONTRACT_VERSION;
    inputSource: 'R1_CONTRACT_PLUS_P1_EVIDENCE_ARTIFACT_ONLY';
    generativeResultOrigin: 'LIVE' | 'NONE';
    mode: 'ARTIFACT_ONLY';
    promptVersion?: string;
    reasoningPolicyVersion?: string;
  };
};

export type P3ContractEnvelope = {
  contractCode: typeof P3_CONTRACT_CODE;
  contractVersion: typeof P3_CONTRACT_VERSION;
  stageCode: 'P3';
  registryFingerprint: string;
  campaignId: string;
  pipelineRunId: string;
  producedAt: string;
  abstained?: boolean;
  abstentionReason?: string;
  errors: Array<{ code: string; severity: string; messageSafe: string }>;
  warnings: Array<{ code: string; severity: string; messageSafe: string }>;
  payload: P3ArtifactPayload;
};

export type P3ModelRawOutput = {
  fieldResults?: Array<{
    fieldCode?: string;
    observedSpecialties?: Array<{
      specialtyCode?: string;
      parentFieldCode?: string;
      status?: string;
      confidence?: number;
      supportingEvidenceUnitIds?: string[];
      rationaleCode?: string;
    }>;
    notes?: string;
  }>;
  outcomeStatus?: string;
  warnings?: string[];
};
