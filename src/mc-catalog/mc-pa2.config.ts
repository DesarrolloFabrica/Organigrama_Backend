/**
 * Configuración versionable del motor PA2 (dominio SOFTWARE).
 *
 * - pa2-software-1.0.0 — score ponderado (histórico; primaryStrong puede dominar)
 * - pa2-software-1.1.0 — ranking lexicográfico funcional (primaryStrong solo desempate)
 *
 * getDefaultMcPa2EngineConfig() conserva 1.0.0 para no cambiar el default global.
 * Usar resolveMcPa2EngineConfig(version) para elegir versión explícita.
 */

import { createHash } from 'node:crypto';

export const MC_PA2_RULES_VERSION_V100 = 'pa2-software-1.0.0';
export const MC_PA2_RULES_VERSION_V110 = 'pa2-software-1.1.0';
export const MC_PA2_RULES_VERSION_VISUAL_V100 = 'pa2-visual-design-1.0.0';
export const MC_PA2_RULES_VERSION_VISUAL_V110 = 'pa2-visual-design-1.1.0';
export const MC_PA2_RULES_VERSION_AUDIOVISUAL_V100 =
  'pa2-audiovisual-production-1.0.0';
export const MC_PA2_RULES_VERSION_OPERATIONS_V100 =
  'pa2-operations-management-1.0.0';
export const MC_PA2_RULES_VERSION_TALENT_V100 =
  'pa2-talent-management-1.0.0';
export const MC_PA2_RULES_VERSION_EDUCATION_V100 =
  'pa2-education-management-1.0.0';
export const MC_PA2_RULES_VERSION_MARKETING_V100 =
  'pa2-marketing-management-1.0.0';

/** Default global histórico — no subir silenciosamente a 1.1.0. */
export const MC_PA2_ENGINE_RULES_VERSION = MC_PA2_RULES_VERSION_V100;

export type McPa2RankingStrategy =
  | 'WEIGHTED_SCORE'
  | 'LEXICOGRAPHIC'
  | 'NORMALIZED_SCORE';

/**
 * Override genérico: evidencia fuerte + baja cardinalidad → ACTIVE con caution.
 * No hardcodea specialtyCode; aplica a cualquier especialidad.
 */
export interface McPa2StrongEvidenceOverrideConfig {
  enabled: boolean;
  /** Máximo de skills mapeadas para calificar. */
  maxMappedSkills: number;
  /** Máximo de skills con evidencia para calificar. */
  maxEvidencedSkills: number;
  /** Strength agregado mínimo (escala Evidence Engine 0–100). */
  minAggregatedStrength: number;
  /** Requiere al menos una skill PRIMARY con evidenceLevel STRONG. */
  requirePrimaryStrong: boolean;
}

export interface McPa2RankingWeights {
  coverageWeight: number;
  strengthWeight: number;
  confidenceWeight: number;
  evidencedCountWeight: number;
  mappedCountWeight: number;
  primaryStrongCountWeight: number;
}

/** Pesos del score normalizado (escala 0–1 por componente). */
export interface McPa2NormalizedRankingWeights {
  coverageWeight: number;
  strengthNormalizedWeight: number;
  confidenceWeight: number;
  evidenceMassWeight: number;
  primaryContributionWeight: number;
}

export interface McPa2EngineConfig {
  engineRulesVersion: string;
  /**
   * Estrategia de ranking. Ausente ⇒ WEIGHTED_SCORE (compat 1.0.0 / hash histórico).
   */
  rankingStrategy?: McPa2RankingStrategy;
  /** Coverage mínimo para ACTIVE (sin override). */
  activeCoverageThreshold: number;
  /**
   * Strength agregado mínimo para ACTIVE (opcional).
   * Ausente ⇒ sin umbral de strength (compat Software 1.0/1.1).
   */
  minimumActiveStrength?: number;
  /**
   * Si true, ACTIVE/EMERGENT requieren ≥1 skill profesional evidenciada
   * (no TOOL / no SOFT_SKILL). Visual Design 1.1.0+.
   */
  requireProfessionalCompanionForVisible?: boolean;
  /** Tipos de skill que cuentan como acompañamiento profesional. */
  professionalCompanionSkillTypes?: readonly string[];
  /** Masa mínima de skills mapeadas para ACTIVE (sin override). */
  minimumMappedSkills: number;
  /** Masa mínima con evidencia para ACTIVE (sin override). */
  minimumEvidencedSkills: number;
  /**
   * Si la mayor contribución ponderada a strength entre skills evidenciadas
   * supera este umbral (0–1), la señal se considera concentrada → EMERGENT
   * salvo override.
   */
  singleSkillDominanceThreshold: number;
  strongEvidenceLowCardinalityOverride: McPa2StrongEvidenceOverrideConfig;
  /**
   * Pesos del score WEIGHTED_SCORE (1.0.0).
   * En LEXICOGRAPHIC se conservan solo para métrica auxiliar / compat.
   */
  ranking: McPa2RankingWeights;
  /** Pesos NORMALIZED_SCORE (alternativa; usada si strategy = NORMALIZED_SCORE). */
  normalizedRanking?: McPa2NormalizedRankingWeights;
  /** Notas funcionales de la versión (auditoría). */
  releaseNotes?: string;
}

