import type {
  AttributeEngineConfig,
  AttributeSupportLevel,
} from './cv-attributes.types';

/**
 * Nivel de respaldo por score. Describe cuánta evidencia respalda el
 * subatributo/macroatributo, nunca dominio ni nivel profesional.
 *
 *   score = 0                      → NO_SUPPORT
 *   0 < score < developingMin      → LIMITED
 *   developingMin ≤ s < establishedMin   → DEVELOPING
 *   establishedMin ≤ s < wellSupportedMin → ESTABLISHED
 *   score ≥ wellSupportedMin       → WELL_SUPPORTED
 *
 * `limitedMin` evita huecos: scores entre 0 y 1 siguen siendo LIMITED, no
 * NO_SUPPORT, porque existe contribución real.
 */
export function resolveSupportLevel(
  score: number,
  config: AttributeEngineConfig,
): AttributeSupportLevel {
  const t = config.thresholds;
  if (score < t.limitedMin) return 'NO_SUPPORT';
  if (score >= t.wellSupportedMin) return 'WELL_SUPPORTED';
  if (score >= t.establishedMin) return 'ESTABLISHED';
  if (score >= t.developingMin) return 'DEVELOPING';
  return 'LIMITED';
}

export function clampScore(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
