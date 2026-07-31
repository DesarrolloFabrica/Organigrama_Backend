/**
 * Constantes del catálogo MC1 (Modelo de Competencias).
 * Independiente de PA1 / Attribute Engine.
 */

/** Familia de catálogo MC1 (áreas + especialidades). */
export const MC_CATALOG_CODE = 'mc1-domains';
/**
 * MC1.17: EDUCATION_MANAGEMENT — especialidades Andrés (EM_*) + corpus Alex.
 * Conserva OPS Maira. Taxonomía José queda en catálogos históricos.
 */
export const MC_CATALOG_VERSION = 'mc1.17-education-alex-2026-07-30';
export const MC_CATALOG_NAME = 'Modelo de Competencias — Dominios';
export const MC_CATALOG_DESCRIPTION =
  'Catálogo versionado de áreas de experiencia y especialidades profesionales ' +
  '(MC1). Incluye SOFTWARE, VISUAL_DESIGN, AUDIOVISUAL_PRODUCTION, ' +
  'OPERATIONS_MANAGEMENT (5 OPS_*), TALENT_MANAGEMENT, EDUCATION_MANAGEMENT ' +
  'y MARKETING_MANAGEMENT. ' +
  'No incluye mappings skill→especialidad ni métricas de perfil.';
/** Namespace advisory lock del catálogo MC1 ('MCC'). */
export const MC_CATALOG_ADVISORY_LOCK_NS = 0x4d4343;
