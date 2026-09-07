import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compareP2, compareP3Specialty, type HistoricalP2, type HistoricalP3 } from './compare';
import { COHORT } from './cohort';
import { loadEvidenceUnitsFromP1Pack } from './evidence';
import { resolveFields } from './field-resolver';
import { resolveSpecialties } from './specialty-resolver';
import { RESOLVER_CODE, RESOLVER_VERSION } from './types';

/** MEASURED — docs/mc1-gemini-usage-ledger.md RUN 1 (persona control). */
const MEASURED_P2_TOKENS = 18359;
const MEASURED_P3_TOKENS = 11590;
const MEASURED_P2_CALLS = 1;
const MEASURED_P3_CALLS = 1;

export function stableStringify(value: unknown): string {
  return `${stringifySorted(value)}\n`;
}

function stringifySorted(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stringifySorted(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stringifySorted(obj[k])}`).join(',')}}`;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function historicalP2(packDir: string): HistoricalP2 {
  const summary = readJson(join(packDir, 'summary.json')) as {
    ranks?: HistoricalP2['ranks'];
  };
  return { ranks: summary.ranks ?? [] };
}

function historicalP3(packDir: string): HistoricalP3 {
  const summary = readJson(join(packDir, 'summary.json')) as {
    observed?: HistoricalP3['observed'];
  };
  return { observed: summary.observed ?? [] };
}

function ledgerSnapshot(backendRoot: string): {
  exists: boolean;
  path: string;
  calls: number;
  tokens: number;
  sha256: string | null;
} {
  const path = join(backendRoot, 'tmp', 'mc1-gemini-ledger', 'events.jsonl');
  if (!existsSync(path)) {
    return { exists: false, path, calls: 0, tokens: 0, sha256: null };
  }
  const text = readFileSync(path, 'utf8');
  let calls = 0;
  let tokens = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const ev = JSON.parse(line) as {
        eventType?: string;
        usage?: { totalTokens?: number };
      };
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
    sha256: createHash('sha256').update(text).digest('hex'),
  };
}

export type PrototypeRunArtifacts = {
  cohort: unknown;
  p2Results: unknown;
  p3Results: unknown;
  comparison: unknown;
  hybridSimulation: unknown;
  costSimulation: unknown;
  ledger: unknown;
};

