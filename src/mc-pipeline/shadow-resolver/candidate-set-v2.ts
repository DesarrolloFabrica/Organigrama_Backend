/**
 * Candidate set v2 — roles PRIMARY / SECONDARY / CONTEXT / COMPETITOR.
 * THIN es strength, no rol. No reescribe Candidate.2. No copia Gemini.
 */
import {
  competitorOf,
  otherField,
  type CompetitorPair,
  type ExperimentalResolverPolicy,
} from '../experimental/deterministic-resolver/experimental-policy';
import { EXPERIMENTAL_RESOLVER_POLICY_V03 } from '../experimental/deterministic-resolver/experimental-policy-v03';
import { isOriginKind } from '../experimental/deterministic-resolver/evidence';
import {
  aliasHits,
  differentialHits,
  sharedPracticeHits,
} from '../experimental/deterministic-resolver/overlay-match';
import type {
  FieldCandidate,
  FieldResolverResult,
  ResolverEvidenceUnit,
} from '../experimental/deterministic-resolver/types';
import {
  CANDIDATE_SET_POLICY_V2,
  type CandidateSetV2Role,
  type FieldEvidenceStrength,
} from './candidate-set-policy-v2';

const CONTEXT_KINDS = new Set<string>(CANDIDATE_SET_POLICY_V2.contextOriginKinds);

export type CandidateSetV2Member = {
  fieldCode: string;
  role: CandidateSetV2Role;
  strength: FieldEvidenceStrength;
  supportingEvidenceIds: string[];
  originEvidenceIds: string[];
  independentSourceCount: number;
  differentialSignals: string[];
  sharedSignals: string[];
  fieldSpecificSignals: string[];
  exclusions: string[];
  reasonCodes: string[];
};

export type CandidateSetV2Result = {
  policyCode: typeof CANDIDATE_SET_POLICY_V2.policyCode;
  policyVersion: string;
  snapshotId: string;
  decision: FieldResolverResult['decision'];
  primary: CandidateSetV2Member | null;
  secondaries: CandidateSetV2Member[];
  contextFields: CandidateSetV2Member[];
  competitors: CandidateSetV2Member[];
  primaryCandidateCode: string | null;
  candidateSetSafe: boolean;
  uncertainReasons: string[];
};

function overlayPairs(
  primary: string,
  c2Policy: ExperimentalResolverPolicy,
): CompetitorPair[] {
  const c2 = competitorOf(primary, c2Policy);
  const extra = CANDIDATE_SET_POLICY_V2.extraOverlayPairs.filter(
    (p) => p.fieldA === primary || p.fieldB === primary,
  );
  const seen = new Set(c2.map((p) => `${p.fieldA}|${p.fieldB}`));
  const out = [...c2];
  for (const p of extra) {
    const key = `${p.fieldA}|${p.fieldB}`;
    if (!seen.has(key)) out.push(p);
  }
  return out;
}

function pairWithPrimary(
  primary: string,
  fieldCode: string,
  c2Policy: ExperimentalResolverPolicy,
): CompetitorPair | undefined {
  return overlayPairs(primary, c2Policy).find(
    (p) => otherField(p, primary) === fieldCode,
  );
}

function fieldSpecificAliases(fieldCode: string, c2Policy: ExperimentalResolverPolicy): string[] {
  const c2 = c2Policy.fieldPracticeAliases[fieldCode] ?? [];
  const v2 = CANDIDATE_SET_POLICY_V2.contextFieldAliases[fieldCode] ?? [];
  return [...new Set([...c2, ...v2])];
}

function originActionUnits(
  c: FieldCandidate,
  units: ResolverEvidenceUnit[],
): ResolverEvidenceUnit[] {
  return units.filter(
    (u) =>
      c.originEvidenceIds.includes(u.evidenceId) &&
      CONTEXT_KINDS.has(u.evidenceKind),
  );
}

function allOriginUnits(
  c: FieldCandidate,
  units: ResolverEvidenceUnit[],
): ResolverEvidenceUnit[] {
  return units.filter(
    (u) => c.originEvidenceIds.includes(u.evidenceId) && isOriginKind(u.evidenceKind),
  );
}

