import { MC_SOFTWARE_SPECIALTY_CODES } from './mc-catalog.definition-mc12';
import {
  MC_SOFTWARE_EXPECTED_DISTRIBUTION,
  MC_SOFTWARE_MAPPING_PACK,
} from './mc-catalog.mapping-software-mc11';
import { computeMcMappingPackHash } from './mc-catalog.mapping-hash';
import {
  assertExpectedDistribution,
  McMappingValidationError,
  validateMappingPack,
} from './mc-catalog.mapping-validation';
import type { McDomainMappingPack } from './mc-catalog.types';

const activeCodes = new Set<string>(MC_SOFTWARE_SPECIALTY_CODES);

describe('pack SOFTWARE MC1.1', () => {
  it('reproduce distribución exacta 42/14/3/0/0', () => {
    const result = validateMappingPack(MC_SOFTWARE_MAPPING_PACK, activeCodes);
    expect(result.classificationCounts).toEqual({
      DOMAIN_SPECIALTY: 42,
      TRANSVERSAL_FUTURE: 14,
      OUTSIDE_SOFTWARE_DOMAIN: 0,
      AMBIGUOUS: 3,
      CATALOG_GAP: 0,
    });
    expect(
      result.classificationCounts.DOMAIN_SPECIALTY +
        result.classificationCounts.TRANSVERSAL_FUTURE +
        result.classificationCounts.AMBIGUOUS,
    ).toBe(59);
    assertExpectedDistribution(
      result.classificationCounts,
      MC_SOFTWARE_EXPECTED_DISTRIBUTION,
    );
  });

  it('hash de pack es estable', () => {
    expect(computeMcMappingPackHash(MC_SOFTWARE_MAPPING_PACK)).toBe(
      computeMcMappingPackHash(MC_SOFTWARE_MAPPING_PACK),
    );
  });

  it('acepta mapping simple React → FRONTEND', () => {
    const pack: McDomainMappingPack = {
      domainCode: 'SOFTWARE',
      sourceRef: 'test',
      classifications: [
        {
          skillKey: 'react',
          skillType: 'TECHNOLOGY',
          skillName: 'React',
          classification: 'DOMAIN_SPECIALTY',
          rationale: 't',
        },
      ],
      mappings: [
        {
          skillKey: 'react',
          skillType: 'TECHNOLOGY',
          skillName: 'React',
          specialtyCode: 'SOFTWARE_FRONTEND',
          weight: 1,
          mappingType: 'PRIMARY',
          rationale: 't',
        },
      ],
    };
    expect(() => validateMappingPack(pack, activeCodes)).not.toThrow();
  });

  it('acepta mapping dual TypeORM', () => {
    const pack: McDomainMappingPack = {
      domainCode: 'SOFTWARE',
      sourceRef: 'test',
      classifications: [
        {
          skillKey: 'typeorm',
          skillType: 'TOOL',
          skillName: 'TypeORM',
          classification: 'DOMAIN_SPECIALTY',
          rationale: 't',
        },
      ],
      mappings: [
        {
          skillKey: 'typeorm',
          skillType: 'TOOL',
          skillName: 'TypeORM',
          specialtyCode: 'SOFTWARE_DATA',
          weight: 0.65,
          mappingType: 'PRIMARY',
          rationale: 't',
        },
        {
          skillKey: 'typeorm',
          skillType: 'TOOL',
          skillName: 'TypeORM',
          specialtyCode: 'SOFTWARE_BACKEND',
          weight: 0.35,
          mappingType: 'SECONDARY',
          rationale: 't',
        },
      ],
    };
    expect(() => validateMappingPack(pack, activeCodes)).not.toThrow();
  });

  it('rechaza suma de pesos > 1', () => {
    const pack: McDomainMappingPack = structuredClone(MC_SOFTWARE_MAPPING_PACK);
    const js = pack.mappings.filter((m) => m.skillKey === 'javascript');
    js[0].weight = 0.9;
    js[1].weight = 0.3;
    expect(() => validateMappingPack(pack, activeCodes)).toThrow(
      /Suma de pesos/,
    );
  });

  it('rechaza mapping duplicado', () => {
    const pack: McDomainMappingPack = {
      domainCode: 'SOFTWARE',
      sourceRef: 'test',
      classifications: [
        {
          skillKey: 'react',
          skillType: 'TECHNOLOGY',
          skillName: 'React',
          classification: 'DOMAIN_SPECIALTY',
          rationale: 't',
        },
      ],
      mappings: [
        {
          skillKey: 'react',
          skillType: 'TECHNOLOGY',
          skillName: 'React',
          specialtyCode: 'SOFTWARE_FRONTEND',
          weight: 0.5,
          mappingType: 'PRIMARY',
          rationale: 't',
        },
        {
          skillKey: 'react',
          skillType: 'TECHNOLOGY',
          skillName: 'React',
          specialtyCode: 'SOFTWARE_FRONTEND',
          weight: 0.5,
          mappingType: 'SECONDARY',
          rationale: 't',
        },
      ],
    };
    expect(() => validateMappingPack(pack, activeCodes)).toThrow(/duplicado/);
  });

  it('rechaza especialidad inexistente', () => {
    const pack: McDomainMappingPack = {
      domainCode: 'SOFTWARE',
      sourceRef: 'test',
      classifications: [
        {
          skillKey: 'react',
          skillType: 'TECHNOLOGY',
          skillName: 'React',
          classification: 'DOMAIN_SPECIALTY',
          rationale: 't',
        },
      ],
      mappings: [
        {
          skillKey: 'react',
          skillType: 'TECHNOLOGY',
          skillName: 'React',
          specialtyCode: 'SOFTWARE_DOES_NOT_EXIST',
          weight: 1,
          mappingType: 'PRIMARY',
          rationale: 't',
        },
      ],
    };
    expect(() => validateMappingPack(pack, activeCodes)).toThrow(
      /Especialidad inexistente/,
    );
  });

  it('rechaza skill transversal intentando mapearse', () => {
    const pack: McDomainMappingPack = {
      domainCode: 'SOFTWARE',
      sourceRef: 'test',
      classifications: [
        {
          skillKey: 'liderazgo',
          skillType: 'SOFT_SKILL',
          skillName: 'Liderazgo',
          classification: 'TRANSVERSAL_FUTURE',
          rationale: 'MC2',
        },
      ],
      mappings: [
        {
          skillKey: 'liderazgo',
          skillType: 'SOFT_SKILL',
          skillName: 'Liderazgo',
          specialtyCode: 'SOFTWARE_ENGINEERING_QUALITY',
          weight: 1,
          mappingType: 'PRIMARY',
          rationale: 'bad',
        },
      ],
    };
    expect(() => validateMappingPack(pack, activeCodes)).toThrow(
      /no DOMAIN_SPECIALTY/,
    );
  });

  it('no mapea skills AMBIGUOUS', () => {
    const ambiguous = MC_SOFTWARE_MAPPING_PACK.classifications.filter(
      (c) => c.classification === 'AMBIGUOUS',
    );
    expect(ambiguous).toHaveLength(3);
    for (const a of ambiguous) {
      const mapped = MC_SOFTWARE_MAPPING_PACK.mappings.some(
        (m) =>
          m.skillKey === a.skillKey && m.skillType === a.skillType,
      );
      expect(mapped).toBe(false);
    }
  });

  it('assertExpectedDistribution detecta mismatch', () => {
    expect(() =>
      assertExpectedDistribution(
        {
          DOMAIN_SPECIALTY: 41,
          TRANSVERSAL_FUTURE: 14,
          OUTSIDE_SOFTWARE_DOMAIN: 0,
          AMBIGUOUS: 3,
          CATALOG_GAP: 0,
        },
        MC_SOFTWARE_EXPECTED_DISTRIBUTION,
      ),
    ).toThrow(McMappingValidationError);
  });
});
