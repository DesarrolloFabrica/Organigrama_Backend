/**
 * Fingerprint y comparación semántica P3 (experimental).
 *
 * PRODUCTION: field identity = fieldCode set ordenado (prompt no recibe fieldRole).
 * ROLE_AWARE: fieldCode + fieldRole. No mezclar contratos en un mismo fingerprint.
 */
import { canonicalEvidenceIdentity } from '../experimental/deterministic-resolver/shadow/fingerprint';
import type { ResolverEvidenceUnit } from '../experimental/deterministic-resolver/types';
import { geminiJsonCallConfigFingerprint } from '../gemini/gemini-json-call-config';
import {
  P3_GENERATION_POLICY_VERSION,
  P3_PROMPT_VERSION,
  P3_REASONING_POLICY_VERSION,
} from '../p3/p3.types';
import { SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';
import { sha256Utf8, stableStringify } from './hash';
import {
  mapCompareToReuse,
  metadataOnlyChanged,
  type P3FieldContract,
  type P3FieldContext,
  type P3SemanticInput,
  type SemanticCompareResult,
  type SemanticLineage,
  type SemanticReuseRecord,
} from './types';

export function evidenceIdentityFromUnits(units: ResolverEvidenceUnit[]): string {
  return sha256Utf8(stableStringify(canonicalEvidenceIdentity(units)));
}

export function normalizeP3FieldContext(
  fields: P3FieldContext[],
  contract: P3FieldContract,
): P3FieldContext[] {
  const byCode = new Map<string, P3FieldContext>();
  for (const f of fields) {
    if (!f.fieldCode) continue;
    const prev = byCode.get(f.fieldCode);
    if (!prev) byCode.set(f.fieldCode, { fieldCode: f.fieldCode, fieldRole: f.fieldRole });
  }
  const rows = [...byCode.values()].sort((a, b) => a.fieldCode.localeCompare(b.fieldCode));
  if (contract === 'PRODUCTION') {
    return rows.map((f) => ({ fieldCode: f.fieldCode }));
  }
  return rows.map((f) => ({ fieldCode: f.fieldCode, fieldRole: f.fieldRole ?? 'UNSET' }));
}

export function defaultP3SemanticInput(
  partial: Pick<P3SemanticInput, 'evidenceIdentity' | 'fieldContext' | 'r1FieldResolutionStatus'> &
    Partial<P3SemanticInput>,
): P3SemanticInput {
  return {
    contract: partial.contract ?? 'PRODUCTION',
    evidenceIdentity: partial.evidenceIdentity,
    fieldContext: normalizeP3FieldContext(
      partial.fieldContext,
      partial.contract ?? 'PRODUCTION',
    ),
    r1FieldResolutionStatus: partial.r1FieldResolutionStatus,
    specialtyCatalogFingerprint: partial.specialtyCatalogFingerprint ?? SPECIALTY_CATALOG_VERSION,
    promptVersion: partial.promptVersion ?? P3_PROMPT_VERSION,
    modelVersion: partial.modelVersion ?? 'pinned',
    reasoningPolicyVersion: partial.reasoningPolicyVersion ?? P3_REASONING_POLICY_VERSION,
    generationPolicyVersion: partial.generationPolicyVersion ?? P3_GENERATION_POLICY_VERSION,
    modelConfigFingerprint: partial.modelConfigFingerprint ?? geminiJsonCallConfigFingerprint(),
  };
}

export function buildP3SemanticFingerprint(input: P3SemanticInput): string {
  const contract = input.contract;
  const fields = normalizeP3FieldContext(input.fieldContext, contract);
  return sha256Utf8(
    stableStringify({
      contract,
      evidenceIdentity: input.evidenceIdentity,
      fieldContext: fields,
      r1FieldResolutionStatus: input.r1FieldResolutionStatus,
      specialtyCatalogFingerprint: input.specialtyCatalogFingerprint,
      promptVersion: input.promptVersion,
      modelVersion: input.modelVersion,
      reasoningPolicyVersion: input.reasoningPolicyVersion,
      generationPolicyVersion: input.generationPolicyVersion,
      modelConfigFingerprint: input.modelConfigFingerprint,
    }),
  );
}

export function compareP3SemanticInputs(
  oldInput: P3SemanticInput | null,
  candidate: P3SemanticInput | null,
  lineage?: SemanticLineage,
): SemanticCompareResult {
  if (!oldInput || !candidate) return 'UNPROVEN';
  if (oldInput.contract !== candidate.contract) return 'UNPROVEN';
  const oldFp = buildP3SemanticFingerprint(oldInput);
  const newFp = buildP3SemanticFingerprint(candidate);
  if (oldFp !== newFp) return 'SEMANTIC_CHANGE';
  if (lineage && metadataOnlyChanged(lineage)) return 'METADATA_ONLY_CHANGE';
  return 'IDENTICAL';
}

export function decideP3Reuse(
  oldInput: P3SemanticInput | null,
  candidate: P3SemanticInput | null,
  lineage: SemanticLineage,
): SemanticReuseRecord {
  const compare = compareP3SemanticInputs(oldInput, candidate, lineage);
  const reuseDecision = mapCompareToReuse(compare);
  const oldFp = oldInput ? buildP3SemanticFingerprint(oldInput) : '';
  const newFp = candidate ? buildP3SemanticFingerprint(candidate) : '';
  const safe =
    reuseDecision === 'SAFE_REUSE' || reuseDecision === 'SAFE_REUSE_WITH_METADATA_CHANGE';
  return {
    reuseDecision,
    compare,
    semanticFingerprint: newFp,
    oldSemanticFingerprint: oldFp,
    lineage,
    usageRelation: safe ? 'REUSED_UNDER_SEMANTIC_EQUIVALENCE' : null,
  };
}
