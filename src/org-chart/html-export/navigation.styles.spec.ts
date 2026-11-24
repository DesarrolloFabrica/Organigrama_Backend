import { NAVIGATION_BASE_CSS, buildNavigationCss } from './navigation.styles';
import { DOCUMENT_CSS } from './document.styles';
import {
  buildOrgChartHtml,
  type PresentationPerson,
} from '../org-chart-directory-presentation';

/** Bloques `selector { declaraciones }` de un CSS plano. */
function rules(css: string): Array<{ selector: string; body: string }> {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(),
    body: m[2],
  }));
}

describe('menú lateral (etapa 2.1)', () => {
  it('en reposo no usa el color de la coordinación (salvo el contorno de foco)', () => {
    const base = rules(NAVIGATION_BASE_CSS).filter(
      (r) => !r.selector.includes(':focus-visible'),
    );
    expect(base.length).toBeGreaterThan(3);
    for (const rule of base) {
      expect(rule.body).not.toContain('--c-rgb');
      expect(rule.body).not.toContain('--c-text');
    }
  });

  it('se ilumina con el color de su coordinación al pasar, enfocar o pulsar', () => {
    const css = buildNavigationCss([]);
    const lit = rules(css).find(
      (r) => r.selector === 'nav a:hover, nav a:focus-visible, nav a:active',
    );
    expect(lit?.body).toContain('rgb(var(--c-rgb))');
    expect(css).toContain(
      'nav a:hover::before, nav a:focus-visible::before, nav a:active::before',
    );
    expect(css).toContain('color: var(--c-text)');
  });

  it('marca la opción seleccionada con :target, en reglas separadas de hover', () => {
    const css = buildNavigationCss(['org-root', 'area-0-b2b', 'area-0-b2b']);
    const selected = rules(css).filter((r) => r.selector.includes(':has('));
    // 2 anclas distintas × (enlace, LED, contador).
    expect(selected).toHaveLength(6);
    for (const rule of selected) {
      expect(rule.selector).not.toContain(':hover');
    }
    expect(css).toContain(
      'body:has(#area-0-b2b:target) nav a[href="#area-0-b2b"]',
    );
  });

  it('descarta anclas que no son seguras para un selector', () => {
    const css = buildNavigationCss(['ok-1', 'x"]{}', '#x', 'Mayus']);
    expect(css).toContain('#ok-1:target');
    expect(css).not.toContain('x"]');
    expect(css).not.toContain('Mayus');
    expect(css).not.toContain('##x');
  });

  it('sin animaciones ni transiciones', () => {
    for (const css of [buildNavigationCss(['a']), DOCUMENT_CSS]) {
      expect(css).not.toMatch(/@keyframes|animation\s*:|transition\s*:/);
    }
  });

  it('el documento genera el estado seleccionado para cada enlace del menú', () => {
    const p = (
      id: string,
      bossIds: string[],
      area: string,
    ): PresentationPerson => ({
      personId: id,
      bossIds,
      inactiveBossNames: [],
      fullName: `Persona Sintética ${id}`,
      document: `9000${id}`,
      roleName: id === '1' ? 'DIRECTOR' : 'AUXILIAR',
      areaName: area,
      photoUrl: '',
    });
    const html = buildOrgChartHtml(
      [p('1', [], 'B2B'), p('2', ['1'], 'B2B'), p('3', ['1'], 'SABER PRO')],
      'demo',
    );
    const hrefs = [...html.matchAll(/<a [^>]*href="#([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(hrefs.length).toBe(3);
    for (const anchor of hrefs) {
      expect(html).toContain(
        `body:has(#${anchor}:target) nav a[href="#${anchor}"]`,
      );
    }
  });
});

describe('vista jerárquica (etapa 2.1)', () => {
  it('tiene fondo propio detrás del contenido', () => {
    const hero = rules(DOCUMENT_CSS);
    const before = hero.find((r) => r.selector === '.hero::before');
    const after = hero.find((r) => r.selector === '.hero::after');
    const content = hero.find((r) => r.selector === '.hero > *');
    expect(before?.body).toMatch(/z-index:\s*0/);
    expect(after?.body).toMatch(/z-index:\s*0/);
    expect(content?.body).toMatch(/z-index:\s*1/);
    expect(before?.body).toContain('pointer-events: none');
  });
});
