import {
  resolveObservedSpecialties,
  resolveP4SpecialtiesEvaluated,
} from './p4-context-loader';
import {
  assertP4ReferentialIntegrity,
  normalizeP4ModelOutput,
} from './p4-normalize';
import { hasAuthoritativeP4Target, type P4SpecialtyEvaluated } from './p4.types';
import type { P3ContractEnvelope } from '../p3/p3.types';
import { listObservedP4Skills } from '../profile/profile-pack-loader';
import type { P4ContractEnvelope } from './p4.types';

function p3Fixture(
  specialties: Array<{ code: string; status: string; confidence?: number }>,
): P3ContractEnvelope {
  return {
    payload: {
      specialtyCatalogVersion: '1.3.0',
      fieldResults: [
        {
          fieldCode: 'VISUAL_DESIGN',
          observedSpecialties: specialties.map((s) => ({
            specialtyCode: s.code,
            parentFieldCode: 'VISUAL_DESIGN',
            status: s.status,
            confidence: s.confidence ?? 0.8,
            supportingEvidenceUnitIds: ['a', 'b'],
            rationaleCode: 'COHERENT_PRACTICE_CLUSTER',
          })),
        },
      ],
    },
  } as P3ContractEnvelope;
}

function authTarget(
  code: string,
  conf = 0.9,
): P4SpecialtyEvaluated {
  return {
    fieldCode: 'VISUAL_DESIGN',
    specialtyCode: code,
    p3Status: 'OBSERVED',
    p3Confidence: conf,
    evaluationRole: 'AUTHORITATIVE_TARGET',
    routingEligible: true,
    publishableFromP3: true,
  };
}

function routingCandidate(
  code: string,
  conf = 0.5,
): P4SpecialtyEvaluated {
  return {
    fieldCode: 'VISUAL_DESIGN',
    specialtyCode: code,
    p3Status: 'WEAK',
    p3Confidence: conf,
    evaluationRole: 'ROUTING_CANDIDATE',
    routingEligible: true,
    publishableFromP3: false,
  };
}

