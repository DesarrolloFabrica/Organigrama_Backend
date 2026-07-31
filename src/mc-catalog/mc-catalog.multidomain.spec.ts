import {
  listMcMappingDomainCodes,
  listMcMappingPackReleases,
  resolveMcMappingPack,
} from './mc-catalog.mapping-registry';
import { computeMcMappingPackHash } from './mc-catalog.mapping-hash';
import {
  MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
  MC_AUDIOVISUAL_PRODUCTION_SPECIALTY_CODES,
  MC_DOMAIN_RADAR_AXIS_ORDER,
  MC_OPERATIONS_MANAGEMENT_DOMAIN_CODE,
  MC_OPERATIONS_MANAGEMENT_SPECIALTY_CODES,
  MC_SOFTWARE_DOMAIN_CODE,
  MC_VISUAL_DESIGN_DOMAIN_CODE,
} from './mc-catalog.definition-mc12';
import {
  getMcPa2EngineConfigAudiovisualProductionV100,
} from './mc-pa2.config';
import { runMcPa2Engine } from './mc-pa2.engine';
import type {
  McPa2MappingInput,
  McPa2SkillEvidenceInput,
  McPa2SpecialtyInput,
} from './mc-pa2.types';

const FROZEN_HASHES = {
  SOFTWARE: 'c58af99297ec9915688e79afcbd4544cfe50395ba205f2bf3450173055549911',
  VISUAL_DESIGN:
    '5d1d1f2070a87f9b5959f481cb0a53ec593f1b020373828e37f84e2dfcb7c50c',
  AUDIOVISUAL_PRODUCTION:
    'f75ae6ee11f7924d0d35fa8ef0a82248d41732b946c3e349826443adc5e08870',
} as const;

