/** Mensaje cuando los endpoints legacy están desactivados (`ORG_CHART_LEGACY_ENABLED=false`). */
export const LEGACY_ORG_CHART_DISABLED_MESSAGE =
  'Legacy org chart endpoint is disabled. Use /api/org-chart/root, /api/org-chart/node/:id and /api/org-chart/children/:id instead.';

/**
 * `ORG_CHART_LEGACY_ENABLED` ausente o vacío → `true` (legacy disponible).
 * Solo `false` (cualquier capitalización) desactiva los endpoints legacy.
 */
export function isOrgChartLegacyEnabled(): boolean {
  const raw = process.env.ORG_CHART_LEGACY_ENABLED;
  if (raw === undefined || raw.trim() === '') {
    return true;
  }
  return raw.trim().toLowerCase() !== 'false';
}
