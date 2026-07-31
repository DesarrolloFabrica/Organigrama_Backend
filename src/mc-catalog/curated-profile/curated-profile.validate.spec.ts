import type {
  CuratedAliasRow,
  CuratedCatalogLookup,
  CuratedDomainRow,
  CuratedPersonCvRow,
  CuratedPersonRow,
  CuratedSkillRow,
  CuratedSpecialtyRow,
} from './curated-profile.catalog-lookup';
import { buildSoftwareCuratedProfileFixture } from './curated-profile.fixture';
import { validateCuratedProfile } from './curated-profile.validate';

function mockLookup(partial: Partial<CuratedCatalogLookup>): CuratedCatalogLookup {
  return {
    findPersonsByDocument: async () => [],
    findActivePersonCvs: async () => [],
    findActiveDomainByCode: async () => null,
    findSpecialtiesByCodes: async () => [],
    findSkillsByKeys: async () => [],
    findSkillsByNormalizedKeys: async () => [],
    findAliasesByKeys: async () => [],
    hasSpecialtyMapping: async () => false,
    ...partial,
  };
}

const person: CuratedPersonRow = {
  personId: '101',
  document: '1234567890',
  isActive: true,
};

const cv: CuratedPersonCvRow = { id: '202', personId: '101' };

const domain: CuratedDomainRow = {
  id: '1',
  code: 'SOFTWARE',
  name: 'Desarrollo de Software',
  isActive: true,
  catalogVersionId: '3',
  catalogVersion: 'mc1.8-2026-07-28',
};

const specialty: CuratedSpecialtyRow = {
  id: '10',
  code: 'SOFTWARE_BACKEND',
  name: 'Desarrollo backend',
  domainId: '1',
  domainCode: 'SOFTWARE',
  lifecycleStatus: 'ACTIVE',
  isActive: true,
  mappingSkillCount: 12,
};

const javaSkill: CuratedSkillRow = {
  id: '501',
  normalizedName: 'Java',
  normalizedKey: 'java',
  skillType: 'TECHNOLOGY',
  isActive: true,
};

const jsSkill: CuratedSkillRow = {
  id: '502',
  normalizedName: 'JavaScript',
  normalizedKey: 'javascript',
  skillType: 'TECHNOLOGY',
  isActive: true,
};

