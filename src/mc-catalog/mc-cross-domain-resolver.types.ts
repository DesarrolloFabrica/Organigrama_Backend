/**
 * Cross-Domain Resolver v0 — contratos (CDR-0.1.0).
 * Diagnóstico / dry-run. No publicable. No persiste.
 */

import type { McDomainQualification } from './mc-domain-qualification';
import type {
  McEvaluationSetDomainStatus,
  McEvaluationSetStatus,
} from './mc-evaluation-set.types';

export const MC_CDR_RESOLVER_VERSION = 'CDR-0.1.0' as const;
export const MC_CDR_POLICY_VERSION = 'CDRP-0.1.0' as const;

export const MC_PROFESSIONAL_CLASSIFICATION_TYPES = [
  'DOMINANT_PRACTICE',
  'PRIMARY_WITH_COMPLEMENTARY',
  'HYBRID_PRACTICE',
  'AMBIGUOUS',
  'INSUFFICIENT_EVIDENCE',
  'NO_SUPPORTED_DOMAIN',
  'UNRESOLVED',
] as const;

export type McProfessionalClassificationType =
  (typeof MC_PROFESSIONAL_CLASSIFICATION_TYPES)[number];

export const MC_CROSS_DOMAIN_POSITIONS = [
  'DOMINANT',
  'CO_DOMINANT',
  'COMPLEMENTARY',
  'SUPPORTED',
  'WEAK_SIGNAL',
  'NON_REPRESENTATIVE',
  'INSUFFICIENT',
  'NOT_COMPARABLE',
] as const;

export type McCrossDomainPosition = (typeof MC_CROSS_DOMAIN_POSITIONS)[number];

export const MC_RESOLUTION_CONFIDENCE_BANDS = [
  'HIGH',
  'MEDIUM',
  'LOW',
  'NOT_APPLICABLE',
] as const;

export type McResolutionConfidenceBand =
  (typeof MC_RESOLUTION_CONFIDENCE_BANDS)[number];

export const MC_CDR_DECISION_CODES = [
  'SINGLE_PRIMARY_REST_OUTSIDE',
  'PRIMARY_WITH_SECONDARY_SUPPORT',
  'MULTIPLE_PRIMARY_COMPARABLE',
  'MULTIPLE_PRIMARY_UNBALANCED',
  'MULTIPLE_PRIMARY_UNRESOLVED',
  'THREE_PRIMARY_UNRESOLVED',
  'ALL_SECONDARY_AMBIGUOUS',
  'ALL_OUTSIDE',
  'ALL_INSUFFICIENT',
  'MIXED_INSUFFICIENT_AND_OUTSIDE',
  'PARTIAL_SET_NOT_ALLOWED',
  'FAILED_DOMAIN_PRESENT',
  'RUNNING_SET_NOT_ALLOWED',
  'FAILED_SET_NOT_ALLOWED',
  'DUPLICATE_DOMAIN',
  'MISSING_CANDIDATE_OUTCOME',
  'INVALID_STRUCTURE',
  'QUALIFICATION_STRENGTH_CONFLICT',
  'HYBRID_INDEPENDENCE_NOT_FULLY_VERIFIED',
  'INSUFFICIENT_COMPARABLE_METRICS',
  'DOMAIN_CARDINALITY_IMBALANCE',
  'LOW_MAPPING_COVERAGE',
  'INSUFFICIENT_COMPARISON_DIMENSIONS',
] as const;

export type McCdrDecisionCode = (typeof MC_CDR_DECISION_CODES)[number];

export type McMetricAvailability =
  | 'USABLE'
  | 'DIAGNOSTIC_ONLY'
  | 'NOT_COMPARABLE'
  | 'NOT_AVAILABLE';

export interface McAffinityDimension {
  value: number | null;
  availability: McMetricAvailability;
  normalization: string | null;
  source: string;
  warning: string | null;
}

export interface McDomainAffinityVector {
  qualificationLevel: McAffinityDimension;
  activeSpecialtyCount: McAffinityDimension;
  emergentSpecialtyCount: McAffinityDimension;
  hiddenSpecialtyCount: McAffinityDimension;
  activeSpecialtyRatio: McAffinityDimension;
  bestSpecialtyStrength: McAffinityDimension;
  topKSpecialtyStrength: McAffinityDimension;
  evidenceCoverage: McAffinityDimension;
  mappedEvidenceRatio: McAffinityDimension;
  evidenceQuality: McAffinityDimension;
  evidenceConfidence: McAffinityDimension;
  unmappedEvidenceRatio: McAffinityDimension;
}

