import type { P1AllowedWarningCode } from './p1-persistence.constants';
import type { P1DomainErrorCode } from './p1-persistence.errors';

export type P1PersistenceMode = 'DRY_RUN' | 'ARTIFACT_ONLY' | 'PERSIST_MDE';

export type P1RunStatus =
  | 'PLANNED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_WARNINGS'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED';

export type P1LineageKey = 'DEFAULT' | 'LAB' | 'REPLAY';
export type P1ResultOrigin = 'PIPELINE' | 'REPLAY' | 'LAB';
export type P1PromotedReason = 'INITIAL' | 'SUPERSEDE' | 'MANUAL';

export type P1CandidateDecision =
  | 'ACCEPTED'
  | 'REJECTED_NON_PROFESSIONAL'
  | 'REJECTED_CONTEXT_ONLY'
  | 'AMBIGUOUS'
  | 'REVIEW_REQUIRED';

export type P1BatchStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'ABORTED';

export type P1ValidationStatus =
  | 'NOT_VALIDATED'
  | 'OK'
  | 'SCHEMA_INVALID'
  | 'OFFSET_INVALID'
  | 'COVERAGE_INVALID';

export interface P1RunConfig {
  contractCode: 'MC1.P1.EVIDENCE';
  contractVersion: string;
  segmenterName: string;
  segmenterVersion: string;
  promptVersion: string;
  modelProvider: string;
  modelVersion: string;
  batchBuilderVersion: string;
  validatorVersion: string;
  warningPolicyVersion: string;
  resultOrigin: P1ResultOrigin;
  campaignId?: string | null;
  pipelineRunId?: string | null;
  lineageKey: P1LineageKey;
}

export interface PlanRunOptions {
  preferReuse?: boolean;
  /** Si coincide con un run abierto, planRun devuelve RESUME en lugar de CONFLICT. */
  resumeIfSamePipeline?: boolean;
}

export type PlanRunResult =
  | {
      outcome: 'REUSE';
      p1RunId: string;
      status: 'COMPLETED' | 'COMPLETED_WITH_WARNINGS';
      attemptNo: number;
      configFingerprint: string;
    }
  | {
      outcome: 'RESUME';
      p1RunId: string;
      status: 'PLANNED' | 'RUNNING';
      attemptNo: number;
      configFingerprint: string;
      missingBatchPlan: ResumeBatchPlan;
    }
  | {
      outcome: 'CREATE';
      p1RunId: string;
      status: 'PLANNED';
      attemptNo: number;
      configFingerprint: string;
    }
  | {
      outcome: 'CONFLICT';
      error: 'RUN_ALREADY_ACTIVE';
      openP1RunId: string;
      configFingerprint: string;
    };

export interface ResumeBatchPlan {
  succeeded: string[];
  failed: string[];
  aborted: string[];
  pending: string[];
  runningActive: string[];
  runningAbandoned: string[];
}

export interface P1RunRow {
  id: string;
  snapshot_id: string;
  attempt_no: number;
  config_fingerprint: string;
  contract_code: string;
  contract_version: string;
  segmenter_name: string;
  segmenter_version: string;
  prompt_version: string;
  model_provider: string;
  model_version: string;
  batch_builder_version: string;
  validator_version: string;
  status: P1RunStatus;
  started_at: Date;
  completed_at: Date | null;
  decision_coverage: string | number;
  candidate_count: number;
  evidence_unit_count: number;
  unsupported_span_count: number;
  forbidden_taxonomy_hit_count: number;
  failed_batch_count: number;
  warning_codes: unknown;
  result_origin: P1ResultOrigin;
  campaign_id: string | null;
  pipeline_run_id: string | null;
  observatory_run_id: string | null;
  error_code: string | null;
  created_at: Date;
}

export interface PersistCandidateInput {
  candidateId: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  textHash: string;
  candidateType: string;
  blockType?: string | null;
  parentHeadingCandidateId?: string | null;
}

export interface PersistDecisionInput {
  candidateId: string;
  decision: P1CandidateDecision;
  reasonCode: string;
  reviewRequired?: boolean;
}

export interface PersistUnitInput {
  primaryCandidateId: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  spanTextHash: string;
  evidenceKind: string;
  explicitness: 'EXPLICIT' | 'STRONGLY_SUPPORTED' | 'INFERRED';
  decision: P1CandidateDecision;
  reviewGate: 'NOT_REQUIRED' | 'PENDING_REVIEW';
  contentFingerprint: string;
  normalizedActivity?: string | null;
  object?: string | null;
  toolOrMethod?: string | null;
  result?: string | null;
  scope?: string | null;
  temporalContext?: string | null;
  confidenceExtraction?: number | null;
  confidenceSpanIntegrity?: number | null;
  provenance?: Record<string, unknown>;
  /** Links secundarios (no primary). */
  secondaryLinks?: Array<{
    candidateId: string;
    linkRole: 'RELATED' | 'CONTEXT' | 'MERGE_SOURCE';
    overlapRatio?: number | null;
  }>;
}

export interface PersistBatchInput {
  batchId: string;
  pageRangeStart: number;
  pageRangeEnd: number;
  candidates: PersistCandidateInput[];
  decisions: PersistDecisionInput[];
  units: PersistUnitInput[];
  validationStatus?: P1ValidationStatus;
  unsupportedSpanCount?: number;
  forbiddenTaxonomyHitCount?: number;
  attemptCount?: number;
  rawOutputRef?: string | null;
  latencyFinishedAt?: Date;
}

export interface PersistBatchResult {
  p1RunId: string;
  batchId: string;
  candidateCount: number;
  decisionCount: number;
  unitCount: number;
  reviewItemCount: number;
  noop?: boolean;
}

export interface FinalizeRunInput {
  p1RunId: string;
  warningCodes?: P1AllowedWarningCode[] | string[];
  /** Sugerencia; la autoridad es la BD + reglas. */
  preferredTerminal?: 'COMPLETED' | 'COMPLETED_WITH_WARNINGS' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
  errorCode?: string | null;
  /**
   * Contadores reclamados por el runner — se ignoran deliberadamente
   * (fuente de verdad = BD).
   */
  claimedMetrics?: Record<string, number>;
}

export interface FinalizeRunResult {
  p1RunId: string;
  status: P1RunStatus;
  metrics: {
    candidateCount: number;
    decisionCount: number;
    decisionCoverage: number;
    evidenceUnitCount: number;
    unsupportedSpanCount: number;
    failedBatchCount: number;
    warningCodes: string[];
  };
}

export interface AdvanceCursorInput {
  snapshotId: string;
  lineageKey: P1LineageKey;
  p1RunId: string;
  promotedReason: P1PromotedReason;
}

export interface CanonicalEvidenceRow {
  evidence_unit_id: string;
  p1_run_id: string;
  snapshot_id: string;
  primary_candidate_id: string;
  page_number: number;
  start_offset: number;
  end_offset: number;
  span_text_hash: string;
  evidence_kind: string;
  explicitness: string;
  review_gate: string;
  content_fingerprint: string;
  lineage_key: string;
  run_status: string;
}

export interface MarkBatchFailedInput {
  p1RunId: string;
  batchId: string;
  status?: 'FAILED' | 'ABORTED';
  errorCode?: string;
  validationStatus?: P1ValidationStatus;
  unsupportedSpanCount?: number;
  forbiddenTaxonomyHitCount?: number;
}

/** Error code used in CONFLICT outcome (subset). */
export type PlanConflictError = Extract<P1DomainErrorCode, 'RUN_ALREADY_ACTIVE'>;
