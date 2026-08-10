import { createHash } from 'node:crypto';
import type {
  PersistBatchInput,
  PersistCandidateInput,
  PersistDecisionInput,
  PersistUnitInput,
} from './p1-persistence.types';
import type { P1CandidateDecision } from '../p1/p1.types';

export type MemoryCandidate = {
  candidateId: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  textHash: string;
  candidateType: string;
  blockType: string | null;
  parentHeadingCandidateId: string | null;
};

export type MemoryDecision = {
  candidateId: string;
  decision: P1CandidateDecision;
  reasonCode: string;
  reviewRequired: boolean;
  batchId: string;
};

export type MemoryUnit = {
  primaryCandidateId: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  spanTextHash: string;
  contentFingerprint: string;
  evidenceKind: string;
  explicitness: 'EXPLICIT' | 'STRONGLY_SUPPORTED' | 'INFERRED';
  decision: P1CandidateDecision;
  reviewGate: 'NOT_REQUIRED' | 'PENDING_REVIEW';
  batchId: string;
  normalizedActivity: string | null;
  object: string | null;
  toolOrMethod: string | null;
  result: string | null;
  scope: string | null;
  temporalContext: string | null;
  /** Provenance compacta — sin texto CV. */
  provenance: Record<string, unknown>;
};

export type MemoryBatch = {
  batchId: string;
  pageRangeStart: number;
  pageRangeEnd: number;
  candidateIds: string[];
};

/** Artefacto P1 en memoria listo para persistir — sin texto CV. */
export type P1MemoryArtifact = {
  snapshotId: string;
  prototypeId: string;
  source: 'ARTIFACT_REUSED' | 'LIVE_RUN';
  artifactDir: string | null;
  candidates: MemoryCandidate[];
  decisions: MemoryDecision[];
  units: MemoryUnit[];
  batches: MemoryBatch[];
  warningCodes: string[];
  metrics: {
    candidateCount: number;
    decisionCount: number;
    accepted: number;
    rejected: number;
    reviewRequired: number;
    unitCount: number;
    batchCount: number;
    unsupportedSpanCount: number;
    explicit: number;
    stronglySupported: number;
    inferred: number;
    evidenceKindTotals: Record<string, number>;
  };
};

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function contentFingerprintOf(unit: {
  explicitness: string;
  evidenceKind: string;
  normalizedActivity: string | null;
  object: string | null;
  toolOrMethod: string | null;
  result: string | null;
}): string {
  const tok = (v: string | null | undefined) =>
    v == null || v === '' ? '∅' : v;
  return sha256Hex(
    [
      unit.explicitness,
      unit.evidenceKind,
      tok(unit.normalizedActivity),
      tok(unit.object),
      tok(unit.toolOrMethod),
      tok(unit.result),
    ].join('|'),
  );
}

export function buildPersistBatchInputs(
  artifact: P1MemoryArtifact,
): PersistBatchInput[] {
  const candById = new Map(artifact.candidates.map((c) => [c.candidateId, c]));
  const decById = new Map(artifact.decisions.map((d) => [d.candidateId, d]));

  return artifact.batches.map((b) => {
    const candidates: PersistCandidateInput[] = b.candidateIds.map((id) => {
      const c = candById.get(id);
      if (!c) {
        throw new Error(`batch ${b.batchId} missing candidate ${id}`);
      }
      return {
        candidateId: c.candidateId,
        pageNumber: c.pageNumber,
        startOffset: c.startOffset,
        endOffset: c.endOffset,
        textHash: c.textHash,
        candidateType: c.candidateType,
        blockType: c.blockType,
        parentHeadingCandidateId: c.parentHeadingCandidateId,
      };
    });

    const decisions: PersistDecisionInput[] = b.candidateIds.map((id) => {
      const d = decById.get(id);
      if (!d) {
        throw new Error(`batch ${b.batchId} missing decision ${id}`);
      }
      return {
        candidateId: d.candidateId,
        decision: d.decision,
        reasonCode: d.reasonCode,
        reviewRequired: d.reviewRequired,
      };
    });

    const units: PersistUnitInput[] = artifact.units
      .filter((u) => u.batchId === b.batchId)
      .map((u) => ({
        primaryCandidateId: u.primaryCandidateId,
        pageNumber: u.pageNumber,
        startOffset: u.startOffset,
        endOffset: u.endOffset,
        spanTextHash: u.spanTextHash,
        evidenceKind: u.evidenceKind,
        explicitness: u.explicitness,
        decision: u.decision,
        reviewGate: u.reviewGate,
        contentFingerprint: u.contentFingerprint,
        normalizedActivity: u.normalizedActivity,
        object: u.object,
        toolOrMethod: u.toolOrMethod,
        result: u.result,
        scope: u.scope,
        temporalContext: u.temporalContext,
        provenance: u.provenance,
        secondaryLinks: [],
      }));

    return {
      batchId: b.batchId,
      pageRangeStart: b.pageRangeStart,
      pageRangeEnd: b.pageRangeEnd,
      candidates,
      decisions,
      units,
      validationStatus: 'OK' as const,
      unsupportedSpanCount: 0,
      forbiddenTaxonomyHitCount: 0,
      rawOutputRef: null,
    };
  });
}

