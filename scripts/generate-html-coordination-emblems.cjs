#!/usr/bin/env node
/**
 * Genera src/org-chart/html-export/coordination-emblem-assets.generated.ts a
 * partir de los PNG OFICIALES de coordinación del frontend
 * (src/features/org-chart/assets/coordination-icons/).
 *
 * Por qué un módulo .ts y no archivos de imagen:
 * - el HTML exportado debe abrir sin Internet, así que los iconos van
 *   incrustados como data URI;
 * - un módulo TypeScript viaja dentro de `dist` sin tocar nest-cli.json ni el
 *   Dockerfile (no hay assets binarios que copiar).
 *
 * Proceso por icono (solo lectura de los PNG fuente):
 *   1. se calcula el SHA-256 del PNG original (trazabilidad);
 *   2. Chromium (Playwright) lo dibuja en un canvas de MAX_SIDE px de lado
 *      mayor, conservando proporción, colores y canal alfa;
 *   3. se exporta a WebP (calidad QUALITY) y se guarda en base64.
 * Solo se usan imágenes rasterizadas (PNG → WebP): no se incrusta SVG ni
 * nada que pueda contener código ejecutable.
 *
 * Uso (desde la raíz del backend):
 *   node scripts/generate-html-coordination-emblems.cjs <dir-frontend> [<modulo-playwright>]
 *     <dir-frontend>       raíz del repo frontend (p. ej. ../frontend)
 *     <modulo-playwright>  ruta al paquete `playwright`; por defecto
 *                          <dir-frontend>/node_modules/playwright
 * Requiere Google Chrome instalado (se lanza con channel: 'chrome').
 */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** Lado mayor de la imagen incrustada: el fondo se pinta como máximo a ~460 px. */
const MAX_SIDE = 480;
const QUALITY = 0.8;
const ICONS_DIR = 'src/features/org-chart/assets/coordination-icons';

/**
 * Clave → archivo fuente. Debe coincidir con `CoordinationEmblemKey`
 * (coordination-emblems.config.ts). La correspondencia con cada área está
 * documentada allí.
 */
const SOURCES = {
  direccion: 'DirectorOp.png',
  b2b: 'B2B.png',
  especializaciones: 'Especializaciones.png',
  fabrica: 'Fabrica.png',
  homologaciones: 'Servicio.png',
  operacionAcademica: 'Operación Académica.png',
  practicas: 'Desarrollo profesional.png',
  proyeccionSocial: 'proyección social.png',
  saberPro: 'Saber Pro .png',
};

async function main() {
  const [frontendArg, playwrightArg] = process.argv.slice(2);
  if (!frontendArg) {
    console.error('Uso: node scripts/generate-html-coordination-emblems.cjs <dir-frontend> [<modulo-playwright>]');
    process.exit(2);
  }
  const frontendDir = path.resolve(frontendArg);
  const playwrightPath = path.resolve(
    playwrightArg ?? path.join(frontendDir, 'node_modules', 'playwright'),
  );
  const { chromium } = require(playwrightPath);

  const browser = await chromium.launch({ channel: 'chrome' });
  const entries = [];
  try {
    const page = await browser.newPage();
    for (const [key, file] of Object.entries(SOURCES)) {
      const source = fs.readFileSync(path.join(frontendDir, ICONS_DIR, file));
      const sha256 = crypto.createHash('sha256').update(source).digest('hex');
      const out = await page.evaluate(
        async ({ src, maxSide, quality }) => {
          const img = new Image();
          img.src = src;
          await img.decode();
          const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
          const width = Math.round(img.naturalWidth * scale);
          const height = Math.round(img.naturalHeight * scale);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          const url = canvas.toDataURL('image/webp', quality);
          return { width, height, url };
        },
        {
          src: `data:image/png;base64,${source.toString('base64')}`,
          maxSide: MAX_SIDE,
          quality: QUALITY,
        },
      );
      const prefix = 'data:image/webp;base64,';
      if (!out.url.startsWith(prefix)) {
        throw new Error(`Chromium no produjo WebP para ${file}`);
      }
      const base64 = out.url.slice(prefix.length);
      entries.push({ key, file, sha256, width: out.width, height: out.height, base64 });
      console.log(
        `${key.padEnd(20)} ${file.padEnd(28)} ${out.width}x${out.height} ${(base64.length / 1024).toFixed(1)} KiB base64`,
      );
    }
  } finally {
    await browser.close();
  }

  const body = entries
    .map(
      (e) => `  ${e.key}: {
    sourceFile: ${JSON.stringify(`${ICONS_DIR}/${e.file}`)},
    sourceSha256: '${e.sha256}',
    width: ${e.width},
    height: ${e.height},
    mimeType: 'image/webp',
    base64:
      '${e.base64}',
  },`,
    )
    .join('\n');

  const ts = `// ARCHIVO GENERADO por scripts/generate-html-coordination-emblems.cjs.
// No editar a mano: regenerar desde los PNG oficiales del frontend.
//
// Iconos oficiales de coordinación (frontend robusto, ${ICONS_DIR}),
// reducidos a WebP de ${MAX_SIDE} px (lado mayor, calidad ${QUALITY}) para incrustarlos en el
// HTML exportado y que funcione sin conexión. Solo imágenes rasterizadas.
import type { CoordinationEmblemKey } from './coordination-emblems.config';

export type CoordinationEmblemAsset = {
  /** Ruta del PNG oficial en el repo frontend. */
  sourceFile: string;
  /** SHA-256 del PNG oficial con el que se generó. */
  sourceSha256: string;
  width: number;
  height: number;
  mimeType: 'image/webp';
  base64: string;
};

export const COORDINATION_EMBLEM_ASSETS: Readonly<
  Record<CoordinationEmblemKey, CoordinationEmblemAsset>
> = {
${body}
};
`;
  const outFile = path.join(
    __dirname,
    '..',
    'src',
    'org-chart',
    'html-export',
    'coordination-emblem-assets.generated.ts',
  );
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  // Mismo formato que el resto del repo (.prettierrc), para que regenerar no
  // produzca diferencias de estilo.
  const prettier = require('prettier');
  const options = (await prettier.resolveConfig(outFile)) ?? {};
  const formatted = await prettier.format(ts, { ...options, parser: 'typescript' });
  fs.writeFileSync(outFile, formatted, 'utf8');
  console.log(`Escrito ${path.relative(process.cwd(), outFile)} (${(Buffer.byteLength(ts) / 1024).toFixed(1)} KiB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
