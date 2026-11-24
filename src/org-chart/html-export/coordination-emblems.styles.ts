/**
 * Fondos decorativos de coordinación para el HTML exportado (rediseño,
 * etapa 1). Solo CSS: no añade nodos al DOM ni JavaScript.
 *
 * Cómo se construye el fondo de una sección de área:
 * 1. `coordinationEmblemAttribute(área)` añade `data-emblem="<clave>"` a la
 *    <section class="area"> si el área tiene icono oficial
 *    (coordination-emblems.config.ts). Sin icono → sin atributo → la sección
 *    conserva exactamente el fondo neutro anterior.
 * 2. `buildCoordinationEmblemCss(áreas)` emite, una sola vez por documento:
 *    - reglas comunes para `.area[data-emblem]`: la sección pasa a ser un
 *      contexto de apilamiento (`isolation`) y su contenido directo se eleva a
 *      `z-index: 1`, de modo que el fondo SIEMPRE queda detrás de títulos,
 *      tarjetas y fotos;
 *    - `::before`: anillos de radar y retícula muy tenues en el color de la
 *      coordinación (--c-rgb) con un halo del secundario (--c2-rgb),
 *      centrados donde va el icono (subordinados a él, se desvanecen hacia el
 *      borde);
 *    - `::after`: el icono oficial como MÁSCARA (`mask-image`) rellena con el
 *      color legible de la coordinación (--c-text) a baja opacidad. Etapa 1
 *      usaba cian para todas; desde la etapa 2 cada coordinación usa el suyo
 *      (variables de coordination-palette.ts; cian fuera de coordinación);
 *    - una regla por icono PRESENTE en el documento que solo define la
 *      variable `--emblem-image` con el data URI (WebP base64 incrustado:
 *      funciona sin conexión y cada imagen se incluye una sola vez).
 * 3. Si el navegador no soporta máscaras CSS, el icono no se pinta (queda el
 *    radar) gracias a `@supports`: nunca aparece un bloque de color sólido.
 *
 * Los pseudoelementos no son accesibles por lectores de pantalla: el nombre
 * de la coordinación sigue siendo el <h2> de la sección.
 */
import {
  COORDINATION_EMBLEM_ASSETS,
  type CoordinationEmblemAsset,
} from './coordination-emblem-assets.generated';
import {
  resolveAreaEmblemKey,
  type CoordinationEmblemKey,
} from './coordination-emblems.config';

/** Claves seguras para atributos y selectores (letra inicial, luego letras o dígitos). */
const SAFE_KEY = /^[A-Za-z][A-Za-z0-9]*$/;
/** Base64 estricto: sin comillas, paréntesis ni nada que cierre `url("…")`. */
const SAFE_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function usableAsset(
  key: CoordinationEmblemKey,
): CoordinationEmblemAsset | null {
  const asset = COORDINATION_EMBLEM_ASSETS[key];
  if (!asset || !SAFE_KEY.test(key)) return null;
  if (asset.mimeType !== 'image/webp' || !SAFE_BASE64.test(asset.base64)) {
    return null;
  }
  return asset;
}

/** Clave del icono a usar en el área, solo si su recurso es válido. */
export function resolveUsableAreaEmblem(
  areaName: string,
): CoordinationEmblemKey | null {
  const key = resolveAreaEmblemKey(areaName);
  return key && usableAsset(key) ? key : null;
}

/**
 * Atributo para la <section class="area"> (con espacio inicial) o cadena
 * vacía si el área no tiene icono. La clave proviene de una lista cerrada y
 * se valida con SAFE_KEY: no requiere escape.
 */
export function coordinationEmblemAttribute(areaName: string): string {
  const key = resolveUsableAreaEmblem(areaName);
  return key ? ` data-emblem="${key}"` : '';
}

