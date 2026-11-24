import { COORDINATION_EMBLEM_ASSETS } from './coordination-emblem-assets.generated';
import {
  AREA_COORDINATION_EMBLEMS,
  resolveAreaEmblemKey,
} from './coordination-emblems.config';
import {
  buildCoordinationEmblemCss,
  coordinationEmblemAttribute,
} from './coordination-emblems.styles';
import {
  buildOrgChartHtml,
  type PresentationPerson,
} from '../org-chart-directory-presentation';

/** Las 9 áreas reales del HTML de producción (versión 4) y su icono oficial. */
const EXPECTED: Array<[string, string, string]> = [
  ['DIRECCION GENERAL DE OPERACIONES', 'direccion', 'DirectorOp.png'],
  ['B2B', 'b2b', 'B2B.png'],
  ['ESPECIALIZACIONES', 'especializaciones', 'Especializaciones.png'],
  ['FABRICA Y DESARROLLO', 'fabrica', 'Fabrica.png'],
  ['HOMOLOGACIONES', 'homologaciones', 'Servicio.png'],
  ['OPERACION ACADEMICA', 'operacionAcademica', 'Operación Académica.png'],
  ['PRACTICAS', 'practicas', 'Desarrollo profesional.png'],
  ['PROYECCION SOCIAL', 'proyeccionSocial', 'proyección social.png'],
  ['SABER PRO', 'saberPro', 'Saber Pro .png'],
];

function person(
  id: string,
  bossIds: string[],
  roleName: string,
  areaName: string,
): PresentationPerson {
  return {
    personId: id,
    bossIds,
    inactiveBossNames: [],
    fullName: `Persona Sintética ${id}`,
    document: `9000${id}`,
    roleName,
    areaName,
    photoUrl: '',
  };
}

/** Quita lo que añade la etapa 1 para comparar con el documento anterior. */
function withoutEmblems(html: string): string {
  return html
    .replace(/ data-emblem="[A-Za-z][A-Za-z0-9]*"/g, '')
    .replace(
      /\n {4}\/\* ── Fondos de coordinación[\s\S]*?(?= {2}<\/style>)/,
      '',
    );
}

