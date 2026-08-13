/**
 * Resolución y carga de packs P1 v1.1 para persistencia.
 * Soporta model-output.raw.json completo o sidecar decisions.json
 * (packs Observatory omiten candidateResults por confidencialidad).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ANCHOR_ARTIFACT_DIRS } from '../../mc-observatory/observatory.constants';
import type { P1CandidateDecision } from '../p1/p1.types';
import {
  contentFingerprintOf,
  sha256Hex,
  type MemoryBatch,
  type MemoryCandidate,
  type MemoryDecision,
  type MemoryUnit,
  type P1MemoryArtifact,
} from './p1-memory-artifact';

/** Packs canónicos 6H/6I (directorios bajo tmp/). */
export const COHORT_ARTIFACT_DIRS: Record<
  string,
  { kind: 'prototype' | 'observatory' | 'regenerated'; path: string }
> = {
  '1': {
    kind: 'prototype',
    path: `mc1-p1-prototype/${ANCHOR_ARTIFACT_DIRS['1']}`,
  },
  '2': {
    kind: 'prototype',
    path: `mc1-p1-prototype/${ANCHOR_ARTIFACT_DIRS['2']}`,
  },
  '5': {
    kind: 'observatory',
    path: 'mc1-evidence-observatory/OBS-PILOT5-20260806141136-d2e09292/confidential/member-4',
  },
  '6': {
    kind: 'observatory',
    path: 'mc1-evidence-observatory/OBS-PILOT5-20260806141136-d2e09292/confidential/member-2',
  },
  '7': {
    kind: 'observatory',
    path: 'mc1-evidence-observatory/OBS-PILOT5-20260806141136-d2e09292/confidential/member-3',
  },
};

export const COHORT_6I_SNAPSHOT_IDS = ['2', '6', '7', '5'] as const;
export type Cohort6ISnapshotId = (typeof COHORT_6I_SNAPSHOT_IDS)[number];

export const COHORT_6I_ROLES: Record<Cohort6ISnapshotId, string> = {
  '2': 'ANCHOR',
  '6': 'DIVERSITY',
  '7': 'EDGE',
  '5': 'CONTROL',
};

type RawCandidate = {
  candidateId: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  candidateType: string;
  blockType?: string | null;
  parentHeadingCandidateId?: string | null;
};

type RawUnit = {
  candidateId: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  evidenceKind: string;
  explicitness: 'EXPLICIT' | 'STRONGLY_SUPPORTED' | 'INFERRED';
  decision: P1CandidateDecision;
  reviewRequired?: boolean;
  normalizedActivity?: string | null;
  object?: string | null;
  toolOrMethod?: string | null;
  result?: string | null;
  scope?: string | null;
  temporalContext?: string | null;
  provenance?: {
    batchId?: string;
    prototypeId?: string;
    contractVersion?: string;
    segmenterVersion?: string;
    promptVersion?: string;
    modelVersion?: string;
    origin?: string;
  };
};

type RawModelBatch = {
  batchId: string;
  ok?: boolean;
  output?: {
    candidateResults?: Array<{
      candidateId: string;
      decision: P1CandidateDecision;
      reasonCode?: string | null;
    }>;
  };
};

type DecisionsSidecar = {
  decisions: Array<{
    candidateId: string;
    decision: P1CandidateDecision;
    reasonCode?: string;
    batchId: string;
  }>;
};

export function resolveCohortArtifactDir(
  backendRoot: string,
  snapshotId: string,
): string | null {
  const regenRoot = resolve(backendRoot, 'tmp', 'mc1-p1-prototype');
  if (existsSync(regenRoot)) {
    // Prefer legacy 11D prefix, then any P1P-* pack for this snapshot (e.g. P1P-V12A-S…).
    const preferredPrefix = `P1P-V11-6I-S${snapshotId}-`;
    const anyPrefix = new RegExp(`^P1P-.*-S${snapshotId}-`);
    const dirs = readdirSync(regenRoot)
      .filter((n) => n.startsWith(preferredPrefix) || anyPrefix.test(n))
      .map((n) => join(regenRoot, n))
      .filter((p) => statSync(p).isDirectory())
      .sort();
    // Prefer V11-6I matches last (sort puts them among peers); pick latest overall.
    const preferred = dirs.filter((p) =>
      p.replace(/\\/g, '/').includes(`/${preferredPrefix}`),
    );
    const pool = preferred.length ? preferred : dirs;
    if (pool.length > 0) {
      const latest = pool[pool.length - 1];
      if (packHasDecisions(latest)) return latest;
    }
  }

  const entry = COHORT_ARTIFACT_DIRS[snapshotId];
  if (!entry) return null;
  const dir = resolve(backendRoot, 'tmp', entry.path);
  return existsSync(dir) ? dir : null;
}

