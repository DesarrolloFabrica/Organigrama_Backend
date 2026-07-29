/**
 * Registro de packs de mappings MC1 por dominio.
 * VISUAL_DESIGN: V1 histórico, V2 (1.1.0), V2.1 (1.2.0) default MC1.11.0.
 */

import {
  MC_SOFTWARE_EXPECTED_DISTRIBUTION,
  MC_SOFTWARE_MAPPING_PACK,
  MC_SOFTWARE_MAPPING_RULES_VERSION,
} from './mc-catalog.mapping-software-mc11';
import {
  MC_VISUAL_DESIGN_EXPECTED_DISTRIBUTION,
  MC_VISUAL_DESIGN_MAPPING_PACK,
  MC_VISUAL_DESIGN_MAPPING_RULES_VERSION,
} from './mc-catalog.mapping-visual-design-mc16';
import {
  MC_VISUAL_DESIGN_EXPECTED_DISTRIBUTION_V110,
  MC_VISUAL_DESIGN_MAPPING_PACK_V110,
  MC_VISUAL_DESIGN_MAPPING_RULES_VERSION_V110,
} from './mc-catalog.mapping-visual-design-v110';
import {
  MC_VISUAL_DESIGN_EXPECTED_DISTRIBUTION_V120,
  MC_VISUAL_DESIGN_MAPPING_PACK_V120,
  MC_VISUAL_DESIGN_MAPPING_RULES_VERSION_V120,
} from './mc-catalog.mapping-visual-design-v120';
import {
  MC_AUDIOVISUAL_EXPECTED_DISTRIBUTION_V100,
  MC_AUDIOVISUAL_MAPPING_PACK_V100,
  MC_AUDIOVISUAL_MAPPING_RULES_VERSION_V100,
} from './mc-catalog.mapping-audiovisual-v100';
import type { McDomainMappingPack } from './mc-catalog.types';
import type { McSkillClassificationStatus } from './mc-catalog.types';

export type McMappingPackRegistration = {
  /** Código estable del pack (persistido en evaluación). */
  packCode: string;
  pack: McDomainMappingPack;
  mappingRulesVersion: string;
  expectedDistribution: Record<McSkillClassificationStatus, number> & {
    total: number;
  };
};

export const MC_SOFTWARE_MAPPING_PACK_CODE = 'software-mappings';
export const MC_VISUAL_DESIGN_MAPPING_PACK_CODE = 'visual-design-mappings';
export const MC_AUDIOVISUAL_PRODUCTION_MAPPING_PACK_CODE =
  'audiovisual-production-mappings';

/** Default vigente por dominio (nuevas evaluaciones). */
const REGISTRY: Record<string, McMappingPackRegistration> = {
  SOFTWARE: {
    packCode: MC_SOFTWARE_MAPPING_PACK_CODE,
    pack: MC_SOFTWARE_MAPPING_PACK,
    mappingRulesVersion: MC_SOFTWARE_MAPPING_RULES_VERSION,
    expectedDistribution: MC_SOFTWARE_EXPECTED_DISTRIBUTION,
  },
  VISUAL_DESIGN: {
    packCode: MC_VISUAL_DESIGN_MAPPING_PACK_CODE,
    pack: MC_VISUAL_DESIGN_MAPPING_PACK_V120,
    mappingRulesVersion: MC_VISUAL_DESIGN_MAPPING_RULES_VERSION_V120,
    expectedDistribution: MC_VISUAL_DESIGN_EXPECTED_DISTRIBUTION_V120,
  },
  AUDIOVISUAL_PRODUCTION: {
    packCode: MC_AUDIOVISUAL_PRODUCTION_MAPPING_PACK_CODE,
    pack: MC_AUDIOVISUAL_MAPPING_PACK_V100,
    mappingRulesVersion: MC_AUDIOVISUAL_MAPPING_RULES_VERSION_V100,
    expectedDistribution: MC_AUDIOVISUAL_EXPECTED_DISTRIBUTION_V100,
  },
};

/** Releases históricos + vigentes (pack_code @ pack_version). */
const RELEASES: McMappingPackRegistration[] = [
  {
    packCode: MC_SOFTWARE_MAPPING_PACK_CODE,
    pack: MC_SOFTWARE_MAPPING_PACK,
    mappingRulesVersion: MC_SOFTWARE_MAPPING_RULES_VERSION,
    expectedDistribution: MC_SOFTWARE_EXPECTED_DISTRIBUTION,
  },
  {
    packCode: MC_VISUAL_DESIGN_MAPPING_PACK_CODE,
    pack: MC_VISUAL_DESIGN_MAPPING_PACK,
    mappingRulesVersion: MC_VISUAL_DESIGN_MAPPING_RULES_VERSION,
    expectedDistribution: MC_VISUAL_DESIGN_EXPECTED_DISTRIBUTION,
  },
  {
    packCode: MC_VISUAL_DESIGN_MAPPING_PACK_CODE,
    pack: MC_VISUAL_DESIGN_MAPPING_PACK_V110,
    mappingRulesVersion: MC_VISUAL_DESIGN_MAPPING_RULES_VERSION_V110,
    expectedDistribution: MC_VISUAL_DESIGN_EXPECTED_DISTRIBUTION_V110,
  },
  {
    packCode: MC_VISUAL_DESIGN_MAPPING_PACK_CODE,
    pack: MC_VISUAL_DESIGN_MAPPING_PACK_V120,
    mappingRulesVersion: MC_VISUAL_DESIGN_MAPPING_RULES_VERSION_V120,
    expectedDistribution: MC_VISUAL_DESIGN_EXPECTED_DISTRIBUTION_V120,
  },
  {
    packCode: MC_AUDIOVISUAL_PRODUCTION_MAPPING_PACK_CODE,
    pack: MC_AUDIOVISUAL_MAPPING_PACK_V100,
    mappingRulesVersion: MC_AUDIOVISUAL_MAPPING_RULES_VERSION_V100,
    expectedDistribution: MC_AUDIOVISUAL_EXPECTED_DISTRIBUTION_V100,
  },
];

export function listMcMappingDomainCodes(): string[] {
  return Object.keys(REGISTRY);
}

export function resolveMcMappingPack(
  domainCode: string,
): McMappingPackRegistration {
  const code = domainCode.trim().toUpperCase();
  const hit = REGISTRY[code];
  if (!hit) {
    throw new Error(
      `Sin mapping pack registrado para domain=${domainCode}. ` +
        `Disponibles: ${listMcMappingDomainCodes().join(', ')}`,
    );
  }
  return hit;
}

export function tryResolveMcMappingPack(
  domainCode: string,
): McMappingPackRegistration | null {
  const code = domainCode.trim().toUpperCase();
  return REGISTRY[code] ?? null;
}

/** Resuelve pack por (pack_code, pack_version) inequívoco. */
export function resolveMcMappingPackByRelease(
  packCode: string,
  packVersion: string,
): McMappingPackRegistration {
  const hit = RELEASES.find(
    (r) =>
      r.packCode === packCode && r.mappingRulesVersion === packVersion,
  );
  if (!hit) {
    throw new Error(
      `Pack release no registrado: ${packCode}@${packVersion}`,
    );
  }
  return hit;
}

export function listMcMappingPackReleases(): McMappingPackRegistration[] {
  return [...RELEASES];
}
