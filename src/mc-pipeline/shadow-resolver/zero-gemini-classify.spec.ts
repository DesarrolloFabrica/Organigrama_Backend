import {
  classifyZeroGeminiCase,
  runZeroGeminiAdversarialClassificationTests,
} from './zero-gemini-classify';

describe('zero-Gemini candidate classification', () => {
  it('adversarial fixtures pass', () => {
    const rows = runZeroGeminiAdversarialClassificationTests();
    expect(rows.filter((r) => !r.pass).map((r) => r.id)).toEqual([]);
  });

  it('does not confuse P3 SAFE with P2 authority', () => {
    expect(
      classifyZeroGeminiCase({
        p1IdentityCompatible: true,
        catalogCompatible: true,
        semanticInputReconstructable: true,
        p3PackAvailable: true,
        p4PackAvailable: true,
        p2AuthorityEligible: false,
        p2Decision: 'RESOLVED',
        p3Reuse: 'SAFE_REUSE',
        p4Reuse: 'SAFE_REUSE',
      }),
    ).toBe('NOT_P2_ELIGIBLE');
  });
});
