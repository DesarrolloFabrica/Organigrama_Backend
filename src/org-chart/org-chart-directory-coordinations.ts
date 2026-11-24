/**
 * Agrupación del directorio por DIRECCIÓN y COORDINACIÓN para las pestañas
 * del Excel.
 *
 * Lógica pura (sin base de datos): recibe las ubicaciones (persona → jefe) que
 * ya leyó el exportador en su instantánea REPEATABLE READ, así todas las hojas
 * representan el mismo estado que la «Base general».
 *
 * ## Qué es una coordinación (verificado en producción el 24-nov-2026)
 *
 * El organigrama vigente tiene una DIRECCIÓN en la parte alta del árbol
 * (Director de Operaciones → Coordinador General de Operaciones y su staff,
 * todos del área «DIRECCION GENERAL DE OPERACIONES») y, colgando de ella, las
 * cabezas de cada coordinación. Tres señales independientes coinciden en las
 * mismas cabezas: el árbol efectivo, el área (`core.area`) de cada subárbol y
 * el nivel jerárquico (`core.hierarchy` NIVEL 2). La regla usa las dos
 * primeras, que son estructurales y no dependen del nombre del cargo:
 *
 * 1. Región de Dirección: desde la raíz del mapa, las personas conectadas a
 *    ella por jefes que comparten el ÁREA de la raíz. Forma su propia pestaña,
 *    con el nombre de esa área.
 * 2. Cabeza de coordinación: persona cuyo jefe está en la región de Dirección
 *    y cuya área es distinta de la de la Dirección.
 * 3. Miembros: la cabeza y TODO su subárbol efectivo, en cualquier nivel
 *    (escuelas, equipos de líderes, posiciones), atravesando también a
 *    quienes no salen en el informe (p. ej. docentes) para no perder a sus
 *    subordinados elegibles.
 * 4. Nombre de la hoja: el área oficial de la cabeza (`core.area.name`). Dos
 *    cabezas con la misma área forman UNA sola coordinación (unión de sus
 *    subárboles).
 *
 * Una coordinación nueva (otra cabeza con otra área bajo la Dirección) genera
 * su pestaña en la siguiente descarga, y una que desaparece de la versión
 * activa deja de salir: no hay ninguna lista fija de coordinaciones.
 *
 * ## La jerarquía manda sobre el área del miembro
 *
 * Si alguien registrado con otra área cuelga de una coordinación, sale en la
 * hoja de esa coordinación (la de su jefe efectivo en el mapa) y su columna
 * «Área» muestra su área real. No se reclasifica a nadie por su área. Estos
 * casos se cuentan (`areaMismatchIds`) para revisarlos en el origen: en
 * producción hay uno (Consultorio Jurídico, área PROYECCION SOCIAL, bajo una
 * escuela de Operación Académica).
 *
 * ## Orden dentro de cada hoja
 *
 * Recorrido en profundidad desde la cabeza: en cada nivel van primero las
 * personas sin equipo (staff directo) y después cada líder seguido de todo su
 * equipo; dentro de cada grupo, por nombre. Así cada escuela o equipo queda
 * en un bloque contiguo encabezado por su responsable.
 *
 * ## Duplicados
 *
 * - Dentro de una hoja, cada persona aparece una sola vez aunque llegue por
 *   varios caminos (varios jefes dentro de la misma coordinación).
 * - Una persona con jefes en DOS coordinaciones pertenece legítimamente a
 *   ambas: aparece en las dos hojas (una vez en cada una). En la «Base
 *   general» sigue siendo una sola fila.
 *
 * ## Sin pestaña
 *
 * Quienes no cuelgan de la raíz del mapa (p. ej. bajo un jefe inactivo, o
 * raíces desconectadas) no pertenecen a la Dirección ni a una coordinación:
 * solo figuran en la «Base general». El exportador informa cuántos son en su
 * log (sin datos personales).
 */

import {
  BASE_GENERAL_SHEET_NAME,
  type DirectoryExportRow,
  type DirectoryExportSheet,
} from './org-chart-directory-export.util';

