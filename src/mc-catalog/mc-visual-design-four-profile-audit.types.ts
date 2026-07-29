/**
 * MC1.6 — Auditoría controlada Diseño Visual (cuatro perfiles).
 * Contratos de diagnóstico. Sin persistencia. Sin PII innecesaria.
 */

import type { McDomainQualification } from './mc-domain-qualification';
import type { McEvidenceLevel } from './mc-pa2.types';
import type { McSpecialtyPresentationStatus } from './mc-catalog.types';

export const MC_VD_FOUR_AUDIT_VERSION = 'VD-AUDIT-0.1.0' as const;
export const MC_VD_FOUR_TARGET_DOCUMENTS = [
  '1015482688',
  '1000035262',
  '1000590473',
  '103154553',
] as const;

export type McVdChainStatus =
  | 'AVAILABLE'
  | 'MISSING'
  | 'FAILED'
  | 'OUTDATED'
  | 'NOT_EXECUTED';

export type McVdSkillSource =
  | 'EXPLICIT'
  | 'NORMALIZED'
  | 'INFERRED_BY_ENRICHMENT'
  | 'NOT_FOUND';

export type McVdGapKind =
  | 'UNMAPPED_SKILL'
  | 'UNKNOWN_ALIAS'
  | 'MISSING_CATALOG_SKILL'
  | 'MISSING_SPECIALTY'
  | 'LOW_WEIGHT_MAPPING'
  | 'CROSS_DOMAIN_ONLY'
  | 'EXTRACTION_GAP'
  | 'ENRICHMENT_GAP'
  | 'NOT_VISUAL'
  | 'EVALUATION_GAP'
  | 'ALIAS_GAP'
  | 'MAPPING_GAP'
  | 'NONE';

export type McVdVerdictCode =
  | 'DOMAIN_MODEL_GAP'
  | 'ALIAS_GAP'
  | 'MAPPING_GAP'
  | 'EXTRACTION_GAP'
  | 'ENRICHMENT_GAP'
  | 'PA2_GAP'
  | 'QUALIFICATION_GAP'
  | 'RESULT_REASONABLE'
  | 'INSUFFICIENT_CV_EVIDENCE'
  | 'CHAIN_INCOMPLETE'
  | 'PERSON_NOT_FOUND'
  | 'LIVE_DATA_REQUIRED';

export type McVdCrossDomainKind =
  | 'VISUAL_ONLY'
  | 'AUDIOVISUAL_ONLY'
  | 'SOFTWARE_ONLY'
  | 'SHARED'
  | 'CONTEXT_DEPENDENT'
  | 'NOT_APPLICABLE';

export type McVdDataSource =
  | 'HISTORICAL_DOC'
  | 'HISTORICAL_PARTIAL'
  | 'SYNTHETIC'
  | 'LIVE_PG'
  | 'FIXTURE_UNKNOWN';

export interface McVdProfileSkill {
  skillKey: string;
  skillName: string;
  skillType: string;
  evidenceLevel: McEvidenceLevel;
  evidenceStrength: number;
  evidenceConfidence: number;
  /** Fragmento mínimo (≤120 chars). Sin párrafos de CV. */
  evidenceSnippet: string | null;
  source: McVdSkillSource;
  originalName: string | null;
}

export interface McVdChainSnapshot {
  cv: McVdChainStatus;
  extraction: McVdChainStatus;
  enrichment: McVdChainStatus;
  evidence: McVdChainStatus;
  visualEvaluation: McVdChainStatus;
  evaluationSet: McVdChainStatus;
  extractionId: string | null;
  enrichmentId: string | null;
  evidenceId: string | null;
  notes: string[];
}

export interface McVdProfileSnapshot {
  document: string;
  personId: string | null;
  /** Solo confirmación de localización; omitir en exports públicos si no hace falta. */
  fullNameConfirm: string | null;
  found: boolean;
  dataSource: McVdDataSource;
  chain: McVdChainSnapshot;
  skills: McVdProfileSkill[];
}

export interface McVdSkillGapRow {
  skillKey: string;
  skillName: string;
  canonicalInPack: boolean;
  evidenceAvailable: boolean;
  aliasApplied: boolean;
  recognizedByVisual: boolean;
  specialtyTargets: string[];
  gap: McVdGapKind;
  reason: string;
  potentialAction: string;
}

export interface McVdSpecialtyAuditRow {
  specialtyCode: string;
  specialtyName: string;
  status: McSpecialtyPresentationStatus | 'UNSUPPORTED';
  strength: number | null;
  coverage: number | null;
  mappedSkillCount: number;
  evidencedSkillCount: number;
  expectedSkillKeys: string[];
  foundSkillKeys: string[];
  reason: string;
}

export interface McVdDryRunResult {
  qualification: McDomainQualification | 'NOT_AVAILABLE';
  activeCount: number | null;
  emergentCount: number | null;
  hiddenCount: number | null;
  coverageSummary: number | null;
  warnings: string[];
  specialties: McVdSpecialtyAuditRow[];
  mappedSkillKeys: string[];
  unmappedDomainSpecialtyKeys: string[];
}

export interface McVdPersonDiagnosis {
  document: string;
  personId: string | null;
  found: boolean;
  dataSource: McVdDataSource;
  chain: McVdChainSnapshot;
  dryRun: McVdDryRunResult | null;
  skillGaps: McVdSkillGapRow[];
  unusedVisualEvidence: McVdSkillGapRow[];
  verdicts: McVdVerdictCode[];
  recommendedLayer: string;
  notes: string[];
}

export interface McVdSpecialtyCatalogAudit {
  specialtyCode: string;
  specialtyName: string;
  mappingCount: number;
  classificationCount: number;
  coverageInProfiles: number;
  maturity: 'EXISTS' | 'PARTIAL' | 'MIXED' | 'MISSING' | 'RESERVED' | 'DEPRECATED_IN_DOCS';
  diagnosis: string;
}

export interface McVdSharedToolNote {
  skillKey: string;
  kind: McVdCrossDomainKind;
  distinctionHint: string;
}

export interface McVdFourProfileAuditReport {
  auditVersion: string;
  packVersion: string;
  pa2RulesVersion: string;
  catalogVersion: string;
  mode: 'FIXTURE' | 'LIVE_READONLY' | 'BLOCKED';
  writes: 0;
  documents: string[];
  persons: McVdPersonDiagnosis[];
  specialtyCatalog: McVdSpecialtyCatalogAudit[];
  sharedTools: McVdSharedToolNote[];
  repeatedPatterns: Array<{
    pattern: string;
    layer: string;
    documents: string[];
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  comparisonMatrix: Array<{
    dimension: string;
    cells: Record<string, McVdSkillSource>;
  }>;
  globalLayerSummary: Array<{
    layer: string;
    gapCount: number;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    documentsAffected: number;
    priority: number;
  }>;
  strengtheningPlan: Array<{
    phase: string;
    change: string;
    expectedResult: string;
    risk: string;
  }>;
  openQuestions: string[];
}
