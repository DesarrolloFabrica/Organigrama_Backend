/**
 * Contratos Evaluation Set (MC1.2 / 1C.2).
 *
 * Evaluation Set agrupa Domain Evaluations comparables de un mismo run.
 * No determina dominio dominante ni Professional Classification.
 */

import type { McDomainQualification } from './mc-domain-qualification';

/** Schema del Evaluation Set persistido. */
export const MC_EVALUATION_SET_SCHEMA_VERSION = 'es-1.0.0' as const;
export type McEvaluationSetSchemaVersion =
  typeof MC_EVALUATION_SET_SCHEMA_VERSION;

/** Versión del esquema del payload de set_context_hash. */
export const MC_EVALUATION_SET_HASH_SCHEMA_VERSION = 'es-hash-1.0.0' as const;

/**
 * Política de calificación intra-dominio (classifyDomainConceptually).
 * Independiente de PA2 rules por dominio.
 */
export const MC_QUALIFICATION_POLICY_VERSION = 'DQ-1.0.0' as const;
export type McQualificationPolicyVersion =
  typeof MC_QUALIFICATION_POLICY_VERSION;

export const MC_EVALUATION_SET_STATUSES = [
  'RUNNING',
  'COMPLETE',
  'PARTIAL',
  'FAILED',
] as const;

export type McEvaluationSetStatus = (typeof MC_EVALUATION_SET_STATUSES)[number];

/**
 * Resultado operativo de la ejecución por dominio candidato.
 * Distinto de McDomainQualification (PRIMARY_MATCH / OUTSIDE / …).
 */
export const MC_EVALUATION_SET_DOMAIN_STATUSES = [
  'SUCCEEDED',
  'FAILED',
  'SKIPPED',
  'NOT_EVALUATED',
] as const;

export type McEvaluationSetDomainStatus =
  (typeof MC_EVALUATION_SET_DOMAIN_STATUSES)[number];

export interface McEvaluationSetCandidateDomain {
  domainCode: string;
  mappingPackCode: string;
  mappingPackVersion: string;
  mappingHash: string;
  engineRulesVersion: string;
  algorithmVersion: string;
  configHash: string;
}

export interface McEvaluationSetContextInput {
  personId: string;
  extractionId: string;
  enrichmentId: string;
  evidenceEvaluationId: string;
  catalogVersionId: string;
  qualificationPolicyVersion: McQualificationPolicyVersion | string;
  candidateDomains: McEvaluationSetCandidateDomain[];
}

export interface McEvaluationSetDomainPersistResult {
  domainCode: string;
  domainStatus: McEvaluationSetDomainStatus;
  profileEvaluationId: string | null;
  domainQualification: McDomainQualification | null;
  isActive: boolean;
  engineRulesVersion: string | null;
  mappingPackCode: string | null;
  mappingPackVersion: string | null;
}

/**
 * Resultado de persistMultidomainEvaluationRun (MC1.1B + 1C.2).
 * Incluye Evaluation Set; no implica resolución multidominio.
 */
export interface PersistMultidomainEvaluationRunResult {
  evaluationSetId: string;
  evaluationSetStatus: McEvaluationSetStatus;
  contextHash: string;
  schemaVersion: McEvaluationSetSchemaVersion;
  qualificationPolicyVersion: string;
  domainResults: McEvaluationSetDomainPersistResult[];
}
