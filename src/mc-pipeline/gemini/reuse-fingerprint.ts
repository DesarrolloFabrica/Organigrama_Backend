/**
 * Fingerprints de reuse por fase. Independientes: invalidar P3 no obliga a reejecutar P1.
 */
import { createHash } from 'node:crypto';
import { geminiJsonCallConfigFingerprint } from './gemini-json-call-config';

export function hashReuseParts(parts: Record<string, string>): string {
  const ordered = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k]}`)
    .join('|');
  return createHash('sha256').update(ordered, 'utf8').digest('hex');
}

export function hashSnapshotContent(normalizedText: string): string {
  return createHash('sha256').update(normalizedText, 'utf8').digest('hex');
}

export type P1ReuseFingerprintInput = {
  snapshotContentHash: string;
  segmenterName: string;
  segmenterVersion: string;
  promptVersion: string;
  contractVersion: string;
  model: string;
  batchBuilderVersion: string;
  validatorVersion: string;
  overrides?: Record<string, string>;
};

export function computeP1ReuseFingerprint(input: P1ReuseFingerprintInput): string {
  return hashReuseParts({
    snapshotContentHash: input.snapshotContentHash,
    segmenterName: input.segmenterName,
    segmenterVersion: input.segmenterVersion,
    promptVersion: input.promptVersion,
    contractVersion: input.contractVersion,
    model: input.model,
    modelConfig: geminiJsonCallConfigFingerprint(),
    batchBuilderVersion: input.batchBuilderVersion,
    validatorVersion: input.validatorVersion,
    ...(input.overrides ?? {}),
  });
}

export type P2ReuseFingerprintInput = {
  p1ArtifactDigest: string;
  promptVersion: string;
  contractVersion: string;
  catalogPolicyVersion: string;
  professionalFieldCatalogVersion: string;
  reasoningPolicyVersion: string;
  generationPolicyVersion: string;
  model: string;
  overrides?: Record<string, string>;
};

export function computeP2ReuseFingerprint(input: P2ReuseFingerprintInput): string {
  return hashReuseParts({
    p1ArtifactDigest: input.p1ArtifactDigest,
    promptVersion: input.promptVersion,
    contractVersion: input.contractVersion,
    catalogPolicyVersion: input.catalogPolicyVersion,
    professionalFieldCatalogVersion: input.professionalFieldCatalogVersion,
    reasoningPolicyVersion: input.reasoningPolicyVersion,
    generationPolicyVersion: input.generationPolicyVersion,
    model: input.model,
    modelConfig: geminiJsonCallConfigFingerprint(),
    ...(input.overrides ?? {}),
  });
}

export type P3ReuseFingerprintInput = {
  p1ArtifactDigest: string;
  r1FieldResolutionStatus: string;
  fieldsEvaluated: string[];
  promptVersion: string;
  contractVersion: string;
  specialtyCatalogVersion: string;
  reasoningPolicyVersion: string;
  generationPolicyVersion: string;
  model: string;
  overrides?: Record<string, string>;
};

export function computeP3ReuseFingerprint(input: P3ReuseFingerprintInput): string {
  return hashReuseParts({
    p1ArtifactDigest: input.p1ArtifactDigest,
    r1FieldResolutionStatus: input.r1FieldResolutionStatus,
    fieldsEvaluated: [...input.fieldsEvaluated].sort().join(','),
    promptVersion: input.promptVersion,
    contractVersion: input.contractVersion,
    specialtyCatalogVersion: input.specialtyCatalogVersion,
    reasoningPolicyVersion: input.reasoningPolicyVersion,
    generationPolicyVersion: input.generationPolicyVersion,
    model: input.model,
    modelConfig: geminiJsonCallConfigFingerprint(),
    ...(input.overrides ?? {}),
  });
}

export type P4ReuseFingerprintInput = {
  p1ArtifactDigest: string;
  p3ResultIdentity: string;
  specialtiesKey: string;
  promptVersion: string;
  contractVersion: string;
  specialtyCatalogVersion: string;
  routingPolicyVersion: string;
  reasoningPolicyVersion: string;
  generationPolicyVersion: string;
  model: string;
  overrides?: Record<string, string>;
};

export function computeP4ReuseFingerprint(input: P4ReuseFingerprintInput): string {
  return hashReuseParts({
    p1ArtifactDigest: input.p1ArtifactDigest,
    p3ResultIdentity: input.p3ResultIdentity,
    specialtiesKey: input.specialtiesKey,
    promptVersion: input.promptVersion,
    contractVersion: input.contractVersion,
    specialtyCatalogVersion: input.specialtyCatalogVersion,
    routingPolicyVersion: input.routingPolicyVersion,
    reasoningPolicyVersion: input.reasoningPolicyVersion,
    generationPolicyVersion: input.generationPolicyVersion,
    model: input.model,
    modelConfig: geminiJsonCallConfigFingerprint(),
    ...(input.overrides ?? {}),
  });
}

export function p4SpecialtiesKey(
  specialties: Array<{
    fieldCode: string;
    specialtyCode: string;
    evaluationRole?: string;
    p3Status?: string;
  }>,
): string {
  return [...specialties]
    .map(
      (s) =>
        `${s.fieldCode}:${s.specialtyCode}:${s.evaluationRole ?? s.p3Status ?? ''}`,
    )
    .sort()
    .join(',');
}
