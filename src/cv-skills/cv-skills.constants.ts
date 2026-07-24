/**
 * Versiones del pipeline de extracción de skills.
 * La idempotencia de persistencia usa prompt_version + extractor_version + model
 * junto con person_id y pdf_sha256 — no solo el nombre del modelo.
 */
/** Solo cambia el texto del prompt; el pipeline (validador/persistencia) sigue en 1.1.0. */
export const CV_SKILLS_PROMPT_VERSION = 'c2.1-2026-07-24';

/** Versión del código extractor/validador/normalizador (semver de pipeline). */
export const CV_SKILLS_EXTRACTOR_VERSION = '1.1.0';

/**
 * Orden transaccional de activación (servicio de persistencia, fase posterior):
 * 1. pg_advisory_xact_lock(person_id)
 * 2. Desactivar extracción activa previa (is_active = FALSE)
 * 3. Completar nueva (ítems + status = SUCCEEDED)
 * 4. Activar nueva (is_active = TRUE)
 * 5. COMMIT
 */
export const CV_EXTRACTION_STATUSES = [
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
] as const;

export type CvExtractionStatus = (typeof CV_EXTRACTION_STATUSES)[number];
