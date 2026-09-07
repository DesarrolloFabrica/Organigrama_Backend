/**
 * Auditoría estática P3→P4. No modifica contratos. No llama Gemini.
 * Fuente: p4-context-loader, p4-runner, p4-prompt-v1, reuse-fingerprint.
 */
export type P3FieldP4Usage = {
  p3Field: string;
  p4Usage: string;
  classification:
    | 'DETERMINISTICALLY_REPRODUCIBLE'
    | 'CAN_BE_DERIVED'
    | 'SEMANTIC_ONLY'
    | 'NOT_REQUIRED_BY_P4'
    | 'UNKNOWN';
  blocking: boolean;
  notes: string;
};

export const P3_TO_P4_USAGE: P3FieldP4Usage[] = [
  {
    p3Field: 'specialtyCode',
    p4Usage: 'routing + prompt specialty list + reuse specialtiesKey + output parentSpecialtyCode',
    classification: 'DETERMINISTICALLY_REPRODUCIBLE',
    blocking: true,
    notes: 'resolveP4SpecialtiesEvaluated copies specialtyCode. isKnownSpecialtyCode filter.',
  },
  {
    p3Field: 'parentFieldCode / fieldCode',
    p4Usage: 'routing key fieldCode::specialtyCode; prompt; output parentFieldCode',
    classification: 'DETERMINISTICALLY_REPRODUCIBLE',
    blocking: true,
    notes: 'Must match fr.fieldCode or the specialty is skipped.',
  },
  {
    p3Field: 'status (OBSERVED|WEAK)',
    p4Usage:
      'OBSERVED → AUTHORITATIVE_TARGET + publishableFromP3; WEAK → ROUTING_CANDIDATE; other → excluded. WEAK-only abstains P4.',
    classification: 'CAN_BE_DERIVED',
    blocking: true,
    notes:
      'Resolver RESOLVED can map to OBSERVED for skip-eligible items. WEAK cannot be invented. Status promotion WEAK→OBSERVED changes P4 routing.',
  },
  {
    p3Field: 'supportingEvidenceUnitIds',
    p4Usage: 'NOT consumed. P4 loads Evidence Units from P1 pack independently.',
    classification: 'NOT_REQUIRED_BY_P4',
    blocking: false,
    notes:
      'P4 prompt requires supportingEvidenceUnitIds on SKILLS copied from P1 evidence, not from P3 supports. Canonical P3 uses ceu_* ids; resolver uses candidateId → SUPPORTS_GAP vs P3 canonical, not vs P4.',
  },
  {
    p3Field: 'rationaleCode',
    p4Usage: 'NOT consumed by routing, prompt specialty list, fingerprint, or normalize.',
    classification: 'NOT_REQUIRED_BY_P4',
    blocking: false,
    notes: 'P4 emits its own skill rationaleCode (RECURRENT_PRACTICE, …).',
  },
  {
    p3Field: 'confidence',
    p4Usage:
      'Copied to specialtiesEvaluated.p3Confidence and included in Gemini user JSON. NOT in system prompt list. NOT in p4SpecialtiesKey. NOT used by hasAuthoritativeP4Target.',
    classification: 'SEMANTIC_ONLY',
    blocking: false,
    notes:
      'NON_BLOCKING for code-path routing/visibility/skill status. Residual: model could see the number in user payload. Do not fabricate confidence.',
  },
  {
    p3Field: 'outcomeStatus / notes / ambiguity flags',
    p4Usage: 'Not read by resolveP4SpecialtiesEvaluated.',
    classification: 'NOT_REQUIRED_BY_P4',
    blocking: false,
    notes: 'P4 abstention is derived from absence of OBSERVED authoritative targets.',
  },
];

export const EXPERIMENTAL_RATIONALE_MAP: Record<string, string> = {
  ACTION_OUTCOME_MATCH: 'COHERENT_PRACTICE_CLUSTER',
  MULTI_ACTION_CLUSTER: 'COHERENT_PRACTICE_CLUSTER',
  SINGLE_SOURCE_THIN: 'SINGLE_UNIT_INSUFFICIENT',
  TOOL_ONLY_REJECTED: 'TOOL_ONLY_REJECTED',
  NO_ORIGIN_PRACTICE: 'OUT_OF_FIELD_REJECTED',
  KNOWLEDGE_CANNOT_ORIGINATE: 'TOOL_ONLY_REJECTED',
  FIELD_NOT_UNIQUELY_RESOLVED: 'CATALOG_GAP_SIGNAL',
  CATALOG_GAP: 'CATALOG_GAP_SIGNAL',
};

export const P4_MINIMUM_CONTRACT = [
  'specialtyCode',
  'parentFieldCode',
  'status',
] as const;

export const CONFIDENCE_AUDIT = {
  codePath: 'NON_BLOCKING',
  promptPayloadPresent: true,
  reuseFingerprint: false,
  fabricate: false,
} as const;
