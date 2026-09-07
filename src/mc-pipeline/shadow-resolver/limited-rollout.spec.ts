import {
  evaluateLimitedAuthorityDecision,
  isAllowlistedIdentity,
  killSwitchPermits,
  LIMITED_ROLLOUT_ALLOWLIST,
  productionLimitedRolloutArmed,
} from './limited-rollout';
import { evaluateDeterministicAuthority } from './authority-runtime';
import { CSET_V2_FIXTURES } from './candidate-set-v2-fixtures';
import { computeAuthorityFingerprint } from './authority-fingerprint';
import { isP2DeterministicAuthorityEnabled, isP2DeterministicSkipGeminiEnabled } from './flags';

describe('MC1 P2 limited rollout design', () => {
  it('is not armed in production', () => {
    expect(productionLimitedRolloutArmed()).toBe(false);
    expect(LIMITED_ROLLOUT_ALLOWLIST.enabled).toBe(false);
    expect(isP2DeterministicAuthorityEnabled()).toBe(false);
    expect(isP2DeterministicSkipGeminiEnabled()).toBe(false);
    expect(killSwitchPermits()).toBe(false);
  });

  it('allowlist matches personId+snapshotId, not name alone', () => {
    expect(isAllowlistedIdentity({ personId: 1, snapshotId: '8' })).toBe(true);
    expect(isAllowlistedIdentity({ personId: 1, snapshotId: '99' })).toBe(false);
    expect(isAllowlistedIdentity({ personId: 999, snapshotId: '8' })).toBe(false);
  });

  it('authority matrix', () => {
    const rows: Array<{
      allowlisted: boolean;
      eligible: boolean;
      killPermits: boolean;
      authorityEnabled: boolean;
      expected: 'FALLBACK_REQUIRED' | 'DETERMINISTIC_AUTHORITY';
    }> = [
      { allowlisted: false, eligible: true, killPermits: true, authorityEnabled: true, expected: 'FALLBACK_REQUIRED' },
      { allowlisted: true, eligible: false, killPermits: true, authorityEnabled: true, expected: 'FALLBACK_REQUIRED' },
      { allowlisted: true, eligible: true, killPermits: false, authorityEnabled: true, expected: 'FALLBACK_REQUIRED' },
      { allowlisted: true, eligible: true, killPermits: true, authorityEnabled: false, expected: 'FALLBACK_REQUIRED' },
      { allowlisted: true, eligible: true, killPermits: true, authorityEnabled: true, expected: 'DETERMINISTIC_AUTHORITY' },
    ];
    for (const row of rows) {
      const d = evaluateLimitedAuthorityDecision({
        ...row,
        skipEnabled: true,
        fingerprintValid: true,
      });
      expect(d.decision).toBe(row.expected);
    }
  });

  it('allowlist does not override ineligible resolver', () => {
    const r = evaluateDeterministicAuthority({
      snapshotId: 'E',
      units: CSET_V2_FIXTURES.strongCompetitorPair,
      artifactIdentity: 'pack:E',
      simulateAuthority: true,
    });
    expect(r.authorityEligible).toBe(false);
    const d = evaluateLimitedAuthorityDecision({
      allowlisted: true,
      eligible: r.authorityEligible,
      killPermits: true,
      authorityEnabled: true,
      skipEnabled: true,
      fingerprintValid: true,
    });
    expect(d.decision).toBe('FALLBACK_REQUIRED');
    expect(d.blockedBy).toContain('NOT_ELIGIBLE');
  });

  it('failure injection → fallback', () => {
    const units = CSET_V2_FIXTURES.primaryPlusLegitimateContext;
    const fp = computeAuthorityFingerprint({ units });
    const changed = computeAuthorityFingerprint({ units, resolverVersion: '9.9.9' });
    expect(fp).not.toBe(changed);

    const cases = [
      evaluateLimitedAuthorityDecision({
        allowlisted: true,
        eligible: true,
        killPermits: true,
        authorityEnabled: true,
        skipEnabled: true,
        fingerprintValid: false,
      }),
      evaluateLimitedAuthorityDecision({
        allowlisted: isAllowlistedIdentity({ personId: 1, snapshotId: '12' }),
        eligible: true,
        killPermits: true,
        authorityEnabled: true,
        skipEnabled: true,
        fingerprintValid: true,
      }),
      evaluateLimitedAuthorityDecision({
        allowlisted: true,
        eligible: true,
        killPermits: false,
        authorityEnabled: true,
        skipEnabled: true,
        fingerprintValid: true,
      }),
    ];
    for (const c of cases) expect(c.decision).toBe('FALLBACK_REQUIRED');

    const err = evaluateDeterministicAuthority({
      snapshotId: '8',
      units,
      artifactIdentity: 'pack:8',
      simulateAuthority: true,
      inject: { throw: true },
    });
    expect(err.fallback).toBe('FALLBACK_REQUIRED');
  });
});
