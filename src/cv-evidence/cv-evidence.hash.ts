import { createHash } from 'node:crypto';
import type { EvidenceEngineConfig } from './cv-evidence.types';

/**
 * Hash canónico de la config del Evidence Engine (orden estable de claves).
 */
export function computeEvidenceConfigHash(config: EvidenceEngineConfig): string {
  const canonical = {
    rulesProfile: config.rulesProfile,
    rulesVersion: config.rulesVersion,
    sourceWeightVersion: config.sourceWeightVersion,
    algorithmVersion: config.algorithmVersion,
    applyMinWeakFloor: config.applyMinWeakFloor,
    sourceWeights: sortRecord(config.sourceWeights),
    appliedSources: [...config.appliedSources].sort(),
    caps: {
      maxEvidenceContribution: config.caps.maxEvidenceContribution,
      maxDiversityContribution: config.caps.maxDiversityContribution,
      maxAppliedContribution: config.caps.maxAppliedContribution,
    },
    sourceTypeCaps: config.sourceTypeCaps
      ? sortRecord(config.sourceTypeCaps as Record<string, number>)
      : null,
    strengthCaps: config.strengthCaps
      ? {
          onlyAmbiguousMaxStrength:
            config.strengthCaps.onlyAmbiguousMaxStrength,
          onlyListingMaxStrength: config.strengthCaps.onlyListingMaxStrength,
          noAppliedNoSubstantiveMaxStrength:
            config.strengthCaps.noAppliedNoSubstantiveMaxStrength,
        }
      : null,
    penalties: {
      onlySkillsSection: config.penalties.onlySkillsSection,
      onlyProfileSummary: config.penalties.onlyProfileSummary,
      genericText: config.penalties.genericText,
      shortText: config.penalties.shortText,
      duplicates: config.penalties.duplicates,
      otherHeavy: config.penalties.otherHeavy,
      nameOnly: config.penalties.nameOnly ?? null,
      onlyAmbiguous: config.penalties.onlyAmbiguous ?? null,
    },
    thresholds: {
      weakMax: config.thresholds.weakMax,
      moderateMax: config.thresholds.moderateMax,
      strongMin: config.thresholds.strongMin,
    },
    shortEvidenceMaxChars: config.shortEvidenceMaxChars,
    sameSourceDecay: config.sameSourceDecay,
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical), 'utf8')
    .digest('hex');
}

function sortRecord<T>(rec: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(rec).sort()) {
    out[key] = rec[key];
  }
  return out;
}
