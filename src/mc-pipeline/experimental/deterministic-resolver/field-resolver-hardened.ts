/**
 * Field resolver hardened.
 * Default = Candidate.1 / policy 0.2.0. Candidate.2 pasa policy 0.3.0.
 * No sustituye al prototipo v1. No se importa desde runners productivos.
 */
import { compileFieldLexicon } from './catalog-lexicon';
import { isOriginKind, isReinforceKind } from './evidence';
import {
  competitorOf,
  EXPERIMENTAL_RESOLVER_POLICY,
  type ExperimentalResolverPolicy,
} from './experimental-policy';
import { independentSourceCount } from './independence';
import { matchUnitToField, strengthFromOriginCount } from './match';
import {
  differentialHits,
  fieldAliasHits,
  otherField,
  sharedPracticeHits,
} from './overlay-match';
import {
  RESOLVER_CODE,
  RESOLVER_HARDENING_VERSION,
  type FieldCandidate,
  type FieldResolverResult,
  type ResolverEvidenceUnit,
} from './types';

export function resolveFieldsHardened(args: {
  snapshotId: string;
  units: ResolverEvidenceUnit[];
  policy?: ExperimentalResolverPolicy;
  resolverVersion?: string;
}): FieldResolverResult {
  const policy = args.policy ?? EXPERIMENTAL_RESOLVER_POLICY;
  const resolverVersion = args.resolverVersion ?? RESOLVER_HARDENING_VERSION;
  const min = policy.minIndependentSources;
  const fields = compileFieldLexicon();
  const candidates: FieldCandidate[] = [];

  for (const field of fields) {
    const originUnits: ResolverEvidenceUnit[] = [];
    const reinforce: string[] = [];
    const positives: string[] = [];
    const exclusions: string[] = [];

    for (const u of args.units) {
      const catalog = matchUnitToField(u, field);
      const aliases = fieldAliasHits(u, field.code, policy);
      const hasPractice = catalog.role === 'ORIGIN' || aliases.length > 0;
      if (hasPractice && isOriginKind(u.evidenceKind) && !(catalog.role === 'EXCLUDED' && aliases.length === 0)) {
        originUnits.push(u);
      } else if (
        (catalog.role === 'REINFORCE' || aliases.length > 0) &&
        isReinforceKind(u.evidenceKind)
      ) {
        reinforce.push(u.evidenceId);
      }
      positives.push(...catalog.positiveSignalsMatched, ...aliases);
      exclusions.push(...catalog.exclusionsTriggered);
    }

    const originIds = originUnits.map((u) => u.evidenceId);
    const independent = independentSourceCount(originUnits);
    if (originIds.length === 0 && reinforce.length === 0) continue;

    const reasons: string[] = [];
    if (independent >= min) reasons.push('MULTI_ACTION_CLUSTER');
    else if (independent === 1) reasons.push('SINGLE_SOURCE_THIN');
    else reasons.push('KNOWLEDGE_REINFORCEMENT');
    if (exclusions.includes('TOOL_ONLY_IGNORED')) {
      reasons.push('TOOL_ONLY_REJECTED');
    }

    candidates.push({
      fieldCode: field.code,
      supportingEvidenceIds: [...originIds, ...reinforce],
      originEvidenceIds: originIds,
      reinforceEvidenceIds: reinforce,
      matchScore: independent,
      resolverStrength: strengthFromOriginCount(independent),
      reasonCodes: [...new Set(reasons)],
      positiveSignalsMatched: [...new Set(positives)].sort(),
      exclusionsTriggered: [...new Set(exclusions)].sort(),
      independentSourceCount: independent,
      differentialSignalsMatched: [],
      competitorFieldCodes: competitorOf(field.code, policy).map((p) =>
        otherField(p, field.code),
      ),
    });
  }

  candidates.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return a.fieldCode.localeCompare(b.fieldCode);
  });

  const viable = candidates.filter((c) => (c.independentSourceCount ?? 0) >= min);
  const reasonCodes: string[] = [];
  let decision: FieldResolverResult['decision'] = 'INSUFFICIENT_EVIDENCE';
  let resolvedFieldCode: string | null = null;
  let ambiguousFieldCodes: string[] = [];

  if (viable.length === 0) {
    decision = 'INSUFFICIENT_EVIDENCE';
    const thin = candidates.filter((c) => (c.independentSourceCount ?? 0) === 1);
    if (thin.length >= 2) {
      decision = 'AMBIGUOUS';
      ambiguousFieldCodes = thin.map((c) => c.fieldCode);
      reasonCodes.push('INSUFFICIENT_DIFFERENTIAL_SIGNAL');
    } else {
      reasonCodes.push('NO_FIELD_WITH_MIN_ORIGIN');
    }
  } else {
    const top = viable[0];
    const second = viable[1];
    const marginOk =
      !second ||
      (second.independentSourceCount ?? 0) < min ||
      top.matchScore >= second.matchScore * 2;

    let blocked = false;
    for (const pair of competitorOf(top.fieldCode, policy)) {
      const otherCode = otherField(pair, top.fieldCode);
      const other = candidates.find((c) => c.fieldCode === otherCode);
      const topDiff = differentialHits(args.units, pair, top.fieldCode);
      const otherDiff = differentialHits(args.units, pair, otherCode);
      const shared = sharedPracticeHits(args.units, pair);
      top.differentialSignalsMatched = [
        ...new Set([...(top.differentialSignalsMatched ?? []), ...topDiff]),
      ];
      if (other) {
        other.differentialSignalsMatched = [
          ...new Set([...(other.differentialSignalsMatched ?? []), ...otherDiff]),
        ];
      }
      const otherIndependent = other?.independentSourceCount ?? 0;
      const otherStrong = otherIndependent >= min;
      const onlyShared = shared.length > 0 && topDiff.length === 0;
      const missingDifferentialOnBoundary =
        topDiff.length === 0 && (otherStrong || otherIndependent >= 1 || shared.length > 0);
      if (otherStrong) {
        blocked = true;
        reasonCodes.push('COMPETING_FIELDS');
        if (shared.length > 0) reasonCodes.push('SHARED_PRACTICE');
      } else if (onlyShared || missingDifferentialOnBoundary) {
        blocked = true;
        reasonCodes.push('CROSS_DOMAIN_PRACTICE');
        reasonCodes.push('INSUFFICIENT_DIFFERENTIAL_SIGNAL');
        if (shared.length > 0) reasonCodes.push('SHARED_PRACTICE');
      }
    }

    if (!marginOk) {
      decision = 'AMBIGUOUS';
      ambiguousFieldCodes = viable
        .filter((c) => c.matchScore * 2 > top.matchScore)
        .map((c) => c.fieldCode);
      reasonCodes.push('COMPETING_FIELDS');
    } else if (blocked) {
      decision = 'AMBIGUOUS';
      ambiguousFieldCodes = [
        top.fieldCode,
        ...competitorOf(top.fieldCode, policy).map((p) => otherField(p, top.fieldCode)),
      ].filter((c, i, arr) => arr.indexOf(c) === i);
    } else {
      decision = 'RESOLVED';
      resolvedFieldCode = top.fieldCode;
      reasonCodes.push('CLEAR_FIELD_MARGIN');
    }
  }

  return {
    resolverCode: RESOLVER_CODE,
    resolverVersion,
    snapshotId: args.snapshotId,
    decision,
    resolvedFieldCode,
    candidateFields: candidates,
    ambiguousFieldCodes,
    reasonCodes: [...new Set(reasonCodes)],
  };
}
