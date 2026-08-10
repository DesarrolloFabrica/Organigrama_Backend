/**
 * Regenera packs P1 v1.1 con decisions.json para snapshots cuyos packs OBS
 * omitieron candidateResults.
 *
 *   npx ts-node --transpile-only scripts/mc1-p1-6i-regen.ts --snapshots=5,6,7 --confirm
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { runP1ForMember } from '../src/mc-observatory/p1-member-runner';
import {
  packHasDecisions,
  resolveCohortArtifactDir,
} from '../src/mc-pipeline/p1-persistence/p1-artifact-pack-loader';
import {
  P1_CONTRACT_VERSION,
  P1_PROMPT_VERSION,
  P1_SEGMENTER_VERSION,
} from '../src/mc-pipeline/p1/p1.types';

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

function parseArgs(argv: string[]) {
  const snapsArg = argv.find((a) => a.startsWith('--snapshots='));
  const snapshots = (snapsArg?.split('=')[1] ?? '5,6,7')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { snapshots, confirm: argv.includes('--confirm') };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.confirm) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        hint: '--confirm required (may invoke Gemini)',
      }),
    );
    process.exit(2);
  }

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

  const results: unknown[] = [];
  try {
    for (const snapshotId of args.snapshots) {
      const existing = resolveCohortArtifactDir(ROOT, snapshotId);
      if (existing && packHasDecisions(existing)) {
        results.push({ snapshotId, action: 'SKIP_HAS_DECISIONS', dir: existing });
        continue;
      }

      const snap = await ds.query(
        `SELECT id, normalized_text, pages, sectioned_content
           FROM organigrama.mc_cv_snapshot WHERE id = $1`,
        [snapshotId],
      );
      if (!snap[0]?.normalized_text) {
        results.push({ snapshotId, action: 'FAILED', error: 'NO_SNAPSHOT' });
        continue;
      }

      const stamp = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, '')
        .slice(0, 14);
      const prototypeId = `P1P-V11-6I-S${snapshotId}-${stamp}-${randomUUID().slice(0, 8)}`;
      const outDir = resolve(ROOT, 'tmp', 'mc1-p1-prototype', prototypeId);
      mkdirSync(outDir, { recursive: true });

      writeFileSync(
        join(outDir, 'prototype-manifest.json'),
        JSON.stringify(
          {
            classification: 'CONFIDENTIAL',
            operationType: 'P1_6I_DECISIONS_REGEN',
            prototypeId,
            snapshotId: String(snapshotId),
            contractVersion: P1_CONTRACT_VERSION,
            segmenterVersion: P1_SEGMENTER_VERSION,
            promptVersion: P1_PROMPT_VERSION,
            modelProvider: 'google-genai',
            modelVersion: gem.GEMINI_MODEL || 'gemini-3.6-flash',
            startedAt: new Date().toISOString(),
            persistence: 'NONE',
            reason: 'OBS_PACK_STRIPPED_DECISIONS',
          },
          null,
          2,
        ),
        'utf8',
      );

      const run = await runP1ForMember({
        prototypeId,
        snapshotId: String(snapshotId),
        normalizedText: String(snap[0].normalized_text),
        pages: snap[0].pages,
        sectionedContent: snap[0].sectioned_content,
        apiKey: gem.GEMINI_API_KEY,
        model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
        outDir,
      });

      const batchesFile = JSON.parse(
        readFileSync(join(outDir, 'batches.json'), 'utf8'),
      ) as { batches: Array<{ batchId: string; candidateIds: string[] }> };
      const candToBatch = new Map<string, string>();
      for (const b of batchesFile.batches) {
        for (const id of b.candidateIds) candToBatch.set(id, b.batchId);
      }

      const decisions = [...run.decisions.entries()].map(
        ([candidateId, decision]) => ({
          candidateId,
          decision,
          reasonCode:
            decision === 'REVIEW_REQUIRED'
              ? 'NEEDS_REVIEW'
              : decision.startsWith('REJECTED')
                ? 'REJECTED'
                : 'OK',
          batchId: candToBatch.get(candidateId) ?? 'unknown',
        }),
      );

      writeFileSync(
        join(outDir, 'decisions.json'),
        JSON.stringify({ decisions }, null, 2),
        'utf8',
      );

      const rr = decisions.filter((d) => d.decision === 'REVIEW_REQUIRED').length;
      results.push({
        snapshotId,
        action: 'REGENERATED',
        prototypeId,
        ok: run.ok,
        status: run.status,
        candidates: run.candidateCount,
        units: run.units.length,
        reviewRequired: rr,
        geminiInvoked: true,
        decisionsSha16: createHash('sha256')
          .update(JSON.stringify(decisions))
          .digest('hex')
          .slice(0, 16),
      });
    }
  } finally {
    await ds.destroy();
  }

  console.log(JSON.stringify({ status: 'DONE', results }, null, 2));
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      status: 'FAILED',
      error: String(e instanceof Error ? e.message : e).slice(0, 240),
    }),
  );
  process.exit(1);
});