/** Especialidad mínima para vector (fuente: mc_profile_specialty_result / PA2). */
export interface McCdrSpecialtySnapshot {
  specialtyCode: string;
  presentationStatus: 'ACTIVE' | 'EMERGENT' | 'HIDDEN' | string;
  mappedSkillCount: number;
  evidencedSkillCount: number;
  coverage: number;
  confidence: number;
  strength: number;
  rank: number;
}

export interface McCdrDomainEvaluationSnapshot {
  domainCode: string;
  domainStatus: McEvaluationSetDomainStatus;
  domainQualification: McDomainQualification | null;
  profileEvaluationId: string | null;
  /** Conteos PA2 persistidos en mc_profile_evaluation */
  activeCount: number | null;
  emergentCount: number | null;
  hiddenCount: number | null;
  /** Denominador: especialidades evaluadas en el run (specialtyResults.length) */
  specialtyCount: number | null;
  inputSkillsCount: number | null;
  specialties: McCdrSpecialtySnapshot[];
  /** Prohibido para decisión; solo diagnóstico de no-uso */
  isActive?: boolean;
}

export interface McEvaluationSetSnapshot {
  evaluationSetId: string;
  personId: string;
  setStatus: McEvaluationSetStatus;
  schemaVersion: string;
  qualificationPolicyVersion: string;
  contextHash: string;
  candidateDomains: string[];
  domains: McCdrDomainEvaluationSnapshot[];
  warnings?: string[];
}

export interface McCrossDomainResolverPolicy {
  resolverVersion: string;
  policyVersion: string;
  allowPartialSets: boolean;
  hybridMode: 'CONSERVATIVE';
  comparisonDimensions: ReadonlyArray<
    keyof Pick<
      McDomainAffinityVector,
      | 'activeSpecialtyRatio'
      | 'bestSpecialtyStrength'
      | 'topKSpecialtyStrength'
      | 'evidenceCoverage'
      | 'evidenceConfidence'
    >
  >;
  minimumComparableDimensions: number;
  topK: number;
  /** Margen relativo mínimo para declarar desbalance entre dos PRIMARY */
  dominanceMargin: number;
}

export interface McResolverEligibility {
  eligible: boolean;
  code: McCdrDecisionCode | 'ELIGIBLE';
  reasons: string[];
  warnings: string[];
}

export interface McResolvedDomainPosition {
  domainCode: string;
  qualification: McDomainQualification | null;
  position: McCrossDomainPosition;
  rank: number | null;
  reasons: string[];
  metrics: McDomainAffinityVector;
}

export interface McResolverFactor {
  code: string;
  detail: string;
}

export interface McResolverDomainExplanation {
  domainCode: string;
  position: McCrossDomainPosition;
  qualification: McDomainQualification | null;
  reasonCodes: string[];
}

export interface McRejectedAlternative {
  classificationType: McProfessionalClassificationType;
  reasonCodes: string[];
}

export interface McProfessionalClassificationExplanation {
  summaryCode: McCdrDecisionCode | string;
  summary: string;
  decisiveFactors: McResolverFactor[];
  supportingDomains: McResolverDomainExplanation[];
  rejectedAlternatives: McRejectedAlternative[];
  evidenceLimitations: string[];
  warnings: string[];
}

export interface McCrossDomainResolverDiagnostics {
  eligibility: McResolverEligibility;
  qualificationHistogram: Record<string, number>;
  maturityWarnings: string[];
  independenceVerified: false;
}

export interface McCrossDomainResolution {
  resolverVersion: string;
  policyVersion: string;
  evaluationSetId: string;
  status: 'RESOLVED' | 'UNRESOLVED';
  classificationType: McProfessionalClassificationType;
  domainPositions: McResolvedDomainPosition[];
  confidenceBand: McResolutionConfidenceBand;
  explanation: McProfessionalClassificationExplanation;
  warnings: string[];
  decisiveRule: string;
  diagnostics: McCrossDomainResolverDiagnostics;
}

export interface McCrossDomainResolverInput {
  evaluationSet: McEvaluationSetSnapshot;
  policy: McCrossDomainResolverPolicy;
}
