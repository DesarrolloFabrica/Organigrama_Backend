import { createHash } from 'node:crypto';
import type { McDomainMappingPack } from './mc-catalog.types';

export function computeMcMappingPackHash(pack: McDomainMappingPack): string {
  const payload = {
    domainCode: pack.domainCode,
    sourceRef: pack.sourceRef,
    classifications: [...pack.classifications]
      .map((c) => ({
        skillKey: c.skillKey,
        skillType: c.skillType,
        classification: c.classification,
      }))
      .sort(
        (a, b) =>
          a.skillKey.localeCompare(b.skillKey) ||
          a.skillType.localeCompare(b.skillType),
      ),
    mappings: [...pack.mappings]
      .map((m) => ({
        skillKey: m.skillKey,
        skillType: m.skillType,
        specialtyCode: m.specialtyCode,
        weight: m.weight,
        mappingType: m.mappingType,
      }))
      .sort(
        (a, b) =>
          a.skillKey.localeCompare(b.skillKey) ||
          a.skillType.localeCompare(b.skillType) ||
          a.specialtyCode.localeCompare(b.specialtyCode),
      ),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
