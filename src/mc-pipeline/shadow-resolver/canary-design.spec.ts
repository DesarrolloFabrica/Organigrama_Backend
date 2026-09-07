import {
  CAMILO_CANARY_IDENTITY,
  CANARY_ISOLATED_RUNNER_ID,
  CANARY_NOT_CANDIDATES,
  evaluateCanaryPreconditions,
  isCamiloCanaryIdentity,
  isP2CanaryEnabled,
  productionCanaryArmed,
  assertCanaryScope,
  assertP2CanaryShape,
  type CanaryPreconditionsInput,
} from './canary-design';
import { isP2DeterministicAuthorityEnabled, isP2DeterministicSkipGeminiEnabled } from './flags';
import type { ReuseDecision } from '../semantic-reuse/types';

function camiloOk(over: Partial<CanaryPreconditionsInput> = {}): CanaryPreconditionsInput {
  return {
    personId: 1,
    snapshotId: '8',
    p1EvidenceIdentity: 'p1',
    pinnedP1EvidenceIdentity: 'p1',
    authorityFingerprint: 'af',
    pinnedAuthorityFingerprint: 'af',
    p3SemanticFingerprint: 'p3',
    pinnedP3SemanticFingerprint: 'p3',
    p4SemanticFingerprint: 'p4',
    pinnedP4SemanticFingerprint: 'p4',
    resolverVersion: CAMILO_CANARY_IDENTITY.resolverVersion,
    policyVersion: CAMILO_CANARY_IDENTITY.policyVersion,
    candidateSetPolicyVersion: CAMILO_CANARY_IDENTITY.candidateSetPolicyVersion,
    contractAdapterVersion: CAMILO_CANARY_IDENTITY.contractAdapterVersion,
    catalogVersion: '1.13.0',
    pinnedCatalogVersion: '1.13.0',
    authorityEligible: true,
    p3PackExists: true,
    p4PackExists: true,
    p3Reuse: 'SAFE_REUSE_WITH_METADATA_CHANGE',
    p4Reuse: 'SAFE_REUSE_WITH_METADATA_CHANGE',
    profileReassemblyAvailable: true,
    canaryEnabled: true,
    killPermits: true,
    ...over,
  };
}

