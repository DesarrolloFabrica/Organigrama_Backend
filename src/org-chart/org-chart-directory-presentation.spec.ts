import {
  buildOrgChartHtml,
  buildPresentationForest,
  type PresentationPerson,
} from './org-chart-directory-presentation';

const people: PresentationPerson[] = [
  {
    personId: '1',
    bossId: '',
    fullName: 'Directora Sintética',
    document: '50',
    roleName: 'DIRECTOR DE OPERACIONES',
    areaName: 'DIRECCION GENERAL DE OPERACIONES',
    photoUrl: 'https://example.com/iron.jpg',
  },
  {
    personId: '2',
    bossId: '1',
    fullName: 'Coordinador Sintético',
    document: '100',
    roleName: 'COORDINADOR GENERAL',
    areaName: 'DIRECCION GENERAL DE OPERACIONES',
    photoUrl: 'https://example.com/raul.jpg',
  },
  {
    personId: '3',
    bossId: '2',
    fullName: 'Coordinadora Fábrica Sintética',
    document: '200',
    roleName: 'COORDINADOR DE FABRICA',
    areaName: 'Fábrica',
    photoUrl: 'javascript:alert(1)',
  },
  {
    personId: '4',
    bossId: '2',
    fullName: 'Analista Sintética',
    document: '300',
    roleName: 'ANALISTA OPERATIVO',
    areaName: 'DIRECCION GENERAL DE OPERACIONES',
    photoUrl: 'https://example.com/sara.jpg',
  },
  {
    personId: '5',
    bossId: '3',
    fullName: 'Colaborador Uno',
    document: '400',
    roleName: 'ANALISTA DE DISEÑO',
    areaName: 'Fábrica',
    photoUrl: 'https://example.com/colab.jpg',
  },
];

describe('org chart presentation', () => {
  it('arma la vista jerárquica solo con anclas y conteos', () => {
    const forest = buildPresentationForest(people);
    expect(forest).toHaveLength(1);
    expect(forest[0].fullName).toBe('Directora Sintética');
    expect(forest[0].children[0].fullName).toBe('Coordinador Sintético');
    const html = buildOrgChartHtml(people, 'v-current (activa)');
    expect(html).toContain('https://example.com/iron.jpg');
    expect(html).toContain('https://example.com/raul.jpg');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('Coordinadora Fábrica Sintética');
    expect(html).toContain('Analista Sintética');
    expect(html).toContain('Vista jerárquica');
    expect(html).toContain('colaboradores a cargo');
    expect(html).toContain('Por área');
    expect(html).toContain('Por rol');
    expect(html).toContain('href="#org-root');
    expect(html).toContain('href="#area-');
    expect(html).toContain('Cédula 100');
    const hierarchyEnd = html.indexOf('id="area-');
    const hierarchy = html.slice(0, hierarchyEnd);
    expect(hierarchy).toContain('Coordinadora Fábrica Sintética');
    expect(hierarchy).toContain('Analista Sintética');
    expect(hierarchy).not.toContain('Colaborador Uno');
    expect(html).toContain('Colaborador Uno');
  });
});
