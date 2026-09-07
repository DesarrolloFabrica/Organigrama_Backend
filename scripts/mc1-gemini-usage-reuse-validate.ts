/**
 * Validación LIVE: usage ledger + reuse gate. UNA sola persona (control).
 *
 *   npx ts-node --transpile-only scripts/mc1-gemini-usage-reuse-validate.ts --confirm
 *   npx ts-node --transpile-only scripts/mc1-gemini-usage-reuse-validate.ts --confirm --force
 *
 * RUN 1: pipeline con forceRecompute (Gemini real)
 * RUN 2: idéntico, reuse permitido (0 llamadas Gemini)
 * RUN 3: override de fingerprint SOLO en P3 (invalidación selectiva)
 *
 * --force en este script fuerza RUN 1. No altera prompts ni modelos.
 * --force-live-ai NO es force recompute.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { runP1ForMember } from '../src/mc-observatory/p1-member-runner';
import { runP2ArtifactOnly } from '../src/mc-pipeline/p2/p2-runner';
import { runR1ArtifactOnly } from '../src/mc-pipeline/r1/r1-runner';
import { runP3ArtifactOnly } from '../src/mc-pipeline/p3/p3-runner';
import { runP4ArtifactOnly } from '../src/mc-pipeline/p4/p4-runner';
import {
  P1_PROMPT_VERSION,
  P1_SEGMENTER_VERSION,
} from '../src/mc-pipeline/p1/p1.types';
import {
  aggregateGeminiUsage,
  filterLedgerByRun,
  groupGeminiUsage,
  readGeminiLedgerEvents,
  type GeminiLedgerEvent,
} from '../src/mc-pipeline/gemini';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-gemini-usage-reuse-validate');
const LEDGER_PATH = join(OUT_DIR, 'events.jsonl');
const REPORT_PATH = join(OUT_DIR, 'validation-report.json');

const DEFAULT_PERSON_ID = '1349';
const DEFAULT_SNAPSHOT_ID = '19';
const P3_TEST_OVERRIDE = { specialtyCatalogVersion: 'TEST_INVALIDATION_ONLY' };

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

function argValue(flag: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`${flag}=`))?.split('=')[1];
}

function phaseSummary(events: GeminiLedgerEvent[]) {
  const calls = events.filter((e) => e.eventType === 'GEMINI_CALL');
  const reuse = events.filter((e) => e.eventType === 'REUSE');
  const byPhase = groupGeminiUsage(events, 'phase');
  const totals = aggregateGeminiUsage(events);
  return {
    executed: calls.filter((e) => e.status !== 'FAILED').map((e) => e.phase),
    reused: reuse.map((e) => e.phase),
    geminiCalls: totals.calls,
    successfulCalls: totals.successfulCalls,
    failedCalls: totals.failedCalls,
    retries: totals.retryCalls,
    tokens: totals.calls === 0 ? 0 : totals.totalTokens,
    promptTokens: totals.calls === 0 ? 0 : totals.promptTokens,
    candidateTokens: totals.calls === 0 ? 0 : totals.candidateTokens,
    thinkingTokens: totals.thinkingTokens,
    thinkingUsage: totals.thinkingUsage,
    byPhase,
  };
}

async function runPipeline(args: {
  ds: DataSource;
  snapshotId: string;
  personId: string;
  personCvId: string | null;
  snap: {
    normalized_text: string;
    pages: unknown;
    sectioned_content: unknown;
  };
  apiKey: string;
  model: string;
  runId: string;
  forceRecompute: boolean;
  p3Overrides?: Record<string, string>;
}) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const prototypeId = `P1P-V11-6I-S${args.snapshotId}-${stamp}-${randomUUID().slice(0, 8)}`;
  const p1Out = resolve(ROOT, 'tmp', 'mc1-p1-prototype', prototypeId);
  mkdirSync(p1Out, { recursive: true });
  writeFileSync(
    join(p1Out, 'prototype-manifest.json'),
    JSON.stringify(
      {
        classification: 'CONFIDENTIAL',
        operationType: 'P1_USAGE_REUSE_VALIDATE',
        prototypeId,
        snapshotId: args.snapshotId,
        contractVersion: '2.0.0',
        segmenterVersion: P1_SEGMENTER_VERSION,
        promptVersion: P1_PROMPT_VERSION,
        modelProvider: 'google-genai',
        modelVersion: args.model,
        startedAt: new Date().toISOString(),
        persistence: 'NONE',
      },
      null,
      2,
    ),
    'utf8',
  );

  const pages =
    typeof args.snap.pages === 'string' ? JSON.parse(args.snap.pages) : args.snap.pages;
  const sectioned =
    typeof args.snap.sectioned_content === 'string'
      ? JSON.parse(args.snap.sectioned_content)
      : args.snap.sectioned_content;

  const p1 = await runP1ForMember({
    prototypeId,
    snapshotId: args.snapshotId,
    normalizedText: args.snap.normalized_text,
    pages,
    sectionedContent: sectioned,
    apiKey: args.apiKey,
    model: args.model,
    outDir: p1Out,
    personId: args.personId,
    personCvId: args.personCvId ?? undefined,
    runId: args.runId,
    backendRoot: ROOT,
    forceRecompute: args.forceRecompute,
  });
  if (!p1.ok) {
    throw new Error(`P1_FAILED:${p1.errorCode ?? p1.status}`);
  }

  const batchesFile = JSON.parse(
    readFileSync(join(p1Out, 'batches.json'), 'utf8'),
  ) as { batches: Array<{ batchId: string; candidateIds: string[] }> };
  const candToBatch = new Map<string, string>();
  for (const b of batchesFile.batches) {
    for (const id of b.candidateIds) candToBatch.set(id, b.batchId);
  }
  const decisions = [...p1.decisions.entries()].map(
    ([candidateId, decision]) => ({
      candidateId,
      decision,
      reasonCode:
        decision === 'REVIEW_REQUIRED'
          ? 'NEEDS_REVIEW'
          : String(decision).startsWith('REJECTED')
            ? 'REJECTED'
            : 'OK',
      batchId: candToBatch.get(candidateId) ?? 'unknown',
    }),
  );
  writeFileSync(
    join(p1Out, 'decisions.json'),
    JSON.stringify({ decisions }, null, 2),
    'utf8',
  );

  const p2 = await runP2ArtifactOnly({
    backendRoot: ROOT,
    snapshotId: args.snapshotId,
    dataSource: args.ds,
    apiKey: args.apiKey,
    model: args.model,
    outRoot: resolve(ROOT, 'tmp', 'mc1-p2-functional'),
    pipelineRunId: args.runId,
    personId: args.personId,
    forceRecompute: args.forceRecompute,
  });

  const r1 = runR1ArtifactOnly({
    backendRoot: ROOT,
    snapshotId: args.snapshotId,
    p2PackDir: p2.outDir,
  });

  const p3 = await runP3ArtifactOnly({
    backendRoot: ROOT,
    snapshotId: args.snapshotId,
    dataSource: args.ds,
    apiKey: args.apiKey,
    model: args.model,
    outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
    r1PackDir: r1.outDir,
    pipelineRunId: args.runId,
    personId: args.personId,
    forceRecompute: args.forceRecompute,
    fingerprintOverrides: args.p3Overrides,
  });

  const p4 = await runP4ArtifactOnly({
    backendRoot: ROOT,
    snapshotId: args.snapshotId,
    dataSource: args.ds,
    apiKey: args.apiKey,
    model: args.model,
    outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
    r1PackDir: r1.outDir,
    p3PackDir: p3.outDir,
    pipelineRunId: args.runId,
    personId: args.personId,
    forceRecompute: args.forceRecompute,
  });

  return {
    p1: {
      executionStatus: p1.executionStatus,
      geminiInvoked: p1.geminiInvoked,
      status: p1.status,
      batchCount: p1.batchCount,
      reuseFingerprint: p1.reuseFingerprint,
      sourceArtifactId: p1.sourceArtifactId,
    },
    p2: {
      executionStatus: p2.executionStatus,
      geminiInvoked: p2.geminiInvoked,
      reuseFingerprint: p2.reuseFingerprint,
      sourceArtifactId: p2.sourceArtifactId,
    },
    r1: { outDir: r1.outDir },
    p3: {
      executionStatus: p3.executionStatus,
      geminiInvoked: p3.geminiInvoked,
      reuseFingerprint: p3.reuseFingerprint,
      sourceArtifactId: p3.sourceArtifactId,
    },
    p4: {
      executionStatus: p4.executionStatus,
      geminiInvoked: p4.geminiInvoked,
      reuseFingerprint: p4.reuseFingerprint,
      sourceArtifactId: p4.sourceArtifactId,
    },
  };
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        hint: '--confirm required (may invoke Gemini on RUN 1 / RUN 3)',
      }),
    );
    process.exit(2);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  process.env.MC1_GEMINI_LEDGER_PATH = LEDGER_PATH;

  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const mde = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const gem = loadEnvFile(
    resolve(ROOT, 'secrets/mc1-p1-prototype.local.env'),
    new Set(['GEMINI_API_KEY', 'GEMINI_MODEL']),
  );
  assertMdeTarget({
    host: mde.MDE_DB_HOST,
    port: Number(mde.MDE_DB_PORT),
    database: mde.MDE_DB_NAME,
  });
  if (!gem.GEMINI_API_KEY) {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'NO_GEMINI_KEY' }));
    process.exit(2);
  }

  const personId = argValue('--person') ?? DEFAULT_PERSON_ID;
  const snapshotId = argValue('--snapshot') ?? DEFAULT_SNAPSHOT_ID;
  const model = gem.GEMINI_MODEL || 'gemini-3.6-flash';

  const ds = new DataSource({
    type: 'postgres',
    host: mde.MDE_DB_HOST,
    port: Number(mde.MDE_DB_PORT),
    username: mde.MDE_DB_USERNAME,
    password: mde.MDE_DB_PASSWORD,
    database: mde.MDE_DB_NAME,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();

  try {
    const rows = await ds.query(
      `
      SELECT
        s.id::text AS snapshot_id,
        s.person_cv_id::text AS person_cv_id,
        pc.person_id::text AS person_id,
        s.normalized_text,
        s.pages,
        s.sectioned_content,
        s.parse_status
      FROM organigrama.mc_cv_snapshot s
      JOIN organigrama.person_cv pc ON pc.id = s.person_cv_id
      WHERE s.id = $1
      LIMIT 1
      `,
      [snapshotId],
    );
    const snap = rows?.[0];
    if (!snap?.normalized_text || snap.parse_status !== 'PARSED') {
      console.log(
        JSON.stringify({
          status: 'BLOCKED',
          reason: 'SNAPSHOT_NOT_READY',
          snapshotId,
        }),
      );
      process.exit(2);
    }
    if (String(snap.person_id) !== String(personId)) {
      console.log(
        JSON.stringify({
          status: 'BLOCKED',
          reason: 'PERSON_SNAPSHOT_MISMATCH',
          expectedPersonId: personId,
          actualPersonId: snap.person_id,
          snapshotId,
        }),
      );
      process.exit(2);
    }

    const stamp = Date.now();
    const run1Id = `usage-reuse-r1-${stamp}`;
    const run2Id = `usage-reuse-r2-${stamp}`;
    const run3Id = `usage-reuse-r3-${stamp}`;

    const run1Phases = await runPipeline({
      ds,
      snapshotId,
      personId,
      personCvId: snap.person_cv_id,
      snap,
      apiKey: gem.GEMINI_API_KEY,
      model,
      runId: run1Id,
      forceRecompute: true,
    });
    const run2Phases = await runPipeline({
      ds,
      snapshotId,
      personId,
      personCvId: snap.person_cv_id,
      snap,
      apiKey: gem.GEMINI_API_KEY,
      model,
      runId: run2Id,
      forceRecompute: false,
    });
    const run3Phases = await runPipeline({
      ds,
      snapshotId,
      personId,
      personCvId: snap.person_cv_id,
      snap,
      apiKey: gem.GEMINI_API_KEY,
      model,
      runId: run3Id,
      forceRecompute: false,
      p3Overrides: P3_TEST_OVERRIDE,
    });

    const all = readGeminiLedgerEvents(ROOT);
    const s1 = phaseSummary(filterLedgerByRun(all, run1Id));
    const s2 = phaseSummary(filterLedgerByRun(all, run2Id));
    const s3 = phaseSummary(filterLedgerByRun(all, run3Id));
    const control = aggregateGeminiUsage(filterLedgerByRun(all, run1Id));

    const callsAvoided = s1.geminiCalls - s2.geminiCalls;
    const tokensAvoided =
      (s1.tokens ?? 0) - (s2.tokens ?? 0);
    const reductionPct =
      s1.geminiCalls > 0 ? Math.round((callsAvoided / s1.geminiCalls) * 1000) / 10 : null;

    const report = {
      status:
        s2.geminiCalls === 0 &&
        run2Phases.p1.executionStatus === 'REUSED' &&
        run2Phases.p2.executionStatus === 'REUSED' &&
        run2Phases.p3.executionStatus === 'REUSED' &&
        run2Phases.p4.executionStatus === 'REUSED' &&
        run3Phases.p1.executionStatus === 'REUSED' &&
        run3Phases.p2.executionStatus === 'REUSED' &&
        run3Phases.p3.executionStatus === 'EXECUTED' &&
        run3Phases.p4.executionStatus === 'EXECUTED'
          ? 'USAGE_AND_REUSE_VALIDATED'
          : 'USAGE_AND_REUSE_PARTIAL',
      control: {
        personId,
        snapshotId,
        model,
        p1Calls: s1.byPhase.P1?.calls ?? 0,
        p1Tokens: s1.byPhase.P1?.totalTokens ?? null,
        p2Calls: s1.byPhase.P2?.calls ?? 0,
        p2Tokens: s1.byPhase.P2?.totalTokens ?? null,
        p3Calls: s1.byPhase.P3?.calls ?? 0,
        p3Tokens: s1.byPhase.P3?.totalTokens ?? null,
        p4Calls: s1.byPhase.P4?.calls ?? 0,
        p4Tokens: s1.byPhase.P4?.totalTokens ?? null,
        thinkingTokens: control.thinkingTokens,
        thinkingUsage: control.thinkingUsage,
        totalCalls: control.calls,
        totalTokens: control.totalTokens,
      },
      run1: { phases: run1Phases, ledger: s1 },
      run2: { phases: run2Phases, ledger: s2 },
      run3: {
        phases: run3Phases,
        ledger: s3,
        p3Override: P3_TEST_OVERRIDE,
        note: 'P3 fingerprint override TEST_INVALIDATION_ONLY; P4 depends on p3ResultIdentity',
      },
      savings: {
        callsAvoided,
        tokensAvoided: s1.tokens == null && s2.tokens == null ? null : tokensAvoided,
        callReductionPct: reductionPct,
      },
      ledgerPath: LEDGER_PATH,
    };

    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
