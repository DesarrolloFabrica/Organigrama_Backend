import { AsyncLocalStorage } from 'async_hooks';

export type OrgChartVersionOverlay = {
  versionId: string;
  scopeCode: string;
  scopeLabel: string;
  rootPersonId: string;
};

export type OrgChartVersionReadPlan = {
  globalVersionId: string;
  overlays: OrgChartVersionOverlay[];
  /**
   * Aplicar los overrides de Planta Activa de Orbit (`core.planta_org_override`)
   * sobre el grafo compuesto. Solo para la versión global vigente: las
   * versiones históricas y los borradores globales se leen tal como se
   * guardaron.
   */
  applyPlanta: boolean;
  /**
   * Aplicar además las excepciones jerárquicas provisionales ACTIVE
   * (`organigrama.org_chart_hierarchy_exception`), que ganan a Planta. Solo
   * junto con `applyPlanta` y si la capa está instalada (migración 037).
   */
  applyExceptions?: boolean;
  /** Clave de cache: global + overlays seleccionados (+ Planta / excepciones). */
  cacheKey: string;
};

const als = new AsyncLocalStorage<OrgChartVersionReadPlan>();

export function buildOrgChartVersionReadPlanCacheKey(
  globalVersionId: string,
  overlayVersionIds: string[],
  applyPlanta = false,
  applyExceptions = false,
): string {
  const overlayPart =
    overlayVersionIds.length > 0 ? overlayVersionIds.join(',') : 'none';
  const plantaPart = applyPlanta ? '|planta' : '';
  const exceptionPart = applyPlanta && applyExceptions ? '|exc' : '';
  return `g${globalVersionId}|o${overlayPart}${plantaPart}${exceptionPart}`;
}

export function runWithOrgChartVersionReadPlan<T>(
  plan: OrgChartVersionReadPlan,
  fn: () => Promise<T> | T,
): Promise<T> | T {
  return als.run(plan, fn);
}

export function getOrgChartVersionReadPlan():
  | OrgChartVersionReadPlan
  | undefined {
  return als.getStore();
}

export function getOrgChartVersionReadPlanCacheKey(
  fallbackGlobalVersionId: string,
): string {
  const plan = als.getStore();
  if (!plan) return `g${fallbackGlobalVersionId}|oauto`;
  return plan.cacheKey;
}

export function getOrgChartOverlayVersionIds(): string[] {
  return als.getStore()?.overlays.map((overlay) => overlay.versionId) ?? [];
}

/** ¿La petición en curso compone el mapa con los overrides de Planta (Orbit)? */
export function isOrgChartPlantaApplied(): boolean {
  return als.getStore()?.applyPlanta === true;
}

/** ¿La petición en curso aplica las excepciones jerárquicas provisionales? */
export function isOrgChartHierarchyExceptionsApplied(): boolean {
  const plan = als.getStore();
  return plan?.applyPlanta === true && plan.applyExceptions === true;
}

/** Valor booleano explícito de una variable; `undefined` si falta o no se reconoce. */
function parseExplicitFlag(raw: string | undefined): boolean | undefined {
  const value = raw?.trim().toLowerCase();
  if (!value) return undefined;
  if (['true', '1', 'yes', 'on'].includes(value)) return true;
  if (['false', '0', 'no', 'off'].includes(value)) return false;
  return undefined;
}

/**
 * Interruptor de despliegue de la capa Planta. Acepta dos nombres:
 * - `ORG_CHART_PLANTA_ENABLED` (este código);
 * - `ORG_CHART_PLANTA_OVERLAY_ENABLED` (el que ya usa Cloud Run desde la
 *   revisión 00106).
 *
 * Precedencia: un `false` explícito en CUALQUIERA de las dos apaga Planta
 * (un apagado deliberado nunca lo anula la otra variable ni el valor por
 * defecto). Si ninguna dice `false`, Planta queda activa (por `true`
 * explícito o por defecto). Vacío o no reconocido = no definido.
 *
 * Apagar solo en bases sin `organigrama.org_chart_effective_relations_planta`
 * (p. ej. PG local/MDE).
 */
export function isOrgChartPlantaEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const flags = [
    parseExplicitFlag(env.ORG_CHART_PLANTA_ENABLED),
    parseExplicitFlag(env.ORG_CHART_PLANTA_OVERLAY_ENABLED),
  ];
  return !flags.includes(false);
}
