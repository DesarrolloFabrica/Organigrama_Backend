import type {
  AttributeEngineConfig,
  AttributeMappingType,
  MacroattributeQualityFlag,
  SubattributeQualityFlag,
} from './cv-attributes.types';
import type { EvidenceLevel } from '../cv-evidence/cv-evidence.types';

export interface SubattributeFlagInput {
  mappedSkillsCount: number;
  contributingSkillsCount: number;
  coverage: number;
  confidence: number;
  /** Participación de la mayor contribución sobre el total de contribuciones. */
  topContributionShare: number;
  contributingLevels: EvidenceLevel[];
  mappingTypes: AttributeMappingType[];
  hasUnmappedRelatedSkills: boolean;
}

/** Flags de subatributo en orden declarativo estable. */
export function buildSubattributeFlags(
  input: SubattributeFlagInput,
  config: AttributeEngineConfig,
): SubattributeQualityFlag[] {
  const flags: SubattributeQualityFlag[] = [];
  const contributing = input.contributingSkillsCount;

  if (input.mappedSkillsCount === 0) flags.push('NO_MAPPED_SKILLS');
  if (contributing === 0) flags.push('NO_CONTRIBUTING_SKILLS');
  if (contributing === 1) flags.push('SINGLE_SKILL_SUPPORT');
  if (contributing >= 2) flags.push('MULTIPLE_SKILL_SUPPORT');

  if (contributing > 0 && input.coverage <= config.coverage.lowCoverageMax) {
    flags.push('LOW_COVERAGE');
  }
  if (input.coverage >= config.coverage.highCoverageMin) {
    flags.push('HIGH_COVERAGE');
  }

  if (
    contributing >= 2 &&
    input.topContributionShare >= config.confidence.concentrationThreshold
  ) {
    flags.push('CONCENTRATED_SUPPORT');
  }
  if (
    contributing >= 3 &&
    input.topContributionShare < config.macro.concentrationThreshold
  ) {
    flags.push('DIVERSE_SUPPORT');
  }

  if (contributing > 0 && input.contributingLevels.every((l) => l === 'WEAK')) {
    flags.push('WEAK_ONLY_SUPPORT');
  }
  if (input.contributingLevels.includes('MODERATE')) {
    flags.push('HAS_MODERATE_SUPPORT');
  }
  if (input.contributingLevels.includes('STRONG')) {
    flags.push('HAS_STRONG_SUPPORT');
  }

  if (input.hasUnmappedRelatedSkills) flags.push('HAS_UNMAPPED_RELATED_SKILLS');

  if (
    contributing > 0 &&
    input.confidence < config.confidence.lowConfidenceThreshold
  ) {
    flags.push('LOW_CONFIDENCE_SUPPORT');
  }

  if (
    input.mappedSkillsCount > 0 &&
    input.mappingTypes.length > 0 &&
    input.mappingTypes.every((t) => t === 'CONTEXTUAL')
  ) {
    flags.push('CONTEXTUAL_MAPPING_ONLY');
  }

  return flags;
}

export interface MacroattributeFlagInput {
  supportedSubattributesCount: number;
  totalSubattributesCount: number;
  coverage: number;
  /** Participación del subatributo de mayor score sobre la suma de scores. */
  topSubattributeShare: number;
}

/** Flags de macroatributo en orden declarativo estable. */
export function buildMacroattributeFlags(
  input: MacroattributeFlagInput,
  config: AttributeEngineConfig,
): MacroattributeQualityFlag[] {
  const flags: MacroattributeQualityFlag[] = [];
  const supported = input.supportedSubattributesCount;

  if (supported === 0) flags.push('NO_SUPPORTED_SUBATTRIBUTES');
  if (supported === 1) flags.push('SINGLE_SUBATTRIBUTE_SUPPORT');
  if (supported >= 2) flags.push('MULTIPLE_SUBATTRIBUTE_SUPPORT');

  if (input.coverage <= config.coverage.lowCoverageMax) {
    flags.push('LOW_COVERAGE');
  }
  if (input.coverage >= config.coverage.highCoverageMin) {
    flags.push('HIGH_COVERAGE');
  }

  if (
    supported >= 2 &&
    input.topSubattributeShare >= config.macro.concentrationThreshold
  ) {
    flags.push('CONCENTRATED_SUBATTRIBUTE_SUPPORT');
  }
  if (
    supported >= 3 &&
    input.topSubattributeShare < config.macro.concentrationThreshold
  ) {
    flags.push('DIVERSE_SUBATTRIBUTE_SUPPORT');
  }

  return flags;
}
