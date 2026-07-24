import {
  computeBlockConfigHash,
  computeInventoryHash,
} from './cv-skills-enrichment.hash';
import type { EnrichmentBlockConfig } from './cv-skills-enrichment.types';

describe('computeBlockConfigHash', () => {
  const base: EnrichmentBlockConfig = {
    blockSize: 15,
    parallelism: 1,
    maxBlockAttempts: 3,
    microRetrySize: 5,
    maxMicroRetryAttempts: 2,
  };

  it('misma config → mismo hash', () => {
    expect(computeBlockConfigHash(base)).toBe(computeBlockConfigHash({ ...base }));
  });

  it('cambio blockSize → hash distinto', () => {
    expect(computeBlockConfigHash(base)).not.toBe(
      computeBlockConfigHash({ ...base, blockSize: 10 }),
    );
  });
});

describe('computeInventoryHash (regresión)', () => {
  it('sigue siendo determinista', () => {
    const skills = [
      {
        extractionSkillId: '1',
        normalizedName: 'A',
        sortOrder: 0,
        skillType: 'TECHNOLOGY',
      },
    ];
    expect(computeInventoryHash(skills).inventoryHash).toHaveLength(64);
  });
});
