/**
 * CohortSpecBuilder — selección determinística de cohorte piloto (5 miembros).
 * Solo señales documentales / P0 / legacy agregadas. Sin cargo/área/dominio.
 */
import {
  ANCHOR_SNAPSHOT_IDS,
  COHORT_CODE,
  COHORT_VERSION,
  MAX_COHORT_MEMBERS,
  SELECTION_POLICY_VERSION,
} from './observatory.constants';
import { hashObject } from './hash';
import type {
  CandidatePoolRow,
  CohortMember,
  CohortSpec,
  SelectionMetrics,
} from './observatory.types';

export type AnchorInfo = {
  snapshotId: string;
  personCvId: number;
  parseStatus: string;
  pageCount: number;
  characterCount: number;
  warningCount: number;
  headingCountEstimated: number;
  candidateCountEstimated: number;
  lineDensity: number;
  listDensity: number;
  meanCandidateLength: number;
};

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function computeSelectionMetrics(
  row: CandidatePoolRow,
  estimates?: Partial<SelectionMetrics>,
): SelectionMetrics {
  const pageCount = estimates?.pageCount ?? row.existingPageCount;
  const chars = estimates?.normalizedCharacterCount ?? row.existingCharCount;
  const heading = estimates?.headingCountEstimated ?? null;
  const candidates = estimates?.candidateCountEstimated ?? null;
  const lineDensity = estimates?.lineDensity ?? null;
  const listDensity = estimates?.listDensity ?? null;
  const meanCand = estimates?.meanCandidateLength ?? null;
  const warningCount = estimates?.warningCount ?? null;

  const sizeNorm = clamp01((row.fileSizeBytes ?? 0) / 500_000);
  // Scores de ranking SOLO con señales estables (no dependen de snapshot P0),
  // para que createOrReuse no altere la cohorte entre dry-run y execute.
  const skillNorm = clamp01(row.legacySkillCount / 40);
  const evNorm = clamp01(row.legacyEvidenceCount / 80);
  const idNorm = clamp01((row.personCvId % 100) / 100);

  const diversityScore =
    Math.abs(sizeNorm - 0.2) * 0.35 +
    Math.abs(skillNorm - 0.25) * 0.25 +
    Math.abs(evNorm - 0.25) * 0.2 +
    Math.abs(idNorm - 0.5) * 0.2;

  const edgeScore =
    sizeNorm * 0.45 +
    skillNorm * 0.25 +
    evNorm * 0.2 +
    idNorm * 0.1;

  return {
    pageCount,
    normalizedCharacterCount: chars,
    headingCountEstimated: heading,
    candidateCountEstimated: candidates,
    lineDensity,
    listDensity,
    meanCandidateLength: meanCand,
    warningCount,
    hasPriorSnapshot: Boolean(row.existingSnapshotId),
    legacySkillCount: row.legacySkillCount,
    legacyEvidenceCount: row.legacyEvidenceCount,
    legacyExtractionOk: row.legacyExtractionOk,
    fileSizeBytes: row.fileSizeBytes,
    diversityScore: Number(diversityScore.toFixed(6)),
    edgeScore: Number(edgeScore.toFixed(6)),
  };
}

export function isEligibleCandidate(
  row: CandidatePoolRow,
  excludedPersonIds: Set<number>,
  excludedPersonCvIds: Set<number>,
): { ok: boolean; reason: string } {
  if (!row.isActive) return { ok: false, reason: 'INACTIVE' };
  if (excludedPersonCvIds.has(row.personCvId))
    return { ok: false, reason: 'PERSON_CV_EXCLUDED' };
  if (excludedPersonIds.has(row.personId))
    return { ok: false, reason: 'PERSON_ALREADY_REPRESENTED' };
  const mime = (row.mimeType ?? '').toLowerCase();
  if (mime && !mime.includes('pdf')) return { ok: false, reason: 'NOT_PDF' };
  if (!row.driveFileIdPresent) return { ok: false, reason: 'DRIVE_MISSING' };
  if (
    row.existingParseStatus &&
    ['FAILED', 'EMPTY_DOCUMENT', 'SCANNED_OR_IMAGE_ONLY', 'UNSUPPORTED_FORMAT'].includes(
      row.existingParseStatus,
    )
  ) {
    return { ok: false, reason: `SNAPSHOT_${row.existingParseStatus}` };
  }
  return { ok: true, reason: 'OK' };
}

