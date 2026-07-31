/**
 * Identificadores de algoritmo PA2 e inmutabilidad de fingerprints de reglas.
 *
 * Política de bump (ver docs/mc1-domain-versioning-policy.md):
 * - PATCH: sin cambio semántico → mismo algorithm_version + mismo rule label
 * - MINOR: cambia desempate/lexico/tools/clasificación → bump rule MINOR (+ algorithm si aplica)
 * - MAJOR: cambia fórmulas base / significado métricas → bump MAJOR + nuevo algorithm_version
 *
 * Los fingerprints de reglas PUBLICADAS son constantes congeladas (no se recalculan
 * desde el código mutable). Si el código diverge → assert falla → bump de versión.
 */

import { createHash } from 'node:crypto';
import {
  computeMcPa2ConfigHash,
  MC_PA2_RULES_VERSION_V100,
  MC_PA2_RULES_VERSION_V110,
  MC_PA2_RULES_VERSION_VISUAL_V100,
  MC_PA2_RULES_VERSION_VISUAL_V110,
  MC_PA2_RULES_VERSION_AUDIOVISUAL_V100,
  MC_PA2_RULES_VERSION_OPERATIONS_V100,
  MC_PA2_RULES_VERSION_TALENT_V100,
  MC_PA2_RULES_VERSION_EDUCATION_V100,
  MC_PA2_RULES_VERSION_MARKETING_V100,
  type McPa2EngineConfig,
  type McPa2RankingStrategy,
} from './mc-pa2.config';

/** Algoritmo weighted score (pa2-software-1.0.0). */
export const MC_PA2_ALGO_WEIGHTED_V1 = 'pa2-algo-weighted-v1';
/** Algoritmo lexicográfico funcional (1.1.0 software + visual 1.0.0). */
export const MC_PA2_ALGO_LEXICO_V1 = 'pa2-algo-lexico-v1';
/**
 * Lexico + anti-tool companion (visual 1.1.0).
 * Mismo orden de ranking que v1; cambia clasificación ACTIVE/EMERGENT/HIDDEN.
 */
export const MC_PA2_ALGO_LEXICO_V2 = 'pa2-algo-lexico-v2';
/** Algoritmo score normalizado (disponible, no usado en prod aún). */
export const MC_PA2_ALGO_NORMALIZED_V1 = 'pa2-algo-normalized-v1';

/**
 * Descriptor canónico del comparador lexico v1.
 * Cualquier cambio de orden/criterios exige nuevo algorithm_version.
 */
export const MC_PA2_LEXICO_V1_CRITERIA = [
  'evidencedSkillCount:desc',
  'coverage:desc',
  'strength:desc',
  'confidence:desc',
  'primaryStrongCount:desc',
  'mappedSkillCount:desc',
  'specialtyCode:asc',
] as const;

/** Lexico v2 = v1 + anti-tool professional companion gate. */
export const MC_PA2_LEXICO_V2_CRITERIA = [
  ...MC_PA2_LEXICO_V1_CRITERIA,
  'antiTool:requireProfessionalCompanionForVisible',
] as const;

export function resolveMcPa2AlgorithmVersion(
  strategyOrConfig: McPa2RankingStrategy | undefined | McPa2EngineConfig,
): string {
  if (
    strategyOrConfig &&
    typeof strategyOrConfig === 'object' &&
    'engineRulesVersion' in strategyOrConfig
  ) {
    const cfg = strategyOrConfig;
    if (
      (cfg.rankingStrategy ?? 'WEIGHTED_SCORE') === 'LEXICOGRAPHIC' &&
      cfg.requireProfessionalCompanionForVisible
    ) {
      return MC_PA2_ALGO_LEXICO_V2;
    }
    return resolveMcPa2AlgorithmVersion(cfg.rankingStrategy);
  }
  switch (strategyOrConfig ?? 'WEIGHTED_SCORE') {
    case 'LEXICOGRAPHIC':
      return MC_PA2_ALGO_LEXICO_V1;
    case 'NORMALIZED_SCORE':
      return MC_PA2_ALGO_NORMALIZED_V1;
    case 'WEIGHTED_SCORE':
    default:
      return MC_PA2_ALGO_WEIGHTED_V1;
  }
}

