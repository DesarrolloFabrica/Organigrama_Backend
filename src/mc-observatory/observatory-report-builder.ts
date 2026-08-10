/**
 * ObservatoryReportBuilder — reportes R1–R8 Git-safe (sin PII/texto).
 */
import type {
  CohortSpec,
  EvidenceSignature,
  ObservatoryAggregateMetrics,
  ObservatoryReport,
  ObservatoryRunMemberResult,
} from './observatory.types';

function topKinds(
  totals: Record<string, number>,
  n = 5,
): Array<{ kind: string; count: number }> {
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([kind, count]) => ({ kind, count }));
}

export function detectOutliers(
  members: ObservatoryRunMemberResult[],
): number[] {
  const completed = members.filter((m) => m.signature);
  if (completed.length < 3) return [];
  const units = completed.map((m) => m.evidenceUnitCount);
  const mean = units.reduce((a, b) => a + b, 0) / units.length;
  const variance =
    units.reduce((a, b) => a + (b - mean) ** 2, 0) / units.length;
  const std = Math.sqrt(variance) || 1;
  const outliers: number[] = [];
  for (const m of completed) {
    const z = Math.abs(m.evidenceUnitCount - mean) / std;
    const reviewHeavy =
      (m.signature?.reviewRequiredCount ?? 0) >
      Math.max(3, (m.evidenceUnitCount || 1) * 0.25);
    const spanFail = (m.signature?.unsupportedSpanCount ?? 0) > 0;
    if (z >= 1.5 || reviewHeavy || spanFail) outliers.push(m.memberIndex);
  }
  return outliers.sort((a, b) => a - b);
}

