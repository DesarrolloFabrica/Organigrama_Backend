import type { EvidenceLevel } from '../cv-evidence/cv-evidence.types';

export type AttributeSupportLevel =
  | 'NO_SUPPORT'
  | 'LIMITED'
  | 'DEVELOPING'
  | 'ESTABLISHED'
  | 'WELL_SUPPORTED';

export type AttributeMappingType = 'DIRECT' | 'SUPPORTING' | 'CONTEXTUAL';

export type AttributeCatalogStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED';

export type AttributeRunStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export type SubattributeQualityFlag =
  | 'NO_MAPPED_SKILLS'
  | 'NO_CONTRIBUTING_SKILLS'
  | 'SINGLE_SKILL_SUPPORT'
  | 'MULTIPLE_SKILL_SUPPORT'
  | 'LOW_COVERAGE'
  | 'HIGH_COVERAGE'
  | 'CONCENTRATED_SUPPORT'
  | 'DIVERSE_SUPPORT'
  | 'WEAK_ONLY_SUPPORT'
  | 'HAS_MODERATE_SUPPORT'
  | 'HAS_STRONG_SUPPORT'
  | 'HAS_UNMAPPED_RELATED_SKILLS'
  | 'LOW_CONFIDENCE_SUPPORT'
  | 'CONTEXTUAL_MAPPING_ONLY';

export type MacroattributeQualityFlag =
  | 'NO_SUPPORTED_SUBATTRIBUTES'
  | 'SINGLE_SUBATTRIBUTE_SUPPORT'
  | 'MULTIPLE_SUBATTRIBUTE_SUPPORT'
  | 'LOW_COVERAGE'
  | 'HIGH_COVERAGE'
  | 'CONCENTRATED_SUBATTRIBUTE_SUPPORT'
  | 'DIVERSE_SUBATTRIBUTE_SUPPORT';

/** Config determinista del Attribute Engine. */
export interface AttributeEngineConfig {
  configVersion: string;
  algorithmVersion: string;
  /** Multiplicador por nivel de evidencia de la skill aportante. */
  levelFactors: Record<EvidenceLevel, number>;
  /**
   * Factores de rendimiento decreciente por posición (contribución ordenada
   * desc). El último valor aplica a la cuarta posición y siguientes.
   */
  diminishingFactors: number[];
  /** Cap del score agregado de subatributo antes del clamp. */
  maxSubattributeScore: number;
  /** Target de skills contribuyentes usado si el catálogo no define uno. */
  defaultTargetSupportingSkills: number;
  thresholds: {
    limitedMin: number;
    developingMin: number;
    establishedMin: number;
    wellSupportedMin: number;
  };
  confidence: {
    multiSkillBonusTwo: number;
    multiSkillBonusThreePlus: number;
    concentrationThreshold: number;
    concentrationPenalty: number;
    noDirectMappingPenalty: number;
    contextualOnlyPenalty: number;
    lowConfidenceThreshold: number;
  };
  macro: {
    /** Solo subatributos con soporte entran al promedio del macroatributo. */
    supportedOnlyAverage: boolean;
    singleSubattributePenalty: number;
    lowCoverageThreshold: number;
    lowCoveragePenalty: number;
    concentrationThreshold: number;
  };
  coverage: {
    lowCoverageMax: number;
    highCoverageMin: number;
  };
}

// ─── Catálogo (entrada del engine puro) ───────────────────────────────────────

export interface AttributeCatalogMacro {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Peso relativo dentro del macroatributo, por código de subatributo. */
  subattributeWeights?: Record<string, number>;
}

export interface AttributeCatalogSub {
  id: string;
  macroattributeId: string;
  code: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  minimumSupportingSkills: number;
}

export interface AttributeMapping {
  id: string;
  skillId: string;
  subattributeId: string;
  weight: number;
  mappingType: AttributeMappingType;
  rationale?: string | null;
  isActive: boolean;
}

/**
 * Skill declarada como no mapeada a propósito, con los subatributos a los que es
 * temáticamente cercana. Solo alimenta HAS_UNMAPPED_RELATED_SKILLS.
 */
