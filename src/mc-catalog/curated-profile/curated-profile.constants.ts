/**
 * Contrato piloto MC1 — curaduría manual (Fases 1–2).
 * Tipos de origen propios del contrato; NO son enums persistidos en BD.
 */

/** Versiones soportadas del JSON curado. */
export const CURATED_PROFILE_SCHEMA_VERSION_V10 = 'mc1-curated-profile-1.0.0';
export const CURATED_PROFILE_SCHEMA_VERSION_V11 = 'mc1-curated-profile-1.1.0';
/** Versión preferida para nuevas curadurías (Fase 2). */
export const CURATED_PROFILE_SCHEMA_VERSION = CURATED_PROFILE_SCHEMA_VERSION_V11;

export const CURATED_PROFILE_SCHEMA_VERSIONS = [
  CURATED_PROFILE_SCHEMA_VERSION_V10,
  CURATED_PROFILE_SCHEMA_VERSION_V11,
] as const;

export type CuratedProfileSchemaVersion =
  (typeof CURATED_PROFILE_SCHEMA_VERSIONS)[number];

export const CURATED_SOURCE_TYPES = ['MANUAL_CURATED'] as const;
export type CuratedSourceType = (typeof CURATED_SOURCE_TYPES)[number];

export const CURATED_SOURCE_METHODS = ['CHATGPT_HUMAN_REVIEW'] as const;
export type CuratedSourceMethod = (typeof CURATED_SOURCE_METHODS)[number];

export const CURATED_REVIEW_STATUSES = ['REVIEWED', 'DRAFT'] as const;
export type CuratedReviewStatus = (typeof CURATED_REVIEW_STATUSES)[number];

/**
 * Decisión de curaduría sobre una skill (schema ≥ 1.1.0).
 * No es enum persistido; controla el importer.
 */
export const CURATED_SKILL_REVIEW_DECISIONS = [
  'REUSE_EXISTING',
  'APPROVED_FOR_CREATION',
  'OMIT',
  'REJECTED',
] as const;
export type CuratedSkillReviewDecision =
  (typeof CURATED_SKILL_REVIEW_DECISIONS)[number];

/**
 * Clasificación de resolución contra catálogo / skills (salida del validador).
 */
export const CURATED_CATALOG_STATUSES = [
  'EXISTING',
  'PROPOSED',
  'ALIAS',
  'AMBIGUOUS',
  'INVALID',
] as const;
export type CuratedCatalogStatus = (typeof CURATED_CATALOG_STATUSES)[number];

export const CURATED_EVIDENCE_TYPES = ['EXPLICIT', 'CONTEXTUAL'] as const;
export type CuratedEvidenceType = (typeof CURATED_EVIDENCE_TYPES)[number];

/**
 * Mapping hacia columnas reales de `cv_extraction` (sin columna provider/source).
 *
 * | Concepto brief        | Columna / mecanismo                          |
 * | --------------------- | -------------------------------------------- |
 * | provider              | model = 'manual-curated'                     |
 * | model                 | prompt_version = 'chatgpt-human-reviewed'    |
 * | schemaVersion         | extractor_version + raw_result.meta          |
 * | source                | warnings + raw_result.meta.source            |
 */
export const CURATED_EXTRACTION_MAPPING = {
  model: 'manual-curated',
  promptVersion: 'chatgpt-human-reviewed',
  extractorVersion: 'manual-import-1.0.0',
  warningSourceTag: 'source=MANUAL_CURATED',
  enricherModel: 'manual-curated',
  enricherPromptVersion: 'chatgpt-human-reviewed',
  enricherVersion: 'manual-enrich-1.0.0',
} as const;

/** @deprecated usar CURATED_EXTRACTION_MAPPING */
export const CURATED_EXTRACTION_FUTURE_MAPPING = CURATED_EXTRACTION_MAPPING;

/** Heurística determinista: evidencia que parece cargo/jerarquía (warning). */
export const CURATED_ROLE_INFERENCE_PATTERNS: readonly RegExp[] = [
  /\bcargo\b/i,
  /\bpuesto\b/i,
  /\bjefe\b/i,
  /\bjefatura\b/i,
  /\breporta\s+a\b/i,
  /\bjerarqu[ií]a\b/i,
  /\b[aá]rea\s+organizacional\b/i,
  /\besuela\b/i,
  /\bescuela\b/i,
  /\bnombre\s+del\s+cargo\b/i,
];

export const CURATED_LIMITS = {
  maxSpecialties: 20,
  maxSkillsPerSpecialty: 80,
  maxEvidencePerSkill: 5,
  maxEvidenceLength: 2000,
  maxNameLength: 200,
  maxWarnings: 80,
  minEvidenceLength: 12,
} as const;

/** Drive sintético para cumplir NOT NULL sin fingir Gemini/Drive real. */
export const CURATED_SYNTHETIC_DRIVE = {
  fileIdPrefix: 'manual-curated:',
  fileNameSuffix: '.curated.json',
} as const;
