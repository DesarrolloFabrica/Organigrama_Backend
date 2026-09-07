/**
 * Contratos SHADOW. Namespace MC1.SHADOW.RESOLVER.
 * No es resultado P2/P3 productivo. No importar desde runners.
 */
export const SHADOW_NAMESPACE = 'MC1.SHADOW.RESOLVER' as const;
export const SHADOW_EVENT_TYPE = 'MC1.SHADOW.RESOLVER.EVENT' as const;
export const SHADOW_STORE_KIND = 'mc1_shadow_resolver_event' as const;
export const SHADOW_CONTRACT_VERSION = '1.0.0' as const;

/** Timestamp fijo en simulación: el fingerprint NUNCA lo incluye. */
export const SIMULATION_CREATED_AT = '1970-01-01T00:00:00.000Z' as const;

export type ShadowDecisionStatus =
  | 'RESOLVED'
  | 'AMBIGUOUS'
  | 'INSUFFICIENT_EVIDENCE';

export type ShadowPhase = 'P2' | 'P3';

export type ShadowComparisonClass =
  | 'EXACT_MATCH'
  | 'COMPATIBLE_MATCH'
  | 'SHADOW_ABSTAINED'
  | 'PRODUCTION_ABSTAINED'
  | 'SHADOW_FALSE_POSITIVE_CANDIDATE'
  | 'SHADOW_FALSE_NEGATIVE_CANDIDATE'
  | 'LEGITIMATE_AMBIGUITY'
  | 'CATALOG_GAP';

export type ShadowDecision = {
  namespace: typeof SHADOW_NAMESPACE;
  eventType: typeof SHADOW_EVENT_TYPE;
  notAProductionResult: true;
  phase: ShadowPhase;
  personId: number;
  personLabel: string;
  snapshotId: string;
  resolverVersion: string;
  policyVersion: string;
  catalogVersion: string;
  decision: ShadowDecisionStatus;
  candidateCode: string | null;
  supportingEvidenceIds: string[];
  independentSourceCount: number;
  reasonCodes: string[];
  competitors: string[];
  inputFingerprint: string;
  createdAt: string;
  reused: boolean;
  wouldSkipGemini: boolean;
  differentialSignalsMatched: string[];
};

export type ShadowP3Decision = ShadowDecision & {
  fieldCode: string;
  specialtyCode: string;
  observedEquivalent: boolean;
};

export type ProductionP2Snapshot = {
  rank1: string | null;
  active: string[];
  source: 'CANONICAL_PACK_SUMMARY';
};

export type ProductionP3Snapshot = {
  fieldCode: string;
  specialtyCode: string;
  status: 'OBSERVED' | 'WEAK' | 'NOT_EMITTED';
  source: 'CANONICAL_PACK_SUMMARY';
};

export type ShadowComparison = {
  namespace: typeof SHADOW_NAMESPACE;
  notAProductionResult: true;
  phase: ShadowPhase;
  personId: number;
  snapshotId: string;
  shadowDecision: ShadowDecisionStatus;
  productionDecision: string;
  comparisonClass: ShadowComparisonClass;
  candidateCode: string | null;
  needsHumanReview: boolean;
  note: string | null;
};

export type CatalogGapRecord = {
  personLabel: string;
  field: string | null;
  specialty: string | null;
  missingAlias: boolean;
  missingDifferentialSignal: boolean;
  missingExclusion: boolean;
  missingEvidenceRequirement: boolean;
  reasonCodes: string[];
};

export type FutureSkipGate = {
  phase: ShadowPhase;
  skipGeminiEnabled: false;
  conditions: string[];
};
