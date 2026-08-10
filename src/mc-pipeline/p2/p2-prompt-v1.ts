/**
 * Prompt P2 v1.1 — catálogo KNOWN de Campos Profesionales 2.0.0.
 */
import {
  catalogFieldsForPrompt,
  forbiddenSpecialtyCodesForPrompt,
  PROFESSIONAL_FIELD_CATALOG_VERSION,
} from '../catalog/professional-fields';
import {
  P2_CATALOG_POLICY_VERSION,
  P2_GENERATION_POLICY_VERSION,
  P2_MAX_CANDIDATES,
  P2_PROMPT_VERSION,
  P2_REASONING_POLICY_VERSION,
} from './p2.types';

export function buildP2SystemPrompt(): string {
  const fields = catalogFieldsForPrompt();
  const forbidden = forbiddenSpecialtyCodesForPrompt();
  return [
    `You are P2 Professional Field Candidate Generator for MC1.`,
    `Prompt version: ${P2_PROMPT_VERSION}`,
    `Reasoning policy: ${P2_REASONING_POLICY_VERSION}`,
    `Generation policy: ${P2_GENERATION_POLICY_VERSION}`,
    `Catalog policy: ${P2_CATALOG_POLICY_VERSION}`,
    `Professional field catalog version: ${PROFESSIONAL_FIELD_CATALOG_VERSION}`,
    ``,
    `MISSION: Propose 0..${P2_MAX_CANDIDATES} PROFESSIONAL FIELD candidates from Evidence Units only.`,
    `You do NOT select the final field. R1 will resolve later.`,
    `Professional Field = stable general category. Specialty = future branch inside a field. Do NOT emit specialties as fields.`,
    ``,
    `COGNITIVE PIPELINE (mandatory):`,
    `1) Inventory evidence (practice vs knowledge-only).`,
    `2) Group into Professional Activities.`,
    `3) Derive Capability Areas.`,
    `4) Open field hypotheses from capabilities using the KNOWN catalog.`,
    `5) Link each evidence unit (SUPPORTS/CONTRADICTS/NEUTRAL/INSUFFICIENT).`,
    `6) Reinforce / merge / weaken / discard.`,
    `7) Emit surviving candidates OR NO_DOMAIN_EVIDENCE / INSUFFICIENT_SIGNAL.`,
    ``,
    `HARD PROHIBITIONS:`,
    `- Never use job title, org chart, school, manager, area, hierarchy.`,
    `- Never invent specialties, skills, levels, or radar scores.`,
    `- Never quote or reconstruct raw CV text.`,
    `- Never emit primaryDomain / finalDomain / selectedDomain.`,
    `- Never create a candidate from a single flashy evidence unit alone.`,
    `- KNOWLEDGE_STATEMENT must not dominate without practice evidence.`,
    `- evidenceKind is a SIGNAL, never a field.`,
    `- NEVER emit these as domainCode (reserved specialties, not fields): ${forbidden.join(', ')}`,
    ``,
    `KNOWN PROFESSIONAL FIELDS (prefer these; catalogStatus=KNOWN; domainCode=exact code; proposedDomainKey=null):`,
    ...fields.map((f) => `- ${f.code}: ${f.name} — ${f.definition}`),
    ``,
    `CATALOG POLICY:`,
    `- If a KNOWN field reasonably explains the practice, MUST use catalogStatus=KNOWN and that domainCode.`,
    `- Do NOT invent free keys like field.graphic_design when VISUAL_DESIGN applies.`,
    `- Do NOT invent field.instructional_design when EDUCATION applies.`,
    `- DIGITAL content evidence is NOT its own field: assign SUPPORT to the contextual field(s) among VISUAL_DESIGN, COMMUNICATIONS, DIGITAL_MARKETING, AUDIOVISUAL_PRODUCTION, EDUCATION — never invent DIGITAL_CONTENT.`,
    `- PROPOSED only if NO known field reasonably fits; then proposedDomainKey like "field.<snake>" and domainCode=null.`,
    `- UNRESOLVED only when practice exists but cannot be typed.`,
    ``,
    `STRENGTH: practice + chorus + pattern + coherence.`,
    `TRANSVERSAL: one unit may SUPPORT multiple KNOWN fields; set TRANSVERSAL_SUPPORT.`,
    `CONTRADICTIONS: list contradictingEvidenceUnitIds; do not silently average.`,
    ``,
    `OUTCOMES: CANDIDATES_PRODUCED | NO_DOMAIN_EVIDENCE | INSUFFICIENT_SIGNAL | REVIEW_REQUIRED`,
    `OUTPUT: single JSON object. No markdown.`,
  ].join('\n');
}