describe('MC1 P2 semantic reuse canary design', () => {
  it('is not armed and skip/authority stay false', () => {
    expect(productionCanaryArmed()).toBe(false);
    expect(isP2CanaryEnabled()).toBe(false);
    expect(isP2DeterministicSkipGeminiEnabled()).toBe(false);
    expect(isP2DeterministicAuthorityEnabled()).toBe(false);
  });

  it('scope hard lock aborts anyone else', () => {
    expect(assertCanaryScope({ personId: 1, snapshotId: '8' })).toEqual({ ok: true });
    expect(assertCanaryScope({ personId: 2, snapshotId: '12' })).toEqual({
      ok: false,
      reason: 'CANARY_ABORT_SCOPE_MISMATCH',
    });
    expect(assertCanaryScope({ personId: 1, snapshotId: '99' })).toEqual({
      ok: false,
      reason: 'CANARY_ABORT_SCOPE_MISMATCH',
    });
    expect(isCamiloCanaryIdentity({ personId: 1, snapshotId: '8' })).toBe(true);
    expect(isCamiloCanaryIdentity({ personId: 1, snapshotId: '12' })).toBe(false);
    expect(isCamiloCanaryIdentity({ personId: 2, snapshotId: '8' })).toBe(false);
    expect(CANARY_NOT_CANDIDATES.Johan.snapshotId).toBe('12');
    expect(CANARY_NOT_CANDIDATES.S19.snapshotId).toBe('19');
  });

  it('Camilo exact inputs → dry-run ready (flags skipped) and execution ready if flags on', () => {
    const dry = evaluateCanaryPreconditions(camiloOk(), { skipExecutionFlags: true });
    expect(dry.decision).toBe('CANARY_DRY_RUN_READY');
    expect(dry.geminiFallback).toBe('DISABLED_FOR_CANARY');
    const exec = evaluateCanaryPreconditions(camiloOk({ canaryEnabled: true, killPermits: true }));
    expect(exec.decision).toBe('CANARY_DRY_RUN_READY');
  });

  it('changed snapshot → abort, no Gemini fallback', () => {
    const r = evaluateCanaryPreconditions(camiloOk({ snapshotId: '99' }), { skipExecutionFlags: true });
    expect(r.decision).toBe('CANARY_ABORT');
    expect(r.blockedBy).toEqual(expect.arrayContaining(['NOT_ALLOWLISTED', 'SNAPSHOT_MISMATCH']));
    expect(r.geminiFallback).toBe('DISABLED_FOR_CANARY');
  });

  it('changed P1 → abort', () => {
    const r = evaluateCanaryPreconditions(camiloOk({ p1EvidenceIdentity: 'other' }), {
      skipExecutionFlags: true,
    });
    expect(r.blockedBy).toContain('P1_IDENTITY_MISMATCH');
    expect(r.geminiFallback).toBe('DISABLED_FOR_CANARY');
  });

  it('changed catalog → abort', () => {
    const r = evaluateCanaryPreconditions(camiloOk({ catalogVersion: '9.9.9' }), {
      skipExecutionFlags: true,
    });
    expect(r.blockedBy).toContain('CATALOG_CHANGED');
  });

  it('P2 not eligible → abort', () => {
    const r = evaluateCanaryPreconditions(camiloOk({ authorityEligible: false }), {
      skipExecutionFlags: true,
    });
    expect(r.blockedBy).toContain('AUTHORITY_NOT_ELIGIBLE');
  });

  it('P3 reuse unsafe → abort', () => {
    const unsafe: ReuseDecision = 'RECOMPUTE_REQUIRED';
    const r = evaluateCanaryPreconditions(camiloOk({ p3Reuse: unsafe }), { skipExecutionFlags: true });
    expect(r.blockedBy).toContain('P3_REUSE_UNSAFE');
  });

  it('P4 reuse unsafe → abort', () => {
    const r = evaluateCanaryPreconditions(camiloOk({ p4Reuse: 'REUSE_UNPROVEN' }), {
      skipExecutionFlags: true,
    });
    expect(r.blockedBy).toContain('P4_REUSE_UNSAFE');
  });

  it('missing pack → abort', () => {
    const p3 = evaluateCanaryPreconditions(camiloOk({ p3PackExists: false }), {
      skipExecutionFlags: true,
    });
    const p4 = evaluateCanaryPreconditions(camiloOk({ p4PackExists: false }), {
      skipExecutionFlags: true,
    });
    expect(p3.blockedBy).toContain('P3_PACK_MISSING');
    expect(p4.blockedBy).toContain('P4_PACK_MISSING');
  });

  it('kill switch → abort and flags off abort execution', () => {
    const kill = evaluateCanaryPreconditions(camiloOk({ killPermits: false, canaryEnabled: true }));
    expect(kill.blockedBy).toContain('KILL_SWITCH');
    const disabled = evaluateCanaryPreconditions(camiloOk({ canaryEnabled: false, killPermits: true }));
    expect(disabled.blockedBy).toContain('CANARY_DISABLED');
    expect(kill.geminiFallback).toBe('DISABLED_FOR_CANARY');
  });

  it('resolver version change → abort', () => {
    const r = evaluateCanaryPreconditions(camiloOk({ resolverVersion: '9.9.9' }), {
      skipExecutionFlags: true,
    });
    expect(r.blockedBy).toContain('RESOLVER_VERSION_MISMATCH');
  });

  it('isolated runner id is explicit and P2 shape is fail-closed', () => {
    expect(CANARY_ISOLATED_RUNNER_ID).toBe('mc1-p2-semantic-reuse-canary');
    expect(
      assertP2CanaryShape({
        decision: 'RESOLVED',
        authorityEligible: true,
        primary: 'SOFTWARE_ENGINEERING',
        secondaries: [],
        context: [],
        producedBy: 'DETERMINISTIC_RESOLVER',
        valid: true,
      }),
    ).toEqual({ ok: true });
    const bad = assertP2CanaryShape({
      decision: 'AMBIGUOUS',
      authorityEligible: true,
      primary: 'SOFTWARE_ENGINEERING',
      secondaries: ['IT_SYSTEMS'],
      context: [],
      producedBy: 'GEMINI',
      valid: true,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe('P2_SHAPE_MISMATCH');
  });
});
