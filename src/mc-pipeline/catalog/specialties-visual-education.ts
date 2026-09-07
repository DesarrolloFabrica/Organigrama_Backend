/**
 * Catálogos de especialidades MC1 consumidos por P3+.
 * - VISUAL_DESIGN + EDUCATION: 1.1.0 FROZEN (8B.2)
 * - PROJECT_PROGRAM_MGMT: 1.0.0 ACTIVE (9A)
 * - FINANCE_ADMIN: 1.0.0 ACTIVE (9B)
 * - SOFTWARE_ENGINEERING: 1.0.0 ACTIVE (9C foundation)
 * - AUDIOVISUAL_PRODUCTION: 1.0.0 ACTIVE (10B foundation)
 * - COMMUNICATIONS: 1.0.0 ACTIVE (11B foundation)
 * - DATA_ANALYTICS: 1.1.0 ACTIVE (DA foundation + governance dual-attribution)
 * - DIGITAL_MARKETING: 1.0.0 ACTIVE (DM foundation)
 * - CUSTOMER_SUCCESS: 1.0.0 ACTIVE (CS foundation)
 * - PEOPLE_HR: 1.0.0 ACTIVE (HR foundation)
 * - IT_SYSTEMS: 1.0.0 ACTIVE (IT ops foundation)
 * - LEGAL: 1.0.0 ACTIVE (LEGAL foundation)
 * Versión activa unificada para fingerprint P3: 1.13.0
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Versión activa del catálogo unificado consumido por P3/P4/profile. */
export const SPECIALTY_CATALOG_VERSION = '1.13.0';
export const SPECIALTY_CATALOG_STATUS = 'ACTIVE' as const;
export const SPECIALTY_CATALOG_CODE = 'MC1.SPECIALTY_CATALOG' as const;

export const SPECIALTY_CATALOG_VE_VERSION = '1.1.0';
export const SPECIALTY_CATALOG_PPM_VERSION = '1.0.0';
export const SPECIALTY_CATALOG_FA_VERSION = '1.0.0';
export const SPECIALTY_CATALOG_SE_VERSION = '1.0.0';
export const SPECIALTY_CATALOG_AV_VERSION = '1.0.0';
export const SPECIALTY_CATALOG_COMM_VERSION = '1.0.0';
export const SPECIALTY_CATALOG_DA_VERSION = '1.1.0';
export const SPECIALTY_CATALOG_DM_VERSION = '1.0.0';
export const SPECIALTY_CATALOG_CS_VERSION = '1.0.0';
export const SPECIALTY_CATALOG_HR_VERSION = '1.0.0';
export const SPECIALTY_CATALOG_IT_VERSION = '1.0.0';
export const SPECIALTY_CATALOG_LEGAL_VERSION = '1.0.0';

export type SpecialtyEntry = {
  code: string;
  name: string;
  parentField: string;
  definition: string;
  positiveSignals: string[];
  exclusions: string[];
};

export type ReservedFutureSkill = {
  code: string;
  parentSpecialty: string;
  parentField: string;
  note: string;
};

type CatalogFile = {
  catalogCode: string;
  catalogVersion: string;
  status?: string;
  scope: string[];
  specialties: SpecialtyEntry[];
  legacySpecialtyAliasesToSpecialty?: Record<string, string>;
  reservedFutureSkills?: ReservedFutureSkill[];
  omittedCandidates?: Array<{ code: string; reason: string }>;
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
    `Specialty catalog JSON not found: ${filename} (tried ${candidates.join(' | ')})`,
  );
}

function loadCatalog(filename: string): CatalogFile {
  return JSON.parse(readFileSync(resolveCatalogPath(filename), 'utf8')) as CatalogFile;
}

const ve = loadCatalog('mc1-specialties-visual-education-v1.json');
const ppm = loadCatalog('mc1-specialties-project-program-mgmt-v1.json');
const fa = loadCatalog('mc1-specialties-finance-admin-v1.json');
const se = loadCatalog('mc1-specialties-software-engineering-v1.json');
const av = loadCatalog('mc1-specialties-audiovisual-production-v1.json');
const comm = loadCatalog('mc1-specialties-communications-v1.json');
const da = loadCatalog('mc1-specialties-data-analytics-v1.json');
const dm = loadCatalog('mc1-specialties-digital-marketing-v1.json');
const cs = loadCatalog('mc1-specialties-customer-success-v1.json');
const hr = loadCatalog('mc1-specialties-people-hr-v1.json');
const it = loadCatalog('mc1-specialties-it-systems-v1.json');
const legal = loadCatalog('mc1-specialties-legal-v1.json');