describe('iconos oficiales de coordinación en el HTML', () => {
  it.each(EXPECTED)('%s → %s (%s)', (area, key, file) => {
    expect(resolveAreaEmblemKey(area)).toBe(key);
    const asset =
      COORDINATION_EMBLEM_ASSETS[
        key as keyof typeof COORDINATION_EMBLEM_ASSETS
      ];
    expect(asset.sourceFile).toBe(
      `src/features/org-chart/assets/coordination-icons/${file}`,
    );
    expect(asset.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('la tabla cubre exactamente las 9 áreas, sin claves de más', () => {
    expect(Object.keys(AREA_COORDINATION_EMBLEMS).sort()).toEqual(
      EXPECTED.map(([area]) => area).sort(),
    );
    expect(Object.keys(COORDINATION_EMBLEM_ASSETS).sort()).toEqual(
      EXPECTED.map(([, key]) => key).sort(),
    );
  });

  it('normaliza tildes, mayúsculas y espacios, pero no adivina por parecido', () => {
    expect(resolveAreaEmblemKey('  Fábrica   y  Desarrollo ')).toBe('fabrica');
    expect(resolveAreaEmblemKey('Operación Académica')).toBe(
      'operacionAcademica',
    );
    expect(resolveAreaEmblemKey('Prácticas')).toBe('practicas');
    expect(resolveAreaEmblemKey('OPERACIONES QA SINTÉTICA')).toBeNull();
    expect(resolveAreaEmblemKey('FABRICA')).toBeNull();
    expect(resolveAreaEmblemKey('Sin área')).toBeNull();
    expect(resolveAreaEmblemKey('')).toBeNull();
    expect(resolveAreaEmblemKey('constructor')).toBeNull();
    expect(resolveAreaEmblemKey('__proto__')).toBeNull();
  });

  it('los recursos son WebP base64 incrustables (sin URL externas ni SVG)', () => {
    for (const asset of Object.values(COORDINATION_EMBLEM_ASSETS)) {
      expect(asset.mimeType).toBe('image/webp');
      expect(asset.base64).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
      const bytes = Buffer.from(asset.base64, 'base64');
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
      expect(bytes.length).toBeLessThan(80 * 1024);
    }
  });

  it('el atributo solo aparece en áreas con icono', () => {
    expect(coordinationEmblemAttribute('B2B')).toBe(' data-emblem="b2b"');
    expect(coordinationEmblemAttribute('OTRA ÁREA')).toBe('');
  });

  it('el CSS incluye una vez cada icono usado y ninguno más', () => {
    const css = buildCoordinationEmblemCss(['B2B', 'b2b', 'SABER PRO', 'X']);
    expect(css.match(/--emblem-image:/g)).toHaveLength(2);
    expect(css).toContain('.area[data-emblem="b2b"]');
    expect(css).toContain('.area[data-emblem="saberPro"]');
    expect(css).not.toContain('data-emblem="fabrica"');
    expect(css).not.toMatch(/https?:\/\//);
    expect(buildCoordinationEmblemCss(['X', 'Sin área'])).toBe('');
  });

  describe('integración en el documento', () => {
    const people = [
      person(
        '1',
        [],
        'DIRECTOR DE OPERACIONES',
        'DIRECCION GENERAL DE OPERACIONES',
      ),
      person(
        '2',
        ['1'],
        'COORDINADOR GENERAL',
        'DIRECCION GENERAL DE OPERACIONES',
      ),
      person('3', ['2'], 'COORDINADOR DE FABRICA', 'FABRICA Y DESARROLLO'),
      person('4', ['3'], 'LIDER DE EQUIPO', 'FABRICA Y DESARROLLO'),
      person('5', ['4'], 'PROFESIONAL', 'FABRICA Y DESARROLLO'),
      person('6', ['2'], 'COORDINADOR DESARROLLO PROFESIONAL', 'PRACTICAS'),
      person('7', ['6'], 'AUXILIAR', 'PRACTICAS'),
      person('8', ['2'], 'COORDINADOR QA', 'AREA SIN ICONO'),
      person('9', ['8'], 'AUXILIAR', 'AREA SIN ICONO'),
    ];
    const html = buildOrgChartHtml(people, 'demo · v1 (activa)');

    it('marca cada sección de área con su icono y deja neutras las demás', () => {
      const sections = [
        ...html.matchAll(
          /<section class="area" id="[^"]+"( data-emblem="([A-Za-z][A-Za-z0-9]*)")?>/g,
        ),
      ].map((m) => m[2] ?? null);
      expect(sections).toEqual(['direccion', 'fabrica', 'practicas', null]);
      expect(html).not.toMatch(/<section class="hero"[^>]*data-emblem/);
    });

    it('incrusta solo los iconos usados, sin JS ni recursos externos nuevos', () => {
      expect(html.match(/--emblem-image:/g)).toHaveLength(3);
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/<link /i);
      expect(html.match(/url\("data:image\/webp;base64,/g)).toHaveLength(3);
    });

    it('sin la decoración, el documento es el mismo: mismas personas y orden', () => {
      const stripped = withoutEmblems(html);
      // El marcado ya no lleva el atributo (el CSS de colores de la etapa 2
      // sí usa el selector [data-emblem], por eso se revisa solo el cuerpo).
      expect(stripped.slice(stripped.indexOf('<body>'))).not.toContain(
        'data-emblem',
      );
      expect(stripped).not.toContain('emblem-image');
      // Sin el CSS de los fondos, el <style> cierra justo tras el resto de reglas.
      expect(stripped).toMatch(/\}\n {2}<\/style>/);
      for (const p of people) {
        expect(stripped).toContain(`>${p.fullName}<`);
      }
      expect(stripped.match(/<article /g)).toHaveLength(
        html.match(/<article /g)!.length,
      );
    });

    it('sin áreas con icono no añade nada al documento', () => {
      const plain = buildOrgChartHtml(
        [
          person('1', [], 'DIRECTOR', 'OTRA'),
          person('2', ['1'], 'AUX', 'OTRA'),
        ],
        'demo',
      );
      expect(plain).not.toContain('data-emblem');
      expect(plain).not.toContain('Fondos de coordinación');
      // Etapa 2: tampoco colores de coordinación (queda el cian institucional).
      // El CSS base sí menciona [data-coord] (regla de retorno al neutro), por
      // eso el atributo se busca solo en el marcado del cuerpo.
      expect(plain.slice(plain.indexOf('<body>'))).not.toContain('data-coord');
      expect(plain).not.toContain('Colores por coordinación');
    });
  });
});
