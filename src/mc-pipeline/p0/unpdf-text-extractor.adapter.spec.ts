jest.mock('unpdf', () => ({
  getDocumentProxy: jest.fn(async () => ({})),
  extractText: jest.fn(async () => ({
    totalPages: 1,
    text: ['Hello World professional experience text content'],
  })),
  getMeta: jest.fn(async () => ({ info: { Title: 'CV' } })),
}));

import { extractText, getDocumentProxy } from 'unpdf';
import { UnpdfCvDocumentTextExtractor } from './unpdf-text-extractor.adapter';
import {
  buildCorruptPdf,
  buildEmptyContentPdf,
  buildSimplePdfWithText,
} from './__fixtures__/synthetic-pdf';

describe('UnpdfCvDocumentTextExtractor', () => {
  const extractor = new UnpdfCvDocumentTextExtractor();

  beforeEach(() => {
    jest.clearAllMocks();
    (extractText as jest.Mock).mockResolvedValue({
      totalPages: 1,
      text: ['Hello World professional experience text content'],
    });
    (getDocumentProxy as jest.Mock).mockResolvedValue({});
  });

  it('extrae texto de PDF sintético (unpdf mockeado)', async () => {
    const buffer = buildSimplePdfWithText(['x']);
    const r = await extractor.extract({
      buffer,
      mimeType: 'application/pdf',
      fileName: 'cv.pdf',
    });
    expect(r.status).toBe('PARSED');
    expect(r.pageCount).toBe(1);
    expect(r.rawText).toContain('Hello World');
    expect(r.pages[0].pageNumber).toBe(1);
  });

  it('UNSUPPORTED_FORMAT para docx', async () => {
    const r = await extractor.extract({
      buffer: Buffer.from('%PDF-fake'),
      mimeType: 'application/msword',
      fileName: 'cv.doc',
    });
    expect(r.status).toBe('UNSUPPORTED_FORMAT');
  });

  it('FAILED para PDF corrupto (sin magic)', async () => {
    const r = await extractor.extract({
      buffer: buildCorruptPdf(),
      mimeType: 'application/pdf',
      fileName: 'bad.pdf',
    });
    expect(r.status).toBe('FAILED');
    expect(r.errorCode).toBe('PDF_PARSE_FAILED');
  });

  it('EMPTY_DOCUMENT cuando no hay texto', async () => {
    (extractText as jest.Mock).mockResolvedValue({ totalPages: 1, text: [''] });
    const r = await extractor.extract({
      buffer: buildEmptyContentPdf(),
      mimeType: 'application/pdf',
      fileName: 'empty.pdf',
    });
    expect(r.status).toBe('EMPTY_DOCUMENT');
  });

  it('SCANNED_OR_IMAGE_ONLY con densidad baja en multipágina', async () => {
    (extractText as jest.Mock).mockResolvedValue({ totalPages: 3, text: ['a', 'b', 'c'] });
    const r = await extractor.extract({
      buffer: buildSimplePdfWithText(),
      mimeType: 'application/pdf',
      fileName: 'scan.pdf',
    });
    expect(r.status).toBe('SCANNED_OR_IMAGE_ONLY');
  });

  it('FAILED si unpdf lanza', async () => {
    (getDocumentProxy as jest.Mock).mockRejectedValue(new Error('boom'));
    const r = await extractor.extract({
      buffer: buildSimplePdfWithText(),
      mimeType: 'application/pdf',
      fileName: 'x.pdf',
    });
    expect(r.status).toBe('FAILED');
    expect(r.errorDetailSafe ?? '').not.toMatch(/boom/);
  });
});
