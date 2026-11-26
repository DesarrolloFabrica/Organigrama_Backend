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
 * - **Jefe de coordinaciones dentro de la Dirección** → `direction`
 *   (requerimiento del 26-nov-2026): una persona de la región de Dirección,
 *   distinta de la raíz, de la que cuelgan cabezas de coordinación (en el
 *   organigrama real, la Coordinación General, padre de las coordinaciones).
 *   Recibe las requisiciones de las coordinaciones que cuelgan de ella (o del
 *   staff de Dirección que cuelga de ella) más las de su propia área. Las que
 *   no se pueden asociar a ningún grupo (sin `area_id` o con un área que no
 *   encabeza nadie) siguen siendo solo de la raíz.
 * - **Cualquier otro nodo** → `none`: nodos bajo una coordinación, staff de la
 *   Dirección sin coordinaciones a cargo y personas fuera del árbol de la
 *   raíz. Aún no hay una regla para asignarles requisiciones; el panel omite
 *   el bloque en vez de mostrar un total que no les corresponde. Nunca cae a
 *   `global`.
 *
 * `buildVacancyAttributionIndex` dice, con el mismo agrupador, a qué grupo
 * (coordinación o Dirección) pertenece el área de cada requisición: el panel
 * lo usa para mostrar el emblema de la coordinación junto a cada vacante.
 */

import {
  groupDirectoryByCoordination,
  type CoordinationPlacement,
  type DirectoryCoordinationGrouping,
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
      kind: 'direction';
      personId: string;
      /** Áreas de las coordinaciones a cargo más la propia; ordenadas. */
      areaIds: string[];
      /** Área de la persona, la de la Dirección (solo para mostrar). */
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
  grouping: DirectoryCoordinationGrouping = groupDirectoryByCoordination(
    placements,
    rootPersonId,
  ),
): VacancyScope {
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

  const direction = grouping.directions.find((d) =>
    d.memberIds.includes(personId),
  );
  if (direction) {
    return (
      resolveDirectedCoordinationsScope(
        placements,
        grouping,
        direction.memberIds,
        personId,
      ) ?? { kind: 'none', personId, reason: 'direction-staff' }
    );
  }
  if (grouping.coordinations.some((c) => c.memberIds.includes(personId))) {
    return { kind: 'none', personId, reason: 'below-coordination' };
  }
  return { kind: 'none', personId, reason: 'outside-tree' };
}

/** Primer `area_id` de cada persona y todos sus jefes en el grafo efectivo. */
function indexPlacements(placements: readonly VacancyScopePlacement[]) {
  const areaOf = new Map<string, string | null>();
  const areaNameOf = new Map<string, string>();
  const bossesOf = new Map<string, Set<string>>();
  for (const p of placements) {
    if (!areaOf.has(p.personId)) {
      areaOf.set(p.personId, p.areaId);
      areaNameOf.set(p.personId, p.areaName);
    }
    if (p.bossId == null || p.bossId === p.personId) continue;
    const bosses = bossesOf.get(p.personId) ?? new Set<string>();
    bosses.add(p.bossId);
    bossesOf.set(p.personId, bosses);
  }
  return { areaOf, areaNameOf, bossesOf };
}

/**
 * Alcance `direction` de un miembro de la Dirección (no la raíz) del que
 * depende alguna cabeza de coordinación, directamente o a través de staff de
 * Dirección que cuelga de él. `null` si no tiene coordinaciones a cargo.
 */
function resolveDirectedCoordinationsScope(
  placements: readonly VacancyScopePlacement[],
  grouping: DirectoryCoordinationGrouping,
  directionMemberIds: readonly string[],
  personId: string,
): VacancyScope | null {
  const { areaOf, areaNameOf, bossesOf } = indexPlacements(placements);
  const directionMembers = new Set(directionMemberIds);

  // Miembros de la Dirección bajo `personId` (incluido), sin salir de ella.
  const below = new Set<string>([personId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const member of directionMembers) {
      if (below.has(member)) continue;
      const bosses = bossesOf.get(member);
      if (bosses && [...bosses].some((b) => below.has(b))) {
        below.add(member);
        grew = true;
      }
    }
  }

  const directed = grouping.coordinations.filter((c) =>
    c.headIds.some((h) =>
      [...(bossesOf.get(h) ?? [])].some((b) => below.has(b)),
    ),
  );
  if (directed.length === 0) return null;

  const areaIds = new Set<string>();
  const ownArea = areaOf.get(personId);
  if (ownArea) areaIds.add(ownArea);
  for (const c of directed) {
    for (const h of c.headIds) {
      const area = areaOf.get(h);
      if (area) areaIds.add(area);
    }
  }
  return {
    kind: 'direction',
    personId,
    areaIds: [...areaIds].sort(),
    areaName: areaNameOf.get(personId) ?? '',
  };
}

/** Grupo al que pertenece el área de una requisición. */
export type VacancyAttribution = {
  kind: 'coordination' | 'direction';
  /** Área oficial del grupo. */
  areaName: string;
  /** Cabezas de la coordinación, o raíz de la Dirección. */
  headPersonIds: string[];
};

/**
 * Índice `area_id` → grupo, con el mismo agrupador del alcance. Un `area_id`
 * que ninguna cabeza tiene (o nulo) no está en el índice: esa requisición no
 * se puede asociar a ningún grupo.
 */
export function buildVacancyAttributionIndex(
  placements: readonly VacancyScopePlacement[],
  grouping: DirectoryCoordinationGrouping,
): Map<string, VacancyAttribution> {
  const { areaOf } = indexPlacements(placements);
  const index = new Map<string, VacancyAttribution>();
  const add = (
    kind: VacancyAttribution['kind'],
    group: { areaName: string; headIds: string[] },
  ) => {
    for (const headId of group.headIds) {
      const area = areaOf.get(headId);
      // Otro grupo con la misma área: se conserva el primero (las
      // coordinaciones se registran antes que la Dirección).
      if (!area || index.has(area)) continue;
      index.set(area, {
        kind,
        areaName: group.areaName,
        headPersonIds: [...group.headIds],
      });
    }
  };
  for (const c of grouping.coordinations) add('coordination', c);
  for (const d of grouping.directions) add('direction', d);
  return index;
}
