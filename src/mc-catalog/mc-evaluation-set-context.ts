/**
 * set_context_hash determinístico (MC1.2 / 1C.2).
 *
 * No incluye timestamps ni IDs generados por el run (set id, evaluation ids).
 * No es UNIQUE obligatorio: se permite repetir evaluación con el mismo contexto.
 */

import { createHash } from 'node:crypto';
import {
  MC_EVALUATION_SET_HASH_SCHEMA_VERSION,
  type McEvaluationSetCandidateDomain,
  type McEvaluationSetContextInput,
} from './mc-evaluation-set.types';

function sortCandidates(
  candidates: McEvaluationSetCandidateDomain[],
): McEvaluationSetCandidateDomain[] {
  return [...candidates].sort((a, b) =>
    a.domainCode.localeCompare(b.domainCode, 'en'),
  );
}

/**
 * Payload canónico del Evaluation Set (orden de claves estable).
 * Versión del esquema de hash: MC_EVALUATION_SET_HASH_SCHEMA_VERSION.
 */
export function buildMcEvaluationSetContextPayload(
  input: McEvaluationSetContextInput,
): Record<string, unknown> {
  const candidates = sortCandidates(input.candidateDomains).map((c) => ({
    algorithmVersion: c.algorithmVersion,
    configHash: c.configHash,
    domainCode: c.domainCode.toUpperCase(),
    engineRulesVersion: c.engineRulesVersion,
    mappingHash: c.mappingHash,
    mappingPackCode: c.mappingPackCode,
    mappingPackVersion: c.mappingPackVersion,
  }));

  return {
    candidateDomains: candidates,
    catalogVersionId: String(input.catalogVersionId),
    enrichmentId: String(input.enrichmentId),
    evidenceEvaluationId: String(input.evidenceEvaluationId),
    extractionId: String(input.extractionId),
    hashSchemaVersion: MC_EVALUATION_SET_HASH_SCHEMA_VERSION,
    personId: String(input.personId),
    qualificationPolicyVersion: input.qualificationPolicyVersion,
  };
}

export function computeMcEvaluationSetContextHash(
  input: McEvaluationSetContextInput,
): string {
  const payload = buildMcEvaluationSetContextPayload(input);
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}
