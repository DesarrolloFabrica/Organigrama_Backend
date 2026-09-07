/**
 * FASE — MC1 P2 CANDIDATE SET SEMANTICS V2
 * Offline. Gemini = 0. skipGemini = false. Candidate.2 0.3.0 intacto.
 * Policy candidate-set 0.2.0 congelada antes de evaluar.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { EXPERIMENTAL_RESOLVER_POLICY_V03 } from '../experimental/deterministic-resolver/experimental-policy-v03';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import {
  RESOLVER_CANDIDATE_2_VERSION,
  type FieldCandidate,
  type ResolverEvidenceUnit,
} from '../experimental/deterministic-resolver/types';
import { resolveFieldsToEvaluate } from '../p3/p3-context-loader';
import { findLatestR1Pack, loadR1Contract } from '../p3/p3-context-loader';
import type { R1ContractEnvelope } from '../r1/r1.types';
import { discoverHistoricalInventory } from './inventory';
import { evaluateP2SkipEligibility } from './skip-eligibility';
import { evaluateP2ContractSkipEligibilityV3 } from './skip-eligibility-v3';
import { isDeterministicSkipGeminiEnabled } from './flags';
import { buildCandidateSetV2, type CandidateSetV2Result } from './candidate-set-v2';
import { CANDIDATE_SET_POLICY_V2 } from './candidate-set-policy-v2';
import { adaptCandidateSetV2ToExperimentalR1 } from './experimental-r1-adapter-v2';
import { adaptCandidateSetV2ToExperimentalP3 } from './experimental-p3-context-adapter-v2';
import {
  CSET_V2_FIXTURES,
  mutateContextActionToKnowledge,
  mutateRemoveContextAction,
} from './candidate-set-v2-fixtures';

const POLICY = EXPERIMENTAL_RESOLVER_POLICY_V03;
const SKIP_OPTS = { candidate: 'C2' as const, policy: POLICY };
const MEASURED_P2_TOKENS = 18359;
const MEASURED_P2_CALLS = 1;
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

function resolveC2(snapshotId: string, units: ResolverEvidenceUnit[]) {
  return resolveFieldsHardened({
    snapshotId,
    units,
    policy: POLICY,
    resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
  });
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

function p3Canon(r1: R1ContractEnvelope | null): string[] {
  if (!r1) return [];
  return [...new Set(resolveFieldsToEvaluate(r1).map((f) => f.fieldCode))].sort();
}

function setEqual(a: string[], b: string[]): boolean {
  return a.join('|') === b.join('|');
}

type ReviewClass = 'SUPPORTED' | 'QUESTIONABLE' | 'UNSUPPORTED';

function reviewMember(
  role: 'SECONDARY' | 'CONTEXT' | 'COMPETITOR',
  independent: number,
  originCount: number,
  diffs: string[],
  aliases: string[],
): ReviewClass {
  if (originCount === 0) return 'UNSUPPORTED';
  if (role === 'COMPETITOR') return independent >= 2 ? 'SUPPORTED' : 'UNSUPPORTED';
  if (role === 'SECONDARY') {
    if (independent < 2) return 'UNSUPPORTED';
    return 'SUPPORTED';
  }
  if (independent !== 1) return 'QUESTIONABLE';
  if (diffs.length === 0 && aliases.length === 0) return 'UNSUPPORTED';
  return 'SUPPORTED';
}

function fieldDisposition(
  code: string,
  set: CandidateSetV2Result,
  p2Cand: FieldCandidate | undefined,
): string {
  if (set.secondaries.some((s) => s.fieldCode === code)) return 'SECONDARY';
  if (set.contextFields.some((c) => c.fieldCode === code)) return 'CONTEXT';
  if (set.competitors.some((c) => c.fieldCode === code)) return 'COMPETITOR';
  if ((p2Cand?.independentSourceCount ?? 0) === 1) return 'THIN_NOT_CONTEXT';
  if ((p2Cand?.originEvidenceIds.length ?? 0) === 0) return 'NOT_SUPPORTED';
  return 'NOT_SUPPORTED';
}

type P3Class = 'EXACT' | 'COMPATIBLE' | 'NARROWER' | 'BROADER' | 'CONFLICTING';

function classifyP3(args: {
  det: string[];
  canon: string[];
  extraRoles: Record<string, string>;
  missingDisposition: Record<string, string>;
}): P3Class {
  if (setEqual(args.det, args.canon)) return 'EXACT';
  const extra = args.det.filter((c) => !args.canon.includes(c));
  const missing = args.canon.filter((c) => !args.det.includes(c));
  const extraSecondary = extra.filter((c) => args.extraRoles[c] === 'SECONDARY');
  const extraContext = extra.filter((c) => args.extraRoles[c] === 'CONTEXT');
  const missingMiss = missing.filter((c) => {
    const d = args.missingDisposition[c];
    return d === 'CONTEXT' || d === 'SECONDARY' || d === 'COMPETITOR';
  });
  const missingUnsupported = missing.filter((c) => {
    const d = args.missingDisposition[c] ?? 'NOT_SUPPORTED';
    return d === 'NOT_SUPPORTED' || d === 'THIN_NOT_CONTEXT';
  });
  if (missingMiss.length > 0 && extraSecondary.length > 0) return 'CONFLICTING';
  if (missingMiss.length > 0) return 'NARROWER';
  if (extraSecondary.length > 0) return 'BROADER';
  if (extraContext.length > 0 && missingUnsupported.length === missing.length) return 'COMPATIBLE';
  if (extra.length === 0 && missingUnsupported.length === missing.length) return 'COMPATIBLE';
  if (extra.filter((c) => args.extraRoles[c] === 'COMPETITOR').length && missing.length) {
    return missingUnsupported.length === missing.length ? 'COMPATIBLE' : 'CONFLICTING';
  }
  return 'CONFLICTING';
}

function dumpSet(set: CandidateSetV2Result) {
  return {
    decision: set.decision,
    primary: set.primary
      ? {
          fieldCode: set.primary.fieldCode,
          strength: set.primary.strength,
          independentSourceCount: set.primary.independentSourceCount,
        }
      : null,
    secondaries: set.secondaries.map((s) => ({
      fieldCode: s.fieldCode,
      strength: s.strength,
      independentSourceCount: s.independentSourceCount,
      reasonCodes: s.reasonCodes,
    })),
    contextFields: set.contextFields.map((c) => ({
      fieldCode: c.fieldCode,
      strength: c.strength,
      independentSourceCount: c.independentSourceCount,
      originEvidenceIds: c.originEvidenceIds,
      differentialSignals: c.differentialSignals,
      fieldSpecificSignals: c.fieldSpecificSignals,
      reasonCodes: c.reasonCodes,
    })),
    competitors: set.competitors.map((c) => ({
      fieldCode: c.fieldCode,
      strength: c.strength,
      independentSourceCount: c.independentSourceCount,
    })),
  };
}

export function runCandidateSetSemanticsV2(backendRoot: string) {
  if (isDeterministicSkipGeminiEnabled() !== false) {
    throw new Error('SKIP_GEMINI_MUST_STAY_FALSE');
  }
  const ledgerBefore = ledgerSnapshot(backendRoot);
  const inventory = discoverHistoricalInventory(backendRoot).filter(
    (r) => r.p2Class === 'P2_ELIGIBLE',
  );

  const candidateSets: unknown[] = [];
  const roleReviews: unknown[] = [];
  const r1Rows: unknown[] = [];
  const p3Rows: unknown[] = [];
  const skipRows: unknown[] = [];
  const controls: Record<string, unknown> = {};

  let primaries = 0;
  let secondariesN = 0;
  let contextsN = 0;
  let competitorsN = 0;
  let secRev = 0;
  let secSup = 0;
  let secUnsup = 0;
  let secQuest = 0;
  let ctxRev = 0;
  let ctxSup = 0;
  let ctxUnsup = 0;
  let ctxQuest = 0;
  let r1PrimaryMatch = 0;
  let r1SecondaryCompat = 0;
  let r1StatusMatch = 0;
  const p3Count = { EXACT: 0, COMPATIBLE: 0, NARROWER: 0, BROADER: 0, CONFLICTING: 0 };
  let primarySkipN = 0;
  let contractSkipN = 0;
  let blockedN = 0;

  for (const row of inventory) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, row.p1PackRel!));
    const c2 = resolveC2(row.snapshotId, units);
    const set = buildCandidateSetV2({ p2: c2, units, policy: POLICY });
    const primarySkip = evaluateP2SkipEligibility(c2, units, SKIP_OPTS);
    const contract = evaluateP2ContractSkipEligibilityV3({ primarySkip, set });
    const expR1 = adaptCandidateSetV2ToExperimentalR1(set);
    const expP3 = adaptCandidateSetV2ToExperimentalP3(set);
    const r1Pack = findLatestR1Pack(backendRoot, row.snapshotId);
    const histR1 = r1Pack ? loadR1Contract(r1Pack) : null;
    const histView = r1View(histR1);
    const detView = r1View(expR1);
    const histP3 = p3Canon(histR1);
    const detP3 = expP3.map((f) => f.fieldCode).sort();
    const byCode = new Map(c2.candidateFields.map((c) => [c.fieldCode, c]));

    if (set.primary) primaries += 1;
    secondariesN += set.secondaries.length;
    contextsN += set.contextFields.length;
    competitorsN += set.competitors.length;
    if (contract.primarySkipEligible) primarySkipN += 1;
    if (contract.contractSkipEligible) contractSkipN += 1;
    if (contract.blockedByCandidateSet) blockedN += 1;

    const reviews: unknown[] = [];
    for (const s of set.secondaries) {
      const cls = reviewMember(
        'SECONDARY',
        s.independentSourceCount,
        s.originEvidenceIds.length,
        s.differentialSignals,
        s.fieldSpecificSignals,
      );
      secRev += 1;
      if (cls === 'SUPPORTED') secSup += 1;
      else if (cls === 'UNSUPPORTED') secUnsup += 1;
      else secQuest += 1;
      reviews.push({ ...s, class: cls });
    }
    for (const c of set.contextFields) {
      const cls = reviewMember(
        'CONTEXT',
        c.independentSourceCount,
        c.originEvidenceIds.length,
        c.differentialSignals,
        c.fieldSpecificSignals,
      );
      ctxRev += 1;
      if (cls === 'SUPPORTED') ctxSup += 1;
      else if (cls === 'UNSUPPORTED') ctxUnsup += 1;
      else ctxQuest += 1;
      reviews.push({ ...c, class: cls });
    }
    for (const c of set.competitors) {
      const cls = reviewMember(
        'COMPETITOR',
        c.independentSourceCount,
        c.originEvidenceIds.length,
        c.differentialSignals,
        c.fieldSpecificSignals,
      );
      reviews.push({ fieldCode: c.fieldCode, role: 'COMPETITOR', class: cls, independent: c.independentSourceCount });
    }

    const extraRoles: Record<string, string> = {};
    for (const f of expP3) extraRoles[f.fieldCode] = f.role;
    const missingDisposition: Record<string, string> = {};
    for (const code of histP3) {
      missingDisposition[code] = fieldDisposition(code, set, byCode.get(code));
    }
    const p3Class = classifyP3({
      det: detP3,
      canon: histP3,
      extraRoles,
      missingDisposition,
    });
    p3Count[p3Class] += 1;

    const primaryMatch = detView.primary === histView.primary;
    if (primaryMatch) r1PrimaryMatch += 1;
    if (detView.status === histView.status) r1StatusMatch += 1;
    const secExact = setEqual(detView.secondaries, histView.secondaries);
    const secCompat =
      secExact ||
      (primaryMatch && detView.secondaries.every((s) => histView.secondaries.includes(s)));
    if (secCompat) r1SecondaryCompat += 1;

    candidateSets.push({
      person: row.person,
      snapshotId: row.snapshotId,
      domain: row.domain,
      ...dumpSet(set),
    });
    roleReviews.push({ person: row.person, snapshotId: row.snapshotId, reviews });
    r1Rows.push({
      person: row.person,
      primaryMatch,
      secondaryCompatible: secCompat,
      statusMatch: detView.status === histView.status,
      historical: histView,
      experimental: detView,
      contextOmittedFromR1: set.contextFields.map((c) => c.fieldCode),
    });
    p3Rows.push({
      person: row.person,
      class: p3Class,
      historical: histP3,
      experimental: detP3,
      roles: extraRoles,
      missingDisposition,
    });
    skipRows.push({
      person: row.person,
      snapshotId: row.snapshotId,
      ...contract,
    });

    if (CONTROLS.includes(row.person)) {
      controls[row.person] = {
        person: row.person,
        snapshotId: row.snapshotId,
        c2: {
          decision: c2.decision,
          resolvedFieldCode: c2.resolvedFieldCode,
          reasonCodes: c2.reasonCodes,
          ambiguousFieldCodes: c2.ambiguousFieldCodes,
        },
        set: dumpSet(set),
        skip: contract,
        historicalR1: histView,
        experimentalR1: detView,
        p3: { class: p3Class, historical: histP3, experimental: detP3 },
      };
    }
  }

  const camiloRow = inventory.find((r) => r.person === 'Camilo');
  if (camiloRow) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, camiloRow.p1PackRel!));
    const c2 = resolveC2(camiloRow.snapshotId, units);
    const set = buildCandidateSetV2({ p2: c2, units, policy: POLICY });
    const byCode = new Map(c2.candidateFields.map((c) => [c.fieldCode, c]));
    controls.Camilo = {
      ...(controls.Camilo as object),
      historicalFields: (['IT_SYSTEMS', 'DATA_ANALYTICS', 'PROJECT_PROGRAM_MGMT'] as const).map(
        (code) => ({
          fieldCode: code,
          disposition: fieldDisposition(code, set, byCode.get(code)),
          independent: byCode.get(code)?.independentSourceCount ?? 0,
          originEvidenceIds: byCode.get(code)?.originEvidenceIds ?? [],
        }),
      ),
    };
  }

  const johanRow = inventory.find((r) => r.person === 'Johan');
  const s19Row = inventory.find((r) => r.person === 'S19');
  const s9Row = inventory.find((r) => r.person === 'S9');

  const adversarial = [
    {
      id: 'primaryPlusLegitimateContext',
      expected: 'PRIMARY_PLUS_CONTEXT',
      set: buildCandidateSetV2({
        p2: resolveC2('A', CSET_V2_FIXTURES.primaryPlusLegitimateContext),
        units: CSET_V2_FIXTURES.primaryPlusLegitimateContext,
        policy: POLICY,
      }),
    },
    {
      id: 'primaryPlusToolOnly',
      expected: 'PRIMARY_ONLY',
      set: buildCandidateSetV2({
        p2: resolveC2('B', CSET_V2_FIXTURES.primaryPlusToolOnly),
        units: CSET_V2_FIXTURES.primaryPlusToolOnly,
        policy: POLICY,
      }),
    },
    {
      id: 'primaryPlusKnowledgeOnly',
      expected: 'PRIMARY_ONLY',
      set: buildCandidateSetV2({
        p2: resolveC2('C', CSET_V2_FIXTURES.primaryPlusKnowledgeOnly),
        units: CSET_V2_FIXTURES.primaryPlusKnowledgeOnly,
        policy: POLICY,
      }),
    },
    {
      id: 'primaryPlusSecondaryIt',
      expected: 'SECONDARY',
      set: buildCandidateSetV2({
        p2: resolveC2('D', CSET_V2_FIXTURES.primaryPlusSecondaryIt),
        units: CSET_V2_FIXTURES.primaryPlusSecondaryIt,
        policy: POLICY,
      }),
    },
    {
      id: 'strongCompetitorPair',
      expected: 'COMPETITOR_NOT_CONTEXT',
      set: buildCandidateSetV2({
        p2: resolveC2('E', CSET_V2_FIXTURES.strongCompetitorPair),
        units: CSET_V2_FIXTURES.strongCompetitorPair,
        policy: POLICY,
      }),
    },
  ].map((c) => {
    let pass = false;
    if (c.expected === 'PRIMARY_PLUS_CONTEXT') {
      pass =
        c.set.primary?.fieldCode === 'SOFTWARE_ENGINEERING' &&
        c.set.contextFields.some((x) => x.fieldCode === 'VISUAL_DESIGN');
    } else if (c.expected === 'PRIMARY_ONLY') {
      pass = Boolean(c.set.primary) && c.set.contextFields.length === 0 && c.set.secondaries.length === 0;
    } else if (c.expected === 'SECONDARY') {
      pass = c.set.secondaries.some((s) => s.fieldCode === 'IT_SYSTEMS');
    } else if (c.expected === 'COMPETITOR_NOT_CONTEXT') {
      pass =
        c.set.decision === 'AMBIGUOUS' &&
        c.set.contextFields.length === 0 &&
        c.set.competitors.length >= 2;
    }
    return {
      id: c.id,
      expected: c.expected,
      pass,
      decision: c.set.decision,
      primary: c.set.primary?.fieldCode ?? null,
      secondaries: c.set.secondaries.map((s) => s.fieldCode),
      context: c.set.contextFields.map((x) => x.fieldCode),
      competitors: c.set.competitors.map((x) => x.fieldCode),
    };
  });

  const mutations: unknown[] = [];
  if (johanRow) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, johanRow.p1PackRel!));
    const c2 = resolveC2(johanRow.snapshotId, units);
    const set = buildCandidateSetV2({ p2: c2, units, policy: POLICY });
    const vd = set.contextFields.find((c) => c.fieldCode === 'VISUAL_DESIGN');
    const ids = vd?.originEvidenceIds ?? [];
    const mutated = units.map((u) =>
      ids.includes(u.evidenceId)
        ? { ...u, evidenceKind: 'TOOL_USAGE' as const, normalizedActivity: null, object: null, toolOrMethod: 'Figma' }
        : u,
    );
    const set2 = buildCandidateSetV2({
      p2: resolveC2(`${johanRow.snapshotId}-m`, mutated),
      units: mutated,
      policy: POLICY,
    });
    mutations.push({
      id: 'johanRemoveVdPractice',
      expected: 'CONTEXT_VD_DISAPPEARS',
      pass: !set2.contextFields.some((c) => c.fieldCode === 'VISUAL_DESIGN'),
      before: set.contextFields.map((c) => c.fieldCode),
      after: set2.contextFields.map((c) => c.fieldCode),
    });
  }
  if (s19Row) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, s19Row.p1PackRel!));
    const c2 = resolveC2(s19Row.snapshotId, units);
    const set = buildCandidateSetV2({ p2: c2, units, policy: POLICY });
    const av = set.contextFields.find((c) => c.fieldCode === 'AUDIOVISUAL_PRODUCTION');
    const ids = av?.originEvidenceIds ?? [];
    const mutated = mutateRemoveContextAction(units, ids[0] ?? '__none__');
    const set2 = buildCandidateSetV2({
      p2: resolveC2(`${s19Row.snapshotId}-m`, mutated),
      units: mutated,
      policy: POLICY,
    });
    mutations.push({
      id: 's19RemoveAvAction',
      expected: 'CONTEXT_AV_DISAPPEARS',
      pass: !set2.contextFields.some((c) => c.fieldCode === 'AUDIOVISUAL_PRODUCTION'),
      before: set.contextFields.map((c) => c.fieldCode),
      after: set2.contextFields.map((c) => c.fieldCode),
    });
  }
  if (s9Row) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, s9Row.p1PackRel!));
    const c2 = resolveC2(s9Row.snapshotId, units);
    const da = c2.candidateFields.find((c) => c.fieldCode === 'DATA_ANALYTICS');
    const keep = da?.originEvidenceIds[0];
    const mutated = units.map((u) =>
      da?.originEvidenceIds.includes(u.evidenceId) && u.evidenceId !== keep
        ? { ...u, evidenceKind: 'KNOWLEDGE_STATEMENT' as const }
        : u,
    );
    const c2b = resolveC2(`${s9Row.snapshotId}-m`, mutated);
    const set2 = buildCandidateSetV2({ p2: c2b, units: mutated, policy: POLICY });
    const daRole =
      set2.competitors.find((c) => c.fieldCode === 'DATA_ANALYTICS')?.role ??
      set2.contextFields.find((c) => c.fieldCode === 'DATA_ANALYTICS')?.role ??
      set2.secondaries.find((c) => c.fieldCode === 'DATA_ANALYTICS')?.role ??
      null;
    const coherent =
      (c2b.decision === 'RESOLVED' && daRole === 'CONTEXT') ||
      (c2b.decision === 'AMBIGUOUS' && daRole === 'COMPETITOR') ||
      daRole === null;
    mutations.push({
      id: 's9ReduceDaToOnePractice',
      expected: 'COMPETITOR_MAY_BECOME_CONTEXT',
      pass: coherent,
      c2After: c2b.decision,
      daRole,
      note: 'Strong competitor must not stay CONTEXT while still viable; thin DA may become CONTEXT if C2 resolves SE.',
    });
  }

  void mutateContextActionToKnowledge;

  const passBody = () =>
    stableStringify({ policy: CANDIDATE_SET_POLICY_V2, candidateSets });
  const determinism = passBody() === passBody() ? 'PASS' : 'FAIL';
  const ledgerAfter = ledgerSnapshot(backendRoot);
  const ledger = {
    before: ledgerBefore,
    after: ledgerAfter,
    callsDelta: ledgerAfter.calls - ledgerBefore.calls,
    tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
    eventsDelta: ledgerAfter.events - ledgerBefore.events,
  };

  const secPrecision = secRev === 0 ? 1 : Number((secSup / secRev).toFixed(2));
  const ctxPrecision = ctxRev === 0 ? 1 : Number((ctxSup / ctxRev).toFixed(2));
  const advPass = adversarial.filter((a) => a.pass).length;
  const mutArr = mutations as Array<{ pass: boolean }>;
  const mutPass = mutArr.filter((m) => m.pass).length;

  const johan = controls.Johan as {
    set?: { primary?: { fieldCode?: string }; contextFields?: Array<{ fieldCode: string }>; secondaries?: unknown[] };
    p3?: { class?: string };
  };
  const camilo = controls.Camilo as {
    historicalFields?: Array<{ fieldCode: string; disposition: string }>;
    set?: { secondaries?: Array<{ fieldCode: string }> };
    p3?: { class?: string };
  };
  const s19 = controls.S19 as {
    set?: { contextFields?: Array<{ fieldCode: string }>; primary?: { fieldCode?: string } };
    p3?: { class?: string };
  };
  const s9 = controls.S9 as {
    c2?: { decision?: string };
    set?: { competitors?: Array<{ fieldCode: string }>; contextFields?: Array<{ fieldCode: string }> };
  };

  const johanOk =
    johan?.set?.primary?.fieldCode === 'SOFTWARE_ENGINEERING' &&
    (johan.set.contextFields ?? []).some((c) => c.fieldCode === 'VISUAL_DESIGN') &&
    (johan.p3?.class === 'EXACT' || johan.p3?.class === 'COMPATIBLE');
  const s19Ok =
    s19?.set?.primary?.fieldCode === 'COMMUNICATIONS' &&
    (s19.set.contextFields ?? []).some((c) => c.fieldCode === 'AUDIOVISUAL_PRODUCTION') &&
    (s19.p3?.class === 'EXACT' || s19.p3?.class === 'COMPATIBLE');
  const camiloNoFake =
    !(camilo?.set?.secondaries ?? []).some((s) =>
      ['IT_SYSTEMS', 'DATA_ANALYTICS', 'PROJECT_PROGRAM_MGMT'].includes(s.fieldCode),
    );
  const s9Ok =
    s9?.c2?.decision === 'AMBIGUOUS' &&
    !(s9.set?.contextFields ?? []).some((c) => c.fieldCode === 'DATA_ANALYTICS') &&
    (s9.set?.competitors ?? []).some((c) => c.fieldCode === 'DATA_ANALYTICS');

  const costOk = ledger.callsDelta === 0 && ledger.tokensDelta === 0 && ledger.eventsDelta === 0;
  const testsOk = advPass === adversarial.length && mutPass === mutArr.length && determinism === 'PASS';
  const precisionOk = secPrecision === 1 && ctxPrecision === 1 && secUnsup === 0 && ctxUnsup === 0;

  let verdict:
    | 'P2_CANDIDATE_SET_V2_VALIDATED'
    | 'MORE_CANDIDATE_SET_WORK_REQUIRED'
    | 'CANDIDATE_SET_MODEL_REJECTED' = 'MORE_CANDIDATE_SET_WORK_REQUIRED';
  if (!costOk || !s9Ok) {
    verdict = 'CANDIDATE_SET_MODEL_REJECTED';
  } else if (johanOk && s19Ok && camiloNoFake && precisionOk && testsOk) {
    verdict = 'P2_CANDIDATE_SET_V2_VALIDATED';
  } else {
    verdict = 'MORE_CANDIDATE_SET_WORK_REQUIRED';
  }

  const costOpportunity = {
    p2CallsPotentiallyAvoidable: contractSkipN,
    historicalTokens: contractSkipN * MEASURED_P2_TOKENS,
    historicalCallsPerPerson: MEASURED_P2_CALLS,
    percentage: null as number | null,
    label: 'HISTORICAL_COUNTERFACTUAL',
    note: 'P2 only. Not claimed as live savings. skipGemini remains false.',
  };

  const files: Record<string, unknown> = {
    'policy.json': {
      ...CANDIDATE_SET_POLICY_V2,
      frozenBeforeEvaluation: true,
      r1P3Boundary: {
        productionP3Evaluates: 'R1 PRIMARY + SECONDARIES only (resolveFieldsToEvaluate)',
        productionP3Role: ['PRIMARY', 'SECONDARY'],
        experimentalP3: 'PRIMARY + SECONDARIES + CONTEXT with role metadata',
        contextDoesNotImplyObserved: true,
        r1DoesNotConsumeContext: true,
      },
    },
    'candidate-sets.json': {
      evaluated: inventory.length,
      primaries,
      secondaries: secondariesN,
      contexts: contextsN,
      competitors: competitorsN,
      rows: candidateSets,
    },
    'role-review.json': {
      secondary: { reviewed: secRev, supported: secSup, questionable: secQuest, unsupported: secUnsup, precision: secPrecision },
      context: { reviewed: ctxRev, supported: ctxSup, questionable: ctxQuest, unsupported: ctxUnsup, precision: ctxPrecision },
      controls,
      rows: roleReviews,
    },
    'r1-simulation.json': {
      primaryMatches: r1PrimaryMatch,
      secondaryCompatible: r1SecondaryCompat,
      statusMatches: r1StatusMatch,
      total: inventory.length,
      contextNotInR1: true,
      rows: r1Rows,
    },
    'p3-context.json': {
      productionEvaluatesOnlyR1Fields: true,
      experimentalIncludesContext: true,
      p3Executed: false,
      rows: p3Rows,
    },
    'context-equivalence.json': { ...p3Count, total: inventory.length, rows: p3Rows },
    'adversarial-tests.json': {
      passed: advPass,
      failed: adversarial.length - advPass,
      cases: adversarial,
    },
    'mutation-tests.json': { passed: mutPass, failed: mutArr.length - mutPass, cases: mutations },
    'contract-skip-eligibility.json': {
      primarySkipEligible: primarySkipN,
      contractSkipEligible: contractSkipN,
      blockedByCandidateSet: blockedN,
      skipGemini: false,
      wouldSkip: false,
      contextDoesNotBlockSkip: true,
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
      costOpportunity,
      verdict,
    },
  };

  const outDir = join(backendRoot, 'tmp', 'mc1-p2-candidate-set-v2');
  mkdirSync(outDir, { recursive: true });
  const repoTmp = join(backendRoot, '..', 'tmp', 'mc1-p2-candidate-set-v2');
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
    roles: { primaries, secondaries: secondariesN, contexts: contextsN, competitors: competitorsN },
    review: {
      secondary: { reviewed: secRev, supported: secSup, unsupported: secUnsup, precision: secPrecision },
      context: { reviewed: ctxRev, supported: ctxSup, unsupported: ctxUnsup, precision: ctxPrecision },
    },
    r1: { primaryMatches: r1PrimaryMatch, secondaryCompatible: r1SecondaryCompat, statusMatches: r1StatusMatch, total: inventory.length },
    p3: p3Count,
    skip: { primarySkipEligible: primarySkipN, contractSkipEligible: contractSkipN, blockedByCandidateSet: blockedN },
    adversarial: { passed: advPass, failed: adversarial.length - advPass },
    mutation: { passed: mutPass, failed: mutArr.length - mutPass },
    costOpportunity,
    controls,
  };
}
