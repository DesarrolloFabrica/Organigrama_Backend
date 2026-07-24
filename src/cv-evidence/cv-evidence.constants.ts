/**
 * Versionado Evidence Engine.
 * er1 histórico congelado; er2 es el default operativo (E5.1).
 */
export const CV_EVIDENCE_RULES_VERSION_ER1 = 'er1-2026-07-24';
export const CV_EVIDENCE_SOURCE_WEIGHT_VERSION_ER1 = 'sw1';
export const CV_EVIDENCE_ALGORITHM_VERSION_ER1 = '1.0.0';

export const CV_EVIDENCE_RULES_VERSION = 'er2-2026-07-24';
export const CV_EVIDENCE_SOURCE_WEIGHT_VERSION = 'sw2';
export const CV_EVIDENCE_ALGORITHM_VERSION = '1.1.0';

/** @deprecated alias histórico — preferir CV_EVIDENCE_RULES_VERSION_ER1 */
export const CV_EVIDENCE_RULES_VERSION_LEGACY = CV_EVIDENCE_RULES_VERSION_ER1;

/** Longitud máxima (chars normalizados) para SHORT_EVIDENCE. */
export const SHORT_EVIDENCE_MAX_CHARS = 24;

/** Decaimiento de evidencias adicionales del mismo sourceType. */
export const SAME_SOURCE_DECAY = 0.4;

/** Namespace advisory lock Evidence Engine. */
export const EVIDENCE_EVAL_ADVISORY_LOCK_NS = 0x455645; // 'EVE'
