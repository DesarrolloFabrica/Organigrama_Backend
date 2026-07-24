/**
 * Versionado del Attribute Engine (Fase E6).
 * Determinista: sin Gemini, sin PDF, sin lectura de capas previas fuera del
 * evidence evaluation ya persistido.
 */
export const CV_ATTRIBUTE_ALGORITHM_VERSION = '1.0.0';
export const CV_ATTRIBUTE_CONFIG_VERSION = 'ac1-2026-07-24';

/** Catálogo inicial de atributos profesionales. */
export const CV_ATTRIBUTE_CATALOG_CODE = 'professional-attributes';
export const CV_ATTRIBUTE_CATALOG_VERSION = 'pa1-2026-07-24';

/** Skills contribuyentes esperadas por subatributo (default de coverage). */
export const DEFAULT_TARGET_SUPPORTING_SKILLS = 3;

/** Namespace advisory lock del Attribute Engine ('ATR'). */
export const ATTRIBUTE_RUN_ADVISORY_LOCK_NS = 0x415452;

/** Namespace advisory lock del catálogo de atributos ('ACT'). */
export const ATTRIBUTE_CATALOG_ADVISORY_LOCK_NS = 0x414354;
