/**
 * Prompt P4 v1.0 — discovery de Skills bajo Field + Specialty OBSERVED.
 * No ajustar tras la primera corrida del piloto 8D.
 */
import { SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';
import {
  P4_GENERATION_POLICY_VERSION,
  P4_PROMPT_VERSION,
  P4_REASONING_POLICY_VERSION,
} from './p4.types';

export function buildP4SystemPrompt(
  specialties: Array<{ fieldCode: string; specialtyCode: string }>,
): string {
  const list =
    specialties.map((s) => `- ${s.fieldCode} / ${s.specialtyCode}`).join('\n') ||
    '(none)';
  return [
    `You are P4 Skill Discovery for MC1.`,
    `Prompt version: ${P4_PROMPT_VERSION}`,
    `Reasoning policy: ${P4_REASONING_POLICY_VERSION}`,
    `Generation policy: ${P4_GENERATION_POLICY_VERSION}`,
    `Specialty catalog version: ${SPECIALTY_CATALOG_VERSION} (FROZEN)`,
    ``,
    `MISSION: Discover concrete professional Skills under each OBSERVED Specialty, using Evidence Units only.`,
    `You do NOT change R1 or P3. You do NOT invent levels, radar %, or a global skill catalog.`,
    ``,
    `TAXONOMY:`,
    `- Professional Field = general category (already resolved).`,
    `- Specialty = professional identity branch (already observed by P3).`,
    `- Skill = concrete demonstrable professional capacity under a Specialty.`,
    ``,
    `SPECIALTIES TO EVALUATE (exactly these; emit a result for each even if empty):`,
    list,
    ``,
    `CRITICAL: SKILL vs TOOL/TECHNOLOGY`,
    `- Skill = what the person professionally knows how to DO.`,
    `- Tool/Technology = instrument used to exercise a skill.`,
    `- React ≠ Frontend Development; NestJS ≠ Backend; Photoshop ≠ Image Editing;`,
    `  Illustrator ≠ Vector Illustration; Moodle ≠ LMS Administration.`,
    `- Put tools in toolOrTechnologySignals[]. Do NOT emit a tool name as a Skill.`,
    `- A technology may be mentioned as a technical competency ONLY if evidence shows substantive professional practice with it — still prefer capacity wording when possible.`,
    ``,
    `HARD RULES:`,
    `1) For each Specialty: find recurrent professional capacities; cluster equivalent expressions.`,
    `2) Separate capacity from tool.`,
    `3) Require traceable supportingEvidenceUnitIds copied exactly from input.`,
    `4) Multiple Skills per Specialty are allowed; zero Skills is valid.`,
    `5) One Evidence Unit may support multiple Skills when legitimate.`,
    `6) Skills MUST stay under the evaluated Specialty (parentFieldCode + parentSpecialtyCode).`,
    `7) Never use job title, org chart, hierarchy, school, area, or raw CV text.`,
    `8) Do NOT invent BEGINNER/INTERMEDIATE/ADVANCED levels or radar percentages.`,
    `9) Avoid generic undifferentiable skills: Communication, Creativity, Leadership, Management — unless highly specific professional practice is clearly evidenced.`,
    `10) Prefer OBSERVED with recurrent practice (≥2 evidence units). Use WEAK for thin but traceable.`,
    `11) skillCode: stable provisional code within this artifact, snake or SCREAMING_SNAKE, capacity-oriented (e.g. visual_composition, learning_experience_design).`,
    `12) name: short human label of the capacity (not a tool name).`,
    ``,
    `OUTPUT: single JSON object. No markdown.`,
    `Shape: { "outcomeStatus": "SKILLS_OBSERVED"|"NO_SKILL_EVIDENCE"|"INSUFFICIENT_SIGNAL"|"REVIEW_REQUIRED", "specialtyResults": [ { "fieldCode", "specialtyCode", "observedSkills": [ { "skillCode", "name", "parentFieldCode", "parentSpecialtyCode", "status": "OBSERVED"|"WEAK", "confidence": 0..1, "supportingEvidenceUnitIds": ["ceu_..."], "supportingSignals": ["..."], "toolOrTechnologySignals": ["..."], "rationaleCode": "RECURRENT_PRACTICE"|"EQUIVALENT_EXPRESSION_CLUSTER"|"TRACEABLE_CAPACITY"|"THIN_BUT_TRACABLE"|"TOOL_ONLY_REJECTED"|"GENERIC_REJECTED"|"SINGLE_UNIT_INSUFFICIENT"|"OUT_OF_SPECIALTY_REJECTED" } ], "notes": "optional" } ], "warnings": [] }`,
  ].join('\n');
}

export function buildP4UserPayload(args: {
  snapshotId: string;
  r1FieldResolutionStatus: string;
  specialtiesEvaluated: Array<{
    fieldCode: string;
    specialtyCode: string;
    p3Status: string;
    p3Confidence?: number;
  }>;
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
      specialtiesEvaluated: args.specialtiesEvaluated,
      p1ArtifactDigest: args.p1ArtifactDigest,
      evidenceUnits: args.units,
      note: 'Discover skills only under listed OBSERVED specialties. Keep tools in toolOrTechnologySignals. Use structured fields only.',
    },
    null,
    2,
  );
}
