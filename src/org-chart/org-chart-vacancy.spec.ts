import {
  isVacancyRoleName,
  photoUrlForOrgNodeKind,
  resolveOrgNodeKindFromRoleName,
  VACANCY_ROLE_NAMES,
} from './org-chart-vacancy';

describe('org-chart-vacancy', () => {
  it.each(VACANCY_ROLE_NAMES)('acepta rol %s (case-insensitive)', (name) => {
    expect(isVacancyRoleName(name)).toBe(true);
    expect(isVacancyRoleName(name.toLowerCase())).toBe(true);
    expect(isVacancyRoleName(`  ${name}  `)).toBe(true);
  });

  it('rechaza roles que no son vacante', () => {
    expect(isVacancyRoleName('DIRECTOR DE OPERACIONES')).toBe(false);
    expect(isVacancyRoleName(null)).toBe(false);
    expect(isVacancyRoleName('')).toBe(false);
  });

  describe('resolveOrgNodeKindFromRoleName (contrato getPersonDetail / OrgNode)', () => {
    it.each(VACANCY_ROLE_NAMES)(
      'rol %s → nodeKind vacancy',
      (name) => {
        expect(resolveOrgNodeKindFromRoleName(name)).toBe('vacancy');
      },
    );

    it('rol operativo → nodeKind person', () => {
      expect(resolveOrgNodeKindFromRoleName('ANALISTA')).toBe('person');
    });
  });

  describe('photoUrlForOrgNodeKind', () => {
    it('vacancy → photoUrl null', () => {
      expect(photoUrlForOrgNodeKind('vacancy')).toBeNull();
    });

    it('person → photoUrl omitido (undefined)', () => {
      expect(photoUrlForOrgNodeKind('person')).toBeUndefined();
    });
  });
});
