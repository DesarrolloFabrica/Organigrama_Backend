import type { EvidenceSourceType } from '../cv-skills/cv-skills.types';
import {
  SHORT_EVIDENCE_MAX_CHARS,
  SAME_SOURCE_DECAY,
  CV_EVIDENCE_RULES_VERSION,
  CV_EVIDENCE_SOURCE_WEIGHT_VERSION,
  CV_EVIDENCE_ALGORITHM_VERSION,
  CV_EVIDENCE_RULES_VERSION_ER1,
  CV_EVIDENCE_SOURCE_WEIGHT_VERSION_ER1,
  CV_EVIDENCE_ALGORITHM_VERSION_ER1,
} from './cv-evidence.constants';
import type { EvidenceEngineConfig } from './cv-evidence.types';

const SHARED_WEIGHTS: EvidenceEngineConfig['sourceWeights'] = {
  WORK_EXPERIENCE: 30,
  PROJECT: 27,
  ACHIEVEMENT: 25,
  RESPONSIBILITY: 22,
  CERTIFICATION: 18,
  EDUCATION: 14,
  PROFILE_SUMMARY: 8,
  SKILLS_SECTION: 5,
  OTHER: 2,
};

const APPLIED: EvidenceSourceType[] = [
  'WORK_EXPERIENCE',
  'PROJECT',
  'ACHIEVEMENT',
  'RESPONSIBILITY',
];

/**
 * Configuración experimental er1 / sw1 (congelada).
 * Incluye floor artificial y penalties agresivos de onlySkills.
 */
export const EVIDENCE_ENGINE_CONFIG_ER1: EvidenceEngineConfig = {
  rulesProfile: 'er1',
  rulesVersion: CV_EVIDENCE_RULES_VERSION_ER1,
  sourceWeightVersion: CV_EVIDENCE_SOURCE_WEIGHT_VERSION_ER1,
  algorithmVersion: CV_EVIDENCE_ALGORITHM_VERSION_ER1,
  applyMinWeakFloor: true,
  sourceWeights: { ...SHARED_WEIGHTS },
  appliedSources: [...APPLIED],
  caps: {
    maxEvidenceContribution: 70,
    maxDiversityContribution: 15,
    maxAppliedContribution: 15,
  },
  penalties: {
    onlySkillsSection: 15,
    onlyProfileSummary: 10,
    genericText: 8,
    shortText: 5,
    duplicates: 5,
    otherHeavy: 5,
  },
  thresholds: {
    weakMax: 39,
    moderateMax: 69,
    strongMin: 70,
  },
  shortEvidenceMaxChars: SHORT_EVIDENCE_MAX_CHARS,
  sameSourceDecay: SAME_SOURCE_DECAY,
};

/**
 * Configuración experimental er2 / sw2 / algorithm 1.1.0.
 * Sin floor; caps de listing/ambiguous; penalties recalibrados.
 */
export const EVIDENCE_ENGINE_CONFIG_ER2: EvidenceEngineConfig = {
  rulesProfile: 'er2',
  rulesVersion: CV_EVIDENCE_RULES_VERSION,
  sourceWeightVersion: CV_EVIDENCE_SOURCE_WEIGHT_VERSION,
  algorithmVersion: CV_EVIDENCE_ALGORITHM_VERSION,
  applyMinWeakFloor: false,
  sourceWeights: { ...SHARED_WEIGHTS },
  appliedSources: [...APPLIED],
  caps: {
    maxEvidenceContribution: 70,
    maxDiversityContribution: 15,
    maxAppliedContribution: 15,
  },
  sourceTypeCaps: {
    SKILLS_SECTION: 8,
    PROFILE_SUMMARY: 12,
    OTHER: 4,
  },
  strengthCaps: {
    onlyAmbiguousMaxStrength: 5,
    onlyListingMaxStrength: 15,
    noAppliedNoSubstantiveMaxStrength: 20,
  },
  penalties: {
    onlySkillsSection: 4,
    onlyProfileSummary: 3,
    genericText: 8,
    shortText: 3,
    duplicates: 5,
    otherHeavy: 5,
    nameOnly: 5,
    onlyAmbiguous: 5,
  },
  thresholds: {
    weakMax: 39,
    moderateMax: 69,
    strongMin: 70,
  },
  shortEvidenceMaxChars: SHORT_EVIDENCE_MAX_CHARS,
  sameSourceDecay: SAME_SOURCE_DECAY,
};

/** Default operativo = er2. */
export function getDefaultEvidenceEngineConfig(): EvidenceEngineConfig {
  return structuredClone(EVIDENCE_ENGINE_CONFIG_ER2);
}

export function getEvidenceEngineConfig(
  profile: 'er1' | 'er2' = 'er2',
): EvidenceEngineConfig {
  return structuredClone(
    profile === 'er1' ? EVIDENCE_ENGINE_CONFIG_ER1 : EVIDENCE_ENGINE_CONFIG_ER2,
  );
}

export function isAppliedSource(
  config: EvidenceEngineConfig,
  sourceType: EvidenceSourceType,
): boolean {
  return config.appliedSources.includes(sourceType);
}
