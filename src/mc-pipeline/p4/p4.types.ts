/**
 * P4 Skill Discovery — tipos ARTIFACT_ONLY (FASE 8D).
 */
export const P4_CONTRACT_CODE = 'MC1.P4.SKILL_DISCOVERY' as const;
export const P4_CONTRACT_VERSION = '1.0.0' as const;
export const P4_PROMPT_VERSION = 'MC1.P4.PROMPT.FUNCTIONAL.1.0.0' as const;
export const P4_REASONING_POLICY_VERSION = '8D.1' as const;
export const P4_GENERATION_POLICY_VERSION = '8D.1' as const;

export type P4OutcomeStatus =
  | 'SKILLS_OBSERVED'
  | 'NO_SKILL_EVIDENCE'
  | 'INSUFFICIENT_SIGNAL'
  | 'REVIEW_REQUIRED'
  | 'ABSTAINED_NO_OBSERVED_SPECIALTY';

export type P4SkillStatus = 'OBSERVED' | 'WEAK';

export type P4RationaleCode =
  | 'RECURRENT_PRACTICE'
  | 'EQUIVALENT_EXPRESSION_CLUSTER'
  | 'TRACEABLE_CAPACITY'
  | 'THIN_BUT_TRACABLE'
  | 'TOOL_ONLY_REJECTED'
  | 'GENERIC_REJECTED'
  | 'SINGLE_UNIT_INSUFFICIENT'
  | 'OUT_OF_SPECIALTY_REJECTED';

export type P4ObservedSkill = {
  skillCode: string;
  name: string;
  parentFieldCode: string;
  parentSpecialtyCode: string;
  status: P4SkillStatus;
  confidence: number;
  supportingEvidenceUnitIds: string[];
  supportingSignals: string[];
  toolOrTechnologySignals: string[];
  rationaleCode: P4RationaleCode;
};

export type P4SpecialtyResult = {
  fieldCode: string;
  specialtyCode: string;
  observedSkills: P4ObservedSkill[];
  notes?: string;
};

export type P4SpecialtyEvaluated = {
  fieldCode: string;
  specialtyCode: string;
  p3Status: string;
  p3Confidence?: number;
};

export type P4ArtifactPayload = {
  executionId: string;
  snapshotId: string;
  configFingerprint: string;
  specialtyCatalogVersion: string;
  r1FieldResolutionStatus: 'RESOLVED' | 'MULTI_FIELD' | 'UNRESOLVED';
  specialtiesEvaluated: P4SpecialtyEvaluated[];
  outcomeStatus: P4OutcomeStatus;
  specialtyResults: P4SpecialtyResult[];
  r1Unchanged: true;
  p3Unchanged: true;
  r1PackDir?: string;
  p3PackDir?: string;
  p1ArtifactDigest?: string;
  artifactProvenance: {
    stageCode: 'P4';
    contractCode: typeof P4_CONTRACT_CODE;
    contractVersion: typeof P4_CONTRACT_VERSION;
    inputSource: 'R1_P3_PLUS_P1_EVIDENCE_ARTIFACT_ONLY';
    generativeResultOrigin: 'LIVE' | 'NONE';
    mode: 'ARTIFACT_ONLY';
    promptVersion?: string;
    reasoningPolicyVersion?: string;
  };
};

export type P4ContractEnvelope = {
  contractCode: typeof P4_CONTRACT_CODE;
  contractVersion: typeof P4_CONTRACT_VERSION;
  stageCode: 'P4';
  registryFingerprint: string;
  campaignId: string;
  pipelineRunId: string;
  producedAt: string;
  abstained?: boolean;
  abstentionReason?: string;
  errors: Array<{ code: string; severity: string; messageSafe: string }>;
  warnings: Array<{ code: string; severity: string; messageSafe: string }>;
  payload: P4ArtifactPayload;
};

export type P4ModelRawOutput = {
  specialtyResults?: Array<{
    fieldCode?: string;
    specialtyCode?: string;
    observedSkills?: Array<{
      skillCode?: string;
      name?: string;
      parentFieldCode?: string;
      parentSpecialtyCode?: string;
      status?: string;
      confidence?: number;
      supportingEvidenceUnitIds?: string[];
      supportingSignals?: string[];
      toolOrTechnologySignals?: string[];
      rationaleCode?: string;
    }>;
    notes?: string;
  }>;
  outcomeStatus?: string;
  warnings?: string[];
};
