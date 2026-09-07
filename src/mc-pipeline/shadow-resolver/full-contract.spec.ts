import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { EXPERIMENTAL_RESOLVER_POLICY_V03 } from '../experimental/deterministic-resolver/experimental-policy-v03';
import { RESOLVER_CANDIDATE_2_VERSION } from '../experimental/deterministic-resolver/types';
import { buildCandidateSetV2 } from './candidate-set-v2';
import { CSET_V2_FIXTURES } from './candidate-set-v2-fixtures';
import { mutateAddStrongCompetitor } from './candidate-set-fixtures';
import { buildEvidenceIdMap } from './full-contract-evidence';
import { buildDeterministicFullContract } from './full-contract';
import { adaptFullContractToExperimentalR1 } from './experimental-r1-full-adapter';
import { evaluateP2SkipEligibility } from './skip-eligibility';
import { evaluateP2ContractSkipEligibilityV3 } from './skip-eligibility-v3';
import { evaluateFullContractEligibility } from './full-contract-eligibility';

const POLICY = EXPERIMENTAL_RESOLVER_POLICY_V03;

function pack(units: typeof CSET_V2_FIXTURES.primaryPlusLegitimateContext, id: string) {
  const p2 = resolveFieldsHardened({
    snapshotId: id,
    units,
    policy: POLICY,
    resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
  });
  const set = buildCandidateSetV2({ p2, units, policy: POLICY });
  const evidenceMap = buildEvidenceIdMap({ units, artifactIdentity: `pack:fixture-${id}` });
  const contract = buildDeterministicFullContract({ set, units, evidenceMap });
  const r1 = adaptFullContractToExperimentalR1(set);
  const primarySkip = evaluateP2SkipEligibility(p2, units, { candidate: 'C2', policy: POLICY });
  const v3 = evaluateP2ContractSkipEligibilityV3({ primarySkip, set });
  const elig = evaluateFullContractEligibility({ primarySkip, contractV3: v3, contract, r1 });
  return { set, contract, r1, elig };
}

describe('MC1 P2 deterministic full contract', () => {
  it('primary safe + context thin → contract válido, CONTEXT no entra a R1', () => {
    const { contract, r1 } = pack(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'A');
    expect(contract.valid).toBe(true);
    expect(contract.primary?.fieldCode).toBe('SOFTWARE_ENGINEERING');
    expect(contract.contextFields.some((c) => c.fieldCode === 'VISUAL_DESIGN')).toBe(true);
    expect(contract.p2CompatibleView.payload.domainCandidates.map((c) => c.domainCode)).toEqual([
      'SOFTWARE_ENGINEERING',
    ]);
    expect(r1.resolutionStatus).toBe('RESOLVED');
    expect(r1.contextInflatedR1).toBe(false);
    expect(r1.secondaries).not.toContain('VISUAL_DESIGN');
  });

  it('strong competitor → no full contract', () => {
    const { elig, contract } = pack(CSET_V2_FIXTURES.strongCompetitorPair, 'E');
    expect(contract.competitors.length).toBeGreaterThanOrEqual(2);
    expect(elig.fullContractSkipEligible).toBe(false);
    expect(elig.blockedBy).toEqual(expect.arrayContaining(['UNRESOLVED_COMPETITOR']));
  });

  it('tool-only other Field is not context', () => {
    const { contract } = pack(CSET_V2_FIXTURES.primaryPlusToolOnly, 'B');
    expect(contract.contextFields).toHaveLength(0);
  });

  it('knowledge-only other Field is not context', () => {
    const { contract } = pack(CSET_V2_FIXTURES.primaryPlusKnowledgeOnly, 'C');
    expect(contract.contextFields).toHaveLength(0);
  });

  it('duplicate evidence IDs are not inflated', () => {
    const { contract } = pack(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'A');
    const ids = contract.primary?.supportingEvidenceIds ?? [];
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('adding strong competitor removes full-contract eligibility', () => {
    const mutated = mutateAddStrongCompetitor(CSET_V2_FIXTURES.primaryPlusSecondaryIt);
    const { elig } = pack(mutated, 'M3');
    expect(elig.fullContractSkipEligible).toBe(false);
  });
});
