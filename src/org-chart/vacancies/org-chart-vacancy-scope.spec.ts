import {
  resolveVacancyScope,
  type VacancyScopePlacement,
} from './org-chart-vacancy-scope';

/**
 * Topología sintética con la forma del organigrama real:
 *
 *   1144 Directora (DIR)
 *   ├── 10 Staff de Dirección (DIR)
 *   │   └── 11 Asistente (DIR)
 *   ├── 20 Coordinadora A (área 100)
 *   │   └── 21 Analista A (área 100)
 *   │       └── 22 Auxiliar A (área 999, otra área: sigue siendo de A)
 *   ├── 30 Coordinador B (área 200)
 *   │   └── 31 Líder de escuela B (área 200)
 *   ├── 40 Cabeza C1 (área 300, «PRACTICAS»)
 *   ├── 41 Cabeza C2 (área 301, «Prácticas»: mismo nombre normalizado)
 *   └── 50 Cabeza sin área
 *   60 → 61   (fuera del árbol de la raíz)
 */
const ROOT = '1144';
const DIR = { areaId: '1', areaName: 'DIRECCION GENERAL' };

function p(
  personId: string,
  bossId: string | null,
  areaId: string | null,
  areaName: string,
): VacancyScopePlacement {
  return {
    personId,
    bossId,
    areaId,
    areaName,
    fullName: `Persona ${personId}`,
  };
}

const PLACEMENTS: VacancyScopePlacement[] = [
  p(ROOT, null, DIR.areaId, DIR.areaName),
  p('10', ROOT, DIR.areaId, DIR.areaName),
  p('11', '10', DIR.areaId, DIR.areaName),
  p('20', ROOT, '100', 'ESPECIALIZACIONES'),
  p('21', '20', '100', 'ESPECIALIZACIONES'),
  p('22', '21', '999', 'OTRA AREA'),
  p('30', ROOT, '200', 'OPERACION ACADEMICA'),
  p('31', '30', '200', 'OPERACION ACADEMICA'),
  p('40', ROOT, '300', 'PRACTICAS'),
  p('41', ROOT, '301', 'Prácticas'),
  p('50', ROOT, null, ''),
  p('60', null, '100', 'ESPECIALIZACIONES'),
  p('61', '60', '100', 'ESPECIALIZACIONES'),
];

const scopeOf = (personId: string, placements = PLACEMENTS) =>
  resolveVacancyScope(placements, ROOT, personId);

describe('resolveVacancyScope', () => {
  it('la raíz del mapa recibe el alcance global', () => {
    expect(scopeOf(ROOT)).toEqual({ kind: 'global', personId: ROOT });
  });

  it('una cabeza de coordinación recibe solo el ID de su área', () => {
    expect(scopeOf('20')).toEqual({
      kind: 'coordination',
      personId: '20',
      areaIds: ['100'],
      areaName: 'ESPECIALIZACIONES',
    });
    expect(scopeOf('30')).toMatchObject({
      kind: 'coordination',
      areaIds: ['200'],
    });
  });

  it('dos cabezas con la misma área (por nombre) forman una coordinación con ambas áreas', () => {
    for (const head of ['40', '41']) {
      expect(scopeOf(head)).toMatchObject({
        kind: 'coordination',
        areaIds: ['300', '301'],
      });
    }
  });

  it('una cabeza sin área es coordinación sin áreas asignables', () => {
    expect(scopeOf('50')).toMatchObject({
      kind: 'coordination',
      areaIds: [],
    });
  });

  it('los nodos bajo una coordinación no reciben requisiciones, aunque tengan otra área', () => {
    for (const id of ['21', '22', '31']) {
      expect(scopeOf(id)).toEqual({
        kind: 'none',
        personId: id,
        reason: 'below-coordination',
      });
    }
  });

  it('el staff de la Dirección que no es la raíz no recibe el total global', () => {
    for (const id of ['10', '11']) {
      expect(scopeOf(id)).toMatchObject({
        kind: 'none',
        reason: 'direction-staff',
      });
    }
  });

  it('una persona fuera del árbol de la raíz no hereda coordinación por su área', () => {
    expect(scopeOf('60')).toMatchObject({
      kind: 'none',
      reason: 'outside-tree',
    });
    expect(scopeOf('61')).toMatchObject({ kind: 'none' });
    expect(scopeOf('424242')).toMatchObject({
      kind: 'none',
      reason: 'outside-tree',
    });
  });

  it('si la raíz no está en las ubicaciones, nadie recibe el total global', () => {
    const withoutRoot = PLACEMENTS.filter(
      (x) => x.personId !== ROOT && x.bossId !== ROOT,
    ).concat(p('20', null, '100', 'ESPECIALIZACIONES'));
    expect(scopeOf('20', withoutRoot).kind).not.toBe('global');
    expect(scopeOf('60', withoutRoot).kind).not.toBe('global');
  });

  it('una persona con jefe en la Dirección y en una coordinación es cabeza', () => {
    const multi = [...PLACEMENTS, p('30', '21', '200', 'OPERACION ACADEMICA')];
    expect(scopeOf('30', multi)).toMatchObject({
      kind: 'coordination',
      areaIds: ['200'],
    });
  });
});
