import type { EvidenceLevel } from '../cv-evidence/cv-evidence.types';
import type { AttributeEngineConfig } from './cv-attributes.types';

export interface ContributionInput {
  evidenceStrength: number;
  evidenceLevel: EvidenceLevel;
  mappingWeight: number;
}

export interface ContributionOutput {
  levelFactor: number;
  rawContribution: number;
}

/**
 * Contribución base de una skill a un subatributo.
 *
 *   rawContribution = evidenceStrength × mappingWeight × levelFactor
 *
 * evidenceLevel NONE ⇒ levelFactor 0 ⇒ contribución 0, incluso si la skill
 * existe y tiene mapping. evidenceConfidence no participa aquí.
 */
export function computeRawContribution(
  input: ContributionInput,
  config: AttributeEngineConfig,
): ContributionOutput {
  const levelFactor = config.levelFactors[input.evidenceLevel] ?? 0;
  const strength = clampStrength(input.evidenceStrength);
  const weight = Number(input.mappingWeight);
  const raw = strength * weight * levelFactor;
  return {
    levelFactor,
    rawContribution: round4(Math.max(0, raw)),
  };
}

function clampStrength(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
