/**
 * Cross-Domain Resolver v0 — función pura dry-run (CDR-0.1.0).
 * No escribe. No usa is_active / cargo / área. No publica.
 */

import type { McDomainQualification } from './mc-domain-qualification';
import {
  buildDomainAffinityVector,
  usableNumeric,
} from './mc-cross-domain-affinity';
import { assessEvaluationSetResolverEligibility } from './mc-cross-domain-resolver.eligibility';
import { DEFAULT_CDR_V0_POLICY } from './mc-cross-domain-resolver.policy';
import type {
  McCdrDecisionCode,
  McCdrDomainEvaluationSnapshot,
  McCrossDomainPosition,
  McCrossDomainResolution,
  McCrossDomainResolverInput,
  McCrossDomainResolverPolicy,
  McDomainAffinityVector,
  McProfessionalClassificationType,
  McResolutionConfidenceBand,
  McResolvedDomainPosition,
} from './mc-cross-domain-resolver.types';

const SUMMARY: Record<string, string> = {
  SINGLE_PRIMARY_REST_OUTSIDE:
    'Un único dominio PRIMARY_MATCH; el resto OUTSIDE. Práctica dominante provisional.',
  PRIMARY_WITH_SECONDARY_SUPPORT:
    'Un PRIMARY_MATCH con SECONDARY_SIGNAL subordinada; resto OUTSIDE.',
  MULTIPLE_PRIMARY_COMPARABLE:
    'Dos PRIMARY_MATCH con métricas similares. Híbrido provisional; independencia no verificada.',
  MULTIPLE_PRIMARY_UNBALANCED:
    'Dos PRIMARY_MATCH con desbalance en dimensiones normalizadas.',
  MULTIPLE_PRIMARY_UNRESOLVED:
    'Dos PRIMARY_MATCH sin métricas suficientes para distinguir.',
  THREE_PRIMARY_UNRESOLVED:
    'Tres o más PRIMARY_MATCH. Ambiguo en CDR v0.',
  ALL_SECONDARY_AMBIGUOUS:
    'Solo SECONDARY_SIGNAL. Señal débil multidominio; ambigüedad.',
  ALL_OUTSIDE: 'Todos OUTSIDE. Sin dominio soportado.',
  ALL_INSUFFICIENT:
    'Todos INSUFFICIENT_EVIDENCE. Evidencia global insuficiente.',
  MIXED_INSUFFICIENT_AND_OUTSIDE:
    'Mezcla INSUFFICIENT_EVIDENCE y OUTSIDE sin señales positivas.',
  PARTIAL_SET_NOT_ALLOWED: 'Evaluation Set PARTIAL no resoluble por defecto.',
  FAILED_DOMAIN_PRESENT: 'Hay dominio FAILED; no equivalente a OUTSIDE.',
  RUNNING_SET_NOT_ALLOWED: 'Set RUNNING no resoluble.',
  FAILED_SET_NOT_ALLOWED: 'Set FAILED no resoluble.',
  DUPLICATE_DOMAIN: 'Dominio duplicado en el set.',
  MISSING_CANDIDATE_OUTCOME: 'Falta outcome de un candidato.',
  INVALID_STRUCTURE: 'Estructura de Evaluation Set inválida.',
  QUALIFICATION_STRENGTH_CONFLICT:
    'PRIMARY_MATCH débil frente a SECONDARY_SIGNAL fuerte; no auto-promoción.',
  HYBRID_INDEPENDENCE_NOT_FULLY_VERIFIED:
    'Independencia de evidencia entre dominios no verificable en v0.',
  INSUFFICIENT_COMPARABLE_METRICS:
    'Dimensiones comparables insuficientes entre primarios.',
};

function sortDomains(
  domains: McCdrDomainEvaluationSnapshot[],
): McCdrDomainEvaluationSnapshot[] {
  return [...domains].sort((a, b) =>
    a.domainCode.toUpperCase().localeCompare(b.domainCode.toUpperCase()),
  );
}

