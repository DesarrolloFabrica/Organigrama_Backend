/**
 * Elegibilidad futura de skip. skipGemini sigue false.
 * RESOLVED no implica SKIP_ELIGIBLE.
 */
import { lexiconForField } from '../experimental/deterministic-resolver/catalog-lexicon';
import { isOriginKind } from '../experimental/deterministic-resolver/evidence';
import {
  competitorOf,
  EXPERIMENTAL_POLICY_VERSION,
  EXPERIMENTAL_RESOLVER_POLICY,
  otherField,
  type ExperimentalResolverPolicy,
} from '../experimental/deterministic-resolver/experimental-policy';
import { fieldAliasHits, specialtyAliasHits } from '../experimental/deterministic-resolver/overlay-match';
import { matchUnitToField, matchUnitToSpecialty } from '../experimental/deterministic-resolver/match';
import { shadowInputFingerprint } from '../experimental/deterministic-resolver/shadow/fingerprint';
import type {
  FieldResolverResult,
  ResolverEvidenceUnit,
  SpecialtyResolverItem,
} from '../experimental/deterministic-resolver/types';
import {
  RESOLVER_CANDIDATE_2_VERSION,
  RESOLVER_HARDENING_VERSION,
} from '../experimental/deterministic-resolver/types';
import { isDeterministicSkipGeminiEnabled } from './flags';

export const SKIP_CANDIDATE_CODE = 'MC1.DETERMINISTIC.RESOLVER.CANDIDATE.1' as const;
export const SKIP_CANDIDATE_2_CODE = 'MC1.DETERMINISTIC.RESOLVER.CANDIDATE.2' as const;
export const APPROVED_RESOLVER_VERSION = RESOLVER_HARDENING_VERSION;
export const APPROVED_POLICY_VERSION = EXPERIMENTAL_POLICY_VERSION;
export const CANDIDATE_2_RESOLVER_VERSION = RESOLVER_CANDIDATE_2_VERSION;
export const CANDIDATE_2_POLICY_VERSION = '0.3.0' as const;

export type SkipCandidate = 'C1' | 'C2';

export type SkipEvalOpts = {
  candidate?: SkipCandidate;
  policy?: ExperimentalResolverPolicy;
};

export type SkipEligibility = 'SKIP_ELIGIBLE' | 'NOT_SKIP_ELIGIBLE';
export type ReviewClass =
  | 'SAFE_RESOLVED'
  | 'QUESTIONABLE_RESOLVED'
  | 'UNSAFE_RESOLVED'
  | 'NOT_RESOLVED';
export type CatalogDependency = 'CATALOG_NATIVE' | 'OVERLAY_DEPENDENT' | 'MIXED';

export type SkipEval = {
  eligibility: SkipEligibility;
  reasons: string[];
  independentSourceCount: number;
  strongCompetitorCodes: string[];
  differentialSignals: string[];
  catalogDependency: CatalogDependency;
  fingerprint: string | null;
  wouldSkip: false;
};

const MIN = EXPERIMENTAL_RESOLVER_POLICY.minIndependentSources;
const BLOCKING_EXCLUSIONS = new Set([
  'CATALOG_GAP',
  'COMPETING_FIELDS',
  'INSUFFICIENT_DIFFERENTIAL_SIGNAL',
  'SINGLE_SOURCE_THIN',
  'FIELD_NOT_UNIQUELY_RESOLVED',
  'CROSS_DOMAIN_PRACTICE',
]);

export function versionsApproved(): boolean {
  return (
    APPROVED_RESOLVER_VERSION === '0.2.0' &&
    APPROVED_POLICY_VERSION === '0.2.0' &&
    isDeterministicSkipGeminiEnabled() === false
  );
}

export function strongCompetitorCodes(p2: FieldResolverResult): string[] {
  const top = p2.resolvedFieldCode;
  return p2.candidateFields
    .filter(
      (c) =>
        c.fieldCode !== top &&
        (c.independentSourceCount ?? 0) >= MIN,
    )
    .map((c) => c.fieldCode);
}

export function p2CatalogDependency(
  units: ResolverEvidenceUnit[],
  fieldCode: string,
  policy: ExperimentalResolverPolicy = EXPERIMENTAL_RESOLVER_POLICY,
): CatalogDependency {
  const lex = lexiconForField(fieldCode);
  let catalog = 0;
  let overlay = 0;
  for (const u of units) {
    if (!isOriginKind(u.evidenceKind)) continue;
    const cat = lex ? matchUnitToField(u, lex) : { role: 'NONE' as const };
    const aliases = fieldAliasHits(u, fieldCode, policy);
    if (cat.role === 'ORIGIN') catalog += 1;
    if (aliases.length > 0) overlay += 1;
  }
  if (overlay > 0 && catalog === 0) return 'OVERLAY_DEPENDENT';
  if (overlay > 0 && catalog > 0) return 'MIXED';
  return 'CATALOG_NATIVE';
}

