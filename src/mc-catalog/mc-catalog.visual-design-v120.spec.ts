import { validateMappingPack } from './mc-catalog.mapping-validation';
import { MC_VISUAL_DESIGN_SPECIALTY_CODES } from './mc-catalog.definition-mc12';
import { computeMcMappingPackHash } from './mc-catalog.mapping-hash';
import {
  resolveMcMappingPack,
  resolveMcMappingPackByRelease,
  MC_VISUAL_DESIGN_MAPPING_PACK_CODE,
} from './mc-catalog.mapping-registry';
import {
  MC_VISUAL_DESIGN_EXPECTED_DISTRIBUTION_V120,
  MC_VISUAL_DESIGN_MAPPING_PACK_V120,
  MC_VISUAL_DESIGN_MAPPING_RULES_VERSION_V120,
} from './mc-catalog.mapping-visual-design-v120';
import { MC_VISUAL_DESIGN_MAPPING_PACK_V110 } from './mc-catalog.mapping-visual-design-v110';
import { simulateVisualPa2WithPack } from './mc-catalog.visual-pack-simulate';
import type { VisualPackSimulationSkill } from './mc-catalog.visual-pack-simulate';

function skill(
  partial: Partial<VisualPackSimulationSkill> &
    Pick<VisualPackSimulationSkill, 'skillId' | 'skillKey' | 'skillName'>,
): VisualPackSimulationSkill {
  return {
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    evidenceLevel: 'MODERATE',
    evidenceStrength: 50,
    evidenceConfidence: 0.7,
    ...partial,
  };
}

