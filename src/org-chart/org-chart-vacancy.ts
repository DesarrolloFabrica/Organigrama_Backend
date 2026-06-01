import type { Person } from '../person/entities/person.entity';
import type { Role } from '../catalogs/entities/role.entity';

/** Nombres de rol en Core que identifican un placeholder de plaza vacante. */
export const VACANCY_ROLE_NAMES = [
  'VACANTE',
  'PLAZA DISPONIBLE',
  'PLAZA VACANTE',
] as const;

/** Valores normalizados (UPPER + trim) para comparación y consultas SQL. */
export const VACANCY_ROLE_NAMES_NORMALIZED: readonly string[] =
  VACANCY_ROLE_NAMES.map((n) => n.toUpperCase());

export type OrgNodeKind = 'person' | 'vacancy';

export function isVacancyRoleName(
  roleName: string | null | undefined,
): boolean {
  if (!roleName?.trim()) {
    return false;
  }
  return VACANCY_ROLE_NAMES_NORMALIZED.includes(roleName.trim().toUpperCase());
}

/** Contrato API: `nodeKind` según nombre de rol (ficha, nodos, búsqueda). */
export function resolveOrgNodeKindFromRoleName(
  roleName: string | null | undefined,
): OrgNodeKind {
  return isVacancyRoleName(roleName) ? 'vacancy' : 'person';
}

/** `GET /person/:id` y nodos: vacantes no llevan foto institucional. */
export function photoUrlForOrgNodeKind(
  nodeKind: OrgNodeKind,
): string | null | undefined {
  return nodeKind === 'vacancy' ? null : undefined;
}

export function isVacancyPerson(
  person: Person,
  roleById: Map<string, Role>,
): boolean {
  const role = person.role_id
    ? (roleById.get(String(person.role_id)) ?? null)
    : null;

  if (person.document?.trim().toUpperCase().startsWith('VAC-')) {
    return true;
  }

  return resolveOrgNodeKindFromRoleName(role?.name) === 'vacancy';
}
