import type { EnrichmentInputSkill } from './cv-skills-enrichment.types';
import { sortSkillsForBlocks } from './cv-skills-enrichment.hash';

export class EnrichmentEmptyInventoryError extends Error {
  constructor(message = 'Inventario de skills vacío: no se puede enriquecer.') {
    super(message);
    this.name = 'EnrichmentEmptyInventoryError';
  }
}

/**
 * Particiona skills en bloques de tamaño fijo conservando orden determinista.
 */
export function partitionSkillsIntoBlocks(
  skills: EnrichmentInputSkill[],
  blockSize: number,
): EnrichmentInputSkill[][] {
  if (!Number.isInteger(blockSize) || blockSize < 1) {
    throw new Error(`blockSize inválido: ${blockSize}`);
  }
  if (skills.length === 0) {
    throw new EnrichmentEmptyInventoryError();
  }

  const ordered = sortSkillsForBlocks(skills);
  const blocks: EnrichmentInputSkill[][] = [];
  for (let i = 0; i < ordered.length; i += blockSize) {
    blocks.push(ordered.slice(i, i + blockSize));
  }
  return blocks;
}
