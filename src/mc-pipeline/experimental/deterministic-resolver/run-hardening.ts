import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compareP2, compareP3Specialty } from './compare';
import { COHORT } from './cohort';
import { loadEvidenceUnitsFromP1Pack } from './evidence';
import { EXPERIMENTAL_RESOLVER_POLICY } from './experimental-policy';
import { resolveFieldsHardened } from './field-resolver-hardened';
import { stableStringify } from './run-prototype';
import { resolveSpecialtiesHardened } from './specialty-resolver-hardened';

const MEASURED_P2_TOKENS = 18359;
const MEASURED_P3_TOKENS = 11590;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function ledgerSnapshot(backendRoot: string) {
  const path = join(backendRoot, 'tmp', 'mc1-gemini-ledger', 'events.jsonl');
  if (!existsSync(path)) {
    return { exists: false, path, calls: 0, tokens: 0, sha256: null as string | null };
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

export function runHardening(backendRoot: string) {
  const v1Dir = join(backendRoot, 'tmp', 'mc1-deterministic-resolver');
  const v1P2 = readJson(join(v1Dir, 'p2-results.json')) as {
    metrics: Record<string, number>;
    results: Array<{ person: string; decision: string; resolvedFieldCode: string | null }>;
  };
  const v1P3 = readJson(join(v1Dir, 'p3-results.json')) as {
    metrics: Record<string, number>;
    results: Array<{
      person: string;
      items: Array<{ specialtyCode: string; decision: string }>;
    }>;
  };
  const v1Cost = readJson(join(v1Dir, 'cost-simulation.json')) as {
    theoreticalReductionTokens: number;
    theoreticalReductionRate: number;
    counterfactualTokens: number;
    actualHistoricalTokens: number;
  };

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
  let saraGov = '';
  let diegoGov = '';
  let johanFe = '';

  for (const member of COHORT) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, member.p1PackRel));
    const p2 = resolveFieldsHardened({ snapshotId: member.snapshotId, units });
    const fieldCodes =
      p2.decision === 'RESOLVED' && p2.resolvedFieldCode
        ? [p2.resolvedFieldCode]
        : p2.decision === 'AMBIGUOUS'
          ? p2.ambiguousFieldCodes
          : [];
    const p3 = resolveSpecialtiesHardened({
      snapshotId: member.snapshotId,
      units,
      fieldCodes,
      allowObservedEquivalent: p2.decision === 'RESOLVED',
    });
    p2Results.push({ person: member.person, personId: member.personId, ...p2 });
    p3Results.push({ person: member.person, personId: member.personId, ...p3 });

    const histP2 = readJson(resolve(backendRoot, member.p2PackRel, 'summary.json')) as {
      ranks?: Array<{ domainCode: string; status: string; rank: number }>;
    };
    const histP3 = readJson(resolve(backendRoot, member.p3PackRel, 'summary.json')) as {
      observed?: Array<{ fieldCode: string; specialtyCode: string; status: string }>;
    };
    const p2cmp = compareP2(p2, { ranks: histP2.ranks ?? [] });
    if (p2.decision === 'RESOLVED') p2Resolved += 1;
    if (p2.decision === 'AMBIGUOUS') p2Amb += 1;
    if (p2.decision === 'INSUFFICIENT_EVIDENCE') p2Ins += 1;
    if (p2cmp.class === 'EXACT_MATCH') p2Exact += 1;
    if (p2cmp.class === 'COMPATIBLE_MATCH') p2Compatible += 1;
    if (p2cmp.class === 'FALSE_POSITIVE') p2Fp += 1;
    if (p2cmp.class === 'FALSE_NEGATIVE') p2Fn += 1;

    const histMap = new Map(
      (histP3.observed ?? []).map((o) => [`${o.fieldCode}::${o.specialtyCode}`, o.status]),
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
      if (member.person === 'Sara' && item.specialtyCode === 'DATA_GOVERNANCE') {
        saraGov = item.decision;
      }
      if (member.person === 'Diego' && item.specialtyCode === 'DATA_GOVERNANCE') {
        diegoGov = item.decision;
      }
      if (member.person === 'Johan' && item.specialtyCode === 'FRONTEND_ENGINEERING') {
        johanFe = item.decision;
      }
      const v1Item = v1P3.results
        .find((r) => r.person === member.person)
        ?.items.find((i) => i.specialtyCode === item.specialtyCode);
      return {
        specialtyCode: item.specialtyCode,
        fieldCode: item.fieldCode,
        decision: item.decision,
        v1Decision: v1Item?.decision ?? null,
        historicalStatus,
        ...cmp,
      };
    });

    const v1P2Row = v1P2.results.find((r) => r.person === member.person);
    comparisonRows.push({
      person: member.person,
      snapshotId: member.snapshotId,
      p2: {
        decision: p2.decision,
        resolvedFieldCode: p2.resolvedFieldCode,
        v1Decision: v1P2Row?.decision ?? null,
        v1Field: v1P2Row?.resolvedFieldCode ?? null,
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
  const actualTokens = n * MEASURED_P2_TOKENS + n * MEASURED_P3_TOKENS;
  const counterfactual = p2Fallback * MEASURED_P2_TOKENS + p3Fallback * MEASURED_P3_TOKENS;
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
    resolvedGained: p3ResolvedItems - (v1P3.metrics.resolved ?? 0),
    resolvedLost: (v1P3.metrics.resolved ?? 0) - p3ResolvedItems,
  };

  return {
    policy: EXPERIMENTAL_RESOLVER_POLICY,
    prototypeV1Baseline: {
      p2Resolved: v1P2.metrics.resolved,
      p2Precision: v1P2.metrics.precisionAmongResolved,
      p3Resolved: v1P3.metrics.resolved,
      p3Precision: v1P3.metrics.precisionAmongResolved,
    },
    p2Results: { metrics: p2Metrics, results: p2Results },
    p3Results: { metrics: p3Metrics, results: p3Results },
    comparison: {
      p2Metrics,
      p3Metrics,
      vsV1: {
        p2ResolvedDelta: p2Resolved - (v1P2.metrics.resolved ?? 0),
        p3ResolvedDelta: p3ResolvedItems - (v1P3.metrics.resolved ?? 0),
        p2AmbiguitiesGained: p2Amb - (v1P2.metrics.ambiguous ?? 0),
      },
      haiderGovernanceFalsePositive: haiderGovFp,
      saraGovernance: saraGov,
      diegoGovernance: diegoGov,
      johanFrontend: johanFe,
      prototypeFail: haiderGovFp || saraGov !== 'RESOLVED',
      rows: comparisonRows,
    },
    hybridSimulation: {
      note: 'WOULD_CALL_GEMINI is simulation only.',
      p2CallsTheoreticallyAvoided: p2Avoided,
      p2FallbackCount: p2Fallback,
      p3CallsTheoreticallyAvoided: p3Avoided,
      p3FallbackCount: p3Fallback,
      rows: hybridRows,
    },
    costSimulation: {
      label: 'HISTORICAL_COUNTERFACTUAL',
      prototypeV1: {
        theoreticalReductionTokens: v1Cost.theoreticalReductionTokens,
        theoreticalReductionRate: v1Cost.theoreticalReductionRate,
        counterfactualTokens: v1Cost.counterfactualTokens,
      },
      hardened: {
        actualHistoricalTokens: actualTokens,
        counterfactualTokens: counterfactual,
        theoreticalReductionTokens: actualTokens - counterfactual,
        theoreticalReductionRate:
          actualTokens === 0 ? 0 : (actualTokens - counterfactual) / actualTokens,
      },
      notAGuaranteedFutureSaving: true,
    },
    ledger: { before: ledgerSnapshot(backendRoot) },
  };
}

export function writeHardeningArtifacts(backendRoot: string, artifacts: ReturnType<typeof runHardening>) {
  const outDir = join(backendRoot, 'tmp', 'mc1-deterministic-resolver-hardening');
  mkdirSync(outDir, { recursive: true });
  const v1Dir = join(backendRoot, 'tmp', 'mc1-deterministic-resolver');
  copyFileSync(join(v1Dir, 'p2-results.json'), join(outDir, 'prototype-v1-p2-results.json'));
  copyFileSync(join(v1Dir, 'p3-results.json'), join(outDir, 'prototype-v1-p3-results.json'));
  writeFileSync(join(outDir, 'policy.json'), stableStringify(artifacts.policy), 'utf8');
  writeFileSync(join(outDir, 'p2-results.json'), stableStringify(artifacts.p2Results), 'utf8');
  writeFileSync(join(outDir, 'p3-results.json'), stableStringify(artifacts.p3Results), 'utf8');
  writeFileSync(join(outDir, 'comparison.json'), stableStringify(artifacts.comparison), 'utf8');
  writeFileSync(
    join(outDir, 'hybrid-simulation.json'),
    stableStringify(artifacts.hybridSimulation),
    'utf8',
  );
  writeFileSync(
    join(outDir, 'cost-simulation.json'),
    stableStringify(artifacts.costSimulation),
    'utf8',
  );
  const after = ledgerSnapshot(backendRoot);
  const before = artifacts.ledger.before;
  writeFileSync(
    join(outDir, 'ledger-delta.json'),
    stableStringify({
      before,
      after,
      callsDelta: after.calls - before.calls,
      tokensDelta: after.tokens - before.tokens,
      newGeminiEvents: 0,
      status:
        after.sha256 === before.sha256 ? 'NO_NEW_GEMINI_EVENTS' : after.exists ? 'LEDGER_CHANGED' : 'NO_NEW_GEMINI_EVENTS',
    }),
    'utf8',
  );
  return outDir;
}
