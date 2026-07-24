import type { EvidenceSourceType } from '../cv-skills/cv-skills.types';
import { getDefaultEvidenceEngineConfig } from './cv-evidence.config';
import { computeQualityFlags } from './cv-evidence.flags';
import { buildEvidenceExplanation } from './cv-evidence.explanation';
import { normalizeEvidenceItems } from './cv-evidence.normalization';
import {
  computeEvidenceConfidence,
  computeEvidenceStrength,
  countApplied,
  resolveEvidenceLevel,
} from './cv-evidence.scoring';
import type {
  EvidenceEngineConfig,
  EvidenceEngineRunResult,
  EvidenceSkillInput,
  EvidenceSkillMetrics,
} from './cv-evidence.types';

/**
 * Evidence Engine puro: sin I/O, sin TypeORM, sin Gemini, sin PDF.
 */
export function evaluateEvidenceSkills(
  skills: EvidenceSkillInput[],
  config: EvidenceEngineConfig = getDefaultEvidenceEngineConfig(),
): EvidenceEngineRunResult {
  const warnings: string[] = [];
  const results: EvidenceSkillMetrics[] = [];

  for (const skill of skills) {
    results.push(evaluateOneSkill(skill, config, warnings));
  }

  if (results.length !== skills.length) {
    throw new Error(
      `Evidence Engine: output (${results.length}) ≠ input (${skills.length}).`,
    );
  }

  const strongSkills = results.filter((r) => r.evidenceLevel === 'STRONG').length;
  const moderateSkills = results.filter((r) => r.evidenceLevel === 'MODERATE').length;
  const weakSkills = results.filter((r) => r.evidenceLevel === 'WEAK').length;
  const noEvidenceSkills = results.filter((r) => r.evidenceLevel === 'NONE').length;
  const appliedEvidenceSkills = results.filter(
    (r) => r.appliedEvidenceCount > 0,
  ).length;
  const avgStrength =
    results.length === 0
      ? 0
      : +(
          results.reduce((a, r) => a + r.evidenceStrength, 0) / results.length
        ).toFixed(2);
  const avgConfidence =
    results.length === 0
      ? 0
      : +(
          results.reduce((a, r) => a + r.evidenceConfidence, 0) / results.length
        ).toFixed(4);

  return {
    skills: results,
    metrics: {
      inputSkills: skills.length,
      outputSkills: results.length,
      strongSkills,
      moderateSkills,
      weakSkills,
      noEvidenceSkills,
      appliedEvidenceSkills,
      warningsCount: warnings.length,
      averageStrength: avgStrength,
      averageConfidence: avgConfidence,
    },
    warnings,
  };
}

function evaluateOneSkill(
  skill: EvidenceSkillInput,
  config: EvidenceEngineConfig,
  warnings: string[],
): EvidenceSkillMetrics {
  if (!skill.extractionSkillId || !skill.normalizedName) {
    throw new Error(
      `Evidence Engine: skill inválida enrichmentItemId=${skill.enrichmentItemId}`,
    );
  }

  const { all, unique, duplicateCount } = normalizeEvidenceItems(
    skill.evidenceItems || [],
    skill.normalizedName,
    config,
  );

  const sourceBreakdown: Record<string, number> = {};
  for (const item of unique) {
    sourceBreakdown[item.sourceType] =
      (sourceBreakdown[item.sourceType] || 0) + 1;
  }

  const sourceTypes = new Set<EvidenceSourceType>(
    unique.map((u) => u.sourceType),
  );
  const appliedCount = countApplied(unique, config);
  const substantiveCount = unique.filter((u) => u.isSubstantive).length;
  const ambiguousCount = unique.filter((u) => u.isAmbiguous).length;
  const listingCount = unique.filter((u) => u.isListing).length;

  const flags = computeQualityFlags({
    unique,
    duplicateCount,
    sourceTypes,
    appliedCount,
    substantiveCount,
    ambiguousCount,
    listingCount,
    config,
  });

  const strengthResult = computeEvidenceStrength({
    unique,
    flags,
    sourceTypes,
    appliedCount,
    duplicateCount,
    substantiveCount,
    config,
  });
  const confidenceResult = computeEvidenceConfidence({
    uniqueCount: unique.length,
    sourceDiversity: sourceTypes.size,
    appliedCount,
    substantiveCount,
    flags,
    config,
  });
  const level = resolveEvidenceLevel(
    strengthResult.strength,
    config,
    unique.length > 0,
    flags,
  );

  if (duplicateCount > 0) {
    warnings.push(
      `DUPLICATE_EVIDENCE:${skill.extractionSkillId}:${duplicateCount}`,
    );
  }

  const scoringBreakdown = {
    ...strengthResult.breakdown,
    confidence: confidenceResult.breakdown,
    algorithmVersion: config.algorithmVersion,
    rulesVersion: config.rulesVersion,
    sourceWeightVersion: config.sourceWeightVersion,
    rulesProfile: config.rulesProfile,
  };

  return {
    enrichmentItemId: skill.enrichmentItemId,
    extractionSkillId: skill.extractionSkillId,
    normalizedName: skill.normalizedName,
    evidenceCount: all.length,
    uniqueEvidenceCount: unique.length,
    appliedEvidenceCount: appliedCount,
    substantiveEvidenceCount: substantiveCount,
    listingEvidenceCount: listingCount,
    ambiguousEvidenceCount: ambiguousCount,
    sourceDiversity: sourceTypes.size,
    repeatedMentionCount: Math.max(0, all.length - unique.length),
    hasWorkExperience: sourceTypes.has('WORK_EXPERIENCE'),
    hasProject: sourceTypes.has('PROJECT'),
    hasAchievement: sourceTypes.has('ACHIEVEMENT'),
    hasResponsibility: sourceTypes.has('RESPONSIBILITY'),
    hasCertification: sourceTypes.has('CERTIFICATION'),
    hasEducation: sourceTypes.has('EDUCATION'),
    hasProfileSummary: sourceTypes.has('PROFILE_SUMMARY'),
    hasSkillsSection: sourceTypes.has('SKILLS_SECTION'),
    hasOther: sourceTypes.has('OTHER'),
    evidenceStrength: strengthResult.strength,
    evidenceConfidence: confidenceResult.confidence,
    evidenceLevel: level,
    qualityFlags: flags,
    sourceBreakdown,
    scoringBreakdown,
    explanation: buildEvidenceExplanation({
      level,
      flags,
      evidenceCount: all.length,
      uniqueEvidenceCount: unique.length,
      appliedEvidenceCount: appliedCount,
      substantiveEvidenceCount: substantiveCount,
      ambiguousEvidenceCount: ambiguousCount,
      sourceDiversity: sourceTypes.size,
      evidenceStrength: strengthResult.strength,
      rulesProfile: config.rulesProfile,
      noneReason: strengthResult.breakdown.noneReason as string | undefined,
    }),
  };
}
