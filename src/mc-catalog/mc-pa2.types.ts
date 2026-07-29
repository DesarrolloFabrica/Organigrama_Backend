import type { McSpecialtyLifecycleStatus } from './mc-catalog.types';
import type { McSpecialtyPresentationStatus } from './mc-catalog.types';
import type { McPa2EngineConfig } from './mc-pa2.config';

export type McEvidenceLevel = 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG';

export interface McPa2SkillEvidenceInput {
  skillId: string;
  skillKey: string;
  skillName: string;
  skillType: string;
  evidenceLevel: McEvidenceLevel;
  evidenceStrength: number;
  evidenceConfidence: number;
}

export interface McPa2MappingInput {
  skillId: string;
  specialtyCode: string;
  specialtyId: string;
  weight: number;
  mappingType: 'PRIMARY' | 'SECONDARY';
  rationale?: string | null;
}

export interface McPa2SpecialtyInput {
  specialtyId: string;
  specialtyCode: string;
  specialtyName: string;
  lifecycleStatus: McSpecialtyLifecycleStatus;
  sortOrder: number;
}

export interface McPa2EngineInput {
  domainCode: string;
  specialties: McPa2SpecialtyInput[];
  mappings: McPa2MappingInput[];
  /** Skills del perfil con evidencia (típicamente las de la extracción). */
  skills: McPa2SkillEvidenceInput[];
  config: McPa2EngineConfig;
}

export interface McPa2SkillContribution {
  skillId: string;
  skillKey: string;
  skillName: string;
  skillType: string;
  mappingWeight: number;
  mappingType: 'PRIMARY' | 'SECONDARY';
  evidenceLevel: McEvidenceLevel;
  evidenceStrength: number;
  evidenceConfidence: number;
  /** strength * weight (0 si NONE). */
  strengthContribution: number;
  /** confidence * weight (solo si evidenciada). */
  confidenceContribution: number | null;
  evidenced: boolean;
}

export interface McPa2SpecialtyResult {
  specialtyId: string;
  specialtyCode: string;
  specialtyName: string;
  lifecycleStatus: McSpecialtyLifecycleStatus;
  presentationStatus: McSpecialtyPresentationStatus;
  mappedSkillCount: number;
  evidencedSkillCount: number;
  coverage: number;
  confidence: number;
  strength: number;
  rank: number;
  isDefault: boolean;
  rankingScore: number;
  primaryStrongCount: number;
  dominanceShare: number;
  /** Suma strengthContribution de skills profesionales evidenciadas. */
  professionalContribution: number;
  /** Suma strengthContribution de TOOL evidenciadas. */
  toolContribution: number;
  /** Suma strengthContribution de SOFT/otros evidenciados. */
  transversalContribution: number;
  /** Skills profesionales evidenciadas que cuentan para anti-tool. */
  professionalEvidencedCount: number;
  overrideApplied: boolean;
  reasons: string[];
  warnings: string[];
  skillBreakdown: McPa2SkillContribution[];
}

export interface McPa2EngineRunResult {
  domainCode: string;
  engineRulesVersion: string;
  configHash: string;
  specialtyResults: McPa2SpecialtyResult[];
  defaultSpecialtyCode: string | null;
  activeCount: number;
  emergentCount: number;
  hiddenCount: number;
  warnings: string[];
}
