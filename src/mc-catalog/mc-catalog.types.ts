/**
 * Tipos del catálogo MC1 (dominios, especialidades, mappings).
 */

/** Ciclo de vida de una versión del catálogo MC1. */
export type McCatalogVersionStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED';

/**
 * Ciclo de vida de especialidad EN EL CATÁLOGO (MC1.3.2).
 * EMERGENT no pertenece aquí.
 */
export type McSpecialtyLifecycleStatus =
  | 'ACTIVE'
  | 'EXPERIMENTAL'
  | 'INACTIVE';

export const MC_SPECIALTY_LIFECYCLE_STATUSES: readonly McSpecialtyLifecycleStatus[] =
  ['ACTIVE', 'EXPERIMENTAL', 'INACTIVE'] as const;

/**
 * Presentación de una especialidad PARA UN PERFIL (resultado PA2 futuro).
 * No se almacena en mc_specialty. Sin fórmula en MC1.3.2.
 */
export type McSpecialtyPresentationStatus =
  | 'ACTIVE'
  | 'EMERGENT'
  | 'HIDDEN';

export const MC_SPECIALTY_PRESENTATION_STATUSES: readonly McSpecialtyPresentationStatus[] =
  ['ACTIVE', 'EMERGENT', 'HIDDEN'] as const;

/** Clasificación de una skill respecto a un dominio. */
export type McSkillClassificationStatus =
  | 'DOMAIN_SPECIALTY'
  | 'TRANSVERSAL_FUTURE'
  | 'OUTSIDE_SOFTWARE_DOMAIN'
  | 'AMBIGUOUS'
  | 'CATALOG_GAP';

export const MC_SKILL_CLASSIFICATION_STATUSES: readonly McSkillClassificationStatus[] =
  [
    'DOMAIN_SPECIALTY',
    'TRANSVERSAL_FUTURE',
    'OUTSIDE_SOFTWARE_DOMAIN',
    'AMBIGUOUS',
    'CATALOG_GAP',
  ] as const;

export type McSkillMappingType = 'PRIMARY' | 'SECONDARY';

export interface McSpecialtyDefinition {
  code: string;
  name: string;
  purpose: string;
  description: string;
  /** Solo ciclo de vida de catálogo. */
  lifecycleStatus: McSpecialtyLifecycleStatus;
  sortOrder: number;
}

export interface McDomainDefinition {
  code: string;
  name: string;
  description: string;
  sortOrder: number;
  specialties: McSpecialtyDefinition[];
}

export interface McCatalogDefinition {
  catalogCode: string;
  catalogVersion: string;
  catalogName: string;
  catalogDescription: string;
  domains: McDomainDefinition[];
}

export interface McSpecialtyView {
  id: string;
  code: string;
  name: string;
  purpose: string;
  description: string;
  lifecycleStatus: McSpecialtyLifecycleStatus;
  sortOrder: number;
  isActive: boolean;
  domainCode: string;
}

export interface McDomainView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  specialties: McSpecialtyView[];
}

export interface McCatalogSnapshot {
  catalogVersionId: string;
  catalogCode: string;
  catalogVersion: string;
  status: McCatalogVersionStatus;
  isActive: boolean;
  configHash: string;
  domains: McDomainView[];
}

/** Declaración de seed: identidad estable = normalized_key + skill_type → skill_id. */
export interface McSkillRef {
  skillKey: string;
  skillType: string;
  skillName: string;
}

export interface McSkillClassificationDefinition extends McSkillRef {
  classification: McSkillClassificationStatus;
  rationale: string;
}

export interface McSkillSpecialtyMappingDefinition extends McSkillRef {
  specialtyCode: string;
  weight: number;
  mappingType: McSkillMappingType;
  rationale: string;
}

export interface McDomainMappingPack {
  domainCode: string;
  /** Referencia documental (p. ej. MC1.1). */
  sourceRef: string;
  classifications: McSkillClassificationDefinition[];
  mappings: McSkillSpecialtyMappingDefinition[];
}
