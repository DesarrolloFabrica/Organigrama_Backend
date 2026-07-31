import {
  resolveSafeAliasCanonicalName,
  toCanonicalKey,
} from './curated-profile.normalize';

describe('curated-profile.normalize', () => {
  it('toCanonicalKey alinea espacios y acentos', () => {
    expect(toCanonicalKey('  Java Script  ')).toBe('java_script');
    expect(toCanonicalKey('Diseño')).toBe('diseno');
  });

  it('resolveSafeAliasCanonicalName resuelve js → JavaScript', () => {
    expect(resolveSafeAliasCanonicalName('js')).toBe('JavaScript');
    expect(resolveSafeAliasCanonicalName('photoshop')).toBe('Adobe Photoshop');
    expect(resolveSafeAliasCanonicalName('unknown-xyz')).toBeNull();
  });
});
