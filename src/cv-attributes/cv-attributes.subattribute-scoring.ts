import { diminishingFactorForRank } from './cv-attributes.config';
import {
  computeRawContribution,
  round2,
  round4,
} from './cv-attributes.contribution';
import { buildSubattributeExplanation } from './cv-attributes.explanation';
import { buildSubattributeFlags } from './cv-attributes.flags';
import { clampScore, clampUnit, resolveSupportLevel } from './cv-attributes.levels';
import type {
  AttributeCatalogSub,
  AttributeEngineConfig,
  AttributeMapping,
  AttributeSkillInput,
  AttributeSkillTrace,
  SubattributeResult,
} from './cv-attributes.types';

export interface SubattributeScoringInput {
  sub: AttributeCatalogSub;
  macroattributeId: string;
  macroattributeCode: string;
  /** Mappings activos del subatributo emparejados con la skill evaluada. */
  mapped: Array<{ mapping: AttributeMapping; skill: AttributeSkillInput }>;
  /** Nombres de skills cercanas declaradas como no mapeadas. */
  unmappedRelatedSkillNames: string[];
}

/**
 * Agregación de un subatributo.
 *
 * 1. rawContribution por mapping = strength × weight × levelFactor.
 * 2. Orden desc por rawContribution (desempate estable por nombre de skill).
 * 3. normalizedContribution = rawContribution × factor de rendimiento
 *    decreciente según posición (1.00 / 0.70 / 0.50 / 0.30 para 4ª y siguientes).
 * 4. weightedSupport = Σ normalizedContribution.
 * 5. score = clamp(0, maxSubattributeScore, weightedSupport).
 *
 * Diez skills WEAK no superan automáticamente a dos STRONG aplicadas porque
 * cada aporte adicional entra con factor 0.30 y con levelFactor 0.70.
 */
export function scoreSubattribute(
  input: SubattributeScoringInput,
  config: AttributeEngineConfig,
): SubattributeResult {
  const { sub, mapped } = input;

  const evaluated = mapped
    .map(({ mapping, skill }) => {
      const { levelFactor, rawContribution } = computeRawContribution(
        {
          evidenceStrength: skill.evidenceStrength,
          evidenceLevel: skill.evidenceLevel,
          mappingWeight: Number(mapping.weight),
        },
        config,
      );
      return { mapping, skill, levelFactor, rawContribution };
    })
    .sort(
      (a, b) =>
        b.rawContribution - a.rawContribution ||
        a.skill.normalizedName.localeCompare(b.skill.normalizedName) ||
        Number(a.skill.extractionSkillId) - Number(b.skill.extractionSkillId),
    );

  const contributingEntries = evaluated.filter((e) => e.rawContribution > 0);

  const traces: AttributeSkillTrace[] = [];
  let weightedSupport = 0;
  let contributionRank = 0;

  for (const entry of evaluated) {
    const isContributing = entry.rawContribution > 0;
    // El rank solo avanza con contribuciones reales: una skill NONE no consume
    // la posición 1 ni degrada a las siguientes.
    const rank = isContributing ? ++contributionRank : contributingEntries.length + 1;
    const factor = isContributing ? diminishingFactorForRank(config, rank) : 0;
    const normalized = round4(entry.rawContribution * factor);
    weightedSupport += normalized;

    traces.push({
      subattributeCode: sub.code,
      subattributeId: sub.id,
      mappingId: entry.mapping.id,
      skillId: entry.skill.skillId,
      extractionSkillId: entry.skill.extractionSkillId,
      evaluationItemId: entry.skill.evaluationItemId,
      normalizedName: entry.skill.normalizedName,
      mappingType: entry.mapping.mappingType,
      mappingWeight: Number(entry.mapping.weight),
      evidenceStrength: entry.skill.evidenceStrength,
      evidenceConfidence: entry.skill.evidenceConfidence,
      evidenceLevel: entry.skill.evidenceLevel,
      levelFactor: entry.levelFactor,
      rawContribution: entry.rawContribution,
      normalizedContribution: normalized,
      diminishingFactor: factor,
      contributionRank: rank,
    });
  }

  const score = round2(clampScore(weightedSupport, config.maxSubattributeScore));

  const target =
    sub.minimumSupportingSkills > 0
      ? sub.minimumSupportingSkills
      : config.defaultTargetSupportingSkills;
  const coverage = round4(
    clampUnit(contributingEntries.length / Math.max(1, target)),
  );

  const rawSum = contributingEntries.reduce(
    (acc, e) => acc + e.rawContribution,
    0,
  );
  const topContributionShare =
    rawSum > 0 ? round4(contributingEntries[0].rawContribution / rawSum) : 0;

  const confidence = computeSubattributeConfidence(
    {
      contributingEntries,
      rawSum,
      topContributionShare,
      mappingTypes: evaluated.map((e) => e.mapping.mappingType),
    },
    config,
  );

  const levels = contributingEntries.map((e) => e.skill.evidenceLevel);
  const flags = buildSubattributeFlags(
    {
      mappedSkillsCount: mapped.length,
      contributingSkillsCount: contributingEntries.length,
      coverage,
      confidence: confidence.final,
      topContributionShare,
      contributingLevels: levels,
      mappingTypes: evaluated.map((e) => e.mapping.mappingType),
      hasUnmappedRelatedSkills: input.unmappedRelatedSkillNames.length > 0,
    },
    config,
  );

  const level = resolveSupportLevel(score, config);
  const topSkillNames = contributingEntries.slice(0, 3).map((e) => e.skill.normalizedName);

  return {
    subattributeId: sub.id,
    subattributeCode: sub.code,
    subattributeName: sub.name,
    macroattributeId: input.macroattributeId,
    macroattributeCode: input.macroattributeCode,
    score,
    confidence: confidence.final,
    coverage,
    level,
    supportingSkillsCount: mapped.length,
    contributingSkillsCount: contributingEntries.length,
    strongSupportCount: levels.filter((l) => l === 'STRONG').length,
    moderateSupportCount: levels.filter((l) => l === 'MODERATE').length,
    weakSupportCount: levels.filter((l) => l === 'WEAK').length,
    noneSupportCount: evaluated.filter((e) => e.skill.evidenceLevel === 'NONE')
      .length,
    qualityFlags: flags,
    scoringBreakdown: {
      formula:
        'score = clamp(0, max, Σ(strength × mappingWeight × levelFactor × diminishingFactor(rank)))',
      diminishingFactors: [...config.diminishingFactors],
      targetSupportingSkills: target,
      weightedSupport: round4(weightedSupport),
      rawContributionSum: round4(rawSum),
      topContributionShare,
      cap: config.maxSubattributeScore,
      capApplied: weightedSupport > config.maxSubattributeScore,
      contributions: traces.map((t) => ({
        skill: t.normalizedName,
        mappingType: t.mappingType,
        mappingWeight: t.mappingWeight,
        evidenceLevel: t.evidenceLevel,
        evidenceStrength: t.evidenceStrength,
        levelFactor: t.levelFactor,
        rawContribution: t.rawContribution,
        diminishingFactor: t.diminishingFactor,
        normalizedContribution: t.normalizedContribution,
        rank: t.contributionRank,
        ignoredReason:
          t.rawContribution === 0
            ? t.evidenceLevel === 'NONE'
              ? 'EVIDENCE_LEVEL_NONE'
              : 'ZERO_STRENGTH'
            : null,
      })),
      confidence: confidence.breakdown,
      unmappedRelatedSkills: [...input.unmappedRelatedSkillNames],
    },
    explanation: buildSubattributeExplanation({
      level,
      contributingSkillsCount: contributingEntries.length,
      topSkillNames,
      flags,
    }),
    traces,
  };
}