export function buildAggregateMetrics(
  members: ObservatoryRunMemberResult[],
  totalDurationMs: number,
  totalRetries: number,
  failedBatchCount: number,
  tokenUsage: number | null,
): ObservatoryAggregateMetrics {
  const kindTotals: Record<string, number> = {};
  const explTotals: Record<string, number> = {
    EXPLICIT: 0,
    STRONGLY_SUPPORTED: 0,
    INFERRED: 0,
  };
  let units = 0;
  let candidates = 0;
  let batches = 0;
  let spans = 0;
  let review = 0;
  let ambiguous = 0;
  let created = 0;
  let reused = 0;
  let completed = 0;
  let partial = 0;
  let failed = 0;

  for (const m of members) {
    candidates += m.candidateCount;
    batches += m.batchCount;
    units += m.evidenceUnitCount;
    if (m.p0Outcome === 'CREATED') created += 1;
    if (m.p0Outcome === 'REUSED') reused += 1;
    if (m.p1Status === 'COMPLETED' || m.p1Status === 'REUSED_ARTIFACT')
      completed += 1;
    else if (m.p1Status === 'PARTIAL') partial += 1;
    else if (m.p1Status === 'FAILED' || m.p1Status === 'BLOCKED_BAD_SNAPSHOT')
      failed += 1;
    const sig = m.signature;
    if (!sig) continue;
    spans += sig.unsupportedSpanCount;
    review += sig.reviewRequiredCount;
    ambiguous += sig.ambiguousCount;
    for (const [k, v] of Object.entries(sig.evidenceKindCounts)) {
      kindTotals[k] = (kindTotals[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(sig.explicitnessCounts)) {
      explTotals[k] = (explTotals[k] ?? 0) + v;
    }
  }

  const outliers = detectOutliers(members);

  return {
    memberCount: members.length,
    membersCompleted: completed,
    membersPartial: partial,
    membersFailed: failed,
    snapshotsCreated: created,
    snapshotsReused: reused,
    totalCandidates: candidates,
    totalBatches: batches,
    totalEvidenceUnits: units,
    totalRetries,
    failedBatchCount,
    unsupportedSpanCount: spans,
    reviewRequiredTotal: review,
    ambiguousTotal: ambiguous,
    explicitTotal: explTotals.EXPLICIT ?? 0,
    stronglySupportedTotal: explTotals.STRONGLY_SUPPORTED ?? 0,
    inferredTotal: explTotals.INFERRED ?? 0,
    evidenceKindTotals: kindTotals,
    explicitnessTotals: explTotals,
    totalDurationMs,
    tokenUsage,
    estimatedCost: null,
    outlierMemberIndexes: outliers,
  };
}

export class ObservatoryReportBuilder {
  buildAll(params: {
    cohort: CohortSpec;
    members: ObservatoryRunMemberResult[];
    aggregates: ObservatoryAggregateMetrics;
    signatures: EvidenceSignature[];
    durationPerMember: Record<string, number>;
  }): ObservatoryReport[] {
    const now = new Date().toISOString();
    const byRole: Record<string, number> = {};
    for (const m of params.cohort.members) {
      byRole[m.role] = (byRole[m.role] ?? 0) + 1;
    }

    const r1: ObservatoryReport = {
      reportId: 'R1',
      title: 'Cohort Overview',
      generatedAt: now,
      gitSafe: true,
      body: {
        membersByRole: byRole,
        snapshotsCreated: params.aggregates.snapshotsCreated,
        snapshotsReused: params.aggregates.snapshotsReused,
        totalPages: params.members.reduce((a, m) => a + (m.pageCount ?? 0), 0),
        totalCandidates: params.aggregates.totalCandidates,
        totalBatches: params.aggregates.totalBatches,
        durationMs: params.aggregates.totalDurationMs,
        durationPerMember: params.durationPerMember,
      },
    };

    const r2: ObservatoryReport = {
      reportId: 'R2',
      title: 'Evidence Kind Distribution',
      generatedAt: now,
      gitSafe: true,
      body: {
        cohortTotals: params.aggregates.evidenceKindTotals,
        top: topKinds(params.aggregates.evidenceKindTotals),
        perMember: params.members.map((m) => ({
          memberIndex: m.memberIndex,
          role: m.role,
          counts: m.signature?.evidenceKindCounts ?? {},
          ratios: m.signature?.evidenceKindRatios ?? {},
        })),
      },
    };

    const r3: ObservatoryReport = {
      reportId: 'R3',
      title: 'Explicitness Distribution',
      generatedAt: now,
      gitSafe: true,
      body: {
        EXPLICIT: params.aggregates.explicitTotal,
        STRONGLY_SUPPORTED: params.aggregates.stronglySupportedTotal,
        INFERRED: params.aggregates.inferredTotal,
        perMember: params.members.map((m) => ({
          memberIndex: m.memberIndex,
          counts: m.signature?.explicitnessCounts ?? {},
        })),
      },
    };

    const r4: ObservatoryReport = {
      reportId: 'R4',
      title: 'Processing Shape',
      generatedAt: now,
      gitSafe: true,
      body: {
        perMember: params.members.map((m) => ({
          memberIndex: m.memberIndex,
          pageCount: m.pageCount,
          candidates: m.candidateCount,
          units: m.evidenceUnitCount,
          unitsPerAccepted: m.signature?.unitsPerAcceptedCandidate ?? null,
          candidatePerPageBucket: m.signature?.candidatePerPageBucket ?? null,
          evidencePerPageBucket: m.signature?.evidencePerPageBucket ?? null,
        })),
      },
    };

    const r5: ObservatoryReport = {
      reportId: 'R5',
      title: 'Validation Health',
      generatedAt: now,
      gitSafe: true,
      body: {
        unsupportedSpans: params.aggregates.unsupportedSpanCount,
        failedBatches: params.aggregates.failedBatchCount,
        retries: params.aggregates.totalRetries,
        validationFailures: params.members.reduce(
          (a, m) => a + (m.signature?.validationFailureCount ?? 0),
          0,
        ),
        perMember: params.members.map((m) => ({
          memberIndex: m.memberIndex,
          unsupportedSpanCount: m.signature?.unsupportedSpanCount ?? 0,
          validationFailureCount: m.signature?.validationFailureCount ?? 0,
          errorCode: m.errorCode,
        })),
      },
    };

    const r6: ObservatoryReport = {
      reportId: 'R6',
      title: 'Review Landscape',
      generatedAt: now,
      gitSafe: true,
      body: {
        ambiguousTotal: params.aggregates.ambiguousTotal,
        reviewRequiredTotal: params.aggregates.reviewRequiredTotal,
        warningTotal: params.members.reduce((a, m) => a + m.warningCount, 0),
        reviewSampleRefCounts: params.members.map((m) => ({
          memberIndex: m.memberIndex,
          sampleIdCount: m.reviewSampleIds.length,
        })),
      },
    };

    const r7: ObservatoryReport = {
      reportId: 'R7',
      title: 'Outlier Candidates',
      generatedAt: now,
      gitSafe: true,
      body: {
        outlierMemberIndexes: params.aggregates.outlierMemberIndexes,
        rules: [
          'abs(z-score evidenceUnitCount) >= 1.5',
          'reviewRequired > max(3, 25% of units)',
          'unsupportedSpanCount > 0',
        ],
      },
    };

    const r8: ObservatoryReport = {
      reportId: 'R8',
      title: 'Pilot Summary',
      generatedAt: now,
      gitSafe: true,
      body: {
        findings: [
          'Cohort of five processed under frozen P1 v1.1 config',
          'Signatures and aggregate reports produced without PII',
          'No productive persistence / P2 / Publisher',
        ],
        limitations: [
          'No full human review of all evidence units',
          'Legacy signals used only for selection diversity',
          'Token cost not estimated without verified tariff',
        ],
        readiness: 'READY_FOR_OBSERVATORY_PILOT_REVIEW',
        latencyMs: params.aggregates.totalDurationMs,
        tokenUsage: params.aggregates.tokenUsage,
        membersCompleted: params.aggregates.membersCompleted,
        membersPartial: params.aggregates.membersPartial,
        signatureCount: params.signatures.length,
      },
    };

    return [r1, r2, r3, r4, r5, r6, r7, r8];
  }
}