function relevantBoundaryNeedsDifferential(
  p2: FieldResolverResult,
  policy: ExperimentalResolverPolicy,
): boolean {
  const field = p2.resolvedFieldCode;
  if (!field) return false;
  return competitorOf(field, policy).some((pair) => {
    const other = otherField(pair, field);
    const oc = p2.candidateFields.find((c) => c.fieldCode === other);
    return (oc?.independentSourceCount ?? 0) >= 1;
  });
}

function candidateVersionsOk(args: {
  candidate: SkipCandidate;
  resolverVersion: string;
  policy: ExperimentalResolverPolicy;
}): boolean {
  if (isDeterministicSkipGeminiEnabled()) return false;
  if (args.candidate === 'C2') {
    return (
      args.resolverVersion === CANDIDATE_2_RESOLVER_VERSION &&
      args.policy.policyVersion === CANDIDATE_2_POLICY_VERSION
    );
  }
  return args.resolverVersion === APPROVED_RESOLVER_VERSION && versionsApproved();
}

export function evaluateP2SkipEligibility(
  p2: FieldResolverResult,
  units: ResolverEvidenceUnit[],
  opts: SkipEvalOpts = {},
): SkipEval {
  const candidate = opts.candidate ?? 'C1';
  const policy = opts.policy ?? EXPERIMENTAL_RESOLVER_POLICY;
  const reasons: string[] = [];
  const top = p2.candidateFields.find((c) => c.fieldCode === p2.resolvedFieldCode);
  const independent = top?.independentSourceCount ?? 0;
  const competitors = strongCompetitorCodes(p2);
  const diffs = top?.differentialSignalsMatched ?? [];
  const dependency = p2.resolvedFieldCode
    ? p2CatalogDependency(units, p2.resolvedFieldCode, policy)
    : 'CATALOG_NATIVE';
  const fingerprint = shadowInputFingerprint({
    units,
    phase: 'P2',
    policyVersion: policy.policyVersion,
  });

  if (p2.decision !== 'RESOLVED' || !p2.resolvedFieldCode) {
    reasons.push('DECISION_NOT_RESOLVED');
  }
  if (independent < MIN) reasons.push('INSUFFICIENT_INDEPENDENT_SOURCES');
  if (competitors.length > 0) reasons.push('STRONG_COMPETITOR');
  if (relevantBoundaryNeedsDifferential(p2, policy) && diffs.length === 0) {
    reasons.push('MISSING_DIFFERENTIAL_ON_BOUNDARY');
  }
  if (p2.reasonCodes.some((r) => BLOCKING_EXCLUSIONS.has(r))) {
    reasons.push('BLOCKING_REASON_CODE');
  }
  if (p2.reasonCodes.includes('CATALOG_GAP')) reasons.push('CATALOG_GAP');
  if (!fingerprint || fingerprint.length !== 64) reasons.push('INVALID_FINGERPRINT');
  if (!candidateVersionsOk({ candidate, resolverVersion: p2.resolverVersion, policy })) {
    reasons.push(
      p2.resolverVersion !==
        (candidate === 'C2' ? CANDIDATE_2_RESOLVER_VERSION : APPROVED_RESOLVER_VERSION)
        ? 'RESOLVER_VERSION_NOT_APPROVED'
        : 'VERSION_NOT_APPROVED',
    );
  }
  if (isDeterministicSkipGeminiEnabled()) reasons.push('SKIP_FLAG_MUST_STAY_FALSE');

  const eligibility: SkipEligibility =
    reasons.length === 0 ? 'SKIP_ELIGIBLE' : 'NOT_SKIP_ELIGIBLE';
  return {
    eligibility,
    reasons,
    independentSourceCount: independent,
    strongCompetitorCodes: competitors,
    differentialSignals: diffs,
    catalogDependency: dependency,
    fingerprint,
    wouldSkip: false,
  };
}

export function p3CatalogDependency(
  units: ResolverEvidenceUnit[],
  item: SpecialtyResolverItem,
): CatalogDependency {
  const lex = lexiconForField(item.fieldCode);
  const spec = lex?.specialties.find((s) => s.code === item.specialtyCode);
  let catalog = 0;
  let overlay = 0;
  for (const u of units) {
    if (!isOriginKind(u.evidenceKind)) continue;
    const aliases = specialtyAliasHits(u, item.specialtyCode);
    if (aliases.length) overlay += 1;
    if (spec && matchUnitToSpecialty(u, spec).role === 'ORIGIN') catalog += 1;
  }
  if (overlay > 0 && catalog === 0) return 'OVERLAY_DEPENDENT';
  if (overlay > 0 && catalog > 0) return 'MIXED';
  return 'CATALOG_NATIVE';
}

