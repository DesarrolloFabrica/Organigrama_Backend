import { mapSkillToDimensions } from './profile-skill-dimension-mapper';
import {
  classifyEvidenceVolume,
  normalizeRadarAxes,
  rawScoreForContributions,
} from './profile-radar';

describe('profile pilot 8E', () => {
  it('maps editorial skill to VD_EDITORIAL within VISUAL_DESIGN', () => {
    const m = mapSkillToDimensions({
      skillCode: 'editorial_design',
      name: 'Diseño Editorial y Maquetación',
      parentFieldCode: 'VISUAL_DESIGN',
      parentSpecialtyCode: 'GRAPHIC_DESIGN',
      supportingSignals: ['diseño editorial', 'folletos'],
      toolOrTechnologySignals: ['Adobe InDesign'],
      supportingEvidenceUnitIds: ['ceu_a', 'ceu_b'],
    });
    expect(m.dimensionCodes).toContain('VD_EDITORIAL');
    expect(m.dimensionCodes.every((d) => d.startsWith('VD_'))).toBe(true);
  });

  it('maps instructional skill to ED_LEARNING_DESIGN and environments', () => {
    const m = mapSkillToDimensions({
      skillCode: 'instructional_design_course_development',
      name: 'Diseño Instruccional y Cursos',
      parentFieldCode: 'EDUCATION',
      parentSpecialtyCode: 'INSTRUCTIONAL_DESIGN',
      supportingSignals: ['diseño instruccional', 'cursos interactivos'],
      toolOrTechnologySignals: ['Moodle', 'SCORM'],
      supportingEvidenceUnitIds: ['ceu_1'],
    });
    expect(m.dimensionCodes).toContain('ED_LEARNING_DESIGN');
    expect(m.dimensionCodes).toContain('ED_LEARNING_ENVIRONMENTS');
  });

  it('normalizes strongest axis to 100 and classifies evidence volume', () => {
    const axes = normalizeRadarAxes([
      {
        dimensionCode: 'A',
        label: 'A',
        rawScore: 2,
        contributingSkillCodes: [],
        supportingEvidenceUnitIds: [],
      },
      {
        dimensionCode: 'B',
        label: 'B',
        rawScore: 4,
        contributingSkillCodes: [],
        supportingEvidenceUnitIds: [],
      },
    ]);
    expect(axes.find((a) => a.dimensionCode === 'B')!.relativeCoverage).toBe(
      100,
    );
    expect(axes.find((a) => a.dimensionCode === 'A')!.relativeCoverage).toBe(50);
    expect(classifyEvidenceVolume(3)).toBe('LOW');
    expect(classifyEvidenceVolume(5)).toBe('MEDIUM');
    expect(classifyEvidenceVolume(12)).toBe('HIGH');
  });

  it('raw score grows with evidence count', () => {
    const low = rawScoreForContributions([
      {
        skillCode: 's',
        confidence: 0.9,
        evidenceUnitIds: ['a'],
        signalCount: 1,
        explicitnessBoost: 1,
      },
    ]);
    const high = rawScoreForContributions([
      {
        skillCode: 's',
        confidence: 0.9,
        evidenceUnitIds: ['a', 'b', 'c', 'd'],
        signalCount: 3,
        explicitnessBoost: 1,
      },
    ]);
    expect(high).toBeGreaterThan(low);
  });

  it('maps backend API skill to SE_BACKEND and SE_APIS_INTEGRATION', () => {
    const m = mapSkillToDimensions({
      skillCode: 'api_service_development',
      name: 'Desarrollo de APIs y servicios',
      parentFieldCode: 'SOFTWARE_ENGINEERING',
      parentSpecialtyCode: 'BACKEND_ENGINEERING',
      supportingSignals: ['desarrollo de APIs', 'servicios backend'],
      toolOrTechnologySignals: ['NestJS', 'Node.js'],
      supportingEvidenceUnitIds: ['ceu_se_1'],
    });
    expect(m.dimensionCodes).toContain('SE_BACKEND');
    expect(m.dimensionCodes).toContain('SE_APIS_INTEGRATION');
    expect(m.dimensionCodes.every((d) => d.startsWith('SE_'))).toBe(true);
  });

  it('falls back PLATFORM_DEVOPS to SE_CLOUD_INFRA', () => {
    const m = mapSkillToDimensions({
      skillCode: 'delivery_automation',
      name: 'Automatización de entrega',
      parentFieldCode: 'SOFTWARE_ENGINEERING',
      parentSpecialtyCode: 'PLATFORM_DEVOPS_ENGINEERING',
      supportingSignals: [],
      toolOrTechnologySignals: [],
      supportingEvidenceUnitIds: ['ceu_se_2'],
    });
    expect(m.dimensionCodes).toEqual(['SE_CLOUD_INFRA']);
  });
});
