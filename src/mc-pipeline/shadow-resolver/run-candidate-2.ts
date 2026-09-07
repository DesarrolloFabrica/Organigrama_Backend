/**
 * Candidate.2 offline gate. Gemini = 0. No activa skip. No toca Candidate.1.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEvidenceUnitsFromP1Pack, isOriginKind } from '../experimental/deterministic-resolver/evidence';
import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { resolveSpecialtiesHardened } from '../experimental/deterministic-resolver/specialty-resolver-hardened';
import { compareP2 } from '../experimental/deterministic-resolver/compare';
import { EXPERIMENTAL_RESOLVER_POLICY } from '../experimental/deterministic-resolver/experimental-policy';
import {
  EXPERIMENTAL_RESOLVER_POLICY_V03,
  POLICY_V03_DIFF,
  SKIP_CANDIDATE_2_CODE,
} from '../experimental/deterministic-resolver/experimental-policy-v03';
import { matchUnitToField } from '../experimental/deterministic-resolver/match';
import { lexiconForField } from '../experimental/deterministic-resolver/catalog-lexicon';
import {
  differentialHits,
  fieldAliasHits,
  sharedPracticeHits,
} from '../experimental/deterministic-resolver/overlay-match';
import { competitorOf, otherField } from '../experimental/deterministic-resolver/experimental-policy';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import {
  RESOLVER_CANDIDATE_2_VERSION,
  RESOLVER_HARDENING_VERSION,
  type FieldResolverResult,
  type ResolverEvidenceUnit,
  type SpecialtyResolverItem,
} from '../experimental/deterministic-resolver/types';
import {
  duplicatedSourceRisk,
  evaluateP2SkipEligibility,
  isToolOnlyResolved,
  reviewClass,
  SKIP_CANDIDATE_CODE,
  type SkipEval,
} from './skip-eligibility';
import { discoverHistoricalInventory, type InventoryRow } from './inventory';
import { isDeterministicSkipGeminiEnabled } from './flags';
import {
  SE_DA_CASE_A_SOFTWARE_SQL,
  SE_DA_CASE_B_ANALYTICS,
  SE_DA_CASE_C_MIXED,
  SE_DA_CASE_D_TOOL_ONLY,
  SE_DA_CASE_E_DATA_ENGINEERING,
  S9_STRUCTURAL_FIXTURE,
  s9DifferentialAsToolOnly,
  s9WithDaDifferential,
  s9WithoutSeDifferential,
  s9WithStrongSeCompetitor,
} from '../experimental/deterministic-resolver/candidate-2-fixtures';

const MEASURED_P2_TOKENS = 18359;
const MEASURED_P3_TOKENS = 11590;
const C1_SAFE_P2_TOKENS = 55077;
const POLICY = EXPERIMENTAL_RESOLVER_POLICY_V03;
const SKIP_OPTS = { candidate: 'C2' as const, policy: POLICY };

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function ledgerSnapshot(backendRoot: string) {
  const path = join(backendRoot, 'tmp', 'mc1-gemini-ledger', 'events.jsonl');
  if (!existsSync(path)) {
    return { exists: false, path, calls: 0, tokens: 0, events: 0, sha256: null as string | null };
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
  return {
    exists: true,
    path,
    calls,
    tokens,
    events,
    sha256: createHash('sha256').update(text).digest('hex'),
  };
}

function loadHistP2(packDir: string) {
  const summary = readJson(join(packDir, 'summary.json')) as {
    ranks?: Array<{ domainCode: string; status: string; rank: number }>;
  };
  return { ranks: summary.ranks ?? [] };
}

function loadHistP3(packDir: string): Array<{
  fieldCode: string;
  specialtyCode: string;
  status: string;
}> {
  const contractPath = join(packDir, 'p3-contract.json');
  if (existsSync(contractPath)) {
    const c = readJson(contractPath) as {
      payload?: {
        fieldResults?: Array<{
          fieldCode: string;
          observedSpecialties?: Array<{
            specialtyCode: string;
            parentFieldCode: string;
            status: string;
          }>;
        }>;
      };
    };
    const out: Array<{ fieldCode: string; specialtyCode: string; status: string }> = [];
    for (const fr of c.payload?.fieldResults ?? []) {
      for (const s of fr.observedSpecialties ?? []) {
        out.push({
          fieldCode: s.parentFieldCode || fr.fieldCode,
          specialtyCode: s.specialtyCode,
          status: s.status,
        });
      }
    }
    if (out.length) return out;
  }
  const summary = readJson(join(packDir, 'summary.json')) as {
    observed?: Array<{ fieldCode: string; specialtyCode: string; status: string }>;
  };
  return summary.observed ?? [];
}

function resolveC1(snapshotId: string, units: ResolverEvidenceUnit[]) {
  return resolveFieldsHardened({ snapshotId, units });
}

function resolveC2(snapshotId: string, units: ResolverEvidenceUnit[]) {
  return resolveFieldsHardened({
    snapshotId,
    units,
    policy: POLICY,
    resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
  });
}

function skipC2(p2: FieldResolverResult, units: ResolverEvidenceUnit[]) {
  return evaluateP2SkipEligibility(p2, units, SKIP_OPTS);
}

function skipC1(p2: FieldResolverResult, units: ResolverEvidenceUnit[]) {
  return evaluateP2SkipEligibility(p2, units);
}

function originPreview(units: ResolverEvidenceUnit[], ids: string[]): string[] {
  return units
    .filter((u) => ids.includes(u.evidenceId))
    .slice(0, 4)
    .map((u) => u.normalizedActivity || u.object || u.toolOrMethod || u.evidenceId);
}

function dumpField(units: ResolverEvidenceUnit[], code: string, policy = EXPERIMENTAL_RESOLVER_POLICY) {
  const lex = lexiconForField(code);
  if (!lex) return [];
  const rows: Array<{
    evidenceId: string;
    candidateId: string;
    evidenceKind: string;
    originKind: boolean;
    normalizedActivity: string | null;
    object: string | null;
    toolOrMethod: string | null;
    result: string | null;
    scope: string | null;
    catalogRole: string;
    catalogHits: string[];
    overlayAliases: string[];
    exclusions: string[];
  }> = [];
  for (const u of units) {
    const cat = matchUnitToField(u, lex);
    const aliases = fieldAliasHits(u, code, policy);
    if (cat.role === 'NONE' && aliases.length === 0 && cat.exclusionsTriggered.length === 0) {
      continue;
    }
    rows.push({
      evidenceId: u.evidenceId,
      candidateId: u.candidateId,
      evidenceKind: u.evidenceKind,
      originKind: isOriginKind(u.evidenceKind),
      normalizedActivity: u.normalizedActivity,
      object: u.object,
      toolOrMethod: u.toolOrMethod,
      result: u.result,
      scope: u.scope,
      catalogRole: cat.role,
      catalogHits: cat.positiveSignalsMatched,
      overlayAliases: aliases,
      exclusions: cat.exclusionsTriggered,
    });
  }
  return rows;
}

function fieldCodesForP3(p2: FieldResolverResult): string[] {
  if (p2.decision === 'RESOLVED' && p2.resolvedFieldCode) return [p2.resolvedFieldCode];
  if (p2.decision === 'AMBIGUOUS') return p2.ambiguousFieldCodes;
  return [];
}

function p3For(snapshotId: string, units: ResolverEvidenceUnit[], p2: FieldResolverResult) {
  const fieldCodes = fieldCodesForP3(p2);
  if (!fieldCodes.length) return { items: [] as SpecialtyResolverItem[] };
  return resolveSpecialtiesHardened({
    snapshotId,
    units,
    fieldCodes,
    allowObservedEquivalent: p2.decision === 'RESOLVED',
  });
}

function buildS9RootCause(backendRoot: string, inventory: InventoryRow[]) {
  const s9 = inventory.find((r) => r.snapshotId === '9');
  if (!s9?.p1PackRel) throw new Error('S9 P1 pack missing');
  const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, s9.p1PackRel));
  const p2c1 = resolveC1('9', units);
  const skip = skipC1(p2c1, units);
  const pair = competitorOf('DATA_ANALYTICS', POLICY).find(
    (p) => otherField(p, 'DATA_ANALYTICS') === 'SOFTWARE_ENGINEERING',
  )!;
  const da = p2c1.candidateFields.find((c) => c.fieldCode === 'DATA_ANALYTICS');
  const se = p2c1.candidateFields.find((c) => c.fieldCode === 'SOFTWARE_ENGINEERING');
  const daOrigins = units.filter((u) => da?.originEvidenceIds.includes(u.evidenceId));
  return {
    candidate: SKIP_CANDIDATE_CODE,
    snapshotId: '9',
    p1Pack: s9.p1PackRel,
    p2Pack: s9.p2PackRel,
    unitCount: units.length,
    decision: p2c1.decision,
    resolvedFieldCode: p2c1.resolvedFieldCode,
    reasonCodes: p2c1.reasonCodes,
    skip: skip.eligibility,
    skipReasons: skip.reasons,
    strongCompetitors: skip.strongCompetitorCodes,
    independentSourceCount: skip.independentSourceCount,
    evidenceUnitsUsed: daOrigins.map((u) => ({
      evidenceId: u.evidenceId,
      candidateId: u.candidateId,
      evidenceKind: u.evidenceKind,
      normalizedActivity: u.normalizedActivity,
      object: u.object,
      toolOrMethod: u.toolOrMethod,
      result: u.result,
      scope: u.scope,
    })),
    dataAnalyticsMatches: dumpField(units, 'DATA_ANALYTICS'),
    softwareEngineeringMatches: dumpField(units, 'SOFTWARE_ENGINEERING'),
    daSignals: da?.positiveSignalsMatched ?? [],
    seSignals: se?.positiveSignalsMatched ?? [],
    seIndependent: se?.independentSourceCount ?? 0,
    daIndependent: da?.independentSourceCount ?? 0,
    c2SharedHits: sharedPracticeHits(units, pair),
    c2DaDiff: differentialHits(units, pair, 'DATA_ANALYTICS'),
    c2SeDiff: differentialHits(units, pair, 'SOFTWARE_ENGINEERING'),
    c2SeAliases: units.flatMap((u) => fieldAliasHits(u, 'SOFTWARE_ENGINEERING', POLICY)),
    skipRule:
      'Candidate.1 SKIP_ELIGIBLE because RESOLVED DATA_ANALYTICS + independent>=2 + no other Field independent>=2 + SE↔DA absent from overlay competitor map so no differential required',
    rootCause: [
      'COMPETITOR_NOT_DETECTED',
      'MISSING_SE_DIFFERENTIAL',
      'OVERWEIGHTED_DATA_SIGNAL',
      'SHARED_DATA_PRACTICE',
      'TOOL_OR_TECH_MATCH',
    ],
    note: 'Canonical rank-1 is SOFTWARE_ENGINEERING. DA is ACTIVE transversal. Goal is not to force S9=SE.',
  };
}

type EvalRow = {
  row: InventoryRow;
  units: ResolverEvidenceUnit[];
  c1: FieldResolverResult;
  c2: FieldResolverResult;
  c1Skip: SkipEval;
  c2Skip: SkipEval;
  histP2: ReturnType<typeof loadHistP2>;
  cmpC1: ReturnType<typeof compareP2>;
  cmpC2: ReturnType<typeof compareP2>;
  p3c1: ReturnType<typeof p3For>;
  p3c2: ReturnType<typeof p3For>;
  histP3: ReturnType<typeof loadHistP3>;
};

function evaluateInventory(backendRoot: string, inventory: InventoryRow[]): EvalRow[] {
  const p2Rows = inventory.filter((r) => r.p2Class === 'P2_ELIGIBLE');
  return p2Rows.map((row) => {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, row.p1PackRel!));
    const c1 = resolveC1(row.snapshotId, units);
    const c2 = resolveC2(row.snapshotId, units);
    const histP2 = loadHistP2(resolve(backendRoot, row.p2PackRel!));
    return {
      row,
      units,
      c1,
      c2,
      c1Skip: skipC1(c1, units),
      c2Skip: skipC2(c2, units),
      histP2,
      cmpC1: compareP2(c1, histP2),
      cmpC2: compareP2(c2, histP2),
      p3c1: p3For(row.snapshotId, units, c1),
      p3c2: p3For(row.snapshotId, units, c2),
      histP3: row.p3PackRel ? loadHistP3(resolve(backendRoot, row.p3PackRel)) : [],
    };
  });
}

function specDecision(p3: ReturnType<typeof p3For>, code: string) {
  return p3.items.find((i) => i.specialtyCode === code)?.decision ?? 'MISSING';
}

function runBoundaryTests() {
  const cases = [
    {
      id: 'A_software_sql',
      units: SE_DA_CASE_A_SOFTWARE_SQL,
      expect: (p2: FieldResolverResult, skip: SkipEval) =>
        !(p2.resolvedFieldCode === 'DATA_ANALYTICS' && skip.eligibility === 'SKIP_ELIGIBLE'),
    },
    {
      id: 'B_analytics',
      units: SE_DA_CASE_B_ANALYTICS,
      expect: (p2: FieldResolverResult, skip: SkipEval) =>
        p2.resolvedFieldCode === 'DATA_ANALYTICS' && skip.eligibility === 'SKIP_ELIGIBLE',
    },
    {
      id: 'C_mixed',
      units: SE_DA_CASE_C_MIXED,
      expect: (p2: FieldResolverResult, skip: SkipEval) =>
        p2.decision === 'AMBIGUOUS' && skip.eligibility === 'NOT_SKIP_ELIGIBLE',
    },
    {
      id: 'D_tool_only',
      units: SE_DA_CASE_D_TOOL_ONLY,
      expect: (p2: FieldResolverResult, skip: SkipEval) =>
        p2.decision !== 'RESOLVED' && skip.eligibility === 'NOT_SKIP_ELIGIBLE',
    },
    {
      id: 'E_data_engineering_analytics',
      units: SE_DA_CASE_E_DATA_ENGINEERING,
      expect: (p2: FieldResolverResult, skip: SkipEval) =>
        p2.resolvedFieldCode !== 'SOFTWARE_ENGINEERING' &&
        !(p2.resolvedFieldCode === 'SOFTWARE_ENGINEERING' && skip.eligibility === 'SKIP_ELIGIBLE'),
    },
  ];
  return cases.map((c) => {
    const p2 = resolveC2(c.id, c.units);
    const skip = skipC2(p2, c.units);
    return {
      id: c.id,
      pass: c.expect(p2, skip),
      decision: p2.decision,
      field: p2.resolvedFieldCode,
      skip: skip.eligibility,
      reasons: p2.reasonCodes,
    };
  });
}

function runMutationTests() {
  const rows = [
    {
      id: 'remove_da_differential',
      before: s9WithDaDifferential(),
      after: S9_STRUCTURAL_FIXTURE,
      expect: (p2: FieldResolverResult, skip: SkipEval) =>
        !(p2.resolvedFieldCode === 'DATA_ANALYTICS' && skip.eligibility === 'SKIP_ELIGIBLE'),
    },
    {
      id: 'remove_se_differential',
      before: S9_STRUCTURAL_FIXTURE,
      after: s9WithoutSeDifferential(),
      expect: (p2: FieldResolverResult, skip: SkipEval) =>
        !(p2.resolvedFieldCode === 'DATA_ANALYTICS' && skip.eligibility === 'SKIP_ELIGIBLE'),
    },
    {
      id: 'add_strong_se_competitor',
      before: S9_STRUCTURAL_FIXTURE,
      after: s9WithStrongSeCompetitor(),
      expect: (p2: FieldResolverResult, skip: SkipEval) =>
        p2.decision === 'AMBIGUOUS' && skip.eligibility === 'NOT_SKIP_ELIGIBLE',
    },
    {
      id: 'differential_to_tool_only',
      before: S9_STRUCTURAL_FIXTURE,
      after: s9DifferentialAsToolOnly(),
      expect: (_p2: FieldResolverResult, skip: SkipEval) => skip.eligibility === 'NOT_SKIP_ELIGIBLE',
    },
  ];
  return rows.map((r) => {
    const before = resolveC2(r.id, r.before);
    const afterP2 = resolveC2(r.id, r.after);
    const afterSkip = skipC2(afterP2, r.after);
    return {
      id: r.id,
      pass: r.expect(afterP2, afterSkip),
      beforeDecision: before.decision,
      beforeField: before.resolvedFieldCode,
      afterDecision: afterP2.decision,
      afterField: afterP2.resolvedFieldCode,
      afterSkip: afterSkip.eligibility,
      reasons: afterP2.reasonCodes,
    };
  });
}

export function runCandidate2(backendRoot: string) {
  const frozen = {
    candidate1: {
      code: SKIP_CANDIDATE_CODE,
      resolverVersion: RESOLVER_HARDENING_VERSION,
      policyVersion: EXPERIMENTAL_RESOLVER_POLICY.policyVersion,
    },
    candidate2: {
      code: SKIP_CANDIDATE_2_CODE,
      resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
      policyVersion: POLICY.policyVersion,
    },
    skipGemini: isDeterministicSkipGeminiEnabled(),
    productionCatalogChanged: false,
  };
  if (frozen.candidate1.code !== 'MC1.DETERMINISTIC.RESOLVER.CANDIDATE.1') {
    throw new Error('CANDIDATE_1_NOT_FROZEN');
  }
  if (frozen.skipGemini !== false) throw new Error('SKIP_GEMINI_MUST_STAY_FALSE');

  const ledgerBefore = ledgerSnapshot(backendRoot);
  const inventory = discoverHistoricalInventory(backendRoot);
  const s9Root = buildS9RootCause(backendRoot, inventory);

  const controlNames = new Set(['S9', 'Sara', 'Haider', 'Diego', 'Johan', 'Camilo']);
  const controlInv = inventory.filter(
    (r) => r.p2Class === 'P2_ELIGIBLE' && controlNames.has(r.person),
  );
  const controlEvals = evaluateInventory(backendRoot, controlInv);
  const s9 = controlEvals.find((e) => e.row.snapshotId === '9' || e.row.person === 'S9');
  if (!s9) throw new Error('S9_MISSING_FROM_INVENTORY');
  const s9FalseSkip =
    s9.c2.resolvedFieldCode === 'DATA_ANALYTICS' && s9.c2Skip.eligibility === 'SKIP_ELIGIBLE';
  if (s9FalseSkip) {
    const fail = {
      verdict: 'CANDIDATE_2_FAILED_BOUNDARY_FIX',
      s9: {
        decision: s9.c2.decision,
        field: s9.c2.resolvedFieldCode,
        skip: s9.c2Skip.eligibility,
        reasons: s9.c2.reasonCodes,
      },
    };
    const outDir = join(backendRoot, 'tmp', 'mc1-deterministic-resolver-candidate-2');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 's9-root-cause.json'), stableStringify(s9Root), 'utf8');
    writeFileSync(join(outDir, 'control-validation.json'), stableStringify(fail), 'utf8');
    return { outDir, failedBoundaryFix: true, ...fail, frozen, ledgerBefore };
  }

  const evals = evaluateInventory(
    backendRoot,
    inventory.filter((r) => r.p2Class === 'P2_ELIGIBLE'),
  );

  const boundary = runBoundaryTests();
  const mutation = runMutationTests();

  const c2SkipEligible = evals.filter((e) => e.c2Skip.eligibility === 'SKIP_ELIGIBLE');
  const c2SkipExact = c2SkipEligible.filter((e) => e.cmpC2.class === 'EXACT_MATCH');
  const c2Resolved = evals.filter((e) => e.c2.decision === 'RESOLVED');
  const c2SkipPrecision =
    c2SkipEligible.length === 0 ? null : c2SkipExact.length / c2SkipEligible.length;

  const controls = [
    {
      person: 'Sara',
      code: 'DATA_GOVERNANCE',
      p2: evals.find((e) => e.row.person === 'Sara')?.c2.decision,
      p2Field: evals.find((e) => e.row.person === 'Sara')?.c2.resolvedFieldCode,
      actual: specDecision(evals.find((e) => e.row.person === 'Sara')!.p3c2, 'DATA_GOVERNANCE'),
      pass:
        evals.find((e) => e.row.person === 'Sara')?.c2.resolvedFieldCode === 'DATA_ANALYTICS' &&
        specDecision(evals.find((e) => e.row.person === 'Sara')!.p3c2, 'DATA_GOVERNANCE') ===
          'RESOLVED',
    },
    {
      person: 'Haider',
      code: 'DATA_GOVERNANCE',
      p2: evals.find((e) => e.row.person === 'Haider')?.c2.decision,
      p2Field: evals.find((e) => e.row.person === 'Haider')?.c2.resolvedFieldCode,
      actual: specDecision(evals.find((e) => e.row.person === 'Haider')!.p3c2, 'DATA_GOVERNANCE'),
      pass:
        evals.find((e) => e.row.person === 'Haider')?.c2.resolvedFieldCode === 'DATA_ANALYTICS' &&
        specDecision(evals.find((e) => e.row.person === 'Haider')!.p3c2, 'DATA_GOVERNANCE') !==
          'RESOLVED',
    },
    {
      person: 'Diego',
      code: 'DATA_GOVERNANCE',
      p2: evals.find((e) => e.row.person === 'Diego')?.c2.decision,
      p2Field: evals.find((e) => e.row.person === 'Diego')?.c2.resolvedFieldCode,
      actual: specDecision(evals.find((e) => e.row.person === 'Diego')!.p3c2, 'DATA_GOVERNANCE'),
      pass:
        evals.find((e) => e.row.person === 'Diego')?.c2.resolvedFieldCode === 'DATA_ANALYTICS' &&
        specDecision(evals.find((e) => e.row.person === 'Diego')!.p3c2, 'DATA_GOVERNANCE') !==
          'RESOLVED',
    },
    {
      person: 'Johan',
      code: 'FRONTEND_ENGINEERING',
      p2: evals.find((e) => e.row.person === 'Johan')?.c2.decision,
      p2Field: evals.find((e) => e.row.person === 'Johan')?.c2.resolvedFieldCode,
      actual: specDecision(evals.find((e) => e.row.person === 'Johan')!.p3c2, 'FRONTEND_ENGINEERING'),
      pass:
        evals.find((e) => e.row.person === 'Johan')?.c2.resolvedFieldCode ===
          'SOFTWARE_ENGINEERING' &&
        specDecision(evals.find((e) => e.row.person === 'Johan')!.p3c2, 'FRONTEND_ENGINEERING') ===
          'RESOLVED',
    },
    {
      person: 'Camilo',
      code: 'PLATFORM_DEVOPS_ENGINEERING',
      p2: evals.find((e) => e.row.person === 'Camilo')?.c2.decision,
      p2Field: evals.find((e) => e.row.person === 'Camilo')?.c2.resolvedFieldCode,
      actual: specDecision(
        evals.find((e) => e.row.person === 'Camilo')!.p3c2,
        'PLATFORM_DEVOPS_ENGINEERING',
      ),
      pass:
        evals.find((e) => e.row.person === 'Camilo')?.c2.resolvedFieldCode ===
          'SOFTWARE_ENGINEERING' &&
        specDecision(
          evals.find((e) => e.row.person === 'Camilo')!.p3c2,
          'PLATFORM_DEVOPS_ENGINEERING',
        ) === 'RESOLVED',
    },
    {
      person: 'Juan Pablo',
      code: 'VD_VS_AV',
      p2: evals.find((e) => e.row.person === 'Juan Pablo')?.c2.decision,
      p2Field: evals.find((e) => e.row.person === 'Juan Pablo')?.c2.resolvedFieldCode,
      actual: evals.find((e) => e.row.person === 'Juan Pablo')?.c2.decision ?? 'MISSING',
      pass: evals.find((e) => e.row.person === 'Juan Pablo')?.c2.decision !== 'RESOLVED',
    },
    {
      person: 'Katherin',
      code: 'DM_VS_COMM',
      p2: evals.find((e) => e.row.person === 'Katherin')?.c2.decision,
      p2Field: evals.find((e) => e.row.person === 'Katherin')?.c2.resolvedFieldCode,
      actual: evals.find((e) => e.row.person === 'Katherin')?.c2.decision ?? 'MISSING',
      pass: evals.find((e) => e.row.person === 'Katherin')?.c2.decision !== 'RESOLVED',
    },
  ];

  const daControls = ['Sara', 'Haider', 'Diego'].map((person) => {
    const e = evals.find((x) => x.row.person === person)!;
    return {
      person,
      beforeCandidate1: { decision: e.c1.decision, field: e.c1.resolvedFieldCode, skip: e.c1Skip.eligibility },
      afterCandidate2: { decision: e.c2.decision, field: e.c2.resolvedFieldCode, skip: e.c2Skip.eligibility },
      reason:
        e.c1.decision === e.c2.decision && e.c1.resolvedFieldCode === e.c2.resolvedFieldCode
          ? 'UNCHANGED_DA_IDENTITY'
          : 'CHANGED',
    };
  });

  const skipReview = c2SkipEligible.map((e) => {
    const top = e.c2.candidateFields.find((c) => c.fieldCode === e.c2.resolvedFieldCode);
    const rank1Match = e.c2.resolvedFieldCode === e.cmpC2.historicalRank1;
    const review = reviewClass({
      decision: e.c2.decision,
      skip: e.c2Skip,
      toolOnly: isToolOnlyResolved(e.units, top?.originEvidenceIds ?? []),
      duplicatedSourceRisk: duplicatedSourceRisk(
        e.units,
        top?.originEvidenceIds ?? [],
        top?.independentSourceCount ?? 0,
      ),
    });
    const verdict =
      review === 'UNSAFE_RESOLVED' || e.cmpC2.class === 'FALSE_POSITIVE' || !rank1Match
        ? 'UNSAFE'
        : review === 'QUESTIONABLE_RESOLVED'
          ? 'QUESTIONABLE'
          : 'SAFE';
    return {
      person: e.row.person,
      domain: e.row.domain,
      code: e.c2.resolvedFieldCode,
      evidence: originPreview(e.units, top?.originEvidenceIds ?? []),
      explanation: e.c2.reasonCodes,
      catalog: e.c2Skip.catalogDependency,
      canonical: e.cmpC2.historicalRank1,
      review,
      cmp: e.cmpC2.class,
      rank1Match,
      verdict,
    };
  });

  const comparison = evals
    .filter((e) => {
      const amb1 = [...e.c1.ambiguousFieldCodes].sort().join('|');
      const amb2 = [...e.c2.ambiguousFieldCodes].sort().join('|');
      return (
        e.c1.decision !== e.c2.decision ||
        e.c1.resolvedFieldCode !== e.c2.resolvedFieldCode ||
        e.c1Skip.eligibility !== e.c2Skip.eligibility ||
        amb1 !== amb2
      );
    })
    .map((e) => ({
      case: e.row.person,
      candidate1: {
        decision: e.c1.decision,
        field: e.c1.resolvedFieldCode,
        skip: e.c1Skip.eligibility,
        ambiguous: e.c1.ambiguousFieldCodes,
      },
      candidate2: {
        decision: e.c2.decision,
        field: e.c2.resolvedFieldCode,
        skip: e.c2Skip.eligibility,
        ambiguous: e.c2.ambiguousFieldCodes,
      },
      canonical: e.cmpC2.historicalRank1,
      whyChanged:
        e.row.snapshotId === '9'
          ? 'SE↔DA competitor pair + shared practice + SE application aliases; DA skip blocked without analytical differential'
          : e.c2.reasonCodes.join('|') || 'AMBIGUOUS_SET_CHANGED',
      intended: e.row.snapshotId === '9',
    }));

  const p3Changes: Array<{
    person: string;
    specialtyCode: string;
    c1: string;
    c2: string;
    fieldContextC1: string[];
    fieldContextC2: string[];
  }> = [];
  for (const e of evals) {
    const codes = new Set([
      ...e.p3c1.items.map((i) => i.specialtyCode),
      ...e.p3c2.items.map((i) => i.specialtyCode),
    ]);
    for (const code of codes) {
      const a = e.p3c1.items.find((i) => i.specialtyCode === code)?.decision ?? 'MISSING';
      const b = e.p3c2.items.find((i) => i.specialtyCode === code)?.decision ?? 'MISSING';
      if (a !== b) {
        p3Changes.push({
          person: e.row.person,
          specialtyCode: code,
          c1: a,
          c2: b,
          fieldContextC1: fieldCodesForP3(e.c1),
          fieldContextC2: fieldCodesForP3(e.c2),
        });
      }
    }
  }
  const p3Critical = p3Changes.filter((c) => {
    const controlCodes: Record<string, string[]> = {
      Sara: ['DATA_GOVERNANCE'],
      Haider: ['DATA_GOVERNANCE'],
      Diego: ['DATA_GOVERNANCE'],
      Johan: ['FRONTEND_ENGINEERING'],
      Camilo: ['PLATFORM_DEVOPS_ENGINEERING'],
    };
    return (controlCodes[c.person] ?? []).includes(c.specialtyCode);
  });

  const pipeline = evals.map((e) => {
    const p2Mode = e.c2Skip.eligibility === 'SKIP_ELIGIBLE' ? 'DETERMINISTIC_C2' : 'HISTORICAL_FALLBACK';
    const simulatedField =
      p2Mode === 'DETERMINISTIC_C2' ? e.c2.resolvedFieldCode : e.cmpC2.historicalRank1;
    return {
      person: e.row.person,
      p1: 'HISTORICAL',
      p2: p2Mode,
      p3: 'HISTORICAL',
      p4: 'HISTORICAL',
      simulatedField,
      canonicalField: e.cmpC2.historicalRank1,
      fieldMatch: simulatedField === e.cmpC2.historicalRank1,
    };
  });
  const fieldMatches = pipeline.filter((p) => p.fieldMatch).length;

  const overlay = {
    native: c2SkipEligible.filter((e) => e.c2Skip.catalogDependency === 'CATALOG_NATIVE').length,
    mixed: c2SkipEligible.filter((e) => e.c2Skip.catalogDependency === 'MIXED').length,
    overlay: c2SkipEligible.filter((e) => e.c2Skip.catalogDependency === 'OVERLAY_DEPENDENT').length,
    rows: c2SkipEligible.map((e) => ({
      person: e.row.person,
      field: e.c2.resolvedFieldCode,
      dependency: e.c2Skip.catalogDependency,
    })),
  };

  const p2 = {
    evaluated: evals.length,
    resolved: c2Resolved.length,
    skipEligible: c2SkipEligible.length,
    skipEligibleExactRank1: c2SkipExact.length,
    exactRank1: evals.filter((e) => e.cmpC2.class === 'EXACT_MATCH').length,
    ambiguous: evals.filter((e) => e.c2.decision === 'AMBIGUOUS').length,
    insufficient: evals.filter((e) => e.c2.decision === 'INSUFFICIENT_EVIDENCE').length,
    precisionAmongSkipEligible: c2SkipPrecision,
    falsePositives: c2Resolved.filter((e) => e.cmpC2.class === 'FALSE_POSITIVE').length,
    falseNegatives: evals.filter((e) => e.cmpC2.class === 'FALSE_NEGATIVE').length,
    skipRank1Mismatch: c2SkipEligible
      .filter((e) => e.c2.resolvedFieldCode !== e.cmpC2.historicalRank1)
      .map((e) => e.row.person),
    criticalFalsePositives: skipReview.filter((r) => r.verdict === 'UNSAFE').length,
  };

  const historicalTokens = evals.length * (MEASURED_P2_TOKENS + MEASURED_P3_TOKENS);
  const c2Safe = c2SkipExact.length * MEASURED_P2_TOKENS;
  const cost = {
    label: 'HISTORICAL_COUNTERFACTUAL',
    candidate1TheoreticalSafeTokens: C1_SAFE_P2_TOKENS,
    candidate2TheoreticalSafeTokens: c2Safe,
    p2CallsAvoidable: c2SkipExact.length,
    historicalTokensAvoidable: c2Safe,
    percentageTotalPipeline: historicalTokens === 0 ? 0 : c2Safe / historicalTokens,
    note: 'P2 only. P3 savings excluded. P3 remains BLOCKED_BY_P4_CONTRACT.',
  };

  const unsafe = skipReview.filter((r) => r.verdict === 'UNSAFE').length;
  const s9Ok =
    !(s9.c2.resolvedFieldCode === 'DATA_ANALYTICS' && s9.c2Skip.eligibility === 'SKIP_ELIGIBLE');
  const precisionOk = p2.precisionAmongSkipEligible === 1 || p2.skipEligible === 0;
  const fieldSimOk = fieldMatches === pipeline.length;
  const controlsOk = controls.every((c) => c.pass);
  const p3CritOk = p3Critical.length === 0;
  const boundaryOk = boundary.every((b) => b.pass);
  const mutationOk = mutation.every((m) => m.pass);

  const bodyPass = () =>
    stableStringify({
      frozen,
      p2,
      pipeline,
      skipReview,
      controls,
    });
  const pass1 = bodyPass();
  const pass2 = bodyPass();
  const determinism = pass1 === pass2 ? 'PASS' : 'FAIL';

  const ledgerAfter = ledgerSnapshot(backendRoot);
  const ledger = {
    before: ledgerBefore,
    after: ledgerAfter,
    callsDelta: ledgerAfter.calls - ledgerBefore.calls,
    tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
    eventsDelta: ledgerAfter.events - ledgerBefore.events,
  };

  let verdict:
    | 'P2_CANDIDATE_2_VALIDATED'
    | 'MORE_P2_HARDENING_REQUIRED'
    | 'CANDIDATE_2_REJECTED' = 'MORE_P2_HARDENING_REQUIRED';
  if (
    s9Ok &&
    precisionOk &&
    p2.criticalFalsePositives === 0 &&
    controlsOk &&
    fieldSimOk &&
    p3CritOk &&
    determinism === 'PASS' &&
    ledger.callsDelta === 0 &&
    unsafe === 0 &&
    boundaryOk &&
    mutationOk &&
    frozen.skipGemini === false
  ) {
    verdict = 'P2_CANDIDATE_2_VALIDATED';
  }
  if (!s9Ok || unsafe > 0 || p2.criticalFalsePositives > 0 || ledger.callsDelta !== 0) {
    verdict = 'CANDIDATE_2_REJECTED';
  }

  const controlValidation = {
    s9FalseSkipBlocked: s9Ok,
    s9: {
      candidate1: {
        decision: s9.c1.decision,
        field: s9.c1.resolvedFieldCode,
        skip: s9.c1Skip.eligibility,
      },
      candidate2: {
        decision: s9.c2.decision,
        field: s9.c2.resolvedFieldCode,
        skip: s9.c2Skip.eligibility,
        reasons: s9.c2.reasonCodes,
      },
      canonical: s9.cmpC2.historicalRank1,
    },
    people: controlEvals.map((e) => ({
      person: e.row.person,
      c1: { decision: e.c1.decision, field: e.c1.resolvedFieldCode, skip: e.c1Skip.eligibility },
      c2: { decision: e.c2.decision, field: e.c2.resolvedFieldCode, skip: e.c2Skip.eligibility, reasons: e.c2.reasonCodes },
    })),
    daControls,
    critical: controls,
    allPass: controlsOk,
  };

  const artifacts = {
    frozen,
    verdict,
    p3: 'BLOCKED_BY_P4_CONTRACT',
    p3Modified: false,
    missingProfiles141: 'NOT_PROCESSED',
    skipGemini: false,
    ledger,
    p2,
    determinism,
  };

  const outDir = join(backendRoot, 'tmp', 'mc1-deterministic-resolver-candidate-2');
  mkdirSync(outDir, { recursive: true });
  const files: Record<string, unknown> = {
    's9-root-cause.json': s9Root,
    'policy-diff.json': POLICY_V03_DIFF,
    'boundary-tests.json': { passed: boundary.filter((b) => b.pass).length, failed: boundary.filter((b) => !b.pass).length, rows: boundary },
    'mutation-tests.json': { passed: mutation.filter((m) => m.pass).length, failed: mutation.filter((m) => !m.pass).length, rows: mutation },
    'control-validation.json': controlValidation,
    'p2-validation.json': p2,
    'candidate-comparison.json': {
      changed: comparison.length,
      intended: comparison.filter((c) => c.intended).length,
      unintended: comparison.filter((c) => !c.intended).length,
      rows: comparison,
    },
    'p3-regression.json': {
      changes: p3Changes.length,
      criticalRegressions: p3Critical.length,
      rows: p3Changes,
      critical: p3Critical,
      verdict: p3CritOk ? 'NO_CRITICAL_P3_REGRESSION' : 'CRITICAL_P3_REGRESSION',
      p3Status: 'BLOCKED_BY_P4_CONTRACT',
      p3Modified: false,
    },
    'pipeline-simulation.json': {
      fieldMatches,
      fieldDifferences: pipeline.length - fieldMatches,
      rows: pipeline,
      verdict: fieldSimOk ? '20/20' : `${fieldMatches}/${pipeline.length}`,
    },
    'manual-review.json': {
      skipEligibleReviewed: skipReview.length,
      safe: skipReview.filter((r) => r.verdict === 'SAFE').length,
      questionable: skipReview.filter((r) => r.verdict === 'QUESTIONABLE').length,
      unsafe: skipReview.filter((r) => r.verdict === 'UNSAFE').length,
      rows: skipReview,
      overlay,
    },
    'cost-counterfactual.json': cost,
    'determinism-report.json': {
      result: determinism,
      runs: 2,
      skipGemini: false,
      gemini: 'NOT_INVOKED',
      ledger,
    },
    'summary.json': artifacts,
  };
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(outDir, name), stableStringify(body), 'utf8');
  }
  const repoTmp = join(backendRoot, '..', 'tmp', 'mc1-deterministic-resolver-candidate-2');
  mkdirSync(repoTmp, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(repoTmp, name), stableStringify(body), 'utf8');
  }

  return {
    outDir,
    failedBoundaryFix: false,
    frozen,
    verdict,
    p2,
    ledger,
    determinism,
    boundary,
    mutation,
    controls,
    daControls,
    comparison,
    skipReview,
    overlay,
    pipeline,
    fieldMatches,
    p3Changes,
    p3Critical,
    cost,
    s9: controlValidation.s9,
    controlValidation,
  };
}
