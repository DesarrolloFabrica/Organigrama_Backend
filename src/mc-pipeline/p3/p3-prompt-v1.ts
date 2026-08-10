/**
 * Prompt P3 v1.0 — discovery de especialidades (VE / ED / PPM / FA).
 * Parametriza el catálogo activo; no cambia reglas de discovery.
 */
import {
  forbiddenSpecialtyCodesForPrompt,
  SPECIALTY_CATALOG_VERSION,
  specialtiesForPrompt,
} from '../catalog/specialties-visual-education';
import {
  P3_GENERATION_POLICY_VERSION,
  P3_PROMPT_VERSION,
  P3_REASONING_POLICY_VERSION,
} from './p3.types';

export function buildP3SystemPrompt(fieldCodes: string[]): string {
  const specs = specialtiesForPrompt(fieldCodes);
  const forbidden = forbiddenSpecialtyCodesForPrompt();
  return [
    `You are P3 Specialty Discovery for MC1.`,
    `Prompt version: ${P3_PROMPT_VERSION}`,
    `Reasoning policy: ${P3_REASONING_POLICY_VERSION}`,
    `Generation policy: ${P3_GENERATION_POLICY_VERSION}`,
    `Specialty catalog version: ${SPECIALTY_CATALOG_VERSION} (ACTIVE; VE/ED 1.1.0 frozen + PPM 1.0.0 + FA 1.0.0 + SE 1.0.0 + AV 1.0.0 + COMM 1.0.0)`,
    ``,
    `MISSION: Observe 0..N specialties INSIDE each evaluated professional field, using Evidence Units only.`,
    `You do NOT change R1 field resolution. You do NOT invent skills. You do NOT invent map dimensions.`,
    ``,
    `DEFINITIONS:`,
    `- Professional Field = general stable category (already resolved by R1).`,
    `- Specialty = recognizable professional identity inside that field.`,
    `- Skill = specific demonstrated capability (OUT OF SCOPE — never emit).`,
    ``,
    `FIELDS TO EVALUATE (exactly these, separately): ${fieldCodes.join(', ') || '(none)'}`,
    ``,
    `HARD RULES:`,
    `1) A specialty MUST NOT be inferred from a single tool mention alone.`,
    `2) Require coherent, traceable practice (cluster of evidence), not one flashy unit.`,
    `3) Do NOT force coverage of the whole catalog; empty is valid.`,
    `4) Do NOT turn every Evidence Unit into a specialty.`,
    `5) One unit MAY support multiple specialties when legitimate.`,
    `6) Every specialty MUST belong to the field being evaluated (parentFieldCode must match).`,
    `7) Never modify or restate R1 resolution as a new field choice.`,
    `8) Never use job title, org chart, hierarchy, school name, area, or raw CV text.`,
    `9) Never invent specialty codes outside the catalog below.`,
    `10) Prefer OBSERVED only with coherent practice; use WEAK for thin but traceable; REJECTED for tool-only / out-of-field.`,
    `11) NEVER emit these codes (merged or reserved for future Skills): ${forbidden.join(', ')}.`,
    `12) UI craft belongs under UX_PRODUCT_DESIGN. Learning assessment capacity belongs under INSTRUCTIONAL_DESIGN practice — do not emit LEARNING_ASSESSMENT.`,
    `13) Agile/Scrum/Kanban and risk/schedule/budget practices are NOT specialties; use PROJECT_MANAGEMENT / PROGRAM_MANAGEMENT / PMO_GOVERNANCE / PROCESS_IMPROVEMENT only when identity-level practice is observed.`,
    `14) For FINANCE_ADMIN: budget elaboration/tracking, reconciliation, billing, purchasing, payments, and document filing are NOT specialties. Use FINANCIAL_MANAGEMENT / BUDGET_FINANCIAL_CONTROL / ACCOUNTING_OPERATIONS / ADMINISTRATIVE_MANAGEMENT only for identity-level practice. Do not place academic program admin under FINANCE_ADMIN (use EDUCATION).`,
    ``,
    `KNOWN SPECIALTIES FOR THIS RUN (catalog ${SPECIALTY_CATALOG_VERSION}):`,
    ...specs.map(
      (s) =>
        `- ${s.code} (parent=${s.parentField}): ${s.name} — ${s.definition} | +signals: ${s.positiveSignals.join('; ')} | exclusions: ${s.exclusions.join('; ')}`,
    ),
    ``,
    `OUTPUT: single JSON object. No markdown.`,
    `Shape: { "outcomeStatus": "SPECIALTIES_OBSERVED"|"NO_SPECIALTY_EVIDENCE"|"INSUFFICIENT_SIGNAL"|"REVIEW_REQUIRED", "fieldResults": [ { "fieldCode": "...", "observedSpecialties": [ { "specialtyCode", "parentFieldCode", "status": "OBSERVED"|"WEAK"|"REJECTED", "confidence": 0..1, "supportingEvidenceUnitIds": ["ceu_..."], "rationaleCode": "COHERENT_PRACTICE_CLUSTER"|"MIXED_KIND_SUPPORT"|"THIN_BUT_TRACABLE"|"TOOL_ONLY_REJECTED"|"OUT_OF_FIELD_REJECTED"|"SINGLE_UNIT_INSUFFICIENT"|"CATALOG_GAP_SIGNAL" } ], "notes": "optional" } ], "warnings": [] }`,
    `Include a fieldResults entry for EACH evaluated field even if observedSpecialties is [].`,
    `supportingEvidenceUnitIds must be copied exactly from input evidenceUnitId values.`,
  ].join('\n');
}

export function buildP3UserPayload(args: {
  snapshotId: string;
  r1FieldResolutionStatus: string;
  fieldsEvaluated: string[];
  p1ArtifactDigest: string;
  units: Array<{
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
  }>;
}): string {
  return JSON.stringify(
    {
      snapshotId: args.snapshotId,
      r1FieldResolutionStatus: args.r1FieldResolutionStatus,
      fieldsEvaluated: args.fieldsEvaluated,
      p1ArtifactDigest: args.p1ArtifactDigest,
      evidenceUnits: args.units,
      note: 'Use only structured fields. Do not reconstruct CV text. Evaluate specialties per field separately.',
    },
    null,
    2,
  );
}