export function resolveSnapshot1ArtifactDir(backendRoot: string): string | null {
  return resolveCohortArtifactDir(backendRoot, '1');
}

export function packHasDecisions(dir: string): boolean {
  const sidecar = join(dir, 'decisions.json');
  if (existsSync(sidecar)) {
    const raw = JSON.parse(readFileSync(sidecar, 'utf8')) as DecisionsSidecar;
    return Array.isArray(raw.decisions) && raw.decisions.length > 0;
  }
  const modelPath = join(dir, 'model-output.raw.json');
  if (!existsSync(modelPath)) return false;
  const model = JSON.parse(readFileSync(modelPath, 'utf8')) as {
    batches?: RawModelBatch[];
  };
  return (model.batches ?? []).some(
    (b) => (b.output?.candidateResults?.length ?? 0) > 0,
  );
}

function loadDecisions(
  dir: string,
  batches: Array<{ batchId: string; candidateIds: string[] }>,
): MemoryDecision[] {
  const sidecarPath = join(dir, 'decisions.json');
  if (existsSync(sidecarPath)) {
    const raw = JSON.parse(readFileSync(sidecarPath, 'utf8')) as DecisionsSidecar;
    return raw.decisions.map((d) => ({
      candidateId: d.candidateId,
      decision: d.decision,
      reasonCode:
        d.reasonCode ??
        (d.decision === 'REVIEW_REQUIRED' ? 'NEEDS_REVIEW' : 'OK'),
      reviewRequired: d.decision === 'REVIEW_REQUIRED',
      batchId: d.batchId,
    }));
  }

  const modelFile = JSON.parse(
    readFileSync(join(dir, 'model-output.raw.json'), 'utf8'),
  ) as { batches: RawModelBatch[] };
  const decisions: MemoryDecision[] = [];
  for (const mb of modelFile.batches) {
    for (const r of mb.output?.candidateResults ?? []) {
      decisions.push({
        candidateId: r.candidateId,
        decision: r.decision,
        reasonCode:
          r.reasonCode ??
          (r.decision === 'REVIEW_REQUIRED' ? 'NEEDS_REVIEW' : 'OK'),
        reviewRequired: r.decision === 'REVIEW_REQUIRED',
        batchId: mb.batchId,
      });
    }
  }
  if (decisions.length === 0) {
    throw new Error(
      `pack lacks decisions (model-output stripped); regenerate with decisions.json: ${dir}`,
    );
  }
  void batches;
  return decisions;
}

