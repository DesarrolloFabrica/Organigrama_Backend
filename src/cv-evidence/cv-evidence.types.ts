import type { EvidenceSourceType } from '../cv-skills/cv-skills.types';

export type EvidenceLevel = 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG';

export type EvidenceRulesProfile = 'er1' | 'er2';

export type EvidenceQualityFlag =
  | 'NO_EVIDENCE'
  | 'ONLY_SKILLS_SECTION'
  | 'ONLY_PROFILE_SUMMARY'
  | 'ONLY_LISTING_EVIDENCE'
  | 'HAS_APPLIED_EVIDENCE'
  | 'MULTIPLE_SOURCE_TYPES'
  | 'DUPLICATE_EVIDENCE'
  | 'SHORT_EVIDENCE'
  | 'GENERIC_EVIDENCE'
  | 'NAME_ONLY_EVIDENCE'
  | 'OTHER_SOURCE_PRESENT'
  | 'LOW_SOURCE_DIVERSITY'
  | 'HIGH_SOURCE_DIVERSITY'
  | 'HAS_CERTIFICATION'
  | 'HAS_WORK_EXPERIENCE'
  | 'HAS_PROJECT'
  | 'HAS_ACHIEVEMENT'
  | 'HAS_RESPONSIBILITY'
  | 'AMBIGUOUS_EVIDENCE'
  | 'ONLY_AMBIGUOUS_EVIDENCE'
  | 'HAS_SUBSTANTIVE_EVIDENCE';

export type EvidenceEvaluationStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED';

export interface EvidenceEngineConfig {
  rulesProfile: EvidenceRulesProfile;
  rulesVersion: string;
  sourceWeightVersion: string;
  algorithmVersion: string;
  /** er1: floor artificial a 1 si hay evidencia. er2: false. */
  applyMinWeakFloor: boolean;
  sourceWeights: Record<EvidenceSourceType, number>;
  appliedSources: EvidenceSourceType[];
  caps: {
    maxEvidenceContribution: number;
    maxDiversityContribution: number;
    maxAppliedContribution: number;
  };
  /** Cap por sourceType sobre la contribución acumulada del tipo (er2). */
  sourceTypeCaps?: Partial<Record<EvidenceSourceType, number>>;
  /** Caps de strength final tras contribuciones/penalties (er2). */
  strengthCaps?: {
    onlyAmbiguousMaxStrength: number;
    onlyListingMaxStrength: number;
    noAppliedNoSubstantiveMaxStrength: number;
  };
  penalties: {
    onlySkillsSection: number;
    onlyProfileSummary: number;
    genericText: number;
    shortText: number;
    duplicates: number;
    otherHeavy: number;
    nameOnly?: number;
    onlyAmbiguous?: number;
  };
  thresholds: {
    weakMax: number;
    moderateMax: number;
    strongMin: number;
  };
  shortEvidenceMaxChars: number;
  sameSourceDecay: number;
}

export interface RawEvidenceItemInput {
  sourceType: string;
  evidenceText: string;
  occurrenceIndex?: number;
  isFallback?: boolean;
}

export interface EvidenceSkillInput {
  enrichmentItemId: string;
  extractionSkillId: string;
  normalizedName: string;
  evidenceItems: RawEvidenceItemInput[];
}

export interface EvidenceTextClassification {
  isNameOnly: boolean;
  isShort: boolean;
  isListing: boolean;
  isAmbiguous: boolean;
  isSubstantive: boolean;
  reasons: string[];
}

export interface NormalizedEvidenceItem {
  sourceType: EvidenceSourceType;
  originalText: string;
  normalizedText: string;
  isShort: boolean;
  isNameOnly: boolean;
  isListing: boolean;
  isAmbiguous: boolean;
  isSubstantive: boolean;
  classifyReasons: string[];
  isDuplicateOfEarlier: boolean;
}

export interface EvidenceSkillMetrics {
  enrichmentItemId: string;
  extractionSkillId: string;
  normalizedName: string;
  evidenceCount: number;
  uniqueEvidenceCount: number;
  appliedEvidenceCount: number;
  substantiveEvidenceCount: number;
  listingEvidenceCount: number;
  ambiguousEvidenceCount: number;
  sourceDiversity: number;
  repeatedMentionCount: number;
  hasWorkExperience: boolean;
  hasProject: boolean;
  hasAchievement: boolean;
  hasResponsibility: boolean;
  hasCertification: boolean;
  hasEducation: boolean;
  hasProfileSummary: boolean;
  hasSkillsSection: boolean;
  hasOther: boolean;
  evidenceStrength: number;
  evidenceConfidence: number;
  evidenceLevel: EvidenceLevel;
  qualityFlags: EvidenceQualityFlag[];
  sourceBreakdown: Record<string, number>;
  scoringBreakdown: Record<string, unknown>;
  explanation: string;
}

export interface EvidenceEngineRunResult {
  skills: EvidenceSkillMetrics[];
  metrics: {
    inputSkills: number;
    outputSkills: number;
    strongSkills: number;
    moderateSkills: number;
    weakSkills: number;
    noEvidenceSkills: number;
    appliedEvidenceSkills: number;
    warningsCount: number;
    averageStrength: number;
    averageConfidence: number;
  };
  warnings: string[];
}

export interface EvidenceEngineDryRunArtifact {
  meta: {
    enrichmentId: string;
    extractionId: string;
    personId: string;
    evidenceRulesVersion: string;
    sourceWeightVersion: string;
    algorithmVersion: string;
    configHash: string;
    status: 'DRY_RUN' | 'SUCCEEDED' | 'FAILED';
    startedAt: string;
    finishedAt: string;
  };
  config: EvidenceEngineConfig;
  result: EvidenceEngineRunResult;
}