function isToolOnly(c: FieldCandidate): boolean {
  return (
    c.exclusionsTriggered.includes('TOOL_ONLY_IGNORED') &&
    c.originEvidenceIds.length === 0
  );
}

function isKnowledgeOnly(units: ResolverEvidenceUnit[]): boolean {
  return (
    units.length > 0 && units.every((u) => u.evidenceKind === 'KNOWLEDGE_STATEMENT')
  );
}

function strengthOf(independent: number, diffs: string[]): FieldEvidenceStrength {
  if (independent < 1) return 'NONE';
  if (independent === 1) return 'THIN';
  if (independent >= 2 && diffs.length > 0) return 'STRONG';
  if (independent >= 2) return 'SUPPORTED';
  return 'THIN';
}

function sortMembers(a: CandidateSetV2Member, b: CandidateSetV2Member): number {
  const roleRank: Record<CandidateSetV2Role, number> = {
    PRIMARY: 0,
    SECONDARY: 1,
    CONTEXT: 2,
    COMPETITOR: 3,
  };
  if (roleRank[a.role] !== roleRank[b.role]) return roleRank[a.role] - roleRank[b.role];
  const strengthRank: Record<FieldEvidenceStrength, number> = {
    STRONG: 0,
    SUPPORTED: 1,
    THIN: 2,
    NONE: 3,
  };
  if (strengthRank[a.strength] !== strengthRank[b.strength]) {
    return strengthRank[a.strength] - strengthRank[b.strength];
  }
  if (b.independentSourceCount !== a.independentSourceCount) {
    return b.independentSourceCount - a.independentSourceCount;
  }
  return a.fieldCode.localeCompare(b.fieldCode);
}

function memberSignals(
  c: FieldCandidate,
  units: ResolverEvidenceUnit[],
  primary: string | null,
  c2Policy: ExperimentalResolverPolicy,
  scoped: ResolverEvidenceUnit[],
) {
  const pair = primary ? pairWithPrimary(primary, c.fieldCode, c2Policy) : undefined;
  const diffs = pair ? differentialHits(scoped, pair, c.fieldCode) : [];
  const shared = pair ? sharedPracticeHits(scoped, pair) : [];
  const aliases = [
    ...new Set(scoped.flatMap((u) => aliasHits(u, fieldSpecificAliases(c.fieldCode, c2Policy)))),
  ].sort();
  return { pair, diffs: [...diffs].sort(), shared: [...shared].sort(), aliases };
}

function toMember(args: {
  c: FieldCandidate;
  role: CandidateSetV2Role;
  reasons: string[];
  diffs: string[];
  shared: string[];
  aliases: string[];
}): CandidateSetV2Member {
  return {
    fieldCode: args.c.fieldCode,
    role: args.role,
    strength: strengthOf(args.c.independentSourceCount ?? 0, args.diffs),
    supportingEvidenceIds: args.c.supportingEvidenceIds,
    originEvidenceIds: args.c.originEvidenceIds,
    independentSourceCount: args.c.independentSourceCount ?? 0,
    differentialSignals: args.diffs,
    sharedSignals: args.shared,
    fieldSpecificSignals: args.aliases,
    exclusions: args.c.exclusionsTriggered,
    reasonCodes: [...args.reasons, ...args.c.reasonCodes],
  };
}

