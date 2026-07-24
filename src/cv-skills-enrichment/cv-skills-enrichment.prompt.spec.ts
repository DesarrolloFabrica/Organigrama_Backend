import { CV_SKILLS_ENRICHER_PROMPT } from './cv-skills-enrichment.prompt';
import {
  CV_SKILLS_ENRICHER_PROMPT_VERSION,
  CV_SKILLS_ENRICHER_VERSION,
} from './cv-skills-enrichment.constants';

describe('CV_SKILLS_ENRICHER_PROMPT (e1)', () => {
  it('usa versión e1 independiente del extractor', () => {
    expect(CV_SKILLS_ENRICHER_PROMPT_VERSION).toBe('e1-2026-07-24');
    expect(CV_SKILLS_ENRICHER_VERSION).toBe('1.0.0');
  });

  it('declara lista cerrada y no descubrir skills', () => {
    expect(CV_SKILLS_ENRICHER_PROMPT).toMatch(/NO es descubrir skills/i);
    expect(CV_SKILLS_ENRICHER_PROMPT).toMatch(/lista CERRADA/i);
  });

  it('prohíbe crear, eliminar y renombrar', () => {
    expect(CV_SKILLS_ENRICHER_PROMPT).toMatch(/NUNCA omitas/i);
    expect(CV_SKILLS_ENRICHER_PROMPT).toMatch(/NUNCA agregues/i);
    expect(CV_SKILLS_ENRICHER_PROMPT).toMatch(/NUNCA renombres/i);
  });

  it('permite evidenceItems vacío y máximo 5', () => {
    expect(CV_SKILLS_ENRICHER_PROMPT).toMatch(/evidenceItems: \[\]/);
    expect(CV_SKILLS_ENRICHER_PROMPT).toMatch(/máximo 5/i);
  });

  it('prohíbe PII irrelevante', () => {
    expect(CV_SKILLS_ENRICHER_PROMPT).toMatch(/teléfono/i);
    expect(CV_SKILLS_ENRICHER_PROMPT).toMatch(/correo/i);
  });
});
