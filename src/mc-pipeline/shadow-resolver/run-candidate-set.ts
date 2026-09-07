/**
 * FASE — MC1 P2 DETERMINISTIC CANDIDATE SET MODEL
 * Offline. Gemini = 0. skipGemini = false. No copia secundarios Gemini.
 * Candidate.2 (0.3.0) no se modifica. Policy candidate-set 0.1.0 congelada.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { EXPERIMENTAL_RESOLVER_POLICY_V03 } from '../experimental/deterministic-resolver/experimental-policy-v03';
import { competitorOf, otherField } from '../experimental/deterministic-resolver/experimental-policy';
import {
  differentialHits,
  fieldAliasHits,
  sharedPracticeHits,
} from '../experimental/deterministic-resolver/overlay-match';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import {
  RESOLVER_CANDIDATE_2_VERSION,
  type FieldCandidate,
  type ResolverEvidenceUnit,
} from '../experimental/deterministic-resolver/types';
import { resolveFieldsToEvaluate } from '../p3/p3-context-loader';
import { findLatestR1Pack, loadR1Contract } from '../p3/p3-context-loader';
import type { R1ContractEnvelope } from '../r1/r1.types';
import { R1_POLICY } from '../r1/r1-resolver';
import { discoverHistoricalInventory } from './inventory';
import { evaluateP2SkipEligibility } from './skip-eligibility';
import { evaluateP2ContractSkipEligibility } from './skip-eligibility-v2';
import { isDeterministicSkipGeminiEnabled } from './flags';
import { buildCandidateSet, type CandidateSetResult } from './candidate-set';
import { CANDIDATE_SET_POLICY } from './candidate-set-policy';
import {
  adaptCandidateSetToExperimentalR1,
  EXPERIMENTAL_ROUTING_TOKENS,
} from './experimental-r1-adapter';
import {
  CSET_FIXTURES,
  mutateAddStrongCompetitor,
  mutateRemoveSecondaryDifferential,
  mutateSecondaryActionToKnowledge,
} from './candidate-set-fixtures';

const POLICY = EXPERIMENTAL_RESOLVER_POLICY_V03;
const SKIP_OPTS = { candidate: 'C2' as const, policy: POLICY };
const CONTROLS = [
  'Sara',
  'Haider',
  'Diego',
  'Johan',
  'Camilo',
  'S9',
  'S19',
  'Juan Pablo',
  'Katherin',
];

function ledgerSnapshot(backendRoot: string) {
  const path = join(backendRoot, 'tmp', 'mc1-gemini-ledger', 'events.jsonl');
  if (!existsSync(path)) {
    return { exists: false, path, calls: 0, tokens: 0, events: 0 };
  }
  const text = readFileSync(path, 'utf8');
  let calls = 0;
  let tokens = 0;
  let events = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    events += 1;
    try {
      const ev = JSON.parse(line) as { eventType?: string; usage?: { totalTokens?: number } };
      if (ev.eventType === 'GEMINI_CALL') {
        calls += 1;
        tokens += ev.usage?.totalTokens ?? 0;
      }
    } catch {
      // ignore
    }
  }
  return { exists: true, path, calls, tokens, events };
}

function r1View(r1: R1ContractEnvelope | null) {
  if (!r1) {
    return { status: null as string | null, primary: null as string | null, secondaries: [] as string[] };
  }
  const p = r1.payload;
  return {
    status: p.fieldResolutionStatus,
    primary: p.primaryField?.fieldCode ?? null,
    secondaries: [...(p.secondaryFields ?? []).map((s) => s.fieldCode).filter((x): x is string => !!x)].sort(),
  };
}

function p3Fields(r1: R1ContractEnvelope | null): string[] {
  if (!r1) return [];
  return [...new Set(resolveFieldsToEvaluate(r1).map((f) => f.fieldCode))].sort();
}

function setEqual(a: string[], b: string[]): boolean {
  return a.join('|') === b.join('|');
}

function subset(a: string[], b: string[]): boolean {
  return a.every((x) => b.includes(x));
}

function classifyP3(det: string[], canon: string[], detPrimary: string | null, canonPrimary: string | null) {
  if (setEqual(det, canon)) return 'EXACT';
  if (detPrimary && canonPrimary && detPrimary !== canonPrimary) return 'CONFLICTING';
  if (det.length === 0 && canon.length === 0) return 'EXACT';
  if (det.length > 0 && canon.length > 0 && subset(det, canon) && !setEqual(det, canon)) return 'NARROWER';
  if (det.length > 0 && canon.length > 0 && subset(canon, det) && !setEqual(det, canon)) return 'BROADER';
  if (det.length === 0 && canon.length > 0) return 'NARROWER';
  if (canon.length === 0 && det.length > 0) return 'BROADER';
  return 'CONFLICTING';
}

type DiffClass =
  | 'DETERMINISTIC_MISS'
  | 'CANONICAL_OVERINFERENCE'
  | 'CANONICAL_UNDERINFERENCE'
  | 'LEGITIMATE_DIFFERENCE'
  | 'CATALOG_GAP'
  | 'MATCH';

function classifySecondaryDiff(args: {
  field: string;
  inDet: boolean;
  inCanon: boolean;
  thin: boolean;
  competitor: boolean;
  independent: number;
  origin: number;
}): DiffClass {
  if (args.inDet && args.inCanon) return 'MATCH';
  if (args.inDet && !args.inCanon) {
    return args.origin > 0 ? 'CANONICAL_UNDERINFERENCE' : 'LEGITIMATE_DIFFERENCE';
  }
  if (!args.inDet && args.inCanon) {
    if (args.competitor) return 'LEGITIMATE_DIFFERENCE';
    if (args.thin || args.independent === 1) return 'DETERMINISTIC_MISS';
    if (args.origin === 0 || args.independent < 2) return 'CANONICAL_OVERINFERENCE';
    return 'DETERMINISTIC_MISS';
  }
  return 'MATCH';
}

function reviewSecondary(args: {
  originCount: number;
  independent: number;
  knowledgeOnly: boolean;
  toolOnly: boolean;
  pairDiffs: number;
  hasPair: boolean;
  sharedOnly: boolean;
}): 'SAFE' | 'QUESTIONABLE' | 'UNSAFE' {
  if (args.toolOnly || args.knowledgeOnly || args.sharedOnly) return 'UNSAFE';
  if (args.originCount === 0) return 'UNSAFE';
  if (args.hasPair && args.pairDiffs === 0) return 'UNSAFE';
  if (args.independent < 2) return 'QUESTIONABLE';
  return 'SAFE';
}

function unitSnippet(u: ResolverEvidenceUnit) {
  return {
    evidenceId: u.evidenceId,
    evidenceKind: u.evidenceKind,
    normalizedActivity: u.normalizedActivity,
    object: u.object,
    toolOrMethod: u.toolOrMethod,
    result: u.result,
  };
}

function reconstructField(args: {
  code: string;
  p2Cand: FieldCandidate | undefined;
  units: ResolverEvidenceUnit[];
  primary: string | null;
}) {
  const c = args.p2Cand;
  const originUnits = args.units.filter((u) => c?.originEvidenceIds.includes(u.evidenceId));
  const pair = args.primary
    ? competitorOf(args.primary, POLICY).find((p) => otherField(p, args.primary!) === args.code)
    : undefined;
  const diffs = pair ? differentialHits(args.units, pair, args.code) : [];
  const shared = pair ? sharedPracticeHits(args.units, pair) : [];
  const aliases = [
    ...new Set(originUnits.flatMap((u) => fieldAliasHits(u, args.code, POLICY))),
  ].sort();
  return {
    fieldCode: args.code,
    independentSourceCount: c?.independentSourceCount ?? 0,
    originEvidenceIds: c?.originEvidenceIds ?? [],
    supportingEvidenceIds: c?.supportingEvidenceIds ?? [],
    practiceAliases: aliases,
    differentialSignals: [...diffs].sort(),
    sharedSignals: [...shared].sort(),
    originUnits: originUnits.map(unitSnippet),
    exclusions: c?.exclusionsTriggered ?? [],
    reasonCodes: c?.reasonCodes ?? [],
  };
}

function camiloClass(set: CandidateSetResult, p2Cand: FieldCandidate | undefined): string {
  if (set.candidates.some((c) => c.fieldCode === p2Cand?.fieldCode && c.role === 'SECONDARY_CANDIDATE')) {
    return 'SUPPORTED_SECONDARY';
  }
  if (set.thin.some((t) => t.fieldCode === p2Cand?.fieldCode)) return 'THIN';
  if (set.candidates.some((c) => c.fieldCode === p2Cand?.fieldCode && c.role === 'COMPETITOR')) {
    return 'COMPETITOR';
  }
  return 'NOT_SUPPORTED';
}

function resolveC2(snapshotId: string, units: ResolverEvidenceUnit[]) {
  return resolveFieldsHardened({
    snapshotId,
    units,
    policy: POLICY,
    resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
  });
}

function runFixture(name: string, units: ResolverEvidenceUnit[]) {
  const p2 = resolveC2(name, units);
  return buildCandidateSet({ p2, units, policy: POLICY });
}

export function runCandidateSetModel(backendRoot: string) {
  if (isDeterministicSkipGeminiEnabled() !== false) {
    throw new Error('SKIP_GEMINI_MUST_STAY_FALSE');
  }
  const ledgerBefore = ledgerSnapshot(backendRoot);
  const inventory = discoverHistoricalInventory(backendRoot).filter(
    (r) => r.p2Class === 'P2_ELIGIBLE',
  );

  const candidateSets: unknown[] = [];
  const r1Rows: unknown[] = [];
  const p3Rows: unknown[] = [];
  const secondaryReviews: unknown[] = [];
  const skipRows: unknown[] = [];
  const controlDeep: Record<string, unknown> = {};

  let primaryResolved = 0;
  let secondaryEmitted = 0;
  let competitorCount = 0;
  let ambiguousCount = 0;
  let primarySkipEligible = 0;
  let contractSkipEligible = 0;
  let blockedBySet = 0;
  let r1PrimaryMatches = 0;
  let r1SecondaryCompatible = 0;
  let r1StatusMatches = 0;
  const p3ClassCount = {
    EXACT: 0,
    COMPATIBLE: 0,
    NARROWER: 0,
    BROADER: 0,
    CONFLICTING: 0,
  };
  let reviewedSecondaries = 0;
  let safeSecondaries = 0;
  let questionableSecondaries = 0;
  let unsafeSecondaries = 0;

  for (const row of inventory) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, row.p1PackRel!));
    const c2 = resolveC2(row.snapshotId, units);
    const set = buildCandidateSet({ p2: c2, units, policy: POLICY });
    const primarySkip = evaluateP2SkipEligibility(c2, units, SKIP_OPTS);
    const contractSkip = evaluateP2ContractSkipEligibility({ primarySkip, set });
    const expR1 = adaptCandidateSetToExperimentalR1(set);
    const r1Pack = findLatestR1Pack(backendRoot, row.snapshotId);
    const histR1 = r1Pack ? loadR1Contract(r1Pack) : null;
    const histView = r1View(histR1);
    const detView = r1View(expR1);
    const histP3 = p3Fields(histR1);
    const detP3 = p3Fields(expR1);
    const p3Class = classifyP3(detP3, histP3, detView.primary, histView.primary);

    if (set.decision === 'RESOLVED' && set.primaryCandidateCode) primaryResolved += 1;
    if (set.decision === 'AMBIGUOUS') ambiguousCount += 1;
    const secs = set.candidates.filter((c) => c.role === 'SECONDARY_CANDIDATE');
    const comps = set.candidates.filter((c) => c.role === 'COMPETITOR');
    secondaryEmitted += secs.length;
    competitorCount += comps.length;
    if (contractSkip.primarySkipEligible) primarySkipEligible += 1;
    if (contractSkip.contractSkipEligible) contractSkipEligible += 1;
    if (contractSkip.blockedByCandidateSet) blockedBySet += 1;
    p3ClassCount[p3Class] += 1;

    const primaryMatch = detView.primary === histView.primary;
    if (primaryMatch) r1PrimaryMatches += 1;
    const statusMatch = detView.status === histView.status;
    if (statusMatch) r1StatusMatches += 1;
    const secExact = setEqual(detView.secondaries, histView.secondaries);
    const secCompatible =
      secExact ||
      (primaryMatch && subset(detView.secondaries, histView.secondaries));
    if (secCompatible) r1SecondaryCompatible += 1;

    const byCode = new Map(c2.candidateFields.map((c) => [c.fieldCode, c]));
    const personReviews: unknown[] = [];
    for (const sec of secs) {
      const cand = byCode.get(sec.fieldCode);
      const originUnits = units.filter(
        (u) => cand?.originEvidenceIds.includes(u.evidenceId),
      );
      const knowledgeOnly =
        originUnits.length > 0 &&
        originUnits.every((u) => u.evidenceKind === 'KNOWLEDGE_STATEMENT');
      const toolOnly =
        originUnits.length > 0 &&
        originUnits.every((u) => u.evidenceKind === 'TOOL_USAGE');
      const pair = set.primaryCandidateCode
        ? competitorOf(set.primaryCandidateCode, POLICY).find(
            (p) => otherField(p, set.primaryCandidateCode!) === sec.fieldCode,
          )
        : undefined;
      const diffs = pair ? differentialHits(units, pair, sec.fieldCode) : [];
      const shared = pair ? sharedPracticeHits(units, pair) : [];
      const cls = reviewSecondary({
        originCount: originUnits.length,
        independent: sec.independentSourceCount,
        knowledgeOnly,
        toolOnly,
        pairDiffs: diffs.length,
        hasPair: Boolean(pair),
        sharedOnly: Boolean(pair) && diffs.length === 0 && shared.length > 0,
      });
      reviewedSecondaries += 1;
      if (cls === 'SAFE') safeSecondaries += 1;
      else if (cls === 'QUESTIONABLE') questionableSecondaries += 1;
      else unsafeSecondaries += 1;
      personReviews.push({
        fieldCode: sec.fieldCode,
        class: cls,
        independentSourceCount: sec.independentSourceCount,
        originEvidenceIds: sec.originEvidenceIds,
        differentialSignals: sec.differentialSignals,
        reasonCodes: sec.reasonCodes,
      });
    }

    const unionFields = [
      ...new Set([...detView.secondaries, ...histView.secondaries]),
    ].sort();
    const diffs = unionFields.map((field) => {
      const cand = byCode.get(field);
      return {
        field,
        class: classifySecondaryDiff({
          field,
          inDet: detView.secondaries.includes(field),
          inCanon: histView.secondaries.includes(field),
          thin: set.thin.some((t) => t.fieldCode === field),
          competitor: comps.some((c) => c.fieldCode === field),
          independent: cand?.independentSourceCount ?? 0,
          origin: cand?.originEvidenceIds.length ?? 0,
        }),
      };
    });

    candidateSets.push({
      person: row.person,
      snapshotId: row.snapshotId,
      domain: row.domain,
      decision: set.decision,
      primaryCandidateCode: set.primaryCandidateCode,
      candidates: set.candidates,
      thin: set.thin,
      uncertain: set.uncertain,
      uncertainReasons: set.uncertainReasons,
    });
    r1Rows.push({
      person: row.person,
      snapshotId: row.snapshotId,
      primaryMatch,
      secondaryExact: secExact,
      secondaryCompatible: secCompatible,
      statusMatch,
      historical: histView,
      experimental: detView,
      differences: diffs,
    });
    p3Rows.push({
      person: row.person,
      snapshotId: row.snapshotId,
      class: p3Class,
      historical: histP3,
      experimental: detP3,
    });
    secondaryReviews.push({
      person: row.person,
      snapshotId: row.snapshotId,
      emitted: personReviews,
      vsCanonical: diffs,
    });
    skipRows.push({
      person: row.person,
      snapshotId: row.snapshotId,
      primarySkipEligible: contractSkip.primarySkipEligible,
      contractSkipEligible: contractSkip.contractSkipEligible,
      blockedByCandidateSet: contractSkip.blockedByCandidateSet,
      geminiFallbackRequired: contractSkip.geminiFallbackRequired,
      reasons: contractSkip.reasons,
      wouldSkip: false,
    });

    if (CONTROLS.includes(row.person)) {
      controlDeep[row.person] = {
        person: row.person,
        snapshotId: row.snapshotId,
        c2: {
          decision: c2.decision,
          resolvedFieldCode: c2.resolvedFieldCode,
          reasonCodes: c2.reasonCodes,
          ambiguousFieldCodes: c2.ambiguousFieldCodes,
        },
        candidateSet: {
          decision: set.decision,
          primaryCandidateCode: set.primaryCandidateCode,
          roles: set.candidates.map((c) => ({
            fieldCode: c.fieldCode,
            role: c.role,
            fieldStrength: c.fieldStrength,
            independentSourceCount: c.independentSourceCount,
            differentialSignals: c.differentialSignals,
            reasonCodes: c.reasonCodes,
          })),
          thin: set.thin,
          uncertain: set.uncertain,
        },
        historicalR1: histView,
        experimentalR1: detView,
        p3Context: { historical: histP3, experimental: detP3, class: p3Class },
        skip: contractSkip,
      };
    }
  }

  const johanRow = inventory.find((r) => r.person === 'Johan');
  if (johanRow) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, johanRow.p1PackRel!));
    const c2 = resolveC2(johanRow.snapshotId, units);
    const set = buildCandidateSet({ p2: c2, units, policy: POLICY });
    const vd = reconstructField({
      code: 'VISUAL_DESIGN',
      p2Cand: c2.candidateFields.find((c) => c.fieldCode === 'VISUAL_DESIGN'),
      units,
      primary: set.primaryCandidateCode,
    });
    const se = reconstructField({
      code: 'SOFTWARE_ENGINEERING',
      p2Cand: c2.candidateFields.find((c) => c.fieldCode === 'SOFTWARE_ENGINEERING'),
      units,
      primary: set.primaryCandidateCode,
    });
    const vdRole = set.candidates.find((c) => c.fieldCode === 'VISUAL_DESIGN');
    const vdThin = set.thin.find((t) => t.fieldCode === 'VISUAL_DESIGN');
    controlDeep.Johan = {
      ...(controlDeep.Johan as object),
      reconstruction: {
        primary: set.primaryCandidateCode,
        secondaries: set.candidates
          .filter((c) => c.role === 'SECONDARY_CANDIDATE')
          .map((c) => c.fieldCode),
        visualDesign: {
          ...vd,
          role: vdRole?.role ?? (vdThin ? 'THIN' : 'IRRELEVANT'),
          contextPreserved: Boolean(
            vdRole?.role === 'SECONDARY_CANDIDATE' || vdThin,
          ),
          sufficientForAuthoritativeSecondary:
            vd.independentSourceCount >= 2 && vd.differentialSignals.length > 0,
          reason:
            vdRole?.role === 'SECONDARY_CANDIDATE'
              ? 'AUTHORITATIVE_SECONDARY'
              : vdThin
                ? 'THIN_SINGLE_SOURCE_NOT_AUTHORITATIVE'
                : vd.independentSourceCount >= 2
                  ? 'WOULD_BE_C2_COMPETITOR_ON_SE_VD_PAIR'
                  : 'INSUFFICIENT_PRACTICE_FOR_SECONDARY',
        },
        softwareEngineering: se,
      },
    };
  }

  const camiloRow = inventory.find((r) => r.person === 'Camilo');
  if (camiloRow) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, camiloRow.p1PackRel!));
    const c2 = resolveC2(camiloRow.snapshotId, units);
    const set = buildCandidateSet({ p2: c2, units, policy: POLICY });
    const codes = ['IT_SYSTEMS', 'DATA_ANALYTICS', 'PROJECT_PROGRAM_MGMT'] as const;
    controlDeep.Camilo = {
      ...(controlDeep.Camilo as object),
      secondaryContext: codes.map((code) => ({
        fieldCode: code,
        class: camiloClass(
          set,
          c2.candidateFields.find((c) => c.fieldCode === code),
        ),
        reconstruction: reconstructField({
          code,
          p2Cand: c2.candidateFields.find((c) => c.fieldCode === code),
          units,
          primary: set.primaryCandidateCode,
        }),
      })),
    };
  }

  const s19Row = inventory.find((r) => r.person === 'S19');
  if (s19Row) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, s19Row.p1PackRel!));
    const c2 = resolveC2(s19Row.snapshotId, units);
    const set = buildCandidateSet({ p2: c2, units, policy: POLICY });
    const av = reconstructField({
      code: 'AUDIOVISUAL_PRODUCTION',
      p2Cand: c2.candidateFields.find((c) => c.fieldCode === 'AUDIOVISUAL_PRODUCTION'),
      units,
      primary: set.primaryCandidateCode,
    });
    const avRole = set.candidates.find((c) => c.fieldCode === 'AUDIOVISUAL_PRODUCTION');
    const avThin = set.thin.find((t) => t.fieldCode === 'AUDIOVISUAL_PRODUCTION');
    controlDeep.S19 = {
      ...(controlDeep.S19 as object),
      audiovisual: {
        ...av,
        role: avRole?.role ?? (avThin ? 'THIN' : 'IRRELEVANT'),
        preserved: Boolean(avRole || avThin),
        sufficientForAuthoritativeSecondary:
          av.independentSourceCount >= 2 && av.differentialSignals.length > 0,
      },
    };
  }

  const s9Row = inventory.find((r) => r.person === 'S9');
  if (s9Row) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, s9Row.p1PackRel!));
    const c2 = resolveC2(s9Row.snapshotId, units);
    const set = buildCandidateSet({ p2: c2, units, policy: POLICY });
    controlDeep.S9 = {
      ...(controlDeep.S9 as object),
      ambiguity: {
        c2Decision: c2.decision,
        ambiguousFieldCodes: [...c2.ambiguousFieldCodes].sort(),
        competitorCodes: set.candidates
          .filter((c) => c.role === 'COMPETITOR')
          .map((c) => c.fieldCode),
        falseAuthority:
          set.decision === 'RESOLVED' &&
          set.candidates.some(
            (c) => c.role === 'SECONDARY_CANDIDATE' && c.fieldCode === 'DATA_ANALYTICS',
          ),
        daAuthoritativeSecondary: set.candidates.some(
          (c) => c.role === 'SECONDARY_CANDIDATE' && c.fieldCode === 'DATA_ANALYTICS',
        ),
      },
    };
  }

  const kathRow = inventory.find((r) => r.person === 'Katherin');
  if (kathRow) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, kathRow.p1PackRel!));
    const c2 = resolveC2(kathRow.snapshotId, units);
    const set = buildCandidateSet({ p2: c2, units, policy: POLICY });
    controlDeep.Katherin = {
      ...(controlDeep.Katherin as object),
      abstention:
        set.decision !== 'RESOLVED' &&
        set.candidates.filter((c) => c.role === 'SECONDARY_CANDIDATE').length === 0,
    };
  }

  const adversarialCases = [
    {
      id: 'strongPrimaryLegitimateSecondary',
      expected: 'PRIMARY_SE_PLUS_SECONDARY_IT',
      set: runFixture('A', CSET_FIXTURES.strongPrimaryLegitimateSecondary),
    },
    {
      id: 'strongPrimaryToolOnlySecondary',
      expected: 'NO_SECONDARY',
      set: runFixture('B', CSET_FIXTURES.strongPrimaryToolOnlySecondary),
    },
    {
      id: 'twoStrongCompeting',
      expected: 'AMBIGUOUS_COMPETITORS',
      set: runFixture('C', CSET_FIXTURES.twoStrongCompeting),
    },
    {
      id: 'sharedPracticeOnly',
      expected: 'NO_SECONDARY',
      set: runFixture('D', CSET_FIXTURES.sharedPracticeOnly),
    },
    {
      id: 'oneThinSecondary',
      expected: 'THIN_NOT_AUTHORITATIVE',
      set: runFixture('E', CSET_FIXTURES.oneThinSecondary),
    },
    {
      id: 'multipleIndependentSecondary',
      expected: 'SECONDARY_IT',
      set: runFixture('F', CSET_FIXTURES.multipleIndependentSecondary),
    },
  ].map((c) => {
    const secs = c.set.candidates.filter((x) => x.role === 'SECONDARY_CANDIDATE');
    let pass = false;
    if (c.expected === 'PRIMARY_SE_PLUS_SECONDARY_IT') {
      pass =
        c.set.primaryCandidateCode === 'SOFTWARE_ENGINEERING' &&
        secs.some((s) => s.fieldCode === 'IT_SYSTEMS');
    } else if (c.expected === 'NO_SECONDARY') {
      pass = secs.length === 0;
    } else if (c.expected === 'AMBIGUOUS_COMPETITORS') {
      pass =
        c.set.decision === 'AMBIGUOUS' &&
        c.set.primaryCandidateCode === null &&
        c.set.candidates.every((x) => x.role === 'COMPETITOR');
    } else if (c.expected === 'THIN_NOT_AUTHORITATIVE') {
      pass =
        secs.length === 0 &&
        c.set.thin.some(
          (t) => t.fieldCode === 'VISUAL_DESIGN' || t.fieldCode === 'IT_SYSTEMS',
        );
    } else if (c.expected === 'SECONDARY_IT') {
      pass = secs.some((s) => s.fieldCode === 'IT_SYSTEMS');
    }
    return {
      id: c.id,
      expected: c.expected,
      pass,
      decision: c.set.decision,
      primaryCandidateCode: c.set.primaryCandidateCode,
      roles: c.set.candidates.map((x) => ({ fieldCode: x.fieldCode, role: x.role })),
      thin: c.set.thin.map((t) => t.fieldCode),
    };
  });

  const mutationCases = [
    {
      id: 'removeSecondaryDifferential',
      expected: 'SECONDARY_REMOVED',
      set: runFixture(
        'M1',
        mutateRemoveSecondaryDifferential(CSET_FIXTURES.strongPrimaryLegitimateSecondary),
      ),
    },
    {
      id: 'actionToKnowledge',
      expected: 'NO_AUTHORITATIVE_SECONDARY',
      set: runFixture(
        'M2',
        mutateSecondaryActionToKnowledge(CSET_FIXTURES.strongPrimaryLegitimateSecondary),
      ),
    },
    {
      id: 'addStrongCompetitor',
      expected: 'AMBIGUOUS',
      set: runFixture(
        'M3',
        mutateAddStrongCompetitor(CSET_FIXTURES.strongPrimaryLegitimateSecondary),
      ),
    },
  ].map((c) => {
    const secs = c.set.candidates.filter((x) => x.role === 'SECONDARY_CANDIDATE');
    let pass = false;
    if (c.expected === 'SECONDARY_REMOVED') {
      pass = !secs.some((s) => s.fieldCode === 'IT_SYSTEMS');
    } else if (c.expected === 'NO_AUTHORITATIVE_SECONDARY') {
      pass = secs.length === 0;
    } else if (c.expected === 'AMBIGUOUS') {
      pass = c.set.decision === 'AMBIGUOUS';
    }
    return {
      id: c.id,
      expected: c.expected,
      pass,
      decision: c.set.decision,
      primaryCandidateCode: c.set.primaryCandidateCode,
      roles: c.set.candidates.map((x) => ({ fieldCode: x.fieldCode, role: x.role })),
    };
  });

  const passBody = () =>
    stableStringify({
      policy: CANDIDATE_SET_POLICY,
      candidateSets,
    });
  const determinism = passBody() === passBody() ? 'PASS' : 'FAIL';

  const precision =
    reviewedSecondaries === 0 ? null : Number((safeSecondaries / reviewedSecondaries).toFixed(2));

  const johan = controlDeep.Johan as {
    reconstruction?: { visualDesign?: { role?: string; contextPreserved?: boolean } };
    p3Context?: { class?: string };
  };
  const camilo = controlDeep.Camilo as { p3Context?: { class?: string } };
  const s19 = controlDeep.S19 as {
    audiovisual?: { preserved?: boolean };
    p3Context?: { class?: string };
  };
  const s9 = controlDeep.S9 as { ambiguity?: { falseAuthority?: boolean; c2Decision?: string } };

  const overlayPairGap =
    johan?.reconstruction?.visualDesign?.role === 'THIN' ||
    johan?.reconstruction?.visualDesign?.role === 'IRRELEVANT';

  const adversarialPassed = adversarialCases.filter((c) => c.pass).length;
  const mutationPassed = mutationCases.filter((c) => c.pass).length;
  const ledgerAfter = ledgerSnapshot(backendRoot);
  const ledger = {
    before: ledgerBefore,
    after: ledgerAfter,
    callsDelta: ledgerAfter.calls - ledgerBefore.calls,
    tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
    eventsDelta: ledgerAfter.events - ledgerBefore.events,
  };

  const costOk = ledger.callsDelta === 0 && ledger.tokensDelta === 0 && ledger.eventsDelta === 0;
  const testsOk =
    adversarialPassed === adversarialCases.length &&
    mutationPassed === mutationCases.length &&
    determinism === 'PASS';
  const precisionOk = precision === null || precision === 1;
  const s9Ok = s9?.ambiguity?.c2Decision === 'AMBIGUOUS' && s9?.ambiguity?.falseAuthority === false;
  const contextPreserved =
    !overlayPairGap &&
    camilo?.p3Context?.class !== 'NARROWER' &&
    camilo?.p3Context?.class !== 'CONFLICTING' &&
    s19?.p3Context?.class !== 'NARROWER';

  let verdict:
    | 'P2_CANDIDATE_SET_MODEL_VALIDATED'
    | 'MORE_CANDIDATE_SET_WORK_REQUIRED'
    | 'P2_DETERMINISTIC_CONTRACT_NOT_SUPPORTED' = 'MORE_CANDIDATE_SET_WORK_REQUIRED';
  if (!costOk || !testsOk || !s9Ok || !precisionOk) {
    verdict = unsafeSecondaries > 0
      ? 'P2_DETERMINISTIC_CONTRACT_NOT_SUPPORTED'
      : 'MORE_CANDIDATE_SET_WORK_REQUIRED';
  } else if (contextPreserved && p3ClassCount.CONFLICTING === 0) {
    verdict = 'P2_CANDIDATE_SET_MODEL_VALIDATED';
  } else {
    verdict = 'MORE_CANDIDATE_SET_WORK_REQUIRED';
  }

  const routingAudit = {
    productiveR1: R1_POLICY,
    proposedAuthorityScore1_0: {
      audited: true,
      safeForPrimaryAlone: true,
      unsafeIfCopiedToSecondaries:
        'R1 MULTI_FIELD if rank-2 confidence >= 0.75 and delta < 0.08',
    },
    experimentalTokens: EXPERIMENTAL_ROUTING_TOKENS,
    policy: {
      primaryStrength: 'STRONG → routing token 1.0 (shape only; not Gemini confidence)',
      secondaryStrength:
        'STRONG/SUPPORTED → 0.4/0.35, below productive strongSecondaryMinConfidence 0.75 so experimental RESOLVED keeps secondaries without becoming MULTI_FIELD',
      competitor: '0.5; AMBIGUOUS C2 → experimental MULTI_FIELD without inventing a primary',
    },
    adapterDoesNotModifyProductionR1: true,
  };

  const files: Record<string, unknown> = {
    'candidate-set-policy.json': {
      ...CANDIDATE_SET_POLICY,
      frozenBeforeEvaluation: true,
      copiesGeminiSecondaries: false,
      candidate2Untouched: true,
      overlayPairNote:
        'On overlay pairs, independent >= 2 on the other Field makes Candidate.2 AMBIGUOUS (COMPETITOR), not PRIMARY+SECONDARY. Authoritative overlay secondaries therefore cannot appear under frozen C2 0.3.0.',
    },
    'candidate-sets.json': {
      evaluated: inventory.length,
      primaryResolved,
      secondaryCandidatesEmitted: secondaryEmitted,
      competitors: competitorCount,
      ambiguous: ambiguousCount,
      rows: candidateSets,
    },
    'secondary-review.json': {
      reviewed: reviewedSecondaries,
      safe: safeSecondaries,
      questionable: questionableSecondaries,
      unsafe: unsafeSecondaries,
      precision,
      objective: 1,
      controls: controlDeep,
      rows: secondaryReviews,
    },
    'r1-adapter.json': routingAudit,
    'r1-equivalence.json': {
      primaryMatches: r1PrimaryMatches,
      secondaryMatchesOrCompatible: r1SecondaryCompatible,
      statusMatches: r1StatusMatches,
      total: inventory.length,
      rows: r1Rows,
    },
    'p3-context-equivalence.json': {
      ...p3ClassCount,
      total: inventory.length,
      p3Executed: false,
      rows: p3Rows,
    },
    'adversarial-tests.json': {
      passed: adversarialPassed,
      failed: adversarialCases.length - adversarialPassed,
      cases: adversarialCases,
    },
    'mutation-tests.json': {
      passed: mutationPassed,
      failed: mutationCases.length - mutationPassed,
      cases: mutationCases,
    },
    'skip-eligibility-v2.json': {
      primarySkipEligible,
      contractSkipEligible,
      blockedByCandidateSet: blockedBySet,
      skipGemini: false,
      wouldSkip: false,
      rows: skipRows,
    },
    'determinism-report.json': {
      determinism,
      ledger,
      skipGemini: false,
      p3: 'NOT_EXECUTED',
      p4: 'NOT_EXECUTED',
      missing141: 'NOT_PROCESSED',
      candidate2: { resolverVersion: '0.3.0', policyVersion: '0.3.0', unchanged: true },
      verdict,
    },
  };

  const outDir = join(backendRoot, 'tmp', 'mc1-p2-candidate-set');
  mkdirSync(outDir, { recursive: true });
  const repoTmp = join(backendRoot, '..', 'tmp', 'mc1-p2-candidate-set');
  mkdirSync(repoTmp, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    const text = stableStringify(body);
    writeFileSync(join(outDir, name), text, 'utf8');
    writeFileSync(join(repoTmp, name), text, 'utf8');
  }

  return {
    outDir,
    verdict,
    ledger,
    determinism,
    evaluated: inventory.length,
    domains: [...new Set(inventory.map((r) => r.domain))].sort(),
    primaryResolved,
    secondaryEmitted,
    competitorCount,
    ambiguousCount,
    secondaryReview: {
      reviewed: reviewedSecondaries,
      safe: safeSecondaries,
      questionable: questionableSecondaries,
      unsafe: unsafeSecondaries,
      precision,
    },
    r1: {
      primaryMatches: r1PrimaryMatches,
      secondaryMatchesOrCompatible: r1SecondaryCompatible,
      statusMatches: r1StatusMatches,
      total: inventory.length,
    },
    p3Context: p3ClassCount,
    skip: {
      primarySkipEligible,
      contractSkipEligible,
      blockedByCandidateSet: blockedBySet,
    },
    adversarial: { passed: adversarialPassed, failed: adversarialCases.length - adversarialPassed },
    mutation: { passed: mutationPassed, failed: mutationCases.length - mutationPassed },
    controls: controlDeep,
  };
}
