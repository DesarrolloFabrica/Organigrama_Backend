/**
 * FASE 5D — segundo piloto P1 v1.1 (segmenter+prompt).
 * Baseline inmutable: P1P-20260805202240-107578d8-AI-5e32782f
 * No persiste BD. No P2. No Cloud.
 */
import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { GoogleGenAI } from '@google/genai';
import { DeterministicEvidenceCandidateSegmenter } from '../src/mc-pipeline/p1/deterministic-evidence-candidate-segmenter';
import { P1EvidenceBatchBuilder } from '../src/mc-pipeline/p1/p1-evidence-batch-builder';
import {
  buildP1PrototypeSystemPrompt,
  buildP1PrototypeUserPayload,
  P1_PROMPT_DIFF_1_0_TO_1_1,
} from '../src/mc-pipeline/p1/p1-prototype-prompt';
import { validateP1BatchOutput } from '../src/mc-pipeline/p1/p1-batch-output-validator';
import { callP1GeminiJson } from '../src/mc-pipeline/p1/p1-gemini-client';
import {
  P1_CONTRACT_VERSION,
  P1_PROMPT_VERSION,
  P1_SEGMENTER_VERSION,
  type EvidenceCandidate,
  type P1CandidateDecision,
} from '../src/mc-pipeline/p1/p1.types';
import { DEFAULT_GEMINI_MODEL } from '../src/cv-skills/cv-skills.types';

const ROOT = resolve(__dirname, '..');
const BASELINE_ID = 'P1P-20260805202240-107578d8-AI-5e32782f';

function loadEnvFile(path: string, allow: Set<string> | null = null) {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (allow && !allow.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function writeJson(dir: string, name: string, data: unknown) {
  writeFileSync(resolve(dir, name), JSON.stringify(data, null, 2), 'utf8');
}

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

async function preflight(apiKey: string, model: string) {
  const ai = new GoogleGenAI({ apiKey });
  const t0 = Date.now();
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        { role: 'user', parts: [{ text: 'Reply with JSON {"ok":true} only.' }] },
      ],
      config: { responseMimeType: 'application/json', temperature: 0 },
    });
    JSON.parse(response.text?.trim() || '');
    return { ok: true as const, latencyMs: Date.now() - t0, code: 'OK' };
  } catch (e) {
    return {
      ok: false as const,
      latencyMs: Date.now() - t0,
      code: classifyProviderError(e),
      messageSafe: String(e instanceof Error ? e.message : e).slice(0, 120),
    };
  }
}