describe('MC1.11.0 VISUAL_DESIGN pack V2.1 (1.2.0)', () => {
  it('valida el pack 1.2.0 y hash distinto de 1.1.0', () => {
    const result = validateMappingPack(
      MC_VISUAL_DESIGN_MAPPING_PACK_V120,
      new Set([...MC_VISUAL_DESIGN_SPECIALTY_CODES]),
    );
    expect(result.ok).toBe(true);
    expect(result.classificationCounts).toEqual({
      DOMAIN_SPECIALTY: 31,
      TRANSVERSAL_FUTURE: 18,
      OUTSIDE_SOFTWARE_DOMAIN: 16,
      AMBIGUOUS: 0,
      CATALOG_GAP: 0,
    });
    expect(MC_VISUAL_DESIGN_EXPECTED_DISTRIBUTION_V120.total).toBe(65);
    const h110 = computeMcMappingPackHash(MC_VISUAL_DESIGN_MAPPING_PACK_V110);
    const h120 = computeMcMappingPackHash(MC_VISUAL_DESIGN_MAPPING_PACK_V120);
    expect(h120).toBe(
      '5d1d1f2070a87f9b5959f481cb0a53ec593f1b020373828e37f84e2dfcb7c50c',
    );
    expect(h120).not.toBe(h110);
  });

  it('release 1.2.0 es default vigente tras MC1.11.0', () => {
    const release = resolveMcMappingPackByRelease(
      MC_VISUAL_DESIGN_MAPPING_PACK_CODE,
      MC_VISUAL_DESIGN_MAPPING_RULES_VERSION_V120,
    );
    expect(release.mappingRulesVersion).toBe('1.2.0');
    expect(resolveMcMappingPack('VISUAL_DESIGN').mappingRulesVersion).toBe(
      '1.2.0',
    );
  });

  it('no mapea VISUAL_UI; DIGITAL sigue presente pero deprecated documentalmente', () => {
    const ui = MC_VISUAL_DESIGN_MAPPING_PACK_V120.mappings.filter(
      (m) => m.specialtyCode === 'VISUAL_UI',
    );
    expect(ui).toHaveLength(0);
    const digital = MC_VISUAL_DESIGN_MAPPING_PACK_V120.mappings.filter(
      (m) => m.specialtyCode === 'VISUAL_DIGITAL_ASSETS',
    );
    expect(digital.length).toBeGreaterThan(0);
  });

  it('Adobe / Canva sin profesional no activan Visual (anti-tool)', () => {
    const outcome = simulateVisualPa2WithPack({
      pack: MC_VISUAL_DESIGN_MAPPING_PACK_V120,
      packVersion: '1.2.0',
      skills: [
        skill({
          skillId: '1',
          skillKey: 'adobe_photoshop',
          skillName: 'Adobe Photoshop',
          skillType: 'TOOL',
          evidenceLevel: 'WEAK',
          evidenceStrength: 20,
        }),
        skill({
          skillId: '2',
          skillKey: 'canva',
          skillName: 'Canva',
          skillType: 'TOOL',
          evidenceLevel: 'NONE',
          evidenceStrength: 0,
        }),
      ],
    });
    expect(outcome.result.activeCount).toBe(0);
    expect(outcome.conceptualClass).not.toBe('PRIMARY_MATCH');
  });

  it('Branding con evidencia profesional activa Identidad (EMERGENT o ACTIVE)', () => {
    const outcome = simulateVisualPa2WithPack({
      pack: MC_VISUAL_DESIGN_MAPPING_PACK_V120,
      packVersion: '1.2.0',
      skills: [
        skill({
          skillId: '10',
          skillKey: 'branding_y_diseno_de_identidad_corporativa',
          skillName: 'Branding y Diseño de Identidad Corporativa',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 50,
        }),
        skill({
          skillId: '11',
          skillKey: 'diseno_de_marca',
          skillName: 'Diseño de Marca',
          evidenceLevel: 'STRONG',
          evidenceStrength: 80,
        }),
      ],
    });
    const identity = outcome.result.specialtyResults.find(
      (r) => r.specialtyCode === 'VISUAL_IDENTITY',
    );
    expect(identity).toBeDefined();
    expect(['ACTIVE', 'EMERGENT']).toContain(identity!.presentationStatus);
    expect(identity!.presentationStatus).not.toBe('HIDDEN');
  });

  it('Diagramación/editorial compuesto activa Editorial', () => {
    const outcome = simulateVisualPa2WithPack({
      pack: MC_VISUAL_DESIGN_MAPPING_PACK_V120,
      packVersion: '1.2.0',
      skills: [
        skill({
          skillId: '20',
          skillKey: 'diseno_editorial_y_diagramacion',
          skillName: 'Diseño Editorial y Diagramación',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 55,
        }),
        skill({
          skillId: '21',
          skillKey: 'maquetacion',
          skillName: 'Maquetación',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 50,
        }),
      ],
    });
    const editorial = outcome.result.specialtyResults.find(
      (r) => r.specialtyCode === 'VISUAL_EDITORIAL',
    );
    expect(editorial).toBeDefined();
    expect(['ACTIVE', 'EMERGENT']).toContain(editorial!.presentationStatus);
  });

  it('Figma/UX sin práctica UI mapeada no activa VISUAL_UI', () => {
    const outcome = simulateVisualPa2WithPack({
      pack: MC_VISUAL_DESIGN_MAPPING_PACK_V120,
      packVersion: '1.2.0',
      skills: [
        skill({
          skillId: '30',
          skillKey: 'diseno_ux/ui',
          skillName: 'Diseño UX/UI',
          evidenceLevel: 'STRONG',
          evidenceStrength: 90,
        }),
      ],
    });
    const ui = outcome.result.specialtyResults.find(
      (r) => r.specialtyCode === 'VISUAL_UI',
    );
    expect(ui?.presentationStatus ?? 'HIDDEN').toBe('HIDDEN');
    expect(outcome.result.activeCount).toBe(0);
  });

  it('Gráfico no absorbe Identity/Editorial como única especialidad PRIMARY', () => {
    const outcome = simulateVisualPa2WithPack({
      pack: MC_VISUAL_DESIGN_MAPPING_PACK_V120,
      packVersion: '1.2.0',
      skills: [
        skill({
          skillId: '40',
          skillKey: 'identidad_visual',
          skillName: 'Identidad visual',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 60,
        }),
        skill({
          skillId: '41',
          skillKey: 'diseno_editorial_y_diagramacion',
          skillName: 'Diseño Editorial y Diagramación',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 55,
        }),
        skill({
          skillId: '42',
          skillKey: 'diseno_grafico',
          skillName: 'Diseño Gráfico',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 55,
        }),
      ],
    });
    const visible = outcome.result.specialtyResults.filter(
      (r) => r.presentationStatus !== 'HIDDEN',
    );
    const codes = visible.map((r) => r.specialtyCode);
    expect(codes).toEqual(
      expect.arrayContaining(['VISUAL_GRAPHIC', 'VISUAL_IDENTITY', 'VISUAL_EDITORIAL']),
    );
  });

  it('perfil generalista distribuido puede alcanzar PRIMARY vía cardinalidad GRAPHIC', () => {
    const before = simulateVisualPa2WithPack({
      pack: MC_VISUAL_DESIGN_MAPPING_PACK_V110,
      packVersion: '1.1.0',
      skills: [
        skill({
          skillId: '50',
          skillKey: 'diseno_grafico',
          skillName: 'Diseño Gráfico',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 60,
        }),
        skill({
          skillId: '51',
          skillKey: 'identidad_visual',
          skillName: 'Identidad visual',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 55,
        }),
        skill({
          skillId: '52',
          skillKey: 'diseno_editorial_y_diagramacion',
          skillName: 'Diseño Editorial y Diagramación',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 55,
        }),
      ],
    });
    const after = simulateVisualPa2WithPack({
      pack: MC_VISUAL_DESIGN_MAPPING_PACK_V120,
      packVersion: '1.2.0',
      skills: [
        skill({
          skillId: '50',
          skillKey: 'diseno_grafico',
          skillName: 'Diseño Gráfico',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 60,
        }),
        skill({
          skillId: '51',
          skillKey: 'identidad_visual',
          skillName: 'Identidad visual',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 55,
        }),
        skill({
          skillId: '52',
          skillKey: 'diseno_editorial_y_diagramacion',
          skillName: 'Diseño Editorial y Diagramación',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 55,
        }),
      ],
    });
    expect(before.conceptualClass).toBe('SECONDARY_SIGNAL');
    expect(after.conceptualClass).toBe('PRIMARY_MATCH');
    expect(after.result.activeCount).toBeGreaterThanOrEqual(1);
  });
});
