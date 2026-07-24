/**
 * Versionado independiente del Skill Enricher (no reutilizar versiones del extractor).
 */
export const CV_SKILLS_ENRICHER_PROMPT_VERSION = 'e1-2026-07-24';

export const CV_SKILLS_ENRICHER_VERSION = '1.0.0';

export const CV_SKILLS_ENRICHER_BLOCK_CONFIG_VERSION = 'b1';

export const DEFAULT_ENRICHER_BLOCK_SIZE = 15;
export const DEFAULT_ENRICHER_PARALLELISM = 1;
export const DEFAULT_ENRICHER_MAX_BLOCK_ATTEMPTS = 3;
export const DEFAULT_ENRICHER_MICRO_RETRY_SIZE = 5;
export const DEFAULT_ENRICHER_MAX_MICRO_RETRY_ATTEMPTS = 2;

export const ENRICHER_BLOCK_SIZE_MIN = 1;
export const ENRICHER_BLOCK_SIZE_MAX = 30;
export const ENRICHER_MAX_ATTEMPTS_MIN = 1;
export const ENRICHER_MAX_ATTEMPTS_MAX = 5;

export const MISSING_SKILL_FILLED_EMPTY = 'MISSING_SKILL_FILLED_EMPTY';
