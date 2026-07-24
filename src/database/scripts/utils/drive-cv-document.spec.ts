import { extractDocument } from './drive-cv-document';

describe('extractDocument (Drive CV)', () => {
  it('acepta dígitos.pdf y .PDF con trim', () => {
    expect(extractDocument('1023456789.pdf')).toBe('1023456789');
    expect(extractDocument('1023456789.PDF')).toBe('1023456789');
    expect(extractDocument('  1023456789.pdf  ')).toBe('1023456789');
  });

  it('rechaza puntos, prefijos, sufijos y no-dígitos', () => {
    expect(extractDocument('1.023.456.789.pdf')).toBeNull();
    expect(extractDocument('HV 1023456789.pdf')).toBeNull();
    expect(extractDocument('1023456789 copia.pdf')).toBeNull();
    expect(extractDocument('1023456789-final.pdf')).toBeNull();
    expect(extractDocument('abc.pdf')).toBeNull();
  });
});