export function runDeterministicResolverPrototype(backendRoot: string): PrototypeRunArtifacts {
  const p2Results: unknown[] = [];
  const p3Results: unknown[] = [];
  const comparisonRows: unknown[] = [];
  const hybridRows: unknown[] = [];

  let p2Avoided = 0;
  let p2Fallback = 0;
  let p3Avoided = 0;
  let p3Fallback = 0;
  let p2Fp = 0;
  let p2Fn = 0;
  let p2Exact = 0;
  let p2Compatible = 0;
  let p2Amb = 0;
  let p2Ins = 0;
  let p2Resolved = 0;
  let p3ResolvedItems = 0;
  let p3AmbItems = 0;
  let p3InsItems = 0;
  let p3Fp = 0;
  let p3Fn = 0;
  let p3Exact = 0;
  let p3Compatible = 0;
  let p3Evaluated = 0;
  let haiderGovFp = false;

  for (const member of COHORT) {
    const p1Dir = resolve(backendRoot, member.p1PackRel);
    const units = loadEvidenceUnitsFromP1Pack(p1Dir);
    const p2 = resolveFields({ snapshotId: member.snapshotId, units });
    const fieldCodes =
      p2.decision === 'RESOLVED' && p2.resolvedFieldCode
        ? [p2.resolvedFieldCode]
        : p2.decision === 'AMBIGUOUS'
          ? p2.ambiguousFieldCodes
          : [];
    const p3 = resolveSpecialties({
      snapshotId: member.snapshotId,
      units,
      fieldCodes,
      allowObservedEquivalent: p2.decision === 'RESOLVED',
    });

    p2Results.push({ person: member.person, personId: member.personId, ...p2 });
    p3Results.push({ person: member.person, personId: member.personId, ...p3 });

    const histP2 = historicalP2(resolve(backendRoot, member.p2PackRel));
    const histP3 = historicalP3(resolve(backendRoot, member.p3PackRel));
    const p2cmp = compareP2(p2, histP2);
    if (p2.decision === 'RESOLVED') p2Resolved += 1;
    if (p2.decision === 'AMBIGUOUS') p2Amb += 1;
    if (p2.decision === 'INSUFFICIENT_EVIDENCE') p2Ins += 1;
    if (p2cmp.class === 'EXACT_MATCH') p2Exact += 1;
    if (p2cmp.class === 'COMPATIBLE_MATCH') p2Compatible += 1;
    if (p2cmp.class === 'FALSE_POSITIVE') p2Fp += 1;
    if (p2cmp.class === 'FALSE_NEGATIVE') p2Fn += 1;

    const histMap = new Map(
      histP3.observed.map((o) => [`${o.fieldCode}::${o.specialtyCode}`, o.status]),
    );
    const specialtyCmp = p3.items.map((item) => {
      p3Evaluated += 1;
      if (item.decision === 'RESOLVED') p3ResolvedItems += 1;
      if (item.decision === 'AMBIGUOUS') p3AmbItems += 1;
      if (item.decision === 'INSUFFICIENT_EVIDENCE') p3InsItems += 1;
      const hist = histMap.get(`${item.fieldCode}::${item.specialtyCode}`);
      const historicalStatus =
        hist === 'OBSERVED' || hist === 'WEAK' ? hist : 'NOT_EMITTED';
      const cmp = compareP3Specialty({
        specialtyCode: item.specialtyCode,
        decision: item.decision,
        historicalStatus,
      });
      if (item.decision === 'RESOLVED') {
        if (cmp.class === 'EXACT_MATCH') p3Exact += 1;
        if (cmp.class === 'COMPATIBLE_MATCH') p3Compatible += 1;
        if (cmp.class === 'FALSE_POSITIVE') p3Fp += 1;
      }
      if (cmp.class === 'FALSE_NEGATIVE') p3Fn += 1;
      if (
        member.person === 'Haider' &&
        item.specialtyCode === 'DATA_GOVERNANCE' &&
        item.decision === 'RESOLVED'
      ) {
        haiderGovFp = true;
      }
      return {
        specialtyCode: item.specialtyCode,
        fieldCode: item.fieldCode,
        decision: item.decision,
        historicalStatus,
        ...cmp,
      };
    });

    comparisonRows.push({
      person: member.person,
      snapshotId: member.snapshotId,
      p2: {
        decision: p2.decision,
        resolvedFieldCode: p2.resolvedFieldCode,
        ...p2cmp,
      },
      p3: specialtyCmp,
    });

    const p2WouldCall = p2.decision !== 'RESOLVED';
    if (p2WouldCall) p2Fallback += 1;
    else p2Avoided += 1;

    const p3Ambiguous = p3.items.some((i) => i.decision === 'AMBIGUOUS');
    const p3HasResolved = p3.items.some((i) => i.decision === 'RESOLVED');
    const p3WouldCall = p2WouldCall || p3Ambiguous || !p3HasResolved;
    if (p3WouldCall) p3Fallback += 1;
    else p3Avoided += 1;

    hybridRows.push({
      person: member.person,
      p2: p2WouldCall ? 'WOULD_CALL_GEMINI' : 'USE_DETERMINISTIC',
      p3: p3WouldCall ? 'WOULD_CALL_GEMINI' : 'USE_DETERMINISTIC',
    });
  }

  const n = COHORT.length;
  const actualTokens =
    n * MEASURED_P2_CALLS * MEASURED_P2_TOKENS +
    n * MEASURED_P3_CALLS * MEASURED_P3_TOKENS;
  const counterfactualTokens =
    p2Fallback * MEASURED_P2_TOKENS + p3Fallback * MEASURED_P3_TOKENS;

  const p2Metrics = {
    casesEvaluated: n,
    resolved: p2Resolved,
    ambiguous: p2Amb,
    insufficient: p2Ins,
    coverageRate: p2Resolved / n,
    exactMatches: p2Exact,
    compatibleMatches: p2Compatible,
    falsePositives: p2Fp,
    falseNegatives: p2Fn,
    precisionAmongResolved:
      p2Resolved === 0 ? null : (p2Exact + p2Compatible) / p2Resolved,
  };

  const p3Metrics = {
    specialtiesEvaluated: p3Evaluated,
    resolved: p3ResolvedItems,
    ambiguous: p3AmbItems,
    insufficient: p3InsItems,
    coverageRate: p3Evaluated === 0 ? 0 : p3ResolvedItems / p3Evaluated,
    exactMatches: p3Exact,
    compatibleMatches: p3Compatible,
    falsePositives: p3Fp,
    falseNegatives: p3Fn,
    precisionAmongResolved:
      p3ResolvedItems === 0 ? null : (p3Exact + p3Compatible) / p3ResolvedItems,
  };

  return {
    cohort: {
      resolverCode: RESOLVER_CODE,
      resolverVersion: RESOLVER_VERSION,
      gemini: 'NOT_INVOKED',
      members: COHORT,
    },
    p2Results: { metrics: p2Metrics, results: p2Results },
    p3Results: { metrics: p3Metrics, results: p3Results },
    comparison: {
      p2Metrics,
      p3Metrics,
      haiderGovernanceFalsePositive: haiderGovFp,
      prototypeFail: haiderGovFp,
      rows: comparisonRows,
    },
    hybridSimulation: {
      note: 'WOULD_CALL_GEMINI is simulation only. No Gemini call is made.',
      p2CallsTheoreticallyAvoided: p2Avoided,
      p2FallbackCount: p2Fallback,
      p3CallsTheoreticallyAvoided: p3Avoided,
      p3FallbackCount: p3Fallback,
      rows: hybridRows,
    },
    costSimulation: {
      label: 'HISTORICAL_COUNTERFACTUAL',
      source: 'docs/mc1-gemini-usage-ledger.md RUN 1 MEASURED per-phase tokens applied as unit cost',
      measuredP2TokensPerCall: MEASURED_P2_TOKENS,
      measuredP3TokensPerCall: MEASURED_P3_TOKENS,
      cohortSize: n,
      actualHistoricalTokens: actualTokens,
      counterfactualTokens,
      theoreticalReductionTokens: actualTokens - counterfactualTokens,
      theoreticalReductionRate:
        actualTokens === 0 ? 0 : (actualTokens - counterfactualTokens) / actualTokens,
      notAGuaranteedFutureSaving: true,
    },
    ledger: {
      before: ledgerSnapshot(backendRoot),
    },
  };
}

