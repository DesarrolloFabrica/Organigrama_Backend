import { CvSectionDetector } from './cv-section-detector';

describe('CvSectionDetector', () => {
  const d = new CvSectionDetector();

  it('detecta experiencia y educación', () => {
    const text = [
      'Perfil profesional',
      'Ingeniero',
      'Experiencia laboral',
      'Empresa X',
      'Educación',
      'Universidad Y',
    ].join('\n');
    const r = d.detect({ normalizedText: text });
    const types = r.sections.map((s) => s.type);
    expect(types).toEqual(
      expect.arrayContaining(['PROFILE', 'EXPERIENCE', 'EDUCATION']),
    );
    expect(r.sections.every((s) => s.rawText.length >= 0)).toBe(true);
  });

  it('fallback DOCUMENT sin encabezados', () => {
    const r = d.detect({ normalizedText: 'texto libre sin headers conocidos' });
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0].type).toBe('DOCUMENT');
    expect(r.sections[0].rawText).toContain('texto libre');
    expect(r.warnings).toContain('no_headings_fallback_document');
  });

  it('no pierde contenido con varias secciones', () => {
    const text = 'Skills\nJava\nIdiomas\nInglés';
    const r = d.detect({ normalizedText: text });
    const joined = r.sections.map((s) => s.rawText).join(' ');
    expect(joined).toMatch(/Java/);
    expect(joined).toMatch(/Inglés/);
  });

  it('texto ambiguo / prefacio va a OTHER', () => {
    const text = 'Prefacio raro\nExperiencia laboral\nCargo';
    const r = d.detect({ normalizedText: text });
    expect(r.sections.some((s) => s.type === 'OTHER')).toBe(true);
    expect(r.sections.some((s) => s.type === 'EXPERIENCE')).toBe(true);
  });
});