export function buildP2UserPayload(args: {
  snapshotId: string;
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
  const knownCodes = catalogFieldsForPrompt().map((f) => f.code);
  const schemaHint = {
    professionalActivities: [
      {
        activityId: 'act-1',
        summaryLabel: 'short practice label',
        evidenceUnitIds: ['eu-...'],
      },
    ],
    capabilityAreas: [
      {
        capabilityId: 'cap-1',
        summaryLabel: 'short capability label',
        activityIds: ['act-1'],
      },
    ],
    domainCandidates: [
      {
        candidateId: 'dc-1',
        domainCode: 'VISUAL_DESIGN',
        proposedDomainKey: null,
        catalogStatus: 'KNOWN',
        candidateStatus: 'ACTIVE',
        confidence: 0.0,
        rank: 1,
        supportingEvidenceUnitIds: ['eu-...'],
        contradictingEvidenceUnitIds: [],
        rationaleCode: 'SUPPORT_MIXED_KINDS',
        coverageRatio: 0.0,
        ambiguityFlags: [],
        signalKindMix: { ACTION: 1 },
      },
    ],
    evidenceDispositions: [
      {
        evidenceUnitId: 'eu-...',
        decision: 'SUPPORTS',
        candidateRefs: ['dc-1'],
      },
    ],
    outcomeStatus: 'CANDIDATES_PRODUCED',
    reviewState: 'NOT_REQUIRED',
    warnings: [],
  };

  return JSON.stringify(
    {
      task: 'Generate P2 professional field candidates',
      snapshotId: args.snapshotId,
      p1ArtifactDigest: args.p1ArtifactDigest,
      maxCandidates: P2_MAX_CANDIDATES,
      knownFieldCodes: knownCodes,
      forbiddenSpecialtyCodes: forbiddenSpecialtyCodesForPrompt(),
      rationaleCodeEnum: [
        'SUPPORT_ACTION_CLUSTER',
        'SUPPORT_PROJECT_RESULT',
        'SUPPORT_RESPONSIBILITY_SCOPE',
        'SUPPORT_DELIVERABLE_SET',
        'SUPPORT_MIXED_KINDS',
        'PENALTY_KNOWLEDGE_ONLY',
        'PENALTY_CONTRADICTION',
        'PENALTY_LOW_DIVERSITY',
        'GAP_NO_KNOWN_MATCH',
        'TRANSVERSAL_SPLIT',
      ],
      ambiguityFlagEnum: [
        'TRANSVERSAL_SUPPORT',
        'MULTI_CANDIDATE_TIE',
        'CONTRADICTORY_EVIDENCE',
        'KNOWLEDGE_HEAVY',
        'LOW_COVERAGE',
        'KIND_IMBALANCE',
        'CATALOG_GAP',
        'WEAK_EXPLICITNESS',
        'INSUFFICIENT_ACTIONABLE_SIGNAL',
      ],
      dispositionEnum: [
        'SUPPORTS',
        'CONTRADICTS',
        'NEUTRAL',
        'INSUFFICIENT',
        'EXCLUDED_BY_POLICY',
      ],
      evidenceUnits: args.units,
      outputSchemaExample: schemaHint,
      rules: [
        'Prefer KNOWN domainCode from knownFieldCodes',
        'Every evidenceUnitId MUST appear exactly once in evidenceDispositions',
        'Ranks unique starting at 1',
        'domainCandidates length <= 5',
        'If outcomeStatus is NO_DOMAIN_EVIDENCE, domainCandidates must be []',
      ],
    },
    null,
    2,
  );
}
