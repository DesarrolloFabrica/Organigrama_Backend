export { McCvSnapshot } from './entities/mc-cv-snapshot.entity';
export { McPipelineModule } from './mc-pipeline.module';
export { McCvSnapshotService } from './p0/mc-cv-snapshot.service';
export { P0DriveDocumentSource } from './p0/p0-drive-document-source';
export type { P0DriveDocumentSourceResult } from './p0/p0-drive-document-source';
export * from './p0/p0.types';
export * from './p0/p0.errors';
export { DeterministicEvidenceCandidateSegmenter } from './p1/deterministic-evidence-candidate-segmenter';
export { P1EvidenceBatchBuilder } from './p1/p1-evidence-batch-builder';
export * from './p1/p1.types';
export {
  P1_WARNING_POLICY_VERSION,
  P1_ALLOWED_WARNING_CODES,
  P1_BATCH_RUNNING_LEASE_MS,
  P1_CONTRACT_CODE,
  P1PersistenceError,
  P1_DOMAIN_ERROR_CODES,
  computeConfigFingerprint,
  assertConfigFingerprint,
  assertWarningCodesAllowed,
  sha256Hex,
  P1RunRepository,
  P1RunLifecycleService,
  P1ArtifactWriter,
  P1RunCursorService,
  P1CanonicalEvidenceReader,
  P1ReviewQueueGateway,
  P1PersistenceService,
  createP1PersistenceService,
  P1PersistenceModule,
  P1_PERSISTENCE_MODE,
} from './p1-persistence';
export type {
  P1AllowedWarningCode,
  P1DomainErrorCode,
  P1PersistenceMode,
  P1RunStatus,
  P1LineageKey,
  P1ResultOrigin,
  P1PromotedReason,
  P1BatchStatus,
  P1ValidationStatus,
  P1RunConfig,
  PlanRunOptions,
  PlanRunResult,
  ResumeBatchPlan,
  P1RunRow,
  PersistCandidateInput,
  PersistDecisionInput,
  PersistUnitInput,
  PersistBatchInput,
  PersistBatchResult,
  FinalizeRunInput,
  FinalizeRunResult,
  AdvanceCursorInput,
  CanonicalEvidenceRow,
  MarkBatchFailedInput,
} from './p1-persistence';
// P1CandidateDecision: prefer p1.types (runner); persistence uses compatible string union.
