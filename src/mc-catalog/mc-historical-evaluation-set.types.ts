/**
 * MC1.4 / 1C.3 — Clasificación de elegibilidad histórica para Evaluation Sets.
 *
 * Solo lectura / dry-run. No inserta sets. No inventa contexto faltante.
 * EXACT histórico sin run_id persistido: no existe; EXACT solo vía set moderno.
 */

export const MC_HISTORICAL_AUDIT_SCHEMA_VERSION = 'has-1.0.0' as const;

export const MC_HISTORICAL_ELIGIBILITY = [
  'EXACT',
  'STRONG',
  'AMBIGUOUS',
  'UNRECOVERABLE',
] as const;

export type McHistoricalEligibility =
  (typeof MC_HISTORICAL_ELIGIBILITY)[number];

export const MC_HISTORICAL_ACTIONS = [
  'AUTO_BACKFILL_ELIGIBLE',
  'REVIEW_REQUIRED',
  'REEVALUATE',
  'LEAVE_LEGACY',
  'ALREADY_IN_SET',
] as const;

export type McHistoricalRecommendedAction =
  (typeof MC_HISTORICAL_ACTIONS)[number];

export const MC_HISTORICAL_CONFLICT_CODES = [
  'MULTIPLE_DOMAIN_EVALUATIONS',
  'MIXED_EXTRACTION',
  'MIXED_ENRICHMENT',
  'MIXED_EVIDENCE_CONTEXT',
  'MIXED_CATALOG',
  'MIXED_SOURCE_HASH',
  'UNKNOWN_CANDIDATE_UNIVERSE',
  'OVERLAPPING_GROUPS',
  'MISSING_VERSION_CONTEXT',
  'MISSING_CHAIN_CONTEXT',
  'ISOLATED_EVALUATION',
  'TIMESTAMP_ONLY_SIGNAL',
  'CONSECUTIVE_ID_ONLY_SIGNAL',
  'ACTIVE_FLAG_USED_AS_KEY',
  'ALREADY_LINKED_TO_SET',
  'ALTERNATIVE_GROUPING_EXISTS',
] as const;

export type McHistoricalConflictCode =
  (typeof MC_HISTORICAL_CONFLICT_CODES)[number];

/** Valor tipado: no tratar desconocido como igualdad. */
export type McKnownValue<T> =
  | { kind: 'known'; value: T }
  | { kind: 'unknown' }
  | { kind: 'inferred'; value: T; source: string };

export interface McHistoricalProfileEvaluationRow {
  id: string;
  personId: string;
  personCvId: string | null;
  extractionId: string | null;
  enrichmentId: string | null;
  evidenceEvaluationId: string | null;
  catalogVersionId: string | null;
  domainCode: string;
  engineRulesVersion: string | null;
  mappingPackCode: string | null;
  mappingPackVersion: string | null;
  mappingHash: string | null;
  sourceHash: string | null;
  algorithmVersion: string | null;
  evaluationContextHash: string | null;
  domainQualification: string | null;
  isActive: boolean;
  status: string;
  createdAt: string; // ISO
  /** Si ya está en mc_evaluation_set_domain */
  evaluationSetId: string | null;
}

export interface McHistoricalGroupingEvidence {
  code: string;
  strength: 'FUERTE' | 'MEDIA' | 'DEBIL' | 'NO_UTILIZABLE';
  detail: string;
}

export interface McHistoricalGroupingConflict {
  code: McHistoricalConflictCode;
  detail: string;
}

export interface HistoricalEvaluationSetCandidate {
  personId: string;
  profileEvaluationIds: string[];
  domainCodes: string[];
  inferredContext: {
    extractionId: McKnownValue<string>;
    enrichmentId: McKnownValue<string>;
    evidenceEvaluationId: McKnownValue<string>;
    catalogVersionId: McKnownValue<string>;
    sourceHash: McKnownValue<string>;
    candidateUniverse: McKnownValue<string[]>;
    qualificationPolicyVersion: McKnownValue<string>;
  };
  eligibility: McHistoricalEligibility;
  evidence: McHistoricalGroupingEvidence[];
  conflicts: McHistoricalGroupingConflict[];
  missingFields: string[];
  recommendedAction: McHistoricalRecommendedAction;
  /** Fingerprint dry-run; distinto del set_context_hash moderno si hay unknown. */
  historicalContextFingerprint: string;
}

export interface McHistoricalAuditSummary {
  schemaVersion: typeof MC_HISTORICAL_AUDIT_SCHEMA_VERSION;
  totalEvaluations: number;
  alreadyInSet: number;
  withoutSet: number;
  candidatesExact: number;
  candidatesStrong: number;
  candidatesAmbiguous: number;
  candidatesUnrecoverable: number;
  personsTouched: number;
  note: string;
}
