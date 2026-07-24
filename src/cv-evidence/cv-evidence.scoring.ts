import type { EvidenceSourceType } from '../cv-skills/cv-skills.types';
import { isAppliedSource } from './cv-evidence.config';
import type {
  EvidenceEngineConfig,
  EvidenceLevel,
  EvidenceQualityFlag,
  NormalizedEvidenceItem,
} from './cv-evidence.types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function computeSourceContribution(
  unique: NormalizedEvidenceItem[],
  config: EvidenceEngineConfig,
): {
  contribution: number;
  perSource: Record<string, number>;
  perItem: Array<Record<string, unknown>>;
  decay: number;
} {
  const byType = new Map<EvidenceSourceType, NormalizedEvidenceItem[]>();
  for (const item of unique) {
    const list = byType.get(item.sourceType) || [];
    list.push(item);
    byType.set(item.sourceType, list);
  }

  const decay = config.sameSourceDecay;
  const perItem: Array<Record<string, unknown>> = [];
  let sum = 0;
  const perSource: Record<string, number> = {};

  for (const [sourceType, items] of byType) {
    const weight = config.sourceWeights[sourceType] ?? 0;
    let typeSum = 0;
    items.forEach((item, idx) => {
      const factor = Math.pow(decay, idx);
      const raw = weight * factor;
      typeSum += raw;
      perItem.push({
        sourceType,
        indexInSource: idx,
        decayFactor: factor,
        weight,
        contribution: round2(raw),
        isSubstantive: item.isSubstantive,
        isAmbiguous: item.isAmbiguous,
      });
    });
    const typeCap = config.sourceTypeCaps?.[sourceType];
    const cappedType =
      typeCap != null ? Math.min(typeSum, typeCap) : typeSum;
    perSource[sourceType] = round2(cappedType);
    if (typeCap != null && typeSum > typeCap) {
      perSource[`${sourceType}_beforeCap`] = round2(typeSum);
    }
    sum += cappedType;
  }

  const capped = Math.min(sum, config.caps.maxEvidenceContribution);
  return {
    contribution: round2(capped),
    perSource,
    perItem,
    decay,
  };
}

export function computeDiversityContribution(
  sourceDiversity: number,
  config: EvidenceEngineConfig,
): number {
  if (sourceDiversity <= 1) return 0;
  const raw = (sourceDiversity - 1) * 5;
  return Math.min(raw, config.caps.maxDiversityContribution);
}

export function computeAppliedContribution(
  appliedCount: number,
  config: EvidenceEngineConfig,
): number {
  if (appliedCount <= 0) return 0;
  const raw = 10 + (appliedCount - 1) * 2.5;
  return Math.min(raw, config.caps.maxAppliedContribution);
}

export function computePenalties(params: {
  flags: EvidenceQualityFlag[];
  unique: NormalizedEvidenceItem[];
  sourceTypes: Set<EvidenceSourceType>;
  duplicateCount: number;
  config: EvidenceEngineConfig;
}): { total: number; detail: Record<string, number> } {
  const { flags, unique, sourceTypes, duplicateCount, config } = params;
  const detail: Record<string, number> = {};

  if (flags.includes('ONLY_SKILLS_SECTION')) {
    detail.onlySkillsSection = -config.penalties.onlySkillsSection;
  }
  if (flags.includes('ONLY_PROFILE_SUMMARY')) {
    detail.onlyProfileSummary = -config.penalties.onlyProfileSummary;
  }
  if (
    flags.includes('GENERIC_EVIDENCE') ||
    (flags.includes('NAME_ONLY_EVIDENCE') && config.rulesProfile === 'er1')
  ) {
    detail.genericText = -config.penalties.genericText;
  }
  if (flags.includes('SHORT_EVIDENCE')) {
    detail.shortText = -config.penalties.shortText;
  }
  if (duplicateCount > 0) {
    detail.duplicates = -config.penalties.duplicates;
  }
  const otherCount = unique.filter((u) => u.sourceType === 'OTHER').length;
  if (
    sourceTypes.has('OTHER') &&
    (sourceTypes.size === 1 || otherCount >= unique.length / 2)
  ) {
    detail.otherHeavy = -config.penalties.otherHeavy;
  }

  if (config.rulesProfile === 'er2') {
    if (
      flags.includes('NAME_ONLY_EVIDENCE') &&
      config.penalties.nameOnly != null
    ) {
      detail.nameOnly = -config.penalties.nameOnly;
    }
    if (
      flags.includes('ONLY_AMBIGUOUS_EVIDENCE') &&
      config.penalties.onlyAmbiguous != null
    ) {
      detail.onlyAmbiguous = -config.penalties.onlyAmbiguous;
    }
  }

  const total = Object.values(detail).reduce((a, b) => a + b, 0);
  return { total, detail };
}