function histogram(
  domains: McCdrDomainEvaluationSnapshot[],
): Record<string, number> {
  const h: Record<string, number> = {};
  for (const d of domains) {
    if (d.domainStatus !== 'SUCCEEDED') continue;
    const q = d.domainQualification ?? 'NULL';
    h[q] = (h[q] ?? 0) + 1;
  }
  return h;
}

function positionFor(
  domain: McCdrDomainEvaluationSnapshot,
  metrics: McDomainAffinityVector,
  position: McCrossDomainPosition,
  rank: number | null,
  reasons: string[],
): McResolvedDomainPosition {
  return {
    domainCode: domain.domainCode.toUpperCase(),
    qualification: domain.domainQualification,
    position,
    rank,
    reasons,
    metrics,
  };
}

function comparePrimaryPair(
  a: { domain: McCdrDomainEvaluationSnapshot; metrics: McDomainAffinityVector },
  b: { domain: McCdrDomainEvaluationSnapshot; metrics: McDomainAffinityVector },
  policy: McCrossDomainResolverPolicy,
): {
  mode: 'unbalanced' | 'comparable' | 'insufficient';
  winner?: string;
  loser?: string;
  comparableCount: number;
  aWins: number;
  bWins: number;
} {
  let aWins = 0;
  let bWins = 0;
  let comparableCount = 0;
  for (const key of policy.comparisonDimensions) {
    const av = usableNumeric(a.metrics[key]);
    const bv = usableNumeric(b.metrics[key]);
    if (av == null || bv == null) continue;
    comparableCount += 1;
    const denom = Math.max(Math.abs(av), Math.abs(bv), 1e-9);
    const rel = (av - bv) / denom;
    if (rel >= policy.dominanceMargin) aWins += 1;
    else if (rel <= -policy.dominanceMargin) bWins += 1;
  }
  if (comparableCount < policy.minimumComparableDimensions) {
    return { mode: 'insufficient', comparableCount, aWins, bWins };
  }
  if (aWins >= policy.minimumComparableDimensions && bWins === 0) {
    return {
      mode: 'unbalanced',
      winner: a.domain.domainCode.toUpperCase(),
      loser: b.domain.domainCode.toUpperCase(),
      comparableCount,
      aWins,
      bWins,
    };
  }
  if (bWins >= policy.minimumComparableDimensions && aWins === 0) {
    return {
      mode: 'unbalanced',
      winner: b.domain.domainCode.toUpperCase(),
      loser: a.domain.domainCode.toUpperCase(),
      comparableCount,
      aWins,
      bWins,
    };
  }
  return { mode: 'comparable', comparableCount, aWins, bWins };
}

function isWeakPrimary(metrics: McDomainAffinityVector): boolean {
  const ratio = usableNumeric(metrics.activeSpecialtyRatio);
  const best = usableNumeric(metrics.bestSpecialtyStrength);
  const cov = usableNumeric(metrics.evidenceCoverage);
  // PRIMARY mínimo: ratio baja y strength/coverage débiles
  const weakRatio = ratio != null && ratio <= 0.25;
  const weakBest = best != null && best < 40;
  const weakCov = cov != null && cov < 0.35;
  return (weakRatio && weakBest) || (weakRatio && weakCov) || (weakBest && weakCov);
}

function isStrongSecondary(metrics: McDomainAffinityVector): boolean {
  const best = usableNumeric(metrics.bestSpecialtyStrength);
  const cov = usableNumeric(metrics.evidenceCoverage);
  const conf = usableNumeric(metrics.evidenceConfidence);
  const strongBest = best != null && best >= 55;
  const strongCov = cov != null && cov >= 0.5;
  const strongConf = conf != null && conf >= 0.5;
  return (strongBest && strongCov) || (strongBest && strongConf);
}

