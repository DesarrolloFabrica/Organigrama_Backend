/**
 * Clasificación zero-Gemini. Pura. No llama Gemini. No arma flags.
 */
import type { ReuseDecision } from '../semantic-reuse/types';

export const ZERO_GEMINI_CLASSES = [
  'ZERO_GEMINI_CANDIDATE',
  'P2_ONLY_BUT_DOWNSTREAM_RECOMPUTE',
  'NOT_P2_ELIGIBLE',
  'INSUFFICIENT_ARTIFACTS',
  'SEMANTIC_REUSE_UNPROVEN',
] as const;

export type ZeroGeminiClass = (typeof ZERO_GEMINI_CLASSES)[number];

export type ZeroGeminiClassifyInput = {
  p1IdentityCompatible: boolean;
  catalogCompatible: boolean;
  semanticInputReconstructable: boolean;
  p3PackAvailable: boolean;
  p4PackAvailable: boolean;
  p2AuthorityEligible: boolean;
  p2Decision: string | null;
  p3Reuse: ReuseDecision | null;
  p4Reuse: ReuseDecision | null;
};

export function isSafeReuseStar(d: ReuseDecision | null | undefined): boolean {
  return d === 'SAFE_REUSE' || d === 'SAFE_REUSE_WITH_METADATA_CHANGE';
}

export function classifyZeroGeminiCase(input: ZeroGeminiClassifyInput): ZeroGeminiClass {
  const missingIdentity =
    !input.p1IdentityCompatible ||
    !input.catalogCompatible ||
    !input.semanticInputReconstructable;
  const missingPacks = !input.p3PackAvailable || !input.p4PackAvailable;

  if (!input.p2AuthorityEligible) {
    if (missingIdentity && !input.p2Decision) return 'INSUFFICIENT_ARTIFACTS';
    return 'NOT_P2_ELIGIBLE';
  }

  if (missingPacks || missingIdentity) return 'INSUFFICIENT_ARTIFACTS';

  if (input.p3Reuse === 'REUSE_UNPROVEN' || input.p3Reuse == null) return 'SEMANTIC_REUSE_UNPROVEN';
  if (input.p3Reuse === 'RECOMPUTE_REQUIRED') return 'P2_ONLY_BUT_DOWNSTREAM_RECOMPUTE';
  if (!isSafeReuseStar(input.p3Reuse)) return 'SEMANTIC_REUSE_UNPROVEN';

  if (input.p4Reuse === 'REUSE_UNPROVEN' || input.p4Reuse == null) return 'SEMANTIC_REUSE_UNPROVEN';
  if (input.p4Reuse === 'RECOMPUTE_REQUIRED') return 'P2_ONLY_BUT_DOWNSTREAM_RECOMPUTE';
  if (!isSafeReuseStar(input.p4Reuse)) return 'SEMANTIC_REUSE_UNPROVEN';

  return 'ZERO_GEMINI_CANDIDATE';
}

export type NamedClassTest = {
  id: string;
  expected: ZeroGeminiClass;
  observed: ZeroGeminiClass;
  pass: boolean;
};

const BASE_OK: ZeroGeminiClassifyInput = {
  p1IdentityCompatible: true,
  catalogCompatible: true,
  semanticInputReconstructable: true,
  p3PackAvailable: true,
  p4PackAvailable: true,
  p2AuthorityEligible: true,
  p2Decision: 'RESOLVED',
  p3Reuse: 'SAFE_REUSE',
  p4Reuse: 'SAFE_REUSE',
};

export function runZeroGeminiAdversarialClassificationTests(): NamedClassTest[] {
  const cases: Array<{ id: string; input: ZeroGeminiClassifyInput; expected: ZeroGeminiClass }> = [
    {
      id: 'p2_safe_p3_safe_p4_safe',
      input: BASE_OK,
      expected: 'ZERO_GEMINI_CANDIDATE',
    },
    {
      id: 'p2_safe_p3_recompute',
      input: { ...BASE_OK, p3Reuse: 'RECOMPUTE_REQUIRED', p4Reuse: null },
      expected: 'P2_ONLY_BUT_DOWNSTREAM_RECOMPUTE',
    },
    {
      id: 'p2_ambiguous_p3_safe_historical',
      input: {
        ...BASE_OK,
        p2AuthorityEligible: false,
        p2Decision: 'AMBIGUOUS',
        p3Reuse: 'SAFE_REUSE',
        p4Reuse: 'SAFE_REUSE',
      },
      expected: 'NOT_P2_ELIGIBLE',
    },
    {
      id: 'p2_safe_missing_p4',
      input: { ...BASE_OK, p4PackAvailable: false, p4Reuse: null },
      expected: 'INSUFFICIENT_ARTIFACTS',
    },
    {
      id: 'p2_safe_p3_unproven',
      input: { ...BASE_OK, p3Reuse: 'REUSE_UNPROVEN', p4Reuse: null },
      expected: 'SEMANTIC_REUSE_UNPROVEN',
    },
  ];
  return cases.map((c) => {
    const observed = classifyZeroGeminiCase(c.input);
    return { id: c.id, expected: c.expected, observed, pass: observed === c.expected };
  });
}
