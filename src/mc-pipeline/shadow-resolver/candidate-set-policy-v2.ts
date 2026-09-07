/**
 * Candidate-set policy 0.2.0 — congelada ANTES de evaluar la cohorte.
 * No modifica Candidate.2 (0.3.0). No modifica catálogo productivo.
 * No copia secundarios Gemini.
 *
 * THIN es fieldEvidenceStrength, no un rol. CONTEXT puede ser THIN.
 */
import type { CompetitorPair } from '../experimental/deterministic-resolver/experimental-policy';

export const CANDIDATE_SET_V2_POLICY_CODE =
  'MC1.EXPERIMENTAL.P2.CANDIDATE_SET_POLICY' as const;
export const CANDIDATE_SET_V2_POLICY_VERSION = '0.2.0' as const;

export type CandidateSetV2Role =
  | 'PRIMARY'
  | 'SECONDARY'
  | 'CONTEXT'
  | 'COMPETITOR';

export type FieldEvidenceStrength = 'STRONG' | 'SUPPORTED' | 'THIN' | 'NONE';

/**
 * Par observado COMM↔AV — solo candidate-set v2.
 * No se inyecta en Candidate.2. Distingue context AV vs competitor AV fuerte.
 */
export const COMM_AV_PAIR_V2: CompetitorPair = {
  fieldA: 'COMMUNICATIONS',
  fieldB: 'AUDIOVISUAL_PRODUCTION',
  sharedPractices: ['contenido digital', 'redes sociales', 'canales digitales'],
  differentialA: [
    'comunicacion institucional',
    'comunicacion corporativa',
    'voceria',
    'comunicacion interna',
  ],
  differentialB: [
    'edicion de video',
    'material audiovisual',
    'produccion audiovisual',
    'fotografia',
    'postproduccion',
    'rodaje',
  ],
};

/**
 * Aliases de práctica field-specific para CONTEXT, tomados del catálogo
 * (GRAPHIC_DESIGN positiveSignals). No son persona-específicos. No entran a C2.
 */
export const CONTEXT_FIELD_ALIASES_V2: Record<string, string[]> = {
  VISUAL_DESIGN: ['piezas graficas', 'diseno de piezas graficas'],
};

export const CANDIDATE_SET_POLICY_V2 = {
  policyCode: CANDIDATE_SET_V2_POLICY_CODE,
  policyVersion: CANDIDATE_SET_V2_POLICY_VERSION,
  resolverVersionRequired: '0.3.0',
  policyVersionRequired: '0.3.0',
  productionCatalogUntouched: true,
  copiesGeminiSecondaries: false,
  candidate2Untouched: true,
  minIndependentPrimary: 2,
  minIndependentAuthoritativeSecondary: 2,
  thinIndependent: 1,
  contextOriginKinds: ['ACTION', 'DELIVERABLE'] as const,
  extraOverlayPairs: [COMM_AV_PAIR_V2],
  contextFieldAliases: CONTEXT_FIELD_ALIASES_V2,
  rules: [
    'PRIMARY = Candidate.2 RESOLVED Field; authority futura solo si C2 skip-eligible',
    'SECONDARY = origin practice, independent >= 2, not tool/knowledge-only; overlay pair requires differential on origin units',
    'CONTEXT = professional ACTION/DELIVERABLE, independent == 1, field-specific or differential on origin units, not tool/knowledge-only, not shared-only',
    'CONTEXT != SECONDARY != COMPETITOR; CONTEXT does not change R1 status',
    'THIN is evidence strength (independent == 1), not discard; CONTEXT + THIN is valid',
    'SHARED_PRACTICE alone never creates SECONDARY or CONTEXT',
    'COMPETITOR = viable Field in Candidate.2 AMBIGUOUS (independent >= 2); never degrade to CONTEXT to save skip',
    'AMBIGUOUS C2 emits COMPETITORS only (no PRIMARY, no SECONDARY, no CONTEXT)',
    'COMM↔AV is a candidate-set v2 boundary only; Candidate.2 overlay 0.3.0 unchanged',
    'contextFieldAliases.VISUAL_DESIGN piezas graficas from GRAPHIC_DESIGN catalog, not from a person',
    'CONTEXT does not by itself block contract skip; it must be preserved for P3',
    'R1 experimental consumes PRIMARY + SECONDARIES only',
    'P3 experimental consumes PRIMARY + SECONDARIES + CONTEXT with role metadata; CONTEXT does not imply OBSERVED specialties',
  ],
  ordering: [
    'PRIMARY',
    'SECONDARY STRONG',
    'SECONDARY SUPPORTED',
    'CONTEXT STRONG/SUPPORTED/THIN',
    'COMPETITOR',
    'within group: independentSourceCount desc, fieldCode asc',
  ],
} as const;