export interface AttributeUnmappedRelation {
  skillId: string;
  skillName: string;
  reason: string;
  relatedSubattributeIds: string[];
}

export interface AttributeCatalog {
  catalogVersionId: string;
  catalogCode: string;
  catalogVersion: string;
  status: AttributeCatalogStatus;
  macroattributes: AttributeCatalogMacro[];
  subattributes: AttributeCatalogSub[];
  mappings: AttributeMapping[];
  unmappedRelations?: AttributeUnmappedRelation[];
}

// ─── Entrada de skills evaluadas ──────────────────────────────────────────────

export interface AttributeSkillInput {
  evaluationItemId: string;
  extractionSkillId: string;
  skillId: string;
  normalizedName: string;
  evidenceStrength: number;
  evidenceConfidence: number;
  evidenceLevel: EvidenceLevel;
}

// ─── Salida del engine puro ───────────────────────────────────────────────────

export interface AttributeSkillTrace {
  subattributeCode: string;
  subattributeId: string;
  mappingId: string;
  skillId: string;
  extractionSkillId: string;
  evaluationItemId: string;
  normalizedName: string;
  mappingType: AttributeMappingType;
  mappingWeight: number;
  evidenceStrength: number;
  evidenceConfidence: number;
  evidenceLevel: EvidenceLevel;
  levelFactor: number;
  /** strength × weight × levelFactor */
  rawContribution: number;
  /** rawContribution × diminishingFactor(rank) */
  normalizedContribution: number;
  diminishingFactor: number;
  contributionRank: number;
}

export interface SubattributeResult {
  subattributeId: string;
  subattributeCode: string;
  subattributeName: string;
  macroattributeId: string;
  macroattributeCode: string;
  score: number;
  confidence: number;
  coverage: number;
  level: AttributeSupportLevel;
  supportingSkillsCount: number;
  contributingSkillsCount: number;
  strongSupportCount: number;
  moderateSupportCount: number;
  weakSupportCount: number;
  noneSupportCount: number;
  qualityFlags: SubattributeQualityFlag[];
  scoringBreakdown: Record<string, unknown>;
  explanation: string;
  traces: AttributeSkillTrace[];
}

export interface MacroattributeResult {
  macroattributeId: string;
  macroattributeCode: string;
  macroattributeName: string;
  score: number;
  confidence: number;
  coverage: number;
  level: AttributeSupportLevel;
  supportedSubattributesCount: number;
  totalSubattributesCount: number;
  qualityFlags: MacroattributeQualityFlag[];
  scoringBreakdown: Record<string, unknown>;
  explanation: string;
}

export interface AttributeEngineMetrics {
  inputSkills: number;
  mappedSkills: number;
  unmappedSkills: number;
  contributingSkills: number;
  ignoredNoneSkills: number;
  subattributesTotal: number;
  subattributesWithSupport: number;
  macroattributesTotal: number;
  macroattributesWithSupport: number;
  tracesCount: number;
  warningsCount: number;
  averageSubattributeScore: number;
  averageMacroattributeScore: number;
}

export interface AttributeEngineRunResult {
  subattributes: SubattributeResult[];
  macroattributes: MacroattributeResult[];
  unmappedSkills: Array<{
    skillId: string;
    extractionSkillId: string;
    normalizedName: string;
    evidenceLevel: EvidenceLevel;
    evidenceStrength: number;
    reason: string;
  }>;
  metrics: AttributeEngineMetrics;
  warnings: string[];
}

export interface AttributeEngineDryRunArtifact {
  meta: {
    evidenceEvaluationId: string;
    enrichmentId: string;
    extractionId: string;
    personId: string;
    evidenceRulesVersion: string;
    catalogCode: string;
    catalogVersion: string;
    catalogVersionId: string;
    algorithmVersion: string;
    configVersion: string;
    configHash: string;
    mappingHash: string;
    status: 'DRY_RUN' | 'SUCCEEDED' | 'FAILED';
    startedAt: string;
    finishedAt: string;
  };
  config: AttributeEngineConfig;
  skills: AttributeSkillInput[];
  result: AttributeEngineRunResult;
}