describe('P4 skill discovery — 12I WEAK routing', () => {
  it('OBSERVED entra como AUTHORITATIVE_TARGET', () => {
    const evals = resolveP4SpecialtiesEvaluated(
      p3Fixture([{ code: 'GRAPHIC_DESIGN', status: 'OBSERVED' }]),
    );
    expect(evals).toEqual([
      {
        fieldCode: 'VISUAL_DESIGN',
        specialtyCode: 'GRAPHIC_DESIGN',
        p3Status: 'OBSERVED',
        p3Confidence: 0.8,
        evaluationRole: 'AUTHORITATIVE_TARGET',
        routingEligible: true,
        publishableFromP3: true,
      },
    ]);
    expect(hasAuthoritativeP4Target(evals)).toBe(true);
  });

  it('WEAK entra como ROUTING_CANDIDATE', () => {
    const evals = resolveP4SpecialtiesEvaluated(
      p3Fixture([
        { code: 'GRAPHIC_DESIGN', status: 'OBSERVED' },
        { code: 'MOTION_DESIGN', status: 'WEAK', confidence: 0.55 },
      ]),
    );
    expect(evals.map((e) => [e.specialtyCode, e.evaluationRole])).toEqual([
      ['GRAPHIC_DESIGN', 'AUTHORITATIVE_TARGET'],
      ['MOTION_DESIGN', 'ROUTING_CANDIDATE'],
    ]);
    expect(evals.find((e) => e.specialtyCode === 'MOTION_DESIGN')).toMatchObject(
      {
        routingEligible: true,
        publishableFromP3: false,
        p3Status: 'WEAK',
      },
    );
  });

  it('NOT_EMITTED no entra', () => {
    const evals = resolveP4SpecialtiesEvaluated(
      p3Fixture([
        { code: 'GRAPHIC_DESIGN', status: 'OBSERVED' },
        { code: 'ILLUSTRATION', status: 'NOT_EMITTED' },
      ]),
    );
    expect(evals.map((e) => e.specialtyCode)).toEqual(['GRAPHIC_DESIGN']);
  });

  it('WEAK-only → P4 abstains', () => {
    const evals = resolveP4SpecialtiesEvaluated(
      p3Fixture([{ code: 'MOTION_DESIGN', status: 'WEAK' }]),
    );
    expect(hasAuthoritativeP4Target(evals)).toBe(false);
    const { envelope } = normalizeP4ModelOutput({
      raw: {
        specialtyResults: [
          {
            fieldCode: 'VISUAL_DESIGN',
            specialtyCode: 'MOTION_DESIGN',
            observedSkills: [
              {
                skillCode: 'motion_graphics',
                name: 'Motion graphics',
                parentFieldCode: 'VISUAL_DESIGN',
                parentSpecialtyCode: 'MOTION_DESIGN',
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
      specialtiesEvaluated: evals,
      r1FieldResolutionStatus: 'RESOLVED',
      unitIds: ['ceu_a', 'ceu_b'],
      campaignId: 'c',
      pipelineRunId: 'p',
      registryFingerprint: 'r',
      modelWarnings: [],
      r1PackDir: '/r1',
      p3PackDir: '/p3',
      p1ArtifactDigest: 'd',
      geminiInvoked: false,
    });
    expect(envelope.payload.outcomeStatus).toBe(
      'ABSTAINED_NO_OBSERVED_SPECIALTY',
    );
    expect(envelope.abstained).toBe(true);
    expect(
      envelope.payload.specialtyResults.every(
        (r) => r.observedSkills.length === 0,
      ),
    ).toBe(true);
    expect(envelope.payload.p3Unchanged).toBe(true);
  });

  it('GRAPHIC OBS + MOTION WEAK → Motion puede ser routing target', () => {
    const evals = resolveP4SpecialtiesEvaluated(
      p3Fixture([
        { code: 'GRAPHIC_DESIGN', status: 'OBSERVED' },
        { code: 'MOTION_DESIGN', status: 'WEAK' },
      ]),
    );
    expect(
      evals.some(
        (e) =>
          e.specialtyCode === 'MOTION_DESIGN' &&
          e.evaluationRole === 'ROUTING_CANDIDATE',
      ),
    ).toBe(true);

    const { envelope } = normalizeP4ModelOutput({
      raw: {
        specialtyResults: [
          {
            fieldCode: 'VISUAL_DESIGN',
            specialtyCode: 'GRAPHIC_DESIGN',
            observedSkills: [],
          },
          {
            fieldCode: 'VISUAL_DESIGN',
            specialtyCode: 'MOTION_DESIGN',
            observedSkills: [
              {
                skillCode: 'motion_graphics_design',
                name: 'Motion graphics design',
                parentFieldCode: 'VISUAL_DESIGN',
                parentSpecialtyCode: 'MOTION_DESIGN',
                status: 'OBSERVED',
                confidence: 0.88,
                supportingEvidenceUnitIds: ['ceu_a', 'ceu_b'],
                supportingSignals: ['animación', 'motion graphics'],
                toolOrTechnologySignals: ['After Effects'],
                rationaleCode: 'RECURRENT_PRACTICE',
              },
            ],
          },
        ],
        outcomeStatus: 'SKILLS_OBSERVED',
      },
      executionId: 'e',
      configFingerprint: 'c',
      snapshotId: '1',
      specialtiesEvaluated: evals,
      r1FieldResolutionStatus: 'RESOLVED',
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

    const motion = envelope.payload.specialtyResults.find(
      (r) => r.specialtyCode === 'MOTION_DESIGN',
    )!;
    expect(motion.observedSkills).toHaveLength(1);
    expect(motion.observedSkills[0].parentSpecialtyCode).toBe('MOTION_DESIGN');
    expect(envelope.payload.p3Unchanged).toBe(true);
    expect(envelope.payload.specialtyCorroborationHints?.[0]).toMatchObject({
      specialtyCode: 'MOTION_DESIGN',
      skillCode: 'motion_graphics_design',
      p3Status: 'WEAK',
      doesNotMutateP3: true,
    });
  });

  it('skill colocada bajo WEAK no cambia P3 (p3Unchanged)', () => {
    const { envelope } = normalizeP4ModelOutput({
      raw: {
        specialtyResults: [
          {
            fieldCode: 'VISUAL_DESIGN',
            specialtyCode: 'EDITORIAL_DESIGN',
            observedSkills: [
              {
                skillCode: 'editorial_layout',
                name: 'Editorial layout',
                parentFieldCode: 'VISUAL_DESIGN',
                parentSpecialtyCode: 'EDITORIAL_DESIGN',
                status: 'OBSERVED',
                confidence: 0.8,
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
        authTarget('GRAPHIC_DESIGN'),
        routingCandidate('EDITORIAL_DESIGN'),
      ],
      r1FieldResolutionStatus: 'RESOLVED',
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
    expect(envelope.payload.p3Unchanged).toBe(true);
    expect(
      envelope.payload.specialtiesEvaluated.find(
        (s) => s.specialtyCode === 'EDITORIAL_DESIGN',
      )?.p3Status,
    ).toBe('WEAK');
  });

  it('corroboration hint no cambia P3 ni publica specialty', () => {
    const { envelope } = normalizeP4ModelOutput({
      raw: {
        specialtyResults: [
          {
            fieldCode: 'VISUAL_DESIGN',
            specialtyCode: 'BRAND_IDENTITY_DESIGN',
            observedSkills: [
              {
                skillCode: 'brand_identity',
                name: 'Brand identity design',
                parentFieldCode: 'VISUAL_DESIGN',
                parentSpecialtyCode: 'BRAND_IDENTITY_DESIGN',
                status: 'OBSERVED',
                confidence: 0.85,
                supportingEvidenceUnitIds: ['ceu_a', 'ceu_b'],
              },
            ],
          },
        ],
        specialtyCorroborationHints: [
          {
            fieldCode: 'VISUAL_DESIGN',
            specialtyCode: 'BRAND_IDENTITY_DESIGN',
            skillCode: 'brand_identity',
            supportingEvidenceUnitIds: ['ceu_a', 'ceu_b'],
          },
        ],
        outcomeStatus: 'SKILLS_OBSERVED',
      },
      executionId: 'e',
      configFingerprint: 'c',
      snapshotId: '1',
      specialtiesEvaluated: [
        authTarget('GRAPHIC_DESIGN'),
        routingCandidate('BRAND_IDENTITY_DESIGN'),
      ],
      r1FieldResolutionStatus: 'RESOLVED',
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
    const hint = envelope.payload.specialtyCorroborationHints![0];
    expect(hint.doesNotMutateP3).toBe(true);
    expect(hint.p3Status).toBe('WEAK');
    expect(envelope.payload.p3Unchanged).toBe(true);
    // publishableFromP3 stays false on routing candidate
    expect(
      envelope.payload.specialtiesEvaluated.find(
        (s) => s.specialtyCode === 'BRAND_IDENTITY_DESIGN',
      )?.publishableFromP3,
    ).toBe(false);
  });

  it('skill WEAK no altera radar público (filtro Profile Assembly)', () => {
    const p4 = {
      payload: {
        specialtyResults: [
          {
            fieldCode: 'VISUAL_DESIGN',
            specialtyCode: 'GRAPHIC_DESIGN',
            observedSkills: [
              {
                skillCode: 'graphic_layout',
                name: 'Graphic layout',
                parentFieldCode: 'VISUAL_DESIGN',
                parentSpecialtyCode: 'GRAPHIC_DESIGN',
                status: 'OBSERVED',
                confidence: 0.9,
                supportingEvidenceUnitIds: ['a'],
                supportingSignals: [],
                toolOrTechnologySignals: [],
                rationaleCode: 'RECURRENT_PRACTICE',
              },
            ],
          },
          {
            fieldCode: 'VISUAL_DESIGN',
            specialtyCode: 'MOTION_DESIGN',
            observedSkills: [
              {
                skillCode: 'motion_graphics',
                name: 'Motion graphics',
                parentFieldCode: 'VISUAL_DESIGN',
                parentSpecialtyCode: 'MOTION_DESIGN',
                status: 'OBSERVED',
                confidence: 0.9,
                supportingEvidenceUnitIds: ['b'],
                supportingSignals: [],
                toolOrTechnologySignals: [],
                rationaleCode: 'RECURRENT_PRACTICE',
              },
            ],
          },
        ],
      },
    } as P4ContractEnvelope;

    const observedP3 = [
      { fieldCode: 'VISUAL_DESIGN', specialtyCode: 'GRAPHIC_DESIGN' },
    ];
    const publicSkills = listObservedP4Skills(p4, observedP3);
    expect(publicSkills.map((s) => s.skillCode)).toEqual(['graphic_layout']);
    expect(publicSkills.every((s) => s.parentSpecialtyCode === 'GRAPHIC_DESIGN'))
      .toBe(true);
  });

  it('existing OBSERVED placement permanece estable', () => {
    const { envelope } = normalizeP4ModelOutput({
      raw: {
        specialtyResults: [
          {
            fieldCode: 'VISUAL_DESIGN',
            specialtyCode: 'UX_PRODUCT_DESIGN',
            observedSkills: [
              {
                skillCode: 'ux_interaction_design',
                name: 'UX interaction design',
                parentFieldCode: 'VISUAL_DESIGN',
                parentSpecialtyCode: 'UX_PRODUCT_DESIGN',
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
        authTarget('GRAPHIC_DESIGN'),
        authTarget('UX_PRODUCT_DESIGN'),
      ],
      r1FieldResolutionStatus: 'RESOLVED',
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
    expect(
      envelope.payload.specialtyResults.find(
        (r) => r.specialtyCode === 'UX_PRODUCT_DESIGN',
      )!.observedSkills[0].parentSpecialtyCode,
    ).toBe('UX_PRODUCT_DESIGN');
    expect(envelope.payload.specialtyCorroborationHints).toBeUndefined();
  });

  it('legacy resolveObservedSpecialties includes WEAK routing (12I)', () => {
    const evals = resolveObservedSpecialties(
      p3Fixture([
        { code: 'GRAPHIC_DESIGN', status: 'OBSERVED' },
        { code: 'EDITORIAL_DESIGN', status: 'WEAK' },
      ]),
    );
    expect(evals).toHaveLength(2);
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
      specialtiesEvaluated: [authTarget('GRAPHIC_DESIGN')],
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

    expect(() =>
      assertP4ReferentialIntegrity(envelope, ['ceu_a', 'ceu_b'], [
        authTarget('GRAPHIC_DESIGN'),
      ]),
    ).not.toThrow();
  });
});
