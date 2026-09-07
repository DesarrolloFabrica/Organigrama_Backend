import { isP2DeterministicAuthorityEnabled, isP2DeterministicSkipGeminiEnabled } from './flags';
import { runAdversarialReuseTests, runMutationTests } from './semantic-reuse-adversarial';
import {
  FIELD_ROLE_SEMANTIC_POLICY,
  PRODUCER_IDENTITY_POLICY,
  classifyFingerprintDelta,
  decideReuseSafety,
} from './semantic-reuse-design';

describe('MC1 downstream semantic reuse audit (offline)', () => {
  it('keeps cost freeze flags off', () => {
    expect(isP2DeterministicSkipGeminiEnabled()).toBe(false);
    expect(isP2DeterministicAuthorityEnabled()).toBe(false);
  });

  it('adversarial fixtures pass', () => {
    const rows = runAdversarialReuseTests();
    expect(rows.every((r) => r.pass)).toBe(true);
  });

  it('mutation fixtures pass', () => {
    const rows = runMutationTests();
    expect(rows.every((r) => r.pass)).toBe(true);
  });

  it('classifies fingerprint deltas', () => {
    expect(classifyFingerprintDelta({ currentChanged: true, semanticChanged: true })).toBe(
      'CORRECT_INVALIDATION',
    );
    expect(classifyFingerprintDelta({ currentChanged: true, semanticChanged: false })).toBe(
      'OVERINVALIDATION',
    );
    expect(classifyFingerprintDelta({ currentChanged: false, semanticChanged: true })).toBe(
      'UNDERINVALIDATION_RISK',
    );
    expect(classifyFingerprintDelta({ currentChanged: false, semanticChanged: false })).toBe(
      'EQUIVALENT',
    );
  });

  it('does not force reuse when role or status changed', () => {
    expect(
      decideReuseSafety({
        fieldSetChanged: false,
        evidenceChanged: false,
        roleChanged: true,
        statusChanged: false,
      }),
    ).toBe('REUSE_UNPROVEN');
    expect(
      decideReuseSafety({
        fieldSetChanged: true,
        evidenceChanged: false,
        roleChanged: false,
        statusChanged: false,
      }),
    ).toBe('RECOMPUTE_REQUIRED');
  });

  it('documents producer and role policies', () => {
    expect(PRODUCER_IDENTITY_POLICY.p3.invalidatesIfProducerChangesAndSemanticSame).toBe(false);
    expect(PRODUCER_IDENTITY_POLICY.p4.invalidatesIfProducerChangesAndSemanticSame).toBe(false);
    expect(PRODUCER_IDENTITY_POLICY.profile.invalidatesIfProducerChangesAndSemanticSame).toBe(
      false,
    );
    expect(FIELD_ROLE_SEMANTIC_POLICY.inCurrentP3Prompt).toBe(false);
    expect(FIELD_ROLE_SEMANTIC_POLICY.shouldBeInFutureSemanticIdentity).toBe(true);
  });
});
