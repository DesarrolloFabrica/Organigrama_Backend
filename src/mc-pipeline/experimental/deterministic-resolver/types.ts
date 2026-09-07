/**
 * Tipos del prototipo experimental de resolver determinístico P2/P3.
 * No es contrato productivo. No se importa desde runners P2/P3.
 */

export const RESOLVER_CODE = 'MC1.EXPERIMENTAL.DETERMINISTIC_RESOLVER' as const;
export const RESOLVER_VERSION = '0.1.0' as const;
export const RESOLVER_HARDENING_VERSION = '0.2.0' as const;
export const RESOLVER_CANDIDATE_2_VERSION = '0.3.0' as const;

export type ResolverDecision =
  | 'RESOLVED'
  | 'AMBIGUOUS'
  | 'INSUFFICIENT_EVIDENCE';

export type ResolverStrength = 'NONE' | 'THIN' | 'MODERATE' | 'STRONG';

export type EvidenceRole = 'ORIGIN' | 'REINFORCE' | 'EXCLUDED' | 'NONE';

export type PracticeKind =
  | 'ACTION'
  | 'RESPONSIBILITY'
  | 'PROJECT'
  | 'DELIVERABLE'
  | 'RESULT'
  | 'TOOL_USAGE'
  | 'METHODOLOGY'
  | 'CERTIFICATION'
  | 'KNOWLEDGE_STATEMENT'
  | 'LANGUAGE'
  | 'EDUCATION_SIGNAL'
  | 'OTHER_PROFESSIONAL_EVIDENCE'
  | string;

export type ResolverEvidenceUnit = {
  evidenceId: string;
  candidateId: string;
  evidenceKind: PracticeKind;
  explicitness: string;
  decision: string;
  normalizedActivity: string | null;
  object: string | null;
  toolOrMethod: string | null;
  result: string | null;
  scope: string | null;
  temporalContext: string | null;
  pageNumber?: number | null;
  startOffset?: number | null;
  endOffset?: number | null;
};

export type SignalMatch = {
  evidenceId: string;
  candidateId: string;
  role: EvidenceRole;
  positiveSignalsMatched: string[];
  exclusionsTriggered: string[];
  matchedPractices: string[];
};

export type FieldCandidate = {
  fieldCode: string;
  supportingEvidenceIds: string[];
  originEvidenceIds: string[];
  reinforceEvidenceIds: string[];
  matchScore: number;
  resolverStrength: ResolverStrength;
  reasonCodes: string[];
  positiveSignalsMatched: string[];
  exclusionsTriggered: string[];
  independentSourceCount?: number;
  differentialSignalsMatched?: string[];
  competitorFieldCodes?: string[];
};

export type FieldResolverResult = {
  resolverCode: typeof RESOLVER_CODE;
  resolverVersion: string;
  snapshotId: string;
  decision: ResolverDecision;
  resolvedFieldCode: string | null;
  candidateFields: FieldCandidate[];
  ambiguousFieldCodes: string[];
  reasonCodes: string[];
};

export type SpecialtyResolverItem = {
  fieldCode: string;
  specialtyCode: string;
  decision: ResolverDecision;
  observedEquivalent: boolean;
  supportingEvidenceIds: string[];
  originEvidenceIds: string[];
  reinforceEvidenceIds: string[];
  matchScore: number;
  resolverStrength: ResolverStrength;
  matchedPractices: string[];
  positiveSignalsMatched: string[];
  exclusionsTriggered: string[];
  reasonCodes: string[];
  independentSourceCount?: number;
};

export type SpecialtyResolverResult = {
  resolverCode: typeof RESOLVER_CODE;
  resolverVersion: string;
  snapshotId: string;
  inputFieldCodes: string[];
  items: SpecialtyResolverItem[];
};

export type ComparisonClass =
  | 'EXACT_MATCH'
  | 'COMPATIBLE_MATCH'
  | 'RESOLVER_AMBIGUOUS'
  | 'FALSE_POSITIVE'
  | 'FALSE_NEGATIVE'
  | 'CONFLICT';

export type DiscrepancyClass =
  | 'RESOLVER_ERROR'
  | 'HISTORICAL_AI_ERROR'
  | 'LEGITIMATE_AMBIGUITY'
  | 'CATALOG_GAP'
  | 'INSUFFICIENT_INFORMATION';
