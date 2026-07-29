/**
 * Contexto evaluativo inmutable + evaluation_context_hash.
 */

import { createHash } from 'node:crypto';

export type McEvaluationContextInput = {
  personId: string;
  domainCode: string;
  catalogVersion: string;
  catalogVersionId: string;
  sourceHash: string;
  mappingPackCode: string;
  mappingPackVersion: string;
  mappingHash: string;
  engineRulesVersion: string;
  algorithmVersion: string;
  configHash: string;
  extractionId: string;
  enrichmentId: string;
  evidenceEvaluationId: string;
};

export type McEvaluationContext = McEvaluationContextInput & {
  evaluationContextHash: string;
};

/** Payload canónico (orden de claves estable). */
export function buildMcEvaluationContextPayload(
  input: McEvaluationContextInput,
): Record<string, string> {
  return {
    algorithmVersion: input.algorithmVersion,
    catalogVersion: input.catalogVersion,
    catalogVersionId: input.catalogVersionId,
    configHash: input.configHash,
    domainCode: input.domainCode.toUpperCase(),
    engineRulesVersion: input.engineRulesVersion,
    enrichmentId: String(input.enrichmentId),
    evidenceEvaluationId: String(input.evidenceEvaluationId),
    extractionId: String(input.extractionId),
    mappingHash: input.mappingHash,
    mappingPackCode: input.mappingPackCode,
    mappingPackVersion: input.mappingPackVersion,
    personId: String(input.personId),
    sourceHash: input.sourceHash.toLowerCase(),
  };
}

export function computeMcEvaluationContextHash(
  input: McEvaluationContextInput,
): string {
  const payload = buildMcEvaluationContextPayload(input);
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

export function buildMcEvaluationContext(
  input: McEvaluationContextInput,
): McEvaluationContext {
  return {
    ...input,
    sourceHash: input.sourceHash.toLowerCase(),
    domainCode: input.domainCode.toUpperCase(),
    evaluationContextHash: computeMcEvaluationContextHash(input),
  };
}

export type McHistoricalContextStatus =
  | 'context_complete'
  | 'context_partially_reconstructible'
  | 'context_incomplete';

export type McHistoricalContextReport = {
  evaluationId: string;
  status: McHistoricalContextStatus;
  persisted: {
    mappingPackCode: string | null;
    mappingPackVersion: string | null;
    sourceHash: string | null;
    algorithmVersion: string | null;
    evaluationContextHash: string | null;
    engineRulesVersion: string;
    configHash: string;
    mappingHash: string;
    domainCode: string;
  };
  reconstructed?: Partial<McEvaluationContextInput>;
  missing: string[];
  notes: string[];
};
