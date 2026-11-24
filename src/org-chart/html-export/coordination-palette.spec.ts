import { COORDINATION_COLORS } from './coordination-emblems.config';
import {
  ACCENT_MIN_CONTRAST,
  COORDINATION_TONES,
  PALETTE_SURFACE,
  TEXT_MIN_CONTRAST,
  buildCoordinationPaletteCss,
  contrastRatio,
  coordinationColorAttribute,
  hexToRgb,
  liftToContrast,
} from './coordination-palette';
import { DOCUMENT_CSS } from './document.styles';
import {
  buildOrgChartHtml,
  type PresentationPerson,
} from '../org-chart-directory-presentation';

/** Tono HSL (grados) de un color hex. */
function hue(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h =
    max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function hueDistance(a: string, b: string): number {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 360 - d);
}

const PAGE_BG = '#020617';

describe('colores por coordinación', () => {
  const keys = Object.keys(COORDINATION_COLORS) as Array<
    keyof typeof COORDINATION_COLORS
  >;

  it('hay color oficial para las 9 coordinaciones', () => {
    expect(keys).toHaveLength(9);
    for (const key of keys) {
      expect(COORDINATION_COLORS[key].principal).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('el secundario solo existe si su tono difiere ≥ 8° del principal', () => {
    for (const key of keys) {
      const { principal, secundario } = COORDINATION_COLORS[key];
      if (secundario) {
        expect(hueDistance(principal, secundario)).toBeGreaterThanOrEqual(8);
      }
    }
    expect(
      keys.filter((key) => COORDINATION_COLORS[key].secundario).sort(),
    ).toEqual(['practicas', 'proyeccionSocial']);
  });

  it.each(Object.entries(COORDINATION_TONES))(
    '%s: tonos legibles sobre la superficie y el fondo',
    (_key, tones) => {
      for (const against of [PALETTE_SURFACE, PAGE_BG]) {
        expect(contrastRatio(tones.accent, against)).toBeGreaterThanOrEqual(
          ACCENT_MIN_CONTRAST,
        );
        expect(contrastRatio(tones.text, against)).toBeGreaterThanOrEqual(
          TEXT_MIN_CONTRAST,
        );
        expect(contrastRatio(tones.secondary, against)).toBeGreaterThanOrEqual(
          ACCENT_MIN_CONTRAST,
        );
      }
    },
  );

  it.each(Object.entries(COORDINATION_TONES))(
    '%s: los tonos derivados conservan el tono del icono',
    (_key, tones) => {
      expect(hueDistance(tones.accent, tones.official)).toBeLessThan(3);
      expect(hueDistance(tones.text, tones.official)).toBeLessThan(3);
    },
  );

  it('un color oficial que ya es legible se usa sin modificar', () => {
    expect(COORDINATION_TONES.fabrica.accent).toBe('#62c4b7');
    expect(COORDINATION_TONES.saberPro.text).toBe('#88b624');
    expect(liftToContrast('#ffffff', 4.5)).toBe('#ffffff');
  });

  it('el CSS define variables solo para las coordinaciones presentes', () => {
    const css = buildCoordinationPaletteCss([
      'B2B',
      'Fábrica y Desarrollo',
      'X',
    ]);
    expect(css).toContain('[data-emblem="b2b"], [data-coord="b2b"]');
    expect(css).toContain('[data-emblem="fabrica"], [data-coord="fabrica"]');
    expect(css.match(/--c-rgb:/g)).toHaveLength(2);
    expect(css).not.toMatch(/url\(|https?:/);
    expect(buildCoordinationPaletteCss(['X', 'Sin área'])).toBe('');
  });

  it('el atributo data-coord solo sale para áreas con coordinación', () => {
    expect(coordinationColorAttribute('SABER PRO')).toBe(
      ' data-coord="saberPro"',
    );
    expect(coordinationColorAttribute('OTRA')).toBe('');
    expect(coordinationColorAttribute('__proto__')).toBe('');
  });
});

describe('tipografía y espaciado del documento', () => {
  it('ningún texto por debajo de 12 px', () => {
    const sizes = [
      ...DOCUMENT_CSS.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g),
    ].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(10);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  });

  it('un nodo sin coordinación vuelve al color neutro (no hereda el de su jefe)', () => {
    const reset = /\.org-node:not\(\[data-coord\]\)\s*\{([^}]*)\}/.exec(
      DOCUMENT_CSS,
    );
    expect(reset).not.toBeNull();
    for (const variable of [
      '--c-rgb',
      '--c-text',
      '--c2-rgb',
      '--lead-rgb',
      '--lead-text',
    ]) {
      expect(reset![1]).toContain(`${variable}:`);
    }
  });

  it('las tarjetas no tienen alturas fijas que corten nombres o cargos', () => {
    const cardRules = [...DOCUMENT_CSS.matchAll(/\.card[^{]*\{([^}]*)\}/g)].map(
      (m) => m[1],
    );
    expect(cardRules.length).toBeGreaterThan(0);
    for (const rule of cardRules) {
      expect(rule).not.toMatch(/(^|[^-])height\s*:/);
      expect(rule).not.toMatch(/overflow\s*:\s*hidden/);
    }
  });
});

describe('colores en el documento', () => {
  const p = (
    id: string,
    bossIds: string[],
    roleName: string,
    areaName: string,
  ): PresentationPerson => ({
    personId: id,
    bossIds,
    inactiveBossNames: [],
    fullName: `Persona Sintética ${id}`,
    document: `9000${id}`,
    roleName,
    areaName,
    photoUrl: '',
  });
  const people = [
    p('1', [], 'DIRECTOR DE OPERACIONES', 'DIRECCION GENERAL DE OPERACIONES'),
    p('2', ['1'], 'COORDINADOR GENERAL', 'DIRECCION GENERAL DE OPERACIONES'),
    p('3', ['2'], 'COORDINADOR DE FABRICA', 'FABRICA Y DESARROLLO'),
    p('4', ['3'], 'AUXILIAR', 'FABRICA Y DESARROLLO'),
    p('5', ['2'], 'COORDINADOR QA', 'AREA SIN COLOR'),
    p('6', ['5'], 'AUXILIAR', 'AREA SIN COLOR'),
  ];
  const html = buildOrgChartHtml(people, 'demo');

  it('cada nodo de la vista jerárquica lleva el color de su coordinación', () => {
    const hero = html.slice(
      html.indexOf('<section class="hero"'),
      html.indexOf('</section>'),
    );
    const coords = [
      ...hero.matchAll(/<li class="org-node"( data-coord="([A-Za-z0-9]+)")?>/g),
    ].map((m) => m[2] ?? null);
    expect(coords).toEqual(['direccion', 'direccion', 'fabrica', null]);
  });

  it('el menú marca cada enlace de área con su coordinación', () => {
    const nav = html.slice(html.indexOf('<nav>'), html.indexOf('</nav>'));
    expect(nav).toContain('data-coord="direccion"');
    expect(nav).toContain('data-coord="fabrica"');
    expect(nav).not.toMatch(/nav-home"[^>]*data-coord/);
    expect(nav.match(/data-coord=/g)).toHaveLength(2);
  });

  it('sin los atributos de color, el cuerpo del documento no cambia de contenido', () => {
    const body = (h: string) => h.slice(h.indexOf('<body>'));
    const stripped = body(html).replace(/ data-coord="[A-Za-z0-9]+"/g, '');
    expect(stripped).not.toContain('data-coord');
    for (const person of people) {
      expect(stripped).toContain(`>${person.fullName}<`);
    }
    expect(html).not.toMatch(/<script/i);
  });
});
