import {
  assertImportWriteFlags,
  parseCuratedImportCliArgs,
} from './curated-profile.import-cli-args';
import { computeCuratedContentFingerprint } from './curated-profile.fingerprint';
import { buildCuratedImportSkillPlan } from './curated-profile.import-policy';
import { buildSoftwareCuratedProfileFixture } from './curated-profile.fixture';
import { assertSinglePersonDocument } from './curated-profile.importer';
import type { CuratedProfileValidationReport } from './curated-profile.types';
import { CURATED_PROFILE_SCHEMA_VERSION_V10 } from './curated-profile.constants';
import { validateCuratedProfileStructure } from './curated-profile.validate-structure';

function baseValidation(
  overrides: Partial<CuratedProfileValidationReport> = {},
): CuratedProfileValidationReport {
  const doc = buildSoftwareCuratedProfileFixture('1234567890');
  return {
    schemaVersion: doc.schemaVersion,
    valid: true,
    person: {
      found: true,
      personId: '1',
      documentMasked: '******7890',
      isActive: true,
      personCvId: '2',
      activeCvCount: 1,
      ambiguousPersonCount: 0,
    },
    domain: {
      inputCode: 'SOFTWARE',
      inputName: 'Desarrollo de Software',
      matchedDomainId: '4',
      matchedName: 'Desarrollo de Software',
      status: 'EXISTING',
      catalogVersionId: '3',
      catalogVersion: 'mc1.8',
    },
    specialties: [
      {
        inputCode: 'SOFTWARE_BACKEND',
        inputName: 'Desarrollo backend',
        matchedSpecialtyId: '21',
        matchedName: 'Desarrollo backend',
        domainCode: 'SOFTWARE',
        lifecycleStatus: 'ACTIVE',
        status: 'EXISTING',
        mappingSkillCount: 11,
      },
    ],
    skills: {
      existing: [
        {
          inputCanonicalName: 'Java',
          inputDisplayName: 'Java',
          inputSkillType: 'TECHNOLOGY',
          specialtyCode: 'SOFTWARE_BACKEND',
          status: 'EXISTING',
          matchedSkillId: '10',
          matchedNormalizedName: 'Java',
          matchedSkillType: 'TECHNOLOGY',
          matchedAliasKey: null,
          matchedAliasName: null,
          normalizationMethod: 'EXACT_KEY',
          evidenceCount: 1,
          hasMappingToSpecialty: false,
          confidence: 0.98,
        },
      ],
      resolvedAliases: [
        {
          inputCanonicalName: 'js',
          inputDisplayName: 'JS',
          inputSkillType: 'TECHNOLOGY',
          specialtyCode: 'SOFTWARE_BACKEND',
          status: 'ALIAS',
          matchedSkillId: '27',
          matchedNormalizedName: 'JavaScript',
          matchedSkillType: 'TECHNOLOGY',
          matchedAliasKey: 'js',
          matchedAliasName: 'js',
          normalizationMethod: 'SAFE_SKILL_ALIASES',
          evidenceCount: 1,
          hasMappingToSpecialty: true,
          confidence: 0.9,
        },
      ],
      proposed: [
        {
          inputCanonicalName: 'Mc1PilotHypotheticalFramework',
          inputDisplayName: 'Mc1 Pilot Hypothetical Framework',
          inputSkillType: 'TECHNOLOGY',
          specialtyCode: 'SOFTWARE_BACKEND',
          status: 'PROPOSED',
          matchedSkillId: null,
          matchedNormalizedName: null,
          matchedSkillType: null,
          matchedAliasKey: null,
          matchedAliasName: null,
          normalizationMethod: 'NONE',
          evidenceCount: 1,
          hasMappingToSpecialty: null,
          confidence: 0.7,
        },
        {
          inputCanonicalName: 'Mc1PilotOmitSkill',
          inputDisplayName: 'Mc1 Pilot Omit Skill',
          inputSkillType: 'TECHNOLOGY',
          specialtyCode: 'SOFTWARE_BACKEND',
          status: 'PROPOSED',
          matchedSkillId: null,
          matchedNormalizedName: null,
          matchedSkillType: null,
          matchedAliasKey: null,
          matchedAliasName: null,
          normalizationMethod: 'NONE',
          evidenceCount: 1,
          hasMappingToSpecialty: null,
          confidence: 0.5,
        },
      ],
      ambiguous: [],
      invalid: [],
    },
    errors: [],
    warnings: [],
    summary: {
      errorCount: 0,
      warningCount: 0,
      existingSkillCount: 1,
      aliasSkillCount: 1,
      proposedSkillCount: 2,
      ambiguousSkillCount: 0,
      invalidSkillCount: 0,
    },
    ...overrides,
  };
}

