import { createHash } from 'node:crypto';
import type {
  AttributeCatalog,
  AttributeEngineConfig,
} from './cv-attributes.types';

/** Hash canónico de la config del Attribute Engine (orden estable de claves). */
export function computeAttributeConfigHash(
  config: AttributeEngineConfig,
): string {
  const canonical = {
    configVersion: config.configVersion,
    algorithmVersion: config.algorithmVersion,
    levelFactors: sortRecord(config.levelFactors),
    diminishingFactors: [...config.diminishingFactors],
    maxSubattributeScore: config.maxSubattributeScore,
    defaultTargetSupportingSkills: config.defaultTargetSupportingSkills,
    thresholds: {
      limitedMin: config.thresholds.limitedMin,
      developingMin: config.thresholds.developingMin,
      establishedMin: config.thresholds.establishedMin,
      wellSupportedMin: config.thresholds.wellSupportedMin,
    },
    confidence: {
      multiSkillBonusTwo: config.confidence.multiSkillBonusTwo,
      multiSkillBonusThreePlus: config.confidence.multiSkillBonusThreePlus,
      concentrationThreshold: config.confidence.concentrationThreshold,
      concentrationPenalty: config.confidence.concentrationPenalty,
      noDirectMappingPenalty: config.confidence.noDirectMappingPenalty,
      contextualOnlyPenalty: config.confidence.contextualOnlyPenalty,
      lowConfidenceThreshold: config.confidence.lowConfidenceThreshold,
    },
    macro: {
      supportedOnlyAverage: config.macro.supportedOnlyAverage,
      singleSubattributePenalty: config.macro.singleSubattributePenalty,
      lowCoverageThreshold: config.macro.lowCoverageThreshold,
      lowCoveragePenalty: config.macro.lowCoveragePenalty,
      concentrationThreshold: config.macro.concentrationThreshold,
    },
    coverage: {
      lowCoverageMax: config.coverage.lowCoverageMax,
      highCoverageMin: config.coverage.highCoverageMin,
    },
  };
  return sha256(JSON.stringify(canonical));
}

/**
 * Hash canónico del catálogo + mappings activos.
 * Cambia si se agrega, retira o repesa cualquier mapping, o si cambia la
 * estructura de macro/subatributos activos.
 */
export function computeMappingHash(catalog: AttributeCatalog): string {
  const macros = catalog.macroattributes
    .filter((m) => m.isActive)
    .map((m) => ({
      code: m.code,
      sortOrder: m.sortOrder,
      subattributeWeights: m.subattributeWeights
        ? sortRecord(m.subattributeWeights)
        : null,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const subByIdCode = new Map(
    catalog.subattributes.map((s) => [s.id, s.code] as const),
  );
  const macroByIdCode = new Map(
    catalog.macroattributes.map((m) => [m.id, m.code] as const),
  );

  const subs = catalog.subattributes
    .filter((s) => s.isActive)
    .map((s) => ({
      code: s.code,
      macroCode: macroByIdCode.get(s.macroattributeId) ?? '',
      sortOrder: s.sortOrder,
      minimumSupportingSkills: s.minimumSupportingSkills,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const mappings = catalog.mappings
    .filter((m) => m.isActive)
    .map((m) => ({
      skillId: String(m.skillId),
      subCode: subByIdCode.get(m.subattributeId) ?? '',
      weight: Number(m.weight),
      mappingType: m.mappingType,
    }))
    .sort(
      (a, b) =>
        a.skillId.localeCompare(b.skillId, undefined, { numeric: true }) ||
        a.subCode.localeCompare(b.subCode),
    );

  return sha256(
    JSON.stringify({
      catalogCode: catalog.catalogCode,
      catalogVersion: catalog.catalogVersion,
      macros,
      subs,
      mappings,
    }),
  );
}

/**
 * Hash de la definición declarativa del catálogo (códigos y claves de skill, sin
 * ids de base de datos). Se guarda en cv_attribute_catalog_version.config_hash
 * para detectar si el seed de una versión ya publicada fue alterado.
 */
export function computeCatalogDefinitionHash(definition: {
  catalogCode: string;
  catalogVersion: string;
  macros: Array<{ code: string; name: string; sortOrder: number }>;
  subs: Array<{
    code: string;
    macroCode: string;
    name: string;
    sortOrder: number;
    minimumSupportingSkills: number;
  }>;
  mappings: Array<{
    skillKey: string;
    skillType: string;
    subCode: string;
    weight: number;
    mappingType: string;
  }>;
}): string {
  const canonical = {
    catalogCode: definition.catalogCode,
    catalogVersion: definition.catalogVersion,
    macros: [...definition.macros]
      .map((m) => ({ code: m.code, name: m.name, sortOrder: m.sortOrder }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    subs: [...definition.subs]
      .map((s) => ({
        code: s.code,
        macroCode: s.macroCode,
        name: s.name,
        sortOrder: s.sortOrder,
        minimumSupportingSkills: s.minimumSupportingSkills,
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    mappings: [...definition.mappings]
      .map((m) => ({
        skillKey: m.skillKey,
        skillType: m.skillType,
        subCode: m.subCode,
        weight: m.weight,
        mappingType: m.mappingType,
      }))
      .sort(
        (a, b) =>
          a.skillKey.localeCompare(b.skillKey) ||
          a.skillType.localeCompare(b.skillType) ||
          a.subCode.localeCompare(b.subCode),
      ),
  };
  return sha256(JSON.stringify(canonical));
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function sortRecord<T>(rec: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(rec).sort()) {
    out[key] = rec[key];
  }
  return out;
}
