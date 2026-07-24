import {
  EnrichmentEmptyInventoryError,
  partitionSkillsIntoBlocks,
} from './cv-skills-enrichment.blocks';
import type { EnrichmentInputSkill } from './cv-skills-enrichment.types';

function makeSkills(n: number): EnrichmentInputSkill[] {
  return Array.from({ length: n }, (_, i) => ({
    extractionSkillId: `id-${String(i).padStart(3, '0')}`,
    normalizedName: `Skill${i}`,
    sortOrder: i,
  }));
}

describe('partitionSkillsIntoBlocks', () => {
  it('67 skills → 5 bloques 15/15/15/15/7', () => {
    const blocks = partitionSkillsIntoBlocks(makeSkills(67), 15);
    expect(blocks.map((b) => b.length)).toEqual([15, 15, 15, 15, 7]);
  });

  it('inventario menor que blockSize → 1 bloque', () => {
    const blocks = partitionSkillsIntoBlocks(makeSkills(3), 15);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toHaveLength(3);
  });

  it('múltiplo exacto de 15', () => {
    const blocks = partitionSkillsIntoBlocks(makeSkills(30), 15);
    expect(blocks.map((b) => b.length)).toEqual([15, 15]);
  });

  it('inventario vacío falla', () => {
    expect(() => partitionSkillsIntoBlocks([], 15)).toThrow(
      EnrichmentEmptyInventoryError,
    );
  });

  it('orden estable por sortOrder e id', () => {
    const skills: EnrichmentInputSkill[] = [
      { extractionSkillId: 'b', normalizedName: 'B', sortOrder: 1 },
      { extractionSkillId: 'a', normalizedName: 'A', sortOrder: 0 },
      { extractionSkillId: 'c', normalizedName: 'C', sortOrder: 0 },
    ];
    const blocks = partitionSkillsIntoBlocks(skills, 15);
    expect(blocks[0].map((s) => s.extractionSkillId)).toEqual(['a', 'c', 'b']);
  });
});