export function computeReproHash(input: {
  cohortCode: string;
  cohortVersion: string;
  selectionPolicyVersion: string;
  members: Array<{
    personCvId: number;
    snapshotId: string | null;
    role: string;
    selectionReasonCode: string;
  }>;
}): string {
  return hashObject({
    cohortCode: input.cohortCode,
    cohortVersion: input.cohortVersion,
    selectionPolicyVersion: input.selectionPolicyVersion,
    members: [...input.members].sort((a, b) => a.personCvId - b.personCvId),
  });
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Selección determinística:
 * 1. ANCHOR snapshot 1 y 2
 * 2. DIVERSITY — máximo diversityScore entre elegibles
 * 3. EDGE — máximo edgeScore entre restantes
 * 4. CONTROL — más cercano a la mediana de fileSizeBytes entre restantes
 */
export class CohortSpecBuilder {
  build(params: {
    anchors: AnchorInfo[];
    pool: CandidatePoolRow[];
    createdAt?: string;
    estimatesByPersonCvId?: Map<number, Partial<SelectionMetrics>>;
  }): CohortSpec {
    const createdAt = params.createdAt ?? new Date().toISOString();
    const estimates = params.estimatesByPersonCvId ?? new Map();

    if (params.anchors.length !== 2) {
      throw new Error('ANCHORS_REQUIRED_TWO');
    }
    const anchorIds = params.anchors.map((a) => a.snapshotId).sort();
    if (
      anchorIds[0] !== ANCHOR_SNAPSHOT_IDS[0] ||
      anchorIds[1] !== ANCHOR_SNAPSHOT_IDS[1]
    ) {
      throw new Error('ANCHOR_SNAPSHOT_IDS_MISMATCH');
    }

    const excludedPersonIds = new Set(params.anchors.map((a) => {
      const row = params.pool.find((p) => p.personCvId === a.personCvId);
      return row?.personId ?? -1;
    }));
    const excludedPersonCvIds = new Set(params.anchors.map((a) => a.personCvId));

    const members: CohortMember[] = params.anchors
      .sort((a, b) => Number(a.snapshotId) - Number(b.snapshotId))
      .map((a, idx) => {
        const row = params.pool.find((p) => p.personCvId === a.personCvId) ?? {
          personCvId: a.personCvId,
          personId: -1,
          mimeType: 'application/pdf',
          fileSizeBytes: null,
          isActive: true,
          driveFileIdPresent: true,
          existingSnapshotId: a.snapshotId,
          existingParseStatus: a.parseStatus,
          existingPageCount: a.pageCount,
          existingCharCount: a.characterCount,
          existingWarningsJson: null,
          legacySkillCount: 0,
          legacyEvidenceCount: 0,
          legacyExtractionOk: null,
        };
        const metrics = computeSelectionMetrics(row, {
          pageCount: a.pageCount,
          normalizedCharacterCount: a.characterCount,
          headingCountEstimated: a.headingCountEstimated,
          candidateCountEstimated: a.candidateCountEstimated,
          lineDensity: a.lineDensity,
          listDensity: a.listDensity,
          meanCandidateLength: a.meanCandidateLength,
          warningCount: a.warningCount,
        });
        return {
          memberIndex: idx,
          snapshotId: a.snapshotId,
          personCvId: a.personCvId,
          role: 'ANCHOR' as const,
          selectionReasonCode: `ANCHOR_SNAPSHOT_${a.snapshotId}`,
          selectionMetrics: metrics,
          snapshotStatus: a.parseStatus,
          p0Status: 'REUSED' as const,
          p1Status: 'PENDING' as const,
        };
      });

    type Scored = { row: CandidatePoolRow; metrics: SelectionMetrics };
    const eligible: Scored[] = [];
    for (const row of params.pool) {
      const elig = isEligibleCandidate(row, excludedPersonIds, excludedPersonCvIds);
      if (!elig.ok) continue;
      // no re-seleccionar snapshots ancla como adicionales
      if (
        row.existingSnapshotId &&
        (ANCHOR_SNAPSHOT_IDS as readonly string[]).includes(row.existingSnapshotId)
      ) {
        continue;
      }
      const metrics = computeSelectionMetrics(
        row,
        estimates.get(row.personCvId),
      );
      eligible.push({ row, metrics });
    }

    // orden estable: personCvId asc como tie-break
    eligible.sort((a, b) => a.row.personCvId - b.row.personCvId);

    const pick = (scoreFn: (s: Scored) => number, reason: string, role: CohortMember['role']) => {
      if (eligible.length === 0) throw new Error('INSUFFICIENT_ELIGIBLE_CANDIDATES');
      let best = eligible[0];
      let bestScore = scoreFn(best);
      for (let i = 1; i < eligible.length; i++) {
        const s = scoreFn(eligible[i]);
        if (s > bestScore + 1e-12) {
          best = eligible[i];
          bestScore = s;
        } else if (Math.abs(s - bestScore) <= 1e-12) {
          // tie → menor personCvId (ya ordenado; mantener el actual si personCvId menor)
          if (eligible[i].row.personCvId < best.row.personCvId) {
            best = eligible[i];
            bestScore = s;
          }
        }
      }
      const idx = eligible.indexOf(best);
      eligible.splice(idx, 1);
      excludedPersonIds.add(best.row.personId);
      excludedPersonCvIds.add(best.row.personCvId);
      members.push({
        memberIndex: members.length,
        snapshotId: best.row.existingSnapshotId,
        personCvId: best.row.personCvId,
        role,
        selectionReasonCode: reason,
        selectionMetrics: best.metrics,
        snapshotStatus: best.row.existingParseStatus,
        p0Status: best.row.existingSnapshotId ? 'REUSED' : 'PENDING',
        p1Status: 'PENDING',
      });
    };

    pick((s) => s.metrics.diversityScore, 'MAX_DIVERSITY_SCORE', 'DIVERSITY');
    pick((s) => s.metrics.edgeScore, 'MAX_EDGE_SCORE', 'EDGE');

    // CONTROL: cercano a mediana de fileSizeBytes
    const sizes = eligible
      .map((e) => e.row.fileSizeBytes ?? 0)
      .filter((n) => n > 0);
    const med = median(sizes.length ? sizes : eligible.map((e) => e.row.personCvId));
    pick(
      (s) => {
        const size = s.row.fileSizeBytes ?? s.row.personCvId;
        return -Math.abs(size - med);
      },
      'NEAR_MEDIAN_FILE_SIZE',
      'CONTROL',
    );

    if (members.length !== MAX_COHORT_MEMBERS) {
      throw new Error('COHORT_BUILD_SIZE_ERROR');
    }

    // reindex estable por rol orden: ANCHOR, ANCHOR, DIVERSITY, EDGE, CONTROL
    const roleOrder: Record<string, number> = {
      ANCHOR: 0,
      DIVERSITY: 1,
      EDGE: 2,
      CONTROL: 3,
    };
    members.sort((a, b) => {
      const ro = roleOrder[a.role] - roleOrder[b.role];
      if (ro !== 0) return ro;
      return a.personCvId - b.personCvId;
    });
    members.forEach((m, i) => {
      m.memberIndex = i;
    });

    const reproHash = computeReproHash({
      cohortCode: COHORT_CODE,
      cohortVersion: COHORT_VERSION,
      selectionPolicyVersion: SELECTION_POLICY_VERSION,
      members: members.map((m) => ({
        personCvId: m.personCvId,
        snapshotId: m.snapshotId,
        role: m.role,
        selectionReasonCode: m.selectionReasonCode,
      })),
    });

    return {
      cohortCode: COHORT_CODE,
      cohortVersion: COHORT_VERSION,
      createdAt,
      selectionPolicyVersion: SELECTION_POLICY_VERSION,
      anchorSnapshotIds: [...ANCHOR_SNAPSHOT_IDS],
      members,
      reproHash,
      notes: [
        'Pilot cohort of exactly five members',
        'Selection uses documentary/P0/legacy aggregate signals only',
        'No cargo/area/hierarchy/domain used',
      ],
    };
  }
}
