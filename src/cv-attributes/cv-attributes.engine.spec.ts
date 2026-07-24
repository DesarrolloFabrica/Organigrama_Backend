import {
  AttributeEngineError,
  runAttributeEngine,
} from './cv-attributes-engine.service';
import {
  PA1_INTENTIONAL_UNMAPPED,
  PA1_MACROS,
  PA1_MAPPINGS,
  PA1_SUBS,
} from './cv-attributes.catalog-pa1';
import {
  diminishingFactorForRank,
  getDefaultAttributeEngineConfig,
} from './cv-attributes.config';
import { computeRawContribution } from './cv-attributes.contribution';
import {
  computeAttributeConfigHash,
  computeCatalogDefinitionHash,
  computeMappingHash,
} from './cv-attributes.hash';
import { resolveSupportLevel } from './cv-attributes.levels';
import { validateAttributeCatalog } from './cv-attributes.mapping-validation';
import type {
  AttributeCatalog,
  AttributeCatalogMacro,
  AttributeCatalogSub,
  AttributeMapping,
  AttributeSkillInput,
} from './cv-attributes.types';
import type { EvidenceLevel } from '../cv-evidence/cv-evidence.types';

const config = getDefaultAttributeEngineConfig();

function macro(code: string, id = code): AttributeCatalogMacro {
  return { id, code, name: code, sortOrder: 1, isActive: true };
}

function sub(
  code: string,
  macroId: string,
  overrides: Partial<AttributeCatalogSub> = {},
): AttributeCatalogSub {
  return {
    id: code,
    macroattributeId: macroId,
    code,
    name: code,
    sortOrder: 1,
    isActive: true,
    minimumSupportingSkills: 3,
    ...overrides,
  };
}

function mapping(
  skillId: string,
  subattributeId: string,
  weight: number,
  mappingType: AttributeMapping['mappingType'] = 'DIRECT',
  overrides: Partial<AttributeMapping> = {},
): AttributeMapping {
  return {
    id: `${skillId}->${subattributeId}`,
    skillId,
    subattributeId,
    weight,
    mappingType,
    isActive: true,
    ...overrides,
  };
}

function skill(
  skillId: string,
  strength: number,
  level: EvidenceLevel,
  confidence = 0.8,
  name = `skill-${skillId}`,
): AttributeSkillInput {
  return {
    evaluationItemId: `item-${skillId}`,
    extractionSkillId: `es-${skillId}`,
    skillId,
    normalizedName: name,
    evidenceStrength: strength,
    evidenceConfidence: confidence,
    evidenceLevel: level,
  };
}

function catalogOf(
  macros: AttributeCatalogMacro[],
  subs: AttributeCatalogSub[],
  mappings: AttributeMapping[],
  overrides: Partial<AttributeCatalog> = {},
): AttributeCatalog {
  return {
    catalogVersionId: '1',
    catalogCode: 'test-catalog',
    catalogVersion: 'test-1',
    status: 'ACTIVE',
    macroattributes: macros,
    subattributes: subs,
    mappings,
    ...overrides,
  };
}

// ─── A. Validación de mappings ────────────────────────────────────────────────

