/**
 * Tipos de salida del dry-run de validación (Fase 1).
 * Solo lectura; no implica persistencia.
 */

import type { CuratedCatalogStatus } from './curated-profile.constants';
import type { SkillType } from './curated-profile.schema';

export type CuratedIssueSeverity = 'error' | 'warning';

export interface CuratedIssue {
  code: string;
  severity: CuratedIssueSeverity;
  path: string;
  message: string;
}

export interface CuratedPersonResolution {
  found: boolean;
  personId: string | null;
  documentMasked: string;
  isActive: boolean | null;
  personCvId: string | null;
  activeCvCount: number;
  ambiguousPersonCount: number;
}

export interface CuratedDomainResolution {
  inputCode: string;
  inputName: string | null;
  matchedDomainId: string | null;
  matchedName: string | null;
  status: CuratedCatalogStatus;
  catalogVersionId: string | null;
  catalogVersion: string | null;
}

export interface CuratedSpecialtyResolution {
  inputCode: string;
  inputName: string | null;
  matchedSpecialtyId: string | null;
  matchedName: string | null;
  domainCode: string | null;
  lifecycleStatus: string | null;
  status: CuratedCatalogStatus;
  mappingSkillCount: number;
}

export type CuratedSkillNormalizationMethod =
  | 'EXACT_KEY'
  | 'CV_SKILL_ALIAS'
  | 'SAFE_SKILL_ALIASES'
  | 'NONE';

export interface CuratedSkillResolution {
  inputCanonicalName: string;
  inputDisplayName: string | null;
  inputSkillType: SkillType | null;
  specialtyCode: string;
  status: CuratedCatalogStatus;
  matchedSkillId: string | null;
  matchedNormalizedName: string | null;
  matchedSkillType: SkillType | null;
  matchedAliasKey: string | null;
  matchedAliasName: string | null;
  normalizationMethod: CuratedSkillNormalizationMethod;
  evidenceCount: number;
  hasMappingToSpecialty: boolean | null;
  confidence: number;
}

export interface CuratedSkillsBuckets {
  existing: CuratedSkillResolution[];
  resolvedAliases: CuratedSkillResolution[];
  proposed: CuratedSkillResolution[];
  ambiguous: CuratedSkillResolution[];
  invalid: CuratedSkillResolution[];
}

export interface CuratedProfileValidationReport {
  schemaVersion: string;
  valid: boolean;
  person: CuratedPersonResolution;
  domain: CuratedDomainResolution | null;
  specialties: CuratedSpecialtyResolution[];
  skills: CuratedSkillsBuckets;
  errors: CuratedIssue[];
  warnings: CuratedIssue[];
  /** Resumen corto para CLI / logs. */
  summary: {
    errorCount: number;
    warningCount: number;
    existingSkillCount: number;
    aliasSkillCount: number;
    proposedSkillCount: number;
    ambiguousSkillCount: number;
    invalidSkillCount: number;
  };
}
