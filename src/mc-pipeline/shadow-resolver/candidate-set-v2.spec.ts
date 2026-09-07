import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { EXPERIMENTAL_RESOLVER_POLICY_V03 } from '../experimental/deterministic-resolver/experimental-policy-v03';
import { RESOLVER_CANDIDATE_2_VERSION } from '../experimental/deterministic-resolver/types';
import { buildCandidateSetV2 } from './candidate-set-v2';
import {
  CSET_V2_FIXTURES,
  mutateContextActionToKnowledge,
  mutateRemoveContextAction,
} from './candidate-set-v2-fixtures';

function v2(units: typeof CSET_V2_FIXTURES.primaryPlusLegitimateContext, id: string) {
  const p2 = resolveFieldsHardened({
    snapshotId: id,
    units,
    policy: EXPERIMENTAL_RESOLVER_POLICY_V03,
    resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
  });
  return { p2, set: buildCandidateSetV2({ p2, units, policy: EXPERIMENTAL_RESOLVER_POLICY_V03 }) };
}

describe('MC1 P2 candidate set semantics v2', () => {
  it('strong primary + one legitimate context action → PRIMARY + CONTEXT', () => {
    const { set } = v2(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'A');
    expect(set.primary?.fieldCode).toBe('SOFTWARE_ENGINEERING');
    expect(set.contextFields.some((c) => c.fieldCode === 'VISUAL_DESIGN' && c.strength === 'THIN')).toBe(
      true,
    );
    expect(set.secondaries.some((s) => s.fieldCode === 'VISUAL_DESIGN')).toBe(false);
    expect(set.competitors).toHaveLength(0);
  });

  it('tool-only other Field is not context', () => {
    const { set } = v2(CSET_V2_FIXTURES.primaryPlusToolOnly, 'B');
    expect(set.contextFields).toHaveLength(0);
    expect(set.secondaries).toHaveLength(0);
  });

  it('knowledge-only other Field is not context', () => {
    const { set } = v2(CSET_V2_FIXTURES.primaryPlusKnowledgeOnly, 'C');
    expect(set.contextFields).toHaveLength(0);
    expect(set.secondaries).toHaveLength(0);
  });

  it('two independent strong other Field with margin → SECONDARY not CONTEXT', () => {
    const { set } = v2(CSET_V2_FIXTURES.primaryPlusSecondaryIt, 'D');
    expect(set.primary?.fieldCode).toBe('SOFTWARE_ENGINEERING');
    expect(set.secondaries.some((s) => s.fieldCode === 'IT_SYSTEMS')).toBe(true);
    expect(set.contextFields.some((c) => c.fieldCode === 'IT_SYSTEMS')).toBe(false);
  });

  it('strong competitor is never degraded to CONTEXT', () => {
    const { set } = v2(CSET_V2_FIXTURES.strongCompetitorPair, 'E');
    expect(set.decision).toBe('AMBIGUOUS');
    expect(set.contextFields).toHaveLength(0);
    expect(set.secondaries).toHaveLength(0);
    expect(set.competitors.map((c) => c.fieldCode).sort()).toEqual([
      'DATA_ANALYTICS',
      'SOFTWARE_ENGINEERING',
    ]);
  });

  it('COMM primary + thin AV action → CONTEXT not SECONDARY', () => {
    const { set } = v2(CSET_V2_FIXTURES.commPlusAvContext, 'F');
    expect(set.primary?.fieldCode).toBe('COMMUNICATIONS');
    expect(
      set.contextFields.some((c) => c.fieldCode === 'AUDIOVISUAL_PRODUCTION' && c.strength === 'THIN'),
    ).toBe(true);
    expect(set.secondaries.some((s) => s.fieldCode === 'AUDIOVISUAL_PRODUCTION')).toBe(false);
  });

  it('mutation: remove context ACTION → CONTEXT disappears', () => {
    const mutated = mutateRemoveContextAction(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'vd1');
    const { set } = v2(mutated, 'M1');
    expect(set.contextFields.some((c) => c.fieldCode === 'VISUAL_DESIGN')).toBe(false);
  });

  it('mutation: context ACTION → KNOWLEDGE → CONTEXT disappears', () => {
    const mutated = mutateContextActionToKnowledge(
      CSET_V2_FIXTURES.primaryPlusLegitimateContext,
      'vd1',
    );
    const { set } = v2(mutated, 'M2');
    expect(set.contextFields.some((c) => c.fieldCode === 'VISUAL_DESIGN')).toBe(false);
  });
});
