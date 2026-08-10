/**
 * Tipos del Evidence Observatory Pilot — sin PII / texto / spans.
 */
export type CohortMemberRole = 'ANCHOR' | 'DIVERSITY' | 'EDGE' | 'CONTROL';

export type ObservatoryRunStatus =
  | 'PLANNED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_WARNINGS'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED';

export type MemberP0Status =
  | 'PENDING'
  | 'REUSED'
  | 'CREATED'
  | 'MISSING'
  | 'FAILED'
  | 'SKIPPED';

export type MemberP1Status =
  | 'PENDING'
  | 'REUSED_ARTIFACT'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'SKIPPED'
  | 'BLOCKED_BAD_SNAPSHOT';

export type MetricBucket = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export type SelectionMetrics = {
  pageCount: number | null;
  normalizedCharacterCount: number | null;
  headingCountEstimated: number | null;
  candidateCountEstimated: number | null;
  lineDensity: number | null;
  listDensity: number | null;
  meanCandidateLength: number | null;
  warningCount: number | null;
  hasPriorSnapshot: boolean;
  legacySkillCount: number | null;
  legacyEvidenceCount: number | null;
  legacyExtractionOk: boolean | null;
  fileSizeBytes: number | null;
  diversityScore: number;
  edgeScore: number;
};

export type CohortMember = {
  memberIndex: number;
  snapshotId: string | null;
  personCvId: number;
  role: CohortMemberRole;
  selectionReasonCode: string;
  selectionMetrics: SelectionMetrics;
  snapshotStatus: string | null;
  p0Status: MemberP0Status;
  p1Status: MemberP1Status;
};

export type CohortSpec = {
  cohortCode: string;
  cohortVersion: string;
  createdAt: string;
  selectionPolicyVersion: string;
  anchorSnapshotIds: string[];
  members: CohortMember[];
  reproHash: string;
  notes: string[];
};

export type EvidenceSignature = {
  signatureVersion: string;
  snapshotFingerprint: string;
  configFingerprint: string;
  pageCountBucket: MetricBucket;
  characterCountBucket: MetricBucket;
  candidateCount: number;
  batchCount: number;
  evidenceUnitCount: number;
  acceptedCandidateCount: number;
  rejectedCandidateCount: number;
  ambiguousCount: number;
  reviewRequiredCount: number;
  evidenceKindCounts: Record<string, number>;
  evidenceKindRatios: Record<string, number>;
  explicitnessCounts: Record<string, number>;
  explicitnessRatios: Record<string, number>;
  evidencePerPageBucket: MetricBucket;
  candidatePerPageBucket: MetricBucket;
  unitsPerAcceptedCandidate: number;
  duplicateCount: number;
  unsupportedSpanCount: number;
  validationFailureCount: number;
  warningCount: number;
};

export type ObservatoryRunMemberResult = {
  memberIndex: number;
  personCvId: number;
  role: CohortMemberRole;
  snapshotId: string | null;
  p0Outcome: MemberP0Status;
  p1Status: MemberP1Status;
  parseStatus: string | null;
  pageCount: number | null;
  characterCount: number | null;
  warningCount: number;
  candidateCount: number;
  batchCount: number;
  evidenceUnitCount: number;
  durationMs: number;
  artifactChecksum: string | null;
  reusedPrototypeId: string | null;
  signature: EvidenceSignature | null;
  reviewSampleIds: string[];
  errorCode: string | null;
};

export type ObservatoryAggregateMetrics = {
  memberCount: number;
  membersCompleted: number;
  membersPartial: number;
  membersFailed: number;
  snapshotsCreated: number;
  snapshotsReused: number;
  totalCandidates: number;
  totalBatches: number;
  totalEvidenceUnits: number;
  totalRetries: number;
  failedBatchCount: number;
  unsupportedSpanCount: number;
  reviewRequiredTotal: number;
  ambiguousTotal: number;
  explicitTotal: number;
  stronglySupportedTotal: number;
  inferredTotal: number;
  evidenceKindTotals: Record<string, number>;
  explicitnessTotals: Record<string, number>;
  totalDurationMs: number;
  tokenUsage: number | null;
  estimatedCost: number | null;
  outlierMemberIndexes: number[];
};

export type ObservatoryReport = {
  reportId: string;
  title: string;
  generatedAt: string;
  gitSafe: true;
  body: Record<string, unknown>;
};

export type ObservatoryRunManifest = {
  observatoryRunId: string;
  operationType: 'OBSERVATORY_PILOT';
  cohortCode: string;
  cohortVersion: string;
  cohortReproHash: string;
  configFingerprint: string;
  frozenConfig: Record<string, string>;
  startedAt: string;
  completedAt: string | null;
  status: ObservatoryRunStatus;
  publisherInvoked: false;
  p2Invoked: false;
  databasePersistence: false;
  dryRunPlanHash: string | null;
  artifactRoot: string;
};

export type ObservatoryRun = {
  manifest: ObservatoryRunManifest;
  memberResults: ObservatoryRunMemberResult[];
  aggregateMetrics: ObservatoryAggregateMetrics;
  reports: ObservatoryReport[];
};

export type CandidatePoolRow = {
  personCvId: number;
  personId: number;
  mimeType: string | null;
  fileSizeBytes: number | null;
  isActive: boolean;
  driveFileIdPresent: boolean;
  existingSnapshotId: string | null;
  existingParseStatus: string | null;
  existingPageCount: number | null;
  existingCharCount: number | null;
  existingWarningsJson: string | null;
  legacySkillCount: number;
  legacyEvidenceCount: number;
  legacyExtractionOk: boolean | null;
};

export type DryRunPlan = {
  planVersion: string;
  createdAt: string;
  cohortSpec: CohortSpec;
  reproHash: string;
  configFingerprint: string;
  mdeOk: boolean;
  anchorsOk: boolean;
  estimatedP1Calls: number;
  estimatedBatches: number;
  estimatedDurationMs: number;
  membersNeedingP0: number[];
  membersWithExistingSnapshot: number[];
  anchorReusePlan: Array<{
    snapshotId: string;
    prototypeId: string | null;
    reusable: boolean;
    reason: string;
  }>;
  blocked: boolean;
  blockReasons: string[];
  notes: string[];
};

export type RunDiffResult = {
  comparable: boolean;
  reason: string;
  configDelta: string[];
  volumeDelta: Record<string, number>;
  shapeDelta: Record<string, number>;
  signatureJaccard: number | null;
  causeHypothesis: string | null;
};
