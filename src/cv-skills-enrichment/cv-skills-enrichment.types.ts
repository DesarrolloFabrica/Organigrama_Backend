/**
 * Contratos del Skill Enricher (Pipeline V2 / Fase E1).
 * Independientes del schema libre del Skill Extractor.
 */

import type { EvidenceSourceType, SkillEvidenceItem } from '../cv-skills/cv-skills.types';

export type EnrichmentInventorySourceType = 'ARTIFACT' | 'DATABASE';

export type EnrichmentRunStatus =
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'PARTIAL'
  | 'FAILED';

export type EnrichmentBlockFinalStatus =
  | 'SUCCEEDED'
  | 'PARTIAL'
  | 'FAILED'
  | 'MICRO_RETRY';

export interface EnrichmentInventorySource {
  type: EnrichmentInventorySourceType;
  reference: string;
}

/** Skill de entrada al enricher (lista cerrada). */
export interface EnrichmentInputSkill {
  extractionSkillId: string;
  skillId?: string;
  normalizedName: string;
  originalName?: string;
  skillType?: string;
  sortOrder: number;
  /** true si el ID no proviene de BD (artefacto dry-run). */
  syntheticExtractionSkillId?: boolean;
}

export interface EnrichmentRunInput {
  extractionId?: string;
  personId?: number;
  personCvId?: string | number;
  document: string;
  pdfSha256: string;
  inventorySource: EnrichmentInventorySource;
  skills: EnrichmentInputSkill[];
}

export interface EnrichmentOutputSkill {
  extractionSkillId: string;
  normalizedName: string;
  evidenceItems: SkillEvidenceItem[];
  warnings: string[];
}

/** Forma cruda esperada de Gemini (antes de integridad). */
export interface EnrichmentGeminiSkillRaw {
  extractionSkillId?: unknown;
  normalizedName?: unknown;
  evidenceItems?: unknown;
}

export interface EnrichmentGeminiResponseRaw {
  skills?: unknown;
  warnings?: unknown;
}

export interface EnrichmentBlockConfig {
  blockSize: number;
  parallelism: number;
  maxBlockAttempts: number;
  microRetrySize: number;
  maxMicroRetryAttempts: number;
}

export interface InventoryHashResult {
  algorithm: 'sha256';
  canonicalPayload: string;
  inventoryHash: string;
}

export interface BlockValidationIssue {
  code: string;
  message: string;
  extractionSkillId?: string;
}

export interface BlockValidationResult {
  ok: boolean;
  /** Skills validadas en el orden del input del bloque. */
  skills: EnrichmentOutputSkill[];
  identityErrors: BlockValidationIssue[];
  warnings: string[];
  unknownSkillsReturned: number;
  duplicateSkillsReturned: number;
}

export interface EnrichmentBlockAttemptArtifact {
  attemptNumber: number;
  startedAt: string;
  durationMs: number;
  rawResponse: unknown;
  validationErrors: BlockValidationIssue[];
  validationWarnings: string[];
}

export interface EnrichmentBlockArtifact {
  blockNumber: number;
  inputSkillIds: string[];
  attempts: EnrichmentBlockAttemptArtifact[];
  finalStatus: EnrichmentBlockFinalStatus;
}

export interface EnrichmentRunMetrics {
  inputSkills: number;
  outputSkills: number;
  exactIdentityMatches: number;
  missingFilledEmpty: number;
  unknownSkillsReturned: number;
  duplicateSkillsReturned: number;
  skillsWithEvidence: number;
  skillsWithoutEvidence: number;
  totalEvidenceItems: number;
  averageEvidenceItems: number;
  sourceTypeCounts: Record<string, number>;
  onlySkillsSectionCount: number;
  workExperienceCount: number;
  projectCount: number;
  warningsCount: number;
  geminiCalls: number;
  blockRetries: number;
  microRetryCalls: number;
}

export interface EnrichmentArtifact {
  meta: {
    document: string;
    pdfSha256: string;
    inventoryHash: string;
    inventoryInputCount: number;
    model: string;
    promptVersion: string;
    enricherVersion: string;
    blockConfigVersion: string;
    blockSize: number;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    status: EnrichmentRunStatus;
  };
  inventory: {
    source: EnrichmentInventorySource;
    skills: EnrichmentInputSkill[];
    hash: InventoryHashResult;
  };
  blocks: EnrichmentBlockArtifact[];
  validatedResult: {
    skills: EnrichmentOutputSkill[];
  };
  metrics: EnrichmentRunMetrics;
  warnings: string[];
}

export type { EvidenceSourceType, SkillEvidenceItem };
