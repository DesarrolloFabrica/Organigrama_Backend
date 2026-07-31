import type { DataSource } from 'typeorm';
import {
  importCuratedProfile,
  type CuratedImportDeps,
} from './curated-profile.importer';
import { buildSoftwareCuratedProfileFixture } from './curated-profile.fixture';
import { createCuratedCatalogLookup } from './curated-profile.catalog-lookup';
import { CURATED_EXTRACTION_MAPPING } from './curated-profile.constants';

jest.mock('./curated-profile.validate', () => {
  const actual = jest.requireActual('./curated-profile.validate');
  return {
    ...actual,
    validateCuratedProfile: jest.fn(),
  };
});

import { validateCuratedProfile } from './curated-profile.validate';

const validateMock = validateCuratedProfile as jest.MockedFunction<
  typeof validateCuratedProfile
>;

function mockDataSource(queryImpl?: (sql: string, params?: unknown[]) => Promise<unknown>): DataSource {
  return {
    query: queryImpl ?? (async () => []),
    createQueryRunner: () => ({
      connect: async () => undefined,
      startTransaction: async () => undefined,
      commitTransaction: async () => undefined,
      rollbackTransaction: async () => undefined,
      release: async () => undefined,
      manager: { query: async () => [] },
    }),
  } as unknown as DataSource;
}

describe('importCuratedProfile dry-run', () => {
  beforeEach(() => {
    validateMock.mockReset();
  });

  it('dry-run READY sin escritura cuando validación y política OK', async () => {
    const doc = buildSoftwareCuratedProfileFixture('1234567890');
    validateMock.mockResolvedValue({
      schemaVersion: doc.schemaVersion,
      valid: true,
      person: {
        found: true,
        personId: '42',
        documentMasked: '******7890',
        isActive: true,
        personCvId: '99',
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
          inputName: 'Backend',
          matchedSpecialtyId: '21',
          matchedName: 'Backend',
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
            inputDisplayName: null,
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
            inputDisplayName: null,
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
    });

    const persistSpy = jest.fn();
    const deps: CuratedImportDeps = {
      dataSource: mockDataSource(async (sql: string) => {
        if (sql.includes('is_active = TRUE') && sql.includes('cv_extraction')) {
          return [{ id: '100' }];
        }
        if (sql.includes('pdf_sha256')) return [];
        return [];
      }),
      extractionPersistence: {
        persistSucceededExtraction: persistSpy,
      } as unknown as CuratedImportDeps['extractionPersistence'],
      enrichmentPersistence: {} as CuratedImportDeps['enrichmentPersistence'],
      evidencePersistence: {} as CuratedImportDeps['evidencePersistence'],
      pa2: {} as CuratedImportDeps['pa2'],
    };

    const report = await importCuratedProfile(doc, deps, { execute: false });
    expect(report.mode).toBe('DRY_RUN');
    expect(report.outcome).toBe('READY');
    expect(report.person.documentMasked).toBe('******7890');
    expect(report.skills.approvedForCreation).toEqual([
      'Mc1PilotHypotheticalFramework',
    ]);
    expect(report.skills.omitted).toContain('Mc1PilotOmitSkill');
    expect(report.plannedExtraction.model).toBe(
      CURATED_EXTRACTION_MAPPING.model,
    );
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('NO_OP cuando firma idéntica ya activa', async () => {
    const doc = buildSoftwareCuratedProfileFixture('1234567890');
    validateMock.mockResolvedValue({
      schemaVersion: doc.schemaVersion,
      valid: true,
      person: {
        found: true,
        personId: '42',
        documentMasked: '******7890',
        isActive: true,
        personCvId: '99',
        activeCvCount: 1,
        ambiguousPersonCount: 0,
      },
      domain: {
        inputCode: 'SOFTWARE',
        inputName: null,
        matchedDomainId: '4',
        matchedName: null,
        status: 'EXISTING',
        catalogVersionId: '3',
        catalogVersion: 'mc1.8',
      },
      specialties: [
        {
          inputCode: 'SOFTWARE_BACKEND',
          inputName: null,
          matchedSpecialtyId: '21',
          matchedName: null,
          domainCode: 'SOFTWARE',
          lifecycleStatus: 'ACTIVE',
          status: 'EXISTING',
          mappingSkillCount: 1,
        },
      ],
      skills: {
        existing: [
          {
            inputCanonicalName: 'Java',
            inputDisplayName: null,
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
            hasMappingToSpecialty: true,
            confidence: 0.98,
          },
        ],
        resolvedAliases: [
          {
            inputCanonicalName: 'js',
            inputDisplayName: null,
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
            inputDisplayName: null,
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
            inputDisplayName: null,
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
    });

    const deps: CuratedImportDeps = {
      dataSource: mockDataSource(async (sql: string) => {
        if (sql.includes('is_active = TRUE') && sql.includes('LIMIT 1')) {
          return [{ id: '100' }];
        }
        if (sql.includes('pdf_sha256')) {
          return [{ id: '100', isActive: true }];
        }
        return [];
      }),
      extractionPersistence: {
        persistSucceededExtraction: jest.fn(),
      } as unknown as CuratedImportDeps['extractionPersistence'],
      enrichmentPersistence: {} as CuratedImportDeps['enrichmentPersistence'],
      evidencePersistence: {} as CuratedImportDeps['evidencePersistence'],
      pa2: {} as CuratedImportDeps['pa2'],
    };

    const report = await importCuratedProfile(doc, deps, { execute: false });
    expect(report.outcome).toBe('NO_OP');
  });
});

describe('createCuratedCatalogLookup export', () => {
  it('exporta factory', () => {
    expect(typeof createCuratedCatalogLookup).toBe('function');
  });
});
