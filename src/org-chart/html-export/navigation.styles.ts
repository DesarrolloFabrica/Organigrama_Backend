/**
 * Menú lateral del HTML exportado (rediseño, etapa 2.1): panel táctico tipo
 * LED / radar con DOS estados. Solo CSS, sin JavaScript ni cambios de marcado.
 *
 * Estado base (todas las opciones iguales, neutro):
 *   panel oscuro con líneas de barrido muy tenues, tarjetas con borde cian
 *   apagado, un «LED» cian atenuado a la izquierda y el contador como lectura
 *   de monitor (monoespaciada). El color de cada coordinación NO se muestra:
 *   en reposo el menú no compite con el contenido.
 *
 * Estado iluminado (hover · foco de teclado · pulsado · seleccionado):
 *   la opción toma el color de SU coordinación (variables --c-rgb / --c-text
 *   que coordination-palette.ts define por `data-coord`; cian institucional
 *   para «Vista jerárquica» y opciones sin coordinación): borde y barra
 *   izquierda de 3 px, fondo tenue, LED encendido con brillo y contador en el
 *   color de texto de la coordinación. Además del color, la barra izquierda y
 *   el LED encendido marcan el estado (no depende solo del color).
 *
 * «Seleccionado» sin JavaScript: al pulsar un enlace la URL apunta a la
 * sección (#ancla), que pasa a ser `:target`. Por cada ancla del documento se
 * genera `body:has(#ancla:target) nav a[href="#ancla"]`. Estas reglas van
 * APARTE de las de hover/foco: un navegador sin `:has()` descarta solo esas
 * reglas y conserva el resto (en una misma lista de selectores invalidaría
 * todo el bloque).
 */

/** Anclas válidas para usarlas en selectores (las generan los slugs del documento). */
const SAFE_ANCHOR = /^[a-z][a-z0-9-]*$/;

/** Base del menú (estado neutro). */
export const NAVIGATION_BASE_CSS = `
    /* ── Menú lateral: panel táctico neutro (estado base) ── */
    nav {
      position: sticky; top: 0; align-self: start; max-height: 100vh; overflow: auto;
      padding: 24px 16px;
      border-right: 1px solid rgba(56,189,248,.16);
      background:
        repeating-linear-gradient(0deg, rgba(125,211,252,.022) 0 1px, transparent 1px 4px),
        radial-gradient(ellipse 140% 45% at 0% 0%, rgba(14,116,144,.18), transparent 70%),
        linear-gradient(180deg, #030c1e 0%, #01050f 100%);
      box-shadow: inset -1px 0 0 rgba(125,211,252,.05);
    }
    nav h1 { margin: 0 0 6px; font-size: 20px; line-height: 1.25; letter-spacing: .01em; }
    nav .meta { margin: 0 0 18px; color: var(--muted); font-size: 13px; }
    nav a {
      display: flex; align-items: center; gap: 12px; margin-bottom: 8px;
      padding: 10px 12px; border-radius: 10px; color: #cbd5e1; text-decoration: none;
      border: 1px solid rgba(56,189,248,.14);
      background: linear-gradient(90deg, rgba(8,47,73,.32), rgba(2,6,23,.58));
      box-shadow: inset 0 1px 0 rgba(148,163,184,.05);
      font-size: 14px; line-height: 1.3;
    }
    nav a.nav-home { margin-bottom: 16px; border-color: rgba(56,189,248,.24); }
    /* LED de la opción: apagado (cian tenue) en reposo. */
    nav a::before {
      content: ""; flex: none; width: 7px; height: 7px; border-radius: 50%;
      background: rgba(103,232,249,.3);
      box-shadow: 0 0 0 2px rgba(34,211,238,.07);
    }
    nav a > span { flex: 1 1 auto; min-width: 0; }
    /* Contador como lectura de monitor. */
    nav strong {
      flex: none; min-width: 2.6em; padding: 2px 8px; border-radius: 6px; text-align: center;
      font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 13px; font-weight: 600;
      letter-spacing: .04em; color: #7dd3e8;
      background: rgba(2,6,23,.82); border: 1px solid rgba(56,189,248,.18);
    }
    nav a:focus-visible { outline: 2px solid rgb(var(--c-rgb)); outline-offset: 2px; }`;

/** Declaraciones del estado iluminado (compartidas por todas las reglas). */
const LIT_LINK = `color: #f8fafc; border-color: rgb(var(--c-rgb) / .6); background: linear-gradient(90deg, rgb(var(--c-rgb) / .16), rgba(2,6,23,.62) 78%); box-shadow: inset 3px 0 0 rgb(var(--c-rgb)), 0 0 18px -6px rgb(var(--c-rgb) / .6);`;
const LIT_LED = `background: rgb(var(--c-rgb)); box-shadow: 0 0 0 2px rgb(var(--c-rgb) / .18), 0 0 8px rgb(var(--c-rgb) / .9);`;
const LIT_COUNTER = `color: var(--c-text); border-color: rgb(var(--c-rgb) / .45);`;

function litRules(selector: string): string {
  return [
    `    ${selector} { ${LIT_LINK} }`,
    `    ${selector
      .split(', ')
      .map((s) => `${s}::before`)
      .join(', ')} { ${LIT_LED} }`,
    `    ${selector
      .split(', ')
      .map((s) => `${s} strong`)
      .join(', ')} { ${LIT_COUNTER} }`,
  ].join('\n');
}

/**
 * CSS completo del menú: base + estado iluminado por interacción + estado
 * «seleccionado» para cada ancla presente en el documento.
 */
export function buildNavigationCss(anchors: Iterable<string>): string {
  const interaction = litRules(
    'nav a:hover, nav a:focus-visible, nav a:active',
  );
  const selected = [...new Set(anchors)]
    .filter((anchor) => SAFE_ANCHOR.test(anchor))
    .map((anchor) =>
      litRules(`body:has(#${anchor}:target) nav a[href="#${anchor}"]`),
    )
    .join('\n');
  return `${NAVIGATION_BASE_CSS}
    /* Estado iluminado: el color de la coordinación solo aparece aquí. */
${interaction}
    /* Opción seleccionada (sección destino de la URL), sin JavaScript. */
${selected}
`;
}