function buildMaturityWarnings(
  enriched: Array<{
    domain: McCdrDomainEvaluationSnapshot;
    metrics: McDomainAffinityVector;
  }>,
): string[] {
  const w: string[] = [];
  const totals = enriched
    .map((e) => e.domain.specialtyCount)
    .filter((n): n is number => n != null && n > 0);
  if (totals.length >= 2) {
    const max = Math.max(...totals);
    const min = Math.min(...totals);
    if (max >= min * 2) {
      w.push('DOMAIN_CARDINALITY_IMBALANCE');
    }
  }
  for (const e of enriched) {
    const mapped = e.metrics.mappedEvidenceRatio;
    if (
      mapped.availability === 'DIAGNOSTIC_ONLY' &&
      mapped.value != null &&
      mapped.value < 0.25
    ) {
      w.push(`LOW_MAPPING_COVERAGE:${e.domain.domainCode.toUpperCase()}`);
    }
    const usableDims = Object.values(e.metrics).filter(
      (d) => d.availability === 'USABLE' && d.value != null,
    ).length;
    if (usableDims < 3) {
      w.push(
        `INSUFFICIENT_COMPARISON_DIMENSIONS:${e.domain.domainCode.toUpperCase()}`,
      );
    }
  }
  return [...new Set(w)];
}

