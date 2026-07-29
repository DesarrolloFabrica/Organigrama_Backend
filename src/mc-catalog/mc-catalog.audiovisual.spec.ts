import { validateMappingPack } from './mc-catalog.mapping-validation';
import {
  MC_AUDIOVISUAL_EXPECTED_DISTRIBUTION_V100,
  MC_AUDIOVISUAL_MAPPING_PACK_V100,
} from './mc-catalog.mapping-audiovisual-v100';
import {
  MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
  MC_AUDIOVISUAL_PRODUCTION_SPECIALTY_CODES,
  MC_DOMAIN_RADAR_AXIS_ORDER,
  MC1_CATALOG_DEFINITION,
} from './mc-catalog.definition-mc12';
import { resolveMcMappingPack } from './mc-catalog.mapping-registry';
import { computeMcMappingPackHash } from './mc-catalog.mapping-hash';
import {
  getMcPa2EngineConfigAudiovisualProductionV100,
  MC_PA2_RULES_VERSION_AUDIOVISUAL_V100,
  resolveMcPa2EngineConfig,
} from './mc-pa2.config';
import {
  assertMcPa2RuleFingerprint,
} from './mc-pa2.algorithm';
import {
  runMcPa2Engine,
} from './mc-pa2.engine';
import type {
  McPa2MappingInput,
  McPa2SkillEvidenceInput,
  McPa2SpecialtyInput,
} from './mc-pa2.types';

const FROZEN_PACK_HASH =
  'f75ae6ee11f7924d0d35fa8ef0a82248d41732b946c3e349826443adc5e08870';

function avSpecialties(): McPa2SpecialtyInput[] {
  return MC_AUDIOVISUAL_PRODUCTION_SPECIALTY_CODES.map((code, i) => ({
    specialtyId: String(i + 1),
    specialtyCode: code,
    specialtyName: code,
    lifecycleStatus: 'ACTIVE' as const,
    sortOrder: i + 1,
  }));
}

function avCodeToId(): Record<string, string> {
  return Object.fromEntries(
    avSpecialties().map((s) => [s.specialtyCode, s.specialtyId]),
  );
}

describe('MC1.8.1 AUDIOVISUAL_PRODUCTION catálogo', () => {
  it('dominio único sin duplicados semánticos', () => {
    const codes = MC1_CATALOG_DEFINITION.domains.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain(MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE);
    expect(codes).not.toContain('AUDIOVISUAL');
    expect(codes).not.toContain('MULTIMEDIA');
    expect(codes).not.toContain('VIDEO_PRODUCTION');
  });

  it('incluye 3 especialidades núcleo EMERGENT documental', () => {
    const av = MC1_CATALOG_DEFINITION.domains.find(
      (d) => d.code === MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
    )!;
    expect(av.specialties).toHaveLength(3);
    expect(av.specialties.map((s) => s.code)).toEqual([
      ...MC_AUDIOVISUAL_PRODUCTION_SPECIALTY_CODES,
    ]);
    for (const s of av.specialties) {
      expect(s.lifecycleStatus).toBe('ACTIVE');
      expect(s.description).toMatch(/EMERGENT/);
    }
  });

  it('radar order registrado', () => {
    expect(MC_DOMAIN_RADAR_AXIS_ORDER.AUDIOVISUAL_PRODUCTION).toEqual([
      'AV_EDITING',
      'AV_MOTION',
      'AV_POST',
    ]);
  });
});

