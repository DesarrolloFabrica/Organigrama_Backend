/**
 * DTOs de salida del Explorador de Competencias (MC1.3.4).
 * Orientados a producto; no exponen entidades TypeORM.
 */

import type { Mc1PersonCompetenciesPresentationDto } from '../../mc-pipeline/person-profile';

export type CompetencyAvailabilityStatus =
  | 'AVAILABLE'
  | 'NOT_EVALUATED'
  | 'FAILED'
  | 'STALE';

export type CompetencyPresentationStatus = 'ACTIVE' | 'EMERGENT' | 'HIDDEN';

export interface CompetencyPersonDto {
  id: string;
  fullName: string;
  role: string | null;
}

export interface CompetencyEvaluationMetaDto {
  id: string;
  status: 'SUCCEEDED' | 'FAILED';
  availabilityStatus: CompetencyAvailabilityStatus;
  evaluatedAt: string | null;
  rulesVersion: string;
  /** Metadatos de auditoría (soporte); el UI puede ignorarlos. */
  audit?: {
    catalogVersion: string;
    catalogVersionId: string;
    mappingHash: string;
    configHash: string;
    extractionId: string;
    evidenceEvaluationId: string;
    enrichmentId: string;
    domainCode: string;
    /** MC1.6.1B.2 — opcionales (null en históricas sin backfill). */
    mappingPackCode?: string | null;
    mappingPackVersion?: string | null;
    sourceHash?: string | null;
    algorithmVersion?: string | null;
    evaluationContextHash?: string | null;
  };
}

export interface CompetencySpecialtySummaryDto {
  code: string;
  name: string;
  presentationStatus: CompetencyPresentationStatus;
  isDefault: boolean;
  rank: number;
  metrics: {
    mappedSkillCount: number;
    evidencedSkillCount: number;
    coverage: number;
    confidence: number;
    strength: number;
  };
  warnings: string[];
}

export interface CompetencyDomainSummaryDto {
  code: string;
  name: string;
  defaultSpecialtyCode: string | null;
  activeSpecialtyCount: number;
  emergentSpecialtyCount: number;
  specialties: CompetencySpecialtySummaryDto[];
}

export interface CompetencyExplorerSummaryDto {
  availabilityStatus: CompetencyAvailabilityStatus;
  person: CompetencyPersonDto;
  evaluation: CompetencyEvaluationMetaDto | null;
  domains: CompetencyDomainSummaryDto[];
  warnings: string[];
}

export interface CompetencyEvidenceItemDto {
  sourceType: string;
  /** Fragmento documental ya presente en Enrichment (no CV completo). */
  text: string;
}

export interface CompetencySkillDto {
  id: string;
  code: string;
  name: string;
  type: string;
  mapping: {
    role: 'PRIMARY' | 'SECONDARY';
    weight: number;
  };
  evidence: {
    level: string;
    strength: number;
    confidence: number;
    items: CompetencyEvidenceItemDto[];
  };
}

export interface CompetencySpecialtyDetailDto {
  code: string;
  name: string;
  presentationStatus: CompetencyPresentationStatus;
  lifecycleStatus: string;
  isDefault: boolean;
  rank: number;
  metrics: {
    mappedSkillCount: number;
    evidencedSkillCount: number;
    coverage: number;
    confidence: number;
    strength: number;
  };
  reasons: string[];
  warnings: string[];
  skills: CompetencySkillDto[];
  evaluation: CompetencyEvaluationMetaDto;
}

export interface CompetencyDomainDetailDto {
  availabilityStatus: CompetencyAvailabilityStatus;
  person: CompetencyPersonDto;
  evaluation: CompetencyEvaluationMetaDto | null;
  domain: {
    code: string;
    name: string;
    defaultSpecialtyCode: string | null;
    activeSpecialtyCount: number;
    emergentSpecialtyCount: number;
  };
  specialties: CompetencySpecialtySummaryDto[];
  warnings: string[];
}

/** Qualification intra-dominio (MC1.1) expuesta a la ficha. */
export type CompetencyDomainQualificationDto =
  | 'PRIMARY_MATCH'
  | 'SECONDARY_SIGNAL'
  | 'OUTSIDE'
  | 'INSUFFICIENT_EVIDENCE';

/**
 * Perfil profesional multidominio (piloto MC1).
 * Solo dominios con evaluación SUCCEEDED publicable sobre la extracción activa.
 * CDR: null si no hay resultado persistido (no se inventa en API).
 */
/** Capacidad MVP publicable sin depender de dominio (piloto coordinadores). */
export interface CompetencyMvpCapabilityDto {
  code: string | null;
  label: string;
  evidenceLevel: 'STRONG' | 'MODERATE' | 'WEAK' | 'EMERGING';
  sourceCount: number;
  domainCode: string | null;
  classification: string;
}

export interface CompetencyMvpToolDto {
  label: string;
  type: 'TOOL' | 'METHODOLOGY';
  evidenceLevel: string;
  hasProfessionalContext: boolean;
}

export interface CompetencyProfessionalProfileDto {
  availabilityStatus: CompetencyAvailabilityStatus;
  person: CompetencyPersonDto;
  extractionId: string | null;
  defaultDomainCode: string | null;
  /** Siempre null mientras no exista CDR persistido publicable. */
  crossDomainClassification: {
    classification: string;
    version: string;
  } | null;
  evaluatedDomains: Array<{
    code: string;
    name: string;
    qualification: CompetencyDomainQualificationDto;
    evaluationId: string;
    isPublishedPrimary: boolean;
    evaluatedAt: string | null;
    rulesVersion: string;
    defaultSpecialtyCode: string | null;
    activeSpecialtyCount: number;
    emergentSpecialtyCount: number;
    /** Resumen corto publicable; sin prompts ni razonamiento interno. */
    summary: string;
    specialties: CompetencySpecialtySummaryDto[];
    warnings: string[];
  }>;
  /**
   * Capas MVP: competencias sustentadas aunque no haya dominio representativo.
   * Proyección read-only desde extracción/evidence activos.
   */
  mvpCapabilities: {
    classificationPending: boolean;
    consolidatedCapabilities: CompetencyMvpCapabilityDto[];
    complementaryCapabilities: CompetencyMvpCapabilityDto[];
    emergingCapabilities: CompetencyMvpCapabilityDto[];
    tools: CompetencyMvpToolDto[];
    methodologies: CompetencyMvpToolDto[];
    qualityAlerts: string[];
  } | null;
  /**
   * FASE 9F — MC1 Profile Assembly local (ARTIFACT_ONLY).
   * Cuando status=AVAILABLE, la UI debe mostrar este modelo y NO el legacy MVP/dominios.
   */
  mc1Profile?: Mc1PersonCompetenciesPresentationDto | null;
  warnings: string[];
}
