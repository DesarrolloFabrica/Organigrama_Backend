import {
  CV_ATTRIBUTE_ALGORITHM_VERSION,
  CV_ATTRIBUTE_CONFIG_VERSION,
  DEFAULT_TARGET_SUPPORTING_SKILLS,
} from './cv-attributes.constants';
import type { AttributeEngineConfig } from './cv-attributes.types';

/**
 * Configuración ac1 del Attribute Engine.
 *
 * Fórmula documentada:
 *
 *   rawContribution(skill, mapping)
 *     = evidenceStrength × mappingWeight × levelFactor(evidenceLevel)
 *
 *   Por subatributo, ordenando rawContribution desc:
 *     weightedSupport = c1·1.00 + c2·0.70 + c3·0.50 + Σ(cN≥4 · 0.30)
 *     score           = clamp(0, maxSubattributeScore, weightedSupport)
 *
 *   Por macroatributo (solo subatributos con soporte):
 *     score = Σ(subScore × subWeight) / Σ(subWeight)
 *
 * evidenceConfidence no multiplica el score: alimenta la confidence del
 * resultado agregado.
 */
export const ATTRIBUTE_ENGINE_CONFIG_AC1: AttributeEngineConfig = {
  configVersion: CV_ATTRIBUTE_CONFIG_VERSION,
  algorithmVersion: CV_ATTRIBUTE_ALGORITHM_VERSION,
  levelFactors: {
    NONE: 0,
    WEAK: 0.7,
    MODERATE: 0.9,
    STRONG: 1.0,
  },
  diminishingFactors: [1.0, 0.7, 0.5, 0.3],
  maxSubattributeScore: 100,
  defaultTargetSupportingSkills: DEFAULT_TARGET_SUPPORTING_SKILLS,
  thresholds: {
    limitedMin: 0.01,
    developingMin: 25,
    establishedMin: 50,
    wellSupportedMin: 75,
  },
  confidence: {
    multiSkillBonusTwo: 0.05,
    multiSkillBonusThreePlus: 0.1,
    concentrationThreshold: 0.8,
    concentrationPenalty: 0.15,
    noDirectMappingPenalty: 0.05,
    contextualOnlyPenalty: 0.1,
    lowConfidenceThreshold: 0.5,
  },
  macro: {
    supportedOnlyAverage: true,
    singleSubattributePenalty: 0.15,
    lowCoverageThreshold: 0.34,
    lowCoveragePenalty: 0.05,
    concentrationThreshold: 0.6,
  },
  coverage: {
    lowCoverageMax: 0.4,
    highCoverageMin: 1.0,
  },
};

export function getDefaultAttributeEngineConfig(): AttributeEngineConfig {
  return structuredClone(ATTRIBUTE_ENGINE_CONFIG_AC1);
}

/** Factor de rendimiento decreciente para el rank dado (1-based). */
export function diminishingFactorForRank(
  config: AttributeEngineConfig,
  rank: number,
): number {
  const factors = config.diminishingFactors;
  if (factors.length === 0) return 1;
  const index = Math.max(1, rank) - 1;
  return index < factors.length ? factors[index] : factors[factors.length - 1];
}
