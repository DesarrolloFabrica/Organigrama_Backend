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

/** Placeholders cuyo nombre en Core empieza por «VACANTE» (p. ej. «VACANTE - COORDINADOR …»). */
export function isVacancyDisplayName(
  fullName: string | null | undefined,
): boolean {
  const n = (fullName ?? '').trim().toUpperCase();
  return n.startsWith('VACANTE');
}

/**
 * Fragmento SQL (PostgreSQL) para filtrar filas `core.person` vacantes.
 * Requiere alias `p` (person) y `ro` (role); `$2` = array de roles vacante.
 */
export const VACANCY_PERSON_SQL_WHERE = `
  (
    UPPER(TRIM(COALESCE(ro.name, ''))) = ANY($2::text[])
    OR UPPER(TRIM(COALESCE(p.document, ''))) LIKE 'VAC-%'
    OR UPPER(TRIM(COALESCE(p.full_name, ''))) LIKE 'VACANTE%'
  )
`;

/** Contrato API: `nodeKind` según rol, documento o nombre de plaza. */
export function resolveOrgNodeKindFromRoleName(
  roleName: string | null | undefined,
): OrgNodeKind {
  return isVacancyRoleName(roleName) ? 'vacancy' : 'person';
}

export function resolveOrgNodeKindFromPerson(
  person: Pick<Person, 'document' | 'full_name' | 'role_id'>,
  role: Pick<Role, 'name'> | null | undefined,
): OrgNodeKind {
  if (isVacancyPerson(person, role)) {
    return 'vacancy';
  }
  return 'person';
}

/** `GET /person/:id` y nodos: vacantes no llevan foto institucional. */
export function photoUrlForOrgNodeKind(
  nodeKind: OrgNodeKind,
): string | null | undefined {
  return nodeKind === 'vacancy' ? null : undefined;
}

export function isVacancyPerson(
  person: Pick<Person, 'document' | 'full_name' | 'role_id'>,
  roleOrCatalog: Pick<Role, 'name'> | null | undefined | Map<string, Role>,
): boolean {
  if (person.document?.trim().toUpperCase().startsWith('VAC-')) {
    return true;
  }

  if (isVacancyDisplayName(person.full_name)) {
    return true;
  }

  const role =
    roleOrCatalog instanceof Map
      ? person.role_id
        ? (roleOrCatalog.get(String(person.role_id)) ?? null)
        : null
      : (roleOrCatalog ?? null);

  return isVacancyRoleName(role?.name);
}
