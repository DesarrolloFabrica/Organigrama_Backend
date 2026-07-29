/**
 * Motor PA2 puro (sin I/O). Coverage / Confidence / Strength / presentation.
 */

import {
  computeMcPa2ConfigHash,
  type McPa2EngineConfig,
  type McPa2RankingStrategy,
} from './mc-pa2.config';
import type {
  McPa2EngineInput,
  McPa2EngineRunResult,
  McPa2SkillContribution,
  McPa2SpecialtyResult,
} from './mc-pa2.types';

export class McPa2EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McPa2EngineError';
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function runMcPa2Engine(input: McPa2EngineInput): McPa2EngineRunResult {
  if (!input.config?.engineRulesVersion?.trim()) {
    throw new McPa2EngineError('config.engineRulesVersion es obligatorio');
  }
  if (!input.domainCode?.trim()) {
    throw new McPa2EngineError('domainCode vacío');
  }
  if (!input.specialties.length) {
    throw new McPa2EngineError('El dominio no tiene especialidades');
  }

  const skillById = new Map(input.skills.map((s) => [s.skillId, s]));
  const mappingsBySpecialty = new Map<string, typeof input.mappings>();
  for (const m of input.mappings) {
    if (!(m.weight > 0 && m.weight <= 1)) {
      throw new McPa2EngineError(
        `Peso inválido ${m.weight} en skill ${m.skillId} → ${m.specialtyCode}`,
      );
    }
    const list = mappingsBySpecialty.get(m.specialtyCode) ?? [];
    list.push(m);
    mappingsBySpecialty.set(m.specialtyCode, list);
  }

  const weightSumBySkill = new Map<string, number>();
  for (const m of input.mappings) {
    weightSumBySkill.set(
      m.skillId,
      (weightSumBySkill.get(m.skillId) ?? 0) + m.weight,
    );
  }
  for (const [skillId, sum] of weightSumBySkill) {
    if (sum > 1.0001) {
      throw new McPa2EngineError(
        `Suma de pesos > 1 para skillId=${skillId}: ${sum}`,
      );
    }
  }

  const configHash = computeMcPa2ConfigHash(input.config);
  const warnings: string[] = [];
  const draftResults: McPa2SpecialtyResult[] = [];

  for (const specialty of [...input.specialties].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.specialtyCode.localeCompare(b.specialtyCode),
  )) {
    const maps = mappingsBySpecialty.get(specialty.specialtyCode) ?? [];
    const breakdown: McPa2SkillContribution[] = [];

    for (const m of maps) {
      const skill = skillById.get(m.skillId);
      if (!skill) continue;
      const evidenced = skill.evidenceLevel !== 'NONE';
      breakdown.push({
        skillId: skill.skillId,
        skillKey: skill.skillKey,
        skillName: skill.skillName,
        skillType: skill.skillType,
        mappingWeight: m.weight,
        mappingType: m.mappingType,
        evidenceLevel: skill.evidenceLevel,
        evidenceStrength: skill.evidenceStrength,
        evidenceConfidence: skill.evidenceConfidence,
        strengthContribution: evidenced
          ? skill.evidenceStrength * m.weight
          : 0,
        confidenceContribution: evidenced
          ? skill.evidenceConfidence * m.weight
          : null,
        evidenced,
      });
    }

    const mappedSkillCount = breakdown.length;
    const evidenced = breakdown.filter((b) => b.evidenced);
    const evidencedSkillCount = evidenced.length;

    const coverage =
      mappedSkillCount === 0 ? 0 : evidencedSkillCount / mappedSkillCount;

    const strengthWeightSum = evidenced.reduce((a, b) => a + b.mappingWeight, 0);
    const strength =
      strengthWeightSum === 0
        ? 0
        : evidenced.reduce((a, b) => a + b.strengthContribution, 0) /
          strengthWeightSum;

    const confidence =
      strengthWeightSum === 0
        ? 0
        : evidenced.reduce(
            (a, b) => a + (b.confidenceContribution ?? 0),
            0,
          ) / strengthWeightSum;

    const dominanceShare =
      strengthWeightSum === 0
        ? 0
        : Math.max(...evidenced.map((b) => b.mappingWeight), 0) /
          strengthWeightSum;

    const primaryStrongCount = breakdown.filter(
      (b) => b.mappingType === 'PRIMARY' && b.evidenceLevel === 'STRONG',
    ).length;

    const companionTypes = new Set(
      input.config.professionalCompanionSkillTypes ?? [
        'PROFESSIONAL_KNOWLEDGE',
        'METHODOLOGY',
      ],
    );
    const evidencedBreakdown = breakdown.filter((b) => b.evidenced);
    let professionalContribution = 0;
    let toolContribution = 0;
    let transversalContribution = 0;
    let professionalEvidencedCount = 0;
    for (const b of evidencedBreakdown) {
      if (companionTypes.has(b.skillType)) {
        professionalContribution += b.strengthContribution;
        professionalEvidencedCount += 1;
      } else if (b.skillType === 'TOOL') {
        toolContribution += b.strengthContribution;
      } else {
        transversalContribution += b.strengthContribution;
      }
    }

    const statusDecision = decidePresentationStatus({
      mappedSkillCount,
      evidencedSkillCount,
      coverage,
      strength,
      dominanceShare,
      primaryStrongCount,
      professionalEvidencedCount,
      config: input.config,
    });

    draftResults.push({
      specialtyId: specialty.specialtyId,
      specialtyCode: specialty.specialtyCode,
      specialtyName: specialty.specialtyName,
      lifecycleStatus: specialty.lifecycleStatus,
      presentationStatus: statusDecision.status,
      mappedSkillCount,
      evidencedSkillCount,
      coverage: round4(coverage),
      confidence: round4(confidence),
      strength: round2(strength),
      rank: 0,
      isDefault: false,
      rankingScore: 0,
      primaryStrongCount,
      dominanceShare: round4(dominanceShare),
      professionalContribution: round2(professionalContribution),
      toolContribution: round2(toolContribution),
      transversalContribution: round2(transversalContribution),
      professionalEvidencedCount,
      overrideApplied: statusDecision.overrideApplied,
      reasons: statusDecision.reasons,
      warnings: statusDecision.warnings,
      skillBreakdown: breakdown.sort(
        (a, b) =>
          b.strengthContribution - a.strengthContribution ||
          a.skillName.localeCompare(b.skillName),
      ),
    });
  }

  assignRankingScores(draftResults, input.config);
  const sorted = sortSpecialtyResults(
    draftResults,
    input.config.rankingStrategy ?? 'WEIGHTED_SCORE',
  );

  sorted.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  const active = sorted.filter((r) => r.presentationStatus === 'ACTIVE');
  let defaultSpecialtyCode: string | null = null;
  if (active.length > 0) {
    active[0].isDefault = true;
    defaultSpecialtyCode = active[0].specialtyCode;
  } else {
    warnings.push('NO_DEFAULT_SPECIALTY: ninguna especialidad ACTIVE');
  }

  const specialtyResults = [...sorted];

  return {
    domainCode: input.domainCode,
    engineRulesVersion: input.config.engineRulesVersion,
    configHash,
    specialtyResults,
    defaultSpecialtyCode,
    activeCount: specialtyResults.filter((r) => r.presentationStatus === 'ACTIVE')
      .length,
    emergentCount: specialtyResults.filter(
      (r) => r.presentationStatus === 'EMERGENT',
    ).length,
    hiddenCount: specialtyResults.filter((r) => r.presentationStatus === 'HIDDEN')
      .length,
    warnings,
  };
}

