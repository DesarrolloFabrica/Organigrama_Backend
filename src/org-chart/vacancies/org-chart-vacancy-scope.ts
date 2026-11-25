/**
 * Alcance de las requisiciones de Orbit (`vacancies.vacancy`) para el nodo
 * seleccionado en el panel de resumen.
 *
 * Lógica pura (sin base de datos). Reutiliza EXACTAMENTE el criterio
 * estructural con el que el exportador identifica coordinaciones
 * (`groupDirectoryByCoordination`): raíz del mapa → región de Dirección (misma
 * área que la raíz) → cabezas de coordinación (hijos de la Dirección con otra
 * área). No se usan nombres de cargo ni IDs fijos de coordinación.
 *
 * Decisiones de alcance (requerimiento del 25-nov-2026; la regla de Orbit
 * aún no está verificada, ver el informe de la auditoría):
 *
 * - **Raíz del mapa** → `global`: todas las requisiciones visibles, como el
 *   panel antes de este cambio. Incluye las que no se pueden asociar a ninguna
 *   coordinación (sin `area_id`, con el área de la Dirección o con un área que
 *   no encabeza nadie).
 * - **Cabeza de coordinación** → `coordination`: solo las requisiciones cuyo
 *   `area_id` es el área (`core.area.id`) de la cabeza. Si varias cabezas
 *   comparten el área (el exportador las une en UNA coordinación), cuentan las
 *   áreas de todas. La comparación es por ID; el nombre solo agrupa cabezas,
 *   igual que en el exportador. Escuela y programa no intervienen: una
 *   requisición con área válida aparece aunque su programa no tenga persona.
 * - **Cualquier otro nodo** → `none`: nodos bajo una coordinación, staff de la
 *   Dirección que no es la raíz y personas fuera del árbol de la raíz. Aún no
 *   hay una regla para asignarles requisiciones; el panel omite el bloque en
 *   vez de mostrar un total que no les corresponde. Nunca cae a `global`.
 */

import {
  groupDirectoryByCoordination,
  type CoordinationPlacement,
} from '../org-chart-directory-coordinations';

/** Ubicación efectiva con el ID del área de la persona. */
export type VacancyScopePlacement = CoordinationPlacement & {
  /** `core.person.area_id`; null si la persona no tiene área. */
  areaId: string | null;
};

export type VacancyScope =
  | { kind: 'global'; personId: string }
  | {
      kind: 'coordination';
      personId: string;
      /** Áreas (`core.area.id`) de las cabezas; vacío = nada asignable. */
      areaIds: string[];
      /** Área oficial de la coordinación (solo para mostrar). */
      areaName: string;
    }
  | {
      kind: 'none';
      personId: string;
      reason: 'below-coordination' | 'direction-staff' | 'outside-tree';
    };

export function resolveVacancyScope(
  placements: readonly VacancyScopePlacement[],
  rootPersonId: string,
  personId: string,
): VacancyScope {
  const grouping = groupDirectoryByCoordination(placements, rootPersonId);

  // Global solo para la raíz del mapa. Si la raíz no está en las ubicaciones
  // (base distinta), el agrupador usa las raíces del grafo; ninguna de ellas
  // es la raíz institucional, así que tampoco reciben el total global.
  if (
    personId === rootPersonId &&
    grouping.directions.some((d) => d.headIds.includes(personId))
  ) {
    return { kind: 'global', personId };
  }

  const coordination = grouping.coordinations.find((c) =>
    c.headIds.includes(personId),
  );
  if (coordination) {
    const heads = new Set(coordination.headIds);
    const areaIds = new Set<string>();
    for (const p of placements) {
      if (heads.has(p.personId) && p.areaId) areaIds.add(p.areaId);
    }
    return {
      kind: 'coordination',
      personId,
      areaIds: [...areaIds].sort(),
      areaName: coordination.areaName,
    };
  }

  if (grouping.directions.some((d) => d.memberIds.includes(personId))) {
    return { kind: 'none', personId, reason: 'direction-staff' };
  }
  if (grouping.coordinations.some((c) => c.memberIds.includes(personId))) {
    return { kind: 'none', personId, reason: 'below-coordination' };
  }
  return { kind: 'none', personId, reason: 'outside-tree' };
}