function resolveEligible(
  set: McCrossDomainResolverInput['evaluationSet'],
  policy: McCrossDomainResolverPolicy,
  eligibility: ReturnType<typeof assessEvaluationSetResolverEligibility>,
): McCrossDomainResolution {
  const domains = sortDomains(set.domains).filter(
    (d) => d.domainStatus === 'SUCCEEDED',
  );
  const enriched = domains.map((domain) => ({
    domain,
    metrics: buildDomainAffinityVector(domain, policy),
  }));
  const hist = histogram(domains);
  const maturityWarnings = buildMaturityWarnings(enriched);

  const primaries = enriched.filter(
    (e) => e.domain.domainQualification === 'PRIMARY_MATCH',
  );
  const secondaries = enriched.filter(
    (e) => e.domain.domainQualification === 'SECONDARY_SIGNAL',
  );
  const outsides = enriched.filter(
    (e) => e.domain.domainQualification === 'OUTSIDE',
  );
  const insufficients = enriched.filter(
    (e) => e.domain.domainQualification === 'INSUFFICIENT_EVIDENCE',
  );

  // R7
  if (insufficients.length === domains.length && domains.length > 0) {
    return finish({
      set,
      policy,
      eligibility,
      hist,
      maturityWarnings,
      code: 'ALL_INSUFFICIENT',
      classification: 'INSUFFICIENT_EVIDENCE',
      confidence: 'NOT_APPLICABLE',
      status: 'RESOLVED',
      positions: enriched.map((e) =>
        positionFor(e.domain, e.metrics, 'INSUFFICIENT', null, [
          'ALL_INSUFFICIENT',
        ]),
      ),
      rejected: [
        { classificationType: 'NO_SUPPORTED_DOMAIN', reasonCodes: ['ALL_INSUFFICIENT'] },
      ],
      limitations: ['evidence_base_insufficient'],
      extraWarnings: maturityWarnings,
    });
  }

  // R8: insuficientes + outside, sin primary/secondary
  if (
    primaries.length === 0 &&
    secondaries.length === 0 &&
    insufficients.length > 0 &&
    outsides.length > 0 &&
    insufficients.length + outsides.length === domains.length
  ) {
    return finish({
      set,
      policy,
      eligibility,
      hist,
      maturityWarnings,
      code: 'MIXED_INSUFFICIENT_AND_OUTSIDE',
      classification: 'INSUFFICIENT_EVIDENCE',
      confidence: 'NOT_APPLICABLE',
      status: 'RESOLVED',
      positions: enriched.map((e) =>
        positionFor(
          e.domain,
          e.metrics,
          e.domain.domainQualification === 'OUTSIDE'
            ? 'NON_REPRESENTATIVE'
            : 'INSUFFICIENT',
          null,
          ['MIXED_INSUFFICIENT_AND_OUTSIDE'],
        ),
      ),
      rejected: [
        {
          classificationType: 'NO_SUPPORTED_DOMAIN',
          reasonCodes: ['MIXED_INSUFFICIENT_AND_OUTSIDE'],
        },
      ],
      limitations: ['cannot_confidently_exclude_domains'],
      extraWarnings: maturityWarnings,
    });
  }

  // R6
  if (outsides.length === domains.length && domains.length > 0) {
    return finish({
      set,
      policy,
      eligibility,
      hist,
      maturityWarnings,
      code: 'ALL_OUTSIDE',
      classification: 'NO_SUPPORTED_DOMAIN',
      confidence: 'NOT_APPLICABLE',
      status: 'RESOLVED',
      positions: enriched.map((e) =>
        positionFor(e.domain, e.metrics, 'NON_REPRESENTATIVE', null, [
          'ALL_OUTSIDE',
        ]),
      ),
      rejected: [],
      limitations: [],
      extraWarnings: maturityWarnings,
    });
  }

  // R5
  if (secondaries.length === domains.length && domains.length > 0) {
    return finish({
      set,
      policy,
      eligibility,
      hist,
      maturityWarnings,
      code: 'ALL_SECONDARY_AMBIGUOUS',
      classification: 'AMBIGUOUS',
      confidence: 'LOW',
      status: 'RESOLVED',
      positions: enriched.map((e, i) =>
        positionFor(e.domain, e.metrics, 'WEAK_SIGNAL', i + 1, [
          'ALL_SECONDARY_AMBIGUOUS',
        ]),
      ),
      rejected: [
        {
          classificationType: 'NO_SUPPORTED_DOMAIN',
          reasonCodes: ['SECONDARY_IS_NOT_ABSENCE'],
        },
      ],
      limitations: ['secondary_not_professional_classification'],
      extraWarnings: maturityWarnings,
    });
  }

  // R4
  if (primaries.length >= 3) {
    return finish({
      set,
      policy,
      eligibility,
      hist,
      maturityWarnings,
      code: 'THREE_PRIMARY_UNRESOLVED',
      classification: 'AMBIGUOUS',
      confidence: 'LOW',
      status: 'RESOLVED',
      positions: enriched.map((e) => {
        const isP = e.domain.domainQualification === 'PRIMARY_MATCH';
        return positionFor(
          e.domain,
          e.metrics,
          isP ? 'CO_DOMINANT' : 'NON_REPRESENTATIVE',
          isP ? 1 : null,
          ['THREE_PRIMARY_UNRESOLVED'],
        );
      }),
      rejected: [
        {
          classificationType: 'HYBRID_PRACTICE',
          reasonCodes: ['THREE_PRIMARY_TOO_AMBIGUOUS_V0'],
        },
      ],
      limitations: ['no_n_ary_hybrid_v0'],
      extraWarnings: maturityWarnings,
    });
  }

  // F12 / conflicto PRIMARY débil vs SECONDARY fuerte (antes de R1/R2 simples)
  if (primaries.length === 1 && secondaries.length >= 1) {
    const p = primaries[0];
    const strongSec = secondaries.filter((s) => isStrongSecondary(s.metrics));
    if (isWeakPrimary(p.metrics) && strongSec.length > 0) {
      return finish({
        set,
        policy,
        eligibility,
        hist,
        maturityWarnings,
        code: 'QUALIFICATION_STRENGTH_CONFLICT',
        classification: 'AMBIGUOUS',
        confidence: 'LOW',
        status: 'RESOLVED',
        positions: enriched.map((e) => {
          if (e.domain.domainCode === p.domain.domainCode) {
            return positionFor(e.domain, e.metrics, 'SUPPORTED', 1, [
              'WEAK_PRIMARY',
              'QUALIFICATION_STRENGTH_CONFLICT',
            ]);
          }
          if (
            strongSec.some(
              (s) => s.domain.domainCode === e.domain.domainCode,
            )
          ) {
            return positionFor(e.domain, e.metrics, 'SUPPORTED', 2, [
              'STRONG_SECONDARY',
              'QUALIFICATION_STRENGTH_CONFLICT',
            ]);
          }
          if (e.domain.domainQualification === 'SECONDARY_SIGNAL') {
            return positionFor(e.domain, e.metrics, 'WEAK_SIGNAL', null, [
              'SECONDARY',
            ]);
          }
          return positionFor(e.domain, e.metrics, 'NON_REPRESENTATIVE', null, [
            'OUTSIDE_OR_OTHER',
          ]);
        }),
        rejected: [
          {
            classificationType: 'DOMINANT_PRACTICE',
            reasonCodes: ['PRIMARY_LABEL_NOT_AUTO_WIN'],
          },
          {
            classificationType: 'PRIMARY_WITH_COMPLEMENTARY',
            reasonCodes: ['STRENGTH_CONFLICT'],
          },
        ],
        limitations: ['no_secondary_promotion_to_dominant_v0'],
        extraWarnings: [
          ...maturityWarnings,
          'QUALIFICATION_STRENGTH_CONFLICT',
        ],
      });
    }
  }

  // R3: dos PRIMARY
  if (primaries.length === 2) {
    const [a, b] = primaries;
    const cmp = comparePrimaryPair(a, b, policy);
    if (cmp.mode === 'insufficient') {
      return finish({
        set,
        policy,
        eligibility,
        hist,
        maturityWarnings,
        code: 'MULTIPLE_PRIMARY_UNRESOLVED',
        classification: 'AMBIGUOUS',
        confidence: 'LOW',
        status: 'RESOLVED',
        positions: enriched.map((e) => {
          const isP = e.domain.domainQualification === 'PRIMARY_MATCH';
          return positionFor(
            e.domain,
            e.metrics,
            isP ? 'CO_DOMINANT' : 'NON_REPRESENTATIVE',
            isP ? 1 : null,
            ['INSUFFICIENT_COMPARABLE_METRICS'],
          );
        }),
        rejected: [
          {
            classificationType: 'HYBRID_PRACTICE',
            reasonCodes: ['INSUFFICIENT_COMPARABLE_METRICS'],
          },
        ],
        limitations: ['INSUFFICIENT_COMPARABLE_METRICS'],
        extraWarnings: [
          ...maturityWarnings,
          'INSUFFICIENT_COMPARABLE_METRICS',
          'HYBRID_INDEPENDENCE_NOT_FULLY_VERIFIED',
        ],
      });
    }
    if (cmp.mode === 'unbalanced' && cmp.winner && cmp.loser) {
      return finish({
        set,
        policy,
        eligibility,
        hist,
        maturityWarnings,
        code: 'MULTIPLE_PRIMARY_UNBALANCED',
        classification: 'PRIMARY_WITH_COMPLEMENTARY',
        confidence: 'MEDIUM',
        status: 'RESOLVED',
        positions: enriched.map((e) => {
          const code = e.domain.domainCode.toUpperCase();
          if (code === cmp.winner) {
            return positionFor(e.domain, e.metrics, 'DOMINANT', 1, [
              'UNBALANCED_PRIMARY_WINNER',
            ]);
          }
          if (code === cmp.loser) {
            return positionFor(e.domain, e.metrics, 'COMPLEMENTARY', 2, [
              'UNBALANCED_PRIMARY_LOSER',
            ]);
          }
          return positionFor(e.domain, e.metrics, 'NON_REPRESENTATIVE', null, [
            'OUTSIDE_OR_OTHER',
          ]);
        }),
        rejected: [
          {
            classificationType: 'HYBRID_PRACTICE',
            reasonCodes: ['CLEAR_DOMINANCE_MARGIN'],
          },
          {
            classificationType: 'DOMINANT_PRACTICE',
            reasonCodes: ['SECOND_PRIMARY_STILL_SUPPORTED'],
          },
        ],
        limitations: ['HYBRID_INDEPENDENCE_NOT_FULLY_VERIFIED'],
        extraWarnings: [
          ...maturityWarnings,
          'HYBRID_INDEPENDENCE_NOT_FULLY_VERIFIED',
        ],
      });
    }
    // comparable → HYBRID conservador
    return finish({
      set,
      policy,
      eligibility,
      hist,
      maturityWarnings,
      code: 'MULTIPLE_PRIMARY_COMPARABLE',
      classification: 'HYBRID_PRACTICE',
      confidence: 'LOW',
      status: 'RESOLVED',
      positions: enriched.map((e) => {
        const isP = e.domain.domainQualification === 'PRIMARY_MATCH';
        return positionFor(
          e.domain,
          e.metrics,
          isP ? 'CO_DOMINANT' : 'NON_REPRESENTATIVE',
          isP ? 1 : null,
          ['MULTIPLE_PRIMARY_COMPARABLE'],
        );
      }),
      rejected: [
        {
          classificationType: 'DOMINANT_PRACTICE',
          reasonCodes: ['TWO_PRIMARY_NO_CLEAR_WINNER'],
        },
      ],
      limitations: ['HYBRID_INDEPENDENCE_NOT_FULLY_VERIFIED'],
      extraWarnings: [
        ...maturityWarnings,
        'HYBRID_INDEPENDENCE_NOT_FULLY_VERIFIED',
      ],
    });
  }

  // R1
  if (
    primaries.length === 1 &&
    secondaries.length === 0 &&
    outsides.length + insufficients.length === domains.length - 1
  ) {
    const p = primaries[0];
    return finish({
      set,
      policy,
      eligibility,
      hist,
      maturityWarnings,
      code: 'SINGLE_PRIMARY_REST_OUTSIDE',
      classification: 'DOMINANT_PRACTICE',
      confidence: 'HIGH',
      status: 'RESOLVED',
      positions: enriched.map((e) => {
        if (e.domain.domainCode === p.domain.domainCode) {
          return positionFor(e.domain, e.metrics, 'DOMINANT', 1, [
            'SINGLE_PRIMARY_REST_OUTSIDE',
          ]);
        }
        if (e.domain.domainQualification === 'INSUFFICIENT_EVIDENCE') {
          return positionFor(e.domain, e.metrics, 'INSUFFICIENT', null, [
            'INSUFFICIENT',
          ]);
        }
        return positionFor(e.domain, e.metrics, 'NON_REPRESENTATIVE', null, [
          'OUTSIDE',
        ]);
      }),
      rejected: [],
      limitations: [],
      extraWarnings: maturityWarnings,
    });
  }

  // R2
  if (primaries.length === 1 && secondaries.length >= 1) {
    const p = primaries[0];
    return finish({
      set,
      policy,
      eligibility,
      hist,
      maturityWarnings,
      code: 'PRIMARY_WITH_SECONDARY_SUPPORT',
      classification: 'PRIMARY_WITH_COMPLEMENTARY',
      confidence: 'MEDIUM',
      status: 'RESOLVED',
      positions: enriched.map((e) => {
        if (e.domain.domainCode === p.domain.domainCode) {
          return positionFor(e.domain, e.metrics, 'DOMINANT', 1, [
            'PRIMARY',
          ]);
        }
        if (e.domain.domainQualification === 'SECONDARY_SIGNAL') {
          return positionFor(e.domain, e.metrics, 'COMPLEMENTARY', 2, [
            'SECONDARY_SUPPORT',
          ]);
        }
        return positionFor(e.domain, e.metrics, 'NON_REPRESENTATIVE', null, [
          'OUTSIDE_OR_OTHER',
        ]);
      }),
      rejected: [
        {
          classificationType: 'DOMINANT_PRACTICE',
          reasonCodes: ['HAS_SECONDARY_SUPPORT'],
        },
      ],
      limitations: [],
      extraWarnings: maturityWarnings,
    });
  }

  // Fallback
  return finish({
    set,
    policy,
    eligibility,
    hist,
    maturityWarnings,
    code: 'INSUFFICIENT_COMPARABLE_METRICS',
    classification: 'AMBIGUOUS',
    confidence: 'LOW',
    status: 'RESOLVED',
    positions: enriched.map((e) =>
      positionFor(e.domain, e.metrics, 'NOT_COMPARABLE', null, [
        'FALLBACK_AMBIGUOUS',
      ]),
    ),
    rejected: [],
    limitations: ['unhandled_qualification_pattern'],
    extraWarnings: maturityWarnings,
  });
}

