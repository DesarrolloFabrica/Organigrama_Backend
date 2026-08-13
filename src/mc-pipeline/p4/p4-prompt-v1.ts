/**
 * Prompt P4 v1.1 — skill discovery con AUTHORITATIVE + ROUTING_CANDIDATE (12I).
 */
import { SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';
import {
  P4_GENERATION_POLICY_VERSION,
  P4_PROMPT_VERSION,
  P4_REASONING_POLICY_VERSION,
  P4_ROUTING_POLICY_VERSION,
  type P4SpecialtyEvaluated,
} from './p4.types';

export function buildP4SystemPrompt(
  specialties: P4SpecialtyEvaluated[],
): string {
  const list =
    specialties
      .map((s) => {
        const role = s.evaluationRole ?? 'AUTHORITATIVE_TARGET';
        const pub = s.publishableFromP3 ? 'publishableFromP3=true' : 'publishableFromP3=false';
        return `- ${s.fieldCode} / ${s.specialtyCode} [${role}; p3Status=${s.p3Status}; ${pub}; routingEligible=${s.routingEligible !== false}]`;
      })
      .join('\n') || '(none)';
  return [
    `You are P4 Skill Discovery for MC1.`,
    `Prompt version: ${P4_PROMPT_VERSION}`,
    `Reasoning policy: ${P4_REASONING_POLICY_VERSION}`,
    `Generation policy: ${P4_GENERATION_POLICY_VERSION}`,
    `Routing policy: ${P4_ROUTING_POLICY_VERSION}`,
    `Specialty catalog version: ${SPECIALTY_CATALOG_VERSION} (FROZEN)`,
    ``,
    `MISSION: Discover concrete professional Skills under permitted Specialty destinations, using Evidence Units only.`,
    `You do NOT change R1 or P3. You do NOT invent levels, radar %, or a global skill catalog.`,
    `You do NOT invent specialties that are not listed. You do NOT promote WEAK to OBSERVED.`,
    ``,
    `TAXONOMY:`,
    `- Professional Field = general category (already resolved).`,
    `- Specialty = professional identity branch (from P3).`,
    `- Skill = concrete demonstrable professional capacity under a Specialty.`,
    ``,
    `EVALUATION ROLES:`,
    `- AUTHORITATIVE_TARGET (P3 OBSERVED): full destination for skills; specialty already confirmed by P3.`,
    `- ROUTING_CANDIDATE (P3 WEAK): placement-only destination to avoid parking a clearly specialized practice under a more generic sibling (often GRAPHIC_DESIGN).`,
    `- ROUTING_CANDIDATE is NOT an authoritative specialty confirmation and does NOT authorize publication.`,
    `- Prefer the most specific evidence-supported specialty among eligible targets.`,
    `- Do NOT invent skills for every ROUTING_CANDIDATE; emit only when evidence clearly supports that specialty.`,
    `- Zero skills under a ROUTING_CANDIDATE is valid and common.`,
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
    `10) Prefer OBSERVED skills with recurrent practice (≥2 evidence units). Use WEAK skill status for thin but traceable.`,
    `11) skillCode: stable provisional code within this artifact, snake or SCREAMING_SNAKE, capacity-oriented (e.g. visual_composition, learning_experience_design).`,
    `12) name: short human label of the capacity (not a tool name).`,
    `13) When evidence clearly supports a ROUTING_CANDIDATE more specific than GRAPHIC_DESIGN, place the skill under that candidate — not under GRAPHIC_DESIGN.`,
    `14) Optional specialtyCorroborationHints: only when a ROUTING_CANDIDATE receives a clearly evidenced skill; never implies P3 status change.`,
    ``,
    `OUTPUT: single JSON object. No markdown.`,
    `Shape: { "outcomeStatus": "SKILLS_OBSERVED"|"NO_SKILL_EVIDENCE"|"INSUFFICIENT_SIGNAL"|"REVIEW_REQUIRED", "specialtyResults": [ { "fieldCode", "specialtyCode", "observedSkills": [ { "skillCode", "name", "parentFieldCode", "parentSpecialtyCode", "status": "OBSERVED"|"WEAK", "confidence": 0..1, "supportingEvidenceUnitIds": ["ceu_..."], "supportingSignals": ["..."], "toolOrTechnologySignals": ["..."], "rationaleCode": "RECURRENT_PRACTICE"|"EQUIVALENT_EXPRESSION_CLUSTER"|"TRACEABLE_CAPACITY"|"THIN_BUT_TRACABLE"|"TOOL_ONLY_REJECTED"|"GENERIC_REJECTED"|"SINGLE_UNIT_INSUFFICIENT"|"OUT_OF_SPECIALTY_REJECTED" } ], "notes": "optional" } ], "specialtyCorroborationHints": [ { "fieldCode", "specialtyCode", "skillCode", "supportingEvidenceUnitIds": ["ceu_..."] } ], "warnings": [] }`,
  ].join('\n');
}

export function buildP4UserPayload(args: {
  snapshotId: string;
  r1FieldResolutionStatus: string;
  specialtiesEvaluated: P4SpecialtyEvaluated[];
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
      routingPolicyVersion: P4_ROUTING_POLICY_VERSION,
      p1ArtifactDigest: args.p1ArtifactDigest,
      evidenceUnits: args.units,
      note: 'Place skills under listed destinations. Prefer most specific evidence-supported specialty among eligible targets. ROUTING_CANDIDATE (WEAK) is placement-only — does not confirm or publish specialty. Keep tools in toolOrTechnologySignals.',
    },
    null,
    2,
  );
}