export type EquivalenceReport = {
  identical: boolean;
  rows: Array<{ metric: string; memory: number | string; bd: number | string; diff: number | string }>;
  decisionsMatch: boolean;
  unitsMatch: boolean;
  offsetsMatch: boolean;
  kindsMatch: boolean;
  explicitnessMatch: boolean;
  linksMatch: boolean;
  duplicates: number;
};

export function compareMemoryToDb(args: {
  memory: P1MemoryArtifact;
  bd: {
    candidateCount: number;
    decisionCount: number;
    unitCount: number;
    batchCount: number;
    accepted: number;
    rejected: number;
    reviewRequired: number;
    decisionCoverage: number;
    unsupportedSpanCount: number;
    warningCodes: string[];
    explicit: number;
    stronglySupported: number;
    inferred: number;
    candidates: Array<{
      candidate_id: string;
      start_offset: number;
      end_offset: number;
      text_hash: string;
    }>;
    decisions: Array<{ candidate_id: string; decision: string }>;
    units: Array<{
      primary_candidate_id: string;
      start_offset: number;
      end_offset: number;
      evidence_kind: string;
      explicitness: string;
      span_text_hash: string;
      content_fingerprint: string;
    }>;
    linkCount: number;
  };
}): EquivalenceReport {
  const m = args.memory;
  const b = args.bd;
  const rows: EquivalenceReport['rows'] = [];
  const push = (metric: string, memory: number | string, bd: number | string) => {
    const diff =
      typeof memory === 'number' && typeof bd === 'number' ? bd - memory : memory === bd ? 0 : '≠';
    rows.push({ metric, memory, bd, diff });
  };

  push('candidates', m.metrics.candidateCount, b.candidateCount);
  push('decisions', m.metrics.decisionCount, b.decisionCount);
  push('units', m.metrics.unitCount, b.unitCount);
  push('batches', m.metrics.batchCount, b.batchCount);
  push('accepted', m.metrics.accepted, b.accepted);
  push('rejected', m.metrics.rejected, b.rejected);
  push('reviewRequired', m.metrics.reviewRequired, b.reviewRequired);
  push('unsupportedSpans', m.metrics.unsupportedSpanCount, b.unsupportedSpanCount);
  push('explicit', m.metrics.explicit, b.explicit);
  push('stronglySupported', m.metrics.stronglySupported, b.stronglySupported);
  push('inferred', m.metrics.inferred, b.inferred);
  push(
    'decisionCoverage',
    1,
    Number(Number(b.decisionCoverage).toFixed(5)),
  );
  push(
    'warningCodes',
    JSON.stringify([...m.warningCodes].sort()),
    JSON.stringify([...(b.warningCodes ?? [])].sort()),
  );

  const memDec = new Map(m.decisions.map((d) => [d.candidateId, d.decision]));
  const decisionsMatch =
    b.decisions.length === m.decisions.length &&
    b.decisions.every((d) => memDec.get(d.candidate_id) === d.decision);

  const memCand = new Map(
    m.candidates.map((c) => [
      c.candidateId,
      `${c.startOffset}:${c.endOffset}:${c.textHash}`,
    ]),
  );
  const offsetsMatch =
    b.candidates.length === m.candidates.length &&
    b.candidates.every(
      (c) =>
        memCand.get(c.candidate_id) ===
        `${c.start_offset}:${c.end_offset}:${c.text_hash}`,
    );

  const unitKey = (u: {
    primaryCandidateId?: string;
    primary_candidate_id?: string;
    startOffset?: number;
    start_offset?: number;
    endOffset?: number;
    end_offset?: number;
    evidenceKind?: string;
    evidence_kind?: string;
    contentFingerprint?: string;
    content_fingerprint?: string;
  }) =>
    [
      u.primaryCandidateId ?? u.primary_candidate_id,
      u.startOffset ?? u.start_offset,
      u.endOffset ?? u.end_offset,
      u.evidenceKind ?? u.evidence_kind,
      u.contentFingerprint ?? u.content_fingerprint,
    ].join('|');

  const memUnits = new Set(m.units.map((u) => unitKey(u)));
  const bdUnits = new Set(b.units.map((u) => unitKey(u)));
  const unitsMatch =
    memUnits.size === bdUnits.size &&
    [...memUnits].every((k) => bdUnits.has(k));

  const kindsMatch =
    m.units.every((u) =>
      b.units.some(
        (x) =>
          x.primary_candidate_id === u.primaryCandidateId &&
          x.start_offset === u.startOffset &&
          x.evidence_kind === u.evidenceKind,
      ),
    ) && m.units.length === b.units.length;

  const explicitnessMatch =
    m.units.every((u) =>
      b.units.some(
        (x) =>
          x.primary_candidate_id === u.primaryCandidateId &&
          x.start_offset === u.startOffset &&
          x.explicitness === u.explicitness,
      ),
    ) && m.units.length === b.units.length;

  const linksMatch = b.linkCount === 0;
  const duplicates = b.units.length - bdUnits.size;

  const countRowsOk = rows
    .filter((r) => typeof r.memory === 'number')
    .every((r) => r.diff === 0);
  const identical =
    countRowsOk &&
    decisionsMatch &&
    unitsMatch &&
    offsetsMatch &&
    kindsMatch &&
    explicitnessMatch &&
    linksMatch &&
    duplicates === 0;

  return {
    identical,
    rows,
    decisionsMatch,
    unitsMatch,
    offsetsMatch,
    kindsMatch,
    explicitnessMatch,
    linksMatch,
    duplicates,
  };
}