describe('MC1.8.1 audiovisual-production-mappings@1.0.0', () => {
  it('valida el pack contra especialidades ACTIVE', () => {
    const result = validateMappingPack(
      MC_AUDIOVISUAL_MAPPING_PACK_V100,
      new Set([...MC_AUDIOVISUAL_PRODUCTION_SPECIALTY_CODES]),
    );
    expect(result.ok).toBe(true);
    expect(result.classificationCounts.DOMAIN_SPECIALTY).toBe(10);
    expect(result.classificationCounts.TRANSVERSAL_FUTURE).toBe(6);
    expect(result.classificationCounts.OUTSIDE_SOFTWARE_DOMAIN).toBe(20);
    expect(
      result.classificationCounts.DOMAIN_SPECIALTY +
        result.classificationCounts.TRANSVERSAL_FUTURE +
        result.classificationCounts.OUTSIDE_SOFTWARE_DOMAIN,
    ).toBe(MC_AUDIOVISUAL_EXPECTED_DISTRIBUTION_V100.total);
  });

  it('hash determinista congelado', () => {
    const hash = computeMcMappingPackHash(MC_AUDIOVISUAL_MAPPING_PACK_V100);
    expect(hash).toBe(FROZEN_PACK_HASH);
    expect(
      computeMcMappingPackHash(MC_AUDIOVISUAL_MAPPING_PACK_V100),
    ).toBe(hash);
  });

  it('registry default apunta a 1.0.0', () => {
    const av = resolveMcMappingPack('AUDIOVISUAL_PRODUCTION');
    expect(av.packCode).toBe('audiovisual-production-mappings');
    expect(av.mappingRulesVersion).toBe('1.0.0');
    expect(av.expectedDistribution).toEqual(
      MC_AUDIOVISUAL_EXPECTED_DISTRIBUTION_V100,
    );
  });

  it('mappings resolubles; davinci_resolve secundario en POST', () => {
    const pairs = MC_AUDIOVISUAL_MAPPING_PACK_V100.mappings.map(
      (m) => `${m.skillKey}@${m.specialtyCode}`,
    );
    expect(new Set(pairs).size).toBe(pairs.length);
    const resolveMaps = MC_AUDIOVISUAL_MAPPING_PACK_V100.mappings.filter(
      (m) => m.skillKey === 'davinci_resolve',
    );
    expect(resolveMaps).toHaveLength(2);
    const toolMaps = MC_AUDIOVISUAL_MAPPING_PACK_V100.mappings.filter(
      (m) => m.skillType === 'TOOL',
    );
    expect(toolMaps.length).toBeGreaterThan(0);
    for (const m of toolMaps) {
      expect(m.weight).toBeLessThanOrEqual(0.25);
    }
  });

  it('no mapea especialidades reservadas ni términos ambiguos', () => {
    const mapped = new Set(
      MC_AUDIOVISUAL_MAPPING_PACK_V100.mappings.map((m) => m.skillKey),
    );
    for (const banned of [
      'adobe_indesign',
      'manuales_de_identidad_corporativa',
      'ispring',
      'e-mail_marketing',
      'fotografia_comercial',
      'streaming',
      'masterizacion_de_audio',
    ]) {
      expect(mapped.has(banned)).toBe(false);
    }
    const specialtyCodes = new Set(
      MC_AUDIOVISUAL_MAPPING_PACK_V100.mappings.map((m) => m.specialtyCode),
    );
    for (const reserved of [
      'AV_PRODUCTION',
      'AV_PHOTOGRAPHY',
      'AV_SOUND',
      'AV_STREAMING',
    ]) {
      expect(specialtyCodes.has(reserved)).toBe(false);
    }
  });
});