/** Reglas comunes (anillos, máscara y capas). Se emiten si hay ≥1 icono. */
const BASE_CSS = `
    /* ── Fondos de coordinación (etapa 1): ver coordination-emblems.styles.ts ── */
    .area[data-emblem] {
      /* Caja del radar; el icono ocupa el 78 % central (≈420 px en escritorio). */
      --emblem-size: clamp(240px, 36vw, 540px);
      --emblem-top: -48px;
      --emblem-right: -40px;
      position: relative;
      isolation: isolate;
      overflow: hidden;
    }
    /* Todo el contenido de la sección por encima del fondo decorativo. */
    .area[data-emblem] > * { position: relative; z-index: 1; }
    .area[data-emblem]::before,
    .area[data-emblem]::after {
      content: "";
      position: absolute;
      z-index: 0;
      /*
       * Caja cuadrada adaptada a la altura de la sección (los % de height y
       * top se resuelven contra el alto de la sección):
       * - secciones altas: --emblem-size y --emblem-top, sin cambios;
       * - secciones bajas (p. ej. B2B): la caja se reduce lo justo para que
       *   ni el icono ni los anillos se corten por abajo
       *   (cabe: top + alto ≤ 100 % y 0,89 × alto ≤ 100 %), y el desplazamiento
       *   superior nunca supera el 11 % de la caja, de modo que el icono
       *   (78 % central) tampoco se corta por arriba.
       */
      --emblem-box: min(var(--emblem-size), calc(100% - var(--emblem-top)), calc(100% * 1.12));
      top: max(var(--emblem-top), calc(var(--emblem-box) * -0.11));
      right: var(--emblem-right);
      height: var(--emblem-box);
      width: auto;
      aspect-ratio: 1 / 1;
      pointer-events: none;
    }
    /* Radar: halo, anillos concéntricos y retícula, desvanecidos hacia fuera. */
    .area[data-emblem]::before {
      border-radius: 50%;
      background:
        linear-gradient(90deg, transparent calc(50% - .5px), rgb(var(--c-rgb) / .14) 50%, transparent calc(50% + .5px)),
        linear-gradient(0deg, transparent calc(50% - .5px), rgb(var(--c-rgb) / .14) 50%, transparent calc(50% + .5px)),
        repeating-radial-gradient(circle at center, transparent 0 calc(var(--emblem-size) / 9 - 1px), rgb(var(--c-rgb) / .14) calc(var(--emblem-size) / 9 - 1px) calc(var(--emblem-size) / 9)),
        radial-gradient(circle at center, rgb(var(--c2-rgb) / .12) 0%, rgb(var(--c2-rgb) / .04) 45%, transparent 68%);
      -webkit-mask-image: radial-gradient(circle at center, #000 30%, transparent 70%);
      mask-image: radial-gradient(circle at center, #000 30%, transparent 70%);
    }
    /* Icono oficial como silueta (máscara) en el color de su coordinación. */
    @supports ((mask-image: none) or (-webkit-mask-image: none)) {
      .area[data-emblem]::after {
        /* Color legible de la coordinación (cian fuera de ella). */
        background-color: var(--c-text);
        opacity: .15;
        -webkit-mask-image: var(--emblem-image);
        mask-image: var(--emblem-image);
        -webkit-mask-size: 78% 78%;
        mask-size: 78% 78%;
        -webkit-mask-position: center;
        mask-position: center;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
      }
    }
    @media (max-width: 600px) {
      .area[data-emblem] {
        --emblem-size: clamp(180px, 62vw, 280px);
        --emblem-top: -24px;
        --emblem-right: -40px;
      }
      .area[data-emblem]::after { opacity: .11; }
    }`;

/**
 * CSS de los fondos para las áreas dadas (nombres tal como salen de
 * core.area). Incluye solo los iconos que se usan; cadena vacía si ninguna
 * área tiene icono.
 */
export function buildCoordinationEmblemCss(
  areaNames: Iterable<string>,
): string {
  const keys = new Set<CoordinationEmblemKey>();
  for (const area of areaNames) {
    const key = resolveUsableAreaEmblem(area);
    if (key) keys.add(key);
  }
  if (keys.size === 0) return '';
  const images = [...keys]
    .sort()
    .map((key) => {
      const asset = usableAsset(key)!;
      return `    .area[data-emblem="${key}"] { --emblem-image: url("data:${asset.mimeType};base64,${asset.base64}"); }`;
    })
    .join('\n');
  return `${BASE_CSS}\n${images}\n`;
}
