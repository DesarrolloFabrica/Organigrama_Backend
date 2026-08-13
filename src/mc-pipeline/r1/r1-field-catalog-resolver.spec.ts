import {
  LEGAL_SOURCE_KEY_ALIASES,
  resolveR1FieldCatalogCode,
} from './r1-field-catalog-resolver';
import { resolveToKnownFieldCode } from '../catalog/professional-fields';

describe('R1 field catalog resolver (LEGAL source keys)', () => {
  it('documents LEGAL sourceKey aliases for audit', () => {
    expect(LEGAL_SOURCE_KEY_ALIASES).toEqual({
      'field.legal_administrative': 'LEGAL',
      'field.legal_services': 'LEGAL',
    });
  });

  it('field.legal_administrative → LEGAL (Edwar 1126)', () => {
    expect(
      resolveR1FieldCatalogCode({
        fieldCode: null,
        sourceKey: 'field.legal_administrative',
      }),
    ).toBe('LEGAL');
    expect(
      resolveToKnownFieldCode(null, 'field.legal_administrative'),
    ).toBe('LEGAL');
  });

  it('field.legal_services → LEGAL (Johana 1130)', () => {
    expect(
      resolveR1FieldCatalogCode({
        fieldCode: null,
        sourceKey: 'field.legal_services',
      }),
    ).toBe('LEGAL');
    expect(resolveToKnownFieldCode(null, 'field.legal_services')).toBe('LEGAL');
  });

  it('preserves KNOWN fieldCode when already LEGAL', () => {
    expect(
      resolveR1FieldCatalogCode({
        fieldCode: 'LEGAL',
        sourceKey: 'LEGAL',
      }),
    ).toBe('LEGAL');
  });

  it('does not rewrite unrelated source keys', () => {
    expect(
      resolveR1FieldCatalogCode({
        fieldCode: null,
        sourceKey: 'field.unknown_proposed',
      }),
    ).toBeNull();
  });
});
