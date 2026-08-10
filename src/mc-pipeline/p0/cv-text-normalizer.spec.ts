import { CvTextNormalizer } from './cv-text-normalizer';

describe('CvTextNormalizer', () => {
  const n = new CvTextNormalizer();

  it('normaliza CRLF a LF', () => {
    const r = n.normalize('a\r\nb\rc');
    expect(r.normalizedText).toBe('a\nb\nc');
  });

  it('aplica Unicode NFC', () => {
    const decomposed = 'e\u0301'; // e + combining acute
    const r = n.normalize(decomposed);
    expect(r.normalizedText).toBe('é');
  });

  it('colapsa espacios y trim final de línea', () => {
    const r = n.normalize('hola   mundo  \n');
    expect(r.normalizedText).toBe('hola mundo\n');
  });

  it('elimina caracteres de control', () => {
    const r = n.normalize('a\u0000b\u0007c');
    expect(r.normalizedText).toBe('abc');
    expect(r.metrics.controlCharsRemoved).toBeGreaterThan(0);
  });

  it('une soft-hyphen de línea de forma conservadora', () => {
    const r = n.normalize('progra-\nmación');
    expect(r.normalizedText).toBe('programación');
    expect(r.metrics.softHyphenJoins).toBe(1);
  });

  it('hash estable y output idempotente', () => {
    const input = 'Experiencia laboral\r\n  Java  ';
    const a = n.normalize(input);
    const b = n.normalize(input);
    expect(a.normalizedText).toBe(b.normalizedText);
    expect(a.normalizedTextHash).toBe(b.normalizedTextHash);
    expect(a.normalizedTextHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('conserva delimitadores de página', () => {
    const r = n.normalize('---PAGE 1---\n\nHola');
    expect(r.normalizedText).toContain('---PAGE 1---');
  });
});
