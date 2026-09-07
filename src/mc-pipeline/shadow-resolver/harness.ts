/**
 * Harness offline: mismos artefactos P1 + canónicos, mismo código runtime.
 * No llama Gemini. No duplica el resolver.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { COHORT } from '../experimental/deterministic-resolver/cohort';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { CRITICAL_CONTROLS } from '../experimental/deterministic-resolver/shadow/critical-controls';
import { ledgerSnapshot } from '../experimental/deterministic-resolver/shadow/shadow-store';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import type {
  ProductionP2Snapshot,
  ProductionP3Snapshot,
} from '../experimental/deterministic-resolver/shadow/shadow-types';
import { SHADOW_LATENCY_ALERT_MS } from './flags';
import { defaultShadowRuntimeDir } from './hook';
import { PersistentShadowStore } from './persist';
import { observeP2Shadow, observeP3Shadow } from './runtime';
import type { RuntimeShadowEvent, RuntimeShadowP3Event } from './types';

const MEASURED_P2_TOKENS = 18359;
const MEASURED_P3_TOKENS = 11590;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function shaFile(path: string): string | null {
  if (!existsSync(path)) return null;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function canonicalP2(packDir: string): ProductionP2Snapshot {
  const summary = readJson(join(packDir, 'summary.json')) as {
    ranks?: Array<{ domainCode: string; status: string; rank: number }>;
  };
  const ranks = summary.ranks ?? [];
  return {
    rank1: ranks.find((r) => r.rank === 1)?.domainCode ?? null,
    active: ranks.filter((r) => r.status === 'ACTIVE' && r.domainCode).map((r) => r.domainCode),
    source: 'CANONICAL_PACK_SUMMARY',
  };
}

function canonicalP3(packDir: string): ProductionP3Snapshot[] {
  const summary = readJson(join(packDir, 'summary.json')) as {
    observed?: Array<{ fieldCode: string; specialtyCode: string; status: string }>;
  };
  return (summary.observed ?? []).map((o) => ({
    fieldCode: o.fieldCode,
    specialtyCode: o.specialtyCode,
    status: o.status === 'OBSERVED' || o.status === 'WEAK' ? o.status : 'NOT_EMITTED',
    source: 'CANONICAL_PACK_SUMMARY' as const,
  }));
}

function productionSnapshot(backendRoot: string) {
  const files: Record<string, string | null> = {};
  for (const m of COHORT) {
    files[`${m.person}:p2`] = shaFile(resolve(backendRoot, m.p2PackRel, 'summary.json'));
    files[`${m.person}:p3`] = shaFile(resolve(backendRoot, m.p3PackRel, 'summary.json'));
  }
  return files;
}

function evaluateControls(p2: RuntimeShadowEvent[], p3: RuntimeShadowP3Event[]) {
  const rows = CRITICAL_CONTROLS.map((ctrl) => {
    let actual = 'MISSING';
    let pass = false;
    if (ctrl.phase === 'P2') {
      const row = p2.find((r) => r.personLabel === ctrl.person);
      if (!row) return { ...ctrl, actual, pass: false };
      actual = row.decision;
      if (ctrl.code === 'VD_VS_AV') {
        pass =
          row.decision === 'AMBIGUOUS' &&
          (row.reasonCodes.includes('COMPETING_FIELDS') ||
            row.competitors.includes('VISUAL_DESIGN') ||
            row.competitors.includes('AUDIOVISUAL_PRODUCTION'));
      } else if (ctrl.code === 'DM_VS_COMM') {
        pass =
          row.decision !== 'RESOLVED' &&
          row.candidateCode !== 'DIGITAL_MARKETING' &&
          row.candidateCode !== 'COMMUNICATIONS';
      }
    } else {
      const row = p3.find(
        (r) => r.personLabel === ctrl.person && r.specialtyCode === ctrl.code,
      );
      if (!row) return { ...ctrl, actual, pass: false };
      actual = row.decision;
      if (ctrl.expect === 'RESOLVED') pass = row.decision === 'RESOLVED';
      else if (ctrl.expect === 'NOT_RESOLVED') pass = row.decision !== 'RESOLVED';
      else if (ctrl.expect === 'AMBIGUOUS') pass = row.decision === 'AMBIGUOUS';
    }
    return { ...ctrl, actual, pass };
  });
  const extra = [
    {
      person: 'Sara',
      phase: 'P2' as const,
      code: 'FIELD',
      expect: 'RESOLVED' as const,
      actual: p2.find((r) => r.personLabel === 'Sara')?.decision ?? 'MISSING',
      pass: p2.find((r) => r.personLabel === 'Sara')?.decision === 'RESOLVED',
    },
    {
      person: 'Haider',
      phase: 'P2' as const,
      code: 'FIELD',
      expect: 'RESOLVED' as const,
      actual: p2.find((r) => r.personLabel === 'Haider')?.decision ?? 'MISSING',
      pass: p2.find((r) => r.personLabel === 'Haider')?.decision === 'RESOLVED',
    },
    {
      person: 'Johan',
      phase: 'P2' as const,
      code: 'FIELD',
      expect: 'RESOLVED' as const,
      actual: p2.find((r) => r.personLabel === 'Johan')?.decision ?? 'MISSING',
      pass: p2.find((r) => r.personLabel === 'Johan')?.decision === 'RESOLVED',
    },
  ];
  const haiderGov = p3.find(
    (r) => r.personLabel === 'Haider' && r.specialtyCode === 'DATA_GOVERNANCE',
  );
  const jpForced =
    p2.find((r) => r.personLabel === 'Juan Pablo')?.decision === 'RESOLVED';
  const versionBlocked = haiderGov?.decision === 'RESOLVED' || jpForced;
  const all = [...rows, ...extra];
  return {
    rows: all,
    allPass: all.every((r) => r.pass) && !versionBlocked,
    versionBlocked,
    criticalFalsePositives: haiderGov?.decision === 'RESOLVED' ? 1 : 0,
  };
}

export function runShadowRuntimeHarness(
  backendRoot: string,
  opts?: { resetStore?: boolean },
) {
  const ledgerBefore = ledgerSnapshot(backendRoot);
  const outDir = defaultShadowRuntimeDir(backendRoot);
  const productionBefore = productionSnapshot(backendRoot);
  if (opts?.resetStore !== false && existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  const store = new PersistentShadowStore(outDir);
  const countBefore = store.count();

  const p2Durations: number[] = [];
  const p3Durations: number[] = [];
  let p2Computed = 0;
  let p2Reused = 0;
  let p3Computed = 0;
  let p3Reused = 0;

  const runPass = (label: 'run1' | 'run2') => {
    for (const member of COHORT) {
      const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, member.p1PackRel));
      const ctx = {
        store,
        units,
        snapshotId: member.snapshotId,
        personId: member.personId,
        personLabel: member.person,
        enabled: true as const,
        canonicalP2: canonicalP2(resolve(backendRoot, member.p2PackRel)),
        canonicalP3: canonicalP3(resolve(backendRoot, member.p3PackRel)),
      };
      const p2 = observeP2Shadow(ctx);
      p2Durations.push(p2.durationMs);
      if (p2.status === 'SHADOW_REUSED') p2Reused += 1;
      if (p2.status === 'COMPUTED') p2Computed += 1;
      const p3 = observeP3Shadow(ctx);
      p3Durations.push(p3.durationMs);
      if (label === 'run1') {
        if (p3.status === 'SHADOW_REUSED') p3Reused += 1;
        else p3Computed += p3.events.length;
      } else if (p3.status === 'SHADOW_REUSED' || p3.events.every((e) => store.lookup(e.inputFingerprint))) {
        p3Reused += p3.events.length;
      }
    }
  };

  runPass('run1');
  const countAfterRun1 = store.count();
  runPass('run2');
  const countAfterRun2 = store.count();

  const sara = COHORT.find((c) => c.person === 'Sara')!;
  const saraUnits = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, sara.p1PackRel));
  const fpProbe = observeP2Shadow({
    store,
    units: saraUnits,
    snapshotId: sara.snapshotId,
    personId: sara.personId,
    personLabel: sara.person,
    enabled: true,
    policyVersion: '0.2.0-fingerprint-probe',
  });
  const countAfterProbe = store.count();

  const productionAfter = productionSnapshot(backendRoot);
  const productionEquivalent =
    stableStringify(productionBefore) === stableStringify(productionAfter);

  const p2Events = store.p2Events().filter((e) => e.policyVersion !== '0.2.0-fingerprint-probe');
  const p3Events = store.p3Events();
  const comparisons = store.allComparisons();
  const classCounts: Record<string, number> = {};
  for (const c of comparisons) {
    classCounts[c.comparisonClass] = (classCounts[c.comparisonClass] ?? 0) + 1;
  }
  const reviewQueue = comparisons.filter((c) => c.reviewRequired);
  const controls = evaluateControls(p2Events, p3Events);

  const p2Resolved = p2Events.filter((e) => e.decision === 'RESOLVED').length;
  const p2Amb = p2Events.filter((e) => e.decision === 'AMBIGUOUS').length;
  const p2Ins = p2Events.filter((e) => e.decision === 'INSUFFICIENT_EVIDENCE').length;
  const p2WouldSkip = p2Events.filter((e) => e.wouldSkipGemini).length;
  const p3Resolved = p3Events.filter((e) => e.decision === 'RESOLVED').length;
  const p3Amb = p3Events.filter((e) => e.decision === 'AMBIGUOUS').length;
  const p3Ins = p3Events.filter((e) => e.decision === 'INSUFFICIENT_EVIDENCE').length;
  const p3WouldSkipPeople = new Set(
    p3Events.filter((e) => e.wouldSkipGemini).map((e) => e.personId),
  ).size;

  const avg = (xs: number[]) =>
    xs.length === 0 ? 0 : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;
  const max = (xs: number[]) => (xs.length === 0 ? 0 : Math.max(...xs));
  const p2Avg = avg(p2Durations);
  const p3Avg = avg(p3Durations);
  const maxMs = Math.max(max(p2Durations), max(p3Durations));

  const n = COHORT.length;
  const historicalTokens = n * MEASURED_P2_TOKENS + n * MEASURED_P3_TOKENS;
  const avoidable =
    p2WouldSkip * MEASURED_P2_TOKENS + p3WouldSkipPeople * MEASURED_P3_TOKENS;

  const ledgerAfter = ledgerSnapshot(backendRoot);
  store.persistComparisons();

  const artifacts = {
    metrics: {
      p2: {
        evaluated: p2Events.length,
        resolved: p2Resolved,
        ambiguous: p2Amb,
        insufficient: p2Ins,
        wouldSkip: p2WouldSkip,
        matches: comparisons.filter(
          (c) =>
            c.phase === 'P2' &&
            (c.comparisonClass === 'EXACT_MATCH' || c.comparisonClass === 'COMPATIBLE_MATCH'),
        ).length,
        conflicts: comparisons.filter((c) => c.phase === 'P2' && c.reviewRequired).length,
        reuse: p2Reused,
        latencyAvgMs: p2Avg,
      },
      p3: {
        evaluated: p3Events.length,
        resolved: p3Resolved,
        ambiguous: p3Amb,
        insufficient: p3Ins,
        wouldSkip: p3WouldSkipPeople,
        matches: comparisons.filter(
          (c) =>
            c.phase === 'P3' &&
            (c.comparisonClass === 'EXACT_MATCH' || c.comparisonClass === 'COMPATIBLE_MATCH'),
        ).length,
        conflicts: comparisons.filter((c) => c.phase === 'P3' && c.reviewRequired).length,
        reuse: p3Reused,
        latencyAvgMs: p3Avg,
      },
      comparisonClassCounts: classCounts,
    },
    reviewQueue,
    reuseReport: {
      countBefore,
      countAfterRun1,
      countAfterRun2,
      countAfterProbe,
      noInflation: countAfterRun1 === countAfterRun2,
      p2Computed,
      p2Reused,
      fingerprintProbe: {
        status: fpProbe.status,
        newFingerprint: fpProbe.event?.inputFingerprint ?? null,
        recomputed: fpProbe.status === 'COMPUTED',
      },
    },
    latencyReport: {
      p2AvgMs: p2Avg,
      p3AvgMs: p3Avg,
      maxMs,
      alertThresholdMs: SHADOW_LATENCY_ALERT_MS,
      verdict: maxMs < SHADOW_LATENCY_ALERT_MS ? 'PASS' : 'WARN',
    },
    productionEquivalence: {
      result: productionEquivalent ? 'PASS' : 'FAIL',
      before: productionBefore,
      after: productionAfter,
    },
    criticalControls: controls,
    costCounterfactual: {
      label: 'HISTORICAL_COUNTERFACTUAL',
      notAGuaranteedFutureSaving: true,
      historicalTokens,
      historicalTokensPotentiallyAvoidable: avoidable,
      percentage: historicalTokens === 0 ? 0 : avoidable / historicalTokens,
    },
    ledger: {
      before: ledgerBefore,
      after: ledgerAfter,
      callsDelta: ledgerAfter.calls - ledgerBefore.calls,
      tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
      newGeminiEvents: 0,
    },
    skipGemini: false,
    p4: 'OUT_OF_SCOPE',
    missingProfiles141: 'NOT_PROCESSED',
    productionImpact: 'NONE',
  };

  writeFileSync(join(outDir, 'metrics.json'), stableStringify(artifacts.metrics), 'utf8');
  writeFileSync(join(outDir, 'review-queue.json'), stableStringify(reviewQueue), 'utf8');
  writeFileSync(join(outDir, 'reuse-report.json'), stableStringify(artifacts.reuseReport), 'utf8');
  writeFileSync(join(outDir, 'latency-report.json'), stableStringify(artifacts.latencyReport), 'utf8');
  writeFileSync(
    join(outDir, 'production-equivalence.json'),
    stableStringify(artifacts.productionEquivalence),
    'utf8',
  );
  writeFileSync(
    join(outDir, 'comparisons.json'),
    stableStringify({ productionIsNotGold: true, results: comparisons }),
    'utf8',
  );
  writeFileSync(join(outDir, 'cost-counterfactual.json'), stableStringify(artifacts.costCounterfactual), 'utf8');
  writeFileSync(join(outDir, 'ledger-delta.json'), stableStringify(artifacts.ledger), 'utf8');
  writeFileSync(
    join(outDir, 'critical-controls.json'),
    stableStringify(artifacts.criticalControls),
    'utf8',
  );

  return { outDir, ...artifacts };
}