describe('MC1.8.1B registro multidominio', () => {
  it('expone SOFTWARE, VISUAL, AV, OPERATIONS, TALENT, EDUCATION y MARKETING', () => {
    const codes = listMcMappingDomainCodes();
    expect(codes).toEqual(
      expect.arrayContaining([
        MC_SOFTWARE_DOMAIN_CODE,
        MC_VISUAL_DESIGN_DOMAIN_CODE,
        MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
        MC_OPERATIONS_MANAGEMENT_DOMAIN_CODE,
      ]),
    );
    expect(codes).toContain('TALENT_MANAGEMENT');
    expect(codes).toContain('EDUCATION_MANAGEMENT');
    expect(codes).toContain('MARKETING_MANAGEMENT');
    expect(codes).toHaveLength(7);
  });

  it('vincula packs publicados con hashes inmutables', () => {
    for (const domain of [
      MC_SOFTWARE_DOMAIN_CODE,
      MC_VISUAL_DESIGN_DOMAIN_CODE,
      MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
    ] as const) {
      const reg = resolveMcMappingPack(domain);
      const hash = computeMcMappingPackHash(reg.pack);
      expect(hash).toBe(FROZEN_HASHES[domain]);
    }
    // OPS golden: hash estable pero versionado en este release
    const ops = resolveMcMappingPack(MC_OPERATIONS_MANAGEMENT_DOMAIN_CODE);
    expect(computeMcMappingPackHash(ops.pack)).toHaveLength(64);
  });

  it('no duplica releases por (pack_code, pack_version)', () => {
    const releases = listMcMappingPackReleases();
    const keys = releases.map(
      (r) => `${r.packCode}@${r.mappingRulesVersion}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(releases.length).toBe(14);
  });

  it('radar order definido para los dominios operativos', () => {
    expect(MC_DOMAIN_RADAR_AXIS_ORDER[MC_SOFTWARE_DOMAIN_CODE]?.length).toBe(7);
    expect(MC_DOMAIN_RADAR_AXIS_ORDER[MC_VISUAL_DESIGN_DOMAIN_CODE]?.length).toBe(
      5,
    );
    expect(
      MC_DOMAIN_RADAR_AXIS_ORDER[MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE],
    ).toEqual([...MC_AUDIOVISUAL_PRODUCTION_SPECIALTY_CODES]);
    expect(
      MC_DOMAIN_RADAR_AXIS_ORDER[MC_OPERATIONS_MANAGEMENT_DOMAIN_CODE],
    ).toEqual([...MC_OPERATIONS_MANAGEMENT_SPECIALTY_CODES]);
    expect(MC_DOMAIN_RADAR_AXIS_ORDER.TALENT_MANAGEMENT).toEqual([
      'TM_TALENT',
      'TM_ORGANIZATIONAL_DEVELOPMENT',
      'TM_QUALITY_COMPLIANCE',
      'TM_PEOPLE_ANALYTICS',
      'TM_STRATEGIC_LEADERSHIP',
    ]);
    expect(MC_DOMAIN_RADAR_AXIS_ORDER.EDUCATION_MANAGEMENT).toEqual([
      'EM_ACADEMIC_PROGRAMS',
      'EM_CURRICULUM_DESIGN',
      'EM_ACADEMIC_QUALITY',
      'EM_TEACHING_INNOVATION',
      'EM_ACADEMIC_LEADERSHIP',
    ]);
    expect(MC_DOMAIN_RADAR_AXIS_ORDER.MARKETING_MANAGEMENT).toEqual([
      'MM_MARKETING_STRATEGY',
      'MM_DIGITAL_OMNICHANNEL',
      'MM_GROWTH_AUDIENCE',
      'MM_MARKETING_ANALYTICS',
      'MM_INNOVATION_EXPERIENCE',
    ]);
  });
});

describe('MC1.8.1B fronteras PA2 (unidad)', () => {
  const avSpecs: McPa2SpecialtyInput[] =
    MC_AUDIOVISUAL_PRODUCTION_SPECIALTY_CODES.map((code, i) => ({
      specialtyId: String(i + 1),
      specialtyCode: code,
      specialtyName: code,
      lifecycleStatus: 'ACTIVE' as const,
      sortOrder: i + 1,
    }));
  const avIds = Object.fromEntries(avSpecs.map((s) => [s.specialtyCode, s.specialtyId]));
  const avCfg = getMcPa2EngineConfigAudiovisualProductionV100();

  function runAv(
    mappings: McPa2MappingInput[],
    skills: McPa2SkillEvidenceInput[],
  ) {
    return runMcPa2Engine({
      domainCode: MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
      config: avCfg,
      specialties: avSpecs,
      mappings,
      skills,
    });
  }

  it('Premiere/After Effects solos no activan AV (perfil tipo Nidia)', () => {
    const result = runAv(
      [
        {
          skillId: '1',
          specialtyCode: 'AV_EDITING',
          specialtyId: avIds.AV_EDITING,
          weight: 0.25,
          mappingType: 'PRIMARY',
        },
        {
          skillId: '2',
          specialtyCode: 'AV_MOTION',
          specialtyId: avIds.AV_MOTION,
          weight: 0.25,
          mappingType: 'PRIMARY',
        },
      ],
      [
        {
          skillId: '1',
          skillKey: 'adobe_premiere_pro',
          skillName: 'Premiere',
          skillType: 'TOOL',
          evidenceLevel: 'NONE',
          evidenceStrength: 0,
          evidenceConfidence: 0.5,
        },
        {
          skillId: '2',
          skillKey: 'adobe_after_effects',
          skillName: 'AE',
          skillType: 'TOOL',
          evidenceLevel: 'NONE',
          evidenceStrength: 0,
          evidenceConfidence: 0.5,
        },
      ],
    );
    expect(result.activeCount).toBe(0);
    expect(result.emergentCount).toBe(0);
    expect(result.hiddenCount).toBe(3);
  });

  it('Photoshop/Illustrator solos no activan Audiovisual (perfil gráfico)', () => {
    const result = runAv([], [
      {
        skillId: '1',
        skillKey: 'adobe_photoshop',
        skillName: 'Photoshop',
        skillType: 'TOOL',
        evidenceLevel: 'STRONG',
        evidenceStrength: 80,
        evidenceConfidence: 0.9,
      },
      {
        skillId: '2',
        skillKey: 'adobe_illustrator',
        skillName: 'Illustrator',
        skillType: 'TOOL',
        evidenceLevel: 'STRONG',
        evidenceStrength: 75,
        evidenceConfidence: 0.85,
      },
    ]);
    expect(result.activeCount).toBe(0);
    expect(result.specialtyResults.every((r) => r.mappedSkillCount === 0)).toBe(
      true,
    );
  });

  it('multimedia genérico sin mapping no activa especialidades AV', () => {
    const result = runAv([], [
      {
        skillId: '1',
        skillKey: 'multimedia',
        skillName: 'Multimedia',
        skillType: 'PROFESSIONAL_KNOWLEDGE',
        evidenceLevel: 'MODERATE',
        evidenceStrength: 55,
        evidenceConfidence: 0.7,
      },
    ]);
    expect(result.activeCount).toBe(0);
    expect(result.emergentCount).toBe(0);
  });
});

describe('MC1.8.1B AV_POST (unidad)', () => {
  const avSpecs: McPa2SpecialtyInput[] =
    MC_AUDIOVISUAL_PRODUCTION_SPECIALTY_CODES.map((code, i) => ({
      specialtyId: String(i + 1),
      specialtyCode: code,
      specialtyName: code,
      lifecycleStatus: 'ACTIVE' as const,
      sortOrder: i + 1,
    }));
  const avIds = Object.fromEntries(avSpecs.map((s) => [s.specialtyCode, s.specialtyId]));
  const avCfg = getMcPa2EngineConfigAudiovisualProductionV100();

  it('tool aislada en POST no activa (DaVinci solo)', () => {
    const result = runMcPa2Engine({
      domainCode: MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
      config: avCfg,
      specialties: avSpecs,
      mappings: [
        {
          skillId: '1',
          specialtyCode: 'AV_POST',
          specialtyId: avIds.AV_POST,
          weight: 0.15,
          mappingType: 'SECONDARY',
        },
      ],
      skills: [
        {
          skillId: '1',
          skillKey: 'davinci_resolve',
          skillName: 'DaVinci Resolve',
          skillType: 'TOOL',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 50,
          evidenceConfidence: 0.86,
        },
      ],
    });
    const post = result.specialtyResults.find((r) => r.specialtyCode === 'AV_POST')!;
    expect(post.presentationStatus).toBe('HIDDEN');
  });

  it('corrección de color profesional contribuye a POST', () => {
    const result = runMcPa2Engine({
      domainCode: MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
      config: avCfg,
      specialties: avSpecs,
      mappings: [
        {
          skillId: '1',
          specialtyCode: 'AV_POST',
          specialtyId: avIds.AV_POST,
          weight: 1,
          mappingType: 'PRIMARY',
        },
      ],
      skills: [
        {
          skillId: '1',
          skillKey: 'ajuste_de_color',
          skillName: 'Ajuste de color',
          skillType: 'PROFESSIONAL_KNOWLEDGE',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 40,
          evidenceConfidence: 0.78,
        },
      ],
    });
    const post = result.specialtyResults.find((r) => r.specialtyCode === 'AV_POST')!;
    expect(post.professionalContribution).toBeGreaterThan(0);
    expect(post.presentationStatus).not.toBe('HIDDEN');
  });

  it('edición narrativa no duplica completamente POST (skills distintas)', () => {
    const editingOnly = runMcPa2Engine({
      domainCode: MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
      config: avCfg,
      specialties: avSpecs,
      mappings: [
        {
          skillId: '1',
          specialtyCode: 'AV_EDITING',
          specialtyId: avIds.AV_EDITING,
          weight: 1,
          mappingType: 'PRIMARY',
        },
      ],
      skills: [
        {
          skillId: '1',
          skillKey: 'edicion_de_video',
          skillName: 'Edición de video',
          skillType: 'PROFESSIONAL_KNOWLEDGE',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 53,
          evidenceConfidence: 0.86,
        },
      ],
    });
    const post = editingOnly.specialtyResults.find(
      (r) => r.specialtyCode === 'AV_POST',
    )!;
    expect(post.mappedSkillCount).toBe(0);
    expect(post.presentationStatus).toBe('HIDDEN');
  });

  it('resultado AV_POST determinista', () => {
    const input = {
      domainCode: MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
      config: avCfg,
      specialties: avSpecs,
      mappings: [
        {
          skillId: '1',
          specialtyCode: 'AV_POST',
          specialtyId: avIds.AV_POST,
          weight: 1,
          mappingType: 'PRIMARY' as const,
        },
        {
          skillId: '2',
          specialtyCode: 'AV_POST',
          specialtyId: avIds.AV_POST,
          weight: 0.15,
          mappingType: 'SECONDARY' as const,
        },
      ],
      skills: [
        {
          skillId: '1',
          skillKey: 'ajuste_de_color',
          skillName: 'Ajuste de color',
          skillType: 'PROFESSIONAL_KNOWLEDGE' as const,
          evidenceLevel: 'MODERATE' as const,
          evidenceStrength: 40,
          evidenceConfidence: 0.78,
        },
        {
          skillId: '2',
          skillKey: 'davinci_resolve',
          skillName: 'DaVinci Resolve',
          skillType: 'TOOL' as const,
          evidenceLevel: 'MODERATE' as const,
          evidenceStrength: 50,
          evidenceConfidence: 0.86,
        },
      ],
    };
    expect(runMcPa2Engine(input)).toEqual(runMcPa2Engine(input));
  });
});
