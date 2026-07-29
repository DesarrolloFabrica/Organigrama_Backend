/**
 * Dominios operativos MC1 (fuente provisional del universo candidato).
 *
 * Hoy: equivalente a DOMAIN_RULES del CLI mc110.
 * Futuro: policy versionada / catálogo runtime — el Evaluation Set congela
 * el snapshot al momento del run y no relee esta lista al resolver.
 *
 * HUMAN_RESOURCES (DISCOVERED) no se incluye.
 */

export const MC_OPERATIVE_DOMAIN_RULES = [
  { domainCode: 'SOFTWARE', rulesVersion: 'pa2-software-1.1.0' },
  { domainCode: 'VISUAL_DESIGN', rulesVersion: 'pa2-visual-design-1.1.0' },
  {
    domainCode: 'AUDIOVISUAL_PRODUCTION',
    rulesVersion: 'pa2-audiovisual-production-1.0.0',
  },
] as const;

export type McOperativeDomainRule = (typeof MC_OPERATIVE_DOMAIN_RULES)[number];

export function listOperativeDomainCodes(): string[] {
  return MC_OPERATIVE_DOMAIN_RULES.map((r) => r.domainCode);
}
