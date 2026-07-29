import { validateMappingPack } from './mc-catalog.mapping-validation';
import { MC_VISUAL_DESIGN_MAPPING_PACK } from './mc-catalog.mapping-visual-design-mc16';
import {
  MC_VISUAL_DESIGN_EXPECTED_DISTRIBUTION_V110,
  MC_VISUAL_DESIGN_MAPPING_PACK_V110,
} from './mc-catalog.mapping-visual-design-v110';
import { MC_VISUAL_DESIGN_SPECIALTY_CODES } from './mc-catalog.definition-mc12';
import { resolveMcMappingPack } from './mc-catalog.mapping-registry';
import { computeMcMappingPackHash } from './mc-catalog.mapping-hash';
import {
  getMcPa2EngineConfigVisualDesignV100,
  getMcPa2EngineConfigVisualDesignV110,
  MC_PA2_RULES_VERSION_VISUAL_V100,
  MC_PA2_RULES_VERSION_VISUAL_V110,
  resolveMcPa2EngineConfig,
} from './mc-pa2.config';

describe('MC1.6.1B VISUAL_DESIGN pack V1 (histórico)', () => {
  it('valida el pack contra especialidades ACTIVE', () => {
    const result = validateMappingPack(
      MC_VISUAL_DESIGN_MAPPING_PACK,
      new Set([...MC_VISUAL_DESIGN_SPECIALTY_CODES]),
    );
    expect(result.ok).toBe(true);
    expect(result.classificationCounts.DOMAIN_SPECIALTY).toBe(9);
    expect(result.classificationCounts.TRANSVERSAL_FUTURE).toBe(15);
    expect(result.classificationCounts.OUTSIDE_SOFTWARE_DOMAIN).toBe(13);
  });

  it('hash determinista y distinto de SOFTWARE', () => {
    const visual = computeMcMappingPackHash(MC_VISUAL_DESIGN_MAPPING_PACK);
    const software = computeMcMappingPackHash(
      resolveMcMappingPack('SOFTWARE').pack,
    );
    expect(visual).toHaveLength(64);
    expect(visual).not.toBe(software);
    expect(computeMcMappingPackHash(MC_VISUAL_DESIGN_MAPPING_PACK)).toBe(
      visual,
    );
  });

  it('no mapea VISUAL_UI (sin evidencia inventada)', () => {
    const uiMaps = MC_VISUAL_DESIGN_MAPPING_PACK.mappings.filter(
      (m) => m.specialtyCode === 'VISUAL_UI',
    );
    expect(uiMaps).toHaveLength(0);
  });

  it('no mapea SCORM/LMS/AV/soft genéricas al dominio', () => {
    const keys = new Set(
      MC_VISUAL_DESIGN_MAPPING_PACK.mappings.map((m) => m.skillKey),
    );
    for (const banned of [
      'scorm',
      'lms',
      'adobe_premiere_pro',
      'capcut',
      'trabajo_en_equipo',
      'diseno_instruccional',
    ]) {
      expect(keys.has(banned)).toBe(false);
    }
  });
});

describe('MC1.6.1C.2 VISUAL_DESIGN pack V2 (1.1.0)', () => {
  it('valida el pack V2 contra especialidades ACTIVE', () => {
    const result = validateMappingPack(
      MC_VISUAL_DESIGN_MAPPING_PACK_V110,
      new Set([...MC_VISUAL_DESIGN_SPECIALTY_CODES]),
    );
    expect(result.ok).toBe(true);
    expect(result.classificationCounts.DOMAIN_SPECIALTY).toBe(14);
    expect(result.classificationCounts.TRANSVERSAL_FUTURE).toBe(16);
    expect(result.classificationCounts.OUTSIDE_SOFTWARE_DOMAIN).toBe(15);
    expect(
      result.classificationCounts.DOMAIN_SPECIALTY +
        result.classificationCounts.TRANSVERSAL_FUTURE +
        result.classificationCounts.OUTSIDE_SOFTWARE_DOMAIN,
    ).toBe(45);
  });

  it('hash V2 determinista y distinto de V1', () => {
    const v1 = computeMcMappingPackHash(MC_VISUAL_DESIGN_MAPPING_PACK);
    const v2 = computeMcMappingPackHash(MC_VISUAL_DESIGN_MAPPING_PACK_V110);
    expect(v2).toBe(
      '089ae0f0b729b89c6b7bfbf231ebcde1dd681b9df9eb9d24822509fac825c14c',
    );
    expect(v2).not.toBe(v1);
  });

  it('registry default apunta a V2.1 (1.2.0)', () => {
    const vd = resolveMcMappingPack('VISUAL_DESIGN');
    expect(vd.mappingRulesVersion).toBe('1.2.0');
  });

  it('adobe_creative_cloud y suite_adobe quedan OUTSIDE (sin mapping)', () => {
    const mapped = new Set(
      MC_VISUAL_DESIGN_MAPPING_PACK_V110.mappings.map((m) => m.skillKey),
    );
    expect(mapped.has('adobe_creative_cloud')).toBe(false);
    expect(mapped.has('suite_adobe')).toBe(false);
  });
});

describe('pa2-visual-design-1.0.0', () => {
  it('resuelve LEXICOGRAPHIC con umbrales V1', () => {
    const cfg = resolveMcPa2EngineConfig(MC_PA2_RULES_VERSION_VISUAL_V100);
    expect(cfg).toEqual(getMcPa2EngineConfigVisualDesignV100());
    expect(cfg.rankingStrategy).toBe('LEXICOGRAPHIC');
    expect(cfg.minimumMappedSkills).toBe(2);
    expect(cfg.minimumEvidencedSkills).toBe(2);
    expect(cfg.activeCoverageThreshold).toBe(0.45);
  });
});

describe('pa2-visual-design-1.1.0', () => {
  it('resuelve LEXICO V2 con anti-tool companion', () => {
    const cfg = resolveMcPa2EngineConfig(MC_PA2_RULES_VERSION_VISUAL_V110);
    expect(cfg).toEqual(getMcPa2EngineConfigVisualDesignV110());
    expect(cfg.requireProfessionalCompanionForVisible).toBe(true);
    expect(cfg.minimumActiveStrength).toBe(20);
  });
});
