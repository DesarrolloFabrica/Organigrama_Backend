import {
  getOrgChartOverlayVersionIds,
  isOrgChartHierarchyExceptionsApplied,
  isOrgChartPlantaApplied,
} from './org-chart-version-read-plan';

export type VisualRelationSqlSource = {
  from: string;
  versionPredicate: string;
  overlayIds: string[];
};

export type ComposedRelationsCall = {
  /**
   * Llamada a la función de composición (sin alias), o `null` cuando basta la
   * tabla `organigrama.org_visual_relation` filtrada por versión.
   */
  call: string | null;
  /** Overlays del plan. Solo si hay alguno se usa `overlayParam` en el SQL. */
  overlayIds: string[];
};

/**
 * Fuente de aristas del mapa según el plan de lectura:
 * - sin overlays ni Planta → tabla original (`call = null`);
 * - con overlays → `org_chart_effective_relations(global, overlays)`;
 * - con Planta (versión vigente) → `org_chart_effective_relations_planta`,
 *   que compone lo anterior y aplica los overrides de Planta Activa de Orbit
 *   (`core.planta_org_override`): altas y cambios de jefe hechos en Orbit;
 * - con excepciones instaladas → `org_chart_effective_relations_published`:
 *   Planta + excepciones jerárquicas provisionales ACTIVE (ganan a Planta).
 *
 * Precedencia: versión global < overlays de coordinación < Planta < excepción.
 *
 * Sin overlays el array vacío va inline, así los llamadores siguen agregando
 * `overlayParam` solo cuando `overlayIds` no está vacío (`withOverlayQueryParams`).
 * Ambas funciones devuelven solo aristas activas.
 */
export function composedRelationsCall(
  versionParam: string,
  overlayParam: string,
): ComposedRelationsCall {
  const overlayIds = getOrgChartOverlayVersionIds();
  const applyPlanta = isOrgChartPlantaApplied();
  if (overlayIds.length === 0 && !applyPlanta) {
    return { call: null, overlayIds };
  }

  const fn = !applyPlanta
    ? 'organigrama.org_chart_effective_relations'
    : isOrgChartHierarchyExceptionsApplied()
      ? 'organigrama.org_chart_effective_relations_published'
      : 'organigrama.org_chart_effective_relations_planta';
  const overlays =
    overlayIds.length > 0 ? `${overlayParam}::bigint[]` : 'ARRAY[]::bigint[]';
  return { call: `${fn}(${versionParam}, ${overlays})`, overlayIds };
}

/**
 * FROM + predicado de versión para lecturas del mapa.
 * Sin overlays ni Planta: tabla original. Si no: función de composición.
 */
export function visualRelationSqlSource(
  alias: string,
  versionParam: string,
  overlayParam: string,
): VisualRelationSqlSource {
  const { call, overlayIds } = composedRelationsCall(
    versionParam,
    overlayParam,
  );
  if (!call) {
    return {
      from: `organigrama.org_visual_relation ${alias}`,
      versionPredicate: `${alias}.version_id = ${versionParam}`,
      overlayIds,
    };
  }

  return {
    from: `${call} ${alias}`,
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
  const { call, overlayIds } = composedRelationsCall(
    versionParam,
    overlayParam,
  );
  if (!call) {
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
      FROM ${call}
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