const NORMALIZED_WEIGHTS: McPa2NormalizedRankingWeights = {
  coverageWeight: 30,
  strengthNormalizedWeight: 30,
  confidenceWeight: 20,
  evidenceMassWeight: 15,
  primaryContributionWeight: 5,
};

/**
 * pa2-software-1.0.0 — score ponderado multi-escala.
 * Forma del objeto idéntica a MC1.3.3 para conservar config_hash histórico.
 */
export function getMcPa2EngineConfigV100(): McPa2EngineConfig {
  return {
    engineRulesVersion: MC_PA2_RULES_VERSION_V100,
    activeCoverageThreshold: 0.55,
    minimumMappedSkills: 3,
    minimumEvidencedSkills: 2,
    singleSkillDominanceThreshold: 0.85,
    strongEvidenceLowCardinalityOverride: {
      enabled: true,
      maxMappedSkills: 3,
      maxEvidencedSkills: 2,
      minAggregatedStrength: 80,
      requirePrimaryStrong: true,
    },
    ranking: {
      coverageWeight: 40,
      strengthWeight: 0.25,
      confidenceWeight: 15,
      evidencedCountWeight: 2,
      mappedCountWeight: 1,
      primaryStrongCountWeight: 12,
    },
  };
}

/**
 * pa2-software-1.1.0 — orden lexicográfico funcional.
 *
 * ACTIVE ordena por:
 * evidencedSkillCount ↓, coverage ↓, strength ↓, confidence ↓,
 * primaryStrongCount ↓, mappedSkillCount ↓, specialtyCode ↑
 *
 * primaryStrong solo desempata tras cobertura, masa, intensidad y confianza.
 * Umbrales ACTIVE/EMERGENT/HIDDEN idénticos a 1.0.0.
 */
export function getMcPa2EngineConfigV110(): McPa2EngineConfig {
  return {
    engineRulesVersion: MC_PA2_RULES_VERSION_V110,
    rankingStrategy: 'LEXICOGRAPHIC',
    activeCoverageThreshold: 0.55,
    minimumMappedSkills: 3,
    minimumEvidencedSkills: 2,
    singleSkillDominanceThreshold: 0.85,
    strongEvidenceLowCardinalityOverride: {
      enabled: true,
      maxMappedSkills: 3,
      maxEvidencedSkills: 2,
      minAggregatedStrength: 80,
      requirePrimaryStrong: true,
    },
    ranking: {
      coverageWeight: 40,
      strengthWeight: 0.25,
      confidenceWeight: 15,
      evidencedCountWeight: 2,
      mappedCountWeight: 1,
      primaryStrongCountWeight: 12,
    },
    normalizedRanking: { ...NORMALIZED_WEIGHTS },
    releaseNotes:
      'MC1.5.2A: ranking lexicográfico. Misma presentación ACTIVE/EMERGENT/HIDDEN. ' +
      'Default = mejor ACTIVE por masa → coverage → strength → confidence → primaryStrong → mapped → code.',
  };
}

/**
 * pa2-visual-design-1.0.0 — LEXICOGRAPHIC calibrado a catálogo visual V1
 * (menor cardinalidad; herramientas no deben dominar).
 *
 * ACTIVE: coverage ≥ 0.45, mapped ≥ 2, evidenced ≥ 2, sin dominancia > 0.90.
 * Override baja cardinalidad: solo con strength ≥ 70 y primaryStrong ≥ 1.
 */
