import { validateEnrichmentBlockResponse } from './cv-skills-enrichment.validation';
import type { EnrichmentInputSkill } from './cv-skills-enrichment.types';

const input: EnrichmentInputSkill[] = [
  {
    extractionSkillId: 's1',
    normalizedName: 'React',
    sortOrder: 0,
  },
  {
    extractionSkillId: 's2',
    normalizedName: 'NestJS',
    sortOrder: 1,
  },
];

function okRaw(skills: unknown[]) {
  return { skills, warnings: [] };
}

describe('validateEnrichmentBlockResponse', () => {
  it('15-equivalent: 2 in / 2 out ordenados', () => {
    const raw = okRaw([
      {
        extractionSkillId: 's2',
        normalizedName: 'NestJS',
        evidenceItems: [
          {
            sourceType: 'SKILLS_SECTION',
            evidenceText: 'NestJS',
            occurrenceIndex: 1,
          },
        ],
      },
      {
        extractionSkillId: 's1',
        normalizedName: 'React',
        evidenceItems: [],
      },
    ]);
    const r = validateEnrichmentBlockResponse(input, raw);
    expect(r.ok).toBe(true);
    expect(r.skills.map((s) => s.extractionSkillId)).toEqual(['s1', 's2']);
  });

  it('skill omitida → no ok', () => {
    const raw = okRaw([
      { extractionSkillId: 's1', normalizedName: 'React', evidenceItems: [] },
    ]);
    const r = validateEnrichmentBlockResponse(input, raw);
    expect(r.ok).toBe(false);
    expect(r.identityErrors.some((e) => e.code === 'SKILL_OMITTED')).toBe(true);
  });

  it('skill extra → warning y ok si el resto completo', () => {
    const raw = okRaw([
      { extractionSkillId: 's1', normalizedName: 'React', evidenceItems: [] },
      { extractionSkillId: 's2', normalizedName: 'NestJS', evidenceItems: [] },
      { extractionSkillId: 'sX', normalizedName: 'Vue', evidenceItems: [] },
    ]);
    const r = validateEnrichmentBlockResponse(input, raw);
    expect(r.ok).toBe(true);
    expect(r.unknownSkillsReturned).toBe(1);
  });

  it('rename → identity error', () => {
    const raw = okRaw([
      { extractionSkillId: 's1', normalizedName: 'React.js', evidenceItems: [] },
      { extractionSkillId: 's2', normalizedName: 'NestJS', evidenceItems: [] },
    ]);
    const r = validateEnrichmentBlockResponse(input, raw);
    expect(r.ok).toBe(false);
    expect(r.identityErrors.some((e) => e.code === 'NAME_MISMATCH')).toBe(true);
  });

  it('ID cambiado se trata como desconocida + omitida', () => {
    const raw = okRaw([
      { extractionSkillId: 'other', normalizedName: 'React', evidenceItems: [] },
      { extractionSkillId: 's2', normalizedName: 'NestJS', evidenceItems: [] },
    ]);
    const r = validateEnrichmentBlockResponse(input, raw);
    expect(r.ok).toBe(false);
    expect(r.unknownSkillsReturned).toBe(1);
  });

  it('dedupe evidencia y reindex; trunca >5', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      sourceType: 'OTHER',
      evidenceText: `Cita ${i}`,
      occurrenceIndex: 99,
    }));
    items.push({
      sourceType: 'OTHER',
      evidenceText: '  Cita 0  ',
      occurrenceIndex: 1,
    });
    const raw = okRaw([
      {
        extractionSkillId: 's1',
        normalizedName: 'React',
        evidenceItems: items,
      },
      { extractionSkillId: 's2', normalizedName: 'NestJS', evidenceItems: [] },
    ]);
    const r = validateEnrichmentBlockResponse(input, raw);
    expect(r.ok).toBe(true);
    expect(r.skills[0].evidenceItems).toHaveLength(5);
    expect(r.skills[0].evidenceItems.map((e) => e.occurrenceIndex)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('sourceType inválido y vacío se descartan con warning', () => {
    const raw = okRaw([
      {
        extractionSkillId: 's1',
        normalizedName: 'React',
        evidenceItems: [
          { sourceType: 'NOPE', evidenceText: 'x', occurrenceIndex: 1 },
          { sourceType: 'PROJECT', evidenceText: '  ', occurrenceIndex: 2 },
          {
            sourceType: 'PROJECT',
            evidenceText: 'Proyecto React',
            occurrenceIndex: 3,
          },
        ],
      },
      { extractionSkillId: 's2', normalizedName: 'NestJS', evidenceItems: [] },
    ]);
    const r = validateEnrichmentBlockResponse(input, raw);
    expect(r.ok).toBe(true);
    expect(r.skills[0].evidenceItems).toHaveLength(1);
  });

  it('duplicada con mismo ID/nombre → merge', () => {
    const raw = okRaw([
      {
        extractionSkillId: 's1',
        normalizedName: 'React',
        evidenceItems: [
          {
            sourceType: 'SKILLS_SECTION',
            evidenceText: 'React',
            occurrenceIndex: 1,
          },
        ],
      },
      {
        extractionSkillId: 's1',
        normalizedName: 'React',
        evidenceItems: [
          {
            sourceType: 'WORK_EXPERIENCE',
            evidenceText: 'Desarrollo con React',
            occurrenceIndex: 1,
          },
        ],
      },
      { extractionSkillId: 's2', normalizedName: 'NestJS', evidenceItems: [] },
    ]);
    const r = validateEnrichmentBlockResponse(input, raw);
    expect(r.ok).toBe(true);
    expect(r.duplicateSkillsReturned).toBe(1);
    expect(r.skills[0].evidenceItems[0].sourceType).toBe('WORK_EXPERIENCE');
  });
});
