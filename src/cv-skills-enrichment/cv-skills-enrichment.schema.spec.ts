import { CV_SKILLS_ENRICHER_JSON_SCHEMA } from './cv-skills-enrichment.schema';
import { EVIDENCE_SOURCE_TYPES } from '../cv-skills/cv-skills.types';

describe('CV_SKILLS_ENRICHER_JSON_SCHEMA', () => {
  it('exige skills y warnings', () => {
    expect(CV_SKILLS_ENRICHER_JSON_SCHEMA.required).toEqual([
      'skills',
      'warnings',
    ]);
  });

  it('usa enum cerrado de sourceType', () => {
    const item =
      CV_SKILLS_ENRICHER_JSON_SCHEMA.properties.skills.items.properties
        .evidenceItems.items;
    expect(item.properties.sourceType.enum).toEqual([...EVIDENCE_SOURCE_TYPES]);
  });

  it('requiere extractionSkillId, normalizedName, evidenceItems', () => {
    expect(
      CV_SKILLS_ENRICHER_JSON_SCHEMA.properties.skills.items.required,
    ).toEqual(['extractionSkillId', 'normalizedName', 'evidenceItems']);
  });

  it('no incluye campos prohibidos en el schema raíz', () => {
    const props = Object.keys(CV_SKILLS_ENRICHER_JSON_SCHEMA.properties);
    expect(props).not.toContain('categories');
    expect(props).not.toContain('macroattributes');
    expect(props).not.toContain('scores');
  });
});