export function getMcPa2EngineConfigVisualDesignV100(): McPa2EngineConfig {
  return {
    engineRulesVersion: MC_PA2_RULES_VERSION_VISUAL_V100,
    rankingStrategy: 'LEXICOGRAPHIC',
    activeCoverageThreshold: 0.45,
    minimumActiveStrength: 20,
    minimumMappedSkills: 2,
    minimumEvidencedSkills: 2,
    singleSkillDominanceThreshold: 0.9,
    strongEvidenceLowCardinalityOverride: {
      enabled: true,
      maxMappedSkills: 3,
      maxEvidencedSkills: 2,
      minAggregatedStrength: 70,
      requirePrimaryStrong: true,
    },
    ranking: {
      coverageWeight: 40,
      strengthWeight: 0.25,
      confidenceWeight: 15,
      evidencedCountWeight: 2,
      mappedCountWeight: 1,
      primaryStrongCountWeight: 12,
    },
    normalizedRanking: { ...NORMALIZED_WEIGHTS },
    releaseNotes:
      'MC1.6.1B: PA2 Diseño Visual. LEXICOGRAPHIC; umbrales menores que Software; ' +
      'minimumActiveStrength=20 evita ACTIVE por solo WEAK/tools; ' +
      'herramientas con peso bajo en mappings; rol organizacional no entra al score.',
  };
}

/**
 * pa2-visual-design-1.1.0 — LEXICOGRAPHIC + anti-tool companion.
 * Mismos umbrales numéricos que 1.0.0; exige evidencia profesional para
 * ACTIVE/EMERGENT (tools solas → HIDDEN).
 */
export function getMcPa2EngineConfigVisualDesignV110(): McPa2EngineConfig {
  return {
    engineRulesVersion: MC_PA2_RULES_VERSION_VISUAL_V110,
    rankingStrategy: 'LEXICOGRAPHIC',
    activeCoverageThreshold: 0.45,
    minimumActiveStrength: 20,
    minimumMappedSkills: 2,
    minimumEvidencedSkills: 2,
    singleSkillDominanceThreshold: 0.9,
    requireProfessionalCompanionForVisible: true,
    professionalCompanionSkillTypes: [
      'PROFESSIONAL_KNOWLEDGE',
      'METHODOLOGY',
    ],
    strongEvidenceLowCardinalityOverride: {
      enabled: true,
      maxMappedSkills: 3,
      maxEvidencedSkills: 2,
      minAggregatedStrength: 70,
      requirePrimaryStrong: true,
    },
    ranking: {
      coverageWeight: 40,
      strengthWeight: 0.25,
      confidenceWeight: 15,
      evidencedCountWeight: 2,
      mappedCountWeight: 1,
      primaryStrongCountWeight: 12,
    },
    normalizedRanking: { ...NORMALIZED_WEIGHTS },
    releaseNotes:
      'MC1.6.1C.2: Visual Design V2. Anti-tool companion: ACTIVE/EMERGENT ' +
      'requieren ≥1 skill profesional/metodológica evidenciada. ' +
      'minimumActiveStrength=20 intacto. Mappings en pack 1.1.0.',
  };
}

/**
 * pa2-audiovisual-production-1.0.0 — LEXICOGRAPHIC + anti-tool companion.
 * Calibrado como Visual 1.1.0; dominio independiente versionado.
 */
export function getMcPa2EngineConfigAudiovisualProductionV100(): McPa2EngineConfig {
  return {
    engineRulesVersion: MC_PA2_RULES_VERSION_AUDIOVISUAL_V100,
    rankingStrategy: 'LEXICOGRAPHIC',
    activeCoverageThreshold: 0.45,
    minimumActiveStrength: 20,
    minimumMappedSkills: 2,
    minimumEvidencedSkills: 2,
    singleSkillDominanceThreshold: 0.9,
    requireProfessionalCompanionForVisible: true,
    professionalCompanionSkillTypes: [
      'PROFESSIONAL_KNOWLEDGE',
      'METHODOLOGY',
    ],
    strongEvidenceLowCardinalityOverride: {
      enabled: true,
      maxMappedSkills: 3,
      maxEvidencedSkills: 2,
      minAggregatedStrength: 70,
      requirePrimaryStrong: true,
    },
    ranking: {
      coverageWeight: 40,
      strengthWeight: 0.25,
      confidenceWeight: 15,
      evidencedCountWeight: 2,
      mappedCountWeight: 1,
      primaryStrongCountWeight: 12,
    },
    normalizedRanking: { ...NORMALIZED_WEIGHTS },
    releaseNotes:
      'MC1.8.1: PA2 Producción Audiovisual prototipo. LEXICOGRAPHIC + anti-tool; ' +
      'umbrales alineados a Visual 1.1.0; pack audiovisual-production-mappings@1.0.0.',
  };
}

/**
 * pa2-operations-management-1.0.0 — LEXICOGRAPHIC + anti-tool companion.
 * Golden profile: un eje scaffold OPS_GENERAL (sin taxonomía definitiva).
 */