export const SPECIALTY_CATALOG_SCOPE = new Set([
  ...ve.scope,
  ...ppm.scope,
  ...fa.scope,
  ...se.scope,
  ...av.scope,
  ...comm.scope,
  ...da.scope,
  ...dm.scope,
  ...cs.scope,
  ...hr.scope,
  ...it.scope,
  ...legal.scope,
]);

export const SPECIALTIES: SpecialtyEntry[] = [
  ...ve.specialties,
  ...ppm.specialties,
  ...fa.specialties,
  ...se.specialties,
  ...av.specialties,
  ...comm.specialties,
  ...da.specialties,
  ...dm.specialties,
  ...cs.specialties,
  ...hr.specialties,
  ...it.specialties,
  ...legal.specialties,
];

export const SPECIALTY_BY_CODE = new Map(
  SPECIALTIES.map((s) => [s.code, s] as const),
);

export const RESERVED_FUTURE_SKILLS: ReservedFutureSkill[] = [
  ...(ve.reservedFutureSkills ?? []),
  ...(ppm.reservedFutureSkills ?? []),
  ...(fa.reservedFutureSkills ?? []),
  ...(se.reservedFutureSkills ?? []),
  ...(av.reservedFutureSkills ?? []),
  ...(comm.reservedFutureSkills ?? []),
  ...(da.reservedFutureSkills ?? []),
  ...(dm.reservedFutureSkills ?? []),
  ...(cs.reservedFutureSkills ?? []),
  ...(hr.reservedFutureSkills ?? []),
  ...(it.reservedFutureSkills ?? []),
  ...(legal.reservedFutureSkills ?? []),
];

export const RESERVED_FUTURE_SKILL_CODES = new Set(
  RESERVED_FUTURE_SKILLS.map((s) => s.code),
);

const LEGACY_ALIAS: Record<string, string> = {
  ...(ve.legacySpecialtyAliasesToSpecialty ?? {}),
  ...(ppm.legacySpecialtyAliasesToSpecialty ?? {}),
  ...(fa.legacySpecialtyAliasesToSpecialty ?? {}),
  ...(se.legacySpecialtyAliasesToSpecialty ?? {}),
  ...(av.legacySpecialtyAliasesToSpecialty ?? {}),
  ...(comm.legacySpecialtyAliasesToSpecialty ?? {}),
  ...(da.legacySpecialtyAliasesToSpecialty ?? {}),
  ...(dm.legacySpecialtyAliasesToSpecialty ?? {}),
  ...(cs.legacySpecialtyAliasesToSpecialty ?? {}),
  ...(hr.legacySpecialtyAliasesToSpecialty ?? {}),
  ...(it.legacySpecialtyAliasesToSpecialty ?? {}),
  ...(legal.legacySpecialtyAliasesToSpecialty ?? {}),
};

export function isKnownSpecialtyCode(code: string | null | undefined): boolean {
  return !!code && SPECIALTY_BY_CODE.has(code);
}

export function isReservedFutureSkillCode(
  code: string | null | undefined,
): boolean {
  return !!code && RESERVED_FUTURE_SKILL_CODES.has(code);
}

export function resolveToKnownSpecialtyCode(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  const t = code.trim();
  if (RESERVED_FUTURE_SKILL_CODES.has(t)) return null;
  if (SPECIALTY_BY_CODE.has(t)) return t;
  const mapped = LEGACY_ALIAS[t];
  if (mapped && SPECIALTY_BY_CODE.has(mapped)) return mapped;
  return null;
}

export function specialtiesForField(fieldCode: string): SpecialtyEntry[] {
  return SPECIALTIES.filter((s) => s.parentField === fieldCode);
}

export function parentFieldOfSpecialty(code: string): string | null {
  const resolved = resolveToKnownSpecialtyCode(code) ?? code;
  return SPECIALTY_BY_CODE.get(resolved)?.parentField ?? null;
}

export function specialtiesForPrompt(fieldCodes: string[]): Array<{
  code: string;
  name: string;
  parentField: string;
  definition: string;
  positiveSignals: string[];
  exclusions: string[];
}> {
  const allowed = new Set(fieldCodes);
  return SPECIALTIES.filter((s) => allowed.has(s.parentField)).map((s) => ({
    code: s.code,
    name: s.name,
    parentField: s.parentField,
    definition: s.definition,
    positiveSignals: s.positiveSignals,
    exclusions: s.exclusions,
  }));
}

export function forbiddenSpecialtyCodesForPrompt(): string[] {
  return [...Object.keys(LEGACY_ALIAS), ...RESERVED_FUTURE_SKILL_CODES];
}