export function computeEvidenceStrength(params: {
  unique: NormalizedEvidenceItem[];
  flags: EvidenceQualityFlag[];
  sourceTypes: Set<EvidenceSourceType>;
  appliedCount: number;
  duplicateCount: number;
  substantiveCount: number;
  config: EvidenceEngineConfig;
}): {
  strength: number;
  breakdown: Record<string, unknown>;
} {
  const {
    unique,
    flags,
    sourceTypes,
    appliedCount,
    duplicateCount,
    substantiveCount,
    config,
  } = params;

  if (unique.length === 0) {
    return {
      strength: 0,
      breakdown: {
        sourceContribution: 0,
        diversityContribution: 0,
        appliedContribution: 0,
        penalties: {},
        rawScore: 0,
        finalScore: 0,
        noneReason: 'NO_EVIDENCE',
      },
    };
  }

  const source = computeSourceContribution(unique, config);
  const diversity = computeDiversityContribution(sourceTypes.size, config);
  const applied = computeAppliedContribution(appliedCount, config);
  const penalties = computePenalties({
    flags,
    unique,
    sourceTypes,
    duplicateCount,
    config,
  });

  const rawScore = round2(
    source.contribution + diversity + applied + penalties.total,
  );
  let afterPenalties = round2(clamp(rawScore, 0, 100));

  const strengthCapDetail: Record<string, unknown> = {};
  const hasApplied = appliedCount > 0;
  if (config.strengthCaps && !hasApplied) {
    const caps = config.strengthCaps;
    if (flags.includes('ONLY_AMBIGUOUS_EVIDENCE')) {
      const before = afterPenalties;
      afterPenalties = Math.min(afterPenalties, caps.onlyAmbiguousMaxStrength);
      strengthCapDetail.onlyAmbiguous = {
        before,
        max: caps.onlyAmbiguousMaxStrength,
        after: afterPenalties,
      };
    } else if (flags.includes('ONLY_LISTING_EVIDENCE')) {
      const before = afterPenalties;
      afterPenalties = Math.min(afterPenalties, caps.onlyListingMaxStrength);
      strengthCapDetail.onlyListing = {
        before,
        max: caps.onlyListingMaxStrength,
        after: afterPenalties,
      };
    } else if (substantiveCount === 0) {
      const before = afterPenalties;
      afterPenalties = Math.min(
        afterPenalties,
        caps.noAppliedNoSubstantiveMaxStrength,
      );
      strengthCapDetail.noAppliedNoSubstantive = {
        before,
        max: caps.noAppliedNoSubstantiveMaxStrength,
        after: afterPenalties,
      };
    }
  }

  let finalScore = round2(clamp(afterPenalties, 0, 100));

  // er1 floor (congelado). er2: sin floor.
  let flooredToMinWeak = false;
  if (config.applyMinWeakFloor && unique.length > 0 && finalScore < 1) {
    flooredToMinWeak = true;
    finalScore = 1;
  }

  const noneReason =
    finalScore <= 0
      ? flags.includes('ONLY_AMBIGUOUS_EVIDENCE')
        ? 'STRENGTH_ZERO_ONLY_AMBIGUOUS'
        : flags.includes('NO_EVIDENCE')
          ? 'NO_EVIDENCE'
          : 'STRENGTH_ZERO_AFTER_PENALTIES_OR_CAPS'
      : undefined;

  return {
    strength: finalScore,
    breakdown: {
      sourceContribution: source.contribution,
      sourceContributionDetail: source.perSource,
      sourceContributionPerItem: source.perItem,
      sameSourceDecay: source.decay,
      diversityContribution: diversity,
      appliedContribution: applied,
      penalties: penalties.detail,
      rawScore,
      strengthCapsApplied: strengthCapDetail,
      flooredToMinWeak,
      finalScore,
      ...(noneReason ? { noneReason } : {}),
    },
  };
}

