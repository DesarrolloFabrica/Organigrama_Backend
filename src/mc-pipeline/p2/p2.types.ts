/**
 * Tipos P2 v1 — alineados a MC1.P2.DOMAIN_CANDIDATES 2.0.0 (subconjunto ejecutable).
 */
export const P2_CONTRACT_CODE = 'MC1.P2.DOMAIN_CANDIDATES' as const;
export const P2_CONTRACT_VERSION = '2.0.0' as const;
export const P2_PROMPT_VERSION = 'MC1.P2.PROMPT.FUNCTIONAL.1.1.0' as const;
export const P2_REASONING_POLICY_VERSION = '7B.1' as const;
export const P2_GENERATION_POLICY_VERSION = '7C.1' as const;
export const P2_CATALOG_POLICY_VERSION =
  'P2.CATALOG_POLICY.KNOWN_FIELDS.2.0.0' as const;
export const P2_MAX_CANDIDATES = 5;

export type P2OutcomeStatus =
  | 'CANDIDATES_PRODUCED'
  | 'NO_DOMAIN_EVIDENCE'
  | 'INSUFFICIENT_SIGNAL'
  | 'REVIEW_REQUIRED'
  | 'FAILED';

export type P2CatalogStatus = 'KNOWN' | 'PROPOSED' | 'UNRESOLVED';
export type P2CandidateStatus = 'ACTIVE' | 'WEAK';
export type P2ReviewState = 'NOT_REQUIRED' | 'SUGGESTED' | 'REQUIRED';

export type P2EvidenceDispositionDecision =
  | 'SUPPORTS'
  | 'CONTRADICTS'
  | 'NEUTRAL'
  | 'INSUFFICIENT'
  | 'EXCLUDED_BY_POLICY';

export type P2AmbiguityFlag =
  | 'TRANSVERSAL_SUPPORT'
  | 'MULTI_CANDIDATE_TIE'
  | 'CONTRADICTORY_EVIDENCE'
  | 'KNOWLEDGE_HEAVY'
  | 'LOW_COVERAGE'
  | 'KIND_IMBALANCE'
  | 'CATALOG_GAP'
  | 'WEAK_EXPLICITNESS'
  | 'INSUFFICIENT_ACTIONABLE_SIGNAL';

export type P2RationaleCode =
  | 'SUPPORT_ACTION_CLUSTER'
  | 'SUPPORT_PROJECT_RESULT'
  | 'SUPPORT_RESPONSIBILITY_SCOPE'
  | 'SUPPORT_DELIVERABLE_SET'
  | 'SUPPORT_MIXED_KINDS'
  | 'PENALTY_KNOWLEDGE_ONLY'
  | 'PENALTY_CONTRADICTION'
  | 'PENALTY_LOW_DIVERSITY'
  | 'GAP_NO_KNOWN_MATCH'
  | 'TRANSVERSAL_SPLIT';

/** Unit elegible para P2 — señales estructuradas, sin sourceText/normalizedText. */
export type P2InputEvidenceUnit = {
  /** ID canónico downstream (único, estable al recargar el mismo artefacto). */
  evidenceUnitId: string;
  /** ID legado/original del pack si existía (p. ej. eu-<candidateId>); no garantiza unicidad. */
  originalEvidenceUnitId: string | null;
  evidenceKind: string;
  explicitness: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  contentFingerprint: string;
  primaryCandidateId: string;
  /** Señales estructuradas P1 (no cita literal del CV). */
  normalizedActivity: string | null;
  object: string | null;
  toolOrMethod: string | null;
  result: string | null;
  scope: string | null;
  temporalContext: string | null;
};

export type P2DomainCandidate = {
  candidateId: string;
  domainCode: string | null;
  proposedDomainKey: string | null;
  catalogStatus: P2CatalogStatus;
  candidateStatus: P2CandidateStatus;
  confidence: number;
  rank: number;
  supportingEvidenceUnitIds: string[];
  contradictingEvidenceUnitIds: string[];
  rationaleCode: P2RationaleCode;
  coverageRatio: number;
  ambiguityFlags: P2AmbiguityFlag[];
  signalKindMix?: Record<string, number>;
  producedBy: 'MODEL' | 'RULE_HINT' | 'HYBRID';
};

export type P2EvidenceDisposition = {
  evidenceUnitId: string;
  decision: P2EvidenceDispositionDecision;
  candidateRefs?: string[];
  policyCode?: string;
};

export type P2ArtifactPayload = {
  executionId: string;
  configFingerprint: string;
  p1RunId: string;
  snapshotId: string;
  p1ArtifactDigest: string;
  p1ConfigFingerprint?: string;
  catalogPolicyVersion: string;
  outcomeStatus: P2OutcomeStatus;
  domainCandidates: P2DomainCandidate[];
  evidenceDispositions: P2EvidenceDisposition[];
  reviewState: P2ReviewState;
  maxCandidates: number;
  artifactProvenance: {
    stageCode: 'P2';
    contractCode: typeof P2_CONTRACT_CODE;
    contractVersion: typeof P2_CONTRACT_VERSION;
    inputSource: 'P1_PACK_ARTIFACT_ONLY_LAB' | 'P1_CANONICAL_EVIDENCE_READER';
    generativeResultOrigin: 'LIVE' | 'REUSED_ARTIFACT' | 'REGENERATED';
    p2ArtifactDigest?: string;
    reasoningPolicyVersion: string;
    generationPolicyVersion: string;
    promptVersion: string;
    professionalFieldCatalogVersion?: string;
  };
};
export type P2ContractEnvelope = {
  contractCode: typeof P2_CONTRACT_CODE;
  contractVersion: typeof P2_CONTRACT_VERSION;
  stageCode: 'P2';
  registryFingerprint: string;
  campaignId: string;
  pipelineRunId: string;
  producedAt: string;
  abstained?: boolean;
  abstentionReason?: string;
  errors: Array<{
    code: string;
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';
    messageSafe: string;
  }>;
  warnings: Array<{
    code: string;
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';
    messageSafe: string;
  }>;
  payload: P2ArtifactPayload;
};

/** Salida cruda esperada del modelo (antes de normalizar). */
export type P2ModelRawOutput = {
  professionalActivities?: Array<{
    activityId: string;
    summaryLabel: string;
    evidenceUnitIds: string[];
  }>;
  capabilityAreas?: Array<{
    capabilityId: string;
    summaryLabel: string;
    activityIds: string[];
  }>;
  domainCandidates: Array<{
    candidateId?: string;
    proposedDomainKey?: string | null;
    domainCode?: string | null;
    catalogStatus?: P2CatalogStatus;
    candidateStatus?: P2CandidateStatus;
    confidence: number;
    rank: number;
    supportingEvidenceUnitIds: string[];
    contradictingEvidenceUnitIds?: string[];
    rationaleCode: P2RationaleCode;
    coverageRatio: number;
    ambiguityFlags?: P2AmbiguityFlag[];
    signalKindMix?: Record<string, number>;
  }>;
  evidenceDispositions: P2EvidenceDisposition[];
  outcomeStatus: P2OutcomeStatus;
  reviewState?: P2ReviewState;
  warnings?: string[];
};
