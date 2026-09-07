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
  /** Clave de cache: global + overlays seleccionados. */
  cacheKey: string;
};

const als = new AsyncLocalStorage<OrgChartVersionReadPlan>();

export function buildOrgChartVersionReadPlanCacheKey(
  globalVersionId: string,
  overlayVersionIds: string[],
): string {
  const overlayPart =
    overlayVersionIds.length > 0 ? overlayVersionIds.join(',') : 'none';
  return `g${globalVersionId}|o${overlayPart}`;
}

export function runWithOrgChartVersionReadPlan<T>(
  plan: OrgChartVersionReadPlan,
  fn: () => Promise<T> | T,
): Promise<T> | T {
  return als.run(plan, fn);
}

export function getOrgChartVersionReadPlan(): OrgChartVersionReadPlan | undefined {
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