function assignRankingScores(
  results: McPa2SpecialtyResult[],
  config: McPa2EngineConfig,
): void {
  const strategy = config.rankingStrategy ?? 'WEIGHTED_SCORE';
  if (strategy === 'NORMALIZED_SCORE') {
    const maxStrength = Math.max(...results.map((r) => r.strength), 1);
    const maxEvidenced = Math.max(
      ...results.map((r) => r.evidencedSkillCount),
      1,
    );
    const maxPrimary = Math.max(
      ...results.map((r) => r.primaryStrongCount),
      1,
    );
    for (const r of results) {
      r.rankingScore = round4(
        computeNormalizedRankingScore({
          coverage: r.coverage,
          strengthNormalized: r.strength / maxStrength,
          confidence: r.confidence,
          evidenceMassNormalized: r.evidencedSkillCount / maxEvidenced,
          primaryNormalized: r.primaryStrongCount / maxPrimary,
          config,
        }),
      );
    }
    return;
  }

  for (const r of results) {
    r.rankingScore = round4(
      computeWeightedRankingScore({
        coverage: r.coverage,
        strength: r.strength,
        confidence: r.confidence,
        evidencedSkillCount: r.evidencedSkillCount,
        mappedSkillCount: r.mappedSkillCount,
        primaryStrongCount: r.primaryStrongCount,
        config,
      }),
    );
  }
}

