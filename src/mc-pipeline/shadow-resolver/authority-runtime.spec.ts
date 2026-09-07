import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { EXPERIMENTAL_RESOLVER_POLICY_V03 } from '../experimental/deterministic-resolver/experimental-policy-v03';
import { RESOLVER_CANDIDATE_2_VERSION } from '../experimental/deterministic-resolver/types';
import { CSET_V2_FIXTURES } from './candidate-set-v2-fixtures';
import { computeAuthorityFingerprint } from './authority-fingerprint';
import { DeterministicP2ReuseStore } from './authority-reuse-store';
import {
  evaluateDeterministicAuthority,
  isAuthoritativeUseAllowed,
  resolveAuthorityRuntimeFlags,
} from './authority-runtime';
import {
  evaluateP3ReuseSafety,
  futureP3FingerprintPart,
  P3_CONTEXT_RUNTIME_DISABLED,
} from './p3-context-runtime';
import { p3ContextFromHistoricalR1 } from './p3-shadow-context';
import {
  isDeterministicSkipGeminiEnabled,
  isP2DeterministicAuthorityEnabled,
  isP2DeterministicSkipGeminiEnabled,
} from './flags';
import { observeMc1DeterministicAuthorityFromP2 } from './hook';
import type { R1ContractEnvelope } from '../r1/r1.types';

function evalSim(id: string, units = CSET_V2_FIXTURES.primaryPlusLegitimateContext, extra?: Parameters<typeof evaluateDeterministicAuthority>[0]) {
  return evaluateDeterministicAuthority({
    snapshotId: id,
    units,
    artifactIdentity: `pack:${id}`,
    simulateAuthority: true,
    ...extra,
  });
}

