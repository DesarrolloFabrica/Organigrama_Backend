/**
 * Ejecutor P1 para un miembro del Observatory — reutiliza APIs públicas P1.
 * Concurrencia 1 · máx 2 retries técnicos por lote · sin persistencia BD.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { DeterministicEvidenceCandidateSegmenter } from '../mc-pipeline/p1/deterministic-evidence-candidate-segmenter';
import { P1EvidenceBatchBuilder } from '../mc-pipeline/p1/p1-evidence-batch-builder';
import {
  buildP1PrototypeSystemPrompt,
  buildP1PrototypeUserPayload,
} from '../mc-pipeline/p1/p1-prototype-prompt';
import { validateP1BatchOutput } from '../mc-pipeline/p1/p1-batch-output-validator';
import { callP1GeminiJson } from '../mc-pipeline/p1/p1-gemini-client';
import {
  P1_CONTRACT_VERSION,
  P1_PROMPT_VERSION,
  P1_SEGMENTER_NAME,
  P1_SEGMENTER_VERSION,
  type EvidenceCandidate,
  type P1CandidateDecision,
} from '../mc-pipeline/p1/p1.types';
import type { ValidatedEvidenceUnit } from '../mc-pipeline/p1/p1-batch-output-validator';
import {
  BATCH_BUILDER_VERSION,
  VALIDATOR_VERSION,
} from './observatory.constants';
import {
  computeP1ReuseFingerprint,
  findReusableP1Pack,
  hashSnapshotContent,
  recordGeminiReuse,
  resolveForceRecompute,
} from '../mc-pipeline/gemini';
import type { Mc1ThinkingConfig } from '../mc-pipeline/gemini/gemini-thinking-config';
import { serializeThinkingConfig } from '../mc-pipeline/gemini/gemini-thinking-config';

export type P1PhaseStatus = 'EXECUTED' | 'REUSED' | 'FAILED';

export type P1MemberRunInput = {
  prototypeId: string;
  snapshotId: string;
  normalizedText: string;
  pages: unknown;
  sectionedContent: unknown;
  apiKey: string;
  model: string;
  outDir: string;
  maxTechnicalRetries?: number;
  personId?: string;
  personCvId?: string;
  runId?: string;
  backendRoot?: string;
  forceRecompute?: boolean;
  fingerprintOverrides?: Record<string, string>;
  reuseSearchRoot?: string;
  thinkingConfig?: Mc1ThinkingConfig;
};

export type P1MemberRunResult = {
  ok: boolean;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  executionStatus: P1PhaseStatus;
  geminiInvoked: boolean;
  reuseFingerprint: string | null;
  sourceArtifactId: string | null;
  candidateCount: number;
  batchCount: number;
  successfulBatches: number;
  failedBatches: number;
  retries: number;
  units: ValidatedEvidenceUnit[];
  decisions: Map<string, P1CandidateDecision>;
  unsupportedSpanCount: number;
  forbiddenTaxonomyHits: number;
  durationMs: number;
  errorCode: string | null;
};

function classifyProviderError(err: unknown): string {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  if (/api[_ ]?key|invalid|unauthorized|401|403/.test(msg)) return 'API_KEY_INVALID';
  if (/quota|resource.?exhausted|429/.test(msg)) return 'QUOTA_EXCEEDED';
  if (/timeout|etimedout|deadline/.test(msg)) return 'PROVIDER_TIMEOUT';
  return 'PROVIDER_CONFIGURATION_ERROR';
}

function isTransient(code: string): boolean {
  return (
    code === 'QUOTA_EXCEEDED' ||
    code === 'PROVIDER_TIMEOUT' ||
    code === 'PROVIDER_CONFIGURATION_ERROR'
  );
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function writeJson(dir: string, name: string, data: unknown) {
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2), 'utf8');
}

const P1_PACK_FILES = [
  'candidates.json',
  'batches.json',
  'prototype-manifest.json',
  'model-output.raw.json',
  'validated-evidence.json',
  'execution-summary.json',
  'decisions.json',
];

function loadP1ResultFromPack(dir: string, durationMs: number): P1MemberRunResult {
  const summary = JSON.parse(
    readFileSync(join(dir, 'execution-summary.json'), 'utf8'),
  ) as {
    status?: string;
    candidates?: number;
    batches?: number;
    successfulBatches?: number;
    failedBatches?: number;
    retries?: number;
    unsupportedSpans?: number;
    forbiddenTaxonomyHits?: number;
  };
  const validated = JSON.parse(
    readFileSync(join(dir, 'validated-evidence.json'), 'utf8'),
  ) as { units?: ValidatedEvidenceUnit[] };
  const units = validated.units ?? [];
  const decisions = new Map<string, P1CandidateDecision>();
  const sidecarPath = join(dir, 'decisions.json');
  if (existsSync(sidecarPath)) {
    const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8')) as {
      decisions?: Array<{ candidateId: string; decision: P1CandidateDecision }>;
    };
    for (const d of sidecar.decisions ?? []) {
      decisions.set(d.candidateId, d.decision);
    }
  } else {
    for (const u of units) decisions.set(u.candidateId, u.decision);
  }
  const manifest = JSON.parse(
    readFileSync(join(dir, 'prototype-manifest.json'), 'utf8'),
  ) as { reuseFingerprint?: string };
  const status =
    summary.status === 'COMPLETED' || summary.status === 'PARTIAL'
      ? summary.status
      : 'FAILED';
  return {
    ok: status === 'COMPLETED',
    status,
    executionStatus: 'REUSED',
    geminiInvoked: false,
    reuseFingerprint: manifest.reuseFingerprint ?? null,
    sourceArtifactId: basename(dir),
    candidateCount: summary.candidates ?? 0,
    batchCount: summary.batches ?? 0,
    successfulBatches: summary.successfulBatches ?? 0,
    failedBatches: summary.failedBatches ?? 0,
    retries: summary.retries ?? 0,
    units,
    decisions,
    unsupportedSpanCount: summary.unsupportedSpans ?? 0,
    forbiddenTaxonomyHits: summary.forbiddenTaxonomyHits ?? 0,
    durationMs,
    errorCode: status === 'COMPLETED' ? null : 'BATCH_OR_SEGMENT_FAILURE',
  };
}

function copyP1Pack(sourceDir: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  for (const name of P1_PACK_FILES) {
    const src = join(sourceDir, name);
    if (existsSync(src)) copyFileSync(src, join(destDir, name));
  }
}

export async function runP1ForMember(
  input: P1MemberRunInput,
): Promise<P1MemberRunResult> {
  const t0 = Date.now();
  mkdirSync(input.outDir, { recursive: true });
  const maxRetries = input.maxTechnicalRetries ?? 2;
  const forceRecompute = resolveForceRecompute(input.forceRecompute);
  const reuseFingerprint = computeP1ReuseFingerprint({
    snapshotContentHash: hashSnapshotContent(input.normalizedText),
    segmenterName: P1_SEGMENTER_NAME,
    segmenterVersion: P1_SEGMENTER_VERSION,
    promptVersion: P1_PROMPT_VERSION,
    contractVersion: P1_CONTRACT_VERSION,
    model: input.model,
    batchBuilderVersion: BATCH_BUILDER_VERSION,
    validatorVersion: VALIDATOR_VERSION,
    overrides: input.fingerprintOverrides,
  });

  if (!forceRecompute) {
    const searchRoot = input.reuseSearchRoot ?? dirname(input.outDir);
    const hit = findReusableP1Pack({
      searchRoot,
      snapshotId: input.snapshotId,
      reuseFingerprint,
    });
    if (hit && hit.dir !== input.outDir) {
      copyP1Pack(hit.dir, input.outDir);
      writeJson(input.outDir, 'reuse.json', {
        status: 'REUSED',
        sourceArtifactId: hit.artifactId,
        reuseFingerprint,
        copiedAt: new Date().toISOString(),
      });
      recordGeminiReuse({
        context: {
          phase: 'P1',
          snapshotId: input.snapshotId,
          personId: input.personId,
          personCvId: input.personCvId,
          runId: input.runId,
          model: input.model,
          promptVersion: P1_PROMPT_VERSION,
          contractVersion: P1_CONTRACT_VERSION,
          reuseFingerprint,
        },
        sourceArtifactId: hit.artifactId,
        durationMs: Date.now() - t0,
        backendRoot: input.backendRoot,
      });
      return loadP1ResultFromPack(input.outDir, Date.now() - t0);
    }
  }

  const segmenter = new DeterministicEvidenceCandidateSegmenter();
  const segmentation = segmenter.segment({
    snapshotId: input.snapshotId,
    normalizedText: input.normalizedText,
    pages: input.pages as never,
    sectionedContent: input.sectionedContent,
  });

  if (
    segmentation.metrics.pageCoverageRatio < 1 ||
    segmentation.metrics.unsegmentedRelevantCharacterCount > 0
  ) {
    writeJson(input.outDir, 'execution-summary.json', {
      status: 'FAILED',
      reason: 'SEGMENTATION_FAILED',
      metrics: segmentation.metrics,
    });
    return {
      ok: false,
      status: 'FAILED',
      executionStatus: 'FAILED',
      geminiInvoked: false,
      reuseFingerprint,
      sourceArtifactId: null,
      candidateCount: segmentation.metrics.candidateCount,
      batchCount: 0,
      successfulBatches: 0,
      failedBatches: 0,
      retries: 0,
      units: [],
      decisions: new Map(),
      unsupportedSpanCount: 0,
      forbiddenTaxonomyHits: 0,
      durationMs: Date.now() - t0,
      errorCode: 'SEGMENTATION_FAILED',
    };
  }

  writeJson(input.outDir, 'candidates.json', {
    classification: 'CONFIDENTIAL',
    metrics: segmentation.metrics,
    candidates: segmentation.candidates,
  });

  const batches = new P1EvidenceBatchBuilder().build(segmentation.candidates);
  writeJson(input.outDir, 'batches.json', {
    batchCount: batches.length,
    batches,
  });
  writeJson(input.outDir, 'prototype-manifest.json', {
    classification: 'CONFIDENTIAL',
    operationType: 'OBSERVATORY_P1_MEMBER',
    prototypeId: input.prototypeId,
    snapshotId: input.snapshotId,
    contractVersion: P1_CONTRACT_VERSION,
    segmenterVersion: P1_SEGMENTER_VERSION,
    promptVersion: P1_PROMPT_VERSION,
    modelProvider: 'google-genai',
    modelVersion: input.model,
    reuseFingerprint,
    startedAt: new Date().toISOString(),
    persistence: 'NONE',
  });

  const byId = new Map(
    segmentation.candidates.map((c) => [c.candidateId, c] as const),
  );
  const systemPrompt = buildP1PrototypeSystemPrompt();
  const rawOutputs: unknown[] = [];
  const allUnits: ValidatedEvidenceUnit[] = [];
  const allDecisions = new Map<string, P1CandidateDecision>();
  let failedBatches = 0;
  let successfulBatches = 0;
  let retries = 0;
  let unsupportedSpanCount = 0;
  let forbiddenTaxonomyHits = 0;

  for (const batch of batches) {
    const contextCandidates = batch.contextCandidateIds
      .map((id) => byId.get(id)!)
      .filter(Boolean) as EvidenceCandidate[];
    const userPayload = buildP1PrototypeUserPayload({
      batch,
      candidates: segmentation.candidates,
      contextCandidates,
    });

    let attempt = 0;
    let parsed: unknown = null;
    let lastCode: string | null = null;
    while (attempt <= maxRetries) {
      attempt += 1;
      try {
        const res = await callP1GeminiJson({
          apiKey: input.apiKey,
          model: input.model,
          systemPrompt,
          userPayload,
          attempt,
          backendRoot: input.backendRoot,
          ledger: {
            phase: 'P1',
            snapshotId: input.snapshotId,
            personId: input.personId,
            personCvId: input.personCvId,
            runId: input.runId,
            batchId: batch.batchId,
            batchIndex: batches.indexOf(batch),
            promptVersion: P1_PROMPT_VERSION,
            contractVersion: P1_CONTRACT_VERSION,
            reuseFingerprint,
            forceRecompute,
            inputFingerprint: serializeThinkingConfig(input.thinkingConfig),
          },
          thinkingConfig: input.thinkingConfig,
        });
        parsed = JSON.parse(res.text);
        break;
      } catch (e) {
        lastCode = classifyProviderError(e);
        if (attempt <= maxRetries && isTransient(lastCode)) {
          retries += 1;
          await sleep(400 * attempt);
          continue;
        }
        break;
      }
    }

    if (parsed == null) {
      failedBatches += 1;
      rawOutputs.push({ batchId: batch.batchId, ok: false, errorCode: lastCode });
      for (const id of batch.candidateIds) {
        allDecisions.set(id, 'REVIEW_REQUIRED');
      }
      // política: detener miembro ante lote inválido
      break;
    }

    const validated = validateP1BatchOutput({
      batchId: batch.batchId,
      expectedCandidateIds: batch.candidateIds,
      candidatesById: byId,
      normalizedText: input.normalizedText,
      raw: parsed,
      prototypeId: input.prototypeId,
      promptVersion: P1_PROMPT_VERSION,
      modelVersion: input.model,
      segmenterVersion: P1_SEGMENTER_VERSION,
    });
    unsupportedSpanCount += validated.unsupportedSpanCount;
    forbiddenTaxonomyHits += validated.forbiddenTaxonomyHits;
    rawOutputs.push({
      batchId: batch.batchId,
      ok: validated.ok,
      status: validated.status,
    });

    if (!validated.ok) {
      failedBatches += 1;
      for (const id of batch.candidateIds) {
        allDecisions.set(id, validated.decisions.get(id) ?? 'REVIEW_REQUIRED');
      }
      break;
    }

    successfulBatches += 1;
    for (const [id, d] of validated.decisions) allDecisions.set(id, d);
    allUnits.push(...validated.units);
  }

  writeJson(input.outDir, 'model-output.raw.json', {
    classification: 'CONFIDENTIAL',
    batches: rawOutputs,
  });
  writeJson(input.outDir, 'validated-evidence.json', {
    classification: 'CONFIDENTIAL',
    units: allUnits,
  });

  const status =
    failedBatches === 0 && successfulBatches === batches.length
      ? 'COMPLETED'
      : successfulBatches > 0
        ? 'PARTIAL'
        : 'FAILED';

  writeJson(input.outDir, 'execution-summary.json', {
    status,
    snapshotId: input.snapshotId,
    candidates: segmentation.candidates.length,
    batches: batches.length,
    successfulBatches,
    failedBatches,
    retries,
    evidenceUnits: allUnits.length,
    unsupportedSpans: unsupportedSpanCount,
    forbiddenTaxonomyHits,
    persistence: 'NONE',
    reuseFingerprint,
    P2: false,
    Cloud: false,
  });

  return {
    ok: status === 'COMPLETED',
    status,
    executionStatus: status === 'FAILED' ? 'FAILED' : 'EXECUTED',
    geminiInvoked: successfulBatches + failedBatches > 0,
    reuseFingerprint,
    sourceArtifactId: null,
    candidateCount: segmentation.candidates.length,
    batchCount: batches.length,
    successfulBatches,
    failedBatches,
    retries,
    units: allUnits,
    decisions: allDecisions,
    unsupportedSpanCount,
    forbiddenTaxonomyHits,
    durationMs: Date.now() - t0,
    errorCode: status === 'COMPLETED' ? null : 'BATCH_OR_SEGMENT_FAILURE',
  };
}

/** Selección de muestra de revisión (máx 3 IDs, sin texto). */
export function pickReviewSampleIds(units: ValidatedEvidenceUnit[]): string[] {
  const picks: string[] = [];
  const explicit = units.find((u) => u.explicitness === 'EXPLICIT');
  const strong = units.find((u) => u.explicitness === 'STRONGLY_SUPPORTED');
  const review = units.find((u) => u.reviewRequired || u.decision === 'REVIEW_REQUIRED');
  const kindCounts = new Map<string, number>();
  for (const u of units) {
    kindCounts.set(u.evidenceKind, (kindCounts.get(u.evidenceKind) ?? 0) + 1);
  }
  let rare: ValidatedEvidenceUnit | undefined;
  let rareCount = Infinity;
  for (const u of units) {
    const c = kindCounts.get(u.evidenceKind) ?? 0;
    if (c < rareCount) {
      rareCount = c;
      rare = u;
    }
  }
  for (const u of [explicit, strong, review ?? rare]) {
    if (u && !picks.includes(u.evidencePrototypeId) && picks.length < 3) {
      picks.push(u.evidencePrototypeId);
    }
  }
  return picks;
}
