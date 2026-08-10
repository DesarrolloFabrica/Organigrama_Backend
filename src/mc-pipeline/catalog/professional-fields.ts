/**
 * Catálogo congelado de Campos Profesionales (MC1.PROFESSIONAL_FIELD_CATALOG 2.0.0).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const PROFESSIONAL_FIELD_CATALOG_CODE = 'MC1.PROFESSIONAL_FIELD_CATALOG';
export const PROFESSIONAL_FIELD_CATALOG_VERSION = '2.0.0';

export type ProfessionalFieldEntry = {
  code: string;
  name: string;
  definition: string;
};

type CatalogFile = {
  catalogCode: string;
  catalogVersion: string;
  fields: ProfessionalFieldEntry[];
  reservedSpecialtyConcepts: Array<{
    code: string;
    parentField: string | null;
    note: string;
  }>;
  legacyAliasesToField: Record<string, string | null>;
};

function resolveCatalogPath(filename: string): string {
  const candidates = [
    join(__dirname, filename),
    resolve(process.cwd(), 'src', 'mc-pipeline', 'catalog', filename),
    resolve(process.cwd(), 'dist', 'src', 'mc-pipeline', 'catalog', filename),
    resolve(process.cwd(), 'dist', 'mc-pipeline', 'catalog', filename),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error(
    `Professional field catalog JSON not found: ${filename} (tried ${candidates.join(' | ')})`,
  );
}

const data = JSON.parse(
  readFileSync(resolveCatalogPath('mc1-professional-fields-v2.json'), 'utf8'),
) as CatalogFile;

export const PROFESSIONAL_FIELDS: ProfessionalFieldEntry[] = data.fields;

export const KNOWN_FIELD_CODES = new Set(
  PROFESSIONAL_FIELDS.map((f) => f.code),
);

export const RESERVED_SPECIALTY_CODES = new Set(
  data.reservedSpecialtyConcepts.map((r) => r.code),
);

const ALIAS = data.legacyAliasesToField;

export function isKnownFieldCode(code: string | null | undefined): boolean {
  return !!code && KNOWN_FIELD_CODES.has(code);
}

export function isReservedSpecialtyCode(
  code: string | null | undefined,
): boolean {
  return !!code && RESERVED_SPECIALTY_CODES.has(code);
}

export function resolveToKnownFieldCode(
  domainCode: string | null | undefined,
  proposedDomainKey: string | null | undefined,
): string | null {
  const tryOne = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const t = raw.trim();
    if (KNOWN_FIELD_CODES.has(t)) return t;
    if (Object.prototype.hasOwnProperty.call(ALIAS, t)) {
      return ALIAS[t];
    }
    const lower = t.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ALIAS, lower)) {
      return ALIAS[lower];
    }
    return null;
  };
  return tryOne(domainCode) ?? tryOne(proposedDomainKey);
}

export function catalogFieldsForPrompt(): Array<{
  code: string;
  name: string;
  definition: string;
}> {
  return PROFESSIONAL_FIELDS.map((f) => ({
    code: f.code,
    name: f.name,
    definition: f.definition,
  }));
}

export function forbiddenSpecialtyCodesForPrompt(): string[] {
  return [...RESERVED_SPECIALTY_CODES];
}