describe('validateCuratedProfile (catalog mocks)', () => {
  it('resuelve persona, CV, dominio, especialidad, skill existente, alias y propuesta', async () => {
    const lookup = mockLookup({
      findPersonsByDocument: async () => [person],
      findActivePersonCvs: async () => [cv],
      findActiveDomainByCode: async () => domain,
      findSpecialtiesByCodes: async () => [specialty],
      findSkillsByNormalizedKeys: async () => [javaSkill, jsSkill],
      findAliasesByKeys: async () => [],
      hasSpecialtyMapping: async ({ skillId }) => skillId === '501',
    });

    const report = await validateCuratedProfile(
      buildSoftwareCuratedProfileFixture('1234567890'),
      lookup,
    );

    expect(report.person.found).toBe(true);
    expect(report.person.personId).toBe('101');
    expect(report.person.personCvId).toBe('202');
    expect(report.person.documentMasked).toBe('******7890');
    expect(report.domain?.status).toBe('EXISTING');
    expect(report.specialties[0].status).toBe('EXISTING');
    expect(report.skills.existing.some((s) => s.matchedNormalizedName === 'Java')).toBe(
      true,
    );
    expect(
      report.skills.resolvedAliases.some(
        (s) => s.matchedNormalizedName === 'JavaScript',
      ),
    ).toBe(true);
    expect(
      report.skills.proposed.some((s) =>
        s.inputCanonicalName.includes('Hypothetical'),
      ),
    ).toBe(true);
    expect(report.valid).toBe(true);
  });

  it('error si dominio inexistente (PROPOSED bloqueante)', async () => {
    const lookup = mockLookup({
      findPersonsByDocument: async () => [person],
      findActivePersonCvs: async () => [cv],
      findActiveDomainByCode: async () => null,
      findSpecialtiesByCodes: async () => [],
    });
    const doc = buildSoftwareCuratedProfileFixture('1234567890');
    doc.domain.code = 'CONTENT';
    doc.profile.primaryDomainCode = 'CONTENT';
    const report = await validateCuratedProfile(doc, lookup);
    expect(report.valid).toBe(false);
    expect(
      report.errors.some((e) => e.code === 'DOMAIN_PROPOSED_OR_MISSING'),
    ).toBe(true);
    expect(report.domain?.status).toBe('PROPOSED');
  });

  it('error si especialidad pertenece a otro dominio', async () => {
    const wrong: CuratedSpecialtyRow = {
      ...specialty,
      code: 'VISUAL_GRAPHIC',
      domainCode: 'VISUAL_DESIGN',
    };
    const lookup = mockLookup({
      findPersonsByDocument: async () => [person],
      findActivePersonCvs: async () => [cv],
      findActiveDomainByCode: async () => domain,
      findSpecialtiesByCodes: async () => [wrong],
      findSkillsByNormalizedKeys: async () => [javaSkill, jsSkill],
    });
    const doc = buildSoftwareCuratedProfileFixture('1234567890');
    doc.specialties[0].code = 'VISUAL_GRAPHIC';
    const report = await validateCuratedProfile(doc, lookup);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.code === 'SPECIALTY_WRONG_DOMAIN')).toBe(
      true,
    );
  });

  it('error si documento no encontrado', async () => {
    const lookup = mockLookup({});
    const report = await validateCuratedProfile(
      buildSoftwareCuratedProfileFixture('9999999999'),
      lookup,
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.code === 'PERSON_NOT_FOUND')).toBe(true);
  });

  it('error si persona sin CV activo', async () => {
    const lookup = mockLookup({
      findPersonsByDocument: async () => [person],
      findActivePersonCvs: async () => [],
      findActiveDomainByCode: async () => domain,
      findSpecialtiesByCodes: async () => [specialty],
      findSkillsByNormalizedKeys: async () => [javaSkill, jsSkill],
    });
    const report = await validateCuratedProfile(
      buildSoftwareCuratedProfileFixture('1234567890'),
      lookup,
    );
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.code === 'PERSON_CV_MISSING')).toBe(
      true,
    );
  });

  it('warning SPECIALTY_PROPOSED si especialidad no existe', async () => {
    const lookup = mockLookup({
      findPersonsByDocument: async () => [person],
      findActivePersonCvs: async () => [cv],
      findActiveDomainByCode: async () => domain,
      findSpecialtiesByCodes: async () => [],
      findSkillsByNormalizedKeys: async () => [javaSkill, jsSkill],
    });
    const doc = buildSoftwareCuratedProfileFixture('1234567890');
    doc.specialties[0].code = 'SOFTWARE_NEW_THING';
    const report = await validateCuratedProfile(doc, lookup);
    expect(report.specialties[0].status).toBe('PROPOSED');
    expect(report.warnings.some((w) => w.code === 'SPECIALTY_PROPOSED')).toBe(
      true,
    );
    expect(report.valid).toBe(true);
  });

  it('resuelve alias vía cv_skill_alias', async () => {
    const alias: CuratedAliasRow = {
      aliasKey: 'js',
      aliasName: 'js',
      skillId: '502',
      skillNormalizedName: 'JavaScript',
      skillNormalizedKey: 'javascript',
      skillType: 'TECHNOLOGY',
      skillIsActive: true,
    };
    const lookup = mockLookup({
      findPersonsByDocument: async () => [person],
      findActivePersonCvs: async () => [cv],
      findActiveDomainByCode: async () => domain,
      findSpecialtiesByCodes: async () => [specialty],
      findSkillsByNormalizedKeys: async () => [javaSkill],
      findAliasesByKeys: async () => [alias],
      hasSpecialtyMapping: async () => true,
    });
    const doc = buildSoftwareCuratedProfileFixture('1234567890');
    // solo skill js para forzar camino alias BD
    doc.specialties[0].skills = [
      {
        canonicalName: 'js',
        skillType: 'TECHNOLOGY',
        confidence: 0.9,
        evidence: [
          {
            text: 'Uso de JavaScript en servicios backend documentados en el CV.',
            evidenceType: 'EXPLICIT',
            sourceSection: 'WORK_EXPERIENCE',
          },
        ],
      },
    ];
    const report = await validateCuratedProfile(doc, lookup);
    expect(report.skills.resolvedAliases).toHaveLength(1);
    expect(report.skills.resolvedAliases[0].matchedSkillId).toBe('502');
    expect(report.skills.resolvedAliases[0].normalizationMethod).toBe(
      'CV_SKILL_ALIAS',
    );
  });
});