function finish(args: {
  set: McCrossDomainResolverInput['evaluationSet'];
  policy: McCrossDomainResolverPolicy;
  eligibility: ReturnType<typeof assessEvaluationSetResolverEligibility>;
  hist: Record<string, number>;
  maturityWarnings: string[];
  code: McCdrDecisionCode;
  classification: McProfessionalClassificationType;
  confidence: McResolutionConfidenceBand;
  status: 'RESOLVED' | 'UNRESOLVED';
  positions: McResolvedDomainPosition[];
  rejected: McCrossDomainResolution['explanation']['rejectedAlternatives'];
  limitations: string[];
  extraWarnings: string[];
}): McCrossDomainResolution {
  const warnings = [
    ...(args.set.warnings ?? []),
    ...args.eligibility.warnings,
    ...args.extraWarnings,
  ];
  const positions = [...args.positions].sort((a, b) =>
    a.domainCode.localeCompare(b.domainCode),
  );
  return {
    resolverVersion: args.policy.resolverVersion,
    policyVersion: args.policy.policyVersion,
    evaluationSetId: args.set.evaluationSetId,
    status: args.status,
    classificationType: args.classification,
    domainPositions: positions,
    confidenceBand: args.confidence,
    explanation: {
      summaryCode: args.code,
      summary: SUMMARY[args.code] ?? args.code,
      decisiveFactors: [
        { code: args.code, detail: SUMMARY[args.code] ?? args.code },
      ],
      supportingDomains: positions
        .filter((p) =>
          ['DOMINANT', 'CO_DOMINANT', 'COMPLEMENTARY', 'SUPPORTED'].includes(
            p.position,
          ),
        )
        .map((p) => ({
          domainCode: p.domainCode,
          position: p.position,
          qualification: p.qualification,
          reasonCodes: p.reasons,
        })),
      rejectedAlternatives: args.rejected,
      evidenceLimitations: args.limitations,
      warnings: [...warnings],
    },
    warnings: [...new Set(warnings)],
    decisiveRule: args.code,
    diagnostics: {
      eligibility: args.eligibility,
      qualificationHistogram: args.hist,
      maturityWarnings: args.maturityWarnings,
      independenceVerified: false,
    },
  };
}

