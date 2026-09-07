export const ORG_CHART_SCOPE_GLOBAL = 'GLOBAL' as const;
export const ORG_CHART_SCOPE_COORDINATION = 'COORDINATION' as const;

export type OrgChartVersionScopeType =
  | typeof ORG_CHART_SCOPE_GLOBAL
  | typeof ORG_CHART_SCOPE_COORDINATION;

/** Query param para no aplicar overlays de coordinación (heredar de la versión global). */
export const ORG_CHART_SCOPE_VERSION_INHERIT = 'none';

/**
 * Coordinación piloto con versionamiento independiente.
 * Raíz: Coordinador Fábrica (Haider, person_id 49).
 */
export const FABRICA_CONTENIDOS_SCOPE = {
  code: 'fabrica-contenidos',
  label: 'Fábrica de contenidos',
  rootPersonId: '49',
  versionCode: 'fabrica-contenidos',
} as const;
