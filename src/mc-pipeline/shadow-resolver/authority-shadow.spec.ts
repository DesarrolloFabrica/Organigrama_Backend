import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { EXPERIMENTAL_RESOLVER_POLICY_V03 } from '../experimental/deterministic-resolver/experimental-policy-v03';
import { RESOLVER_CANDIDATE_2_VERSION } from '../experimental/deterministic-resolver/types';
import { buildCandidateSetV2 } from './candidate-set-v2';
import { CSET_V2_FIXTURES, mutateRemoveContextAction } from './candidate-set-v2-fixtures';
import { mutateAddStrongCompetitor } from './candidate-set-fixtures';
import { buildEvidenceIdMap } from './full-contract-evidence';
import { buildDeterministicFullContract } from './full-contract';
import { adaptFullContractToExperimentalR1 } from './experimental-r1-full-adapter';
import { evaluateP2SkipEligibility } from './skip-eligibility';
import { evaluateP2ContractSkipEligibilityV3 } from './skip-eligibility-v3';
import { evaluateFullContractEligibility } from './full-contract-eligibility';
import { evaluateP2AuthorityEligibility } from './authority-eligibility';
import {
  experimentalP3InputFingerprint,
  p3ContextFromAuthorityShadow,
  p3ContextFromHistoricalR1,
  productionP3FieldsFingerprint,
} from './p3-shadow-context';
import {
  isolateDeterministicAuthorityFailure,
  releaseP3ContextOrIsolate,
} from './authority-failure';
import { isDeterministicSkipGeminiEnabled } from './flags';
import type { R1ContractEnvelope } from '../r1/r1.types';

const POLICY = EXPERIMENTAL_RESOLVER_POLICY_V03;

function pack(units: typeof CSET_V2_FIXTURES.primaryPlusLegitimateContext, id: string) {
  const p2 = resolveFieldsHardened({
    snapshotId: id,
    units,
    policy: POLICY,
    resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
  });
  const set = buildCandidateSetV2({ p2, units, policy: POLICY });
  const evidenceMap = buildEvidenceIdMap({ units, artifactIdentity: `pack:auth-${id}` });
  const contract = buildDeterministicFullContract({ set, units, evidenceMap });
  const r1 = adaptFullContractToExperimentalR1(set);
  const p3 = p3ContextFromAuthorityShadow({ r1, contract });
  const primarySkip = evaluateP2SkipEligibility(p2, units, { candidate: 'C2', policy: POLICY });
  const v3 = evaluateP2ContractSkipEligibilityV3({ primarySkip, set });
  const full = evaluateFullContractEligibility({ primarySkip, contractV3: v3, contract, r1 });
  return { set, contract, r1, p3, full };
}