describe('curated-profile import policy / fingerprint / CLI', () => {
  it('acepta schema 1.0.0 y 1.1.0', () => {
    const v11 = validateCuratedProfileStructure(
      buildSoftwareCuratedProfileFixture(),
    );
    expect(v11.ok).toBe(true);

    const v10doc = {
      ...buildSoftwareCuratedProfileFixture(),
      schemaVersion: CURATED_PROFILE_SCHEMA_VERSION_V10,
    };
    // strip reviewDecision for 1.0.0 style
    for (const s of v10doc.specialties) {
      for (const sk of s.skills) {
        delete sk.reviewDecision;
      }
    }
    expect(validateCuratedProfileStructure(v10doc).ok).toBe(true);
  });

  it('plan: EXISTING, ALIAS, APPROVED_FOR_CREATION, OMIT', () => {
    const doc = buildSoftwareCuratedProfileFixture('1234567890');
    const plan = buildCuratedImportSkillPlan({
      document: doc,
      validation: baseValidation(),
    });
    expect(plan.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
    expect(
      plan.skillPlans.filter((p) => p.action === 'INCLUDE'),
    ).toHaveLength(2);
    expect(
      plan.skillPlans.filter((p) => p.action === 'CREATE_THEN_INCLUDE'),
    ).toHaveLength(1);
    expect(plan.skillPlans.filter((p) => p.action === 'OMIT')).toHaveLength(1);
  });

  it('bloquea especialidad PROPOSED en import', () => {
    const doc = buildSoftwareCuratedProfileFixture('1234567890');
    const validation = baseValidation({
      specialties: [
        {
          inputCode: 'SOFTWARE_BACKEND',
          inputName: null,
          matchedSpecialtyId: null,
          matchedName: null,
          domainCode: null,
          lifecycleStatus: null,
          status: 'PROPOSED',
          mappingSkillCount: 0,
        },
      ],
    });
    const plan = buildCuratedImportSkillPlan({ document: doc, validation });
    expect(
      plan.errors.some((e) => e.code === 'IMPORT_SPECIALTY_PROPOSED'),
    ).toBe(true);
  });

  it('bloquea dominio PROPOSED', () => {
    const doc = buildSoftwareCuratedProfileFixture('1234567890');
    const validation = baseValidation({
      domain: {
        inputCode: 'CONTENT',
        inputName: null,
        matchedDomainId: null,
        matchedName: null,
        status: 'PROPOSED',
        catalogVersionId: null,
        catalogVersion: null,
      },
    });
    doc.domain.code = 'CONTENT';
    doc.profile.primaryDomainCode = 'CONTENT';
    const plan = buildCuratedImportSkillPlan({ document: doc, validation });
    expect(plan.errors.some((e) => e.code === 'IMPORT_DOMAIN_PROPOSED')).toBe(
      true,
    );
  });

  it('fingerprint estable e independiente de timestamps', () => {
    const doc = buildSoftwareCuratedProfileFixture('1234567890');
    const a = computeCuratedContentFingerprint({
      document: doc,
      personId: '1',
      personCvId: '2',
    });
    const b = computeCuratedContentFingerprint({
      document: doc,
      personId: '1',
      personCvId: '2',
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('CLI: execute sin confirm falla; confirm sin execute falla', () => {
    expect(() =>
      assertImportWriteFlags(
        parseCuratedImportCliArgs(['--file=a.json', '--execute']),
      ),
    ).toThrow(/--confirm/);
    expect(() =>
      assertImportWriteFlags(
        parseCuratedImportCliArgs(['--file=a.json', '--confirm']),
      ),
    ).toThrow(/--execute/);
    expect(() =>
      assertImportWriteFlags(
        parseCuratedImportCliArgs([
          '--file=a.json',
          '--execute',
          '--confirm',
        ]),
      ),
    ).not.toThrow();
  });

  it('rechaza archivo multi-persona', () => {
    expect(() => assertSinglePersonDocument([{ a: 1 }, { b: 2 }])).toThrow(
      /único perfil/,
    );
    expect(() =>
      assertSinglePersonDocument({ persons: [{}, {}] }),
    ).toThrow(/más de una persona/);
  });

  it('APPROVED_FOR_CREATION sin skillType es error estructural', () => {
    const doc = buildSoftwareCuratedProfileFixture();
    const skill = doc.specialties[0].skills.find(
      (s) => s.reviewDecision === 'APPROVED_FOR_CREATION',
    )!;
    delete skill.skillType;
    const result = validateCuratedProfileStructure(doc);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === 'SKILL_TYPE_REQUIRED_FOR_CREATION'),
    ).toBe(true);
  });
});
