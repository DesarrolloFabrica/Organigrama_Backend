import {
  formatBossEmails,
  formatBossNames,
  placementRoleName,
  resolveDirectoryPeople,
  type DirectoryPlacement,
  type RoleNameOverrides,
} from './org-chart-directory-people';

/** Todos los datos son sintéticos. */
function placement(
  personId: string,
  bossId: string | null,
  extra: Partial<DirectoryPlacement> = {},
): DirectoryPlacement {
  return {
    personId,
    bossId,
    relationId: bossId ? `${personId}${bossId}` : null,
    bossName: bossId ? `Jefe ${bossId}` : '',
    bossEduEmail: bossId ? `jefe${bossId}@example.test` : '',
    bossIsActive: bossId ? true : null,
    baseRoleName: 'CARGO BASE',
    ...extra,
  };
}

const none: RoleNameOverrides = { byPerson: new Map(), byRelation: new Map() };

describe('resolveDirectoryPeople', () => {
  describe('cargo con la precedencia del mapa', () => {
    it('sin overrides usa el cargo base', () => {
      expect(placementRoleName(placement('1', '9'), none)).toBe('CARGO BASE');
    });

    it('override por persona (overlay > global, ya resuelto por OrgChartService) gana al base', () => {
      const overrides: RoleNameOverrides = {
        byPerson: new Map([['1', 'CARGO OVERLAY']]),
        byRelation: new Map(),
      };
      expect(placementRoleName(placement('1', '9'), overrides)).toBe(
        'CARGO OVERLAY',
      );
    });

    it('override por arista gana al de persona', () => {
      const overrides: RoleNameOverrides = {
        byPerson: new Map([['1', 'CARGO PERSONA']]),
        byRelation: new Map([['19', 'CARGO ARISTA']]),
      };
      expect(placementRoleName(placement('1', '9'), overrides)).toBe(
        'CARGO ARISTA',
      );
    });

    it('un override a un cargo inexistente deja el cargo vacío (como el mapa)', () => {
      const overrides: RoleNameOverrides = {
        byPerson: new Map([['1', '']]),
        byRelation: new Map(),
      };
      expect(placementRoleName(placement('1', '9'), overrides)).toBe('');
    });
  });

  describe('varios jefes', () => {
    it('conserva todos los jefes, ordenados por nombre, sin elegir uno', () => {
      const resolved = resolveDirectoryPeople(
        [
          placement('1', '30', { bossName: 'Zoila Sintética' }),
          placement('1', '20', { bossName: 'Ana Sintética' }),
          placement('1', '25', { bossName: 'Ángela Sintética' }),
        ],
        none,
      ).get('1')!;
      expect(resolved.bosses.map((b) => b.name)).toEqual([
        'Ana Sintética',
        'Ángela Sintética',
        'Zoila Sintética',
      ]);
      expect(formatBossNames(resolved.bosses)).toBe(
        'Ana Sintética | Ángela Sintética | Zoila Sintética',
      );
      expect(formatBossEmails(resolved.bosses)).toBe(
        'jefe20@example.test | jefe25@example.test | jefe30@example.test',
      );
    });

    it('una persona = una entrada, aunque tenga varias ubicaciones', () => {
      const resolved = resolveDirectoryPeople(
        [placement('1', '20'), placement('1', '30'), placement('2', '1')],
        none,
      );
      expect([...resolved.keys()]).toEqual(['1', '2']);
    });

    it('jefe repetido (arista y posición) cuenta una vez', () => {
      const resolved = resolveDirectoryPeople(
        [placement('1', '20'), placement('1', '20', { relationId: null })],
        none,
      ).get('1')!;
      expect(resolved.bosses).toHaveLength(1);
    });

    it('si las ubicaciones dan cargos distintos usa el cargo de la persona', () => {
      const overrides: RoleNameOverrides = {
        byPerson: new Map(),
        byRelation: new Map([['120', 'CARGO EN POSICIÓN A']]),
      };
      const resolved = resolveDirectoryPeople(
        [placement('1', '20'), placement('1', '30')],
        overrides,
      ).get('1')!;
      expect(resolved.roleName).toBe('CARGO BASE');
    });

    it('si todas las ubicaciones coinciden usa ese cargo', () => {
      const overrides: RoleNameOverrides = {
        byPerson: new Map(),
        byRelation: new Map([
          ['120', 'COORDINADOR'],
          ['130', 'COORDINADOR'],
        ]),
      };
      const resolved = resolveDirectoryPeople(
        [placement('1', '20'), placement('1', '30')],
        overrides,
      ).get('1')!;
      expect(resolved.roleName).toBe('COORDINADOR');
    });

    it('la fila de raíz no cuenta si la persona tiene algún jefe', () => {
      const resolved = resolveDirectoryPeople(
        [placement('1', null), placement('1', '20')],
        none,
      ).get('1')!;
      expect(resolved.bosses.map((b) => b.personId)).toEqual(['20']);
    });

    it('raíz sin jefe: lista vacía', () => {
      const resolved = resolveDirectoryPeople([placement('1', null)], none).get(
        '1',
      )!;
      expect(resolved.bosses).toEqual([]);
      expect(formatBossNames(resolved.bosses)).toBe('');
    });
  });

  describe('jefe inactivo', () => {
    it('conserva la relación y marca «(inactivo)»', () => {
      const resolved = resolveDirectoryPeople(
        [
          placement('1', '20', {
            bossName: 'Jefa Retirada',
            bossIsActive: false,
          }),
        ],
        none,
      ).get('1')!;
      expect(resolved.bosses).toEqual([
        expect.objectContaining({ personId: '20', isActive: false }),
      ]);
      expect(formatBossNames(resolved.bosses)).toBe('Jefa Retirada (inactivo)');
      expect(formatBossEmails(resolved.bosses)).toBe('jefe20@example.test');
    });

    it('con un jefe activo y otro inactivo marca solo el inactivo', () => {
      const resolved = resolveDirectoryPeople(
        [
          placement('1', '20', { bossName: 'Beatriz Activa' }),
          placement('1', '30', {
            bossName: 'Alberto Retirado',
            bossIsActive: false,
          }),
        ],
        none,
      ).get('1')!;
      expect(formatBossNames(resolved.bosses)).toBe(
        'Alberto Retirado (inactivo) | Beatriz Activa',
      );
    });

    it('omite correos vacíos manteniendo el orden', () => {
      const resolved = resolveDirectoryPeople(
        [
          placement('1', '20', { bossName: 'A', bossEduEmail: '' }),
          placement('1', '30', { bossName: 'B' }),
        ],
        none,
      ).get('1')!;
      expect(formatBossEmails(resolved.bosses)).toBe('jefe30@example.test');
    });
  });
});
