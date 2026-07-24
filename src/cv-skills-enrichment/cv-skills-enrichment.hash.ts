import { createHash } from 'node:crypto';
import type {
  EnrichmentBlockConfig,
  EnrichmentInputSkill,
  InventoryHashResult,
} from './cv-skills-enrichment.types';

/**
 * Orden canónico del inventario para hash y partición.
 * sortOrder ASC → normalizedName ASC → extractionSkillId ASC
 */
export function compareEnrichmentInputSkills(
  a: EnrichmentInputSkill,
  b: EnrichmentInputSkill,
): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  const nameCmp = a.normalizedName.localeCompare(b.normalizedName, 'en');
  if (nameCmp !== 0) return nameCmp;
  return a.extractionSkillId.localeCompare(b.extractionSkillId, 'en');
}

export function sortEnrichmentInputSkills(
  skills: EnrichmentInputSkill[],
): EnrichmentInputSkill[] {
  return [...skills].sort(compareEnrichmentInputSkills);
}

/**
 * Orden operativo de bloques: sortOrder ASC, extractionSkillId ASC
 * (sin normalizedName, según spec de bloques E1).
 */
export function compareSkillsForBlocks(
  a: EnrichmentInputSkill,
  b: EnrichmentInputSkill,
): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.extractionSkillId.localeCompare(b.extractionSkillId, 'en');
}

export function sortSkillsForBlocks(
  skills: EnrichmentInputSkill[],
): EnrichmentInputSkill[] {
  return [...skills].sort(compareSkillsForBlocks);
}

function canonicalSkillLine(skill: EnrichmentInputSkill): string {
  const skillId = skill.skillId?.trim() ?? '';
  const skillType = skill.skillType?.trim() ?? '';
  return `${skill.extractionSkillId}|${skillId}|${skill.normalizedName}|${skillType}`;
}

/**
 * Calcula inventoryHash sha256 sobre payload canónico.
 * No incluye confidence, category, evidence, warnings ni timestamps.
 */
export function computeInventoryHash(
  skills: EnrichmentInputSkill[],
): InventoryHashResult {
  const ordered = sortEnrichmentInputSkills(skills);
  const canonicalPayload = ordered.map(canonicalSkillLine).join('\n');
  const inventoryHash = createHash('sha256')
    .update(canonicalPayload, 'utf8')
    .digest('hex');
  return {
    algorithm: 'sha256',
    canonicalPayload,
    inventoryHash,
  };
}

/**
 * Hash canónico de la config de bloques (orden estable de claves).
 * Usado en idempotencia SUCCEEDED junto a inventory/model/prompt/enricher.
 */
export function computeBlockConfigHash(
  config: EnrichmentBlockConfig,
): string {
  const canonical = {
    blockSize: config.blockSize,
    parallelism: config.parallelism,
    maxBlockAttempts: config.maxBlockAttempts,
    microRetrySize: config.microRetrySize,
    maxMicroRetryAttempts: config.maxMicroRetryAttempts,
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical), 'utf8')
    .digest('hex');
}

export function buildBlockConfigSnapshot(
  config: EnrichmentBlockConfig,
): Record<string, unknown> {
  return {
    blockSize: config.blockSize,
    parallelism: config.parallelism,
    maxBlockAttempts: config.maxBlockAttempts,
    microRetrySize: config.microRetrySize,
    maxMicroRetryAttempts: config.maxMicroRetryAttempts,
  };
}