export function getMcPa2EngineConfigOperationsManagementV100(): McPa2EngineConfig {
  return {
    engineRulesVersion: MC_PA2_RULES_VERSION_OPERATIONS_V100,
    rankingStrategy: 'LEXICOGRAPHIC',
    activeCoverageThreshold: 0.4,
    minimumActiveStrength: 15,
    minimumMappedSkills: 3,
    minimumEvidencedSkills: 3,
    singleSkillDominanceThreshold: 0.95,
    requireProfessionalCompanionForVisible: true,
    professionalCompanionSkillTypes: [
      'PROFESSIONAL_KNOWLEDGE',
      'METHODOLOGY',
    ],
    strongEvidenceLowCardinalityOverride: {
      enabled: true,
      maxMappedSkills: 4,
      maxEvidencedSkills: 3,
      minAggregatedStrength: 60,
      requirePrimaryStrong: true,
    },
    ranking: {
      coverageWeight: 40,
      strengthWeight: 0.25,
      confidenceWeight: 15,
      evidencedCountWeight: 2,
      mappedCountWeight: 1,
      primaryStrongCountWeight: 12,
    },
    normalizedRanking: { ...NORMALIZED_WEIGHTS },
    releaseNotes:
      'MC1.9 golden: PA2 Gestión de Operaciones. LEXICOGRAPHIC + anti-tool; ' +
      'scaffold OPS_GENERAL; pack operations-management-mappings@1.0.0.',
  };
}

/**
 * pa2-talent-management-1.0.0 — LEXICOGRAPHIC + anti-tool companion.
 * Cinco especialidades TM_* (curación ChatGPT; sin scaffolds).
 */
export function getMcPa2EngineConfigTalentManagementV100(): McPa2EngineConfig {
  return {
    engineRulesVersion: MC_PA2_RULES_VERSION_TALENT_V100,
    rankingStrategy: 'LEXICOGRAPHIC',
    activeCoverageThreshold: 0.4,
    minimumActiveStrength: 15,
    minimumMappedSkills: 3,
    minimumEvidencedSkills: 3,
    singleSkillDominanceThreshold: 0.95,
    requireProfessionalCompanionForVisible: true,
    professionalCompanionSkillTypes: [
      'PROFESSIONAL_KNOWLEDGE',
      'METHODOLOGY',
    ],
    strongEvidenceLowCardinalityOverride: {
      enabled: true,
      maxMappedSkills: 4,
      maxEvidencedSkills: 3,
      minAggregatedStrength: 60,
      requirePrimaryStrong: true,
    },
    ranking: {
      coverageWeight: 40,
      strengthWeight: 0.25,
      confidenceWeight: 15,
      evidencedCountWeight: 2,
      mappedCountWeight: 1,
      primaryStrongCountWeight: 12,
    },
    normalizedRanking: { ...NORMALIZED_WEIGHTS },
    releaseNotes:
      'MC1.10: PA2 Gestión del Talento. LEXICOGRAPHIC + anti-tool; ' +
      '5 especialidades TM_*; pack talent-management-mappings@1.0.0.',
  };
}

/**
 * pa2-education-management-1.0.0 — LEXICOGRAPHIC + anti-tool companion.
 * Cinco especialidades EM_* (curación ChatGPT; sin scaffolds).
 * No altera umbrales globales de otros dominios.
 */
export function getMcPa2EngineConfigEducationManagementV100(): McPa2EngineConfig {
  return {
    engineRulesVersion: MC_PA2_RULES_VERSION_EDUCATION_V100,
    rankingStrategy: 'LEXICOGRAPHIC',
    activeCoverageThreshold: 0.4,
    minimumActiveStrength: 15,
    minimumMappedSkills: 3,
    minimumEvidencedSkills: 3,
    singleSkillDominanceThreshold: 0.95,
    requireProfessionalCompanionForVisible: true,
    professionalCompanionSkillTypes: [
      'PROFESSIONAL_KNOWLEDGE',
      'METHODOLOGY',
    ],
    strongEvidenceLowCardinalityOverride: {
      enabled: true,
      maxMappedSkills: 4,
      maxEvidencedSkills: 3,
      minAggregatedStrength: 60,
      requirePrimaryStrong: true,
    },
    ranking: {
      coverageWeight: 40,
      strengthWeight: 0.25,
      confidenceWeight: 15,
      evidencedCountWeight: 2,
      mappedCountWeight: 1,
      primaryStrongCountWeight: 12,
    },
    normalizedRanking: { ...NORMALIZED_WEIGHTS },
    releaseNotes:
      'MC1.11: PA2 Gestión Educativa. LEXICOGRAPHIC + anti-tool; ' +
      '5 especialidades EM_*; pack education-management-mappings@1.0.0.',
  };
}

