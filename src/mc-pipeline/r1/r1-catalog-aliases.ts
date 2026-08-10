/**
 * Alias → Campos Profesionales MC1.PROFESSIONAL_FIELD_CATALOG 2.0.0.
 * Especialidades reservadas se mapean al campo padre (no se conservan como campo).
 */
import {
  PROFESSIONAL_FIELD_CATALOG_VERSION,
  resolveToKnownFieldCode,
} from '../catalog/professional-fields';

export const R1_CATALOG_VERSION = PROFESSIONAL_FIELD_CATALOG_VERSION;

export function normalizeSourceKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

export function mapToFieldCode(args: {
  domainCode: string | null;
  proposedDomainKey: string | null;
}): { fieldCode: string | null; sourceKey: string; mapped: boolean } {
  const sourceKey =
    args.domainCode?.trim() ||
    args.proposedDomainKey?.trim() ||
    'unknown';
  const fieldCode = resolveToKnownFieldCode(
    args.domainCode,
    args.proposedDomainKey,
  );
  return {
    fieldCode,
    sourceKey,
    mapped: fieldCode != null,
  };
}
