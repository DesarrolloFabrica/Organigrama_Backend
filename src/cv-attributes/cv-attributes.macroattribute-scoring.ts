import { round2, round4 } from './cv-attributes.contribution';
import { buildMacroattributeExplanation } from './cv-attributes.explanation';
import { buildMacroattributeFlags } from './cv-attributes.flags';
import { clampScore, clampUnit, resolveSupportLevel } from './cv-attributes.levels';
import type {
  AttributeCatalogMacro,
  AttributeEngineConfig,
  MacroattributeResult,
  SubattributeResult,
} from './cv-attributes.types';

/**
 * Agregación de macroatributo. Se calcula exclusivamente desde
 * cv_subattribute_result, nunca desde skills.
 *
 *   score = Σ(subScore × subWeight) / Σ(subWeight)   sobre subatributos con soporte
 *   coverage = subatributos con soporte / subatributos activos
 *
 * Se guardan tanto el promedio de los subatributos con soporte como el promedio
 * sobre el catálogo completo, para que coverage y score se lean por separado.
 */
export function scoreMacroattribute(
  macro: AttributeCatalogMacro,
  subResults: SubattributeResult[],
  config: AttributeEngineConfig,
): MacroattributeResult {
  const ordered = [...subResults].sort(
    (a, b) => b.score - a.score || a.subattributeCode.localeCompare(b.subattributeCode),
  );
  const supported = ordered.filter((s) => s.score > 0);
  const total = ordered.length;

  const weightOf = (code: string): number => {
    const declared = macro.subattributeWeights?.[code];
    return declared !== undefined && declared > 0 ? declared : 1;
  };

  const supportedWeightSum = supported.reduce(
    (acc, s) => acc + weightOf(s.subattributeCode),
    0,
  );
  const supportedAverage =
    supportedWeightSum > 0
      ? round4(
          supported.reduce(
            (acc, s) => acc + s.score * weightOf(s.subattributeCode),
            0,
          ) / supportedWeightSum,
        )
      : 0;

  const fullCatalogWeightSum = ordered.reduce(
    (acc, s) => acc + weightOf(s.subattributeCode),
    0,
  );
  const fullCatalogAverage =
    fullCatalogWeightSum > 0
      ? round4(
          ordered.reduce(
            (acc, s) => acc + s.score * weightOf(s.subattributeCode),
            0,
          ) / fullCatalogWeightSum,
        )
      : 0;

  const score = round2(
    clampScore(
      config.macro.supportedOnlyAverage ? supportedAverage : fullCatalogAverage,
      config.maxSubattributeScore,
    ),
  );

  const coverage = round4(clampUnit(total > 0 ? supported.length / total : 0));

  const scoreSum = supported.reduce((acc, s) => acc + s.score, 0);
  const topSubattributeShare =
    scoreSum > 0 ? round4(supported[0].score / scoreSum) : 0;

  const confidence = computeMacroConfidence(
    { supported, scoreSum, coverage },
    config,
  );

  const flags = buildMacroattributeFlags(
    {
      supportedSubattributesCount: supported.length,
      totalSubattributesCount: total,
      coverage,
      topSubattributeShare,
    },
    config,
  );

  const level = resolveSupportLevel(score, config);

  return {
    macroattributeId: macro.id,
    macroattributeCode: macro.code,
    macroattributeName: macro.name,
    score,
    confidence: confidence.final,
    coverage,
    level,
    supportedSubattributesCount: supported.length,
    totalSubattributesCount: total,
    qualityFlags: flags,
    scoringBreakdown: {
      formula:
        'score = Σ(subScore × subWeight) / Σ(subWeight) sobre subatributos con soporte',
      supportedOnlyAverage: config.macro.supportedOnlyAverage,
      supportedAverage,
      fullCatalogAverage,
      supportedWeightSum: round4(supportedWeightSum),
      topSubattributeShare,
      subattributeContributions: ordered.map((s) => ({
        code: s.subattributeCode,
        name: s.subattributeName,
        score: s.score,
        level: s.level,
        confidence: s.confidence,
        coverage: s.coverage,
        weight: weightOf(s.subattributeCode),
        supported: s.score > 0,
      })),
      confidence: confidence.breakdown,
    },
    explanation: buildMacroattributeExplanation({
      level,
      supportedSubattributesCount: supported.length,
      totalSubattributesCount: total,
      topSubattributeNames: supported.slice(0, 3).map((s) => s.subattributeName),
      flags,
    }),
  };
}

/**
 * Confidence de macroatributo:
 *
 *   base = Σ(subConfidence × subScore) / Σ subScore   (subatributos con soporte)
 *   − penalty si solo un subatributo aporta
 *   − penalty si coverage < lowCoverageThreshold
 */
function computeMacroConfidence(
  input: {
    supported: SubattributeResult[];
    scoreSum: number;
    coverage: number;
  },
  config: AttributeEngineConfig,
): { final: number; breakdown: Record<string, unknown> } {
  const { supported, scoreSum, coverage } = input;

  if (supported.length === 0 || scoreSum <= 0) {
    return {
      final: 0,
      breakdown: {
        reason: 'NO_SUPPORTED_SUBATTRIBUTES',
        weightedAverage: 0,
        final: 0,
      },
    };
  }

  const weightedAverage = round4(
    supported.reduce((acc, s) => acc + s.confidence * s.score, 0) / scoreSum,
  );

  const singleSubattributePenalty =
    supported.length === 1 ? config.macro.singleSubattributePenalty : 0;
  const lowCoveragePenalty =
    coverage < config.macro.lowCoverageThreshold
      ? config.macro.lowCoveragePenalty
      : 0;

  const final = round4(
    clampUnit(weightedAverage - singleSubattributePenalty - lowCoveragePenalty),
  );

  return {
    final,
    breakdown: {
      weightedAverage,
      singleSubattributePenalty,
      lowCoveragePenalty,
      coverage,
      supportedSubattributes: supported.length,
      final,
    },
  };
}