export function computeEvidenceConfidence(params: {
  uniqueCount: number;
  sourceDiversity: number;
  appliedCount: number;
  substantiveCount: number;
  flags: EvidenceQualityFlag[];
  config: EvidenceEngineConfig;
}): {
  confidence: number;
  breakdown: Record<string, unknown>;
} {
  const {
    uniqueCount,
    sourceDiversity,
    appliedCount,
    substantiveCount,
    flags,
    config,
  } = params;
  const parts: Record<string, number> = {};

  if (flags.includes('NO_EVIDENCE')) {
    return {
      confidence: 0.95,
      breakdown: { parts: { clearNoEvidence: 0.95 }, final: 0.95 },
    };
  }

  let c = 0.6;
  parts.base = 0.6;

  if (config.rulesProfile === 'er2') {
    if (flags.includes('ONLY_AMBIGUOUS_EVIDENCE')) {
      // caso B: ambigüedad → 0.40–0.60
      c = 0.5;
      parts.ambiguousCase = 0.5;
      if (flags.includes('NAME_ONLY_EVIDENCE')) {
        parts.nameOnlyDrag = -0.08;
        c -= 0.08;
      }
      const confidence = Math.round(clamp(c, 0.4, 0.6) * 10000) / 10000;
      return { confidence, breakdown: { parts, final: confidence } };
    }

    if (
      flags.includes('ONLY_SKILLS_SECTION') ||
      flags.includes('ONLY_LISTING_EVIDENCE')
    ) {
      // caso A: listado claro
      c = 0.82;
      parts.clearListing = 0.82;
      const confidence = Math.round(clamp(c, 0.75, 0.9) * 10000) / 10000;
      return { confidence, breakdown: { parts, final: confidence } };
    }

    if (appliedCount > 0 && substantiveCount > 0) {
      c = 0.78;
      parts.appliedSubstantive = 0.78;
      if (sourceDiversity >= 2) {
        parts.diversity = 0.08;
        c += 0.08;
      }
      const confidence = Math.round(clamp(c, 0, 1) * 10000) / 10000;
      return { confidence, breakdown: { parts, final: confidence } };
    }
  }

  // er1 / fallback genérico
  if (
    flags.includes('ONLY_SKILLS_SECTION') ||
    flags.includes('ONLY_PROFILE_SUMMARY')
  ) {
    parts.clearListing = 0.2;
    c += 0.2;
  }
  if (uniqueCount >= 2) {
    parts.multipleEvidence = 0.08;
    c += 0.08;
  }
  if (sourceDiversity >= 2) {
    parts.diversity = 0.08;
    c += 0.08;
  }
  if (appliedCount > 0) {
    parts.applied = 0.1;
    c += 0.1;
  }
  if (flags.includes('NAME_ONLY_EVIDENCE')) {
    parts.nameOnlyAmbiguity = -0.2;
    c -= 0.2;
  }
  if (
    flags.includes('GENERIC_EVIDENCE') &&
    !flags.includes('NAME_ONLY_EVIDENCE')
  ) {
    parts.genericAmbiguity = -0.1;
    c -= 0.1;
  }
  if (flags.includes('SHORT_EVIDENCE') && flags.includes('NAME_ONLY_EVIDENCE')) {
    parts.shortNameOnly = -0.05;
    c -= 0.05;
  }
  if (flags.includes('DUPLICATE_EVIDENCE')) {
    parts.duplicates = -0.03;
    c -= 0.03;
  }
  if (flags.includes('AMBIGUOUS_EVIDENCE') && config.rulesProfile === 'er2') {
    parts.ambiguousPartial = -0.08;
    c -= 0.08;
  }

  const confidence = Math.round(clamp(c, 0, 1) * 10000) / 10000;
  return { confidence, breakdown: { parts, final: confidence } };
}

export function resolveEvidenceLevel(
  strength: number,
  config: EvidenceEngineConfig,
  hasEvidence: boolean,
  flags: EvidenceQualityFlag[] = [],
): EvidenceLevel {
  if (!hasEvidence) return 'NONE';
  if (strength <= 0) {
    // er2: strength 0 con citas ambiguas ⇒ NONE (explicado en breakdown)
    return 'NONE';
  }
  // er1 floor ensures strength>=1 when has evidence
  void flags;
  if (strength <= config.thresholds.weakMax) return 'WEAK';
  if (strength <= config.thresholds.moderateMax) return 'MODERATE';
  return 'STRONG';
}

export function countApplied(
  unique: NormalizedEvidenceItem[],
  config: EvidenceEngineConfig,
): number {
  return unique.filter((u) => isAppliedSource(config, u.sourceType)).length;
}
