/**
 * Reutilización verificable de artefactos P1 de anchors (v1.1 congelado).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ANCHOR_ARTIFACT_DIRS, FROZEN_P1_CONFIG } from './observatory.constants';
import type { ValidatedEvidenceUnit } from '../mc-pipeline/p1/p1-batch-output-validator';
import type { P1CandidateDecision } from '../mc-pipeline/p1/p1.types';

export type AnchorReuseResult = {
  reusable: boolean;
  reason: string;
  prototypeId: string | null;
  artifactDir: string | null;
  checksum: string | null;
  units: ValidatedEvidenceUnit[];
  decisions: Map<string, P1CandidateDecision>;
  candidateCount: number;
  batchCount: number;
  unsupportedSpanCount: number;
  warningCount: number;
  pageCount: number | null;
  characterCount: number | null;
};

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function dirChecksum(dir: string): string {
  const files = readdirSync(dir)
    .filter((n) => statSync(join(dir, n)).isFile())
    .sort();
  const h = createHash('sha256');
  for (const f of files) {
    h.update(f);
    h.update(sha256File(join(dir, f)));
  }
  return h.digest('hex');
}

export function resolveAnchorArtifactDir(
  backendRoot: string,
  snapshotId: string,
): string | null {
  const name = ANCHOR_ARTIFACT_DIRS[snapshotId];
  if (!name) return null;
  const dir = resolve(backendRoot, 'tmp', 'mc1-p1-prototype', name);
  return existsSync(dir) ? dir : null;
}

export function tryReuseAnchorArtifact(
  backendRoot: string,
  snapshotId: string,
): AnchorReuseResult {
  const dir = resolveAnchorArtifactDir(backendRoot, snapshotId);
  if (!dir) {
    return {
      reusable: false,
      reason: 'ARTIFACT_DIR_MISSING',
      prototypeId: null,
      artifactDir: null,
      checksum: null,
      units: [],
      decisions: new Map(),
      candidateCount: 0,
      batchCount: 0,
      unsupportedSpanCount: 0,
      warningCount: 0,
      pageCount: null,
      characterCount: null,
    };
  }

  const manifestPath = join(dir, 'prototype-manifest.json');
  const summaryPath = join(dir, 'execution-summary.json');
  const validatedPath = join(dir, 'validated-evidence.json');
  const coveragePath = join(dir, 'coverage.json');
  const batchesPath = join(dir, 'batches.json');

  if (!existsSync(manifestPath) || !existsSync(validatedPath)) {
    return {
      reusable: false,
      reason: 'ARTIFACT_INCOMPLETE',
      prototypeId: null,
      artifactDir: dir,
      checksum: null,
      units: [],
      decisions: new Map(),
      candidateCount: 0,
      batchCount: 0,
      unsupportedSpanCount: 0,
      warningCount: 0,
      pageCount: null,
      characterCount: null,
    };
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    prototypeId?: string;
    snapshotId?: string;
    contractVersion?: string;
    segmenterVersion?: string;
    promptVersion?: string;
    modelVersion?: string;
  };
  const summary = existsSync(summaryPath)
    ? (JSON.parse(readFileSync(summaryPath, 'utf8')) as {
        model?: string;
        candidates?: number;
        batches?: number;
        ia?: { reviewRequired?: number };
        validation?: { unsupportedSpans?: number };
      })
    : {};

  const model =
    manifest.modelVersion || summary.model || '';
  const okVersions =
    manifest.segmenterVersion === FROZEN_P1_CONFIG.segmenterVersion &&
    manifest.promptVersion === FROZEN_P1_CONFIG.promptVersion &&
    manifest.contractVersion === FROZEN_P1_CONFIG.contractVersion &&
    model === FROZEN_P1_CONFIG.modelVersion &&
    String(manifest.snapshotId) === String(snapshotId);

  if (!okVersions) {
    return {
      reusable: false,
      reason: 'VERSION_MISMATCH',
      prototypeId: manifest.prototypeId ?? null,
      artifactDir: dir,
      checksum: dirChecksum(dir),
      units: [],
      decisions: new Map(),
      candidateCount: 0,
      batchCount: 0,
      unsupportedSpanCount: 0,
      warningCount: 0,
      pageCount: null,
      characterCount: null,
    };
  }

  const validated = JSON.parse(readFileSync(validatedPath, 'utf8')) as {
    units: ValidatedEvidenceUnit[];
  };
  const coverage = existsSync(coveragePath)
    ? (JSON.parse(readFileSync(coveragePath, 'utf8')) as {
        decisionCounts?: Record<string, number>;
        unsupportedSpanCount?: number;
      })
    : {};
  const batches = existsSync(batchesPath)
    ? (JSON.parse(readFileSync(batchesPath, 'utf8')) as { batchCount?: number })
    : {};

  const decisions = new Map<string, P1CandidateDecision>();
  // Reconstruct approximate decisions from units + coverage counts is imperfect;
  // mark each unit's candidate as ACCEPTED; remaining inferred from coverage.
  for (const u of validated.units) {
    decisions.set(u.candidateId, u.decision);
  }

  return {
    reusable: true,
    reason: 'VERSION_MATCH',
    prototypeId: manifest.prototypeId ?? null,
    artifactDir: dir,
    checksum: dirChecksum(dir),
    units: validated.units,
    decisions,
    candidateCount: summary.candidates ?? decisions.size,
    batchCount: summary.batches ?? batches.batchCount ?? 0,
    unsupportedSpanCount:
      summary.validation?.unsupportedSpans ?? coverage.unsupportedSpanCount ?? 0,
    warningCount: 0,
    pageCount: null,
    characterCount: null,
  };
}
