/**
 * Identidad cromática por coordinación para el HTML exportado (rediseño,
 * etapa 2). Solo CSS: variables personalizadas por coordinación.
 *
 * Asignación (decisión documentada):
 * - El color OFICIAL de cada coordinación sale de su icono
 *   (COORDINATION_COLORS en coordination-emblems.config.ts).
 * - Esos colores suelen ser oscuros (p. ej. el verde bosque de Dirección)
 *   y no se leerían sobre el fondo azul oscuro del documento. Por eso se
 *   derivan variantes de USO conservando el TONO y la SATURACIÓN del color
 *   oficial y aumentando solo su luminosidad (HSL) hasta el contraste mínimo
 *   WCAG frente a la superficie de las tarjetas (SURFACE). Si el color
 *   oficial ya cumple, se usa tal cual (no se oscurece ni se satura).
 *     · acento  (--c-rgb): bordes, líneas jerárquicas, radar y marca de agua
 *                          → contraste ≥ 4,5:1 (supera el 3:1 exigido a
 *                          componentes gráficos);
 *     · texto   (--c-text): contadores, etiquetas e insignias en color
 *                          → contraste ≥ 7:1 (AAA para texto normal);
 *     · secundario (--c2-rgb): halo del radar y degradado del encabezado,
 *                          del color secundario del icono si lo tiene
 *                          → contraste ≥ 4,5:1.
 * - Los textos principales (nombres, cargos) siguen en blanco/gris claro: el
 *   color identifica, no se usa para leer párrafos.
 *
 * Aplicación: las variables se definen sobre cualquier elemento con
 * `data-emblem="<clave>"` (secciones de área, etapa 1) o `data-coord="<clave>"`
 * (nodos de la vista jerárquica y enlaces del menú). Las reglas del documento
 * (document.styles.ts) solo usan las variables, con el cian/ámbar
 * institucional como valor por defecto fuera de una coordinación.
 */
import {
  COORDINATION_COLORS,
  resolveAreaEmblemKey,
  type CoordinationEmblemKey,
} from './coordination-emblems.config';

type Rgb = readonly [number, number, number];

/** Superficie de referencia para el contraste: la más clara de las tarjetas (slate-900). */
export const PALETTE_SURFACE = '#0f172a';
export const ACCENT_MIN_CONTRAST = 4.5;
export const TEXT_MIN_CONTRAST = 7;

export function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`Color inválido: ${hex}`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Luminancia relativa WCAG 2.x. */
function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Misma familia de color con la mínima luminosidad que alcanza `min` de
 * contraste frente a `against` (búsqueda binaria en L, tono y saturación
 * fijos). Si el color ya cumple, se devuelve sin cambios.
 */
export function liftToContrast(
  hex: string,
  min: number,
  against = PALETTE_SURFACE,
): string {
  if (contrastRatio(hex, against) >= min) return hex.toLowerCase();
  const [h, s, l0] = rgbToHsl(hexToRgb(hex));
  let lo = l0;
  let hi = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (contrastRatio(rgbToHex(hslToRgb(h, s, mid)), against) >= min) hi = mid;
    else lo = mid;
  }
  // El redondeo a hex puede quedar una centésima por debajo: avanza hasta cumplir.
  let l = hi;
  let out = rgbToHex(hslToRgb(h, s, l));
  while (contrastRatio(out, against) < min && l < 1) {
    l = Math.min(1, l + 0.002);
    out = rgbToHex(hslToRgb(h, s, l));
  }
  return out;
}

export type CoordinationTones = {
  /** Color oficial del icono (sin modificar). */
  official: string;
  accent: string;
  text: string;
  secondary: string;
};

export function deriveCoordinationTones(
  key: CoordinationEmblemKey,
): CoordinationTones {
  const color = COORDINATION_COLORS[key];
  return {
    official: color.principal,
    accent: liftToContrast(color.principal, ACCENT_MIN_CONTRAST),
    text: liftToContrast(color.principal, TEXT_MIN_CONTRAST),
    secondary: liftToContrast(
      color.secundario ?? color.principal,
      ACCENT_MIN_CONTRAST,
    ),
  };
}

/** Tonos de todas las coordinaciones (deterministas; se calculan una vez). */
export const COORDINATION_TONES: Readonly<
  Record<CoordinationEmblemKey, CoordinationTones>
> = Object.fromEntries(
  (Object.keys(COORDINATION_COLORS) as CoordinationEmblemKey[]).map((key) => [
    key,
    deriveCoordinationTones(key),
  ]),
) as Record<CoordinationEmblemKey, CoordinationTones>;

const SAFE_KEY = /^[A-Za-z][A-Za-z0-9]*$/;

/** `r g b` para usar en `rgb(var(--c-rgb) / α)`. */
function channels(hex: string): string {
  return hexToRgb(hex).join(' ');
}

/** Clave de coordinación del área (misma tabla que los iconos), o null. */
export function resolveAreaCoordinationKey(
  areaName: string,
): CoordinationEmblemKey | null {
  const key = resolveAreaEmblemKey(areaName);
  return key && SAFE_KEY.test(key) ? key : null;
}

/**
 * Atributo `data-coord` (con espacio inicial) para nodos de la vista
 * jerárquica y enlaces del menú; vacío si el área no tiene coordinación.
 */
export function coordinationColorAttribute(areaName: string): string {
  const key = resolveAreaCoordinationKey(areaName);
  return key ? ` data-coord="${key}"` : '';
}

/**
 * Variables de color de las coordinaciones presentes. `--lead-*` (líderes)
 * toma el mismo color: dentro de una coordinación el responsable se distingue
 * por intensidad y grosor, no por otro color.
 */
export function buildCoordinationPaletteCss(
  areaNames: Iterable<string>,
): string {
  const keys = new Set<CoordinationEmblemKey>();
  for (const area of areaNames) {
    const key = resolveAreaCoordinationKey(area);
    if (key) keys.add(key);
  }
  if (keys.size === 0) return '';
  const rules = [...keys]
    .sort()
    .map((key) => {
      const t = COORDINATION_TONES[key];
      return `    [data-emblem="${key}"], [data-coord="${key}"] { --c-rgb: ${channels(t.accent)}; --c-text: ${t.text}; --c2-rgb: ${channels(t.secondary)}; --lead-rgb: ${channels(t.accent)}; --lead-text: ${t.text}; }`;
    })
    .join('\n');
  return `\n    /* ── Colores por coordinación (etapa 2): ver coordination-palette.ts ── */\n${rules}\n`;
}
