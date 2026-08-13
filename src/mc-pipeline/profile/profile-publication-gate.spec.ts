import {
  classifyFieldPublication,
  isPublishableField,
  selectPublishableFields,
} from './profile-publication-gate';
import type { ProfileFieldBlock } from './profile.types';

function block(
  partial: Partial<ProfileFieldBlock> &
    Pick<ProfileFieldBlock, 'fieldCode' | 'role'>,
): ProfileFieldBlock {
  return {
    specialties: [],
    skills: [],
    toolsTechnologies: [],
    skillDimensionMappings: [],
    radar: { fieldCode: partial.fieldCode, axes: [] },
    evidenceVolume: 'LOW',
    evidenceUnitCount: 0,
    ...partial,
  };
}

describe('profile-publication-gate (FASE 12A)', () => {
  it('PRIMARY DATA_ANALYTICS with OBSERVED specialty is PUBLISHABLE (not taxonomy pending)', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'DATA_ANALYTICS',
        role: 'PRIMARY',
        specialties: [
          { specialtyCode: 'BUSINESS_INTELLIGENCE', confidence: 0.9 },
        ],
      }),
    );
    expect(d.status).toBe('PUBLISHABLE');
    expect(d.taxonomyPending).toBe(false);
    expect(d.catalogAvailable).toBe(true);
    expect(d.reasonCode).toBe('PRIMARY_WITH_OBSERVED_SPECIALTY');
  });

  it('PRIMARY DIGITAL_MARKETING with OBSERVED specialty is PUBLISHABLE (not taxonomy pending)', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'DIGITAL_MARKETING',
        role: 'PRIMARY',
        specialties: [{ specialtyCode: 'GROWTH_MARKETING', confidence: 0.9 }],
      }),
    );
    expect(d.status).toBe('PUBLISHABLE');
    expect(d.taxonomyPending).toBe(false);
    expect(d.catalogAvailable).toBe(true);
    expect(d.reasonCode).toBe('PRIMARY_WITH_OBSERVED_SPECIALTY');
  });

  it('PRIMARY CUSTOMER_SUCCESS with OBSERVED specialty is PUBLISHABLE (not taxonomy pending)', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'CUSTOMER_SUCCESS',
        role: 'PRIMARY',
        specialties: [
          { specialtyCode: 'CUSTOMER_INTAKE_ONBOARDING', confidence: 0.9 },
        ],
      }),
    );
    expect(d.status).toBe('PUBLISHABLE');
    expect(d.taxonomyPending).toBe(false);
    expect(d.catalogAvailable).toBe(true);
    expect(d.reasonCode).toBe('PRIMARY_WITH_OBSERVED_SPECIALTY');
  });

  it('PRIMARY PEOPLE_HR with OBSERVED specialty is PUBLISHABLE (not taxonomy pending)', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'PEOPLE_HR',
        role: 'PRIMARY',
        specialties: [
          { specialtyCode: 'TALENT_ACQUISITION', confidence: 0.9 },
        ],
      }),
    );
    expect(d.status).toBe('PUBLISHABLE');
    expect(d.taxonomyPending).toBe(false);
    expect(d.catalogAvailable).toBe(true);
    expect(d.reasonCode).toBe('PRIMARY_WITH_OBSERVED_SPECIALTY');
  });

  it('SECONDARY PEOPLE_HR with OBSERVED specialty is PUBLISHABLE', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'PEOPLE_HR',
        role: 'SECONDARY',
        specialties: [
          { specialtyCode: 'WORKFORCE_ADMINISTRATION', confidence: 0.8 },
        ],
      }),
    );
    expect(d.status).toBe('PUBLISHABLE');
    expect(d.taxonomyPending).toBe(false);
    expect(d.reasonCode).toBe('SECONDARY_WITH_OBSERVED_SPECIALTY');
  });

  it('SECONDARY PEOPLE_HR with catalog but zero OBSERVED specialties is PROVENANCE_ONLY', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'PEOPLE_HR',
        role: 'SECONDARY',
        toolsTechnologies: ['Workday'],
      }),
    );
    expect(d.status).toBe('PROVENANCE_ONLY');
    expect(d.taxonomyPending).toBe(false);
    expect(d.reasonCode).toBe('SECONDARY_NO_OBSERVED_SPECIALTY');
  });

  it('PRIMARY without specialty catalog remains PUBLISHABLE (taxonomy pending)', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'ACADEMIC_RESEARCH',
        role: 'PRIMARY',
      }),
    );
    expect(d.status).toBe('PUBLISHABLE');
    expect(d.taxonomyPending).toBe(true);
    expect(d.reasonCode).toBe('PRIMARY_TAXONOMY_PENDING');
  });

  it('SECONDARY without specialty catalog is PROVENANCE_ONLY', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'ACADEMIC_RESEARCH',
        role: 'SECONDARY',
      }),
    );
    expect(d.status).toBe('PROVENANCE_ONLY');
    expect(d.reasonCode).toBe('SECONDARY_TAXONOMY_NOT_AVAILABLE');
  });

  it('PRIMARY IT_SYSTEMS with OBSERVED specialty is PUBLISHABLE (not taxonomy pending)', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'IT_SYSTEMS',
        role: 'PRIMARY',
        specialties: [
          { specialtyCode: 'NETWORK_INFRASTRUCTURE', confidence: 0.9 },
        ],
      }),
    );
    expect(d.status).toBe('PUBLISHABLE');
    expect(d.taxonomyPending).toBe(false);
    expect(d.catalogAvailable).toBe(true);
    expect(d.reasonCode).toBe('PRIMARY_WITH_OBSERVED_SPECIALTY');
  });

  it('SECONDARY IT_SYSTEMS with OBSERVED specialty is PUBLISHABLE', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'IT_SYSTEMS',
        role: 'SECONDARY',
        specialties: [
          { specialtyCode: 'SYSTEMS_ADMINISTRATION', confidence: 0.8 },
        ],
      }),
    );
    expect(d.status).toBe('PUBLISHABLE');
    expect(d.taxonomyPending).toBe(false);
    expect(d.reasonCode).toBe('SECONDARY_WITH_OBSERVED_SPECIALTY');
  });

  it('SECONDARY IT_SYSTEMS with catalog but zero OBSERVED specialties is PROVENANCE_ONLY', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'IT_SYSTEMS',
        role: 'SECONDARY',
        toolsTechnologies: ['GLPI', 'M365'],
      }),
    );
    expect(d.status).toBe('PROVENANCE_ONLY');
    expect(d.taxonomyPending).toBe(false);
    expect(d.reasonCode).toBe('SECONDARY_NO_OBSERVED_SPECIALTY');
  });

  it('PRIMARY LEGAL with OBSERVED specialty is PUBLISHABLE (not taxonomy pending)', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'LEGAL',
        role: 'PRIMARY',
        specialties: [{ specialtyCode: 'LEGAL_ADVISORY', confidence: 0.9 }],
      }),
    );
    expect(d.status).toBe('PUBLISHABLE');
    expect(d.taxonomyPending).toBe(false);
    expect(d.catalogAvailable).toBe(true);
    expect(d.reasonCode).toBe('PRIMARY_WITH_OBSERVED_SPECIALTY');
  });

  it('SECONDARY LEGAL with OBSERVED specialty is PUBLISHABLE', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'LEGAL',
        role: 'SECONDARY',
        specialties: [{ specialtyCode: 'LITIGATION_DISPUTES', confidence: 0.85 }],
      }),
    );
    expect(d.status).toBe('PUBLISHABLE');
    expect(d.taxonomyPending).toBe(false);
    expect(d.reasonCode).toBe('SECONDARY_WITH_OBSERVED_SPECIALTY');
  });

  it('SECONDARY LEGAL with catalog but zero OBSERVED specialties is PROVENANCE_ONLY', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'LEGAL',
        role: 'SECONDARY',
        toolsTechnologies: ['SECOP', 'Ley 80'],
      }),
    );
    expect(d.status).toBe('PROVENANCE_ONLY');
    expect(d.taxonomyPending).toBe(false);
    expect(d.reasonCode).toBe('SECONDARY_NO_OBSERVED_SPECIALTY');
  });

  it('SECONDARY with catalog but zero OBSERVED specialties is PROVENANCE_ONLY', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'AUDIOVISUAL_PRODUCTION',
        role: 'SECONDARY',
        toolsTechnologies: ['Premiere'],
      }),
    );
    expect(d.status).toBe('PROVENANCE_ONLY');
    expect(d.reasonCode).toBe('SECONDARY_NO_OBSERVED_SPECIALTY');
  });

  it('SECONDARY with ≥1 OBSERVED specialty is PUBLISHABLE', () => {
    const d = classifyFieldPublication(
      block({
        fieldCode: 'AUDIOVISUAL_PRODUCTION',
        role: 'SECONDARY',
        specialties: [{ specialtyCode: 'VIDEO_PRODUCTION', confidence: 0.9 }],
      }),
    );
    expect(d.status).toBe('PUBLISHABLE');
    expect(d.reasonCode).toBe('SECONDARY_WITH_OBSERVED_SPECIALTY');
  });

  it('selectPublishableFields drops empty secondaries (Danna-like)', () => {
    const fields = [
      block({
        fieldCode: 'COMMUNICATIONS',
        role: 'PRIMARY',
        specialties: [
          { specialtyCode: 'DIGITAL_COMMUNICATIONS', confidence: 0.85 },
        ],
      }),
      block({
        fieldCode: 'AUDIOVISUAL_PRODUCTION',
        role: 'SECONDARY',
      }),
      block({
        fieldCode: 'IT_SYSTEMS',
        role: 'SECONDARY',
      }),
      block({
        fieldCode: 'VISUAL_DESIGN',
        role: 'SECONDARY',
      }),
    ];
    const pub = selectPublishableFields(fields);
    expect(pub.map((f) => f.fieldCode)).toEqual(['COMMUNICATIONS']);
  });

  it('honors explicit publicationStatus on blocks', () => {
    const kept = block({
      fieldCode: 'VISUAL_DESIGN',
      role: 'SECONDARY',
      publicationStatus: 'PUBLISHABLE',
    });
    const dropped = block({
      fieldCode: 'AUDIOVISUAL_PRODUCTION',
      role: 'SECONDARY',
      specialties: [{ specialtyCode: 'VIDEO_PRODUCTION', confidence: 0.9 }],
      publicationStatus: 'PROVENANCE_ONLY',
    });
    expect(isPublishableField(kept)).toBe(true);
    expect(isPublishableField(dropped)).toBe(false);
  });
});
