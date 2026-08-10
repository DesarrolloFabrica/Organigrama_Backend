/**
 * Adaptador unpdf — extracción local de texto PDF por página.
 * Sin OCR. Sin persistencia. Sin normalización. Sin secciones.
 */
import { extractText, getDocumentProxy, getMeta } from 'unpdf';
import type { CvDocumentTextExtractor } from './cv-document-text-extractor';
import type {
  CvDocumentExtractionInput,
  CvDocumentExtractionResult,
  CvExtractedPage,
  P0ParseStatus,
} from './p0.types';
import { pageDelimiter } from './p0.types';

const PDF_MIME = 'application/pdf';
/** Adapter version — bump when heuristics change. */
export const UNPDF_EXTRACTOR_VERSION = '1.0.0';
export const UNPDF_EXTRACTOR_NAME = 'unpdf';

function isPdfMime(mime: string, fileName: string): boolean {
  const m = mime.trim().toLowerCase();
  const name = fileName.trim().toLowerCase();
  return m === PDF_MIME || name.endsWith('.pdf');
}

function looksLikePdf(buffer: Buffer): boolean {
  if (buffer.length < 5) return false;
  return buffer.subarray(0, 5).toString('utf8') === '%PDF-';
}

function classifyTextDensity(
  pageCount: number,
  totalChars: number,
): P0ParseStatus {
  if (pageCount <= 0 && totalChars === 0) return 'EMPTY_DOCUMENT';
  if (totalChars === 0) return 'EMPTY_DOCUMENT';
  // Umbral conservador: PDF cortos con texto digital no son "escaneados".
  // Escaneado típico = varias páginas con muy pocos caracteres extraídos.
  if (pageCount >= 2 && totalChars < Math.max(30, pageCount * 12)) {
    return 'SCANNED_OR_IMAGE_ONLY';
  }
  if (totalChars < 8) return 'SCANNED_OR_IMAGE_ONLY';
  return 'PARSED';
}

export class UnpdfCvDocumentTextExtractor implements CvDocumentTextExtractor {
  readonly name = UNPDF_EXTRACTOR_NAME;
  readonly version = UNPDF_EXTRACTOR_VERSION;

  async extract(
    input: CvDocumentExtractionInput,
  ): Promise<CvDocumentExtractionResult> {
    const warnings: string[] = [];

    if (!Buffer.isBuffer(input.buffer) || input.buffer.length === 0) {
      return {
        status: 'FAILED',
        rawText: '',
        pages: [],
        pageCount: 0,
        metadata: {},
        warnings,
        errorCode: 'PDF_PARSE_FAILED',
        errorDetailSafe: 'empty or invalid buffer',
      };
    }

    if (!isPdfMime(input.mimeType, input.fileName)) {
      return {
        status: 'UNSUPPORTED_FORMAT',
        rawText: '',
        pages: [],
        pageCount: 0,
        metadata: {},
        warnings: ['mime_or_extension_not_pdf'],
        errorCode: 'UNSUPPORTED_FORMAT',
        errorDetailSafe: 'only application/pdf is supported in P0 v1',
      };
    }

    if (!looksLikePdf(input.buffer)) {
      return {
        status: 'FAILED',
        rawText: '',
        pages: [],
        pageCount: 0,
        metadata: {},
        warnings: ['missing_pdf_magic'],
        errorCode: 'PDF_PARSE_FAILED',
        errorDetailSafe: 'buffer does not start with %PDF',
      };
    }

    try {
      const data = new Uint8Array(input.buffer);
      const pdf = await getDocumentProxy(data);
      const { totalPages, text } = await extractText(pdf, { mergePages: false });
      const pageTexts = Array.isArray(text) ? text : [String(text ?? '')];

      let metaTitle: string | null = null;
      let metaAuthor: string | null = null;
      try {
        const meta = await getMeta(pdf);
        const info = (meta?.info ?? {}) as Record<string, unknown>;
        metaTitle = typeof info.Title === 'string' ? info.Title : null;
        metaAuthor = typeof info.Author === 'string' ? info.Author : null;
      } catch {
        warnings.push('metadata_unavailable');
      }

      const pages: CvExtractedPage[] = [];
      for (let i = 0; i < Math.max(totalPages, pageTexts.length); i++) {
        const pageText = String(pageTexts[i] ?? '');
        pages.push({
          pageNumber: i + 1,
          text: pageText,
          characterCount: pageText.length,
        });
      }

      const totalChars = pages.reduce((s, p) => s + p.characterCount, 0);
      const status = classifyTextDensity(pages.length || totalPages, totalChars);

      const rawParts: string[] = [];
      for (const p of pages) {
        rawParts.push(pageDelimiter(p.pageNumber));
        rawParts.push(p.text);
      }
      const rawText = rawParts.join('\n\n');

      if (status === 'SCANNED_OR_IMAGE_ONLY') {
        warnings.push('low_text_density_possible_scan');
      }
      if (status === 'EMPTY_DOCUMENT') {
        warnings.push('no_extractable_text');
      }

      // PARTIAL: algunas páginas vacías pero otras con texto
      let finalStatus = status;
      if (status === 'PARSED') {
        const emptyPages = pages.filter((p) => p.characterCount === 0).length;
        if (emptyPages > 0 && emptyPages < pages.length) {
          finalStatus = 'PARTIAL';
          warnings.push('some_pages_without_text');
        }
      }

      return {
        status: finalStatus,
        rawText,
        pages,
        pageCount: pages.length || totalPages,
        metadata: { title: metaTitle, author: metaAuthor },
        warnings,
        errorCode:
          finalStatus === 'EMPTY_DOCUMENT'
            ? 'EMPTY_DOCUMENT'
            : finalStatus === 'SCANNED_OR_IMAGE_ONLY'
              ? 'SCANNED_OR_IMAGE_ONLY'
              : undefined,
        errorDetailSafe:
          finalStatus === 'EMPTY_DOCUMENT' ||
          finalStatus === 'SCANNED_OR_IMAGE_ONLY'
            ? finalStatus
            : undefined,
      };
    } catch (err) {
      const cause =
        err instanceof Error ? err.name : 'unknown_parse_error';
      return {
        status: 'FAILED',
        rawText: '',
        pages: [],
        pageCount: 0,
        metadata: {},
        warnings: ['pdf_parse_exception'],
        errorCode: 'PDF_PARSE_FAILED',
        errorDetailSafe: `parse failed (${cause})`,
      };
    }
  }
}
