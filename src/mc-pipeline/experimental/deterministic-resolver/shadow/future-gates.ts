import type { FutureSkipGate, ShadowDecision, ShadowP3Decision } from './shadow-types';

/**
 * Gates FUTUROS. skipGeminiEnabled = false en esta fase.
 * Shadow nunca salta Gemini.
 */
export const FUTURE_P2_SKIP_GATE: FutureSkipGate = {
  phase: 'P2',
  skipGeminiEnabled: false,
  conditions: [
    'decision = RESOLVED',
    'precision cohort validated = 1.00',
    'no critical competitor (independentSourceCount < min on rival)',
    'sufficient independent sources',
    'differential signal when boundary exists',
    'no catalog gap',
  ],
};

export const FUTURE_P3_SKIP_GATE: FutureSkipGate = {
  phase: 'P3',
  skipGeminiEnabled: false,
  conditions: [
    'practice support (ACTION/DELIVERABLE origin)',
    'outcome support where relevant (e.g. DATA_GOVERNANCE)',
    'independent sources >= min',
    'no exclusion conflict',
    'no strong competitor / parent field uniquely resolved',
    'P2 shadow also RESOLVED',
  ],
};

export function futureP2WouldQualify(d: ShadowDecision): boolean {
  return (
    d.decision === 'RESOLVED' &&
    d.independentSourceCount >= 2 &&
    !d.reasonCodes.includes('CATALOG_GAP') &&
    !d.reasonCodes.includes('COMPETING_FIELDS') &&
    !d.reasonCodes.includes('INSUFFICIENT_DIFFERENTIAL_SIGNAL')
  );
}

export function futureP3WouldQualify(d: ShadowP3Decision): boolean {
  return (
    d.decision === 'RESOLVED' &&
    d.observedEquivalent === true &&
    d.independentSourceCount >= 2 &&
    !d.reasonCodes.includes('CATALOG_GAP') &&
    !d.reasonCodes.includes('FIELD_NOT_UNIQUELY_RESOLVED')
  );
}

export const SHADOW_FALLBACK_SEMANTICS = {
  ifResolved: 'potentially skip Gemini (NOT ACTIVE)',
  else: 'Gemini fallback (NOT ACTIVE)',
  shadowMode: 'no skipping',
} as const;