describe('pa2-audiovisual-production-1.0.0', () => {
  it('resuelve LEXICO V2 con anti-tool companion', () => {
    const cfg = resolveMcPa2EngineConfig(MC_PA2_RULES_VERSION_AUDIOVISUAL_V100);
    expect(cfg).toEqual(getMcPa2EngineConfigAudiovisualProductionV100());
    expect(cfg.rankingStrategy).toBe('LEXICOGRAPHIC');
    expect(cfg.requireProfessionalCompanionForVisible).toBe(true);
    expect(cfg.minimumActiveStrength).toBe(20);
    assertMcPa2RuleFingerprint(cfg);
  });

  it('tools solas no activan especialidad', () => {
    const ids = avCodeToId();
    const skills: McPa2SkillEvidenceInput[] = [
      {
        skillId: '1',
        skillKey: 'adobe_premiere_pro',
        skillName: 'Adobe Premiere Pro',
        skillType: 'TOOL',
        evidenceLevel: 'STRONG',
        evidenceStrength: 80,
        evidenceConfidence: 0.9,
      },
    ];
    const mappings: McPa2MappingInput[] = [
      {
        skillId: '1',
        specialtyCode: 'AV_EDITING',
        specialtyId: ids.AV_EDITING,
        weight: 0.25,
        mappingType: 'PRIMARY',
      },
    ];
    const result = runMcPa2Engine({
      domainCode: MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
      config: getMcPa2EngineConfigAudiovisualProductionV100(),
      specialties: avSpecialties(),
      mappings,
      skills,
    });
    const editing = result.specialtyResults.find(
      (r) => r.specialtyCode === 'AV_EDITING',
    )!;
    expect(editing.presentationStatus).toBe('HIDDEN');
    expect(editing.reasons.some((x) => x.includes('anti-tool'))).toBe(true);
    expect(result.activeCount).toBe(0);
  });

  it('After Effects solo no activa AV_MOTION', () => {
    const ids = avCodeToId();
    const result = runMcPa2Engine({
      domainCode: MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
      config: getMcPa2EngineConfigAudiovisualProductionV100(),
      specialties: avSpecialties(),
      mappings: [
        {
          skillId: '1',
          specialtyCode: 'AV_MOTION',
          specialtyId: ids.AV_MOTION,
          weight: 0.25,
          mappingType: 'PRIMARY',
        },
      ],
      skills: [
        {
          skillId: '1',
          skillKey: 'adobe_after_effects',
          skillName: 'Adobe After Effects',
          skillType: 'TOOL',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 64,
          evidenceConfidence: 0.7,
        },
      ],
    });
    const motion = result.specialtyResults.find(
      (r) => r.specialtyCode === 'AV_MOTION',
    )!;
    expect(motion.presentationStatus).toBe('HIDDEN');
  });

  it('evidencia profesional + tool calcula contribución mixta', () => {
    const ids = avCodeToId();
    const result = runMcPa2Engine({
      domainCode: MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
      config: getMcPa2EngineConfigAudiovisualProductionV100(),
      specialties: avSpecialties(),
      mappings: [
        {
          skillId: '1',
          specialtyCode: 'AV_MOTION',
          specialtyId: ids.AV_MOTION,
          weight: 1,
          mappingType: 'PRIMARY',
        },
        {
          skillId: '2',
          specialtyCode: 'AV_MOTION',
          specialtyId: ids.AV_MOTION,
          weight: 0.25,
          mappingType: 'PRIMARY',
        },
      ],
      skills: [
        {
          skillId: '1',
          skillKey: 'motion_graphics',
          skillName: 'Motion Graphics',
          skillType: 'PROFESSIONAL_KNOWLEDGE',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 60,
          evidenceConfidence: 0.75,
        },
        {
          skillId: '2',
          skillKey: 'adobe_after_effects',
          skillName: 'Adobe After Effects',
          skillType: 'TOOL',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 55,
          evidenceConfidence: 0.7,
        },
      ],
    });
    const motion = result.specialtyResults.find(
      (r) => r.specialtyCode === 'AV_MOTION',
    )!;
    expect(motion.professionalContribution).toBeGreaterThan(0);
    expect(motion.toolContribution).toBeGreaterThan(0);
    expect(motion.presentationStatus).not.toBe('HIDDEN');
  });

  it('edición profesional contribuye a AV_EDITING', () => {
    const ids = avCodeToId();
    const result = runMcPa2Engine({
      domainCode: MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
      config: getMcPa2EngineConfigAudiovisualProductionV100(),
      specialties: avSpecialties(),
      mappings: [
        {
          skillId: '1',
          specialtyCode: 'AV_EDITING',
          specialtyId: ids.AV_EDITING,
          weight: 1,
          mappingType: 'PRIMARY',
        },
        {
          skillId: '2',
          specialtyCode: 'AV_EDITING',
          specialtyId: ids.AV_EDITING,
          weight: 0.25,
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
          evidenceStrength: 62,
          evidenceConfidence: 0.8,
        },
        {
          skillId: '2',
          skillKey: 'adobe_premiere',
          skillName: 'Adobe Premiere',
          skillType: 'TOOL',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 58,
          evidenceConfidence: 0.75,
        },
      ],
    });
    const editing = result.specialtyResults.find(
      (r) => r.specialtyCode === 'AV_EDITING',
    )!;
    expect(editing.professionalContribution).toBeGreaterThan(0);
    expect(['ACTIVE', 'EMERGENT']).toContain(editing.presentationStatus);
  });

  it('corrección de color profesional contribuye a AV_POST', () => {
    const ids = avCodeToId();
    const result = runMcPa2Engine({
      domainCode: MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
      config: getMcPa2EngineConfigAudiovisualProductionV100(),
      specialties: avSpecialties(),
      mappings: [
        {
          skillId: '1',
          specialtyCode: 'AV_POST',
          specialtyId: ids.AV_POST,
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
          evidenceStrength: 60,
          evidenceConfidence: 0.78,
        },
      ],
    });
    const post = result.specialtyResults.find(
      (r) => r.specialtyCode === 'AV_POST',
    )!;
    expect(post.professionalContribution).toBeGreaterThan(0);
    expect(['ACTIVE', 'EMERGENT', 'HIDDEN']).toContain(
      post.presentationStatus,
    );
  });

  it('resultado determinista en dos ejecuciones', () => {
    const ids = avCodeToId();
    const input = {
      domainCode: MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
      config: getMcPa2EngineConfigAudiovisualProductionV100(),
      specialties: avSpecialties(),
      mappings: [
        {
          skillId: '1',
          specialtyCode: 'AV_MOTION',
          specialtyId: ids.AV_MOTION,
          weight: 1,
          mappingType: 'PRIMARY' as const,
        },
        {
          skillId: '2',
          specialtyCode: 'AV_EDITING',
          specialtyId: ids.AV_EDITING,
          weight: 1,
          mappingType: 'PRIMARY' as const,
        },
      ],
      skills: [
        {
          skillId: '1',
          skillKey: 'motion_graphics',
          skillName: 'Motion Graphics',
          skillType: 'PROFESSIONAL_KNOWLEDGE' as const,
          evidenceLevel: 'MODERATE' as const,
          evidenceStrength: 60,
          evidenceConfidence: 0.75,
        },
        {
          skillId: '2',
          skillKey: 'edicion_de_video',
          skillName: 'Edición de video',
          skillType: 'PROFESSIONAL_KNOWLEDGE' as const,
          evidenceLevel: 'MODERATE' as const,
          evidenceStrength: 58,
          evidenceConfidence: 0.72,
        },
      ],
    };
    const a = runMcPa2Engine(input);
    const b = runMcPa2Engine(input);
    expect(a).toEqual(b);
    expect(a.specialtyResults.map((r) => r.presentationStatus)).toEqual(
      b.specialtyResults.map((r) => r.presentationStatus),
    );
  });
});