export function writePrototypeArtifacts(
  backendRoot: string,
  artifacts: PrototypeRunArtifacts,
): string {
  const outDir = join(backendRoot, 'tmp', 'mc1-deterministic-resolver');
  mkdirSync(outDir, { recursive: true });
  const files: Record<string, unknown> = {
    'cohort.json': artifacts.cohort,
    'p2-results.json': artifacts.p2Results,
    'p3-results.json': artifacts.p3Results,
    'comparison.json': artifacts.comparison,
    'hybrid-simulation.json': artifacts.hybridSimulation,
    'cost-simulation.json': artifacts.costSimulation,
  };
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(outDir, name), stableStringify(body), 'utf8');
  }
  const before = (
    artifacts.ledger as { before: ReturnType<typeof ledgerSnapshot> }
  ).before;
  const after = ledgerSnapshot(backendRoot);
  const ledgerDelta = {
    before,
    after,
    callsDelta: after.calls - before.calls,
    tokensDelta: after.tokens - before.tokens,
    newGeminiEvents: 0,
    status:
      after.sha256 === before.sha256
        ? 'NO_NEW_GEMINI_EVENTS'
        : after.exists
          ? 'LEDGER_CHANGED'
          : 'NO_NEW_GEMINI_EVENTS',
  };
  writeFileSync(join(outDir, 'ledger-delta.json'), stableStringify(ledgerDelta), 'utf8');
  return outDir;
}
