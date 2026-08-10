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

describe('P3 specialty catalog scope (11B: VE + PPM + FA + SE + AV + COMM)', () => {
  it('covers VISUAL_DESIGN, EDUCATION, PROJECT_PROGRAM_MGMT, FINANCE_ADMIN, SOFTWARE_ENGINEERING, AUDIOVISUAL_PRODUCTION and COMMUNICATIONS', () => {
    expect([...SPECIALTY_CATALOG_SCOPE].sort()).toEqual([
      'AUDIOVISUAL_PRODUCTION',
      'COMMUNICATIONS',
      'EDUCATION',
      'FINANCE_ADMIN',
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
  });

  it('maps UI_DESIGN / SOFTWARE_FRONTEND / AV_* aliases and reserves future skills', () => {
    expect(SPECIALTY_CATALOG_VERSION).toBe('1.6.0');
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
    expect(resolveToKnownSpecialtyCode('ON_CAMERA_PRESENTATION')).toBeNull();
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

  it('RESOLVED evaluates only primary', () => {
    const fields = resolveFieldsToEvaluate(
      baseR1({
        fieldResolutionStatus: 'RESOLVED',
        resolutionStatus: 'RESOLVED_PRIMARY',
      }),
    );
    expect(fields.map((f) => f.fieldCode)).toEqual(['VISUAL_DESIGN']);
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
    expect(envelope.payload.specialtyCatalogVersion).toBe('1.6.0');
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
