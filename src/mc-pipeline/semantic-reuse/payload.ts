/**
 * Payload prompt-effective P3/P4. Usa builders productivos en modo lectura.
 * Normaliza orden de fields/specialties (el builder evalúa por ítem; el fp productivo ordena).
 * Excluye metadata que no llega al modelo (producedBy, runId, timestamps, result identity).
 */
import { buildP3SystemPrompt, buildP3UserPayload } from '../p3/p3-prompt-v1';
import { buildP4SystemPrompt, buildP4UserPayload } from '../p4/p4-prompt-v1';
import type { P4SpecialtyEvaluated } from '../p4/p4.types';
import type { ResolverEvidenceUnit } from '../experimental/deterministic-resolver/types';
import { sha256Utf8 } from './hash';
import { normalizeP3FieldContext } from './p3-gate';
import { normalizeP4Specialties } from './p4-gate';
import type { P3SemanticInput, P4SemanticInput } from './types';

export type PromptUnit = {
  evidenceUnitId: string;
  evidenceKind: string;
  explicitness: string;
  pageNumber: number;
  normalizedActivity: string | null;
  object: string | null;
  toolOrMethod: string | null;
  result: string | null;
  scope: string | null;
  temporalContext: string | null;
};

export function unitsToPromptPayload(units: ResolverEvidenceUnit[]): PromptUnit[] {
  return [...units]
    .map((u) => ({
      evidenceUnitId: u.evidenceId,
      evidenceKind: String(u.evidenceKind),
      explicitness: u.explicitness,
      pageNumber: u.pageNumber ?? 0,
      normalizedActivity: u.normalizedActivity,
      object: u.object,
      toolOrMethod: u.toolOrMethod,
      result: u.result,
      scope: u.scope,
      temporalContext: u.temporalContext,
    }))
    .sort((a, b) => a.evidenceUnitId.localeCompare(b.evidenceUnitId));
}

export function buildP3PromptEffective(args: {
  input: P3SemanticInput;
  units: ResolverEvidenceUnit[];
}): { system: string; user: string; digest: string } {
  const fieldCodes = normalizeP3FieldContext(args.input.fieldContext, 'PRODUCTION').map(
    (f) => f.fieldCode,
  );
  const system = buildP3SystemPrompt(fieldCodes);
  const user = buildP3UserPayload({
    snapshotId: 'PINNED_SNAPSHOT',
    r1FieldResolutionStatus: args.input.r1FieldResolutionStatus,
    fieldsEvaluated: fieldCodes,
    p1ArtifactDigest: args.input.evidenceIdentity,
    units: unitsToPromptPayload(args.units),
  });
  return { system, user, digest: sha256Utf8(`${system}\n${user}`) };
}

export function buildP4PromptEffective(args: {
  input: P4SemanticInput;
  units: ResolverEvidenceUnit[];
}): { system: string; user: string; digest: string } {
  const specs = normalizeP4Specialties(args.input.specialties).map(
    (s): P4SpecialtyEvaluated => ({
      fieldCode: s.fieldCode,
      specialtyCode: s.specialtyCode,
      p3Status: s.status,
      p3Confidence: s.p3Confidence,
      evaluationRole: s.evaluationRole as P4SpecialtyEvaluated['evaluationRole'],
      routingEligible: s.routingEligible,
      publishableFromP3: s.publishableFromP3,
    }),
  );
  const system = buildP4SystemPrompt(specs);
  const user = buildP4UserPayload({
    snapshotId: 'PINNED_SNAPSHOT',
    r1FieldResolutionStatus: args.input.r1FieldResolutionStatus,
    specialtiesEvaluated: specs,
    p1ArtifactDigest: args.input.evidenceIdentity,
    units: unitsToPromptPayload(args.units),
  });
  return { system, user, digest: sha256Utf8(`${system}\n${user}`) };
}
