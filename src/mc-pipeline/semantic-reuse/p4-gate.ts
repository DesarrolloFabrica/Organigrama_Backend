/**
 * Fingerprint y comparación semántica P4 (experimental).
 * Excluye p3ResultIdentity del criterio de invalidación; se conserva en lineage.
 */
import { geminiJsonCallConfigFingerprint } from '../gemini/gemini-json-call-config';
import {
  P4_GENERATION_POLICY_VERSION,
  P4_PROMPT_VERSION,
  P4_REASONING_POLICY_VERSION,
  P4_ROUTING_POLICY_VERSION,
} from '../p4/p4.types';
import { SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';
import { sha256Utf8, stableStringify } from './hash';
import {
  mapCompareToReuse,
  metadataOnlyChanged,
  type P4SemanticInput,
  type P4SpecialtySemantic,
  type ReuseDecision,
  type SemanticCompareResult,
  type SemanticLineage,
  type SemanticReuseRecord,
} from './types';

export function normalizeP4Specialties(rows: P4SpecialtySemantic[]): P4SpecialtySemantic[] {
  return [...rows]
    .map((s) => ({
      fieldCode: s.fieldCode,
      specialtyCode: s.specialtyCode,
      status: s.status,
      evaluationRole: s.evaluationRole,
      publishableFromP3: s.publishableFromP3,
      routingEligible: s.routingEligible !== false,
      p3Confidence: s.p3Confidence,
    }))
    .sort((a, b) =>
      `${a.fieldCode}:${a.specialtyCode}`.localeCompare(`${b.fieldCode}:${b.specialtyCode}`),
    );
}

export function defaultP4SemanticInput(
  partial: Pick<P4SemanticInput, 'evidenceIdentity' | 'specialties' | 'r1FieldResolutionStatus'> &
    Partial<P4SemanticInput>,
): P4SemanticInput {
  return {
    evidenceIdentity: partial.evidenceIdentity,
    specialties: normalizeP4Specialties(partial.specialties),
    r1FieldResolutionStatus: partial.r1FieldResolutionStatus,
    specialtyCatalogFingerprint: partial.specialtyCatalogFingerprint ?? SPECIALTY_CATALOG_VERSION,
    promptVersion: partial.promptVersion ?? P4_PROMPT_VERSION,
    routingPolicyVersion: partial.routingPolicyVersion ?? P4_ROUTING_POLICY_VERSION,
    reasoningPolicyVersion: partial.reasoningPolicyVersion ?? P4_REASONING_POLICY_VERSION,
    generationPolicyVersion: partial.generationPolicyVersion ?? P4_GENERATION_POLICY_VERSION,
    modelVersion: partial.modelVersion ?? 'pinned',
    modelConfigFingerprint: partial.modelConfigFingerprint ?? geminiJsonCallConfigFingerprint(),
  };
}

export function buildP4SemanticFingerprint(input: P4SemanticInput): string {
  return sha256Utf8(
    stableStringify({
      evidenceIdentity: input.evidenceIdentity,
      specialties: normalizeP4Specialties(input.specialties),
      r1FieldResolutionStatus: input.r1FieldResolutionStatus,
      specialtyCatalogFingerprint: input.specialtyCatalogFingerprint,
      promptVersion: input.promptVersion,
      routingPolicyVersion: input.routingPolicyVersion,
      reasoningPolicyVersion: input.reasoningPolicyVersion,
      generationPolicyVersion: input.generationPolicyVersion,
      modelVersion: input.modelVersion,
      modelConfigFingerprint: input.modelConfigFingerprint,
    }),
  );
}

export function compareP4SemanticInputs(
  oldInput: P4SemanticInput | null,
  candidate: P4SemanticInput | null,
  lineage?: SemanticLineage,
): SemanticCompareResult {
  if (!oldInput || !candidate) return 'UNPROVEN';
  const oldFp = buildP4SemanticFingerprint(oldInput);
  const newFp = buildP4SemanticFingerprint(candidate);
  if (oldFp !== newFp) return 'SEMANTIC_CHANGE';
  if (lineage && metadataOnlyChanged(lineage)) return 'METADATA_ONLY_CHANGE';
  return 'IDENTICAL';
}

export function decideP4Reuse(args: {
  p3Decision: ReuseDecision;
  oldInput: P4SemanticInput | null;
  candidate: P4SemanticInput | null;
  lineage: SemanticLineage;
}): SemanticReuseRecord {
  if (args.p3Decision === 'RECOMPUTE_REQUIRED' || args.p3Decision === 'REUSE_UNPROVEN') {
    return {
      reuseDecision: args.p3Decision === 'RECOMPUTE_REQUIRED' ? 'RECOMPUTE_REQUIRED' : 'REUSE_UNPROVEN',
      compare: args.p3Decision === 'RECOMPUTE_REQUIRED' ? 'SEMANTIC_CHANGE' : 'UNPROVEN',
      semanticFingerprint: args.candidate ? buildP4SemanticFingerprint(args.candidate) : '',
      oldSemanticFingerprint: args.oldInput ? buildP4SemanticFingerprint(args.oldInput) : '',
      lineage: args.lineage,
      usageRelation: null,
    };
  }
  const compare = compareP4SemanticInputs(args.oldInput, args.candidate, args.lineage);
  const reuseDecision = mapCompareToReuse(compare);
  const safe =
    reuseDecision === 'SAFE_REUSE' || reuseDecision === 'SAFE_REUSE_WITH_METADATA_CHANGE';
  return {
    reuseDecision,
    compare,
    semanticFingerprint: args.candidate ? buildP4SemanticFingerprint(args.candidate) : '',
    oldSemanticFingerprint: args.oldInput ? buildP4SemanticFingerprint(args.oldInput) : '',
    lineage: args.lineage,
    usageRelation: safe ? 'REUSED_UNDER_SEMANTIC_EQUIVALENCE' : null,
  };
}
