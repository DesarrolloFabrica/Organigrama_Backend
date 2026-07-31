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
  {
    domainCode: 'OPERATIONS_MANAGEMENT',
    rulesVersion: 'pa2-operations-management-1.0.0',
  },
  {
    domainCode: 'TALENT_MANAGEMENT',
    rulesVersion: 'pa2-talent-management-1.0.0',
  },
  {
    domainCode: 'EDUCATION_MANAGEMENT',
    rulesVersion: 'pa2-education-management-1.0.0',
  },
  {
    domainCode: 'MARKETING_MANAGEMENT',
    rulesVersion: 'pa2-marketing-management-1.0.0',
  },
] as const;

export type McOperativeDomainRule = (typeof MC_OPERATIVE_DOMAIN_RULES)[number];

export function listOperativeDomainCodes(): string[] {
  return MC_OPERATIVE_DOMAIN_RULES.map((r) => r.domainCode);
}

/** Resuelve la regla PA2 operativa para un dominio, o null si no está registrado. */
export function resolveOperativeRulesVersion(
  domainCode: string,
): string | null {
  const code = domainCode.trim().toUpperCase();
  const hit = MC_OPERATIVE_DOMAIN_RULES.find((r) => r.domainCode === code);
  return hit?.rulesVersion ?? null;
}
