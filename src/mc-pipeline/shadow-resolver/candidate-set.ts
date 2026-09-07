/**
 * Candidate set determinístico sobre Candidate.2.
 * No reescribe el resolver primario. No copia candidatos Gemini.
 */
import {
  competitorOf,
  otherField,
  type ExperimentalResolverPolicy,
} from '../experimental/deterministic-resolver/experimental-policy';
import { EXPERIMENTAL_RESOLVER_POLICY_V03 } from '../experimental/deterministic-resolver/experimental-policy-v03';
import { isOriginKind } from '../experimental/deterministic-resolver/evidence';
import { differentialHits, sharedPracticeHits } from '../experimental/deterministic-resolver/overlay-match';
import type {
  FieldCandidate,
  FieldResolverResult,
  ResolverEvidenceUnit,
} from '../experimental/deterministic-resolver/types';
import {
  CANDIDATE_SET_POLICY,
  type CandidateSetRole,
  type FieldStrength,
} from './candidate-set-policy';

export type CandidateSetMember = {
  fieldCode: string;
  role: CandidateSetRole;
  fieldStrength: FieldStrength;
  supportingEvidenceIds: string[];
  originEvidenceIds: string[];
  independentSourceCount: number;
  differentialSignals: string[];
  sharedSignals: string[];
  exclusions: string[];
  reasonCodes: string[];
};

export type ThinDiagnostic = {
  fieldCode: string;
  independentSourceCount: number;
  originEvidenceIds: string[];
  differentialSignals: string[];
  reasonCodes: string[];
};

export type CandidateSetResult = {
  policyCode: typeof CANDIDATE_SET_POLICY.policyCode;
  policyVersion: string;
  snapshotId: string;
  decision: FieldResolverResult['decision'];
  primaryCandidateCode: string | null;
  candidates: CandidateSetMember[];
  thin: ThinDiagnostic[];
  uncertain: boolean;
  uncertainReasons: string[];
};

function pairWithPrimary(
  primary: string,
  fieldCode: string,
  policy: ExperimentalResolverPolicy,
) {
  return competitorOf(primary, policy).find(
    (p) => otherField(p, primary) === fieldCode,
  );
}

function hasOriginPractice(c: FieldCandidate): boolean {
  return c.originEvidenceIds.length > 0;
}

function isToolOnly(c: FieldCandidate): boolean {
  return (
    c.exclusionsTriggered.includes('TOOL_ONLY_IGNORED') &&
    c.originEvidenceIds.length === 0
  );
}

function strengthOf(role: CandidateSetRole, independent: number, diffs: string[]): FieldStrength {
  if (independent < 1) return 'NONE';
  if (independent === 1) return 'THIN';
  if (role === 'PRIMARY_CANDIDATE') return 'STRONG';
  if (role === 'COMPETITOR') return independent >= 2 ? 'STRONG' : 'SUPPORTED';
  if (diffs.length > 0) return 'STRONG';
  return 'SUPPORTED';
}

function sortMembers(a: CandidateSetMember, b: CandidateSetMember): number {
  const roleRank: Record<CandidateSetRole, number> = {
    PRIMARY_CANDIDATE: 0,
    SECONDARY_CANDIDATE: 1,
    COMPETITOR: 2,
  };
  if (roleRank[a.role] !== roleRank[b.role]) return roleRank[a.role] - roleRank[b.role];
  if (a.role === 'SECONDARY_CANDIDATE') {
    const sa = a.fieldStrength === 'STRONG' ? 0 : 1;
    const sb = b.fieldStrength === 'STRONG' ? 0 : 1;
    if (sa !== sb) return sa - sb;
  }
  if (b.independentSourceCount !== a.independentSourceCount) {
    return b.independentSourceCount - a.independentSourceCount;
  }
  return a.fieldCode.localeCompare(b.fieldCode);
}

