/**
 * Candidate-set policy 0.1.0 — congelada ANTES de evaluar la cohorte.
 * No usa outputs Gemini. No modifica Candidate.2 (0.3.0).
 */
export const CANDIDATE_SET_POLICY_CODE = 'MC1.EXPERIMENTAL.P2_CANDIDATE_SET' as const;
export const CANDIDATE_SET_POLICY_VERSION = '0.1.0' as const;

export type CandidateSetRole =
  | 'PRIMARY_CANDIDATE'
  | 'SECONDARY_CANDIDATE'
  | 'COMPETITOR';

export type FieldStrength = 'STRONG' | 'SUPPORTED' | 'THIN' | 'NONE';

export const CANDIDATE_SET_POLICY = {
  policyCode: CANDIDATE_SET_POLICY_CODE,
  policyVersion: CANDIDATE_SET_POLICY_VERSION,
  resolverVersionRequired: '0.3.0',
  policyVersionRequired: '0.3.0',
  productionCatalogUntouched: true,
  copiesGeminiSecondaries: false,
  minIndependentPrimary: 2,
  minIndependentAuthoritativeSecondary: 2,
  thinIndependent: 1,
  rules: [
    'PRIMARY = Candidate.2 resolved Field with independent >= 2',
    'AMBIGUOUS Candidate.2 → COMPETITOR for each viable ambiguous Field; no PRIMARY; no authoritative SECONDARY',
    'SECONDARY requires origin practice (catalog/alias), independent >= 2, not tool-only, not knowledge-only',
    'SHARED_PRACTICE alone never creates SECONDARY',
    'If overlay pair with PRIMARY exists, SECONDARY needs >= 1 differential signal on that pair',
    'If no overlay pair, SECONDARY still needs origin practice independent >= 2 (not shared-only with PRIMARY)',
    'independent == 1 with origin practice → THIN (diagnostic, not authoritative)',
    'THIN with differential on a known boundary vs PRIMARY → candidate-set UNCERTAIN (blocks contract skip)',
    'COMPETITOR = viable Field in Candidate.2 AMBIGUOUS set (independent >= 2)',
    'IRRELEVANT = no origin practice or tool-only or reinforce-only',
    'C2 matchScore = independent; a second viable Field without 2x margin makes C2 AMBIGUOUS. Authoritative SECONDARY therefore only appears when Candidate.2 still RESOLVES (primary independent typically >= 2x secondary). Overlay-pair otherStrong remains AMBIGUOUS/COMPETITOR.',
  ],
  ordering: [
    'PRIMARY_CANDIDATE',
    'SECONDARY_CANDIDATE STRONG',
    'SECONDARY_CANDIDATE SUPPORTED',
    'COMPETITOR',
    'within group: independentSourceCount desc, fieldCode asc',
  ],
} as const;
