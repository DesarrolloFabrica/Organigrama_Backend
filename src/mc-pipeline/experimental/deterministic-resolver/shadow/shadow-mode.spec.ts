import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shadowInputFingerprint } from './fingerprint';
import { runShadowSimulation, comparableShadowPayload } from './run-shadow';
import { ShadowEventStore } from './shadow-store';
import { SIMULATION_CREATED_AT } from './shadow-types';
import { stableStringify } from '../run-prototype';
import type { ResolverEvidenceUnit } from '../types';
import type { ShadowDecision } from './shadow-types';
import { SHADOW_EVENT_TYPE, SHADOW_NAMESPACE } from './shadow-types';

const BACKEND = process.cwd();

function eu(id: string): ResolverEvidenceUnit {
  return {
    evidenceId: id,
    candidateId: id,
    evidenceKind: 'ACTION',
    explicitness: 'EXPLICIT',
    decision: 'ACCEPTED',
    normalizedActivity: 'desarrollar frontend',
    object: 'frontend',
    toolOrMethod: 'React',
    result: null,
    scope: null,
    temporalContext: null,
    startOffset: 0,
    endOffset: 20,
  };
}

describe('MC1 hybrid resolver shadow mode', () => {
  it('fingerprint ignores createdAt and is stable', () => {
    const units = [eu('a'), eu('b')];
    const a = shadowInputFingerprint({ units, phase: 'P2' });
    const b = shadowInputFingerprint({ units, phase: 'P2' });
    expect(a).toBe(b);
    expect(a).not.toContain(SIMULATION_CREATED_AT);
  });

  it('store reuses same fingerprint without recomputing', () => {
    const store = new ShadowEventStore(join(BACKEND, 'tmp', 'mc1-hybrid-resolver-shadow'));
    const d = {
      namespace: SHADOW_NAMESPACE,
      eventType: SHADOW_EVENT_TYPE,
      notAProductionResult: true as const,
      phase: 'P2' as const,
      personId: 1,
      personLabel: 'x',
      snapshotId: '8',
      resolverVersion: '0.2.0',
      policyVersion: '0.2.0',
      catalogVersion: '2.0.0',
      decision: 'RESOLVED' as const,
      candidateCode: 'SOFTWARE_ENGINEERING',
      supportingEvidenceIds: ['c-1'],
      independentSourceCount: 2,
      reasonCodes: ['CLEAR_FIELD_MARGIN'],
      competitors: [],
      inputFingerprint: 'abc',
      createdAt: SIMULATION_CREATED_AT,
      reused: false,
      wouldSkipGemini: true,
      differentialSignalsMatched: [],
    } satisfies ShadowDecision;
    expect(store.put(d)).toBe('COMPUTED');
    expect(store.put(d)).toBe('SHADOW_REUSED');
  });

  it('refuses production pack paths', () => {
    expect(
      ShadowEventStore.isProductionPackPath(
        'tmp/mc1-p2-functional/P2F-8A2-S8-x/summary.json',
      ),
    ).toBe(true);
    expect(
      ShadowEventStore.isProductionPackPath('tmp/mc1-hybrid-resolver-shadow/shadow-p2.json'),
    ).toBe(false);
  });

  it('offline simulation matches hardened controls and does not call Gemini', () => {
    const sim = runShadowSimulation(BACKEND);
    expect(sim.ledger.callsDelta).toBe(0);
    expect(sim.ledger.tokensDelta).toBe(0);
    expect(sim.productionImpact).toBe('NONE');
    expect(sim.p4).toBe('OUT_OF_SCOPE');
    expect(sim.missingProfiles141).toBe('NOT_PROCESSED');
    expect(sim.futureGates.skipGeminiEnabled).toBe(false);
    expect(sim.criticalControls.allPass).toBe(true);
    expect(sim.criticalControls.criticalFalsePositives).toBe(0);
    expect(sim.criticalControls.versionBlocked).toBe(false);
    expect(sim.p2.some((r) => r.personLabel === 'Sara' && r.decision === 'RESOLVED')).toBe(
      true,
    );
    const saraGov = sim.p3.find(
      (r) => r.personLabel === 'Sara' && r.specialtyCode === 'DATA_GOVERNANCE',
    );
    expect(saraGov?.decision).toBe('RESOLVED');
    const haiderGov = sim.p3.find(
      (r) => r.personLabel === 'Haider' && r.specialtyCode === 'DATA_GOVERNANCE',
    );
    expect(haiderGov?.decision).not.toBe('RESOLVED');
    const diegoGov = sim.p3.find(
      (r) => r.personLabel === 'Diego' && r.specialtyCode === 'DATA_GOVERNANCE',
    );
    expect(diegoGov?.decision).toBe('AMBIGUOUS');
    const johanFe = sim.p3.find(
      (r) => r.personLabel === 'Johan' && r.specialtyCode === 'FRONTEND_ENGINEERING',
    );
    expect(johanFe?.decision).toBe('RESOLVED');
    const jp = sim.p2.find((r) => r.personLabel === 'Juan Pablo');
    expect(jp?.decision).toBe('AMBIGUOUS');
    const kath = sim.p2.find((r) => r.personLabel === 'Katherin');
    expect(kath?.decision).not.toBe('RESOLVED');
    const camilo = sim.p3.find(
      (r) =>
        r.personLabel === 'Camilo' && r.specialtyCode === 'PLATFORM_DEVOPS_ENGINEERING',
    );
    expect(camilo?.decision).toBe('RESOLVED');
    expect(JSON.stringify(sim.p2)).not.toContain('sourceText');
    expect(sim.metrics.p2.evaluated).toBe(10);
    expect(sim.metrics.p2.resolved).toBe(5);
    expect(sim.metrics.p2.wouldSkip).toBe(5);
    expect(sim.futureGates.p2.skipGeminiEnabled).toBe(false);
  });

  it('two simulations are byte-equivalent on decisions/fingerprints/comparison', () => {
    const a = comparableShadowPayload(runShadowSimulation(BACKEND));
    const b = comparableShadowPayload(runShadowSimulation(BACKEND));
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('production runners do not import shadow', () => {
    const p2 = readFileSync(
      join(BACKEND, 'src', 'mc-pipeline', 'p2', 'p2-runner.ts'),
      'utf8',
    );
    const p3 = readFileSync(
      join(BACKEND, 'src', 'mc-pipeline', 'p3', 'p3-runner.ts'),
      'utf8',
    );
    const p4 = readFileSync(
      join(BACKEND, 'src', 'mc-pipeline', 'p4', 'p4-runner.ts'),
      'utf8',
    );
    expect(p2).not.toContain('deterministic-resolver');
    expect(p3).not.toContain('deterministic-resolver');
    expect(p4).not.toContain('deterministic-resolver');
  });
});
