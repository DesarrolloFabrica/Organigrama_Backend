import { selectForestRootIds } from './org-chart-forest-roots';

describe('selectForestRootIds', () => {
  it('ignora el bucle de una persona consigo misma y deja su árbol como raíz', () => {
    expect(
      selectForestRootIds([
        { parentId: '49', childId: '49' },
        { parentId: '49', childId: '1777' },
        { parentId: '49', childId: '2' },
        { parentId: '1777', childId: '1180' },
        { parentId: '2', childId: '5' },
      ]),
    ).toEqual(['49']);
  });

  it('no marca como raíz a quien ya cuelga de otra persona', () => {
    expect(
      selectForestRootIds([
        { parentId: '1144', childId: '1082' },
        { parentId: '1082', childId: '49' },
        { parentId: '49', childId: '2' },
      ]),
    ).toEqual(['1144']);
  });

  it('devuelve vacío si no hay equipos reales', () => {
    expect(
      selectForestRootIds([{ parentId: '49', childId: '49' }]),
    ).toEqual([]);
  });
});
