/**
 * Resuelve fieldCode de catálogo desde artefactos R1 históricos sin reescribirlos.
 * Preserva sourceKey original en el contrato R1; esta capa solo aplica aliases vigentes.
 */
import { resolveToKnownFieldCode } from '../catalog/professional-fields';

export type R1FieldLike = {
  fieldCode: string | null;
  sourceKey: string;
};

/**
 * Mapeo auditado sourceKey P2 → campo LEGAL (catálogo 2.0.0).
 * Espejo de legacyAliasesToField en mc1-professional-fields-v2.json.
 *
 * Provenance (no reescribe P2/R1):
 * - field.legal_administrative → LEGAL (Edwar 1126 primary proposed)
 * - field.legal_services → LEGAL (Johana 1130 secondary proposed)
 */
export const LEGAL_SOURCE_KEY_ALIASES: Record<string, string> = {
  'field.legal_administrative': 'LEGAL',
  'field.legal_services': 'LEGAL',
};

/**
 * Resuelve el código de catálogo para un field R1.
 * Orden: fieldCode KNOWN → alias legacy catalog (incl. sourceKey P2).
 */
export function resolveR1FieldCatalogCode(
  field: R1FieldLike | null | undefined,
): string | null {
  if (!field) return null;
  return resolveToKnownFieldCode(field.fieldCode, field.sourceKey) ?? field.fieldCode;
}
