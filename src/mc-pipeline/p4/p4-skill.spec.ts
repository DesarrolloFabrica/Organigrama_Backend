import { resolveObservedSpecialties } from './p4-context-loader';
import {
  assertP4ReferentialIntegrity,
  normalizeP4ModelOutput,
} from './p4-normalize';
import type { P3ContractEnvelope } from '../p3/p3.types';

describe('P4 skill discovery (8D)', () => {
  it('evaluates only P3 OBSERVED specialties', () => {
    const p3 = {
      payload: {
        specialtyCatalogVersion: '1.1.0',
        fieldResults: [
          {
            fieldCode: 'VISUAL_DESIGN',
            observedSpecialties: [
              {
                specialtyCode: 'GRAPHIC_DESIGN',
                parentFieldCode: 'VISUAL_DESIGN',
                status: 'OBSERVED',
                confidence: 0.9,
                supportingEvidenceUnitIds: ['a', 'b'],
                rationaleCode: 'COHERENT_PRACTICE_CLUSTER',
              },
              {
                specialtyCode: 'EDITORIAL_DESIGN',
                parentFieldCode: 'VISUAL_DESIGN',
                status: 'WEAK',
                confidence: 0.5,
                supportingEvidenceUnitIds: ['a'],
                rationaleCode: 'THIN_BUT_TRACABLE',
              },
            ],
          },
        ],
      },
    } as P3ContractEnvelope;

    const evals = resolveObservedSpecialties(p3);
    expect(evals).toEqual([
      {
        fieldCode: 'VISUAL_DESIGN',
        specialtyCode: 'GRAPHIC_DESIGN',
        p3Status: 'OBSERVED',
        p3Confidence: 0.9,
      },
    ]);
  });

  it('drops tools-as-skills and generics; keeps capacity with evidence', () => {
    const { envelope } = normalizeP4ModelOutput({
      raw: {
        specialtyResults: [
          {
            fieldCode: 'VISUAL_DESIGN',
            specialtyCode: 'GRAPHIC_DESIGN',
            observedSkills: [
              {
                skillCode: 'visual_composition',
                name: 'Visual composition',
                parentFieldCode: 'VISUAL_DESIGN',
                parentSpecialtyCode: 'GRAPHIC_DESIGN',
                status: 'OBSERVED',
                confidence: 0.85,
                supportingEvidenceUnitIds: ['ceu_a', 'ceu_b'],
                supportingSignals: ['layout'],
                toolOrTechnologySignals: ['Illustrator'],
                rationaleCode: 'RECURRENT_PRACTICE',
              },
              {
                skillCode: 'photoshop',
                name: 'Photoshop',
                status: 'OBSERVED',
                confidence: 0.9,
                supportingEvidenceUnitIds: ['ceu_a', 'ceu_b'],
              },
              {
                skillCode: 'communication',
                name: 'Communication',
                status: 'OBSERVED',
                confidence: 0.9,
                supportingEvidenceUnitIds: ['ceu_a', 'ceu_b'],
              },
            ],
          },
        ],
        outcomeStatus: 'SKILLS_OBSERVED',
      },
      executionId: 'e',
      configFingerprint: 'c',
      snapshotId: '1',
      specialtiesEvaluated: [
        {
          fieldCode: 'VISUAL_DESIGN',
          specialtyCode: 'GRAPHIC_DESIGN',
          p3Status: 'OBSERVED',
          p3Confidence: 0.9,
        },
      ],
      r1FieldResolutionStatus: 'MULTI_FIELD',
      unitIds: ['ceu_a', 'ceu_b'],
      campaignId: 'c',
      pipelineRunId: 'p',
      registryFingerprint: 'r',
      modelWarnings: [],
      r1PackDir: '/r1',
      p3PackDir: '/p3',
      p1ArtifactDigest: 'd',
      geminiInvoked: true,
    });

    const skills = envelope.payload.specialtyResults[0].observedSkills;
    expect(skills.map((s) => s.skillCode)).toEqual(['visual_composition']);
    expect(skills[0].toolOrTechnologySignals).toEqual(['Illustrator']);
    expect(envelope.payload.r1Unchanged).toBe(true);
    expect(envelope.payload.p3Unchanged).toBe(true);
    expect(
      envelope.warnings.some((w) => w.code === 'TOOL_PROMOTED_AS_SKILL_DROPPED'),
    ).toBe(true);
    expect(
      envelope.warnings.some((w) => w.code === 'GENERIC_SKILL_DROPPED'),
    ).toBe(true);

    expect(() =>
      assertP4ReferentialIntegrity(
        envelope,
        ['ceu_a', 'ceu_b'],
        [
          {
            fieldCode: 'VISUAL_DESIGN',
            specialtyCode: 'GRAPHIC_DESIGN',
            p3Status: 'OBSERVED',
          },
        ],
      ),
    ).not.toThrow();
  });
});
