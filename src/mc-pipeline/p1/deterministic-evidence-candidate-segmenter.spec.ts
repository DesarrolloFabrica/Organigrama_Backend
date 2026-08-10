import {
  DeterministicEvidenceCandidateSegmenter,
  classifyLineV11,
} from './deterministic-evidence-candidate-segmenter';
import { P1EvidenceBatchBuilder } from './p1-evidence-batch-builder';
import { P1_SEGMENTER_VERSION } from './p1.types';

describe('classifyLineV11 headings', () => {
  it('detecta mayúsculas conocidas', () => {
    expect(classifyLineV11('EXPERIENCIA LABORAL').type).toBe('HEADING');
    expect(classifyLineV11('EXPERIENCIA LABORAL').blockType).toBe('EXPERIENCE');
  });

  it('detecta encabezado numerado', () => {
    expect(classifyLineV11('4. EXPERIENCIA').type).toBe('HEADING');
    expect(classifyLineV11('3. EDUCACIÓN').type).toBe('HEADING');
  });

  it('detecta encabezado con dos puntos', () => {
    expect(classifyLineV11('Habilidades:').type).toBe('HEADING');
  });

  it('no marca oración normal en mayúsculas largas como heading ambiguo excesivo', () => {
    // frase larga → SENTENCE/PARAGRAPH
    const r = classifyLineV11(
      'DESARROLLÉ VARIOS PROYECTOS DE PRODUCCIÓN DIGITAL PARA CLIENTES INTERNOS.',
    );
    expect(r.type).not.toBe('HEADING');
  });

  it('viñeta numerada de contenido no es heading', () => {
    expect(
      classifyLineV11(
        '1. Implementé reportes mensuales de desempeño comercial con indicadores clave.',
      ).type,
    ).toBe('BULLET');
  });
});

describe('DeterministicEvidenceCandidateSegmenter 1.1.0', () => {
  const segmenter = new DeterministicEvidenceCandidateSegmenter();

  it('versión 1.1.0', () => {
    expect(segmenter.version).toBe('1.1.0');
    expect(P1_SEGMENTER_VERSION).toBe('1.1.0');
  });

  it('HEADING > 0 y contexto en candidatos posteriores', () => {
    const normalizedText = [
      '---PAGE 1---',
      '1. EXPERIENCIA',
      'Lideré implementación de reportes.',
      '',
      'HERRAMIENTAS',
      'Excel, SQL, Power BI',
      '---PAGE 2---',
      '2. EDUCACIÓN',
      'Universidad Nacional 2010-2014',
    ].join('\n');

    const r = segmenter.segment({
      snapshotId: '1',
      normalizedText,
      pages: [
        { pageNumber: 1, text: 'x', characterCount: 1 },
        { pageNumber: 2, text: 'y', characterCount: 1 },
      ],
    });

    expect(r.metrics.headingCount).toBeGreaterThan(0);
    expect(r.metrics.unsegmentedRelevantCharacterCount).toBe(0);
    expect(r.metrics.pageCoverageRatio).toBe(1);

    const headings = r.candidates.filter((c) => c.candidateType === 'HEADING');
    expect(headings.length).toBeGreaterThanOrEqual(3);

    const toolsLine = r.candidates.find((c) =>
      (c.text || '').includes('Excel'),
    );
    expect(toolsLine?.headingContext).toMatch(/HERRAMIENTAS/i);
    expect(toolsLine?.parentHeadingCandidateId).toBeTruthy();
    expect(toolsLine?.blockType).toBe('TOOLS');

    for (const c of r.candidates) {
      expect(normalizedText.slice(c.startOffset, c.endOffset)).toBe(c.text);
    }
  });

  it('heading sin contenido no rompe cobertura', () => {
    const normalizedText = 'PERFIL\n\nEXPERIENCIA\n';
    const r = segmenter.segment({ snapshotId: '1', normalizedText });
    expect(r.metrics.headingCount).toBe(2);
    expect(r.metrics.unsegmentedRelevantCharacterCount).toBe(0);
  });

  it('cambio de sección actualiza contexto', () => {
    const normalizedText = 'HABILIDADES\nPython\nIDIOMAS\nInglés';
    const r = segmenter.segment({ snapshotId: '1', normalizedText });
    const py = r.candidates.find((c) => c.text === 'Python');
    const en = r.candidates.find((c) => c.text === 'Inglés');
    expect(py?.blockType).toBe('SKILLS');
    expect(en?.blockType).toBe('LANGUAGES');
  });
});

describe('P1EvidenceBatchBuilder', () => {
  it('agrupa por página', () => {
    const segmenter = new DeterministicEvidenceCandidateSegmenter();
    const text = '---PAGE 1---\nUno.\nDos.\n---PAGE 2---\nTres.';
    const seg = segmenter.segment({ snapshotId: '1', normalizedText: text });
    const batches = new P1EvidenceBatchBuilder().build(seg.candidates);
    expect(batches.length).toBeGreaterThanOrEqual(2);
  });
});
