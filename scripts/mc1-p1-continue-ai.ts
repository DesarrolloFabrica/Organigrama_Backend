/**
 * FASE 5B.1 — continuación IA del prototipo P1.
 * Reutiliza candidatos/lotes de un prototypeId base si coinciden.
 * Carga GEMINI solo desde secrets/mc1-p1-prototype.local.env (o env process).
 * Nunca imprime la API key.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  copyFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { GoogleGenAI } from '@google/genai';
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
const BASE_PROTOTYPE = 'P1P-20260805202240-107578d8';

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

function checksum(obj: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(obj))
    .digest('hex')
    .slice(0, 16);
}

function classifyProviderError(err: unknown): string {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  if (/api[_ ]?key|invalid|unauthorized|401|403/.test(msg)) return 'API_KEY_INVALID';
  if (/quota|resource.?exhausted|429/.test(msg)) return 'QUOTA_EXCEEDED';
  if (/timeout|etimedout|deadline/.test(msg)) return 'PROVIDER_TIMEOUT';
  if (/not found|model/.test(msg) && /unavailable|not/.test(msg))
    return 'MODEL_NOT_AVAILABLE';
  if (/5\d\d|internal|unavailable|econnreset|network/.test(msg))
    return 'PROVIDER_CONFIGURATION_ERROR';
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
      contents: [{ role: 'user', parts: [{ text: 'Reply with JSON {"ok":true} only.' }] }],
      config: { responseMimeType: 'application/json', temperature: 0 },
    });
    const text = response.text?.trim() ?? '';
    JSON.parse(text);
    return {
      ok: true as const,
      latencyMs: Date.now() - t0,
      code: 'OK',
    };
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
  // Solo Gemini del .env si el secret no existe — NO copiamos a docs
  const envGemini = loadEnvFile(resolve(ROOT, '.env'), geminiAllow);

  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    secretEnv.GEMINI_API_KEY?.trim() ||
    envGemini.GEMINI_API_KEY?.trim() ||
    '';
  const model =
    secretEnv.GEMINI_MODEL?.trim() ||
    envGemini.GEMINI_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL;

  const keyStatus = !apiKey
    ? 'API_KEY_MISSING'
    : apiKey.length < 20 || /^(your_|xxx|changeme|<|TODO)/i.test(apiKey)
      ? 'API_KEY_INVALID'
      : 'PRESENT';

  if (keyStatus !== 'PRESENT') {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: keyStatus,
        secretFile: 'secrets/mc1-p1-prototype.local.env',
        secretFileExists: existsSync(secretPath),
        action:
          'Completar manualmente GEMINI_API_KEY (y opcional GEMINI_MODEL=gemini-3.6-flash) en secrets/mc1-p1-prototype.local.env',
        modelDefault: DEFAULT_GEMINI_MODEL,
        gitignored: true,
      }),
    );
    process.exit(4);
  }

  const pf = await preflight(apiKey, model);
  if (!pf.ok) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: pf.code,
        preflight: pf,
        model,
        credencialExpuesta: false,
      }),
    );
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

  const baseDir = resolve(ROOT, 'tmp/mc1-p1-prototype', BASE_PROTOTYPE);
  if (!existsSync(resolve(baseDir, 'candidates.json'))) {
    console.log(
      JSON.stringify({ status: 'BLOCKED', reason: 'BASE_ARTIFACTS_MISSING' }),
    );
    process.exit(2);
  }

  const baseCandidates = JSON.parse(
    readFileSync(resolve(baseDir, 'candidates.json'), 'utf8'),
  );
  const baseBatches = JSON.parse(
    readFileSync(resolve(baseDir, 'batches.json'), 'utf8'),
  );

  if (
    baseCandidates.metrics?.candidateCount !== 57 ||
    baseBatches.batchCount !== 5
  ) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'BASE_ARTIFACT_MISMATCH',
        candidateCount: baseCandidates.metrics?.candidateCount,
        batchCount: baseBatches.batchCount,
      }),
    );
    process.exit(2);
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
      `SELECT id::text AS id, parse_status, normalized_text, pages, sectioned_content,
              length(normalized_text) AS norm_len
         FROM organigrama.mc_cv_snapshot WHERE id = 1`,
    )
  ).rows[0];
  const countBefore = (
    await client.query(
      `SELECT COUNT(*)::int AS n FROM organigrama.mc_cv_snapshot`,
    )
  ).rows[0].n;

  const normalizedText: string = snap.normalized_text;
  // Verificar offsets de candidatos base
  for (const c of baseCandidates.candidates as EvidenceCandidate[]) {
    const recon = normalizedText.slice(c.startOffset, c.endOffset);
    if (c.text != null && recon !== c.text) {
      console.log(
        JSON.stringify({
          status: 'BLOCKED',
          reason: 'OFFSET_DRIFT',
          candidateId: c.candidateId,
        }),
      );
      await client.end();
      process.exit(3);
    }
  }

  const prototypeId = `${BASE_PROTOTYPE}-AI-${randomUUID().slice(0, 8)}`;
  const outDir = resolve(ROOT, 'tmp/mc1-p1-prototype', prototypeId);
  mkdirSync(outDir, { recursive: true });
  copyFileSync(
    resolve(baseDir, 'candidates.json'),
    resolve(outDir, 'candidates.json'),
  );
  copyFileSync(resolve(baseDir, 'batches.json'), resolve(outDir, 'batches.json'));

  const startedAt = new Date().toISOString();
  writeJson(outDir, 'prototype-manifest.json', {
    classification: 'CONFIDENTIAL',
    operationType: 'P1_LOCAL_PROTOTYPE',
    prototypeId,
    parentPrototypeId: BASE_PROTOTYPE,
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
    secretFile: 'secrets/mc1-p1-prototype.local.env',
    preflight,
    candidatesChecksum: checksum(
      (baseCandidates.candidates as EvidenceCandidate[]).map((c) => ({
        candidateId: c.candidateId,
        startOffset: c.startOffset,
        endOffset: c.endOffset,
        textHash: c.textHash,
      })),
    ),
    batchesChecksum: checksum(baseBatches.batches),
  });

  const candidates = baseCandidates.candidates as EvidenceCandidate[];
  const batches = baseBatches.batches as Array<{
    batchId: string;
    candidateIds: string[];
    pageRange: [number, number];
    characterCount: number;
    contextCandidateIds: string[];
  }>;

  const byId = new Map(candidates.map((c) => [c.candidateId, c] as const));
  const systemPrompt = buildP1PrototypeSystemPrompt();
  // Privacidad: el prompt puede listar términos prohibidos; no inyectar datos org.
  // Solo bloquear si el payload de candidatos trae claves de organigrama externo.

  const rawOutputs: unknown[] = [];
  const allUnits: ReturnType<typeof validateP1BatchOutput>['units'] = [];
  const allDecisions = new Map<string, P1CandidateDecision>();
  let batchFailureCount = 0;
  let retries = 0;
  let unsupportedSpanCount = 0;
  let forbiddenTaxonomyFields = 0;
  let latencyTotal = 0;
  let tokenUsage: { input?: number; output?: number } | null = null;
  let successfulBatches = 0;

  const tAll = Date.now();

  for (const batch of batches) {
    const contextCandidates = batch.contextCandidateIds
      .map((id) => byId.get(id)!)
      .filter(Boolean);
    const userPayload = buildP1PrototypeUserPayload({
      batch,
      candidates,
      contextCandidates,
    });
    // No inyectar campos de organigrama ajenos al CV (claves JSON)
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
    const maxAttempts = 3; // 1 + 2 retries

    while (attempt < maxAttempts) {
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
        lastCode = null;
        break;
      } catch (e) {
        latencyTotal += Date.now() - t0;
        lastCode = classifyProviderError(e);
        lastErr = String(e instanceof Error ? e.message : e).slice(0, 160);
        if (attempt < maxAttempts && isTransient(lastCode)) {
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
        attempt,
        ok: false,
        errorCode: lastCode,
        errorSafe: lastErr,
        output: null,
      });
      for (const id of batch.candidateIds) {
        allDecisions.set(id, 'REVIEW_REQUIRED');
      }
      continue;
    }

    let validated = validateP1BatchOutput({
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

    // Un retry técnico extra si JSON parseó pero validación falló por forma (no cambiar prompt)
    if (!validated.ok && attempt < maxAttempts) {
      retries += 1;
      await sleep(400);
      try {
        const res2 = await callP1GeminiJson({
          apiKey,
          model,
          systemPrompt,
          userPayload,
          attempt: attempt + 1,
        });
        const parsed2 = JSON.parse(res2.text);
        const v2 = validateP1BatchOutput({
          batchId: batch.batchId,
          expectedCandidateIds: batch.candidateIds,
          candidatesById: byId,
          normalizedText,
          raw: parsed2,
          prototypeId,
          promptVersion: P1_PROMPT_VERSION,
          modelVersion: model,
          segmenterVersion: P1_SEGMENTER_VERSION,
        });
        if (v2.ok) {
          parsed = parsed2;
          validated = v2;
        }
      } catch {
        /* keep first validation failure */
      }
    }

    unsupportedSpanCount += validated.unsupportedSpanCount;
    forbiddenTaxonomyFields += validated.forbiddenTaxonomyHits;

    rawOutputs.push({
      batchId: batch.batchId,
      attempt,
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

  for (const c of candidates) {
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
    candidateDecisionCoverage: allDecisions.size / candidates.length,
    decisionCounts,
    evidenceUnitCount: allUnits.length,
    explicitRatio: allUnits.length ? explicit / allUnits.length : 0,
    stronglySupportedRatio: allUnits.length ? strong / allUnits.length : 0,
    inferredRatio: allUnits.length ? inferred / allUnits.length : 0,
    unsupportedSpanCount,
    batchFailureCount,
    forbiddenTaxonomyFields,
    successfulBatches,
  };
  writeJson(outDir, 'coverage.json', coverage);

  writeJson(outDir, 'manual-review-template.json', {
    classification: 'CONFIDENTIAL',
    manualReviewStatus: 'PENDING_HUMAN',
    evidenceReviews: allUnits.map((u) => ({
      evidencePrototypeId: u.evidencePrototypeId,
      candidateId: u.candidateId,
      pageNumber: u.pageNumber,
      evidenceKind: u.evidenceKind,
      explicitness: u.explicitness,
      reviewRequired: u.reviewRequired,
      humanLabel: null,
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
        humanLabel: null,
        labelsAllowed: ['MISSED_EVIDENCE', 'CORRECT_REJECTION', 'UNCERTAIN'],
      })),
  });

  const countAfter = (
    await client.query(
      `SELECT COUNT(*)::int AS n FROM organigrama.mc_cv_snapshot`,
    )
  ).rows[0].n;
  await client.end();

  const schemaOk = batchFailureCount === 0 && unsupportedSpanCount === 0;
  const phaseOk =
    successfulBatches === 5 &&
    coverage.candidateDecisionCoverage === 1 &&
    forbiddenTaxonomyFields === 0 &&
    countBefore === countAfter;

  const summary = {
    status: phaseOk ? 'READY_FOR_P1_HUMAN_REVIEW' : 'BLOCKED',
    prototypeId,
    parentPrototypeId: BASE_PROTOTYPE,
    snapshotId: '1',
    model,
    secretFile: 'secrets/mc1-p1-prototype.local.env',
    keyStatus: 'PRESENT',
    preflight: pf,
    credencialExpuesta: false,
    candidates: 57,
    batches: 5,
    successfulBatches,
    failedBatches: batchFailureCount,
    retries,
    latencyTotalMs: latencyTotal,
    tokenUsage,
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
      provenance: 'OK',
      persistence: 'NONE',
      snapshotCountBefore: countBefore,
      snapshotCountAfter: countAfter,
      P2: false,
      Cloud: false,
    },
    review: {
      manualReviewStatus: 'PENDING_HUMAN',
      artifactPath: outDir,
      adr010: 'PROPOSED',
    },
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
