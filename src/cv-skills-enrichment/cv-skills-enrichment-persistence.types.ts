/**
 * Tipos del servicio de persistencia histórica del Skill Enricher (E3).
 */

import type { EnrichmentBlockConfig, EnrichmentRunMetrics } from './cv-skills-enrichment.types';
import type { EnrichmentBlockAttemptStatus, EnrichmentBlockAttemptType } from './entities/cv-skill-enrichment-block.entity';
import type { EnrichmentItemStatus } from './entities/cv-skill-enrichment-item.entity';
import type { CvSkillEnrichmentStatus } from './entities/cv-skill-enrichment.entity';

export class CvSkillsEnrichmentPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CvSkillsEnrichmentPersistenceError';
  }
}

export class EnrichmentActivationRejectedError extends CvSkillsEnrichmentPersistenceError {
  constructor(message: string) {
    super(message);
    this.name = 'EnrichmentActivationRejectedError';
  }
}

export interface IdempotencyKey {
  extractionId: string;
  pdfSha256: string;
  inventoryHash: string;
  model: string;
  promptVersion: string;
  enricherVersion: string;
  blockConfigHash: string;
}

export interface CreatePendingEnrichmentInput extends IdempotencyKey {
  personId: string | number;
  personCvId: string | number;
  blockConfigVersion: string;
  blockConfig: EnrichmentBlockConfig | Record<string, unknown>;
  inputSkillsCount: number;
  blocksTotal: number;
}

export interface AppendBlockAttemptInput {
  enrichmentId: string | number;
  blockNumber: number;
  attemptNumber: number;
  attemptType: EnrichmentBlockAttemptType;
  inputSkillIds: string[];
  status: EnrichmentBlockAttemptStatus;
  rawResponse?: unknown | null;
  validationErrors?: unknown[] | null;
  validationWarnings?: string[] | null;
  modelUsage?: Record<string, unknown> | null;
  durationMs?: number | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
}

export interface EnrichmentItemPersistInput {
  extractionSkillId: string;
  normalizedName: string;
  evidenceItems: Record<string, unknown>[];
  sourceTypes: string[];
  warnings?: string[] | null;
  status: EnrichmentItemStatus;
  wasFilledEmpty: boolean;
}

export interface CompleteEnrichmentInput {
  enrichmentId: string | number;
  status: Extract<'SUCCEEDED' | 'PARTIAL', CvSkillEnrichmentStatus>;
  items: EnrichmentItemPersistInput[];
  metrics: EnrichmentRunMetrics | Record<string, unknown>;
  warnings: string[];
  validatedResultJson: Record<string, unknown>;
  blocksSucceeded: number;
  blocksFailed: number;
  attemptsTotal: number;
  /** Skills de inventario esperadas (para integridad). */
  expectedSkills: Array<{
    extractionSkillId: string;
    normalizedName: string;
  }>;
}

export interface FailEnrichmentInput {
  enrichmentId: string | number;
  errorStage: string;
  errorCode?: string;
  errorMessage: unknown;
  blocksSucceeded?: number;
  blocksFailed?: number;
  attemptsTotal?: number;
  warnings?: string[] | null;
}

export interface ActivateEnrichmentResult {
  enrichmentId: string;
  extractionId: string;
  previousActiveId: string | null;
  activated: boolean;
  alreadyActive: boolean;
}

export interface DeactivateEnrichmentResult {
  enrichmentId: string;
  extractionId: string;
  deactivated: boolean;
  alreadyInactive: boolean;
  status: string;
}

export interface PersistRunOutcome {
  outcome:
    | 'ALREADY_SUCCEEDED'
    | 'SUCCEEDED'
    | 'PARTIAL'
    | 'FAILED';
  enrichmentId: string;
  status: CvSkillEnrichmentStatus;
  isActive: boolean;
  activated: boolean;
  skippedGemini: boolean;
  metrics?: EnrichmentRunMetrics | Record<string, unknown> | null;
  warnings?: string[] | null;
}
