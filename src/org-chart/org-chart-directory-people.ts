/**
 * Resolución por persona de los exportadores del directorio (sin acceso a BD).
 *
 * La consulta devuelve una fila por UBICACIÓN de la persona en el grafo
 * publicado: una por cada jefe efectivo (arista directa o hijo por posición) o
 * una sin jefe si es raíz. Organigrama no tiene relación principal ni regla de
 * precedencia entre jefes de una misma capa (el mapa pinta a la persona bajo
 * cada jefe y la cuenta una vez), así que aquí no se elige ninguno: se
 * conservan todos, ordenados por nombre.
 */

/** Ubicación de una persona bajo un jefe (o como raíz si `bossId` es null). */
export type DirectoryPlacement = {
  personId: string;
  bossId: string | null;
  /** Arista efectiva (id de org_visual_relation, o -person_id si es Planta/excepción). */
  relationId: string | null;
  bossName: string;
  bossEduEmail: string;
  /** `core.person.is_active` del jefe; null si no hay jefe. */
  bossIsActive: boolean | null;
  /** Cargo de `core.person.role_id` (sin overrides). */
  baseRoleName: string;
};

/**
 * Overrides de cargo del plan vigente, resueltos por el mismo servicio que el
 * mapa (`OrgChartService.getRoleNameOverridesForVersion`).
 */
export type RoleNameOverrides = {
  byPerson: ReadonlyMap<string, string>;
  byRelation: ReadonlyMap<string, string>;
};

export type DirectoryBoss = {
  personId: string;
  name: string;
  eduEmail: string;
  isActive: boolean;
};

export type ResolvedDirectoryPerson = {
  personId: string;
  roleName: string;
  /** Jefes efectivos distintos, ordenados por nombre. Vacío si es raíz. */
  bosses: DirectoryBoss[];
};

export const INACTIVE_BOSS_SUFFIX = ' (inactivo)';
export const BOSS_SEPARATOR = ' | ';

/**
 * Cargo de la persona en una ubicación, con la precedencia del mapa
 * (`OrgChartService.buildOrgNode`): override por arista > override por
 * persona (overlay > global) > cargo base.
 */
export function placementRoleName(
  placement: DirectoryPlacement,
  overrides: RoleNameOverrides,
): string {
  if (
    placement.relationId != null &&
    overrides.byRelation.has(placement.relationId)
  ) {
    return overrides.byRelation.get(placement.relationId) ?? '';
  }
  return personRoleName(placement, overrides);
}

function personRoleName(
  placement: DirectoryPlacement,
  overrides: RoleNameOverrides,
): string {
  if (overrides.byPerson.has(placement.personId)) {
    return overrides.byPerson.get(placement.personId) ?? '';
  }
  return placement.baseRoleName;
}

function compareBosses(a: DirectoryBoss, b: DirectoryBoss): number {
  const byName = a.name.localeCompare(b.name, 'es');
  if (byName !== 0) return byName;
  return a.personId.localeCompare(b.personId, 'en', { numeric: true });
}

/**
 * Agrupa las ubicaciones por persona.
 *
 * - Jefes: todos los distintos de las ubicaciones con jefe, por nombre.
 * - Cargo: si todas las ubicaciones dan el mismo cargo, ese; si un override
 *   por arista hace que difieran, el cargo de la persona (override por
 *   persona o base), sin escoger una ubicación sobre otra.
 */
export function resolveDirectoryPeople(
  placements: readonly DirectoryPlacement[],
  overrides: RoleNameOverrides,
): Map<string, ResolvedDirectoryPerson> {
  const byPerson = new Map<string, DirectoryPlacement[]>();
  for (const placement of placements) {
    const list = byPerson.get(placement.personId) ?? [];
    list.push(placement);
    byPerson.set(placement.personId, list);
  }

  const resolved = new Map<string, ResolvedDirectoryPerson>();
  for (const [personId, list] of byPerson) {
    const withBoss = list.filter((p) => p.bossId != null);
    const considered = withBoss.length > 0 ? withBoss : list;

    const roles = new Set(
      considered.map((p) => placementRoleName(p, overrides)),
    );
    const roleName =
      roles.size === 1
        ? [...roles][0]
        : personRoleName(considered[0], overrides);

    const bossesById = new Map<string, DirectoryBoss>();
    for (const placement of withBoss) {
      const bossId = placement.bossId!;
      if (bossesById.has(bossId)) continue;
      bossesById.set(bossId, {
        personId: bossId,
        name: placement.bossName,
        eduEmail: placement.bossEduEmail,
        isActive: placement.bossIsActive !== false,
      });
    }

    resolved.set(personId, {
      personId,
      roleName,
      bosses: [...bossesById.values()].sort(compareBosses),
    });
  }
  return resolved;
}

/** «Jefe» del Excel: nombres por orden, con « (inactivo)» si corresponde. */
export function formatBossNames(bosses: readonly DirectoryBoss[]): string {
  return bosses
    .map((boss) => `${boss.name}${boss.isActive ? '' : INACTIVE_BOSS_SUFFIX}`)
    .join(BOSS_SEPARATOR);
}

/** «Correo del jefe» del Excel: mismo orden que los nombres; omite vacíos. */
export function formatBossEmails(bosses: readonly DirectoryBoss[]): string {
  return bosses
    .map((boss) => boss.eduEmail)
    .filter((email) => email.length > 0)
    .join(BOSS_SEPARATOR);
}
