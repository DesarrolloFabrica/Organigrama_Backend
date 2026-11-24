import {
  INACTIVE_BOSS_SECTION_ID,
  buildOrgChartHtml,
  buildPresentationForest,
  type PresentationPerson,
} from './org-chart-directory-presentation';

/** Todos los datos son sintéticos. */
function person(
  personId: string,
  bossIds: string[],
  fullName: string,
  roleName: string,
  areaName: string,
  extra: Partial<PresentationPerson> = {},
): PresentationPerson {
  return {
    personId,
    bossIds,
    inactiveBossNames: [],
    fullName,
    document: `${personId}00`,
    roleName,
    areaName,
    photoUrl: '',
    ...extra,
  };
}

const people: PresentationPerson[] = [
  person(
    '1',
    [],
    'Directora Sintética',
    'DIRECTOR DE OPERACIONES',
    'DIRECCION GENERAL DE OPERACIONES',
    {
      document: '50',
      photoUrl: 'https://example.com/iron.jpg',
    },
  ),
  person(
    '2',
    ['1'],
    'Coordinador Sintético',
    'COORDINADOR GENERAL',
    'DIRECCION GENERAL DE OPERACIONES',
    {
      document: '100',
      photoUrl: 'https://example.com/raul.jpg',
    },
  ),
  person(
    '3',
    ['2'],
    'Coordinadora Fábrica Sintética',
    'COORDINADOR DE FABRICA',
    'Fábrica',
    {
      document: '200',
      photoUrl: 'javascript:alert(1)',
    },
  ),
  person(
    '4',
    ['2'],
    'Analista Sintética',
    'ANALISTA OPERATIVO',
    'DIRECCION GENERAL DE OPERACIONES',
    {
      document: '300',
      photoUrl: 'https://example.com/sara.jpg',
    },
  ),
  person('5', ['3'], 'Colaborador Uno', 'ANALISTA DE DISEÑO', 'Fábrica', {
    document: '400',
    photoUrl: 'https://example.com/colab.jpg',
  }),
];

/** Sección de la vista jerárquica (antes de la primera área). */
function hierarchyOf(html: string): string {
  return html.slice(0, html.indexOf('id="area-'));
}

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
    const hierarchy = hierarchyOf(html);
    expect(hierarchy).toContain('Coordinadora Fábrica Sintética');
    expect(hierarchy).toContain('Analista Sintética');
    expect(hierarchy).not.toContain('Colaborador Uno');
    expect(html).toContain('Colaborador Uno');
    // Sin jefes inactivos no hay sección ni enlace.
    expect(html).not.toContain(INACTIVE_BOSS_SECTION_ID);
  });

  describe('persona con varios jefes', () => {
    // 3 (coordinadora, nivel 2) tiene dos líderes; la persona 9 depende de ambos.
    const multi: PresentationPerson[] = [
      ...people.filter((p) => p.personId !== '5'),
      person('7', ['3'], 'Líder Sintético A', 'LIDER DE EQUIPO', 'Fábrica'),
      person('8', ['3'], 'Líder Sintético B', 'LIDER DE EQUIPO', 'Fábrica'),
      person(
        '9',
        ['8', '7'],
        'Persona Dos Jefes',
        'ANALISTA DE DISEÑO',
        'Fábrica',
      ),
    ];

    it('la pinta bajo cada jefe, como el mapa', () => {
      const forest = buildPresentationForest(multi);
      const coordinadora = forest[0].children[0].children.find(
        (n) => n.personId === '3',
      )!;
      const underA = coordinadora.children.find((n) => n.personId === '7')!;
      const underB = coordinadora.children.find((n) => n.personId === '8')!;
      expect(underA.children.map((n) => n.personId)).toEqual(['9']);
      expect(underB.children.map((n) => n.personId)).toEqual(['9']);
    });

    it('la cuenta una sola vez en los totales', () => {
      const html = buildOrgChartHtml(multi, 'v (activa)');
      // Bajo la coordinadora: 7, 8 y 9 → 3 (no 4, aunque 9 aparece dos veces).
      expect(hierarchyOf(html)).toContain(
        '<strong>3</strong> colaboradores a cargo',
      );
      expect(hierarchyOf(html)).not.toContain(
        '<strong>4</strong> colaboradores a cargo',
      );
      // Total del documento y del área Fábrica: personas distintas.
      expect(html).toContain(`${multi.length} personas</p>`);
      expect(html).toContain('Área · 4 personas');
    });

    it('ignora jefes repetidos o que no están en el informe', () => {
      const forest = buildPresentationForest([
        person('1', [], 'Raíz', 'DIRECTOR', 'A'),
        person('2', ['1', '1', '404'], 'Hija', 'ANALISTA', 'A'),
      ]);
      expect(forest).toHaveLength(1);
      expect(forest[0].children.map((n) => n.personId)).toEqual(['2']);
    });
  });

  describe('jefe registrado inactivo', () => {
    const withInactive: PresentationPerson[] = [
      ...people,
      person(
        '10',
        ['99'],
        'Persona Jefe Inactivo',
        'ANALISTA DE SOPORTE',
        'Soporte',
        {
          inactiveBossNames: ['Jefa Inactiva Sintética'],
        },
      ),
      person('11', ['10'], 'Equipo De Persona Diez', 'AUXILIAR', 'Soporte'),
    ];

    it('no la mezcla con la Dirección: va a su sección con su equipo', () => {
      const html = buildOrgChartHtml(withInactive, 'v (activa)');
      expect(hierarchyOf(html)).not.toContain('Persona Jefe Inactivo');

      const start = html.indexOf(`id="${INACTIVE_BOSS_SECTION_ID}"`);
      expect(start).toBeGreaterThan(0);
      const section = html.slice(start);
      expect(section).toContain('Jefe registrado inactivo');
      expect(section).toContain('Persona Jefe Inactivo');
      expect(section).toContain(
        'Jefe registrado: Jefa Inactiva Sintética (inactivo)',
      );
      expect(section).toContain('<strong>1</strong> colaboradores a cargo');
      expect(html).toContain(`href="#${INACTIVE_BOSS_SECTION_ID}"`);
    });

    it('se conserva en su área y en el total', () => {
      const html = buildOrgChartHtml(withInactive, 'v (activa)');
      const areaStart = html.indexOf('<h2>Soporte</h2>');
      expect(areaStart).toBeGreaterThan(0);
      expect(html.slice(areaStart)).toContain('Persona Jefe Inactivo');
      expect(html).toContain(`${withInactive.length} personas</p>`);
    });

    it('si además tiene un jefe activo en el informe, se queda bajo ese jefe', () => {
      const both = [
        ...people,
        person(
          '12',
          ['2', '99'],
          'Persona Mixta',
          'ANALISTA',
          'DIRECCION GENERAL DE OPERACIONES',
          {
            inactiveBossNames: ['Jefa Inactiva Sintética'],
          },
        ),
      ];
      const html = buildOrgChartHtml(both, 'v (activa)');
      expect(html).not.toContain(`id="${INACTIVE_BOSS_SECTION_ID}"`);
    });
  });
});