/**
 * pa2-marketing-management-1.0.0 — LEXICOGRAPHIC + anti-tool companion.
 * Cinco especialidades MM_* (curación ChatGPT; sin scaffolds).
 * No altera umbrales globales de otros dominios.
 */
export function getMcPa2EngineConfigMarketingManagementV100(): McPa2EngineConfig {
  return {
    engineRulesVersion: MC_PA2_RULES_VERSION_MARKETING_V100,
    rankingStrategy: 'LEXICOGRAPHIC',
    activeCoverageThreshold: 0.4,
    minimumActiveStrength: 15,
    minimumMappedSkills: 3,
    minimumEvidencedSkills: 3,
    singleSkillDominanceThreshold: 0.95,
    requireProfessionalCompanionForVisible: true,
    professionalCompanionSkillTypes: [
      'PROFESSIONAL_KNOWLEDGE',
      'METHODOLOGY',
    ],
    strongEvidenceLowCardinalityOverride: {
      enabled: true,
      maxMappedSkills: 4,
      maxEvidencedSkills: 3,
      minAggregatedStrength: 60,
      requirePrimaryStrong: true,
    },
    ranking: {
      coverageWeight: 40,
      strengthWeight: 0.25,
      confidenceWeight: 15,
      evidencedCountWeight: 2,
      mappedCountWeight: 1,
      primaryStrongCountWeight: 12,
    },
    normalizedRanking: { ...NORMALIZED_WEIGHTS },
    releaseNotes:
      'MC1.12: PA2 Marketing Estratégico. LEXICOGRAPHIC + anti-tool; ' +
      '5 especialidades MM_*; pack marketing-management-mappings@1.0.0.',
  };
}

/** Default global = 1.0.0 (no subir silenciosamente). */
export function getDefaultMcPa2EngineConfig(): McPa2EngineConfig {
  return getMcPa2EngineConfigV100();
}

export function resolveMcPa2EngineConfig(
  rulesVersion?: string | null,
): McPa2EngineConfig {
  const version = (rulesVersion ?? MC_PA2_RULES_VERSION_V100).trim();
  switch (version) {
    case MC_PA2_RULES_VERSION_V100:
      return getMcPa2EngineConfigV100();
    case MC_PA2_RULES_VERSION_V110:
      return getMcPa2EngineConfigV110();
    case MC_PA2_RULES_VERSION_VISUAL_V100:
      return getMcPa2EngineConfigVisualDesignV100();
    case MC_PA2_RULES_VERSION_VISUAL_V110:
      return getMcPa2EngineConfigVisualDesignV110();
    case MC_PA2_RULES_VERSION_AUDIOVISUAL_V100:
      return getMcPa2EngineConfigAudiovisualProductionV100();
    case MC_PA2_RULES_VERSION_OPERATIONS_V100:
      return getMcPa2EngineConfigOperationsManagementV100();
    case MC_PA2_RULES_VERSION_TALENT_V100:
      return getMcPa2EngineConfigTalentManagementV100();
    case MC_PA2_RULES_VERSION_EDUCATION_V100:
      return getMcPa2EngineConfigEducationManagementV100();
    case MC_PA2_RULES_VERSION_MARKETING_V100:
      return getMcPa2EngineConfigMarketingManagementV100();
    default:
      throw new Error(
        `Versión de reglas PA2 desconocida: ${version}. ` +
          `Soportadas: ${listMcPa2RulesVersions().join(', ')}`,
      );
  }
}

export function listMcPa2RulesVersions(): string[] {
  return [
    MC_PA2_RULES_VERSION_V100,
    MC_PA2_RULES_VERSION_V110,
    MC_PA2_RULES_VERSION_VISUAL_V100,
    MC_PA2_RULES_VERSION_VISUAL_V110,
    MC_PA2_RULES_VERSION_AUDIOVISUAL_V100,
    MC_PA2_RULES_VERSION_OPERATIONS_V100,
    MC_PA2_RULES_VERSION_TALENT_V100,
    MC_PA2_RULES_VERSION_EDUCATION_V100,
    MC_PA2_RULES_VERSION_MARKETING_V100,
  ];
}

export function computeMcPa2ConfigHash(config: McPa2EngineConfig): string {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex');
}