describe('MC1 P2 deterministic authority shadow', () => {
  it('skipGemini stays false', () => {
    expect(isDeterministicSkipGeminiEnabled()).toBe(false);
  });

  it('legitimate thin context → VD CONTEXT in P3, not R1 secondary', () => {
    const { r1, p3, contract } = pack(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'A');
    expect(contract.primary?.fieldCode).toBe('SOFTWARE_ENGINEERING');
    expect(p3).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldCode: 'SOFTWARE_ENGINEERING', role: 'PRIMARY', source: 'R1' }),
        expect.objectContaining({ fieldCode: 'VISUAL_DESIGN', role: 'CONTEXT', source: 'P2_CONTEXT' }),
      ]),
    );
    expect(r1.secondaries).not.toContain('VISUAL_DESIGN');
    expect(r1.contextInflatedR1).toBe(false);
  });

  it('tool-only and knowledge-only → no CONTEXT', () => {
    expect(pack(CSET_V2_FIXTURES.primaryPlusToolOnly, 'B').p3.every((f) => f.role !== 'CONTEXT')).toBe(
      true,
    );
    expect(
      pack(CSET_V2_FIXTURES.primaryPlusKnowledgeOnly, 'C').p3.every((f) => f.role !== 'CONTEXT'),
    ).toBe(true);
  });

  it('strong rival → COMPETITOR, not CONTEXT, fallback required', () => {
    const { contract, full, p3 } = pack(CSET_V2_FIXTURES.strongCompetitorPair, 'E');
    expect(contract.competitors.length).toBeGreaterThanOrEqual(2);
    expect(contract.contextFields).toHaveLength(0);
    expect(p3).toEqual([]);
    expect(full.fullContractSkipEligible).toBe(false);
    const auth = evaluateP2AuthorityEligibility({
      resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
      policyVersion: '0.3.0',
      full,
      contract,
      r1: pack(CSET_V2_FIXTURES.strongCompetitorPair, 'E').r1,
      p3Class: 'CONFLICTING',
    });
    expect(auth.state).toBe('FALLBACK_REQUIRED');
    expect(auth.wouldActivateAuthority).toBe(false);
  });

  it('strong secondary stays SECONDARY, not CONTEXT', () => {
    const { r1, p3 } = pack(CSET_V2_FIXTURES.primaryPlusSecondaryIt, 'D');
    expect(r1.secondaries).toContain('IT_SYSTEMS');
    expect(p3.find((f) => f.fieldCode === 'IT_SYSTEMS')?.role).toBe('SECONDARY');
    expect(p3.find((f) => f.fieldCode === 'IT_SYSTEMS')?.source).toBe('R1');
  });

  it('COMM + AV ACTION → AV CONTEXT not R1 secondary', () => {
    const { r1, p3 } = pack(CSET_V2_FIXTURES.commPlusAvContext, 'F');
    expect(r1.primary).toBe('COMMUNICATIONS');
    expect(r1.secondaries).not.toContain('AUDIOVISUAL_PRODUCTION');
    expect(p3.find((f) => f.fieldCode === 'AUDIOVISUAL_PRODUCTION')?.role).toBe('CONTEXT');
  });

  it('removing context ACTION shrinks P3 field context', () => {
    const before = pack(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'M0');
    const mutated = mutateRemoveContextAction(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'vd1');
    const after = pack(mutated, 'M1');
    expect(before.p3.some((f) => f.fieldCode === 'VISUAL_DESIGN' && f.role === 'CONTEXT')).toBe(true);
    expect(after.p3.some((f) => f.fieldCode === 'VISUAL_DESIGN')).toBe(false);
  });

  it('historical packs without role remain valid', () => {
    const hist = p3ContextFromHistoricalR1({
      payload: {
        fieldResolutionStatus: 'RESOLVED',
        primaryField: { fieldCode: 'SOFTWARE_ENGINEERING', confidence: 0.9 },
        secondaryFields: [],
      },
    } as unknown as R1ContractEnvelope);
    expect(hist[0]?.role).toBe('PRIMARY');
    const unset: { fieldCode: string; role?: 'PRIMARY' } = { fieldCode: 'SOFTWARE_ENGINEERING' };
    expect(unset.role).toBeUndefined();
  });

  it('P3 fingerprint includes fieldRole in the experimental design', () => {
    const fields = pack(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'A').p3;
    const codes = fields.map((f) => f.fieldCode);
    const asSecondary = fields.map((f) =>
      f.fieldCode === 'VISUAL_DESIGN' ? { ...f, role: 'SECONDARY' as const } : f,
    );
    expect(productionP3FieldsFingerprint(codes)).toBe(
      productionP3FieldsFingerprint(asSecondary.map((f) => f.fieldCode)),
    );
    expect(experimentalP3InputFingerprint(fields)).not.toBe(
      experimentalP3InputFingerprint(asSecondary),
    );
  });

  it('invalid contract never releases partial P3 context', () => {
    const { p3 } = pack(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'A');
    const isolated = releaseP3ContextOrIsolate({ contractValid: false, p3 });
    expect(isolated.ok).toBe(false);
    if (!isolated.ok) {
      expect(isolated.isolation.p3Context).toEqual([]);
      expect(isolated.isolation.partialContractReleased).toBe(false);
      expect(isolated.isolation.state).toBe('FALLBACK_REQUIRED');
    }
    const fail = isolateDeterministicAuthorityFailure(new Error('resolver'));
    expect(fail.contract).toBeNull();
    expect(fail.r1).toBeNull();
  });

  it('adding a strong competitor is not CONTEXT', () => {
    const mutated = mutateAddStrongCompetitor(CSET_V2_FIXTURES.primaryPlusLegitimateContext);
    const { contract } = pack(mutated, 'M3');
    expect(contract.decision).toBe('AMBIGUOUS');
    expect(contract.contextFields).toHaveLength(0);
  });
});
