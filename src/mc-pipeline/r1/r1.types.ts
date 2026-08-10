/**
 * R1 Field Resolution — tipos ARTIFACT_ONLY (FASE 8A).
 * Consume solo contrato P2; sin IA, sin CV, sin Evidence Units.
 */
export const R1_CONTRACT_CODE = 'MC1.R1.DOMAIN_RESOLUTION' as const;
export const R1_CONTRACT_VERSION = '1.0.0' as const;
export const R1_RULE_VERSION = 'MC1.R1.RULES.FIELD.1.0.0' as const;

/** Vocabulario de salida pedido en 8A. */
export type R1FieldResolutionStatus =
  | 'RESOLVED'
  | 'MULTI_FIELD'
  | 'UNRESOLVED';

/** Alineado al schema histórico R1 (mapeo). */
export type R1LegacyResolutionStatus =
  | 'RESOLVED_PRIMARY'
  | 'MULTI_DOMAIN'
  | 'AMBIGUOUS'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NO_DOMAIN_MATCH'
  | 'REVIEW_REQUIRED';

export type R1ResolvedField = {
  /** Código de catálogo si hay alias; null si solo proposed. */
  fieldCode: string | null;
  /** Clave P2 de origen (proposedDomainKey o domainCode). */
  sourceKey: string;
  catalogStatus: 'KNOWN' | 'PROPOSED' | 'UNRESOLVED' | 'MAPPED_PROPOSED';
  rank: number;
  confidence: number;
  candidateId: string;
};

export type R1ResolutionPayload = {
  fieldResolutionStatus: R1FieldResolutionStatus;
  /** Compat schema 1.0.0 */
  resolutionStatus: R1LegacyResolutionStatus;
  primaryField: R1ResolvedField | null;
  secondaryFields: R1ResolvedField[];
  primaryDomainCode: string | null;
  secondaryDomainCodes: string[];
  resolutionRuleVersion: string;
  configHash: string;
  decisionExplanation: string;
  decisionCodes: string[];
  p2ExecutionId: string;
  p2OutcomeStatus: string;
  snapshotId: string;
  provenance: {
    stageCode: 'R1';
    mode: 'ARTIFACT_ONLY';
    inputSource: 'P2_CONTRACT';
    p2ArtifactDigest: string | null;
    generativeResultOrigin: 'RULES_ONLY';
  };
};

export type R1ContractEnvelope = {
  contractCode: typeof R1_CONTRACT_CODE;
  contractVersion: typeof R1_CONTRACT_VERSION;
  stageCode: 'R1';
  registryFingerprint: string;
  campaignId: string;
  pipelineRunId: string;
  producedAt: string;
  abstained?: boolean;
  abstentionReason?: string;
  errors: Array<{ code: string; severity: string; messageSafe: string }>;
  warnings: Array<{ code: string; severity: string; messageSafe: string }>;
  payload: R1ResolutionPayload;
};

/** Subconjunto del payload P2 que R1 puede leer. */
export type P2CandidateView = {
  candidateId: string;
  domainCode: string | null;
  proposedDomainKey: string | null;
  catalogStatus: string;
  candidateStatus: string;
  confidence: number;
  rank: number;
  supportingEvidenceUnitIds: string[];
  contradictingEvidenceUnitIds: string[];
  rationaleCode: string;
  coverageRatio: number;
  ambiguityFlags: string[];
};

export type P2ContractView = {
  contractCode?: string;
  contractVersion?: string;
  campaignId?: string;
  pipelineRunId?: string;
  warnings?: Array<{ code: string; messageSafe?: string }>;
  payload: {
    executionId: string;
    snapshotId: string;
    outcomeStatus: string;
    reviewState?: string;
    domainCandidates: P2CandidateView[];
    p1ArtifactDigest?: string;
    artifactProvenance?: { p2ArtifactDigest?: string };
    configFingerprint?: string;
  };
};