/** Comparación lexicográfica funcional (MC1.5.2A). Exportada para tests. */
export function compareSpecialtyLexicographic(
  a: Pick<
    McPa2SpecialtyResult,
    | 'evidencedSkillCount'
    | 'coverage'
    | 'strength'
    | 'confidence'
    | 'primaryStrongCount'
    | 'mappedSkillCount'
    | 'specialtyCode'
  >,
  b: Pick<
    McPa2SpecialtyResult,
    | 'evidencedSkillCount'
    | 'coverage'
    | 'strength'
    | 'confidence'
    | 'primaryStrongCount'
    | 'mappedSkillCount'
    | 'specialtyCode'
  >,
): number {
  if (b.evidencedSkillCount !== a.evidencedSkillCount) {
    return b.evidencedSkillCount - a.evidencedSkillCount;
  }
  if (b.coverage !== a.coverage) return b.coverage - a.coverage;
  if (b.strength !== a.strength) return b.strength - a.strength;
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  if (b.primaryStrongCount !== a.primaryStrongCount) {
    return b.primaryStrongCount - a.primaryStrongCount;
  }
  if (b.mappedSkillCount !== a.mappedSkillCount) {
    return b.mappedSkillCount - a.mappedSkillCount;
  }
  return a.specialtyCode.localeCompare(b.specialtyCode);
}

function sortSpecialtyResults(
  results: McPa2SpecialtyResult[],
  strategy: McPa2RankingStrategy,
): McPa2SpecialtyResult[] {
  const statusOrder = { ACTIVE: 0, EMERGENT: 1, HIDDEN: 2 } as const;
  return [...results].sort((a, b) => {
    const so =
      statusOrder[a.presentationStatus] - statusOrder[b.presentationStatus];
    if (so !== 0) return so;

    if (strategy === 'LEXICOGRAPHIC') {
      return compareSpecialtyLexicographic(a, b);
    }

    if (b.rankingScore !== a.rankingScore) {
      return b.rankingScore - a.rankingScore;
    }
    return a.specialtyCode.localeCompare(b.specialtyCode);
  });
}

export function computeWeightedRankingScore(params: {
  coverage: number;
  strength: number;
  confidence: number;
  evidencedSkillCount: number;
  mappedSkillCount: number;
  primaryStrongCount: number;
  config: McPa2EngineConfig;
}): number {
  const w = params.config.ranking;
  return (
    params.coverage * w.coverageWeight +
    params.strength * w.strengthWeight +
    params.confidence * w.confidenceWeight +
    params.evidencedSkillCount * w.evidencedCountWeight +
    params.mappedSkillCount * w.mappedCountWeight +
    params.primaryStrongCount * w.primaryStrongCountWeight
  );
}

export function computeNormalizedRankingScore(params: {
  coverage: number;
  strengthNormalized: number;
  confidence: number;
  evidenceMassNormalized: number;
  primaryNormalized: number;
  config: McPa2EngineConfig;
}): number {
  const w = params.config.normalizedRanking ?? {
    coverageWeight: 30,
    strengthNormalizedWeight: 30,
    confidenceWeight: 20,
    evidenceMassWeight: 15,
    primaryContributionWeight: 5,
  };
  return (
    params.coverage * w.coverageWeight +
    params.strengthNormalized * w.strengthNormalizedWeight +
    params.confidence * w.confidenceWeight +
    params.evidenceMassNormalized * w.evidenceMassWeight +
    params.primaryNormalized * w.primaryContributionWeight
  );
}