describe('validateAttributeCatalog', () => {
  it('acepta una suma de weights por skill igual a 1', () => {
    const result = validateAttributeCatalog(
      catalogOf(
        [macro('M')],
        [sub('A', 'M'), sub('B', 'M')],
        [mapping('s1', 'A', 0.6), mapping('s1', 'B', 0.4)],
      ),
    );
    expect(result.ok).toBe(true);
    expect(result.weightSumBySkill.s1).toBeCloseTo(1, 4);
  });

  it('rechaza suma de weights por skill mayor a 1', () => {
    const result = validateAttributeCatalog(
      catalogOf(
        [macro('M')],
        [sub('A', 'M'), sub('B', 'M')],
        [mapping('s1', 'A', 0.7), mapping('s1', 'B', 0.4)],
      ),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('WEIGHT_SUM_EXCEEDED');
  });

  it('rechaza weight fuera de rango', () => {
    const zero = validateAttributeCatalog(
      catalogOf([macro('M')], [sub('A', 'M')], [mapping('s1', 'A', 0)]),
    );
    const tooBig = validateAttributeCatalog(
      catalogOf([macro('M')], [sub('A', 'M')], [mapping('s1', 'A', 1.5)]),
    );
    expect(zero.errors.map((e) => e.code)).toContain('WEIGHT_OUT_OF_RANGE');
    expect(tooBig.errors.map((e) => e.code)).toContain('WEIGHT_OUT_OF_RANGE');
  });

  it('rechaza mappings duplicados (misma skill, mismo subatributo)', () => {
    const result = validateAttributeCatalog(
      catalogOf(
        [macro('M')],
        [sub('A', 'M')],
        [
          mapping('s1', 'A', 0.4),
          mapping('s1', 'A', 0.3, 'SUPPORTING', { id: 'dup' }),
        ],
      ),
    );
    expect(result.errors.map((e) => e.code)).toContain('DUPLICATE_MAPPING');
  });

  it('ignora mappings inactivos en la suma de weights', () => {
    const result = validateAttributeCatalog(
      catalogOf(
        [macro('M')],
        [sub('A', 'M'), sub('B', 'M')],
        [
          mapping('s1', 'A', 0.8),
          mapping('s1', 'B', 0.8, 'SUPPORTING', { isActive: false }),
        ],
      ),
    );
    expect(result.ok).toBe(true);
    expect(result.weightSumBySkill.s1).toBeCloseTo(0.8, 4);
  });

  it('rechaza mapping hacia un subatributo desconocido o inactivo', () => {
    const unknown = validateAttributeCatalog(
      catalogOf([macro('M')], [sub('A', 'M')], [mapping('s1', 'GHOST', 0.5)]),
    );
    const inactive = validateAttributeCatalog(
      catalogOf(
        [macro('M')],
        [sub('A', 'M'), sub('B', 'M', { isActive: false })],
        [mapping('s1', 'B', 0.5)],
      ),
    );
    expect(unknown.errors.map((e) => e.code)).toContain('UNKNOWN_SUBATTRIBUTE');
    expect(inactive.errors.map((e) => e.code)).toContain('INACTIVE_SUBATTRIBUTE');
  });

  it('trata un catálogo no ACTIVE como warning en dry-run y error si se exige activo', () => {
    const draft = catalogOf(
      [macro('M')],
      [sub('A', 'M')],
      [mapping('s1', 'A', 0.5)],
      { status: 'DRAFT' },
    );
    expect(validateAttributeCatalog(draft).ok).toBe(true);
    expect(
      validateAttributeCatalog(draft, { requireActiveCatalog: true }).ok,
    ).toBe(false);
  });

  it('el engine falla si el catálogo es inválido', () => {
    expect(() =>
      runAttributeEngine(
        [skill('s1', 50, 'MODERATE')],
        catalogOf(
          [macro('M')],
          [sub('A', 'M'), sub('B', 'M')],
          [mapping('s1', 'A', 0.7), mapping('s1', 'B', 0.5)],
        ),
        config,
      ),
    ).toThrow(AttributeEngineError);
  });
});

// ─── B. Contribución ──────────────────────────────────────────────────────────

describe('computeRawContribution', () => {
  it('NONE produce contribución 0', () => {
    const out = computeRawContribution(
      { evidenceStrength: 80, evidenceLevel: 'NONE', mappingWeight: 1 },
      config,
    );
    expect(out.levelFactor).toBe(0);
    expect(out.rawContribution).toBe(0);
  });

  it('WEAK < MODERATE < STRONG con mismo strength y weight', () => {
    const of = (level: EvidenceLevel) =>
      computeRawContribution(
        { evidenceStrength: 50, evidenceLevel: level, mappingWeight: 0.5 },
        config,
      ).rawContribution;
    expect(of('WEAK')).toBeLessThan(of('MODERATE'));
    expect(of('MODERATE')).toBeLessThan(of('STRONG'));
    expect(of('STRONG')).toBeCloseTo(25, 4);
  });

  it('escala linealmente con el mapping weight', () => {
    const half = computeRawContribution(
      { evidenceStrength: 60, evidenceLevel: 'STRONG', mappingWeight: 0.5 },
      config,
    ).rawContribution;
    const full = computeRawContribution(
      { evidenceStrength: 60, evidenceLevel: 'STRONG', mappingWeight: 1 },
      config,
    ).rawContribution;
    expect(half * 2).toBeCloseTo(full, 4);
  });

  it('es determinista para la misma entrada', () => {
    const input = {
      evidenceStrength: 71.8,
      evidenceLevel: 'STRONG' as EvidenceLevel,
      mappingWeight: 0.45,
    };
    expect(computeRawContribution(input, config)).toEqual(
      computeRawContribution(input, config),
    );
  });

  it('no usa evidenceConfidence como multiplicador del score', () => {
    const low = runAttributeEngine(
      [skill('s1', 60, 'MODERATE', 0.2)],
      catalogOf([macro('M')], [sub('A', 'M')], [mapping('s1', 'A', 1)]),
      config,
    );
    const high = runAttributeEngine(
      [skill('s1', 60, 'MODERATE', 0.95)],
      catalogOf([macro('M')], [sub('A', 'M')], [mapping('s1', 'A', 1)]),
      config,
    );
    expect(low.subattributes[0].score).toBe(high.subattributes[0].score);
    expect(low.subattributes[0].confidence).toBeLessThan(
      high.subattributes[0].confidence,
    );
  });
});

// ─── C. Subatributos ──────────────────────────────────────────────────────────

describe('agregación de subatributos', () => {
  it('una sola skill STRONG produce score = strength × weight', () => {
    const result = runAttributeEngine(
      [skill('s1', 80, 'STRONG')],
      catalogOf([macro('M')], [sub('A', 'M')], [mapping('s1', 'A', 0.5)]),
      config,
    );
    const a = result.subattributes[0];
    expect(a.score).toBe(40);
    expect(a.contributingSkillsCount).toBe(1);
    expect(a.qualityFlags).toContain('SINGLE_SKILL_SUPPORT');
    expect(a.qualityFlags).toContain('HAS_STRONG_SUPPORT');
  });

  it('aplica rendimiento decreciente 1.00 / 0.70 / 0.50 / 0.30', () => {
    expect(diminishingFactorForRank(config, 1)).toBe(1);
    expect(diminishingFactorForRank(config, 2)).toBe(0.7);
    expect(diminishingFactorForRank(config, 3)).toBe(0.5);
    expect(diminishingFactorForRank(config, 4)).toBe(0.3);
    expect(diminishingFactorForRank(config, 9)).toBe(0.3);

    const result = runAttributeEngine(
      [
        skill('s1', 100, 'STRONG'),
        skill('s2', 100, 'STRONG'),
        skill('s3', 100, 'STRONG'),
      ],
      catalogOf(
        [macro('M')],
        [sub('A', 'M')],
        [
          mapping('s1', 'A', 0.1),
          mapping('s2', 'A', 0.1),
          mapping('s3', 'A', 0.1),
        ],
      ),
      config,
    );
    // 10 + 10×0.70 + 10×0.50 = 22
    expect(result.subattributes[0].score).toBe(22);
  });

  it('diez skills WEAK no superan a dos STRONG aplicadas', () => {
    const weakSkills = Array.from({ length: 10 }, (_, i) =>
      skill(`w${i}`, 20, 'WEAK'),
    );
    const weakResult = runAttributeEngine(
      weakSkills,
      catalogOf(
        [macro('M')],
        [sub('A', 'M')],
        weakSkills.map((s) => mapping(s.skillId, 'A', 1)),
      ),
      config,
    );
    const strongResult = runAttributeEngine(
      [skill('a', 78, 'STRONG'), skill('b', 72, 'STRONG')],
      catalogOf(
        [macro('M')],
        [sub('A', 'M')],
        [mapping('a', 'A', 1), mapping('b', 'A', 1)],
      ),
      config,
    );
    expect(weakResult.subattributes[0].score).toBeLessThan(
      strongResult.subattributes[0].score,
    );
  });

  it('aplica el cap del score y lo reporta en el breakdown', () => {
    const skills = Array.from({ length: 6 }, (_, i) =>
      skill(`s${i}`, 100, 'STRONG'),
    );
    const result = runAttributeEngine(
      skills,
      catalogOf(
        [macro('M')],
        [sub('A', 'M')],
        skills.map((s) => mapping(s.skillId, 'A', 1)),
      ),
      config,
    );
    expect(result.subattributes[0].score).toBe(100);
    expect(result.subattributes[0].scoringBreakdown.capApplied).toBe(true);
  });

  it('coverage crece con las skills contribuyentes hasta el target', () => {
    const build = (n: number) => {
      const skills = Array.from({ length: n }, (_, i) =>
        skill(`s${i}`, 40, 'MODERATE'),
      );
      return runAttributeEngine(
        skills,
        catalogOf(
          [macro('M')],
          [sub('A', 'M')],
          skills.map((s) => mapping(s.skillId, 'A', 0.3)),
        ),
        config,
      ).subattributes[0].coverage;
    };
    expect(build(1)).toBeCloseTo(0.3333, 3);
    expect(build(2)).toBeCloseTo(0.6667, 3);
    expect(build(3)).toBe(1);
    expect(build(5)).toBe(1);
  });

  it('coverage no es lo mismo que score', () => {
    const result = runAttributeEngine(
      [
        skill('s1', 1, 'WEAK'),
        skill('s2', 1, 'WEAK'),
        skill('s3', 1, 'WEAK'),
      ],
      catalogOf(
        [macro('M')],
        [sub('A', 'M')],
        [
          mapping('s1', 'A', 0.5),
          mapping('s2', 'A', 0.5),
          mapping('s3', 'A', 0.5),
        ],
      ),
      config,
    );
    const a = result.subattributes[0];
    expect(a.coverage).toBe(1);
    expect(a.score).toBeLessThan(5);
    expect(a.level).toBe('LIMITED');
  });

  it('penaliza confidence cuando una sola skill concentra el soporte', () => {
    const concentrated = runAttributeEngine(
      [skill('s1', 90, 'STRONG', 0.9), skill('s2', 2, 'WEAK', 0.9)],
      catalogOf(
        [macro('M')],
        [sub('A', 'M')],
        [mapping('s1', 'A', 1), mapping('s2', 'A', 1)],
      ),
      config,
    ).subattributes[0];
    const balanced = runAttributeEngine(
      [skill('s1', 50, 'STRONG', 0.9), skill('s2', 50, 'STRONG', 0.9)],
      catalogOf(
        [macro('M')],
        [sub('A', 'M')],
        [mapping('s1', 'A', 1), mapping('s2', 'A', 1)],
      ),
      config,
    ).subattributes[0];

    expect(concentrated.qualityFlags).toContain('CONCENTRATED_SUPPORT');
    expect(balanced.qualityFlags).not.toContain('CONCENTRATED_SUPPORT');
    expect(concentrated.confidence).toBeLessThan(balanced.confidence);
  });

  it('una skill fuerte única da score alto con confidence media', () => {
    const only = runAttributeEngine(
      [skill('s1', 90, 'STRONG', 0.86)],
      catalogOf([macro('M')], [sub('A', 'M')], [mapping('s1', 'A', 1)]),
      config,
    ).subattributes[0];
    expect(only.score).toBe(90);
    expect(only.level).toBe('WELL_SUPPORTED');
    expect(only.confidence).toBeCloseTo(0.71, 2);
    expect(only.qualityFlags).toContain('SINGLE_SKILL_SUPPORT');
  });

  it('marca NO_MAPPED_SKILLS y NO_CONTRIBUTING_SKILLS con score 0', () => {
    const result = runAttributeEngine(
      [skill('s1', 50, 'MODERATE')],
      catalogOf([macro('M')], [sub('A', 'M'), sub('B', 'M')], [
        mapping('s1', 'A', 1),
      ]),
      config,
    );
    const b = result.subattributes.find((s) => s.subattributeCode === 'B')!;
    expect(b.score).toBe(0);
    expect(b.level).toBe('NO_SUPPORT');
    expect(b.qualityFlags).toEqual(
      expect.arrayContaining(['NO_MAPPED_SKILLS', 'NO_CONTRIBUTING_SKILLS']),
    );
    expect(b.confidence).toBe(0);
  });

  it('una skill NONE mapeada no genera soporte y queda explicada', () => {
    const result = runAttributeEngine(
      [skill('s1', 0, 'NONE', 0.42, 'Trabajo en equipo')],
      catalogOf([macro('M')], [sub('TEAMWORK', 'M')], [
        mapping('s1', 'TEAMWORK', 1),
      ]),
      config,
    );
    const teamwork = result.subattributes[0];
    expect(teamwork.score).toBe(0);
    expect(teamwork.level).toBe('NO_SUPPORT');
    expect(teamwork.supportingSkillsCount).toBe(1);
    expect(teamwork.contributingSkillsCount).toBe(0);
    expect(teamwork.noneSupportCount).toBe(1);
    expect(teamwork.qualityFlags).toContain('NO_CONTRIBUTING_SKILLS');
    expect(teamwork.qualityFlags).not.toContain('NO_MAPPED_SKILLS');
    expect(result.metrics.ignoredNoneSkills).toBe(1);
    const contribution = (
      teamwork.scoringBreakdown.contributions as Array<Record<string, unknown>>
    )[0];
    expect(contribution.ignoredReason).toBe('EVIDENCE_LEVEL_NONE');
  });

  it('marca WEAK_ONLY_SUPPORT y CONTEXTUAL_MAPPING_ONLY', () => {
    const result = runAttributeEngine(
      [skill('s1', 10, 'WEAK')],
      catalogOf([macro('M')], [sub('A', 'M')], [
        mapping('s1', 'A', 0.5, 'CONTEXTUAL'),
      ]),
      config,
    ).subattributes[0];
    expect(result.qualityFlags).toContain('WEAK_ONLY_SUPPORT');
    expect(result.qualityFlags).toContain('CONTEXTUAL_MAPPING_ONLY');
  });

  it('los niveles respetan los umbrales y no usan nombres de competencia', () => {
    expect(resolveSupportLevel(0, config)).toBe('NO_SUPPORT');
    expect(resolveSupportLevel(0.5, config)).toBe('LIMITED');
    expect(resolveSupportLevel(24.99, config)).toBe('LIMITED');
    expect(resolveSupportLevel(25, config)).toBe('DEVELOPING');
    expect(resolveSupportLevel(49.99, config)).toBe('DEVELOPING');
    expect(resolveSupportLevel(50, config)).toBe('ESTABLISHED');
    expect(resolveSupportLevel(74.99, config)).toBe('ESTABLISHED');
    expect(resolveSupportLevel(75, config)).toBe('WELL_SUPPORTED');
    expect(resolveSupportLevel(100, config)).toBe('WELL_SUPPORTED');
  });
});

// ─── D. Macroatributos ────────────────────────────────────────────────────────

describe('agregación de macroatributos', () => {
  it('promedia solo los subatributos con soporte', () => {
    const result = runAttributeEngine(
      [skill('s1', 60, 'STRONG'), skill('s2', 40, 'STRONG')],
      catalogOf(
        [macro('M')],
        [sub('A', 'M'), sub('B', 'M'), sub('C', 'M')],
        [mapping('s1', 'A', 1), mapping('s2', 'B', 1)],
      ),
      config,
    );
    const m = result.macroattributes[0];
    expect(m.score).toBe(50);
    expect(m.supportedSubattributesCount).toBe(2);
    expect(m.totalSubattributesCount).toBe(3);
    expect(m.scoringBreakdown.supportedAverage).toBe(50);
    expect(m.scoringBreakdown.fullCatalogAverage).toBeCloseTo(33.3333, 3);
  });

  it('coverage del macro es subatributos con soporte / activos', () => {
    const result = runAttributeEngine(
      [skill('s1', 60, 'STRONG')],
      catalogOf(
        [macro('M')],
        [sub('A', 'M'), sub('B', 'M'), sub('C', 'M'), sub('D', 'M')],
        [mapping('s1', 'A', 1)],
      ),
      config,
    );
    expect(result.macroattributes[0].coverage).toBe(0.25);
  });

  it('penaliza confidence cuando solo un subatributo aporta', () => {
    const single = runAttributeEngine(
      [skill('s1', 60, 'STRONG', 0.9)],
      catalogOf([macro('M')], [sub('A', 'M'), sub('B', 'M')], [
        mapping('s1', 'A', 1),
      ]),
      config,
    ).macroattributes[0];
    const multiple = runAttributeEngine(
      [skill('s1', 60, 'STRONG', 0.9), skill('s2', 60, 'STRONG', 0.9)],
      catalogOf([macro('M')], [sub('A', 'M'), sub('B', 'M')], [
        mapping('s1', 'A', 1),
        mapping('s2', 'B', 1),
      ]),
      config,
    ).macroattributes[0];

    expect(single.qualityFlags).toContain('SINGLE_SUBATTRIBUTE_SUPPORT');
    expect(multiple.qualityFlags).toContain('MULTIPLE_SUBATTRIBUTE_SUPPORT');
    expect(single.confidence).toBeLessThan(multiple.confidence);
    expect(single.explanation).toContain('un solo subatributo');
  });

  it('un macroatributo sin soporte queda en NO_SUPPORT', () => {
    const result = runAttributeEngine(
      [skill('s1', 0, 'NONE')],
      catalogOf([macro('M')], [sub('A', 'M'), sub('B', 'M')], [
        mapping('s1', 'A', 1),
      ]),
      config,
    ).macroattributes[0];
    expect(result.score).toBe(0);
    expect(result.level).toBe('NO_SUPPORT');
    expect(result.confidence).toBe(0);
    expect(result.qualityFlags).toContain('NO_SUPPORTED_SUBATTRIBUTES');
  });

  it('se agrega desde subattribute results, nunca desde skills', () => {
    const result = runAttributeEngine(
      [skill('s1', 100, 'STRONG')],
      catalogOf(
        [macro('M')],
        [sub('A', 'M'), sub('B', 'M')],
        [mapping('s1', 'A', 0.5), mapping('s1', 'B', 0.5)],
      ),
      config,
    );
    const subScores = result.subattributes.map((s) => s.score);
    expect(subScores).toEqual([50, 50]);
    expect(result.macroattributes[0].score).toBe(50);
  });

  it('respeta pesos declarados por subatributo', () => {
    const weighted: AttributeCatalogMacro = {
      ...macro('M'),
      subattributeWeights: { A: 3, B: 1 },
    };
    const result = runAttributeEngine(
      [skill('s1', 80, 'STRONG'), skill('s2', 40, 'STRONG')],
      catalogOf(
        [weighted],
        [sub('A', 'M'), sub('B', 'M')],
        [mapping('s1', 'A', 1), mapping('s2', 'B', 1)],
      ),
      config,
    );
    expect(result.macroattributes[0].score).toBe(70);
  });
});

// ─── E. Trazas ────────────────────────────────────────────────────────────────

describe('trazas de contribución', () => {
  it('registra el desglose exacto por mapping', () => {
    const result = runAttributeEngine(
      [skill('s1', 50, 'MODERATE', 0.86), skill('s2', 20, 'WEAK', 0.7)],
      catalogOf(
        [macro('M')],
        [sub('A', 'M')],
        [mapping('s1', 'A', 0.6), mapping('s2', 'A', 0.5, 'SUPPORTING')],
      ),
      config,
    ).subattributes[0];

    const [first, second] = result.traces;
    expect(first.rawContribution).toBeCloseTo(50 * 0.6 * 0.9, 4);
    expect(first.diminishingFactor).toBe(1);
    expect(first.normalizedContribution).toBeCloseTo(27, 4);
    expect(first.contributionRank).toBe(1);

    expect(second.rawContribution).toBeCloseTo(20 * 0.5 * 0.7, 4);
    expect(second.diminishingFactor).toBe(0.7);
    expect(second.normalizedContribution).toBeCloseTo(4.9, 4);
    expect(second.contributionRank).toBe(2);

    expect(result.score).toBeCloseTo(31.9, 2);
    expect(
      first.normalizedContribution + second.normalizedContribution,
    ).toBeCloseTo(result.score, 2);
  });

  it('una skill sin contribución no consume el rank de las demás', () => {
    const result = runAttributeEngine(
      [skill('none', 0, 'NONE'), skill('s1', 40, 'STRONG')],
      catalogOf(
        [macro('M')],
        [sub('A', 'M')],
        [mapping('none', 'A', 1), mapping('s1', 'A', 1)],
      ),
      config,
    ).subattributes[0];
    const contributing = result.traces.find((t) => t.skillId === 's1')!;
    expect(contributing.contributionRank).toBe(1);
    expect(contributing.diminishingFactor).toBe(1);
    expect(result.score).toBe(40);
  });

  it('produce una traza por cada mapping evaluado', () => {
    const result = runAttributeEngine(
      [skill('s1', 50, 'MODERATE'), skill('s2', 0, 'NONE')],
      catalogOf(
        [macro('M')],
        [sub('A', 'M')],
        [mapping('s1', 'A', 0.5), mapping('s2', 'A', 0.5)],
      ),
      config,
    );
    expect(result.metrics.tracesCount).toBe(2);
    expect(result.subattributes[0].traces).toHaveLength(2);
  });
});

// ─── Skills sin mapping ───────────────────────────────────────────────────────

describe('skills sin mapping', () => {
  it('registra UNMAPPED_SKILL sin fallar el run', () => {
    const result = runAttributeEngine(
      [skill('s1', 50, 'MODERATE'), skill('huerfana', 60, 'STRONG')],
      catalogOf([macro('M')], [sub('A', 'M')], [mapping('s1', 'A', 1)]),
      config,
    );
    expect(result.unmappedSkills).toHaveLength(1);
    expect(result.unmappedSkills[0].skillId).toBe('huerfana');
    expect(result.metrics.unmappedSkills).toBe(1);
    expect(result.metrics.mappedSkills).toBe(1);
    expect(result.warnings.some((w) => w.startsWith('UNMAPPED_SKILL'))).toBe(
      true,
    );
  });

  it('un mapping hacia una skill ausente del perfil no genera contribución', () => {
    const result = runAttributeEngine(
      [skill('s1', 50, 'MODERATE')],
      catalogOf(
        [macro('M')],
        [sub('A', 'M')],
        [mapping('s1', 'A', 0.5), mapping('ausente', 'A', 0.5)],
      ),
      config,
    ).subattributes[0];
    expect(result.supportingSkillsCount).toBe(1);
    expect(result.traces).toHaveLength(1);
  });

  it('marca HAS_UNMAPPED_RELATED_SKILLS con relaciones declaradas', () => {
    const result = runAttributeEngine(
      [skill('s1', 50, 'MODERATE'), skill('creatividad', 0, 'NONE')],
      catalogOf([macro('M')], [sub('A', 'M')], [mapping('s1', 'A', 1)], {
        unmappedRelations: [
          {
            skillId: 'creatividad',
            skillName: 'Creatividad',
            reason: 'sin subatributo inequívoco',
            relatedSubattributeIds: ['A'],
          },
        ],
      }),
      config,
    ).subattributes[0];
    expect(result.qualityFlags).toContain('HAS_UNMAPPED_RELATED_SKILLS');
    expect(result.scoringBreakdown.unmappedRelatedSkills).toEqual([
      'Creatividad',
    ]);
  });
});

// ─── F. Hashes e idempotencia ─────────────────────────────────────────────────

describe('hashes', () => {
  const base = catalogOf(
    [macro('M')],
    [sub('A', 'M')],
    [mapping('s1', 'A', 0.5)],
  );

  it('mappingHash es estable e independiente del orden', () => {
    const reordered = catalogOf(
      [macro('M')],
      [sub('A', 'M'), sub('B', 'M')],
      [mapping('s2', 'B', 0.5), mapping('s1', 'A', 0.5)],
    );
    const original = catalogOf(
      [macro('M')],
      [sub('B', 'M'), sub('A', 'M')],
      [mapping('s1', 'A', 0.5), mapping('s2', 'B', 0.5)],
    );
    expect(computeMappingHash(reordered)).toBe(computeMappingHash(original));
  });

  it('mappingHash cambia si cambia un weight', () => {
    const changed = catalogOf(
      [macro('M')],
      [sub('A', 'M')],
      [mapping('s1', 'A', 0.6)],
    );
    expect(computeMappingHash(changed)).not.toBe(computeMappingHash(base));
  });

  it('mappingHash cambia si se agrega o desactiva un mapping', () => {
    const added = catalogOf(
      [macro('M')],
      [sub('A', 'M'), sub('B', 'M')],
      [mapping('s1', 'A', 0.5), mapping('s1', 'B', 0.4)],
    );
    const deactivated = catalogOf(
      [macro('M')],
      [sub('A', 'M')],
      [mapping('s1', 'A', 0.5, 'DIRECT', { isActive: false })],
    );
    expect(computeMappingHash(added)).not.toBe(computeMappingHash(base));
    expect(computeMappingHash(deactivated)).not.toBe(computeMappingHash(base));
  });

  it('mappingHash cambia si cambia la estructura del catálogo', () => {
    const changedSub = catalogOf(
      [macro('M')],
      [sub('A', 'M', { minimumSupportingSkills: 5 })],
      [mapping('s1', 'A', 0.5)],
    );
    expect(computeMappingHash(changedSub)).not.toBe(computeMappingHash(base));
  });

  it('configHash cambia si cambia la config y es estable si no', () => {
    const same = getDefaultAttributeEngineConfig();
    expect(computeAttributeConfigHash(same)).toBe(
      computeAttributeConfigHash(config),
    );
    const tweaked = getDefaultAttributeEngineConfig();
    tweaked.levelFactors.WEAK = 0.5;
    expect(computeAttributeConfigHash(tweaked)).not.toBe(
      computeAttributeConfigHash(config),
    );
  });

  it('el engine es determinista entre ejecuciones', () => {
    const skills = [
      skill('s1', 77.5, 'STRONG', 0.86),
      skill('s2', 50, 'MODERATE', 0.86),
      skill('s3', 1, 'WEAK', 0.82),
    ];
    const catalog = catalogOf(
      [macro('M')],
      [sub('A', 'M'), sub('B', 'M')],
      [
        mapping('s1', 'A', 0.6),
        mapping('s1', 'B', 0.4),
        mapping('s2', 'A', 0.5),
        mapping('s3', 'B', 0.5),
      ],
    );
    const first = runAttributeEngine(skills, catalog, config);
    const second = runAttributeEngine([...skills].reverse(), catalog, config);
    expect(second.subattributes).toEqual(first.subattributes);
    expect(second.macroattributes).toEqual(first.macroattributes);
  });
});

// ─── Catálogo pa1 ─────────────────────────────────────────────────────────────

describe('catálogo pa1', () => {
  it('declara los 5 macroatributos y 31 subatributos esperados', () => {
    expect(PA1_MACROS).toHaveLength(5);
    expect(PA1_SUBS).toHaveLength(31);
    const macroCodes = new Set(PA1_MACROS.map((m) => m.code));
    for (const s of PA1_SUBS) {
      expect(macroCodes.has(s.macroCode)).toBe(true);
    }
  });

  it('ningún subatributo usa nombres de nivel de competencia', () => {
    const forbidden = /EXPERT|ADVANCED|MASTER|SENIOR/i;
    for (const s of PA1_SUBS) {
      expect(forbidden.test(s.code)).toBe(false);
    }
  });

  it('la suma de weights por skill nunca excede 1', () => {
    const sums = new Map<string, number>();
    for (const m of PA1_MAPPINGS) {
      const key = `${m.skillKey}|${m.skillType}`;
      sums.set(key, (sums.get(key) ?? 0) + m.weight);
    }
    for (const [key, sum] of sums) {
      expect(Math.round(sum * 1000) / 1000).toBeLessThanOrEqual(1);
      expect(sum).toBeGreaterThan(0);
      expect(key).toMatch(/\|/);
    }
  });

  it('no declara mappings duplicados ni weights fuera de rango', () => {
    const seen = new Set<string>();
    for (const m of PA1_MAPPINGS) {
      const key = `${m.skillKey}|${m.skillType}|${m.subCode}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(m.weight).toBeGreaterThan(0);
      expect(m.weight).toBeLessThanOrEqual(1);
    }
  });

  it('todos los mappings apuntan a subatributos existentes', () => {
    const subCodes = new Set(PA1_SUBS.map((s) => s.code));
    for (const m of PA1_MAPPINGS) {
      expect(subCodes.has(m.subCode)).toBe(true);
    }
    for (const u of PA1_INTENTIONAL_UNMAPPED) {
      for (const code of u.relatedSubCodes) {
        expect(subCodes.has(code)).toBe(true);
      }
    }
  });

  it('las skills sin mapping no aparecen también como mapeadas', () => {
    const mappedKeys = new Set(
      PA1_MAPPINGS.map((m) => `${m.skillKey}|${m.skillType}`),
    );
    for (const u of PA1_INTENTIONAL_UNMAPPED) {
      expect(mappedKeys.has(`${u.skillKey}|${u.skillType}`)).toBe(false);
      expect(u.reason.length).toBeGreaterThan(20);
    }
  });

  it('el hash de definición es estable y sensible al peso', () => {
    const definition = {
      catalogCode: 'professional-attributes',
      catalogVersion: 'pa1-2026-07-24',
      macros: PA1_MACROS.map((m) => ({
        code: m.code,
        name: m.name,
        sortOrder: m.sortOrder,
      })),
      subs: PA1_SUBS.map((s) => ({
        code: s.code,
        macroCode: s.macroCode,
        name: s.name,
        sortOrder: s.sortOrder,
        minimumSupportingSkills: s.minimumSupportingSkills ?? 3,
      })),
      mappings: PA1_MAPPINGS.map((m) => ({
        skillKey: m.skillKey,
        skillType: m.skillType,
        subCode: m.subCode,
        weight: m.weight,
        mappingType: m.mappingType,
      })),
    };
    const hash = computeCatalogDefinitionHash(definition);
    expect(hash).toBe(computeCatalogDefinitionHash(definition));
    expect(hash).toHaveLength(64);

    const tweaked = {
      ...definition,
      mappings: definition.mappings.map((m, i) =>
        i === 0 ? { ...m, weight: 0.99 } : m,
      ),
    };
    expect(computeCatalogDefinitionHash(tweaked)).not.toBe(hash);
  });
});

// ─── Explicaciones ────────────────────────────────────────────────────────────

describe('explicaciones', () => {
  const forbidden =
    /\bdomin(a|io|ando)\b|\bexpert[oa]\b|\bcompetent[ea]\b|nivel profesional|certificad[oa]/i;

  it('nunca afirman dominio ni nivel profesional', () => {
    const scenarios = [
      [skill('s1', 0, 'NONE')],
      [skill('s1', 3, 'WEAK')],
      [skill('s1', 30, 'MODERATE')],
      [skill('s1', 60, 'STRONG')],
      [skill('s1', 95, 'STRONG')],
    ];
    for (const skills of scenarios) {
      const result = runAttributeEngine(
        skills,
        catalogOf([macro('M')], [sub('A', 'M')], [mapping('s1', 'A', 1)]),
        config,
      );
      for (const s of result.subattributes) {
        expect(s.explanation).not.toMatch(forbidden);
        expect(s.explanation.length).toBeGreaterThan(20);
      }
      for (const m of result.macroattributes) {
        expect(m.explanation).not.toMatch(forbidden);
      }
    }
  });

  it('distingue subatributo sin mappings de subatributo sin evidencia', () => {
    const result = runAttributeEngine(
      [skill('s1', 0, 'NONE')],
      catalogOf([macro('M')], [sub('A', 'M'), sub('B', 'M')], [
        mapping('s1', 'A', 1),
      ]),
      config,
    );
    const withMapping = result.subattributes.find((s) => s.subattributeCode === 'A')!;
    const withoutMapping = result.subattributes.find(
      (s) => s.subattributeCode === 'B',
    )!;
    expect(withMapping.explanation).toContain('evidencia suficiente');
    expect(withoutMapping.explanation).toContain('catálogo');
    expect(withMapping.explanation).not.toBe(withoutMapping.explanation);
  });
});