export function buildCandidateSet(args: {
  p2: FieldResolverResult;
  units: ResolverEvidenceUnit[];
  policy?: ExperimentalResolverPolicy;
}): CandidateSetResult {
  const policy = args.policy ?? EXPERIMENTAL_RESOLVER_POLICY_V03;
  const min = CANDIDATE_SET_POLICY.minIndependentAuthoritativeSecondary;
  const members: CandidateSetMember[] = [];
  const thin: ThinDiagnostic[] = [];
  const uncertainReasons: string[] = [];

  const byCode = new Map(args.p2.candidateFields.map((c) => [c.fieldCode, c]));

  if (args.p2.decision === 'AMBIGUOUS') {
    const codes = [...args.p2.ambiguousFieldCodes].sort();
    for (const code of codes) {
      const c = byCode.get(code);
      const independent = c?.independentSourceCount ?? 0;
      if (!c || independent < min || !hasOriginPractice(c)) continue;
      members.push({
        fieldCode: code,
        role: 'COMPETITOR',
        fieldStrength: strengthOf('COMPETITOR', independent, c.differentialSignalsMatched ?? []),
        supportingEvidenceIds: c.supportingEvidenceIds,
        originEvidenceIds: c.originEvidenceIds,
        independentSourceCount: independent,
        differentialSignals: [...(c.differentialSignalsMatched ?? [])].sort(),
        sharedSignals: [],
        exclusions: c.exclusionsTriggered,
        reasonCodes: ['AMBIGUOUS_COMPETITOR', ...c.reasonCodes],
      });
    }
    members.sort(sortMembers);
    return {
      policyCode: CANDIDATE_SET_POLICY.policyCode,
      policyVersion: CANDIDATE_SET_POLICY.policyVersion,
      snapshotId: args.p2.snapshotId,
      decision: args.p2.decision,
      primaryCandidateCode: null,
      candidates: members,
      thin,
      uncertain: true,
      uncertainReasons: ['DECISION_AMBIGUOUS'],
    };
  }

  const primary = args.p2.resolvedFieldCode;
  if (args.p2.decision !== 'RESOLVED' || !primary) {
    return {
      policyCode: CANDIDATE_SET_POLICY.policyCode,
      policyVersion: CANDIDATE_SET_POLICY.policyVersion,
      snapshotId: args.p2.snapshotId,
      decision: args.p2.decision,
      primaryCandidateCode: null,
      candidates: [],
      thin,
      uncertain: true,
      uncertainReasons: ['NO_PRIMARY'],
    };
  }

  const primaryCand = byCode.get(primary);
  if (primaryCand) {
    members.push({
      fieldCode: primary,
      role: 'PRIMARY_CANDIDATE',
      fieldStrength: strengthOf(
        'PRIMARY_CANDIDATE',
        primaryCand.independentSourceCount ?? 0,
        primaryCand.differentialSignalsMatched ?? [],
      ),
      supportingEvidenceIds: primaryCand.supportingEvidenceIds,
      originEvidenceIds: primaryCand.originEvidenceIds,
      independentSourceCount: primaryCand.independentSourceCount ?? 0,
      differentialSignals: [...(primaryCand.differentialSignalsMatched ?? [])].sort(),
      sharedSignals: [],
      exclusions: primaryCand.exclusionsTriggered,
      reasonCodes: ['PRIMARY_DOMINANT', ...primaryCand.reasonCodes],
    });
  }

  for (const c of args.p2.candidateFields) {
    if (c.fieldCode === primary) continue;
    const independent = c.independentSourceCount ?? 0;
    const pair = pairWithPrimary(primary, c.fieldCode, policy);
    const diffs = pair ? differentialHits(args.units, pair, c.fieldCode) : [];
    const shared = pair ? sharedPracticeHits(args.units, pair) : [];
    const originUnits = args.units.filter(
      (u) => c.originEvidenceIds.includes(u.evidenceId) && isOriginKind(u.evidenceKind),
    );

    if (isToolOnly(c) || originUnits.length === 0) {
      continue;
    }

    if (independent === CANDIDATE_SET_POLICY.thinIndependent) {
      thin.push({
        fieldCode: c.fieldCode,
        independentSourceCount: independent,
        originEvidenceIds: c.originEvidenceIds,
        differentialSignals: [...diffs].sort(),
        reasonCodes: ['THIN_SINGLE_SOURCE'],
      });
      if (pair && diffs.length > 0) {
        uncertainReasons.push(`THIN_BOUNDARY_${c.fieldCode}`);
      }
      continue;
    }

    if (independent < min) continue;

    if (pair) {
      if (diffs.length === 0) {
        continue;
      }
    }

    members.push({
      fieldCode: c.fieldCode,
      role: 'SECONDARY_CANDIDATE',
      fieldStrength: strengthOf('SECONDARY_CANDIDATE', independent, diffs),
      supportingEvidenceIds: c.supportingEvidenceIds,
      originEvidenceIds: c.originEvidenceIds,
      independentSourceCount: independent,
      differentialSignals: [...diffs].sort(),
      sharedSignals: [...shared].sort(),
      exclusions: c.exclusionsTriggered,
      reasonCodes: [
        pair ? 'SECONDARY_WITH_DIFFERENTIAL' : 'SECONDARY_INDEPENDENT_PRACTICE',
        ...c.reasonCodes,
      ],
    });
  }

  members.sort(sortMembers);
  return {
    policyCode: CANDIDATE_SET_POLICY.policyCode,
    policyVersion: CANDIDATE_SET_POLICY.policyVersion,
    snapshotId: args.p2.snapshotId,
    decision: args.p2.decision,
    primaryCandidateCode: primary,
    candidates: members,
    thin,
    uncertain: uncertainReasons.length > 0,
    uncertainReasons: [...new Set(uncertainReasons)].sort(),
  };
}
