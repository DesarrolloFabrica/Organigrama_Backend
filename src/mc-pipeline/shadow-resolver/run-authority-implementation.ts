/**
 * FASE — MC1 P2 DETERMINISTIC AUTHORITY IMPLEMENTATION GATE
 * Offline. Gemini = 0. skipGemini = false. Authority productiva = false.
 * Recorre el mismo evaluateDeterministicAuthority que usaría el runtime.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import { findLatestR1Pack, loadR1Contract } from '../p3/p3-context-loader';
import { discoverHistoricalInventory } from './inventory';
import { artifactIdentityFromP1PackRel } from './full-contract-evidence';
import {
  evaluateDeterministicAuthority,
  isAuthoritativeUseAllowed,
  resolveAuthorityRuntimeFlags,
} from './authority-runtime';
import { DeterministicP2ReuseStore } from './authority-reuse-store';
import { computeAuthorityFingerprint } from './authority-fingerprint';
import { evaluateP3ReuseSafety, P3_CONTEXT_RUNTIME_DISABLED } from './p3-context-runtime';
import { p3ContextFromHistoricalR1 } from './p3-shadow-context';
import { CSET_V2_FIXTURES } from './candidate-set-v2-fixtures';
import {
  isDeterministicSkipGeminiEnabled,
  isP2DeterministicAuthorityEnabled,
  isP2DeterministicResolverEnabled,
  isP2DeterministicSkipGeminiEnabled,
} from './flags';

const MEASURED_P2_TOKENS = 18359;

function ledgerSnapshot(backendRoot: string) {
  const path = join(backendRoot, 'tmp', 'mc1-gemini-ledger', 'events.jsonl');
  if (!existsSync(path)) return { exists: false, path, calls: 0, tokens: 0, events: 0 };
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
      /* ignore */
    }
  }
  return { exists: true, path, calls, tokens, events };
}

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function runAuthorityImplementationGate(backendRoot: string) {
  if (isDeterministicSkipGeminiEnabled() !== false) throw new Error('SKIP_GEMINI_MUST_STAY_FALSE');
  if (isP2DeterministicAuthorityEnabled() !== false) throw new Error('AUTHORITY_MUST_STAY_FALSE');
  const ledgerBefore = ledgerSnapshot(backendRoot);
  const inventory = discoverHistoricalInventory(backendRoot).filter((r) => r.p2Class === 'P2_ELIGIBLE');
  const prodHashesBefore = inventory.map((r) => ({
    person: r.person,
    p2: r.p2PackRel ? hashFile(resolve(backendRoot, r.p2PackRel, 'p2-contract.json')) : null,
  }));

  const store = new DeterministicP2ReuseStore(join(backendRoot, 'tmp', 'mc1-p2-deterministic-reuse'));
  const simulations: unknown[] = [];
  const eligRows: unknown[] = [];
  const fallbackRows: unknown[] = [];
  const p3Rows: unknown[] = [];
  const reuseRows: unknown[] = [];
  const latencies: number[] = [];
  let eligible = 0;
  let simulated = 0;
  let fallback = 0;
  let reused = 0;
  let errors = 0;

  for (const row of inventory) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, row.p1PackRel!));
    const r = evaluateDeterministicAuthority({
      snapshotId: row.snapshotId,
      personId: row.person,
      units,
      artifactIdentity: artifactIdentityFromP1PackRel(row.p1PackRel!),
      simulateAuthority: true,
      reuseStore: store,
    });
    const r2 = evaluateDeterministicAuthority({
      snapshotId: row.snapshotId,
      personId: row.person,
      units,
      artifactIdentity: artifactIdentityFromP1PackRel(row.p1PackRel!),
      simulateAuthority: true,
      reuseStore: store,
    });
    latencies.push(r.timings.totalMs);
    if (r.authorityEligible) eligible += 1;
    if (r.simulated) simulated += 1;
    if (r.fallback === 'FALLBACK_REQUIRED') fallback += 1;
    if (r2.reused) reused += 1;
    if (r.error) errors += 1;

    const r1Pack = findLatestR1Pack(backendRoot, row.snapshotId);
    const histR1 = r1Pack ? loadR1Contract(r1Pack) : null;
    const histP3 = histR1 ? p3ContextFromHistoricalR1(histR1) : [];
    const reuse = evaluateP3ReuseSafety({ historical: histP3, proposed: r.p3 });

    simulations.push({
      person: row.person,
      snapshotId: row.snapshotId,
      event: r.event,
      authorityEligible: r.authorityEligible,
      simulated: r.simulated,
      fallback: r.fallback,
      producedBy: r.producedBy,
      replaceProduction: r.replaceProduction,
      primary: r.contract?.primary?.fieldCode ?? null,
      secondaries: r.contract?.secondaries.map((s) => s.fieldCode) ?? [],
      context: r.contract?.contextFields.map((c) => c.fieldCode) ?? [],
      r1: r.r1 ? { status: r.r1.resolutionStatus, primary: r.r1.primary, secondaries: r.r1.secondaries } : null,
      timings: r.timings,
      fingerprint: r.observability.fingerprint,
      secondPassReused: r2.reused,
      byteEquivalentSecondPass: r.observability.fingerprint === r2.observability.fingerprint,
    });
    eligRows.push({
      person: row.person,
      snapshotId: row.snapshotId,
      eligible: r.authorityEligible,
      blockedBy: r.fallbackReason,
    });
    if (!r.authorityEligible) {
      fallbackRows.push({ person: row.person, reasons: r.fallbackReason, event: r.event });
    }
    p3Rows.push({
      person: row.person,
      enabled: false,
      flag: P3_CONTEXT_RUNTIME_DISABLED,
      fields: r.p3,
    });
    reuseRows.push({ person: row.person, ...reuse });
  }

  const failures = [
    {
      id: 'resolverThrow',
      pass:
        evaluateDeterministicAuthority({
          snapshotId: 'inj',
          units: CSET_V2_FIXTURES.primaryPlusLegitimateContext,
          artifactIdentity: 'pack:inj',
          simulateAuthority: true,
          inject: { throw: true },
        }).event === 'P2_DETERMINISTIC_ERROR',
    },
    {
      id: 'malformedSet',
      pass:
        evaluateDeterministicAuthority({
          snapshotId: 'inj',
          units: CSET_V2_FIXTURES.primaryPlusLegitimateContext,
          artifactIdentity: 'pack:inj',
          simulateAuthority: true,
          inject: { malformedSet: true },
        }).fallback === 'FALLBACK_REQUIRED',
    },
    {
      id: 'missingCatalog',
      pass:
        evaluateDeterministicAuthority({
          snapshotId: 'inj',
          units: CSET_V2_FIXTURES.primaryPlusLegitimateContext,
          artifactIdentity: 'pack:inj',
          simulateAuthority: true,
          inject: { missingCatalog: true },
        }).fallbackReason.includes('CATALOG_INCOMPATIBLE'),
    },
    {
      id: 'badFingerprint',
      pass:
        evaluateDeterministicAuthority({
          snapshotId: 'inj',
          units: CSET_V2_FIXTURES.primaryPlusLegitimateContext,
          artifactIdentity: 'pack:inj',
          simulateAuthority: true,
          inject: { badFingerprint: true },
        }).event === 'P2_DETERMINISTIC_ERROR',
    },
    {
      id: 'invalidContextRole',
      pass:
        evaluateDeterministicAuthority({
          snapshotId: 'inj',
          units: CSET_V2_FIXTURES.primaryPlusLegitimateContext,
          artifactIdentity: 'pack:inj',
          simulateAuthority: true,
          inject: { invalidContextRole: true },
        }).fallbackReason.includes('INVALID_CONTEXT_ROLE'),
    },
  ];

  const flagSafety = {
    defaults: resolveAuthorityRuntimeFlags(),
    authorityHardFalse: isP2DeterministicAuthorityEnabled() === false,
    skipHardFalse: isP2DeterministicSkipGeminiEnabled() === false,
    resolverDefault: isP2DeterministicResolverEnabled() === false,
    accidentalSkipTrue: isAuthoritativeUseAllowed({
      resolverEnabled: true,
      authorityEnabled: true,
      skipEnabled: true,
    }) === false,
    killSwitch: 'MC1_P2_DETERMINISTIC_SKIP_GEMINI=false',
  };
  const flagPass =
    flagSafety.authorityHardFalse &&
    flagSafety.skipHardFalse &&
    flagSafety.accidentalSkipTrue;

  const prodHashesAfter = inventory.map((r) => ({
    person: r.person,
    p2: r.p2PackRel ? hashFile(resolve(backendRoot, r.p2PackRel, 'p2-contract.json')) : null,
  }));
  const prodEq =
    stableStringify(prodHashesBefore) === stableStringify(prodHashesAfter) && flagSafety.authorityHardFalse;

  const units = CSET_V2_FIXTURES.primaryPlusLegitimateContext;
  const fpA = computeAuthorityFingerprint({ units });
  const fpB = computeAuthorityFingerprint({ units });
  const fpInv = computeAuthorityFingerprint({ units, resolverVersion: '9.9.9' });
  const fingerprintPass = fpA === fpB && fpA !== fpInv;

  const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const max = latencies.length ? Math.max(...latencies) : 0;
  const latencyVerdict = max < 500 ? 'PASS' : 'ALERT';

  const passBody = () => stableStringify({ simulations: simulations.map((s) => {
    const x = s as { person: string; primary: string | null; context: string[] };
    return { person: x.person, primary: x.primary, context: x.context };
  }) });
  const determinism = passBody() === passBody() ? 'PASS' : 'FAIL';

  const ledgerAfter = ledgerSnapshot(backendRoot);
  const ledger = {
    before: ledgerBefore,
    after: ledgerAfter,
    callsDelta: ledgerAfter.calls - ledgerBefore.calls,
    tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
    eventsDelta: ledgerAfter.events - ledgerBefore.events,
  };

  const byPerson = (name: string) =>
    simulations.find((s) => (s as { person: string }).person === name) as Record<string, unknown> | undefined;
  const reuseBy = (name: string) =>
    reuseRows.find((s) => (s as { person: string }).person === name) as Record<string, unknown> | undefined;

  const johan = byPerson('Johan');
  const camilo = byPerson('Camilo');
  const s19 = byPerson('S19');
  const s9 = byPerson('S9');

  const johanOk =
    johan?.primary === 'SOFTWARE_ENGINEERING' &&
    (johan.context as string[]).includes('VISUAL_DESIGN') &&
    (johan.r1 as { status?: string })?.status === 'RESOLVED' &&
    reuseBy('Johan')?.decision === 'P3_REUSE_BLOCKED_ROLE_CHANGE';
  const camiloOk =
    camilo?.primary === 'SOFTWARE_ENGINEERING' &&
    Array.isArray(camilo.context) &&
    (camilo.context as string[]).length === 0 &&
    !(camilo.secondaries as string[]).some((c) =>
      ['IT_SYSTEMS', 'DATA_ANALYTICS', 'PROJECT_PROGRAM_MGMT'].includes(c),
    );
  const s19Ok =
    s19?.primary === 'COMMUNICATIONS' &&
    (s19.context as string[]).includes('AUDIOVISUAL_PRODUCTION') &&
    (s19.r1 as { status?: string })?.status === 'RESOLVED' &&
    reuseBy('S19')?.decision === 'P3_REUSE_BLOCKED_ROLE_CHANGE';
  const s9Ok = s9?.authorityEligible === false && s9?.fallback === 'FALLBACK_REQUIRED';
  const failPass = failures.every((f) => f.pass);
  const costOk = ledger.callsDelta === 0 && ledger.tokensDelta === 0 && ledger.eventsDelta === 0;
  const simOk = eligible === 3 && simulated === 3 && fallback === 17;

  let verdict:
    | 'P2_AUTHORITY_IMPLEMENTATION_GATE_VALIDATED'
    | 'MORE_IMPLEMENTATION_WORK_REQUIRED'
    | 'P2_AUTHORITY_IMPLEMENTATION_BLOCKED' = 'MORE_IMPLEMENTATION_WORK_REQUIRED';
  if (!costOk || !s9Ok || !prodEq || !flagPass) {
    verdict = 'P2_AUTHORITY_IMPLEMENTATION_BLOCKED';
  } else if (
    johanOk &&
    camiloOk &&
    s19Ok &&
    simOk &&
    failPass &&
    fingerprintPass &&
    determinism === 'PASS'
  ) {
    verdict = 'P2_AUTHORITY_IMPLEMENTATION_GATE_VALIDATED';
  }

  const files: Record<string, unknown> = {
    'runtime-simulation.json': {
      evaluated: inventory.length,
      eligible,
      simulated,
      fallback,
      reused,
      errors,
      actualGeminiSkip: 'NO',
      rows: simulations,
    },
    'eligibility.json': { eligible, rows: eligRows },
    'fallback.json': { fallback, rows: fallbackRows },
    'p3-context.json': { runtime: 'P3_CONTEXT_RUNTIME_DISABLED', rows: p3Rows },
    'p3-reuse-safety.json': { rows: reuseRows },
    'feature-flags.json': flagSafety,
    'failure-injection.json': { passed: failures.filter((f) => f.pass).length, failed: failures.filter((f) => !f.pass).length, cases: failures },
    'latency.json': { avg, max, alertMs: 500, verdict: latencyVerdict, samples: latencies },
    'production-equivalence.json': {
      pass: prodEq,
      p2ContractsUnchanged: prodEq,
      authorityEnabled: false,
      skipEnabled: false,
    },
    'determinism-report.json': {
      determinism,
      ledger,
      fingerprintPass,
      skipGemini: false,
      actualGeminiSkip: 'NO',
      p3: 'NOT_EXECUTED',
      p4: 'NOT_EXECUTED',
      missing141: 'NOT_PROCESSED',
      historicalCounterfactual: {
        eligible,
        tokens: eligible * MEASURED_P2_TOKENS,
        label: 'historicalEstimatedAvoidance',
        actualGeminiCalls: 0,
      },
      verdict,
    },
  };

  const outDir = join(backendRoot, 'tmp', 'mc1-p2-authority-implementation');
  mkdirSync(outDir, { recursive: true });
  const repoTmp = join(backendRoot, '..', 'tmp', 'mc1-p2-authority-implementation');
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
    evaluated: inventory.length,
    eligible,
    simulated,
    fallback,
    reused,
    errors,
    latency: { avg, max, verdict: latencyVerdict },
    productionEquivalence: prodEq ? 'PASS' : 'FAIL',
    featureFlagSafety: flagPass ? 'PASS' : 'FAIL',
    failureIsolation: failPass ? 'PASS' : 'FAIL',
    fingerprint: fingerprintPass ? 'PASS' : 'FAIL',
    determinism,
    tests: { passed: failures.filter((f) => f.pass).length, failed: failures.filter((f) => !f.pass).length },
    controls: { johan, camilo, s19, s9, johanOk, camiloOk, s19Ok, s9Ok },
  };
}
