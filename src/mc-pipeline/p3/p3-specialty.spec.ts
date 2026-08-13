import {
  SPECIALTIES,
  SPECIALTY_CATALOG_SCOPE,
  SPECIALTY_CATALOG_VERSION,
  isReservedFutureSkillCode,
  resolveToKnownSpecialtyCode,
  specialtiesForField,
} from '../catalog/specialties-visual-education';
import { resolveFieldsToEvaluate } from './p3-context-loader';
import {
  assertP3ReferentialIntegrity,
  normalizeP3ModelOutput,
} from './p3-normalize';
import type { R1ContractEnvelope } from '../r1/r1.types';

describe('P3 specialty catalog scope (IT + LEGAL: VE + PPM + FA + SE + AV + COMM + DA + DM + CS + HR + IT + LEGAL)', () => {
  it('covers VISUAL_DESIGN, EDUCATION, PROJECT_PROGRAM_MGMT, FINANCE_ADMIN, SOFTWARE_ENGINEERING, AUDIOVISUAL_PRODUCTION, COMMUNICATIONS, DATA_ANALYTICS, DIGITAL_MARKETING, CUSTOMER_SUCCESS, PEOPLE_HR, IT_SYSTEMS and LEGAL', () => {
    expect([...SPECIALTY_CATALOG_SCOPE].sort()).toEqual([
      'AUDIOVISUAL_PRODUCTION',
      'COMMUNICATIONS',
      'CUSTOMER_SUCCESS',
      'DATA_ANALYTICS',
      'DIGITAL_MARKETING',
      'EDUCATION',
      'FINANCE_ADMIN',
      'IT_SYSTEMS',
      'LEGAL',
      'PEOPLE_HR',
      'PROJECT_PROGRAM_MGMT',
      'SOFTWARE_ENGINEERING',
      'VISUAL_DESIGN',
    ]);
  });

  it('omits DIGITAL_LEARNING/UI_DESIGN/CONTENT_PRODUCTION/MOTION_GRAPHICS/CONTENT_PRESENTER/ON_CAMERA as specialties', () => {
    expect(SPECIALTIES.some((s) => s.code === 'DIGITAL_LEARNING')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'UI_DESIGN')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'LEARNING_ASSESSMENT')).toBe(
      false,
    );
    expect(SPECIALTIES.some((s) => s.code === 'AGILE_SCRUM')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'PROCUREMENT_ADMINISTRATION')).toBe(
      false,
    );
    expect(SPECIALTIES.some((s) => s.code === 'FULL_STACK_ENGINEERING')).toBe(
      false,
    );
    expect(SPECIALTIES.some((s) => s.code === 'SOFTWARE_DATA')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'QA_TEST_AUTOMATION')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'CONTENT_PRODUCTION')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'MOTION_GRAPHICS')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'ANIMATION')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'AUDIOVISUAL_DIRECTION')).toBe(
      false,
    );
    expect(SPECIALTIES.some((s) => s.code === 'CONTENT_PRESENTER')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'ON_CAMERA_PRESENTATION')).toBe(
      false,
    );
    expect(SPECIALTIES.some((s) => s.code === 'CONTENT_COMMUNICATION')).toBe(
      false,
    );
    expect(SPECIALTIES.some((s) => s.code === 'COPYWRITING')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'POWER_BI_SPECIALIST')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'BUSINESS_ANALYTICS')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'GOOGLE_ADS_SPECIALIST')).toBe(
      false,
    );
    expect(SPECIALTIES.some((s) => s.code === 'CONTENT_MARKETING')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'CRM_SPECIALIST')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'B2B_SUPERVISOR')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'HR_GENERALIST')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'WELLBEING_SPECIALIST')).toBe(
      false,
    );
    expect(SPECIALTIES.some((s) => s.code === 'TEAM_LEADERSHIP_HR')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'TELECOM_ENGINEER')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'M365_ADMIN')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'GLPI_SPECIALIST')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'DBA_SQL_SERVER')).toBe(false);
    expect(SPECIALTIES.some((s) => s.code === 'LOW_CODE_AUTOMATION')).toBe(
      false,
    );
    for (const s of SPECIALTIES) {
      expect(SPECIALTY_CATALOG_SCOPE.has(s.parentField)).toBe(true);
    }
    expect(specialtiesForField('VISUAL_DESIGN').length).toBe(6);
    expect(specialtiesForField('EDUCATION').length).toBe(4);
    expect(specialtiesForField('PROJECT_PROGRAM_MGMT').length).toBe(4);
    expect(specialtiesForField('FINANCE_ADMIN').length).toBe(4);
    expect(specialtiesForField('SOFTWARE_ENGINEERING').length).toBe(4);
    expect(specialtiesForField('AUDIOVISUAL_PRODUCTION').length).toBe(4);
    expect(specialtiesForField('COMMUNICATIONS').length).toBe(4);
    expect(specialtiesForField('DATA_ANALYTICS').length).toBe(4);
    expect(specialtiesForField('DIGITAL_MARKETING').length).toBe(4);
    expect(specialtiesForField('CUSTOMER_SUCCESS').length).toBe(4);
    expect(specialtiesForField('PEOPLE_HR').length).toBe(2);
    expect(specialtiesForField('IT_SYSTEMS').length).toBe(4);
    expect(specialtiesForField('LEGAL').length).toBe(5);
  });

  it('LEGAL V1 specialties and negative controls in catalog exclusions', () => {
    const legal = specialtiesForField('LEGAL').map((s) => s.code);
    expect(legal).toEqual([
      'LEGAL_ADVISORY',
      'LEGAL_DOCUMENT_DRAFTING',
      'PUBLIC_SECTOR_CONTRACTING',
      'ADMINISTRATIVE_LAW',
      'LITIGATION_DISPUTES',
    ]);
    const secopSpec = SPECIALTIES.find((s) => s.code === 'PUBLIC_SECTOR_CONTRACTING')!;
    expect(secopSpec.exclusions.some((e) => /SECOP/i.test(e))).toBe(true);
    const adminSpec = SPECIALTIES.find((s) => s.code === 'ADMINISTRATIVE_LAW')!;
    expect(adminSpec.exclusions.some((e) => /Ley 80/i.test(e))).toBe(true);
    const advisory = SPECIALTIES.find((s) => s.code === 'LEGAL_ADVISORY')!;
    expect(advisory.exclusions.some((e) => /t[ií]tulo de abogado/i.test(e))).toBe(
      true,
    );
    expect(advisory.exclusions.some((e) => /docencia/i.test(e))).toBe(true);
  });

  it('maps LEGAL specialty aliases', () => {
    expect(SPECIALTY_CATALOG_VERSION).toBe('1.12.0');
    expect(resolveToKnownSpecialtyCode('UI_DESIGN')).toBe('UX_PRODUCT_DESIGN');
    expect(resolveToKnownSpecialtyCode('SOFTWARE_FRONTEND')).toBe(
      'FRONTEND_ENGINEERING',
    );
    expect(resolveToKnownSpecialtyCode('SOFTWARE_BACKEND')).toBe(
      'BACKEND_ENGINEERING',
    );
    expect(resolveToKnownSpecialtyCode('AV_EDITING')).toBe(
      'VIDEO_POST_PRODUCTION',
    );
    expect(resolveToKnownSpecialtyCode('AV_POST')).toBe('VIDEO_POST_PRODUCTION');
    expect(resolveToKnownSpecialtyCode('AV_PRODUCTION')).toBe('VIDEO_PRODUCTION');
    expect(resolveToKnownSpecialtyCode('AV_PHOTOGRAPHY')).toBe('PHOTOGRAPHY');
    expect(resolveToKnownSpecialtyCode('AV_SOUND')).toBe('AUDIO_PRODUCTION');
    expect(resolveToKnownSpecialtyCode('BI')).toBe('BUSINESS_INTELLIGENCE');
    expect(resolveToKnownSpecialtyCode('ETL_ENGINEERING')).toBe(
      'DATA_ENGINEERING',
    );
    expect(resolveToKnownSpecialtyCode('ML_ANALYTICS')).toBe(
      'PREDICTIVE_ANALYTICS',
    );
    expect(resolveToKnownSpecialtyCode('PERFORMANCE_MARKETING')).toBe(
      'GROWTH_MARKETING',
    );
    expect(resolveToKnownSpecialtyCode('GO_TO_MARKET')).toBe('PRODUCT_MARKETING');
    expect(resolveToKnownSpecialtyCode('CUSTOMER_ONBOARDING')).toBe(
      'CUSTOMER_INTAKE_ONBOARDING',
    );
    expect(resolveToKnownSpecialtyCode('CUSTOMER_SERVICE')).toBe(
      'CUSTOMER_SERVICE_SUPPORT',
    );
    expect(resolveToKnownSpecialtyCode('CUSTOMER_RETENTION')).toBe(
      'CUSTOMER_RETENTION_LOYALTY',
    );
    expect(resolveToKnownSpecialtyCode('RECRUITMENT')).toBe('TALENT_ACQUISITION');
    expect(resolveToKnownSpecialtyCode('PEOPLE_OPERATIONS')).toBe(
      'WORKFORCE_ADMINISTRATION',
    );
    expect(resolveToKnownSpecialtyCode('NETWORK_ADMIN')).toBe(
      'NETWORK_INFRASTRUCTURE',
    );
    expect(resolveToKnownSpecialtyCode('HELP_DESK')).toBe('IT_SERVICE_DESK');
    expect(resolveToKnownSpecialtyCode('SYSADMIN')).toBe(
      'SYSTEMS_ADMINISTRATION',
    );
    expect(resolveToKnownSpecialtyCode('IT_SECURITY')).toBe(
      'IT_SECURITY_OPERATIONS',
    );
    expect(isReservedFutureSkillCode('LEARNING_ASSESSMENT')).toBe(true);
    expect(resolveToKnownSpecialtyCode('LEARNING_ASSESSMENT')).toBeNull();
    expect(isReservedFutureSkillCode('AGILE_FACILITATION')).toBe(true);
    expect(isReservedFutureSkillCode('PROCUREMENT_PURCHASING')).toBe(true);
    expect(isReservedFutureSkillCode('TEST_AUTOMATION')).toBe(true);
    expect(isReservedFutureSkillCode('SOFTWARE_ARCHITECTURE_PRACTICE')).toBe(
      true,
    );
    expect(isReservedFutureSkillCode('COLOR_GRADING')).toBe(true);
    expect(isReservedFutureSkillCode('CAMERA_OPERATION')).toBe(true);
    expect(isReservedFutureSkillCode('ON_CAMERA_PRESENTATION')).toBe(true);
    expect(isReservedFutureSkillCode('COPYWRITING')).toBe(true);
    expect(isReservedFutureSkillCode('MARKETING_MIX_MODELING')).toBe(true);
    expect(isReservedFutureSkillCode('SEO_CONTENT_MARKETING')).toBe(true);
    expect(isReservedFutureSkillCode('CRM_ADMINISTRATION')).toBe(true);
    expect(isReservedFutureSkillCode('CONSULTATIVE_SELLING')).toBe(true);
    expect(isReservedFutureSkillCode('EMPLOYEE_WELLBEING')).toBe(true);
    expect(isReservedFutureSkillCode('EXIT_INTERVIEWS')).toBe(true);
    expect(isReservedFutureSkillCode('PERFORMANCE_MANAGEMENT')).toBe(true);
    expect(isReservedFutureSkillCode('CLOUD_INFRASTRUCTURE')).toBe(true);
    expect(isReservedFutureSkillCode('IT_ASSET_INVENTORY')).toBe(true);
    expect(isReservedFutureSkillCode('IDENTITY_ACCESS_MANAGEMENT')).toBe(true);
    expect(resolveToKnownSpecialtyCode('ON_CAMERA_PRESENTATION')).toBeNull();
    expect(resolveToKnownSpecialtyCode('CRM_ADMINISTRATION')).toBeNull();
    expect(resolveToKnownSpecialtyCode('EMPLOYEE_WELLBEING')).toBeNull();
    expect(resolveToKnownSpecialtyCode('CLOUD_INFRASTRUCTURE')).toBeNull();
    expect(resolveToKnownSpecialtyCode('IDENTITY_ACCESS_MANAGEMENT')).toBeNull();
    expect(resolveToKnownSpecialtyCode('LEGAL_COUNSEL')).toBe('LEGAL_ADVISORY');
    expect(resolveToKnownSpecialtyCode('LITIGATION')).toBe('LITIGATION_DISPUTES');
    expect(resolveToKnownSpecialtyCode('PUBLIC_CONTRACTING')).toBe(
      'PUBLIC_SECTOR_CONTRACTING',
    );
  });
});

