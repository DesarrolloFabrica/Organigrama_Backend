import {
  applyCategoryEvidenceFallback,
  mergeEvidenceItems,
  parseSkillEvidenceItems,
} from './cv-skills.evidence';
import { validateExtractedCvSkills } from './cv-skills.validation';
import type { SkillEvidenceItem } from './cv-skills.types';

describe('cv-skills evidence (Fase B)', () => {
  it('parsea una evidencia válida', () => {
    const warnings: string[] = [];
    const items = parseSkillEvidenceItems(
      [
        {
          sourceType: 'WORK_EXPERIENCE',
          evidenceText: '  Desarrollo de APIs con NestJS  ',
          occurrenceIndex: 3,
        },
      ],
      'skills[0]',
      warnings,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceType: 'WORK_EXPERIENCE',
      evidenceText: 'Desarrollo de APIs con NestJS',
      occurrenceIndex: 1,
    });
    expect(warnings).toEqual([]);
  });

  it('parsea varias evidencias, deduplica y reindexa', () => {
    const warnings: string[] = [];
    const items = parseSkillEvidenceItems(
      [
        {
          sourceType: 'SKILLS_SECTION',
          evidenceText: 'React',
          occurrenceIndex: 99,
        },
        {
          sourceType: 'WORK_EXPERIENCE',
          evidenceText: 'Desarrollo frontend con React',
          occurrenceIndex: 1,
        },
        {
          sourceType: 'SKILLS_SECTION',
          evidenceText: 'react',
          occurrenceIndex: 2,
        },
      ],
      'skills[0]',
      warnings,
    );
    expect(items).toHaveLength(2);
    expect(items[0].sourceType).toBe('WORK_EXPERIENCE');
    expect(items[0].occurrenceIndex).toBe(1);
    expect(items[1].occurrenceIndex).toBe(2);
  });

  it('omite sourceType inválido y evidenceText vacío', () => {
    const warnings: string[] = [];
    const items = parseSkillEvidenceItems(
      [
        {
          sourceType: 'NOT_A_SECTION',
          evidenceText: 'texto',
          occurrenceIndex: 1,
        },
        {
          sourceType: 'PROJECT',
          evidenceText: '   ',
          occurrenceIndex: 2,
        },
        {
          sourceType: 'PROJECT',
          evidenceText: 'Proyecto con Docker',
          occurrenceIndex: 3,
        },
      ],
      'skills[0]',
      warnings,
    );
    expect(items).toHaveLength(1);
    expect(items[0].evidenceText).toBe('Proyecto con Docker');
    expect(warnings.some((w) => w.includes('sourceType inválido'))).toBe(true);
    expect(warnings.some((w) => w.includes('evidenceText vacío'))).toBe(true);
  });

  it('limita a 5 evidencias', () => {
    const warnings: string[] = [];
    const raw = Array.from({ length: 7 }, (_, i) => ({
      sourceType: 'OTHER',
      evidenceText: `Cita número ${i + 1}`,
      occurrenceIndex: i + 1,
    }));
    const items = parseSkillEvidenceItems(raw, 'skills[0]', warnings);
    expect(items).toHaveLength(5);
    expect(warnings.some((w) => w.includes('se limitó a 5'))).toBe(true);
  });

  it('fallback desde category.evidence', () => {
    const warnings: string[] = [];
    const items = applyCategoryEvidenceFallback(
      [],
      'Categoría: React, NestJS.',
      'skills[0]',
      warnings,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceType: 'OTHER',
      evidenceText: 'Categoría: React, NestJS.',
      occurrenceIndex: 1,
      isFallback: true,
    });
    expect(warnings[0]).toMatch(/heredó evidence de categoría/);
  });

  it('sin evidencia y sin fallback → []', () => {
    const warnings: string[] = [];
    expect(applyCategoryEvidenceFallback([], '', 's', warnings)).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('merge prioriza WORK_EXPERIENCE sobre SKILLS_SECTION', () => {
    const merged = mergeEvidenceItems([
      {
        sourceType: 'SKILLS_SECTION',
        evidenceText: 'Lista: Docker',
        occurrenceIndex: 1,
      },
      {
        sourceType: 'WORK_EXPERIENCE',
        evidenceText: 'Contenerización con Docker en producción',
        occurrenceIndex: 1,
      },
    ]);
    expect(merged[0].sourceType).toBe('WORK_EXPERIENCE');
  });

  it('validate: skill con evidenceItems', () => {
    const result = validateExtractedCvSkills({
      categories: [
        {
          category: 'Backend',
          evidence: 'Backend: NestJS.',
          skills: [
            {
              originalName: 'NestJS',
              normalizedName: 'NestJS',
              skillType: 'TECHNOLOGY',
              confidence: 1,
              isExplicit: true,
              evidenceItems: [
                {
                  sourceType: 'WORK_EXPERIENCE',
                  evidenceText: 'APIs REST con NestJS',
                  occurrenceIndex: 1,
                },
              ],
            },
          ],
        },
      ],
      languages: [],
      certifications: [],
      warnings: [],
    });
    expect(result.categories[0].skills[0].evidenceItems).toHaveLength(1);
    expect(result.categories[0].skills[0].evidenceItems[0].sourceType).toBe(
      'WORK_EXPERIENCE',
    );
  });

  it('validate: compatibilidad sin evidenceItems → fallback categoría', () => {
    const result = validateExtractedCvSkills({
      categories: [
        {
          category: 'Frontend',
          evidence: 'Frontend: React, TypeScript.',
          skills: [
            {
              originalName: 'React',
              normalizedName: 'React',
              skillType: 'TECHNOLOGY',
              confidence: 1,
              isExplicit: true,
            },
          ],
        },
      ],
      languages: [],
      certifications: [],
      warnings: [],
    });
    const skill = result.categories[0].skills[0];
    expect(skill.evidenceItems).toHaveLength(1);
    expect(skill.evidenceItems[0].isFallback).toBe(true);
    expect(skill.evidenceItems[0].evidenceText).toBe(
      'Frontend: React, TypeScript.',
    );
    expect(result.warnings.some((w) => w.includes('heredó evidence'))).toBe(
      true,
    );
  });

  it('validate: consolidación conceptual vía merge de dos apariciones', () => {
    const a: SkillEvidenceItem[] = [
      {
        sourceType: 'SKILLS_SECTION',
        evidenceText: 'Scrum',
        occurrenceIndex: 1,
      },
    ];
    const b: SkillEvidenceItem[] = [
      {
        sourceType: 'CERTIFICATION',
        evidenceText: 'Scrum Foundation Professional Certificate',
        occurrenceIndex: 1,
      },
    ];
    const merged = mergeEvidenceItems([...a, ...b]);
    expect(merged).toHaveLength(2);
    expect(merged[0].sourceType).toBe('CERTIFICATION');
    expect(merged.map((x) => x.occurrenceIndex)).toEqual([1, 2]);
  });
});