async function main() {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }

  const secretPath = resolve(ROOT, 'secrets/mc1-p1-prototype.local.env');
  const geminiAllow = new Set(['GEMINI_API_KEY', 'GEMINI_MODEL']);
  const secretEnv = loadEnvFile(secretPath, geminiAllow);
  const apiKey = secretEnv.GEMINI_API_KEY?.trim() || '';
  const model =
    secretEnv.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  if (!apiKey || apiKey.length < 20) {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'API_KEY_MISSING' }));
    process.exit(4);
  }

  const pf = await preflight(apiKey, model);
  if (!pf.ok) {
    console.log(JSON.stringify({ status: 'BLOCKED', preflight: pf }));
    process.exit(5);
  }

  const mde = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const host = mde.MDE_DB_HOST;
  const port = Number(mde.MDE_DB_PORT);
  const database = mde.MDE_DB_NAME;
  if (
    !['127.0.0.1', 'localhost', '::1'].includes(host) ||
    port !== 5434 ||
    !String(database).includes('_mde')
  ) {
    throw new Error('MDE_GUARD_FAILED');
  }

  const client = new Client({
    host,
    port,
    user: mde.MDE_DB_USERNAME,
    password: mde.MDE_DB_PASSWORD,
    database,
  });
  await client.connect();
  const snap = (
    await client.query(
      `SELECT id::text, parse_status, normalized_text, pages, sectioned_content
         FROM organigrama.mc_cv_snapshot WHERE id = 1`,
    )
  ).rows[0];
  const countBefore = (
    await client.query(`SELECT COUNT(*)::int AS n FROM organigrama.mc_cv_snapshot`)
  ).rows[0].n;

  const normalizedText: string = snap.normalized_text;
  const pages =
    typeof snap.pages === 'string' ? JSON.parse(snap.pages) : snap.pages;
  const sectioned =
    typeof snap.sectioned_content === 'string'
      ? JSON.parse(snap.sectioned_content)
      : snap.sectioned_content;

  const prototypeId = `P1P-V11-${new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const outDir = resolve(ROOT, 'tmp/mc1-p1-prototype', prototypeId);
  mkdirSync(outDir, { recursive: true });

  const segmenter = new DeterministicEvidenceCandidateSegmenter();
  const segmentation = segmenter.segment({
    snapshotId: '1',
    normalizedText,
    pages,
    sectionedContent: sectioned,
  });

  if (
    segmentation.metrics.pageCoverageRatio < 1 ||
    segmentation.metrics.unsegmentedRelevantCharacterCount > 0 ||
    segmentation.metrics.headingCount < 1
  ) {
    writeJson(outDir, 'execution-summary.json', {
      status: 'BLOCKED',
      reason: 'SEGMENTATION_FAILED',
      metrics: segmentation.metrics,
    });
    await client.end();
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'SEGMENTATION_FAILED',
        metrics: segmentation.metrics,
      }),
    );
    process.exit(3);
  }

  writeJson(outDir, 'candidates.json', {
    classification: 'CONFIDENTIAL',
    metrics: segmentation.metrics,
    gaps: segmentation.gaps,
    candidates: segmentation.candidates,
  });

  const batches = new P1EvidenceBatchBuilder().build(segmentation.candidates, {
    maxCandidatesPerBatch: 14,
    maxCharsPerBatch: 4500,
  });
  writeJson(outDir, 'batches.json', {
    batchCount: batches.length,
    batches,
    candidatesPerBatch: batches.map((b) => b.candidateIds.length),
    charactersPerBatch: batches.map((b) => b.characterCount),
  });

  writeJson(outDir, 'prototype-manifest.json', {
    classification: 'CONFIDENTIAL',
    operationType: 'P1_LOCAL_PROTOTYPE',
    prototypeId,
    baselinePrototypeId: BASELINE_ID,
    snapshotId: '1',
    contractVersion: P1_CONTRACT_VERSION,
    segmenterVersion: P1_SEGMENTER_VERSION,
    promptVersion: P1_PROMPT_VERSION,
    promptDiff: P1_PROMPT_DIFF_1_0_TO_1_1,
    modelProvider: 'google-genai',
    modelVersion: model,
    startedAt: new Date().toISOString(),
    persistence: 'NONE',
    preflight: pf,
  });

  const byId = new Map(
    segmentation.candidates.map((c) => [c.candidateId, c] as const),
  );
  const systemPrompt = buildP1PrototypeSystemPrompt();
  const rawOutputs: unknown[] = [];
  const allUnits: ReturnType<typeof validateP1BatchOutput>['units'] = [];
  const allDecisions = new Map<string, P1CandidateDecision>();
  let batchFailureCount = 0;
  let retries = 0;
  let unsupportedSpanCount = 0;
  let forbiddenTaxonomyFields = 0;
  let successfulBatches = 0;
  let latencyTotal = 0;
  const tAll = Date.now();

  for (const batch of batches) {
    const contextCandidates = batch.contextCandidateIds
      .map((id) => byId.get(id)!)
      .filter(Boolean);
    const userPayload = buildP1PrototypeUserPayload({
      batch,
      candidates: segmentation.candidates,
      contextCandidates,
    });
    if (
      /"(areaId|jefeId|dependencyId|schoolId|orgNodeId|personEmail|documentId)"\s*:/i.test(
        userPayload,
      )
    ) {
      throw new Error('PAYLOAD_PRIVACY_VIOLATION');
    }

    let attempt = 0;
    let parsed: unknown = null;
    let lastCode: string | null = null;
    let lastErr: string | null = null;
    while (attempt < 3) {
      attempt += 1;
      const t0 = Date.now();
      try {
        const res = await callP1GeminiJson({
          apiKey,
          model,
          systemPrompt,
          userPayload,
          attempt,
        });
        latencyTotal += Date.now() - t0;
        parsed = JSON.parse(res.text);
        break;
      } catch (e) {
        latencyTotal += Date.now() - t0;
        lastCode = classifyProviderError(e);
        lastErr = String(e instanceof Error ? e.message : e).slice(0, 160);
        if (attempt < 3 && isTransient(lastCode)) {
          retries += 1;
          await sleep(500 * attempt);
          continue;
        }
        break;
      }
    }

    if (parsed == null) {
      batchFailureCount += 1;
      rawOutputs.push({
        batchId: batch.batchId,
        ok: false,
        errorCode: lastCode,
        errorSafe: lastErr,
      });
      for (const id of batch.candidateIds)
        allDecisions.set(id, 'REVIEW_REQUIRED');
      continue;
    }

    const validated = validateP1BatchOutput({
      batchId: batch.batchId,
      expectedCandidateIds: batch.candidateIds,
      candidatesById: byId,
      normalizedText,
      raw: parsed,
      prototypeId,
      promptVersion: P1_PROMPT_VERSION,
      modelVersion: model,
      segmenterVersion: P1_SEGMENTER_VERSION,
    });
    unsupportedSpanCount += validated.unsupportedSpanCount;
    forbiddenTaxonomyFields += validated.forbiddenTaxonomyHits;
    rawOutputs.push({
      batchId: batch.batchId,
      ok: validated.ok,
      validation: validated.ok
        ? { status: 'OK' }
        : { status: validated.status, errors: validated.errors },
      output: parsed,
    });

    if (!validated.ok) {
      batchFailureCount += 1;
      for (const id of batch.candidateIds) {
        allDecisions.set(id, validated.decisions.get(id) ?? 'REVIEW_REQUIRED');
      }
      continue;
    }
    successfulBatches += 1;
    for (const [id, d] of validated.decisions) allDecisions.set(id, d);
    allUnits.push(...validated.units);
  }

  latencyTotal = Math.max(latencyTotal, Date.now() - tAll);

  writeJson(outDir, 'model-output.raw.json', {
    classification: 'CONFIDENTIAL',
    batches: rawOutputs,
  });

  for (const c of segmentation.candidates) {
    if (!allDecisions.has(c.candidateId)) {
      allDecisions.set(c.candidateId, 'REVIEW_REQUIRED');
      batchFailureCount += 1;
    }
  }

  const decisionCounts: Record<string, number> = {};
  for (const d of allDecisions.values()) {
    decisionCounts[d] = (decisionCounts[d] || 0) + 1;
  }
  const explicit = allUnits.filter((u) => u.explicitness === 'EXPLICIT').length;
  const strong = allUnits.filter(
    (u) => u.explicitness === 'STRONGLY_SUPPORTED',
  ).length;
  const inferred = allUnits.filter((u) => u.explicitness === 'INFERRED').length;

  writeJson(outDir, 'validated-evidence.json', {
    classification: 'CONFIDENTIAL',
    units: allUnits,
  });
  writeJson(outDir, 'coverage.json', {
    candidateDecisionCoverage:
      allDecisions.size / segmentation.candidates.length,
    decisionCounts,
    evidenceUnitCount: allUnits.length,
    explicit,
    stronglySupported: strong,
    inferred,
    unsupportedSpanCount,
    batchFailureCount,
    forbiddenTaxonomyFields,
    successfulBatches,
    headingCount: segmentation.metrics.headingCount,
  });

  writeJson(outDir, 'manual-review-template.json', {
    classification: 'CONFIDENTIAL',
    manualReviewStatus: 'PENDING_TECHNICAL',
    evidenceReviews: allUnits.map((u) => ({
      evidencePrototypeId: u.evidencePrototypeId,
      candidateId: u.candidateId,
      evidenceKind: u.evidenceKind,
      explicitness: u.explicitness,
      humanLabel: null,
    })),
    rejectedCandidateReviews: [...allDecisions.entries()]
      .filter(([, d]) => d.startsWith('REJECTED'))
      .map(([candidateId, decision]) => ({
        candidateId,
        decision,
        humanLabel: null,
      })),
  });

  const countAfter = (
    await client.query(`SELECT COUNT(*)::int AS n FROM organigrama.mc_cv_snapshot`)
  ).rows[0].n;
  await client.end();

  const schemaOk = batchFailureCount === 0 && unsupportedSpanCount === 0;
  const phaseOk =
    successfulBatches === batches.length &&
    allDecisions.size === segmentation.candidates.length &&
    forbiddenTaxonomyFields === 0 &&
    countBefore === countAfter &&
    segmentation.metrics.headingCount > 0;

  const summary = {
    status: phaseOk ? 'READY_FOR_COMPARISON' : 'BLOCKED',
    prototypeId,
    baselinePrototypeId: BASELINE_ID,
    snapshotId: '1',
    segmenterVersion: P1_SEGMENTER_VERSION,
    promptVersion: P1_PROMPT_VERSION,
    contractVersion: P1_CONTRACT_VERSION,
    model,
    candidates: segmentation.metrics.candidateCount,
    headings: segmentation.metrics.headingCount,
    batches: batches.length,
    successfulBatches,
    failedBatches: batchFailureCount,
    retries,
    latencyTotalMs: latencyTotal,
    coverage: {
      pageCoverage: segmentation.metrics.pageCoverageRatio,
      decisionCoverage: allDecisions.size / segmentation.candidates.length,
      unsegmentedRelevant:
        segmentation.metrics.unsegmentedRelevantCharacterCount,
    },
    ia: {
      accepted: decisionCounts.ACCEPTED || 0,
      rejectedNonProfessional: decisionCounts.REJECTED_NON_PROFESSIONAL || 0,
      rejectedContextOnly: decisionCounts.REJECTED_CONTEXT_ONLY || 0,
      ambiguous: decisionCounts.AMBIGUOUS || 0,
      reviewRequired: decisionCounts.REVIEW_REQUIRED || 0,
      evidenceUnits: allUnits.length,
      explicit,
      stronglySupported: strong,
      inferred,
    },
    validation: {
      schema: schemaOk ? 'OK' : 'VALIDATION_FAILED',
      offsets: unsupportedSpanCount === 0 ? 'OK' : 'FAILED',
      unsupportedSpans: unsupportedSpanCount,
      forbiddenTaxonomyFields,
      persistence: 'NONE',
      snapshotCount: countAfter,
      P2: false,
      Cloud: false,
    },
    artifactPath: outDir,
  };
  writeJson(outDir, 'execution-summary.json', summary);
  console.log(JSON.stringify(summary));
  process.exit(phaseOk ? 0 : 6);
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      status: 'BLOCKED',
      error: String(e?.message || e).slice(0, 200),
    }),
  );
  process.exit(1);
});
