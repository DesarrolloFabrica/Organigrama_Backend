/**
 * Affinity Vector v0 — solo métricas disponibles en Evaluation Set / specialty results.
 */

import type { McDomainQualification } from './mc-domain-qualification';
import type {
  McAffinityDimension,
  McCdrDomainEvaluationSnapshot,
  McCdrSpecialtySnapshot,
  McCrossDomainResolverPolicy,
  McDomainAffinityVector,
} from './mc-cross-domain-resolver.types';

function dim(
  value: number | null,
  availability: McAffinityDimension['availability'],
  normalization: string | null,
  source: string,
  warning: string | null = null,
): McAffinityDimension {
  return { value, availability, normalization, source, warning };
}

function na(source: string, warning?: string): McAffinityDimension {
  return dim(null, 'NOT_AVAILABLE', null, source, warning ?? null);
}

function qualificationLevel(
  q: McDomainQualification | null,
): McAffinityDimension {
  if (!q) {
    return dim(null, 'NOT_AVAILABLE', null, 'domainQualification', 'null');
  }
  const map: Record<McDomainQualification, number> = {
    PRIMARY_MATCH: 3,
    SECONDARY_SIGNAL: 2,
    OUTSIDE: 1,
    INSUFFICIENT_EVIDENCE: 0,
  };
  return dim(
    map[q],
    'USABLE',
    'ordinal_0_3',
    'domainQualification',
    null,
  );
}

function safeRatio(num: number, den: number): number | null {
  if (den <= 0) return null;
  return num / den;
}

function parseSpecialties(
  specs: McCdrSpecialtySnapshot[],
): McCdrSpecialtySnapshot[] {
  return [...specs].sort(
    (a, b) => b.strength - a.strength || a.specialtyCode.localeCompare(b.specialtyCode),
  );
}

export function buildDomainAffinityVector(
  domain: McCdrDomainEvaluationSnapshot,
  policy: McCrossDomainResolverPolicy,
): McDomainAffinityVector {
  const specs = parseSpecialties(domain.specialties ?? []);
  const active = domain.activeCount;
  const emergent = domain.emergentCount;
  const hidden = domain.hiddenCount;
  const total =
    domain.specialtyCount ??
    (active != null && emergent != null && hidden != null
      ? active + emergent + hidden
      : specs.length || null);

  const activeRatio =
    active != null && total != null ? safeRatio(active, total) : null;

  const best = specs[0]?.strength ?? null;
  const k = policy.topK;
  const top = specs.slice(0, k);
  const topKAvg =
    top.length > 0
      ? top.reduce((s, x) => s + x.strength, 0) / top.length
      : null;

  const coverages = specs.map((s) => s.coverage).filter((n) => Number.isFinite(n));
  const confidences = specs
    .map((s) => s.confidence)
    .filter((n) => Number.isFinite(n));
  const avgCoverage =
    coverages.length > 0
      ? coverages.reduce((a, b) => a + b, 0) / coverages.length
      : null;
  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : null;

  let mappedRatio: number | null = null;
  let mappedAvail: McAffinityDimension['availability'] = 'NOT_AVAILABLE';
  let mappedWarn: string | null = 'requires_specialty_skill_counts';
  if (specs.length > 0) {
    const mapped = specs.reduce((s, x) => s + x.mappedSkillCount, 0);
    const evidenced = specs.reduce((s, x) => s + x.evidencedSkillCount, 0);
    mappedRatio = safeRatio(evidenced, mapped);
    mappedAvail = mapped > 0 ? 'DIAGNOSTIC_ONLY' : 'NOT_AVAILABLE';
    mappedWarn =
      mapped === 0 ? 'zero_mapped_skills' : 'not_cross_domain_normalized';
  }

  return {
    qualificationLevel: qualificationLevel(domain.domainQualification),
    activeSpecialtyCount: dim(
      active,
      active == null ? 'NOT_AVAILABLE' : 'DIAGNOSTIC_ONLY',
      'raw_count_not_cross_domain',
      'activeCount',
      active == null ? null : 'NOT_COMPARABLE_raw_use_ratio',
    ),
    emergentSpecialtyCount: dim(
      emergent,
      emergent == null ? 'NOT_AVAILABLE' : 'DIAGNOSTIC_ONLY',
      'raw_count',
      'emergentCount',
      null,
    ),
    hiddenSpecialtyCount: dim(
      hidden,
      hidden == null ? 'NOT_AVAILABLE' : 'DIAGNOSTIC_ONLY',
      'raw_count',
      'hiddenCount',
      null,
    ),
    activeSpecialtyRatio: dim(
      activeRatio,
      activeRatio == null ? 'NOT_AVAILABLE' : 'USABLE',
      'active/specialtyCount',
      'activeCount+specialtyCount',
      total === 0 ? 'zero_denominator' : null,
    ),
    bestSpecialtyStrength: dim(
      best,
      best == null ? 'NOT_AVAILABLE' : 'USABLE',
      'max_strength_0_100',
      'specialtyResults.strength',
      null,
    ),
    topKSpecialtyStrength: dim(
      topKAvg,
      topKAvg == null ? 'NOT_AVAILABLE' : 'USABLE',
      `avg_top_${k}_strength`,
      'specialtyResults.strength',
      null,
    ),
    evidenceCoverage: dim(
      avgCoverage,
      avgCoverage == null ? 'NOT_AVAILABLE' : 'USABLE',
      'mean_specialty_coverage',
      'specialtyResults.coverage',
      null,
    ),
    mappedEvidenceRatio: dim(
      mappedRatio,
      mappedAvail,
      'evidenced/mapped_across_specialties',
      'specialtyResults.counts',
      mappedWarn,
    ),
    evidenceQuality: na(
      'qualityTier',
      'NOT_AVAILABLE_on_evaluation_set_snapshot',
    ),
    evidenceConfidence: dim(
      avgConfidence,
      avgConfidence == null ? 'NOT_AVAILABLE' : 'USABLE',
      'mean_specialty_confidence',
      'specialtyResults.confidence',
      null,
    ),
    unmappedEvidenceRatio: na(
      'unmappedEvidence',
      'NOT_AVAILABLE_requires_inventory_minus_mapped',
    ),
  };
}

export function usableNumeric(
  d: McAffinityDimension,
): number | null {
  if (d.availability !== 'USABLE' || d.value == null || !Number.isFinite(d.value)) {
    return null;
  }
  return d.value;
}