export function hasCatalogOriginOutcome(
  units: ResolverEvidenceUnit[],
  item: SpecialtyResolverItem,
): boolean {
  const lex = lexiconForField(item.fieldCode);
  const spec = lex?.specialties.find((s) => s.code === item.specialtyCode);
  if (!spec?.requiresOutcomeForOrigin) return true;
  return units.some(
    (u) => isOriginKind(u.evidenceKind) && matchUnitToSpecialty(u, spec).role === 'ORIGIN',
  );
}

export function evaluateP3SkipEligibility(args: {
  item: SpecialtyResolverItem;
  units: ResolverEvidenceUnit[];
  p2Decision: FieldResolverResult['decision'];
  p2Skip: SkipEligibility;
}): SkipEval {
  const { item, units, p2Decision, p2Skip } = args;
  const reasons: string[] = [];
  const lex = lexiconForField(item.fieldCode);
  const spec = lex?.specialties.find((s) => s.code === item.specialtyCode);
  const independent = item.independentSourceCount ?? 0;
  const dependency = p3CatalogDependency(units, item);
  const fingerprint = shadowInputFingerprint({
    units,
    phase: 'P3',
    fieldContext: [item.fieldCode],
  });

  if (p2Skip !== 'SKIP_ELIGIBLE') reasons.push('P2_NOT_SKIP_ELIGIBLE');
  if (p2Decision !== 'RESOLVED') reasons.push('PARENT_FIELD_NOT_STABLE');
  if (item.decision !== 'RESOLVED') reasons.push('DECISION_NOT_RESOLVED');
  if (item.originEvidenceIds.length === 0) reasons.push('NO_PRACTICE_ORIGIN');
  if (independent < MIN) reasons.push('INSUFFICIENT_INDEPENDENT_SOURCES');
  if (independent === 1) reasons.push('SINGLE_SOURCE_THIN');
  if (spec?.requiresOutcomeForOrigin && !hasCatalogOriginOutcome(units, item)) {
    reasons.push('MISSING_OUTCOME_SUPPORT');
  }
  if (item.reasonCodes.some((r) => BLOCKING_EXCLUSIONS.has(r))) {
    reasons.push('BLOCKING_REASON_CODE');
  }
  if (item.reasonCodes.includes('CATALOG_GAP')) reasons.push('CATALOG_GAP');
  if (
    item.exclusionsTriggered.includes('TECH_WITHOUT_GOVERNANCE_OUTCOME') &&
    spec?.requiresOutcomeForOrigin &&
    !hasCatalogOriginOutcome(units, item)
  ) {
    reasons.push('EXCLUSION_CONFLICT');
  }
  if (!fingerprint || fingerprint.length !== 64) reasons.push('INVALID_FINGERPRINT');
  if (!versionsApproved()) reasons.push('VERSION_NOT_APPROVED');

  const eligibility: SkipEligibility =
    reasons.length === 0 ? 'SKIP_ELIGIBLE' : 'NOT_SKIP_ELIGIBLE';
  return {
    eligibility,
    reasons,
    independentSourceCount: independent,
    strongCompetitorCodes: p2Skip === 'SKIP_ELIGIBLE' ? [] : ['PARENT_FIELD'],
    differentialSignals: [],
    catalogDependency: dependency,
    fingerprint,
    wouldSkip: false,
  };
}

export function isToolOnlyResolved(
  units: ResolverEvidenceUnit[],
  originIds: string[],
): boolean {
  if (originIds.length === 0) return false;
  const origins = units.filter((u) => originIds.includes(u.evidenceId));
  if (origins.length === 0) return false;
  return origins.every(
    (u) =>
      u.evidenceKind === 'TOOL_USAGE' ||
      (!u.normalizedActivity && !u.object && !!u.toolOrMethod),
  );
}

export function duplicatedSourceRisk(
  units: ResolverEvidenceUnit[],
  originIds: string[],
  independent: number,
): boolean {
  const origins = units.filter((u) => originIds.includes(u.evidenceId));
  if (origins.length === 0) return false;
  const candidateIds = new Set(origins.map((u) => u.candidateId));
  if (independent >= MIN) return false;
  return origins.length >= 2 && candidateIds.size === 1;
}

export function reviewClass(args: {
  decision: string;
  skip: SkipEval;
  toolOnly: boolean;
  duplicatedSourceRisk: boolean;
}): ReviewClass {
  if (args.decision !== 'RESOLVED') return 'NOT_RESOLVED';
  if (args.toolOnly) return 'UNSAFE_RESOLVED';
  if (args.duplicatedSourceRisk) return 'QUESTIONABLE_RESOLVED';
  if (args.skip.catalogDependency === 'OVERLAY_DEPENDENT') {
    return 'QUESTIONABLE_RESOLVED';
  }
  return 'SAFE_RESOLVED';
}