describe('P3 field selection from R1', () => {
  function baseR1(
    partial: Partial<R1ContractEnvelope['payload']>,
  ): R1ContractEnvelope {
    return {
      contractCode: 'MC1.R1.DOMAIN_RESOLUTION',
      contractVersion: '1.0.0',
      stageCode: 'R1',
      registryFingerprint: 'x',
      campaignId: 'c',
      pipelineRunId: 'p',
      producedAt: new Date().toISOString(),
      errors: [],
      warnings: [],
      payload: {
        fieldResolutionStatus: 'MULTI_FIELD',
        resolutionStatus: 'MULTI_DOMAIN',
        primaryField: {
          fieldCode: 'VISUAL_DESIGN',
          sourceKey: 'VISUAL_DESIGN',
          catalogStatus: 'KNOWN',
          rank: 1,
          confidence: 0.88,
          candidateId: 'dc-1',
        },
        secondaryFields: [
          {
            fieldCode: 'EDUCATION',
            sourceKey: 'EDUCATION',
            catalogStatus: 'KNOWN',
            rank: 2,
            confidence: 0.82,
            candidateId: 'dc-2',
          },
        ],
        primaryDomainCode: 'VISUAL_DESIGN',
        secondaryDomainCodes: ['EDUCATION'],
        resolutionRuleVersion: 'r',
        configHash: 'h',
        decisionExplanation: 'e',
        decisionCodes: [],
        p2ExecutionId: 'e',
        p2OutcomeStatus: 'CANDIDATES_PRODUCED',
        snapshotId: '1',
        provenance: {
          stageCode: 'R1',
          mode: 'ARTIFACT_ONLY',
          inputSource: 'P2_CONTRACT',
          p2ArtifactDigest: null,
          generativeResultOrigin: 'RULES_ONLY',
        },
        ...partial,
      },
    };
  }

  it('MULTI_FIELD evaluates primary + secondary in scope', () => {
    const fields = resolveFieldsToEvaluate(baseR1({}));
    expect(fields.map((f) => f.fieldCode)).toEqual([
      'VISUAL_DESIGN',
      'EDUCATION',
    ]);
  });

  it('RESOLVED evaluates primary + catalogued secondaries (CLEAR_LEAD still emits secondaries)', () => {
    const fields = resolveFieldsToEvaluate(
      baseR1({
        fieldResolutionStatus: 'RESOLVED',
        resolutionStatus: 'RESOLVED_PRIMARY',
      }),
    );
    expect(fields.map((f) => f.fieldCode)).toEqual([
      'VISUAL_DESIGN',
      'EDUCATION',
    ]);
    expect(fields.map((f) => f.role)).toEqual(['PRIMARY', 'SECONDARY']);
  });

  it('resolves field.legal_administrative sourceKey to LEGAL primary (Edwar-like)', () => {
    const fields = resolveFieldsToEvaluate(
      baseR1({
        primaryField: {
          fieldCode: null,
          sourceKey: 'field.legal_administrative',
          catalogStatus: 'PROPOSED',
          rank: 1,
          confidence: 0.86,
          candidateId: 'dc-legal',
        },
        secondaryFields: [
          {
            fieldCode: 'EDUCATION',
            sourceKey: 'EDUCATION',
            catalogStatus: 'KNOWN',
            rank: 2,
            confidence: 0.8,
            candidateId: 'dc-ed',
          },
        ],
      }),
    );
    expect(fields.map((f) => f.fieldCode)).toEqual(['LEGAL', 'EDUCATION']);
    expect(fields.find((f) => f.fieldCode === 'LEGAL')?.role).toBe('PRIMARY');
  });

  it('resolves field.legal_services sourceKey to LEGAL secondary (Johana-like)', () => {
    const fields = resolveFieldsToEvaluate(
      baseR1({
        fieldResolutionStatus: 'RESOLVED',
        resolutionStatus: 'RESOLVED_PRIMARY',
        primaryField: {
          fieldCode: 'EDUCATION',
          sourceKey: 'EDUCATION',
          catalogStatus: 'KNOWN',
          rank: 1,
          confidence: 0.88,
          candidateId: 'dc-ed',
        },
        secondaryFields: [
          {
            fieldCode: null,
            sourceKey: 'field.legal_services',
            catalogStatus: 'PROPOSED',
            rank: 2,
            confidence: 0.85,
            candidateId: 'dc-legal',
          },
        ],
      }),
    );
    expect(fields.map((f) => f.fieldCode)).toEqual(['EDUCATION', 'LEGAL']);
    expect(fields.find((f) => f.fieldCode === 'LEGAL')?.role).toBe('SECONDARY');
  });

  it('RESOLVED drops secondaries outside specialty catalog scope', () => {
    const fields = resolveFieldsToEvaluate(
      baseR1({
        fieldResolutionStatus: 'RESOLVED',
        resolutionStatus: 'RESOLVED_PRIMARY',
        secondaryFields: [
          {
            fieldCode: 'ACADEMIC_RESEARCH',
            sourceKey: 'ACADEMIC_RESEARCH',
            catalogStatus: 'KNOWN',
            rank: 2,
            confidence: 0.7,
            candidateId: 'dc-2',
          },
          {
            fieldCode: 'IT_SYSTEMS',
            sourceKey: 'IT_SYSTEMS',
            catalogStatus: 'KNOWN',
            rank: 3,
            confidence: 0.65,
            candidateId: 'dc-3',
          },
          {
            fieldCode: 'PEOPLE_HR',
            sourceKey: 'PEOPLE_HR',
            catalogStatus: 'KNOWN',
            rank: 4,
            confidence: 0.6,
            candidateId: 'dc-4',
          },
        ],
        secondaryDomainCodes: [
          'ACADEMIC_RESEARCH',
          'IT_SYSTEMS',
          'PEOPLE_HR',
        ],
      }),
    );
    expect(fields.map((f) => f.fieldCode)).toEqual([
      'VISUAL_DESIGN',
      'IT_SYSTEMS',
      'PEOPLE_HR',
    ]);
  });

  it('drops out-of-scope specialties and orphan supports', () => {
    const { envelope } = normalizeP3ModelOutput({
      raw: {
        fieldResults: [
          {
            fieldCode: 'VISUAL_DESIGN',
            observedSpecialties: [
              {
                specialtyCode: 'GRAPHIC_DESIGN',
                parentFieldCode: 'VISUAL_DESIGN',
                status: 'OBSERVED',
                confidence: 0.8,
                supportingEvidenceUnitIds: ['ceu_a', 'ceu_b'],
                rationaleCode: 'COHERENT_PRACTICE_CLUSTER',
              },
              {
                specialtyCode: 'TEACHING_FACILITATION',
                parentFieldCode: 'EDUCATION',
                status: 'OBSERVED',
                confidence: 0.9,
                supportingEvidenceUnitIds: ['ceu_a', 'ceu_b'],
                rationaleCode: 'MIXED_KIND_SUPPORT',
              },
              {
                specialtyCode: 'NOT_A_REAL_SPEC',
                status: 'OBSERVED',
                confidence: 0.9,
                supportingEvidenceUnitIds: ['ceu_a'],
              },
            ],
          },
        ],
        outcomeStatus: 'SPECIALTIES_OBSERVED',
      },
      executionId: 'e',
      configFingerprint: 'c',
      snapshotId: '1',
      fieldsEvaluated: ['VISUAL_DESIGN'],
      r1FieldResolutionStatus: 'RESOLVED',
      unitIds: ['ceu_a', 'ceu_b'],
      campaignId: 'c',
      pipelineRunId: 'p',
      registryFingerprint: 'r',
      modelWarnings: [],
      r1PackDir: '/tmp/r1',
      p1ArtifactDigest: 'd',
      geminiInvoked: true,
    });

    expect(envelope.payload.fieldResults).toHaveLength(1);
    expect(
      envelope.payload.fieldResults[0].observedSpecialties.map(
        (s) => s.specialtyCode,
      ),
    ).toEqual(['GRAPHIC_DESIGN']);
    expect(envelope.payload.r1Unchanged).toBe(true);

    expect(() =>
      assertP3ReferentialIntegrity(envelope, ['ceu_a', 'ceu_b'], [
        'VISUAL_DESIGN',
      ]),
    ).not.toThrow();
  });

  it('maps UI_DESIGN to UX_PRODUCT_DESIGN and drops LEARNING_ASSESSMENT', () => {
    const { envelope } = normalizeP3ModelOutput({
      raw: {
        fieldResults: [
          {
            fieldCode: 'VISUAL_DESIGN',
            observedSpecialties: [
              {
                specialtyCode: 'UI_DESIGN',
                parentFieldCode: 'VISUAL_DESIGN',
                status: 'OBSERVED',
                confidence: 0.8,
                supportingEvidenceUnitIds: ['ceu_a', 'ceu_b'],
                rationaleCode: 'MIXED_KIND_SUPPORT',
              },
            ],
          },
          {
            fieldCode: 'EDUCATION',
            observedSpecialties: [
              {
                specialtyCode: 'LEARNING_ASSESSMENT',
                parentFieldCode: 'EDUCATION',
                status: 'WEAK',
                confidence: 0.5,
                supportingEvidenceUnitIds: ['ceu_a'],
                rationaleCode: 'THIN_BUT_TRACABLE',
              },
              {
                specialtyCode: 'INSTRUCTIONAL_DESIGN',
                parentFieldCode: 'EDUCATION',
                status: 'OBSERVED',
                confidence: 0.9,
                supportingEvidenceUnitIds: ['ceu_a', 'ceu_b'],
                rationaleCode: 'COHERENT_PRACTICE_CLUSTER',
              },
            ],
          },
        ],
        outcomeStatus: 'SPECIALTIES_OBSERVED',
      },
      executionId: 'e',
      configFingerprint: 'c',
      snapshotId: '1',
      fieldsEvaluated: ['VISUAL_DESIGN', 'EDUCATION'],
      r1FieldResolutionStatus: 'MULTI_FIELD',
      unitIds: ['ceu_a', 'ceu_b'],
      campaignId: 'c',
      pipelineRunId: 'p',
      registryFingerprint: 'r',
      modelWarnings: [],
      r1PackDir: '/tmp/r1',
      p1ArtifactDigest: 'd',
      geminiInvoked: true,
    });

    expect(
      envelope.payload.fieldResults
        .find((f) => f.fieldCode === 'VISUAL_DESIGN')!
        .observedSpecialties.map((s) => s.specialtyCode),
    ).toEqual(['UX_PRODUCT_DESIGN']);
    expect(
      envelope.payload.fieldResults
        .find((f) => f.fieldCode === 'EDUCATION')!
        .observedSpecialties.map((s) => s.specialtyCode),
    ).toEqual(['INSTRUCTIONAL_DESIGN']);
    expect(envelope.payload.specialtyCatalogVersion).toBe('1.12.0');
    expect(
      envelope.warnings.some((w) => w.code === 'LEGACY_SPECIALTY_ALIAS_MAPPED'),
    ).toBe(true);
    expect(
      envelope.warnings.some(
        (w) => w.code === 'RESERVED_FUTURE_SKILL_CODE_DROPPED',
      ),
    ).toBe(true);
  });
});