export function loadP1MemoryArtifactFromPack(args: {
  artifactDir: string;
  snapshotId: string;
  normalizedText: string;
}): P1MemoryArtifact {
  const dir = args.artifactDir;
  const candidatesFile = JSON.parse(
    readFileSync(join(dir, 'candidates.json'), 'utf8'),
  ) as { candidates: RawCandidate[] };
  const batchesFile = JSON.parse(
    readFileSync(join(dir, 'batches.json'), 'utf8'),
  ) as {
    batchCount: number;
    batches: Array<{
      batchId: string;
      candidateIds: string[];
      pageRange: [number, number];
    }>;
  };
  const validatedFile = JSON.parse(
    readFileSync(join(dir, 'validated-evidence.json'), 'utf8'),
  ) as { units: RawUnit[] };
  const manifest = JSON.parse(
    readFileSync(join(dir, 'prototype-manifest.json'), 'utf8'),
  ) as { prototypeId: string; snapshotId: string };

  if (String(manifest.snapshotId) !== String(args.snapshotId)) {
    throw new Error('artifact snapshotId mismatch');
  }

  const text = args.normalizedText;
  const candidates: MemoryCandidate[] = candidatesFile.candidates.map((c) => {
    const slice = text.slice(c.startOffset, c.endOffset);
    return {
      candidateId: c.candidateId,
      pageNumber: c.pageNumber,
      startOffset: c.startOffset,
      endOffset: c.endOffset,
      textHash: sha256Hex(slice),
      candidateType: c.candidateType,
      blockType: c.blockType ?? null,
      parentHeadingCandidateId: c.parentHeadingCandidateId ?? null,
    };
  });

  const decisions = loadDecisions(dir, batchesFile.batches);
  if (decisions.length !== candidates.length) {
    throw new Error(
      `decision/candidate mismatch: ${decisions.length} vs ${candidates.length}`,
    );
  }

  const units: MemoryUnit[] = validatedFile.units.map((u) => {
    const slice = text.slice(u.startOffset, u.endOffset);
    const reviewGate =
      u.reviewRequired || u.explicitness === 'INFERRED'
        ? 'PENDING_REVIEW'
        : 'NOT_REQUIRED';
    const batchId = u.provenance?.batchId;
    if (!batchId) {
      throw new Error(`unit missing provenance.batchId for ${u.candidateId}`);
    }
    return {
      primaryCandidateId: u.candidateId,
      pageNumber: u.pageNumber,
      startOffset: u.startOffset,
      endOffset: u.endOffset,
      spanTextHash: sha256Hex(slice),
      contentFingerprint: contentFingerprintOf({
        explicitness: u.explicitness,
        evidenceKind: u.evidenceKind,
        normalizedActivity: u.normalizedActivity ?? null,
        object: u.object ?? null,
        toolOrMethod: u.toolOrMethod ?? null,
        result: u.result ?? null,
      }),
      evidenceKind: u.evidenceKind,
      explicitness: u.explicitness,
      decision: u.decision,
      reviewGate,
      batchId,
      normalizedActivity: u.normalizedActivity ?? null,
      object: u.object ?? null,
      toolOrMethod: u.toolOrMethod ?? null,
      result: u.result ?? null,
      scope: u.scope ?? null,
      temporalContext: u.temporalContext ?? null,
      provenance: {
        batchId,
        prototypeId: u.provenance?.prototypeId ?? manifest.prototypeId,
        contractVersion: u.provenance?.contractVersion,
        segmenterVersion: u.provenance?.segmenterVersion,
        promptVersion: u.provenance?.promptVersion,
        modelVersion: u.provenance?.modelVersion,
        origin: u.provenance?.origin ?? 'ARTIFACT_REUSED',
      },
    };
  });

  const batches: MemoryBatch[] = batchesFile.batches.map((b) => ({
    batchId: b.batchId,
    pageRangeStart: b.pageRange[0],
    pageRangeEnd: b.pageRange[1],
    candidateIds: b.candidateIds,
  }));

  let accepted = 0;
  let rejected = 0;
  let reviewRequired = 0;
  for (const d of decisions) {
    if (d.decision === 'ACCEPTED') accepted += 1;
    else if (d.decision === 'REVIEW_REQUIRED') reviewRequired += 1;
    else rejected += 1;
  }

  let explicit = 0;
  let stronglySupported = 0;
  let inferred = 0;
  const evidenceKindTotals: Record<string, number> = {};
  for (const u of units) {
    if (u.explicitness === 'EXPLICIT') explicit += 1;
    else if (u.explicitness === 'STRONGLY_SUPPORTED') stronglySupported += 1;
    else inferred += 1;
    evidenceKindTotals[u.evidenceKind] =
      (evidenceKindTotals[u.evidenceKind] ?? 0) + 1;
  }

  return {
    snapshotId: String(args.snapshotId),
    prototypeId: manifest.prototypeId,
    source: 'ARTIFACT_REUSED',
    artifactDir: dir,
    candidates,
    decisions,
    units,
    batches,
    warningCodes: [],
    metrics: {
      candidateCount: candidates.length,
      decisionCount: decisions.length,
      accepted,
      rejected,
      reviewRequired,
      unitCount: units.length,
      batchCount: batches.length,
      unsupportedSpanCount: 0,
      explicit,
      stronglySupported,
      inferred,
      evidenceKindTotals,
    },
  };
}