/** Una ubicación efectiva (la misma fila de la consulta del directorio). */
export type CoordinationPlacement = {
  personId: string;
  /** null = raíz (no cuelga de nadie en el grafo efectivo). */
  bossId: string | null;
  /** Área (`core.area.name`) de la persona; '' si no tiene. */
  areaName: string;
  /** Nombre, solo para ordenar hermanos de forma estable. */
  fullName: string;
};

/** Un grupo del organigrama: la Dirección o una coordinación. */
export type DirectoryCoordination = {
  /** Área oficial que da nombre al grupo ('' = sin área). */
  areaName: string;
  /** Responsables: la raíz (Dirección) o las cabezas (coordinación). */
  headIds: string[];
  /**
   * Personas del grupo en orden jerárquico, sin repetidos. Incluye a quienes
   * no son elegibles: el exportador filtra después.
   */
  memberIds: string[];
};

export type DirectoryCoordinationGrouping = {
  /** Región(es) de Dirección (normalmente una). */
  directions: DirectoryCoordination[];
  coordinations: DirectoryCoordination[];
};

/** Clave de comparación de áreas: sin mayúsculas, tildes ni espacios extra. */
export function areaKey(areaName: string | null | undefined): string {
  return (areaName ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Agrupa las ubicaciones efectivas en Dirección y coordinaciones.
 *
 * `rootPersonId` es la raíz del mapa (`ORG_CHART_ROOT_PERSON_ID`): los grupos
 * son los del árbol que pinta el mapa. Si la raíz no está en las ubicaciones
 * (base distinta), se usan las raíces del grafo (`bossId` null) para no dejar
 * el Excel sin pestañas.
 */
export function groupDirectoryByCoordination(
  placements: readonly CoordinationPlacement[],
  rootPersonId: string,
): DirectoryCoordinationGrouping {
  const areaById = new Map<string, string>();
  const nameById = new Map<string, string>();
  const childrenById = new Map<string, Set<string>>();
  const roots = new Set<string>();

  for (const p of placements) {
    if (!areaById.has(p.personId)) {
      areaById.set(p.personId, (p.areaName ?? '').trim());
      nameById.set(p.personId, p.fullName ?? '');
    }
    if (p.bossId == null) {
      roots.add(p.personId);
      continue;
    }
    if (p.bossId === p.personId) continue;
    const kids = childrenById.get(p.bossId) ?? new Set<string>();
    kids.add(p.personId);
    childrenById.set(p.bossId, kids);
  }

  // Solo se recorren personas ACTIVAS con ubicación (las de la consulta): un
  // jefe inactivo no tiene fila propia, así su equipo queda fuera del árbol de
  // la raíz, igual que en el mapa.
  const known = (id: string) => areaById.has(id);
  const childrenOf = (id: string): string[] =>
    [...(childrenById.get(id) ?? [])].filter(known);
  const byName = (a: string, b: string) =>
    (nameById.get(a) ?? '').localeCompare(nameById.get(b) ?? '', 'es');
  /** Hermanos: primero el staff (sin equipo), luego los líderes; cada grupo por nombre. */
  const orderedChildren = (ids: string[]): string[] => {
    const staff = ids.filter((id) => childrenOf(id).length === 0).sort(byName);
    const leaders = ids.filter((id) => childrenOf(id).length > 0).sort(byName);
    return [...staff, ...leaders];
  };

  /** Recorrido en profundidad desde `startId`, limitado por `include`. */
  const walk = (
    startId: string,
    include: (id: string) => boolean,
    seen = new Set<string>(),
  ): string[] => {
    const ordered: string[] = [];
    const visit = (id: string) => {
      if (seen.has(id)) return; // ciclos o varios caminos: una sola vez
      seen.add(id);
      ordered.push(id);
      for (const child of orderedChildren(childrenOf(id).filter(include))) {
        visit(child);
      }
    };
    visit(startId);
    return ordered;
  };

  const startIds = known(rootPersonId)
    ? [rootPersonId]
    : [...roots].filter(known).sort();

  // 1) Región de Dirección: desde la raíz, mientras el área sea la de la raíz.
  // 2) Cabezas: hijos de la Dirección con otra área (en orden de recorrido).
  const directionByArea = new Map<string, DirectoryCoordination>();
  const headOrder: string[] = [];
  const heads = new Set<string>();
  const inDirection = new Set<string>();
  for (const start of startIds) {
    const directionArea = areaKey(areaById.get(start));
    const sameArea = (id: string) =>
      areaKey(areaById.get(id)) === directionArea;
    const members = walk(start, sameArea, inDirection);
    for (const id of members) {
      for (const child of orderedChildren(childrenOf(id))) {
        if (!sameArea(child) && !heads.has(child)) {
          heads.add(child);
          headOrder.push(child);
        }
      }
    }
    const direction = directionByArea.get(directionArea) ?? {
      areaName: areaById.get(start) ?? '',
      headIds: [],
      memberIds: [],
    };
    direction.headIds.push(start);
    direction.memberIds.push(...members);
    directionByArea.set(directionArea, direction);
  }

  // 3) y 4) Una coordinación por área de la cabeza (misma área → se unen).
  const byArea = new Map<string, DirectoryCoordination>();
  for (const headId of headOrder) {
    const areaName = areaById.get(headId) ?? '';
    const key = areaKey(areaName);
    const coordination = byArea.get(key) ?? {
      areaName,
      headIds: [],
      memberIds: [],
    };
    coordination.headIds.push(headId);
    const present = new Set(coordination.memberIds);
    for (const id of walk(headId, () => true)) {
      if (!present.has(id)) {
        present.add(id);
        coordination.memberIds.push(id);
      }
    }
    byArea.set(key, coordination);
  }

  // Coordinaciones en orden alfabético (fácil de encontrar la pestaña).
  const label = (c: DirectoryCoordination) => c.areaName || 'Sin área';
  const coordinations = [...byArea.values()].sort((a, b) =>
    label(a).localeCompare(label(b), 'es'),
  );
  return { directions: [...directionByArea.values()], coordinations };
}

/**
 * Hojas del Excel por Dirección y coordinación, a partir de las filas ya
 * resueltas de la «Base general» (mismas 26 columnas, cargos, jefes y áreas).
 *
 * - Orden de las hojas: Dirección y luego las coordinaciones (alfabético).
 * - Solo personas elegibles (las que están en `rowById`): las reglas de
 *   docentes y vacantes son las mismas que en la «Base general».
 * - Orden de filas: el jerárquico de `memberIds`.
 * - Un grupo sin ninguna persona elegible no genera hoja.
 * - El nombre de la hoja es el área oficial ajustado a las reglas de Excel
 *   (`uniqueSheetNames`); el nombre completo va en el título (fila 1).
 *
 * Devuelve también las personas elegibles que no quedaron en ninguna hoja
 * de grupo (solo están en la «Base general») y las que figuran en una
 * coordinación con un área registrada distinta (para revisar en el origen).
 */
export function buildCoordinationSheets(
  grouping: DirectoryCoordinationGrouping,
  placements: readonly CoordinationPlacement[],
  rowById: ReadonlyMap<string, DirectoryExportRow>,
  versionLabel: string,
): {
  sheets: DirectoryExportSheet[];
  directionSheetCount: number;
  unassignedIds: string[];
  areaMismatchIds: string[];
} {
  const nameById = new Map<string, string>();
  const areaById = new Map<string, string>();
  for (const p of placements) {
    if (!nameById.has(p.personId)) {
      nameById.set(p.personId, p.fullName);
      areaById.set(p.personId, p.areaName);
    }
  }

  const withRows = (groups: DirectoryCoordination[], kind: string) =>
    groups
      .map((group) => ({
        group,
        kind,
        ids: group.memberIds.filter((id) => rowById.has(id)),
      }))
      .filter(({ ids }) => ids.length > 0);
  const directions = withRows(grouping.directions, 'Dirección');
  const coordinations = withRows(grouping.coordinations, 'Coordinación');
  const all = [...directions, ...coordinations];

  const names = uniqueSheetNames(
    [
      BASE_GENERAL_SHEET_NAME,
      ...all.map(({ group, kind }) => group.areaName || kind),
    ],
    'Coordinación',
  ).slice(1);

  const sheets: DirectoryExportSheet[] = all.map(
    ({ group, kind, ids }, index) => {
      const label = group.areaName || `Sin área`;
      const heads = group.headIds
        .map((id) => nameById.get(id) ?? '')
        .filter(Boolean)
        .join(' | ');
      return {
        name: names[index],
        title: `${kind}: ${label} — Responsable: ${heads || 'sin responsable'} — ${versionLabel} — ${ids.length} personas`,
        rows: ids.map((id) => rowById.get(id)!),
        layout: 'coordinacion',
      };
    },
  );

  const assigned = new Set(all.flatMap(({ ids }) => ids));
  const unassignedIds = [...rowById.keys()].filter((id) => !assigned.has(id));
  const areaMismatchIds = coordinations.flatMap(({ group, ids }) =>
    ids.filter((id) => areaKey(areaById.get(id)) !== areaKey(group.areaName)),
  );
  return {
    sheets,
    directionSheetCount: directions.length,
    unassignedIds,
    areaMismatchIds,
  };
}

/** Caracteres que Excel no admite en el nombre de una hoja. */
const INVALID_SHEET_CHARS = /[\\/?*:[\]]/g;
export const EXCEL_SHEET_NAME_MAX = 31;
/** Palabras que se omiten primero si el nombre no cabe en 31 caracteres. */
const SHORTENABLE_WORDS = new Set([
  'DE',
  'DEL',
  'LA',
  'LAS',
  'EL',
  'LOS',
  'Y',
  'E',
  'EN',
  'PARA',
  'POR',
]);

/**
 * Ajusta un nombre largo a 31 caracteres conservando su sentido:
 * 1) quita artículos y preposiciones («DIRECCION GENERAL DE OPERACIONES» →
 *    «DIRECCION GENERAL OPERACIONES»); 2) si no basta, corta en el último
 *    espacio; 3) si no hay espacios, corta a 31.
 */
function fitSheetName(name: string): string {
  if (name.length <= EXCEL_SHEET_NAME_MAX) return name;
  const words = name.split(' ');
  const shortened = words
    .filter(
      (word, index) => index === 0 || !SHORTENABLE_WORDS.has(areaKey(word)),
    )
    .join(' ');
  if (shortened.length <= EXCEL_SHEET_NAME_MAX) return shortened;
  const cut = shortened.slice(0, EXCEL_SHEET_NAME_MAX + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (
    lastSpace > 0 ? cut.slice(0, lastSpace) : cut.slice(0, EXCEL_SHEET_NAME_MAX)
  ).trim();
}

/**
 * Nombres de hoja válidos y únicos para Excel, en el orden recibido:
 * sin `\ / ? * : [ ]`, sin apóstrofo al inicio o al final, no vacíos, de
 * máximo 31 caracteres, distintos sin importar mayúsculas y sin «History»
 * (reservado). Si dos coinciden, se agrega « (2)», « (3)», … recortando antes.
 */
export function uniqueSheetNames(
  wanted: readonly string[],
  fallback = 'Hoja',
): string[] {
  const used = new Set<string>();
  return wanted.map((raw) => {
    let base = (raw ?? '')
      .replace(INVALID_SHEET_CHARS, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^'+|'+$/g, '')
      .trim();
    if (!base) base = fallback;
    if (base.toLowerCase() === 'history') base = `${base} (hoja)`;
    base = fitSheetName(base);

    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      const suffix = ` (${n})`;
      name = `${base.slice(0, EXCEL_SHEET_NAME_MAX - suffix.length).trim()}${suffix}`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}