export function buildCandidateSetV2(args: {
  p2: FieldResolverResult;
  units: ResolverEvidenceUnit[];
  policy?: ExperimentalResolverPolicy;
}): CandidateSetV2Result {
  const c2Policy = args.policy ?? EXPERIMENTAL_RESOLVER_POLICY_V03;
  const min = CANDIDATE_SET_POLICY_V2.minIndependentAuthoritativeSecondary;
  const byCode = new Map(args.p2.candidateFields.map((c) => [c.fieldCode, c]));
  const empty = (
    decision: FieldResolverResult['decision'],
    reasons: string[],
    competitors: CandidateSetV2Member[] = [],
  ): CandidateSetV2Result => ({
    policyCode: CANDIDATE_SET_POLICY_V2.policyCode,
    policyVersion: CANDIDATE_SET_POLICY_V2.policyVersion,
    snapshotId: args.p2.snapshotId,
    decision,
    primary: null,
    secondaries: [],
    contextFields: [],
    competitors: competitors.sort(sortMembers),
    primaryCandidateCode: null,
    candidateSetSafe: false,
    uncertainReasons: reasons,
  });

  if (args.p2.decision === 'AMBIGUOUS') {
    const competitors: CandidateSetV2Member[] = [];
    for (const code of [...args.p2.ambiguousFieldCodes].sort()) {
      const c = byCode.get(code);
      const independent = c?.independentSourceCount ?? 0;
      if (!c || independent < min || c.originEvidenceIds.length === 0) continue;
      competitors.push(
        toMember({
          c,
          role: 'COMPETITOR',
          reasons: ['AMBIGUOUS_COMPETITOR'],
          diffs: [...(c.differentialSignalsMatched ?? [])].sort(),
          shared: [],
          aliases: [],
        }),
      );
    }
    return empty('AMBIGUOUS', ['DECISION_AMBIGUOUS'], competitors);
  }

  const primaryCode = args.p2.resolvedFieldCode;
  if (args.p2.decision !== 'RESOLVED' || !primaryCode) {
    return empty(args.p2.decision, ['NO_PRIMARY']);
  }

  const primaryCand = byCode.get(primaryCode);
  const primary = primaryCand
    ? toMember({
        c: primaryCand,
        role: 'PRIMARY',
        reasons: ['PRIMARY_DOMINANT'],
        diffs: [...(primaryCand.differentialSignalsMatched ?? [])].sort(),
        shared: [],
        aliases: [],
      })
    : null;

  const secondaries: CandidateSetV2Member[] = [];
  const contextFields: CandidateSetV2Member[] = [];

  for (const c of args.p2.candidateFields) {
    if (c.fieldCode === primaryCode) continue;
    if (isToolOnly(c)) continue;
    const origins = allOriginUnits(c, args.units);
    if (origins.length === 0 || isKnowledgeOnly(origins)) continue;

    const independent = c.independentSourceCount ?? 0;
    const actionUnits = originActionUnits(c, args.units);
    const scoped = actionUnits.length > 0 ? actionUnits : origins;
    const { pair, diffs, shared, aliases } = memberSignals(
      c,
      args.units,
      primaryCode,
      c2Policy,
      scoped,
    );
    const fieldSpecific = diffs.length > 0 || aliases.length > 0;
    const sharedOnly = Boolean(pair) && diffs.length === 0 && aliases.length === 0 && shared.length > 0;

    if (independent >= min) {
      if (pair && diffs.length === 0) continue;
      secondaries.push(
        toMember({
          c,
          role: 'SECONDARY',
          reasons: [pair ? 'SECONDARY_WITH_DIFFERENTIAL' : 'SECONDARY_INDEPENDENT_PRACTICE'],
          diffs,
          shared,
          aliases,
        }),
      );
      continue;
    }

    if (independent !== CANDIDATE_SET_POLICY_V2.thinIndependent) continue;
    if (actionUnits.length === 0) continue;
    if (sharedOnly || !fieldSpecific) continue;

    contextFields.push(
      toMember({
        c,
        role: 'CONTEXT',
        reasons: ['CONTEXT_THIN_PROFESSIONAL_PRACTICE'],
        diffs,
        shared,
        aliases,
      }),
    );
  }

  secondaries.sort(sortMembers);
  contextFields.sort(sortMembers);

  return {
    policyCode: CANDIDATE_SET_POLICY_V2.policyCode,
    policyVersion: CANDIDATE_SET_POLICY_V2.policyVersion,
    snapshotId: args.p2.snapshotId,
    decision: args.p2.decision,
    primary,
    secondaries,
    contextFields,
    competitors: [],
    primaryCandidateCode: primaryCode,
    candidateSetSafe: true,
    uncertainReasons: [],
  };
}
