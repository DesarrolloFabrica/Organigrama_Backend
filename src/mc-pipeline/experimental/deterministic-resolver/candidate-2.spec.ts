import { resolveFieldsHardened } from './field-resolver-hardened';
import { EXPERIMENTAL_RESOLVER_POLICY_V03 } from './experimental-policy-v03';
import { RESOLVER_CANDIDATE_2_VERSION } from './types';
import {
  evaluateP2SkipEligibility,
  SKIP_CANDIDATE_CODE,
  SKIP_CANDIDATE_2_CODE,
} from '../../shadow-resolver/skip-eligibility';
import { EXPERIMENTAL_RESOLVER_POLICY } from './experimental-policy';
import {
  SE_DA_CASE_A_SOFTWARE_SQL,
  SE_DA_CASE_B_ANALYTICS,
  SE_DA_CASE_C_MIXED,
  SE_DA_CASE_D_TOOL_ONLY,
  SE_DA_CASE_E_DATA_ENGINEERING,
  S9_STRUCTURAL_FIXTURE,
  s9DifferentialAsToolOnly,
  s9WithDaDifferential,
  s9WithoutSeDifferential,
  s9WithStrongSeCompetitor,
} from './candidate-2-fixtures';
import type { ResolverEvidenceUnit } from './types';

function c2(units: ResolverEvidenceUnit[], id = 'c2') {
  return resolveFieldsHardened({
    snapshotId: id,
    units,
    policy: EXPERIMENTAL_RESOLVER_POLICY_V03,
    resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
  });
}

function skipC2(units: ResolverEvidenceUnit[], id = 'c2') {
  const p2 = c2(units, id);
  return {
    p2,
    skip: evaluateP2SkipEligibility(p2, units, {
      candidate: 'C2',
      policy: EXPERIMENTAL_RESOLVER_POLICY_V03,
    }),
  };
}

describe('MC1 DETERMINISTIC RESOLVER CANDIDATE.2', () => {
  it('does not overwrite Candidate.1 versions', () => {
    expect(SKIP_CANDIDATE_CODE).toBe('MC1.DETERMINISTIC.RESOLVER.CANDIDATE.1');
    expect(SKIP_CANDIDATE_2_CODE).toBe('MC1.DETERMINISTIC.RESOLVER.CANDIDATE.2');
    expect(EXPERIMENTAL_RESOLVER_POLICY.policyVersion).toBe('0.2.0');
    expect(EXPERIMENTAL_RESOLVER_POLICY_V03.policyVersion).toBe('0.3.0');
    const c1 = resolveFieldsHardened({ snapshotId: 'c1', units: SE_DA_CASE_B_ANALYTICS });
    expect(c1.resolverVersion).toBe('0.2.0');
  });

  it('A — software + SQL is not DATA_ANALYTICS SKIP_ELIGIBLE', () => {
    const { p2, skip } = skipC2(SE_DA_CASE_A_SOFTWARE_SQL, 'A');
    const daSkip = p2.resolvedFieldCode === 'DATA_ANALYTICS' && skip.eligibility === 'SKIP_ELIGIBLE';
    expect(daSkip).toBe(false);
  });

  it('B — analytical practice can be DATA_ANALYTICS eligible', () => {
    const { p2, skip } = skipC2(SE_DA_CASE_B_ANALYTICS, 'B');
    expect(p2.decision).toBe('RESOLVED');
    expect(p2.resolvedFieldCode).toBe('DATA_ANALYTICS');
    expect(skip.eligibility).toBe('SKIP_ELIGIBLE');
  });

  it('C — mixed software + analytics is AMBIGUOUS', () => {
    const { p2, skip } = skipC2(SE_DA_CASE_C_MIXED, 'C');
    expect(p2.decision).toBe('AMBIGUOUS');
    expect(skip.eligibility).toBe('NOT_SKIP_ELIGIBLE');
  });

  it('D — tool only does not force a Field', () => {
    const { p2, skip } = skipC2(SE_DA_CASE_D_TOOL_ONLY, 'D');
    expect(p2.decision).not.toBe('RESOLVED');
    expect(skip.eligibility).toBe('NOT_SKIP_ELIGIBLE');
  });

  it('E — data engineering inside analytics identity is DA not software skip', () => {
    const { p2, skip } = skipC2(SE_DA_CASE_E_DATA_ENGINEERING, 'E');
    expect(p2.resolvedFieldCode).not.toBe('SOFTWARE_ENGINEERING');
    const seSkip =
      p2.resolvedFieldCode === 'SOFTWARE_ENGINEERING' && skip.eligibility === 'SKIP_ELIGIBLE';
    expect(seSkip).toBe(false);
    expect(p2.decision === 'RESOLVED' ? p2.resolvedFieldCode : 'AMBIGUOUS').not.toBe(
      'SOFTWARE_ENGINEERING',
    );
  });

  it('S9 structural: DA cannot be SKIP_ELIGIBLE', () => {
    const { p2, skip } = skipC2(S9_STRUCTURAL_FIXTURE, 'S9f');
    expect(!(p2.resolvedFieldCode === 'DATA_ANALYTICS' && skip.eligibility === 'SKIP_ELIGIBLE')).toBe(
      true,
    );
  });

  it('mutation: removing DA differential cannot leave DA SKIP_ELIGIBLE', () => {
    const withDiff = skipC2(s9WithDaDifferential(), 'mut-da');
    const without = skipC2(S9_STRUCTURAL_FIXTURE, 'mut-da-off');
    expect(
      without.p2.resolvedFieldCode === 'DATA_ANALYTICS' &&
        without.skip.eligibility === 'SKIP_ELIGIBLE',
    ).toBe(false);
    void withDiff;
  });

  it('mutation: removing SE differential stays coherent (no DA skip)', () => {
    const { p2, skip } = skipC2(s9WithoutSeDifferential(), 'mut-se');
    expect(
      p2.resolvedFieldCode === 'DATA_ANALYTICS' && skip.eligibility === 'SKIP_ELIGIBLE',
    ).toBe(false);
  });

  it('mutation: strong SE competitor → AMBIGUOUS without differential dominance', () => {
    const { p2, skip } = skipC2(s9WithStrongSeCompetitor(), 'mut-comp');
    expect(p2.decision).toBe('AMBIGUOUS');
    expect(skip.eligibility).toBe('NOT_SKIP_ELIGIBLE');
  });

  it('mutation: differential converted to tool-only → NOT_SKIP_ELIGIBLE', () => {
    const { skip } = skipC2(s9DifferentialAsToolOnly(), 'mut-tool');
    expect(skip.eligibility).toBe('NOT_SKIP_ELIGIBLE');
  });
});
