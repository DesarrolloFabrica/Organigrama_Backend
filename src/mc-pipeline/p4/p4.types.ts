/**
 * P4 Skill Discovery — tipos ARTIFACT_ONLY (FASE 8D → 12I WEAK routing).
 */
export const P4_CONTRACT_CODE = 'MC1.P4.SKILL_DISCOVERY' as const;
export const P4_CONTRACT_VERSION = '1.1.0' as const;
export const P4_PROMPT_VERSION = 'MC1.P4.PROMPT.FUNCTIONAL.1.1.0' as const;
export const P4_REASONING_POLICY_VERSION = '8D.1' as const;
export const P4_GENERATION_POLICY_VERSION = '8D.1' as const;
/** FASE 12H/12I — política de routing WEAK sin promover publishability. */
export const P4_ROUTING_POLICY_VERSION = '12H.1' as const;

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

/** AUTHORITATIVE = P3 OBSERVED; ROUTING_CANDIDATE = P3 WEAK (placement only). */
export type P4EvaluationRole =
  | 'AUTHORITATIVE_TARGET'
  | 'ROUTING_CANDIDATE';

export type P4SpecialtyEvaluated = {
  fieldCode: string;
  specialtyCode: string;
  p3Status: string;
  p3Confidence?: number;
  evaluationRole: P4EvaluationRole;
  routingEligible: boolean;
  /** Mirror of P3 OBSERVED publishability — P4 must not treat as publication grant. */
  publishableFromP3: boolean;
};

/** Hint only — never mutates P3 or authorizes publication (12I). */
export type P4SpecialtyCorroborationHint = {
  fieldCode: string;
  specialtyCode: string;
  p3Status: 'WEAK';
  skillCode: string;
  supportingEvidenceUnitIds: string[];
  hintCode: 'SKILL_EVIDENCE_CORROBORATES_WEAK_SPECIALTY';
  doesNotMutateP3: true;
};

export type P4ArtifactPayload = {
  executionId: string;
  snapshotId: string;
  configFingerprint: string;
  specialtyCatalogVersion: string;
  routingPolicyVersion?: typeof P4_ROUTING_POLICY_VERSION;
  r1FieldResolutionStatus: 'RESOLVED' | 'MULTI_FIELD' | 'UNRESOLVED';
  specialtiesEvaluated: P4SpecialtyEvaluated[];
  outcomeStatus: P4OutcomeStatus;
  specialtyResults: P4SpecialtyResult[];
  specialtyCorroborationHints?: P4SpecialtyCorroborationHint[];
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
  specialtyCorroborationHints?: Array<{
    fieldCode?: string;
    specialtyCode?: string;
    skillCode?: string;
    supportingEvidenceUnitIds?: string[];
  }>;
  outcomeStatus?: string;
  warnings?: string[];
};

export function hasAuthoritativeP4Target(
  specialties: P4SpecialtyEvaluated[],
): boolean {
  return specialties.some(
    (s) =>
      s.evaluationRole === 'AUTHORITATIVE_TARGET' ||
      (s.p3Status === 'OBSERVED' && s.publishableFromP3 !== false),
  );
}
