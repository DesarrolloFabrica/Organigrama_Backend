/**
 * Schema TypeScript del perfil curado manual (piloto Fase 1).
 *
 * Reutiliza:
 * - SkillType / EVIDENCE_SOURCE_TYPES de cv-skills.types
 * - No redefine enums persistidos de extracción.
 *
 * La confianza aquí es de la curaduría humana, NO el score PA2.
 */

import {
  EVIDENCE_SOURCE_TYPES,
  SKILL_TYPES,
  type EvidenceSourceType,
  type SkillType,
} from '../../cv-skills/cv-skills.types';
import {
  CURATED_EVIDENCE_TYPES,
  CURATED_PROFILE_SCHEMA_VERSION,
  CURATED_REVIEW_STATUSES,
  CURATED_SKILL_REVIEW_DECISIONS,
  CURATED_SOURCE_METHODS,
  CURATED_SOURCE_TYPES,
  type CuratedEvidenceType,
  type CuratedReviewStatus,
  type CuratedSkillReviewDecision,
  type CuratedSourceMethod,
  type CuratedSourceType,
} from './curated-profile.constants';

export interface CuratedProfileSource {
  type: CuratedSourceType;
  method: CuratedSourceMethod;
  reviewStatus: CuratedReviewStatus;
  /** ISO-8601 opcional. */
  reviewedAt?: string;
  notes?: string;
}

export interface CuratedProfilePerson {
  /** Cédula / documento institucional. Autoridad de resolución. */
  document: string;
}

export interface CuratedProfileMeta {
  /** Dominio principal propuesto por la curaduría (debe coincidir con domain.code). */
  primaryDomainCode: string;
  summary?: string;
}

export interface CuratedEvidenceItem {
  text: string;
  evidenceType: CuratedEvidenceType;
  /**
   * Sección del CV. Reutiliza el catálogo cerrado de extracción automática
   * (`EvidenceSourceType`) para mapping futuro a evidence_items.
   */
  sourceSection?: EvidenceSourceType;
}

export interface CuratedSkillInput {
  canonicalName: string;
  displayName?: string;
  /** Si se omite, la resolución puede ser AMBIGUOUS si hay varios skill_type. */
  skillType?: SkillType;
  confidence: number;
  evidence: CuratedEvidenceItem[];
  /**
   * Schema ≥ 1.1.0. En 1.0.0 se asume REUSE_EXISTING;
   * PROPOSED sin APPROVED_FOR_CREATION se omite en import (warning).
   */
  reviewDecision?: CuratedSkillReviewDecision;
  /** Opcionales de trazabilidad. */
  skillCode?: string;
  matchedSkillId?: string;
  matchedAlias?: string;
  normalizationMethod?: string;
}

export interface CuratedSpecialtyInput {
  code: string;
  name?: string;
  confidence: number;
  skills: CuratedSkillInput[];
}

export interface CuratedDomainInput {
  code: string;
  name?: string;
  confidence: number;
}

/**
 * Contrato raíz del JSON curado.
 * `warnings` / `notes` del archivo son observaciones de la curaduría humana.
 */
export interface CuratedProfileDocument {
  schemaVersion: string;
  source: CuratedProfileSource;
  person: CuratedProfilePerson;
  profile: CuratedProfileMeta;
  domain: CuratedDomainInput;
  specialties: CuratedSpecialtyInput[];
  warnings?: string[];
  notes?: string[];
}

export {
  CURATED_PROFILE_SCHEMA_VERSION,
  CURATED_SKILL_REVIEW_DECISIONS,
  EVIDENCE_SOURCE_TYPES,
  SKILL_TYPES,
};

export type {
  CuratedSkillReviewDecision,
  EvidenceSourceType,
  SkillType,
};