describe('MC1 P2 deterministic authority implementation', () => {
  it('authority disabled → current P2 path (no replace)', () => {
    const r = evaluateDeterministicAuthority({
      snapshotId: 'A',
      units: CSET_V2_FIXTURES.primaryPlusLegitimateContext,
      artifactIdentity: 'pack:A',
      simulateAuthority: false,
      flags: { resolverEnabled: false, authorityEnabled: false, skipEnabled: false },
    });
    expect(r.event).toBe('DISABLED');
    expect(r.replaceProduction).toBe(false);
    expect(r.productionUnaffected).toBe(true);
    expect(r.evaluated).toBe(false);
  });

  it('eligible + authority disabled → current P2', () => {
    const r = evalSim('A');
    expect(r.authorityEligible).toBe(true);
    expect(r.replaceProduction).toBe(false);
    expect(isP2DeterministicAuthorityEnabled()).toBe(false);
    expect(isAuthoritativeUseAllowed(r.flags)).toBe(false);
  });

  it('eligible + simulation → deterministic contract', () => {
    const r = evalSim('A');
    expect(r.simulated).toBe(true);
    expect(r.producedBy).toBe('DETERMINISTIC_RESOLVER');
    expect(r.contract?.producedBy).toBe('DETERMINISTIC_RESOLVER');
    expect(r.contract?.primary?.fieldCode).toBe('SOFTWARE_ENGINEERING');
    expect(r.contract?.contextFields.some((c) => c.fieldCode === 'VISUAL_DESIGN')).toBe(true);
    expect(r.r1?.resolutionStatus).toBe('RESOLVED');
    expect(r.p3.find((f) => f.fieldCode === 'VISUAL_DESIGN')?.role).toBe('CONTEXT');
    expect(r.event).toBe('P2_DETERMINISTIC_AUTHORITY_SIMULATED');
  });

  it('non-eligible → fallback', () => {
    const r = evalSim('E', CSET_V2_FIXTURES.strongCompetitorPair);
    expect(r.authorityEligible).toBe(false);
    expect(r.fallback).toBe('FALLBACK_REQUIRED');
    expect(r.p3).toEqual([]);
    expect(r.replaceProduction).toBe(false);
    expect(r.producedBy).toBeNull();
  });

  it('resolver throw → fallback, production unaffected', () => {
    const r = evalSim('X', CSET_V2_FIXTURES.primaryPlusLegitimateContext, { inject: { throw: true } });
    expect(r.event).toBe('P2_DETERMINISTIC_ERROR');
    expect(r.fallback).toBe('FALLBACK_REQUIRED');
    expect(r.productionUnaffected).toBe(true);
    expect(r.p3).toEqual([]);
  });

  it('malformed candidate set → fallback', () => {
    const r = evalSim('M', CSET_V2_FIXTURES.primaryPlusLegitimateContext, {
      inject: { malformedSet: true },
    });
    expect(r.fallback).toBe('FALLBACK_REQUIRED');
    expect(r.replaceProduction).toBe(false);
  });

  it('missing catalog → fallback', () => {
    const r = evalSim('C', CSET_V2_FIXTURES.primaryPlusLegitimateContext, {
      inject: { missingCatalog: true },
    });
    expect(r.fallbackReason).toContain('CATALOG_INCOMPATIBLE');
  });

  it('bad fingerprint → fallback', () => {
    const r = evalSim('F', CSET_V2_FIXTURES.primaryPlusLegitimateContext, {
      inject: { badFingerprint: true },
    });
    expect(r.event).toBe('P2_DETERMINISTIC_ERROR');
  });

  it('invalid context role → fallback', () => {
    const r = evalSim('R', CSET_V2_FIXTURES.primaryPlusLegitimateContext, {
      inject: { invalidContextRole: true },
    });
    expect(r.fallbackReason).toContain('INVALID_CONTEXT_ROLE');
  });

  it('role change → P3 reuse blocked', () => {
    const hist = p3ContextFromHistoricalR1({
      payload: {
        fieldResolutionStatus: 'MULTI_FIELD',
        primaryField: { fieldCode: 'SOFTWARE_ENGINEERING', confidence: 1, sourceKey: 'SOFTWARE_ENGINEERING' },
        secondaryFields: [{ fieldCode: 'VISUAL_DESIGN', confidence: 0.4, sourceKey: 'VISUAL_DESIGN' }],
      },
    } as unknown as R1ContractEnvelope);
    const proposed = evalSim('A').p3;
    const safety = evaluateP3ReuseSafety({ historical: hist, proposed });
    expect(safety.decision).toBe('P3_REUSE_BLOCKED_ROLE_CHANGE');
    expect(P3_CONTEXT_RUNTIME_DISABLED).toBe(true);
  });

  it('same fingerprint → reuse', () => {
    const store = new DeterministicP2ReuseStore();
    const a = evalSim('A', CSET_V2_FIXTURES.primaryPlusLegitimateContext, { reuseStore: store });
    const b = evalSim('A', CSET_V2_FIXTURES.primaryPlusLegitimateContext, { reuseStore: store });
    expect(a.reused).toBe(false);
    expect(b.reused).toBe(true);
    expect(b.event).toBe('P2_DETERMINISTIC_REUSED');
    expect(a.observability.fingerprint).toBe(b.observability.fingerprint);
  });

  it('version change → invalidation', () => {
    const units = CSET_V2_FIXTURES.primaryPlusLegitimateContext;
    const a = computeAuthorityFingerprint({ units, resolverVersion: '0.3.0' });
    const b = computeAuthorityFingerprint({ units, resolverVersion: '0.3.1' });
    expect(a).not.toBe(b);
  });

  it('kill switch precedence: skip=true accidental never authoritative', () => {
    expect(isP2DeterministicSkipGeminiEnabled()).toBe(false);
    expect(isDeterministicSkipGeminiEnabled()).toBe(false);
    const allowed = isAuthoritativeUseAllowed({
      resolverEnabled: true,
      authorityEnabled: true,
      skipEnabled: true,
    });
    expect(allowed).toBe(false);
  });

  it('production equivalence: hook does not replace P2', () => {
    const src = readFileSync(join(process.cwd(), 'src/mc-pipeline/p2/p2-runner.ts'), 'utf8');
    expect(src).toContain('callP1GeminiJson');
    expect(src).toContain('observeMc1DeterministicAuthorityFromP2');
    expect(src).not.toContain('resolveFieldsHardened');
    const dummy = { envelope: { x: 1 } };
    const before = JSON.stringify(dummy);
    observeMc1DeterministicAuthorityFromP2({
      backendRoot: process.cwd(),
      snapshotId: '0',
      units: [],
      artifactIdentity: 'none',
    });
    expect(JSON.stringify(dummy)).toBe(before);
    expect(resolveAuthorityRuntimeFlags().authorityEnabled).toBe(false);
    expect(resolveAuthorityRuntimeFlags().skipEnabled).toBe(false);
  });

  it('future P3 fingerprint includes role only when authority on', () => {
    const fields = [
      { fieldCode: 'SOFTWARE_ENGINEERING', role: 'PRIMARY' as const },
      { fieldCode: 'VISUAL_DESIGN', role: 'CONTEXT' as const },
    ];
    const off = futureP3FingerprintPart(fields, false);
    const on = futureP3FingerprintPart(fields, true);
    const asSecondary = futureP3FingerprintPart(
      [
        { fieldCode: 'SOFTWARE_ENGINEERING', role: 'PRIMARY' },
        { fieldCode: 'VISUAL_DESIGN', role: 'SECONDARY' },
      ],
      true,
    );
    expect(off).toBe('SOFTWARE_ENGINEERING,VISUAL_DESIGN');
    expect(on).not.toBe(asSecondary);
    expect(createHash('sha256').update(off).digest('hex')).toBeTruthy();
  });

  it('COMM + AV simulation: primary COMM, AV CONTEXT, not R1 secondary', () => {
    const r = evalSim('F', CSET_V2_FIXTURES.commPlusAvContext);
    expect(r.contract?.primary?.fieldCode).toBe('COMMUNICATIONS');
    expect(r.p3.find((f) => f.fieldCode === 'AUDIOVISUAL_PRODUCTION')?.role).toBe('CONTEXT');
    expect(r.r1?.secondaries).not.toContain('AUDIOVISUAL_PRODUCTION');
  });

  it('C2 still resolves the fixture (stack unchanged)', () => {
    const p2 = resolveFieldsHardened({
      snapshotId: 'A',
      units: CSET_V2_FIXTURES.primaryPlusLegitimateContext,
      policy: EXPERIMENTAL_RESOLVER_POLICY_V03,
      resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
    });
    expect(p2.resolvedFieldCode).toBe('SOFTWARE_ENGINEERING');
  });
});
