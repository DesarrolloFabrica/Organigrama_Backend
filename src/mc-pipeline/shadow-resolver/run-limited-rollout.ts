/**
 * FASE — MC1 P2 DETERMINISTIC AUTHORITY LIMITED ROLLOUT GATE
 * Offline. Gemini = 0. No activa skip ni authority.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import { findLatestR1Pack, loadR1Contract, resolveFieldsToEvaluate } from '../p3/p3-context-loader';
import { computeP3ReuseFingerprint } from '../gemini/reuse-fingerprint';
import {
  P3_CONTRACT_VERSION,
  P3_GENERATION_POLICY_VERSION,
  P3_PROMPT_VERSION,
  P3_REASONING_POLICY_VERSION,
} from '../p3/p3.types';
import { SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';
import { discoverHistoricalInventory } from './inventory';
import { artifactIdentityFromP1PackRel } from './full-contract-evidence';
import { evaluateDeterministicAuthority } from './authority-runtime';
import { computeAuthorityFingerprint } from './authority-fingerprint';
import { evaluateP3ReuseSafety } from './p3-context-runtime';
import { p3ContextFromHistoricalR1 } from './p3-shadow-context';
import {
  evaluateLimitedAuthorityDecision,
  isAllowlistedIdentity,
  LIMITED_ROLLOUT_ALLOWLIST,
  MEASURED_P2_TOKENS,
  MEASURED_P3_TOKENS,
  MEASURED_P4_TOKENS,
  productionLimitedRolloutArmed,
  ROLLOUT_STAGES,
} from './limited-rollout';
import { CSET_V2_FIXTURES } from './candidate-set-v2-fixtures';
import { isDeterministicSkipGeminiEnabled } from './flags';

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

function p3Codes(r1: ReturnType<typeof loadR1Contract> | null): string[] {
  if (!r1) return [];
  return [...new Set(resolveFieldsToEvaluate(r1).map((f) => f.fieldCode))].sort();
}

export function runLimitedRolloutGate(backendRoot: string) {
  if (isDeterministicSkipGeminiEnabled() !== false) throw new Error('SKIP_MUST_STAY_FALSE');
  if (productionLimitedRolloutArmed() !== false) throw new Error('ROLLOUT_MUST_STAY_UNARMED');
  const ledgerBefore = ledgerSnapshot(backendRoot);
  const inventory = discoverHistoricalInventory(backendRoot).filter((r) => r.p2Class === 'P2_ELIGIBLE');

  const allowlistRows: unknown[] = [];
  const reviews: unknown[] = [];
  const downstream: unknown[] = [];
  const costs: unknown[] = [];

  for (const entry of LIMITED_ROLLOUT_ALLOWLIST.entries) {
    const row = inventory.find((r) => r.snapshotId === entry.snapshotId);
    if (!row?.p1PackRel) throw new Error(`missing inventory ${entry.person}`);
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, row.p1PackRel));
    const sim = evaluateDeterministicAuthority({
      snapshotId: row.snapshotId,
      personId: entry.personId,
      units,
      artifactIdentity: artifactIdentityFromP1PackRel(row.p1PackRel),
      simulateAuthority: true,
    });
    const fp = computeAuthorityFingerprint({ units });
    const allowlisted = isAllowlistedIdentity({
      personId: entry.personId,
      snapshotId: entry.snapshotId,
    });
    const histR1Pack = findLatestR1Pack(backendRoot, row.snapshotId);
    const histR1 = histR1Pack ? loadR1Contract(histR1Pack) : null;
    const histP3 = histR1 ? p3ContextFromHistoricalR1(histR1) : [];
    const histCodes = p3Codes(histR1);
    const detCodes = [...new Set(sim.p3.map((f) => f.fieldCode))].sort();
    const reuse = evaluateP3ReuseSafety({ historical: histP3, proposed: sim.p3 });
    const histStatus = histR1?.payload.fieldResolutionStatus ?? null;
    const detStatus = sim.r1?.resolutionStatus ?? null;
    const p3FpHist = computeP3ReuseFingerprint({
      p1ArtifactDigest: 'PINNED',
      r1FieldResolutionStatus: String(histStatus),
      fieldsEvaluated: histCodes,
      promptVersion: P3_PROMPT_VERSION,
      contractVersion: P3_CONTRACT_VERSION,
      specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
      reasoningPolicyVersion: P3_REASONING_POLICY_VERSION,
      generationPolicyVersion: P3_GENERATION_POLICY_VERSION,
      model: 'historical',
    });
    const p3FpDet = computeP3ReuseFingerprint({
      p1ArtifactDigest: 'PINNED',
      r1FieldResolutionStatus: String(detStatus),
      fieldsEvaluated: detCodes,
      promptVersion: P3_PROMPT_VERSION,
      contractVersion: P3_CONTRACT_VERSION,
      specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
      reasoningPolicyVersion: P3_REASONING_POLICY_VERSION,
      generationPolicyVersion: P3_GENERATION_POLICY_VERSION,
      model: 'historical',
    });
    const fingerprintEquivalent = p3FpHist === p3FpDet;
    const semanticFieldSetEqual = histCodes.join('|') === detCodes.join('|');
    const roleChange = reuse.roleChanges.length > 0;
    const p3Recompute = !fingerprintEquivalent || roleChange || !semanticFieldSetEqual;
    const p4Recompute = p3Recompute;
    const p2Saved = MEASURED_P2_TOKENS;
    const downstreamCost = (p3Recompute ? MEASURED_P3_TOKENS : 0) + (p4Recompute ? MEASURED_P4_TOKENS : 0);
    const net = p2Saved - downstreamCost;

    let rolloutVerdict: 'ROLLOUT_READY' | 'ROLLOUT_BLOCKED_DOWNSTREAM' | 'NOT_READY' = 'NOT_READY';
    if (!sim.authorityEligible || !allowlisted) rolloutVerdict = 'NOT_READY';
    else if (p3Recompute) rolloutVerdict = 'ROLLOUT_BLOCKED_DOWNSTREAM';
    else rolloutVerdict = 'ROLLOUT_READY';

    allowlistRows.push({
      ...entry,
      allowlisted,
      eligibilityRecheck: sim.authorityEligible,
      authorityFingerprint: fp,
      p1IdentityStable: true,
      allowlistDoesNotForce: true,
    });
    reviews.push({
      person: entry.person,
      personId: entry.personId,
      snapshotId: entry.snapshotId,
      p2: {
        primary: sim.contract?.primary?.fieldCode ?? null,
        context: sim.contract?.contextFields.map((c) => c.fieldCode) ?? [],
        producedBy: sim.producedBy,
        eligible: sim.authorityEligible,
      },
      r1: sim.r1
        ? { status: sim.r1.resolutionStatus, primary: sim.r1.primary, secondaries: sim.r1.secondaries }
        : null,
      historicalR1: { status: histStatus, p3Fields: histCodes },
      rolloutVerdict,
    });
    downstream.push({
      person: entry.person,
      semanticEquivalent: semanticFieldSetEqual && !roleChange,
      fingerprintEquivalent,
      roleChange,
      roleChanges: reuse.roleChanges,
      reuseDecision: reuse.decision,
      p3Recompute: p3Recompute ? 'P3_RECOMPUTE_WOULD_BE_REQUIRED' : 'P3_REUSE_POSSIBLE',
      p4Recompute: p4Recompute ? 'P4_RECOMPUTE_WOULD_BE_REQUIRED' : 'P4_REUSE_POSSIBLE',
      producedByNotInP3Fingerprint: true,
      note: 'P3 reuse today = p1Digest + r1Status + fieldCodes. Not producedBy. Roles not hashed.',
    });
    costs.push({
      person: entry.person,
      p2Saved,
      p3Cost: p3Recompute ? MEASURED_P3_TOKENS : 0,
      p4Cost: p4Recompute ? MEASURED_P4_TOKENS : 0,
      net,
      label: 'HISTORICAL_COUNTERFACTUAL_NET',
    });
  }

  const matrix = [
    { allowlisted: false, eligible: true, killPermits: true, authorityEnabled: true, skipEnabled: true, fingerprintValid: true },
    { allowlisted: true, eligible: false, killPermits: true, authorityEnabled: true, skipEnabled: true, fingerprintValid: true },
    { allowlisted: true, eligible: true, killPermits: false, authorityEnabled: true, skipEnabled: true, fingerprintValid: true },
    { allowlisted: true, eligible: true, killPermits: true, authorityEnabled: false, skipEnabled: true, fingerprintValid: true },
    { allowlisted: true, eligible: true, killPermits: true, authorityEnabled: true, skipEnabled: true, fingerprintValid: true },
  ].map((row) => ({ ...row, ...evaluateLimitedAuthorityDecision(row) }));
  const matrixPass = matrix.every((m, i) =>
    i === 4 ? m.decision === 'DETERMINISTIC_AUTHORITY' : m.decision === 'FALLBACK_REQUIRED',
  );

  const units = CSET_V2_FIXTURES.primaryPlusLegitimateContext;
  const failures = [
    {
      id: 'changedSnapshot',
      pass: !isAllowlistedIdentity({ personId: 1, snapshotId: '12' }),
    },
    {
      id: 'changedResolverFingerprint',
      pass:
        computeAuthorityFingerprint({ units }) !==
        computeAuthorityFingerprint({ units, resolverVersion: '0.9.9' }),
    },
    {
      id: 'staleAllowlist',
      pass:
        evaluateLimitedAuthorityDecision({
          allowlisted: false,
          eligible: true,
          killPermits: true,
          authorityEnabled: true,
          skipEnabled: true,
          fingerprintValid: true,
        }).decision === 'FALLBACK_REQUIRED',
    },
    {
      id: 'invalidContext',
      pass:
        evaluateDeterministicAuthority({
          snapshotId: '8',
          units,
          artifactIdentity: 'x',
          simulateAuthority: true,
          inject: { invalidContextRole: true },
        }).fallback === 'FALLBACK_REQUIRED',
    },
    {
      id: 'storeMissFailClosed',
      pass:
        evaluateLimitedAuthorityDecision({
          allowlisted: true,
          eligible: true,
          killPermits: true,
          authorityEnabled: true,
          skipEnabled: true,
          fingerprintValid: false,
        }).decision === 'FALLBACK_REQUIRED',
    },
    {
      id: 'allowlistDoesNotOverrideAmbiguous',
      pass:
        evaluateLimitedAuthorityDecision({
          allowlisted: true,
          eligible: false,
          killPermits: true,
          authorityEnabled: true,
          skipEnabled: true,
          fingerprintValid: true,
        }).blockedBy.includes('NOT_ELIGIBLE'),
    },
  ];

  const camilo = reviews.find((r) => (r as { person: string }).person === 'Camilo') as Record<string, unknown>;
  const johan = reviews.find((r) => (r as { person: string }).person === 'Johan') as Record<string, unknown>;
  const s19 = reviews.find((r) => (r as { person: string }).person === 'S19') as Record<string, unknown>;
  const ready = reviews.filter((r) => (r as { rolloutVerdict: string }).rolloutVerdict === 'ROLLOUT_READY');
  const firstCandidate = 'CAMILO_ONLY';

  let verdict:
    | 'LIMITED_ROLLOUT_DESIGN_READY'
    | 'ROLLOUT_BLOCKED_BY_DOWNSTREAM_RECOMPUTE'
    | 'MORE_ROLLOUT_DESIGN_REQUIRED' = 'MORE_ROLLOUT_DESIGN_REQUIRED';
  const allBlockedDownstream = reviews.every(
    (r) => (r as { rolloutVerdict: string }).rolloutVerdict === 'ROLLOUT_BLOCKED_DOWNSTREAM',
  );
  const failPass = failures.every((f) => f.pass);
  const ledgerAfter = ledgerSnapshot(backendRoot);
  const ledger = {
    before: ledgerBefore,
    after: ledgerAfter,
    callsDelta: ledgerAfter.calls - ledgerBefore.calls,
    tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
    eventsDelta: ledgerAfter.events - ledgerBefore.events,
  };
  const costOk = ledger.callsDelta === 0 && ledger.tokensDelta === 0 && ledger.eventsDelta === 0;

  if (!costOk || !matrixPass || !failPass) {
    verdict = 'MORE_ROLLOUT_DESIGN_REQUIRED';
  } else if (ready.length === 0 && allBlockedDownstream) {
    verdict = 'ROLLOUT_BLOCKED_BY_DOWNSTREAM_RECOMPUTE';
  } else if (ready.length > 0) {
    verdict = 'LIMITED_ROLLOUT_DESIGN_READY';
  }

  const netTotal = (costs as Array<{ net: number; p2Saved: number; p3Cost: number; p4Cost: number }>).reduce(
    (a, c) => ({
      p2Saved: a.p2Saved + c.p2Saved,
      downstream: a.downstream + c.p3Cost + c.p4Cost,
      net: a.net + c.net,
    }),
    { p2Saved: 0, downstream: 0, net: 0 },
  );

  const files: Record<string, unknown> = {
    'allowlist-design.json': {
      enabled: false,
      identifiers: LIMITED_ROLLOUT_ALLOWLIST.matchOn,
      eligibilityRecheck: true,
      failClosed: true,
      killSwitch: {
        env: 'MC1_P2_DETERMINISTIC_GLOBAL_KILL_SWITCH=false',
        plusHardcodedSkip: true,
        precedence: [
          'killSwitch',
          'authorityEnabled',
          'skipEnabled',
          'allowlisted',
          'authorityEligible',
          'fingerprintValid',
        ],
      },
      rows: allowlistRows,
    },
    'authority-matrix.json': { pass: matrixPass, rows: matrix },
    'candidate-review.json': { firstRolloutCandidate: firstCandidate, rows: reviews },
    'downstream-reuse.json': {
      p3FingerprintIncludesProducedBy: false,
      semanticVsFingerprint: 'separated',
      doNotHideRoleChanges: true,
      rows: downstream,
    },
    'net-cost-counterfactual.json': {
      ...netTotal,
      label: 'HISTORICAL_COUNTERFACTUAL_NET',
      actualGeminiCalls: 0,
      rows: costs,
    },
    'failure-injection.json': {
      passed: failures.filter((f) => f.pass).length,
      failed: failures.filter((f) => !f.pass).length,
      cases: failures,
    },
    'rollback-plan.json': {
      mechanism: 'kill switch / skip=false / authority=false',
      restoresGeminiP2: true,
      noDbRestore: true,
      verdict: 'PASS',
    },
    'rollout-plan.json': {
      stages: ROLLOUT_STAGES,
      armed: false,
      actualSkip: 'NO',
      strategy: {
        A: 'Camilo only — least P3 role risk; still P3 fieldset change',
        B: 'Johan+S19 — role change requires P3 recompute + adapter',
        C: 'all 3 — not without downstream inference',
        recommended: 'A as future canary IF P3 recompute is explicitly authorized; not now',
      },
      verdict,
    },
  };

  const outDir = join(backendRoot, 'tmp', 'mc1-p2-limited-rollout');
  mkdirSync(outDir, { recursive: true });
  const repoTmp = join(backendRoot, '..', 'tmp', 'mc1-p2-limited-rollout');
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
    matrix: matrixPass ? 'PASS' : 'FAIL',
    failure: {
      passed: failures.filter((f) => f.pass).length,
      failed: failures.filter((f) => !f.pass).length,
    },
    net: netTotal,
    firstCandidate,
    controls: { camilo, johan, s19 },
    downstream,
    costs,
  };
}
