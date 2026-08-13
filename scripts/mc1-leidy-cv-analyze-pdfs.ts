/**
 * Analiza estructura del PDF activo ya descargado + descarga CV inactivo 119.
 *   npx ts-node --transpile-only scripts/mc1-leidy-cv-analyze-pdfs.ts
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { extractText, getDocumentProxy } from 'unpdf';
import { downloadCvPdfBuffer } from '../src/database/scripts/utils/google-drive-cv-client';

function loadEnv(p: string): Record<string, string> {
  const o: Record<string, string> = {};
  if (!existsSync(p)) return o;
  for (const l of readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (!l || l.startsWith('#')) continue;
    const i = l.indexOf('=');
    if (i <= 0) continue;
    o[l.slice(0, i).trim()] = l
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }
  return o;
}

async function analyzeBuf(buf: Buffer, label: string) {
  const raw = buf.toString('latin1');
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pageTexts = Array.isArray(text) ? text : [String(text ?? '')];
  return {
    label,
    bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
    totalPages,
    totalChars: pageTexts.reduce((s, t) => s + String(t || '').length, 0),
    imgMarkers: (raw.match(/\/Subtype\s*\/Image/g) || []).length,
    baseFonts: (raw.match(/\/BaseFont/g) || []).length,
    toUnicode: (raw.match(/ToUnicode/g) || []).length,
    hasJpeg: /\/Filter\s*\/DCTDecode/.test(raw),
    hasJbig2: /\/Filter\s*\/JBIG2Decode/.test(raw),
    hasFlate: /\/Filter\s*\/FlateDecode/.test(raw),
    pages: pageTexts.map((t, i) => ({
      pageNumber: i + 1,
      characterCount: String(t || '').length,
      sample: String(t || '')
        .replace(/\s+/g, ' ')
        .slice(0, 100),
    })),
  };
}

async function main() {
  const ROOT = resolve(__dirname, '..');
  const OUT = resolve(ROOT, 'tmp', 'mc1-leidy-cv-recovery');
  mkdirSync(OUT, { recursive: true });
  const cloud = loadEnv(join(ROOT, '.env'));
  for (const [k, v] of Object.entries(cloud)) {
    if (!process.env[k]) process.env[k] = v;
  }

  const activePath = join(OUT, 'leidy-cv-195.pdf');
  const activeBuf = readFileSync(activePath);
  const active = await analyzeBuf(activeBuf, 'active-195');

  let inactive: unknown = null;
  try {
    const buf = await downloadCvPdfBuffer(
      '1BF10oK_WjUkhxw6clZurz9oxNaRt6uO0',
    );
    writeFileSync(join(OUT, 'leidy-cv-119-inactive.pdf'), buf);
    inactive = await analyzeBuf(buf, 'inactive-119');
  } catch (e) {
    inactive = {
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const report = {
    causeHypothesis:
      active.totalChars === 0 && active.imgMarkers > 0
        ? 'SCANNED_OR_IMAGE_ONLY_NO_TEXT_LAYER'
        : active.totalChars === 0
          ? 'EMPTY_TEXT_LAYER'
          : 'HAS_TEXT',
    active,
    inactive,
  };
  writeFileSync(join(OUT, 'pdf-structure.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
