import type { Repository } from 'typeorm';
import { Role } from '../catalogs/entities/role.entity';
import { Person } from '../person/entities/person.entity';

export type FindPeopleByRoleOptions = {
  match: 'exact' | 'ilike';
  /** Si se informa, filtra `LOWER(p.edu_email) IN (...)`. */
  eduEmails?: string[];
};

/**
 * Personas activas cuyo rol en Core coincide con el criterio indicado.
 * Join `person` + `role`, orden estable por `person.id`.
 */
export async function findActivePeopleByRoleName(
  persons: Repository<Person>,
  roleName: string,
  options: FindPeopleByRoleOptions,
): Promise<Person[]> {
  const qb = persons
    .createQueryBuilder('p')
    .innerJoin(Role, 'r', 'r.id = p.role_id')
    .where('p.is_active = :active', { active: true });

  if (options.match === 'exact') {
    qb.andWhere('r.name = :roleName', { roleName });
  } else {
    qb.andWhere('r.name ILIKE :pattern', {
      pattern: `%${roleName}%`,
    });
  }

  if (options.eduEmails?.length) {
    qb.andWhere('LOWER(p.edu_email) IN (:...emails)', {
      emails: options.eduEmails.map((e) => e.toLowerCase()),
    });
  }

  return qb.orderBy('p.id', 'ASC').getMany();
}