/**
 * Núcleo puro del CDR v0. No I/O. No mutación. No is_active.
 */
export function resolveCrossDomainEvaluationSetDryRun(
  input: McCrossDomainResolverInput,
): McCrossDomainResolution {
  const policy = input.policy ?? DEFAULT_CDR_V0_POLICY;
  const set: McCrossDomainResolverInput['evaluationSet'] = {
    ...input.evaluationSet,
    candidateDomains: [...input.evaluationSet.candidateDomains]
      .map((c) => c.toUpperCase())
      .sort((a, b) => a.localeCompare(b)),
    domains: sortDomains(input.evaluationSet.domains),
  };

  const eligibility = assessEvaluationSetResolverEligibility(set, policy);
  if (!eligibility.eligible) {
    const code = (eligibility.code === 'ELIGIBLE'
      ? 'INVALID_STRUCTURE'
      : eligibility.code) as McCdrDecisionCode;
    return finish({
      set,
      policy,
      eligibility,
      hist: {},
      maturityWarnings: [],
      code,
      classification: 'UNRESOLVED',
      confidence: 'NOT_APPLICABLE',
      status: 'UNRESOLVED',
      positions: sortDomains(set.domains).map((d) =>
        positionFor(
          d,
          buildDomainAffinityVector(d, policy),
          'NOT_COMPARABLE',
          null,
          [code],
        ),
      ),
      rejected: [],
      limitations: eligibility.reasons,
      extraWarnings: [],
    });
  }

  return resolveEligible(set, policy, eligibility);
}

export function resolveCrossDomainEvaluationSetDryRunWithDefaults(
  evaluationSet: McCrossDomainResolverInput['evaluationSet'],
): McCrossDomainResolution {
  return resolveCrossDomainEvaluationSetDryRun({
    evaluationSet,
    policy: DEFAULT_CDR_V0_POLICY,
  });
}

/** Expuesto para tests: no usar is_active en decisión. */
export function cdrV0UsesIsActive(): boolean {
  return false;
}