function decidePresentationStatus(params: {
  mappedSkillCount: number;
  evidencedSkillCount: number;
  coverage: number;
  strength: number;
  dominanceShare: number;
  primaryStrongCount: number;
  professionalEvidencedCount: number;
  config: McPa2EngineConfig;
}): {
  status: 'ACTIVE' | 'EMERGENT' | 'HIDDEN';
  overrideApplied: boolean;
  reasons: string[];
  warnings: string[];
} {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const cfg = params.config;

  if (params.mappedSkillCount === 0) {
    return {
      status: 'HIDDEN',
      overrideApplied: false,
      reasons: ['HIDDEN: mappedSkillCount = 0'],
      warnings,
    };
  }
  if (params.evidencedSkillCount === 0) {
    return {
      status: 'HIDDEN',
      overrideApplied: false,
      reasons: [
        'HIDDEN: evidencedSkillCount = 0',
        `mappedSkillCount = ${params.mappedSkillCount}`,
      ],
      warnings,
    };
  }

  if (
    cfg.requireProfessionalCompanionForVisible &&
    params.professionalEvidencedCount < 1
  ) {
    return {
      status: 'HIDDEN',
      overrideApplied: false,
      reasons: [
        'HIDDEN: anti-tool — sin acompañamiento profesional evidenciado',
        `tool/transversal evidenced=${params.evidencedSkillCount}`,
      ],
      warnings,
    };
  }

  const meetsCoverage = params.coverage >= cfg.activeCoverageThreshold;
  const meetsMapped = params.mappedSkillCount >= cfg.minimumMappedSkills;
  const meetsEvidenced =
    params.evidencedSkillCount >= cfg.minimumEvidencedSkills;
  const meetsStrength =
    cfg.minimumActiveStrength == null ||
    params.strength >= cfg.minimumActiveStrength;
  const concentrated =
    params.dominanceShare >= cfg.singleSkillDominanceThreshold;

  const ov = cfg.strongEvidenceLowCardinalityOverride;
  const overrideEligible =
    ov.enabled &&
    params.mappedSkillCount <= ov.maxMappedSkills &&
    params.evidencedSkillCount <= ov.maxEvidencedSkills &&
    params.strength >= ov.minAggregatedStrength &&
    (!ov.requirePrimaryStrong || params.primaryStrongCount >= 1);

  if (
    meetsCoverage &&
    meetsMapped &&
    meetsEvidenced &&
    meetsStrength &&
    !concentrated
  ) {
    reasons.push(
      `ACTIVE: coverage ${round4(params.coverage)} >= ${cfg.activeCoverageThreshold}`,
    );
    reasons.push(
      `mappedSkillCount ${params.mappedSkillCount} >= ${cfg.minimumMappedSkills}`,
    );
    reasons.push(
      `evidencedSkillCount ${params.evidencedSkillCount} >= ${cfg.minimumEvidencedSkills}`,
    );
    if (cfg.minimumActiveStrength != null) {
      reasons.push(
        `strength ${round2(params.strength)} >= ${cfg.minimumActiveStrength}`,
      );
    }
    reasons.push(
      `dominanceShare ${round4(params.dominanceShare)} < ${cfg.singleSkillDominanceThreshold}`,
    );
    if (cfg.requireProfessionalCompanionForVisible) {
      reasons.push(
        `professionalEvidencedCount ${params.professionalEvidencedCount} >= 1`,
      );
    }
    return { status: 'ACTIVE', overrideApplied: false, reasons, warnings };
  }

  if (overrideEligible) {
    reasons.push('ACTIVE_WITH_CAUTION: strongEvidenceLowCardinalityOverride');
    reasons.push(
      `strength ${round2(params.strength)} >= ${ov.minAggregatedStrength}`,
    );
    reasons.push(
      `low cardinality mapped=${params.mappedSkillCount} evidenced=${params.evidencedSkillCount}`,
    );
    warnings.push(
      'LOW_CARDINALITY_STRONG_EVIDENCE: especialidad activa con lectura cautelosa',
    );
    return { status: 'ACTIVE', overrideApplied: true, reasons, warnings };
  }

  if (!meetsCoverage) {
    reasons.push(
      `EMERGENT: coverage ${round4(params.coverage)} < ${cfg.activeCoverageThreshold}`,
    );
  }
  if (!meetsMapped) {
    reasons.push(
      `EMERGENT: mappedSkillCount ${params.mappedSkillCount} < ${cfg.minimumMappedSkills}`,
    );
  }
  if (!meetsEvidenced) {
    reasons.push(
      `EMERGENT: evidencedSkillCount ${params.evidencedSkillCount} < ${cfg.minimumEvidencedSkills}`,
    );
  }
  if (!meetsStrength && cfg.minimumActiveStrength != null) {
    reasons.push(
      `EMERGENT: strength ${round2(params.strength)} < ${cfg.minimumActiveStrength}`,
    );
  }
  if (concentrated) {
    reasons.push(
      `EMERGENT: single-skill dominance ${round4(params.dominanceShare)} >= ${cfg.singleSkillDominanceThreshold}`,
    );
  }
  if (reasons.length === 0) {
    reasons.push('EMERGENT: evidencia insuficiente para ACTIVE');
  }

  return { status: 'EMERGENT', overrideApplied: false, reasons, warnings };
}
