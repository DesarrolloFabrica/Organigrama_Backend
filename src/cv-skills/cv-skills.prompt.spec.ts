import { CV_SKILLS_PROMPT_VERSION } from './cv-skills.constants';
import { CV_SKILLS_EXTRACTION_PROMPT } from './cv-skills.prompt';

describe('CV_SKILLS_EXTRACTION_PROMPT (c2.1)', () => {
  it('usa prompt_version c2.1-2026-07-24', () => {
    expect(CV_SKILLS_PROMPT_VERSION).toBe('c2.1-2026-07-24');
  });

  it('separa inclusión de prioridad de evidencias', () => {
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(
      /INCLUSIÓN de una skill y la CALIDAD\/PRIORIDAD de sus evidencias son criterios SEPARADOS/i,
    );
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(
      /La prioridad de sourceType NO define qué skills pueden incluirse/i,
    );
  });

  it('exige incluir skills solo de SKILLS_SECTION', () => {
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(
      /escrita únicamente en SKILLS_SECTION[\s\S]*SIGUE SIENDO VÁLIDA/i,
    );
  });

  it('acepta evidencia corta / de una sola palabra', () => {
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(
      /cita de una sola palabra es válida/i,
    );
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(
      /NO omitas una skill porque la cita disponible sea corta/i,
    );
  });

  it('no elimina skill por falta de contexto aplicado', () => {
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(
      /NO omitas una skill por no encontrar evidencia aplicada/i,
    );
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(
      /NO necesita contexto laboral, proyecto, certificación ni varias menciones/i,
    );
  });

  it('evidenceItems vacío no elimina la skill', () => {
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(
      /evidenceItems: \[\]/i,
    );
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(
      /NUNCA elimines de la salida una skill inventariada en la Pasada 1 por falta de evidencia/i,
    );
  });

  it('no impone límite global artificial de skills', () => {
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(
      /NO limites artificialmente el número total de skills/i,
    );
  });

  it('exige revisión final contra inventario de Pasada 1', () => {
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(
      /Verificación de consistencia/i,
    );
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(
      /Compara la lista final de skills con el inventario de la Pasada 1/i,
    );
  });

  it('protege categorías inestables cuando estén escritas', () => {
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(/conocimientos especializados/i);
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(/gestión de requerimientos/i);
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(/pruebas funcionales/i);
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(/automatización y pipelines/i);
    expect(CV_SKILLS_EXTRACTION_PROMPT).toMatch(/habilidades blandas explícitas/i);
  });
});