interface SubattributeConfidenceInput {
  contributingEntries: Array<{
    skill: AttributeSkillInput;
    rawContribution: number;
    mapping: AttributeMapping;
  }>;
  rawSum: number;
  topContributionShare: number;
  mappingTypes: AttributeMapping['mappingType'][];
}

/**
 * Confidence del subatributo = fiabilidad de la agregación, no del nivel.
 *
 *   base    = Σ(evidenceConfidence × rawContribution) / Σ rawContribution
 *   + bonus por número de skills contribuyentes
 *   − penalty si una sola skill concentra ≥ concentrationThreshold del soporte
 *   − penalty si ningún mapping contribuyente es DIRECT
 *   − penalty si todos los mappings del subatributo son CONTEXTUAL
 */
function computeSubattributeConfidence(
  input: SubattributeConfidenceInput,
  config: AttributeEngineConfig,
): { final: number; breakdown: Record<string, unknown> } {
  const { contributingEntries, rawSum, topContributionShare } = input;
  const c = config.confidence;

  if (contributingEntries.length === 0 || rawSum <= 0) {
    return {
      final: 0,
      breakdown: {
        reason: 'NO_CONTRIBUTING_SKILLS',
        weightedAverage: 0,
        final: 0,
      },
    };
  }

  const weightedAverage = round4(
    contributingEntries.reduce(
      (acc, e) => acc + e.skill.evidenceConfidence * e.rawContribution,
      0,
    ) / rawSum,
  );

  let multiSkillBonus = 0;
  if (contributingEntries.length >= 3) {
    multiSkillBonus = c.multiSkillBonusThreePlus;
  } else if (contributingEntries.length === 2) {
    multiSkillBonus = c.multiSkillBonusTwo;
  }

  const concentrationPenalty =
    topContributionShare >= c.concentrationThreshold ? c.concentrationPenalty : 0;

  const contributingTypes = contributingEntries.map((e) => e.mapping.mappingType);
  const noDirectPenalty = contributingTypes.includes('DIRECT')
    ? 0
    : c.noDirectMappingPenalty;
  const contextualOnlyPenalty =
    input.mappingTypes.length > 0 &&
    input.mappingTypes.every((t) => t === 'CONTEXTUAL')
      ? c.contextualOnlyPenalty
      : 0;

  const final = round4(
    clampUnit(
      weightedAverage +
        multiSkillBonus -
        concentrationPenalty -
        noDirectPenalty -
        contextualOnlyPenalty,
    ),
  );

  return {
    final,
    breakdown: {
      weightedAverage,
      multiSkillBonus,
      concentrationPenalty,
      noDirectMappingPenalty: noDirectPenalty,
      contextualOnlyPenalty,
      topContributionShare,
      contributingSkills: contributingEntries.length,
      final,
    },
  };
}
