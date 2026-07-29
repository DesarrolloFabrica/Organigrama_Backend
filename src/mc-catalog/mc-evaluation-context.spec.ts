import {
  buildMcEvaluationContext,
  computeMcEvaluationContextHash,
} from './mc-evaluation-context';
import {
  assertMcPa2RuleFingerprint,
  computeMcPa2AlgorithmFingerprint,
  MC_PA2_ALGO_LEXICO_V1,
  MC_PA2_ALGO_WEIGHTED_V1,
  MC_PA2_PUBLISHED_RULE_FINGERPRINTS,
  resolveMcPa2AlgorithmVersion,
} from './mc-pa2.algorithm';
import {
  getMcPa2EngineConfigV100,
  getMcPa2EngineConfigV110,
  getMcPa2EngineConfigVisualDesignV100,
  getMcPa2EngineConfigVisualDesignV110,
  getMcPa2EngineConfigAudiovisualProductionV100,
  computeMcPa2ConfigHash,
} from './mc-pa2.config';
import { computeMcMappingPackHash } from './mc-catalog.mapping-hash';
import { resolveMcMappingPack } from './mc-catalog.mapping-registry';

describe('MC1.6.1B.2 evaluation context + fingerprints', () => {
  const base = {
    personId: '1163',
    domainCode: 'VISUAL_DESIGN',
    catalogVersion: 'mc1.6-2026-07-27',
    catalogVersionId: '2',
    sourceHash: '467d7dbea064e77535fe2c3742e58c6adfff499fc98745f3a68844d62f86f3a6',
    mappingPackCode: 'visual-design-mappings',
    mappingPackVersion: 'mc1.6-visual-nidia-2026-07-27',
    mappingHash: 'bc29810c191dac540ec5724a0fcf4fa7cd143a57112de8b01d2822cdeff0ed3a',
    engineRulesVersion: 'pa2-visual-design-1.0.0',
    algorithmVersion: MC_PA2_ALGO_LEXICO_V1,
    configHash: '1ed2a80a00ef3d85662ebc72b18431437c7220b766d5970fb2dbd7189a3fe7bb',
    extractionId: '207',
    enrichmentId: '5',
    evidenceEvaluationId: '5',
  };

  it('context hash es determinista e independiente del orden de construcción', () => {
    const a = computeMcEvaluationContextHash(base);
    const b = computeMcEvaluationContextHash({ ...base });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('timestamp no participa; mismo contexto → mismo hash', () => {
    const c1 = buildMcEvaluationContext(base);
    const c2 = buildMcEvaluationContext(base);
    expect(c1.evaluationContextHash).toBe(c2.evaluationContextHash);
  });

  it('cambio de peso/mapping hash altera context hash', () => {
    const a = computeMcEvaluationContextHash(base);
    const b = computeMcEvaluationContextHash({
      ...base,
      mappingHash: 'a'.repeat(64),
    });
    expect(a).not.toBe(b);
  });

  it('cambio de umbral (config hash) altera context hash', () => {
    const a = computeMcEvaluationContextHash(base);
    const b = computeMcEvaluationContextHash({
      ...base,
      configHash: 'b'.repeat(64),
    });
    expect(a).not.toBe(b);
  });

  it('cambio de algorithm version altera context hash', () => {
    const a = computeMcEvaluationContextHash(base);
    const b = computeMcEvaluationContextHash({
      ...base,
      algorithmVersion: MC_PA2_ALGO_WEIGHTED_V1,
    });
    expect(a).not.toBe(b);
  });

  it('source_hash se normaliza a lower-case', () => {
    const upper = buildMcEvaluationContext({
      ...base,
      sourceHash: base.sourceHash.toUpperCase(),
    });
    expect(upper.sourceHash).toBe(base.sourceHash.toLowerCase());
    expect(upper.evaluationContextHash).toBe(
      computeMcEvaluationContextHash(base),
    );
  });

  it('fingerprints publicados coinciden con configs actuales', () => {
    assertMcPa2RuleFingerprint(getMcPa2EngineConfigV100());
    assertMcPa2RuleFingerprint(getMcPa2EngineConfigV110());
    assertMcPa2RuleFingerprint(getMcPa2EngineConfigVisualDesignV100());
    assertMcPa2RuleFingerprint(getMcPa2EngineConfigVisualDesignV110());
    assertMcPa2RuleFingerprint(getMcPa2EngineConfigAudiovisualProductionV100());
    expect(MC_PA2_PUBLISHED_RULE_FINGERPRINTS).toHaveLength(5);
  });

  it('mutación silenciosa de config_hash falla el assert', () => {
    const cfg = {
      ...getMcPa2EngineConfigV110(),
      activeCoverageThreshold: 0.99,
    };
    expect(() => assertMcPa2RuleFingerprint(cfg)).toThrow(/Mutación silenciosa/);
  });

  it('algorithm version sigue rankingStrategy', () => {
    expect(
      resolveMcPa2AlgorithmVersion(
        getMcPa2EngineConfigV100().rankingStrategy,
      ),
    ).toBe(MC_PA2_ALGO_WEIGHTED_V1);
    expect(
      resolveMcPa2AlgorithmVersion(
        getMcPa2EngineConfigV110().rankingStrategy,
      ),
    ).toBe(MC_PA2_ALGO_LEXICO_V1);
  });

  it('algorithm fingerprint lexico es estable', () => {
    const a = computeMcPa2AlgorithmFingerprint(MC_PA2_ALGO_LEXICO_V1);
    const b = computeMcPa2AlgorithmFingerprint(MC_PA2_ALGO_LEXICO_V1);
    expect(a).toBe(b);
  });

  it('packs registrados conservan hash publicado (inmutabilidad semántica)', () => {
    const sw = resolveMcMappingPack('SOFTWARE');
    const vd = resolveMcMappingPack('VISUAL_DESIGN');
    const av = resolveMcMappingPack('AUDIOVISUAL_PRODUCTION');
    expect(computeMcMappingPackHash(sw.pack)).toBe(
      'c58af99297ec9915688e79afcbd4544cfe50395ba205f2bf3450173055549911',
    );
    expect(computeMcMappingPackHash(vd.pack)).toBe(
      '5d1d1f2070a87f9b5959f481cb0a53ec593f1b020373828e37f84e2dfcb7c50c',
    );
    expect(computeMcMappingPackHash(av.pack)).toBe(
      'f75ae6ee11f7924d0d35fa8ef0a82248d41732b946c3e349826443adc5e08870',
    );
    expect(sw.packCode).toBe('software-mappings');
    expect(vd.packCode).toBe('visual-design-mappings');
    expect(av.packCode).toBe('audiovisual-production-mappings');
  });

  it('config hashes de reglas publicadas no cambiaron', () => {
    expect(computeMcPa2ConfigHash(getMcPa2EngineConfigV100())).toBe(
      '0ee343d721fe609ef96575e1a6fc2923f8ddd8295e8d4b65bac889f1f1f6776c',
    );
    expect(computeMcPa2ConfigHash(getMcPa2EngineConfigV110())).toBe(
      'c61ad54a4a93247df8cbcbef92df15dfa1eede829490f4d600bec83c35edcdab',
    );
    expect(
      computeMcPa2ConfigHash(getMcPa2EngineConfigVisualDesignV100()),
    ).toBe(
      '1ed2a80a00ef3d85662ebc72b18431437c7220b766d5970fb2dbd7189a3fe7bb',
    );
    expect(
      computeMcPa2ConfigHash(getMcPa2EngineConfigVisualDesignV110()),
    ).toBe(
      'b3fe1faafbe22a9ee52d195c2d638a91b25a848e89cc67cd1ecebdee734846ff',
    );
    expect(
      computeMcPa2ConfigHash(getMcPa2EngineConfigAudiovisualProductionV100()),
    ).toBe(
      '4bf15ef3c5b97667b6c83aede977b4d007ae86de68b2462002cf4838429dc468',
    );
  });
});