export function computeMcPa2AlgorithmFingerprint(
  algorithmVersion: string,
): string {
  const payload =
    algorithmVersion === MC_PA2_ALGO_LEXICO_V1
      ? {
          algorithmVersion,
          criteria: [...MC_PA2_LEXICO_V1_CRITERIA],
        }
      : algorithmVersion === MC_PA2_ALGO_LEXICO_V2
        ? {
            algorithmVersion,
            criteria: [...MC_PA2_LEXICO_V2_CRITERIA],
          }
        : { algorithmVersion };
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

export type McPa2RuleFingerprint = {
  engineRulesVersion: string;
  algorithmVersion: string;
  configHash: string;
  algorithmFingerprint: string;
};

/** Fingerprints congelados — preflight MC1.6.1B.2 / MC1.6.1C.2 (2026-07-27). */
export const MC_PA2_PUBLISHED_RULE_FINGERPRINTS: readonly McPa2RuleFingerprint[] =
  [
    {
      engineRulesVersion: MC_PA2_RULES_VERSION_V100,
      algorithmVersion: MC_PA2_ALGO_WEIGHTED_V1,
      configHash:
        '0ee343d721fe609ef96575e1a6fc2923f8ddd8295e8d4b65bac889f1f1f6776c',
      algorithmFingerprint: computeMcPa2AlgorithmFingerprint(
        MC_PA2_ALGO_WEIGHTED_V1,
      ),
    },
    {
      engineRulesVersion: MC_PA2_RULES_VERSION_V110,
      algorithmVersion: MC_PA2_ALGO_LEXICO_V1,
      configHash:
        'c61ad54a4a93247df8cbcbef92df15dfa1eede829490f4d600bec83c35edcdab',
      algorithmFingerprint: computeMcPa2AlgorithmFingerprint(
        MC_PA2_ALGO_LEXICO_V1,
      ),
    },
    {
      engineRulesVersion: MC_PA2_RULES_VERSION_VISUAL_V100,
      algorithmVersion: MC_PA2_ALGO_LEXICO_V1,
      configHash:
        '1ed2a80a00ef3d85662ebc72b18431437c7220b766d5970fb2dbd7189a3fe7bb',
      algorithmFingerprint: computeMcPa2AlgorithmFingerprint(
        MC_PA2_ALGO_LEXICO_V1,
      ),
    },
    {
      engineRulesVersion: MC_PA2_RULES_VERSION_VISUAL_V110,
      algorithmVersion: MC_PA2_ALGO_LEXICO_V2,
      // Se congela tras primer computeMcPa2ConfigHash(getMcPa2EngineConfigVisualDesignV110())
      configHash:
        'b3fe1faafbe22a9ee52d195c2d638a91b25a848e89cc67cd1ecebdee734846ff',
      algorithmFingerprint: computeMcPa2AlgorithmFingerprint(
        MC_PA2_ALGO_LEXICO_V2,
      ),
    },
    {
      engineRulesVersion: MC_PA2_RULES_VERSION_AUDIOVISUAL_V100,
      algorithmVersion: MC_PA2_ALGO_LEXICO_V2,
      configHash:
        '4bf15ef3c5b97667b6c83aede977b4d007ae86de68b2462002cf4838429dc468',
      algorithmFingerprint: computeMcPa2AlgorithmFingerprint(
        MC_PA2_ALGO_LEXICO_V2,
      ),
    },
    {
      engineRulesVersion: MC_PA2_RULES_VERSION_OPERATIONS_V100,
      algorithmVersion: MC_PA2_ALGO_LEXICO_V2,
      configHash:
        '0c95111413b0e193c3cd5cca16eb738ad839739c5513240f3f2adb5dcba951ea',
      algorithmFingerprint: computeMcPa2AlgorithmFingerprint(
        MC_PA2_ALGO_LEXICO_V2,
      ),
    },
    {
      engineRulesVersion: MC_PA2_RULES_VERSION_TALENT_V100,
      algorithmVersion: MC_PA2_ALGO_LEXICO_V2,
      configHash:
        'd8a7bf0aa9cefb200fa6f0b0db76528bfc7be4b4907de78283a395d7cea09c3a',
      algorithmFingerprint: computeMcPa2AlgorithmFingerprint(
        MC_PA2_ALGO_LEXICO_V2,
      ),
    },
    {
      engineRulesVersion: MC_PA2_RULES_VERSION_EDUCATION_V100,
      algorithmVersion: MC_PA2_ALGO_LEXICO_V2,
      configHash:
        '25a077b2131fbee3b01b9f04073e334ed2000d7ca038a3fa9a7494da4f51a9df',
      algorithmFingerprint: computeMcPa2AlgorithmFingerprint(
        MC_PA2_ALGO_LEXICO_V2,
      ),
    },
    {
      engineRulesVersion: MC_PA2_RULES_VERSION_MARKETING_V100,
      algorithmVersion: MC_PA2_ALGO_LEXICO_V2,
      configHash:
        '019fa077a1fe8ba3cc3be1b2d37ef05caf8a886f4ac61b7451d9f1dbce0fe838',
      algorithmFingerprint: computeMcPa2AlgorithmFingerprint(
        MC_PA2_ALGO_LEXICO_V2,
      ),
    },
  ];

export function assertMcPa2RuleFingerprint(config: McPa2EngineConfig): void {
  const expected = MC_PA2_PUBLISHED_RULE_FINGERPRINTS.find(
    (f) => f.engineRulesVersion === config.engineRulesVersion,
  );
  if (!expected) {
    throw new Error(
      `Regla PA2 ${config.engineRulesVersion} no está registrada como PUBLISHED. ` +
        `Añadir fingerprint tras bump de versión.`,
    );
  }
  const actualConfigHash = computeMcPa2ConfigHash(config);
  const actualAlgo = resolveMcPa2AlgorithmVersion(config);
  const actualAlgoFp = computeMcPa2AlgorithmFingerprint(actualAlgo);

  if (actualConfigHash !== expected.configHash) {
    throw new Error(
      `Mutación silenciosa detectada en ${config.engineRulesVersion}: ` +
        `config_hash esperado=${expected.configHash.slice(0, 12)}… ` +
        `actual=${actualConfigHash.slice(0, 12)}…. ` +
        `Crear nueva versión de regla (no editar in-place).`,
    );
  }
  if (actualAlgo !== expected.algorithmVersion) {
    throw new Error(
      `Algoritmo divergente para ${config.engineRulesVersion}: ` +
        `esperado=${expected.algorithmVersion} actual=${actualAlgo}`,
    );
  }
  if (actualAlgoFp !== expected.algorithmFingerprint) {
    throw new Error(
      `Fingerprint de algoritmo divergente para ${actualAlgo}. ` +
        `Bump algorithm_version (MINOR/MAJOR) y actualizar fingerprint.`,
    );
  }
}
