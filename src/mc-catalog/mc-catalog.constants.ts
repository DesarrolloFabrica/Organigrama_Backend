/**
 * Constantes del catálogo MC1 (Modelo de Competencias).
 * Independiente de PA1 / Attribute Engine.
 */

/** Familia de catálogo MC1 (áreas + especialidades). */
export const MC_CATALOG_CODE = 'mc1-domains';
/** MC1.8.1: SOFTWARE + VISUAL_DESIGN + AUDIOVISUAL_PRODUCTION. No mutar mc1.6-2026-07-27 (congelada). */
export const MC_CATALOG_VERSION = 'mc1.8-2026-07-28';
export const MC_CATALOG_NAME = 'Modelo de Competencias — Dominios';
export const MC_CATALOG_DESCRIPTION =
  'Catálogo versionado de áreas de experiencia y especialidades profesionales ' +
  '(MC1). Incluye SOFTWARE, VISUAL_DESIGN y AUDIOVISUAL_PRODUCTION. ' +
  'No incluye mappings skill→especialidad ni métricas de perfil.';

/** Namespace advisory lock del catálogo MC1 ('MCC'). */
export const MC_CATALOG_ADVISORY_LOCK_NS = 0x4d4343;
