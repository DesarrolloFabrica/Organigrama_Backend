import { getOrgChartOverlayVersionIds } from './org-chart-version-read-plan';

export type VisualRelationSqlSource = {
  from: string;
  versionPredicate: string;
  overlayIds: string[];
};

/**
 * FROM + predicado de versión para lecturas del mapa.
 * Sin overlays: tabla original. Con overlays: función de composición.
 */
export function visualRelationSqlSource(
  alias: string,
  versionParam: string,
  overlayParam: string,
): VisualRelationSqlSource {
  const overlayIds = getOrgChartOverlayVersionIds();
  if (overlayIds.length === 0) {
    return {
      from: `organigrama.org_visual_relation ${alias}`,
      versionPredicate: `${alias}.version_id = ${versionParam}`,
      overlayIds,
    };
  }

  return {
    from: `organigrama.org_chart_effective_relations(${versionParam}, ${overlayParam}::bigint[]) ${alias}`,
    versionPredicate: 'TRUE',
    overlayIds,
  };
}

/**
 * CTE `effective` con las aristas del mapa ya compuesto.
 * Usar como primer elemento de `WITH RECURSIVE`.
 */
export function effectiveRelationsCte(
  versionParam: string,
  overlayParam: string,
): { sql: string; overlayIds: string[] } {
  const overlayIds = getOrgChartOverlayVersionIds();
  if (overlayIds.length === 0) {
    return {
      sql: `effective AS (
        SELECT *
        FROM organigrama.org_visual_relation
        WHERE version_id = ${versionParam}
          AND is_active = true
      )`,
      overlayIds,
    };
  }

  return {
    sql: `effective AS (
      SELECT *
      FROM organigrama.org_chart_effective_relations(${versionParam}, ${overlayParam}::bigint[])
    )`,
    overlayIds,
  };
}

export function withOverlayQueryParams(
  params: unknown[],
  overlayIds: string[],
): unknown[] {
  if (overlayIds.length === 0) return params;
  return [...params, overlayIds];
}
