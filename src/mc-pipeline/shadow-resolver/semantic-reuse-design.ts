/**
 * Auditoría + diseño de reuse semántico P3/P4.
 * No modifica fingerprints productivos ni reuse gates.
 */
import { createHash } from 'node:crypto';
import { canonicalEvidenceIdentity } from '../experimental/deterministic-resolver/shadow/fingerprint';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import type { ResolverEvidenceUnit } from '../experimental/deterministic-resolver/types';
import {
  P3_CONTRACT_VERSION,
  P3_GENERATION_POLICY_VERSION,
  P3_PROMPT_VERSION,
  P3_REASONING_POLICY_VERSION,
} from '../p3/p3.types';
import {
  P4_CONTRACT_VERSION,
  P4_GENERATION_POLICY_VERSION,
  P4_PROMPT_VERSION,
  P4_REASONING_POLICY_VERSION,
  P4_ROUTING_POLICY_VERSION,
} from '../p4/p4.types';
import { SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';
import { geminiJsonCallConfigFingerprint } from '../gemini/gemini-json-call-config';
import { computeP3ReuseFingerprint, p4SpecialtiesKey } from '../gemini/reuse-fingerprint';

export type FingerprintClass =
  | 'SEMANTIC_REQUIRED'
  | 'REPRODUCIBILITY_METADATA'
  | 'OVERINVALIDATING'
  | 'UNKNOWN';

export type ReuseSafetyClass =
  | 'SAFE_REUSE'
  | 'SAFE_REUSE_WITH_METADATA_CHANGE'
  | 'RECOMPUTE_REQUIRED'
  | 'REUSE_UNPROVEN';

export const P3_CURRENT_FINGERPRINT_PARTS: Array<{
  field: string;
  inPrompt: boolean;
  inFingerprint: boolean;
  classification: FingerprintClass;
  note: string;
}> = [
  { field: 'fieldCode', inPrompt: true, inFingerprint: true, classification: 'SEMANTIC_REQUIRED', note: 'FIELDS TO EVALUATE; fieldsEvaluated join' },
  { field: 'fieldRole', inPrompt: false, inFingerprint: false, classification: 'SEMANTIC_REQUIRED', note: 'No llega al prompt P3 actual. Debe entrar al semantic fp futuro.' },
  { field: 'confidence', inPrompt: false, inFingerprint: false, classification: 'REPRODUCIBILITY_METADATA', note: 'R1 confidence no entra a P3 prompt' },
  { field: 'producedBy', inPrompt: false, inFingerprint: false, classification: 'REPRODUCIBILITY_METADATA', note: 'No debe invalidar si input semántico idéntico' },
  { field: 'candidateIds', inPrompt: false, inFingerprint: false, classification: 'REPRODUCIBILITY_METADATA', note: 'P2 candidateId no llega a P3' },
  { field: 'supports', inPrompt: false, inFingerprint: false, classification: 'REPRODUCIBILITY_METADATA', note: 'P3 usa units P1 completos, no supports P2' },
  { field: 'rationale', inPrompt: false, inFingerprint: false, classification: 'REPRODUCIBILITY_METADATA', note: 'No en prompt P3' },
  { field: 'r1FieldResolutionStatus', inPrompt: true, inFingerprint: true, classification: 'UNKNOWN', note: 'Está en user payload; reglas dicen no usarlo para elegir Field' },
  { field: 'p1ArtifactDigest', inPrompt: true, inFingerprint: true, classification: 'SEMANTIC_REQUIRED', note: 'Proxy de evidencia P1; no es identity unit-level' },
  { field: 'evidenceUnits', inPrompt: true, inFingerprint: false, classification: 'SEMANTIC_REQUIRED', note: 'Prompt recibe units; fp solo tiene digest P1' },
  { field: 'specialtyCatalog', inPrompt: true, inFingerprint: true, classification: 'SEMANTIC_REQUIRED', note: '' },
  { field: 'promptVersion', inPrompt: true, inFingerprint: true, classification: 'SEMANTIC_REQUIRED', note: '' },
  { field: 'reasoningPolicy', inPrompt: true, inFingerprint: true, classification: 'SEMANTIC_REQUIRED', note: '' },
  { field: 'generationPolicy', inPrompt: true, inFingerprint: true, classification: 'SEMANTIC_REQUIRED', note: '' },
  { field: 'model+temp', inPrompt: false, inFingerprint: true, classification: 'SEMANTIC_REQUIRED', note: 'modelConfig via geminiJsonCallConfigFingerprint' },
  { field: 'runId/timestamps', inPrompt: false, inFingerprint: false, classification: 'REPRODUCIBILITY_METADATA', note: 'Correctamente fuera del fp' },
];

export const P4_CURRENT_FINGERPRINT_PARTS: Array<{
  field: string;
  inPrompt: boolean;
  inFingerprint: boolean;
  classification: FingerprintClass;
  note: string;
}> = [
  { field: 'specialtyCode+fieldCode+p3Status', inPrompt: true, inFingerprint: true, classification: 'SEMANTIC_REQUIRED', note: 'specialtiesKey / system prompt list' },
  { field: 'evaluationRole', inPrompt: true, inFingerprint: true, classification: 'SEMANTIC_REQUIRED', note: 'AUTHORITATIVE vs ROUTING_CANDIDATE' },
  { field: 'p3ResultIdentity', inPrompt: false, inFingerprint: true, classification: 'OVERINVALIDATING', note: 'Hash del reuseFingerprint P3 completo, no del set de specialties' },
  { field: 'r1FieldResolutionStatus', inPrompt: true, inFingerprint: false, classification: 'UNKNOWN', note: 'En user payload P4; no en fp P4 (sí vía p3ResultIdentity)' },
  { field: 'p1ArtifactDigest', inPrompt: true, inFingerprint: true, classification: 'SEMANTIC_REQUIRED', note: '' },
  { field: 'evidenceUnits', inPrompt: true, inFingerprint: false, classification: 'SEMANTIC_REQUIRED', note: 'Via digest' },
  { field: 'routingPolicy', inPrompt: true, inFingerprint: true, classification: 'SEMANTIC_REQUIRED', note: '' },
  { field: 'producedBy', inPrompt: false, inFingerprint: false, classification: 'REPRODUCIBILITY_METADATA', note: '' },
  { field: 'p3 executionId', inPrompt: false, inFingerprint: true, classification: 'OVERINVALIDATING', note: 'Indirecto: p3ResultIdentity cambia si P3 se reejecuta' },
];

export type SemanticP3Input = {
  units: ResolverEvidenceUnit[];
  fields: Array<{ fieldCode: string; role?: string }>;
  specialtyCatalogVersion?: string;
  promptVersion?: string;
  reasoningPolicyVersion?: string;
  generationPolicyVersion?: string;
  model?: string;
};

export function computeSemanticP3Fingerprint(input: SemanticP3Input): string {
  const fields = [...input.fields]
    .map((f) => `${f.fieldCode}:${f.role ?? 'UNSET'}`)
    .sort();
  return createHash('sha256')
    .update(
      stableStringify({
        evidence: canonicalEvidenceIdentity(input.units),
        fields,
        specialtyCatalogVersion: input.specialtyCatalogVersion ?? SPECIALTY_CATALOG_VERSION,
        promptVersion: input.promptVersion ?? P3_PROMPT_VERSION,
        reasoningPolicyVersion: input.reasoningPolicyVersion ?? P3_REASONING_POLICY_VERSION,
        generationPolicyVersion: input.generationPolicyVersion ?? P3_GENERATION_POLICY_VERSION,
        model: input.model ?? 'pinned',
        modelConfig: geminiJsonCallConfigFingerprint(),
      }),
      'utf8',
    )
    .digest('hex');
}

/** Identidad que el prompt P3 actual realmente usa (sin role, sin producer). */
export function computeActualP3PromptIdentity(input: {
  units: ResolverEvidenceUnit[];
  fieldCodes: string[];
  r1FieldResolutionStatus: string;
}): string {
  return createHash('sha256')
    .update(
      stableStringify({
        evidence: canonicalEvidenceIdentity(input.units),
        fieldCodes: [...input.fieldCodes].sort(),
        r1FieldResolutionStatus: input.r1FieldResolutionStatus,
        catalog: SPECIALTY_CATALOG_VERSION,
        prompt: P3_PROMPT_VERSION,
        reasoning: P3_REASONING_POLICY_VERSION,
      }),
      'utf8',
    )
    .digest('hex');
}

export type SemanticP4Input = {
  units: ResolverEvidenceUnit[];
  specialties: Array<{
    fieldCode: string;
    specialtyCode: string;
    evaluationRole?: string;
    p3Status?: string;
  }>;
  routingPolicyVersion?: string;
  promptVersion?: string;
  model?: string;
};

export function computeSemanticP4Fingerprint(input: SemanticP4Input): string {
  return createHash('sha256')
    .update(
      stableStringify({
        evidence: canonicalEvidenceIdentity(input.units),
        specialtiesKey: p4SpecialtiesKey(input.specialties),
        routingPolicyVersion: input.routingPolicyVersion ?? P4_ROUTING_POLICY_VERSION,
        promptVersion: input.promptVersion ?? P4_PROMPT_VERSION,
        contractVersion: P4_CONTRACT_VERSION,
        specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
        reasoningPolicyVersion: P4_REASONING_POLICY_VERSION,
        generationPolicyVersion: P4_GENERATION_POLICY_VERSION,
        model: input.model ?? 'pinned',
        modelConfig: geminiJsonCallConfigFingerprint(),
      }),
      'utf8',
    )
    .digest('hex');
}

export function classifyP3Transition(args: {
  histFieldCodes: string[];
  detProdFieldCodes: string[];
  histRoles: Record<string, string>;
  detRoles: Record<string, string>;
  histR1Status: string;
  detR1Status: string;
  evidenceSame: boolean;
}): {
  productionPath: ReuseSafetyClass;
  roleContract: 'ROLE_CONTRACT_NOT_YET_ACTIVE' | 'ROLE_CHANGE_SEMANTIC';
  currentFingerprint: 'CORRECT_INVALIDATION' | 'OVERINVALIDATION' | 'UNDERINVALIDATION_RISK';
  note: string;
} {
  const prodSet = args.detProdFieldCodes.join('|');
  const histSet = args.histFieldCodes.join('|');
  const fieldSetChanged = prodSet !== histSet;
  const roleChanged = Object.keys({ ...args.histRoles, ...args.detRoles }).some(
    (k) => args.histRoles[k] && args.detRoles[k] && args.histRoles[k] !== args.detRoles[k],
  );
  const statusChanged = args.histR1Status !== args.detR1Status;

  if (!args.evidenceSame || fieldSetChanged) {
    return {
      productionPath: 'RECOMPUTE_REQUIRED',
      roleContract: roleChanged ? 'ROLE_CHANGE_SEMANTIC' : 'ROLE_CONTRACT_NOT_YET_ACTIVE',
      currentFingerprint: 'CORRECT_INVALIDATION',
      note: 'Field set or evidence changed — P3 must recompute',
    };
  }
  return {
    productionPath: statusChanged ? 'REUSE_UNPROVEN' : 'SAFE_REUSE',
    roleContract: roleChanged ? 'ROLE_CONTRACT_NOT_YET_ACTIVE' : 'ROLE_CONTRACT_NOT_YET_ACTIVE',
    currentFingerprint: statusChanged ? 'OVERINVALIDATION' : 'CORRECT_INVALIDATION',
    note: roleChanged
      ? 'Prompt P3 actual no recibe fieldRole; status R1 sí está en payload'
      : 'Same fields+evidence',
  };
}

export function currentP3Fingerprint(args: {
  p1ArtifactDigest: string;
  r1Status: string;
  fieldCodes: string[];
  model: string;
}): string {
  return computeP3ReuseFingerprint({
    p1ArtifactDigest: args.p1ArtifactDigest,
    r1FieldResolutionStatus: args.r1Status,
    fieldsEvaluated: args.fieldCodes,
    promptVersion: P3_PROMPT_VERSION,
    contractVersion: P3_CONTRACT_VERSION,
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    reasoningPolicyVersion: P3_REASONING_POLICY_VERSION,
    generationPolicyVersion: P3_GENERATION_POLICY_VERSION,
    model: args.model,
  });
}

export const SEMANTIC_REUSE_POLICY = {
  rule: 'if semanticInputFingerprint unchanged then REUSE else RECOMPUTE',
  not: 'if upstream run identity changed then RECOMPUTE',
  lineageKeptSeparate: true,
  implemented: false,
} as const;

export const MC1_SEMANTIC_REUSE_GATE = {
  name: 'MC1_SEMANTIC_REUSE_GATE',
  implemented: false,
  layers: {
    semanticInputFingerprint: 'invalidation criterion',
    producerIdentity: 'metadata only; not invalidation',
    auditLineage: 'upstream result id, producer, pack dirs; never dropped',
  },
  p3SemanticParts: [
    'canonicalEvidenceIdentity',
    'ordered field context (fieldCode + fieldRole)',
    'specialty catalog version',
    'P3 prompt version',
    'model + modelConfig',
    'reasoning policy',
    'generation policy',
  ],
  p4SemanticParts: [
    'canonicalEvidenceIdentity',
    'specialtiesKey (fieldCode:specialtyCode:evaluationRole|p3Status)',
    'specialty catalog version',
    'P4 prompt + routing + reasoning + generation',
    'model + modelConfig',
  ],
  excludedFromInvalidation: [
    'producedBy',
    'runId',
    'timestamps',
    'p2ResultIdentity',
    'p3ResultIdentity (full pack reuse fingerprint)',
    'executionId',
  ],
} as const;

export const PRODUCER_IDENTITY_POLICY = {
  p3: {
    invalidatesIfProducerChangesAndSemanticSame: false,
    why: 'P3 prompt y fingerprint actuales no incluyen producedBy. El input es fieldsEvaluated + evidence + catalog + policies.',
  },
  p4: {
    invalidatesIfProducerChangesAndSemanticSame: false,
    why: 'P4 razona sobre specialties P3 + evidence. producedBy de P2/P3 no está en el prompt. p3ResultIdentity actual SÍ invalidaría al reejecutar P3 aunque specialties no cambien — eso es overinvalidación, no semántica.',
  },
  profile: {
    invalidatesIfProducerChangesAndSemanticSame: false,
    why: 'PROFILE/presentation se ensambla de packs R1+P3+P4. Determinista. Producer no entra.',
  },
} as const;

export const FIELD_ROLE_SEMANTIC_POLICY = {
  inCurrentP3Prompt: false,
  inCurrentP3Fingerprint: false,
  shouldBeInFutureSemanticIdentity: true,
  currentClassification: 'ROLE_CONTRACT_NOT_YET_ACTIVE',
  note: 'Hoy P3 recibe solo fieldCodes. fieldRole debe entrar al semantic fp cuando CONTEXT policy esté viva; no forzar reuse hoy si el role cambió.',
} as const;

export type FingerprintDeltaClass =
  | 'CORRECT_INVALIDATION'
  | 'OVERINVALIDATION'
  | 'UNDERINVALIDATION_RISK'
  | 'EQUIVALENT';

export function classifyFingerprintDelta(args: {
  currentChanged: boolean;
  semanticChanged: boolean;
}): FingerprintDeltaClass {
  if (args.currentChanged && args.semanticChanged) return 'CORRECT_INVALIDATION';
  if (args.currentChanged && !args.semanticChanged) return 'OVERINVALIDATION';
  if (!args.currentChanged && args.semanticChanged) return 'UNDERINVALIDATION_RISK';
  return 'EQUIVALENT';
}

export function decideReuseSafety(args: {
  fieldSetChanged: boolean;
  evidenceChanged: boolean;
  roleChanged: boolean;
  statusChanged: boolean;
}): ReuseSafetyClass {
  if (args.fieldSetChanged || args.evidenceChanged) return 'RECOMPUTE_REQUIRED';
  if (args.roleChanged || args.statusChanged) return 'REUSE_UNPROVEN';
  return 'SAFE_REUSE';
}
