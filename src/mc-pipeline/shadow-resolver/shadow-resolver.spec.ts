import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COHORT } from '../experimental/deterministic-resolver/cohort';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { isDeterministicSkipGeminiEnabled, isShadowResolverEnabled } from './flags';
import { observeMc1ShadowFromP2 } from './hook';
import { PersistentShadowStore } from './persist';
import { observeP2Shadow, observeP3Shadow } from './runtime';
import type { ResolverEvidenceUnit } from '../experimental/deterministic-resolver/types';

const BACKEND = process.cwd();

function eu(id: string, activity: string): ResolverEvidenceUnit {
  return {
    evidenceId: id,
    candidateId: id,
    evidenceKind: 'ACTION',
    explicitness: 'EXPLICIT',
    decision: 'ACCEPTED',
    normalizedActivity: activity,
    object: activity,
    toolOrMethod: null,
    result: 'garantizando integridad',
    scope: null,
    temporalContext: null,
    startOffset: id === 'a' ? 0 : 400,
    endOffset: id === 'a' ? 40 : 480,
    pageNumber: 1,
  };
}

describe('MC1 shadow resolver runtime', () => {
  const prev = process.env.MC1_SHADOW_RESOLVER_ENABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.MC1_SHADOW_RESOLVER_ENABLED;
    else process.env.MC1_SHADOW_RESOLVER_ENABLED = prev;
  });

  it('skip Gemini flag is hardcoded false', () => {
    expect(isDeterministicSkipGeminiEnabled()).toBe(false);
  });

  it('shadow disabled → no event', () => {
    process.env.MC1_SHADOW_RESOLVER_ENABLED = 'false';
    expect(isShadowResolverEnabled()).toBe(false);
    const dir = mkdtempSync(join(tmpdir(), 'mc1-shadow-'));
    const store = new PersistentShadowStore(dir);
    const r = observeP2Shadow({
      store,
      units: [eu('a', 'administrar esquema'), eu('b', 'consolidar repositorio')],
      snapshotId: '20',
      personId: 52,
      enabled: false,
    });
    expect(r.status).toBe('DISABLED');
    expect(store.count()).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  it('shadow enabled → event', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc1-shadow-'));
    const store = new PersistentShadowStore(dir);
    const r = observeP2Shadow({
      store,
      units: [eu('a', 'administrar esquema'), eu('b', 'consolidar repositorio')],
      snapshotId: '20',
      personId: 52,
      enabled: true,
      createdAt: '1970-01-01T00:00:00.000Z',
    });
    expect(r.status).toBe('COMPUTED');
    expect(r.event?.decision).toBeTruthy();
    expect(r.productionMutated).toBe(false);
    expect(store.count()).toBe(1);
    expect(JSON.stringify(r.event)).not.toContain('sourceText');
    rmSync(dir, { recursive: true, force: true });
  });

  it('shadow failure → production unaffected', () => {
    const production = { rank1: 'DATA_ANALYTICS', frozen: true };
    const before = JSON.stringify(production);
    const store = {
      lookup: () => {
        throw new Error('boom');
      },
      insert: () => 'COMPUTED',
    } as unknown as PersistentShadowStore;
    const r = observeP2Shadow({
      store,
      units: [eu('a', 'x')],
      snapshotId: '20',
      personId: 52,
      enabled: true,
    });
    expect(r.status).toBe('ERROR');
    expect(r.productionMutated).toBe(false);
    expect(JSON.stringify(production)).toBe(before);
  });

  it('same fingerprint → SHADOW_REUSED', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc1-shadow-'));
    const store = new PersistentShadowStore(dir);
    const ctx = {
      store,
      units: [eu('a', 'administrar esquema'), eu('b', 'consolidar repositorio')],
      snapshotId: '20',
      personId: 52,
      enabled: true as const,
      createdAt: '1970-01-01T00:00:00.000Z',
    };
    expect(observeP2Shadow(ctx).status).toBe('COMPUTED');
    expect(observeP2Shadow(ctx).status).toBe('SHADOW_REUSED');
    expect(store.count()).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('policyVersion change → new fingerprint and recompute', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc1-shadow-'));
    const store = new PersistentShadowStore(dir);
    const units = [eu('a', 'administrar esquema'), eu('b', 'consolidar repositorio')];
    const a = observeP2Shadow({
      store,
      units,
      snapshotId: '20',
      personId: 52,
      enabled: true,
      policyVersion: '0.2.0',
    });
    const b = observeP2Shadow({
      store,
      units,
      snapshotId: '20',
      personId: 52,
      enabled: true,
      policyVersion: '0.2.0-probe',
    });
    expect(a.status).toBe('COMPUTED');
    expect(b.status).toBe('COMPUTED');
    expect(a.event?.inputFingerprint).not.toBe(b.event?.inputFingerprint);
    expect(store.count()).toBe(2);
    rmSync(dir, { recursive: true, force: true });
  });

  it('wouldSkip is true only when RESOLVED and skip flag stays false', () => {
    expect(isDeterministicSkipGeminiEnabled()).toBe(false);
    const sara = COHORT.find((c) => c.person === 'Sara')!;
    const units = loadEvidenceUnitsFromP1Pack(join(BACKEND, sara.p1PackRel));
    const dir = mkdtempSync(join(tmpdir(), 'mc1-shadow-'));
    const store = new PersistentShadowStore(dir);
    const r = observeP2Shadow({
      store,
      units,
      snapshotId: sara.snapshotId,
      personId: sara.personId,
      personLabel: 'Sara',
      enabled: true,
    });
    expect(r.event?.decision).toBe('RESOLVED');
    expect(r.event?.wouldSkipGemini).toBe(true);
    expect(isDeterministicSkipGeminiEnabled()).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('hook with flag off does not mutate a production payload', () => {
    process.env.MC1_SHADOW_RESOLVER_ENABLED = 'false';
    const production = { envelope: { ok: true } };
    const before = JSON.stringify(production);
    observeMc1ShadowFromP2({
      backendRoot: BACKEND,
      snapshotId: '20',
      personId: 52,
      units: [],
    });
    expect(JSON.stringify(production)).toBe(before);
  });

  it('critical controls via runtime (same resolver as production hook)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc1-shadow-'));
    const store = new PersistentShadowStore(dir);
    const wanted = ['Sara', 'Haider', 'Diego', 'Johan', 'Camilo', 'Juan Pablo', 'Katherin'];
    for (const member of COHORT.filter((c) => wanted.includes(c.person))) {
      const units = loadEvidenceUnitsFromP1Pack(join(BACKEND, member.p1PackRel));
      observeP3Shadow({
        store,
        units,
        snapshotId: member.snapshotId,
        personId: member.personId,
        personLabel: member.person,
        enabled: true,
      });
    }
    const p2 = store.p2Events();
    const p3 = store.p3Events();
    expect(p2.find((e) => e.personLabel === 'Sara')?.decision).toBe('RESOLVED');
    expect(p2.find((e) => e.personLabel === 'Haider')?.decision).toBe('RESOLVED');
    expect(p2.find((e) => e.personLabel === 'Johan')?.decision).toBe('RESOLVED');
    expect(p2.find((e) => e.personLabel === 'Juan Pablo')?.decision).toBe('AMBIGUOUS');
    expect(p2.find((e) => e.personLabel === 'Katherin')?.decision).not.toBe('RESOLVED');
    expect(
      p3.find((e) => e.personLabel === 'Sara' && e.specialtyCode === 'DATA_GOVERNANCE')
        ?.decision,
    ).toBe('RESOLVED');
    expect(
      p3.find((e) => e.personLabel === 'Haider' && e.specialtyCode === 'DATA_GOVERNANCE')
        ?.decision,
    ).not.toBe('RESOLVED');
    expect(
      p3.find((e) => e.personLabel === 'Diego' && e.specialtyCode === 'DATA_GOVERNANCE')
        ?.decision,
    ).toBe('AMBIGUOUS');
    expect(
      p3.find(
        (e) => e.personLabel === 'Johan' && e.specialtyCode === 'FRONTEND_ENGINEERING',
      )?.decision,
    ).toBe('RESOLVED');
    expect(
      p3.find(
        (e) =>
          e.personLabel === 'Camilo' && e.specialtyCode === 'PLATFORM_DEVOPS_ENGINEERING',
      )?.decision,
    ).toBe('RESOLVED');
    rmSync(dir, { recursive: true, force: true });
  });

  it('p2/p3 import shadow hook only; p4 does not', () => {
    const p2 = readFileSync(join(BACKEND, 'src/mc-pipeline/p2/p2-runner.ts'), 'utf8');
    const p3 = readFileSync(join(BACKEND, 'src/mc-pipeline/p3/p3-runner.ts'), 'utf8');
    const p4 = readFileSync(join(BACKEND, 'src/mc-pipeline/p4/p4-runner.ts'), 'utf8');
    expect(p2).toContain("from '../shadow-resolver/hook'");
    expect(p3).toContain("from '../shadow-resolver/hook'");
    expect(p2).not.toContain('resolveFieldsHardened');
    expect(p4).not.toContain('shadow-resolver');
  });
});
