/**
 * Runner P1_LOCAL_PROTOTYPE — snapshotId=1, sin persistencia BD.
 * Artefactos: tmp/mc1-p1-prototype/<prototypeId>/ (gitignored).
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
import { DeterministicEvidenceCandidateSegmenter } from '../src/mc-pipeline/p1/deterministic-evidence-candidate-segmenter';
import { P1EvidenceBatchBuilder } from '../src/mc-pipeline/p1/p1-evidence-batch-builder';
import {
  buildP1PrototypeSystemPrompt,
  buildP1PrototypeUserPayload,
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

function stripTextForPublic(cands: EvidenceCandidate[]) {
  return cands.map(({ text: _t, ...rest }) => rest);
}

async function main() {
  // Clear DB_* from ambient; never use root .env for DB
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }

  const mde = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const geminiAllow = new Set(['GEMINI_API_KEY', 'GEMINI_MODEL']);
  const geminiFromSecrets = loadEnvFile(
    resolve(ROOT, 'secrets/mc1-p1-prototype.local.env'),
    geminiAllow,
  );
  // Solo claves Gemini del .env (no DB)
  const geminiFromEnv = loadEnvFile(resolve(ROOT, '.env'), geminiAllow);

  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    geminiFromSecrets.GEMINI_API_KEY?.trim() ||
    geminiFromEnv.GEMINI_API_KEY?.trim() ||
    '';
  const model =
    process.env.GEMINI_MODEL?.trim() ||
    geminiFromSecrets.GEMINI_MODEL?.trim() ||
    geminiFromEnv.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL;

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

  const prototypeId = `P1P-${new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const startedAt = new Date().toISOString();
  const outDir = resolve(ROOT, 'tmp/mc1-p1-prototype', prototypeId);
  mkdirSync(outDir, { recursive: true });

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
      `SELECT id::text AS id, parse_status, page_count,
              length(normalized_text) AS norm_len,
              normalized_text, pages, sectioned_content
         FROM organigrama.mc_cv_snapshot WHERE id = 1`,
    )
  ).rows[0];

  const countBefore = (
    await client.query(
      `SELECT COUNT(*)::int AS n FROM organigrama.mc_cv_snapshot`,
    )
  ).rows[0].n;

  if (!snap || snap.parse_status !== 'PARSED' || !snap.norm_len) {
    writeJson(outDir, 'execution-summary.json', {
      status: 'BLOCKED',
      reason: 'SNAPSHOT_NOT_READY',
    });
    await client.end();
    process.exit(2);
  }

  const normalizedText: string = snap.normalized_text;
  const pages =
    typeof snap.pages === 'string' ? JSON.parse(snap.pages) : snap.pages;
  const sectioned =
    typeof snap.sectioned_content === 'string'
      ? JSON.parse(snap.sectioned_content)
      : snap.sectioned_content;

  const manifest = {
    classification: 'CONFIDENTIAL',
    operationType: 'P1_LOCAL_PROTOTYPE',
    prototypeId,
    snapshotId: '1',
    contractVersion: P1_CONTRACT_VERSION,
    segmenterVersion: P1_SEGMENTER_VERSION,
    promptVersion: P1_PROMPT_VERSION,
    modelProvider: 'google-genai',
    modelVersion: model,
    startedAt,
    campaignId: null,
    pipelineRunId: null,
    persistence: 'NONE',
    rootEnvUsedForDb: false,
  };
  writeJson(outDir, 'prototype-manifest.json', manifest);

  const segmenter = new DeterministicEvidenceCandidateSegmenter();
  const segmentation = segmenter.segment({
    snapshotId: '1',
    normalizedText,
    pages,
    sectionedContent: sectioned,
  });

  writeJson(outDir, 'candidates.json', {
    classification: 'CONFIDENTIAL',
    metrics: segmentation.metrics,
    gaps: segmentation.gaps,
    candidates: segmentation.candidates.map((c) => ({
      ...c,
      // texto necesario para revisión local; CONFIDENTIAL
    })),
  });

  if (
    segmentation.metrics.pageCoverageRatio < 1 ||
    segmentation.metrics.unsegmentedRelevantCharacterCount > 0
  ) {
    writeJson(outDir, 'execution-summary.json', {
      status: 'BLOCKED',
      reason: 'SEGMENTATION_COVERAGE_FAILED',
      metrics: segmentation.metrics,
    });
    await client.end();
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'SEGMENTATION_COVERAGE_FAILED',
        prototypeId,
        metrics: segmentation.metrics,
      }),
    );
    process.exit(3);
  }

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

  if (!apiKey) {
    writeJson(outDir, 'execution-summary.json', {
      status: 'BLOCKED',
      reason: 'GEMINI_API_KEY_MISSING',
      hint: 'Crear secrets/mc1-p1-prototype.local.env con GEMINI_API_KEY=... (gitignored)',
      prototypeId,
      segmentation: segmentation.metrics,
      batchCount: batches.length,
    });
    await client.end();
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'GEMINI_API_KEY_MISSING',
        prototypeId,
        candidates: segmentation.metrics.candidateCount,
        batches: batches.length,
      }),
    );
    process.exit(4);
  }

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

  for (const batch of batches) {
    const contextCandidates = batch.contextCandidateIds
      .map((id) => byId.get(id)!)
      .filter(Boolean);
    const userPayload = buildP1PrototypeUserPayload({
      batch,
      candidates: segmentation.candidates,
      contextCandidates,
    });

    let attempt = 1;
    let parsed: unknown = null;
    let lastErr: string | null = null;
    while (attempt <= 2) {
      try {
        const res = await callP1GeminiJson({
          apiKey,
          model,
          systemPrompt,
          userPayload,
          attempt,
        });
        parsed = JSON.parse(res.text);
        break;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        if (attempt === 1) {
          retries += 1;
          attempt += 1;
          continue;
        }
        break;
      }
    }

    rawOutputs.push({
      batchId: batch.batchId,
      attempt,
      ok: parsed != null,
      errorSafe: lastErr ? lastErr.slice(0, 160) : null,
      output: parsed,
    });

    if (parsed == null) {
      batchFailureCount += 1;
      for (const id of batch.candidateIds) {
        allDecisions.set(id, 'REVIEW_REQUIRED');
      }
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

    if (!validated.ok) {
      batchFailureCount += 1;
      const prev = rawOutputs[rawOutputs.length - 1];
      rawOutputs[rawOutputs.length - 1] = {
        ...(typeof prev === 'object' && prev ? prev : {}),
        validation: {
          status: validated.status,
          errors: validated.errors,
        },
      };
      for (const id of batch.candidateIds) {
        allDecisions.set(id, validated.decisions.get(id) ?? 'REVIEW_REQUIRED');
      }
      // no aceptar parcialmente sin marcar
      continue;
    }

    for (const [id, d] of validated.decisions) allDecisions.set(id, d);
    allUnits.push(...validated.units);
  }

  writeJson(outDir, 'model-output.raw.json', {
    classification: 'CONFIDENTIAL',
    batches: rawOutputs,
  });

  // Completar decisiones faltantes
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

  const coverage = {
    candidateDecisionCoverage:
      allDecisions.size / segmentation.candidates.length,
    characterProcessingCoverage:
      segmentation.metrics.candidateCharacterCoverage,
    pageCoverageRatio: segmentation.metrics.pageCoverageRatio,
    decisionCounts,
    evidenceUnitCount: allUnits.length,
    explicitRatio: allUnits.length ? explicit / allUnits.length : 0,
    stronglySupportedRatio: allUnits.length ? strong / allUnits.length : 0,
    inferredRatio: allUnits.length ? inferred / allUnits.length : 0,
    unsupportedSpanCount,
    batchFailureCount,
    forbiddenTaxonomyFields,
  };
  writeJson(outDir, 'coverage.json', coverage);

  const reviewTemplate = {
    classification: 'CONFIDENTIAL',
    manualReviewStatus: 'PENDING_HUMAN',
    evidenceReviews: allUnits.map((u) => ({
      evidencePrototypeId: u.evidencePrototypeId,
      candidateId: u.candidateId,
      pageNumber: u.pageNumber,
      evidenceKind: u.evidenceKind,
      explicitness: u.explicitness,
      reviewRequired: u.reviewRequired,
      humanLabel: null as string | null,
      labelsAllowed: [
        'CORRECT',
        'FALSE_POSITIVE',
        'WRONG_KIND',
        'WRONG_EXPLICITNESS',
        'BAD_SPAN',
        'TOO_BROAD',
        'TOO_FRAGMENTED',
        'DUPLICATE',
        'MISSING_CONTEXT',
        'OTHER',
      ],
    })),
    rejectedCandidateReviews: [...allDecisions.entries()]
      .filter(([, d]) => d.startsWith('REJECTED'))
      .map(([candidateId, decision]) => ({
        candidateId,
        decision,
        humanLabel: null as string | null,
        labelsAllowed: ['MISSED_EVIDENCE', 'CORRECT_REJECTION', 'UNCERTAIN'],
      })),
  };
  writeJson(outDir, 'manual-review-template.json', reviewTemplate);

  const countAfter = (
    await client.query(
      `SELECT COUNT(*)::int AS n FROM organigrama.mc_cv_snapshot`,
    )
  ).rows[0].n;
  await client.end();

  const schemaOk = batchFailureCount === 0 && unsupportedSpanCount === 0;
  const phaseOk =
    coverage.candidateDecisionCoverage === 1 &&
    forbiddenTaxonomyFields === 0 &&
    countBefore === countAfter &&
    countAfter === 1;

  const summary = {
    status: phaseOk ? 'READY_FOR_P1_REVIEW' : 'BLOCKED',
    prototypeId,
    snapshotId: '1',
    segmenterVersion: P1_SEGMENTER_VERSION,
    promptVersion: P1_PROMPT_VERSION,
    model,
    batches: batches.length,
    retries,
    segmentation: {
      candidates: segmentation.metrics.candidateCount,
      pageCoverage: segmentation.metrics.pageCoverageRatio,
      characterCoverage: segmentation.metrics.candidateCharacterCoverage,
      unsegmentedRelevantCharacters:
        segmentation.metrics.unsegmentedRelevantCharacterCount,
      candidateTypes: segmentation.metrics.candidateTypeCounts,
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
      candidateDecisionCoverage: coverage.candidateDecisionCoverage,
      offsets: unsupportedSpanCount === 0 ? 'OK' : 'FAILED',
      unsupportedSpans: unsupportedSpanCount,
      forbiddenTaxonomyFields,
      persistence: 'NONE',
      snapshotCountBefore: countBefore,
      snapshotCountAfter: countAfter,
      P2: false,
      Cloud: false,
    },
    review: {
      manualReviewStatus: 'PENDING_HUMAN',
      technicalReviewProposed: true,
      possibleFalsePositives: null,
      possibleOmissions: null,
      note: 'Revisión humana 100% pendiente — no inventar aprobación',
    },
    adr010: {
      status: 'PROPOSED',
      reason:
        'Offsets/cobertura/validación demostrables; aceptación formal tras revisión humana 100%',
    },
    artifactDir: outDir,
  };

  writeJson(outDir, 'execution-summary.json', summary);
  // stdout seguro (sin spans)
  console.log(
    JSON.stringify({
      ...summary,
      candidatesPublic: stripTextForPublic(segmentation.candidates).length,
    }),
  );

  process.exit(phaseOk ? 0 : 5);
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
