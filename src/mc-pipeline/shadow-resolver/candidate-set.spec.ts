import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { EXPERIMENTAL_RESOLVER_POLICY_V03 } from '../experimental/deterministic-resolver/experimental-policy-v03';
import { RESOLVER_CANDIDATE_2_VERSION } from '../experimental/deterministic-resolver/types';
import { buildCandidateSet } from './candidate-set';
import {
  CSET_FIXTURES,
  mutateAddStrongCompetitor,
  mutateRemoveSecondaryDifferential,
  mutateSecondaryActionToKnowledge,
} from './candidate-set-fixtures';

function c2(units: typeof CSET_FIXTURES.strongPrimaryLegitimateSecondary, id: string) {
  const p2 = resolveFieldsHardened({
    snapshotId: id,
    units,
    policy: EXPERIMENTAL_RESOLVER_POLICY_V03,
    resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
  });
  return { p2, set: buildCandidateSet({ p2, units, policy: EXPERIMENTAL_RESOLVER_POLICY_V03 }) };
}

describe('MC1 P2 deterministic candidate set', () => {
  it('strong primary + legitimate secondary', () => {
    const { set } = c2(CSET_FIXTURES.strongPrimaryLegitimateSecondary, 'A');
    expect(set.primaryCandidateCode).toBe('SOFTWARE_ENGINEERING');
    expect(set.candidates.some((c) => c.role === 'SECONDARY_CANDIDATE' && c.fieldCode === 'IT_SYSTEMS')).toBe(
      true,
    );
  });

  it('tool-only secondary signal is not a secondary', () => {
    const { set } = c2(CSET_FIXTURES.strongPrimaryToolOnlySecondary, 'B');
    expect(set.candidates.filter((c) => c.role === 'SECONDARY_CANDIDATE')).toHaveLength(0);
  });

  it('two strong competing Fields → AMBIGUOUS, no authoritative primary set', () => {
    const { set } = c2(CSET_FIXTURES.twoStrongCompeting, 'C');
    expect(set.decision).toBe('AMBIGUOUS');
    expect(set.primaryCandidateCode).toBeNull();
    expect(set.candidates.every((c) => c.role === 'COMPETITOR')).toBe(true);
  });

  it('shared practice only does not create secondary', () => {
    const { set } = c2(CSET_FIXTURES.sharedPracticeOnly, 'D');
    expect(set.candidates.filter((c) => c.role === 'SECONDARY_CANDIDATE')).toHaveLength(0);
  });

  it('one thin secondary source is THIN not authoritative', () => {
    const { set } = c2(CSET_FIXTURES.oneThinSecondary, 'E');
    expect(set.candidates.filter((c) => c.role === 'SECONDARY_CANDIDATE')).toHaveLength(0);
    expect(set.thin.some((t) => t.fieldCode === 'VISUAL_DESIGN' || t.fieldCode === 'IT_SYSTEMS')).toBe(
      true,
    );
  });

  it('multiple independent secondary practices → eligible secondary', () => {
    const { set } = c2(CSET_FIXTURES.multipleIndependentSecondary, 'F');
    expect(
      set.candidates.some((c) => c.role === 'SECONDARY_CANDIDATE' && c.fieldCode === 'IT_SYSTEMS'),
    ).toBe(true);
  });

  it('mutation: remove secondary differential → secondary removed or thin', () => {
    const mutated = mutateRemoveSecondaryDifferential(CSET_FIXTURES.strongPrimaryLegitimateSecondary);
    const { set } = c2(mutated, 'M1');
    expect(
      set.candidates.some((c) => c.role === 'SECONDARY_CANDIDATE' && c.fieldCode === 'IT_SYSTEMS'),
    ).toBe(false);
  });

  it('mutation: secondary ACTION → KNOWLEDGE → no authoritative secondary', () => {
    const mutated = mutateSecondaryActionToKnowledge(CSET_FIXTURES.strongPrimaryLegitimateSecondary);
    const { set } = c2(mutated, 'M2');
    expect(set.candidates.filter((c) => c.role === 'SECONDARY_CANDIDATE')).toHaveLength(0);
  });

  it('mutation: add strong competitor → ambiguity', () => {
    const mutated = mutateAddStrongCompetitor(CSET_FIXTURES.strongPrimaryLegitimateSecondary);
    const { set } = c2(mutated, 'M3');
    expect(set.decision).toBe('AMBIGUOUS');
  });
});
