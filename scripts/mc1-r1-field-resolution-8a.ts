/**
 * FASE 8A — R1 Field Resolution (ARTIFACT_ONLY).
 *
 *   npx ts-node --transpile-only scripts/mc1-r1-field-resolution-8a.ts --snapshots=1,2
 */
import { resolve } from 'node:path';
import { runR1ArtifactOnly } from '../src/mc-pipeline/r1/r1-runner';

const ROOT = resolve(__dirname, '..');

function parseArgs(argv: string[]) {
  const one = argv.find((a) => a.startsWith('--snapshot='))?.split('=')[1];
  const many = argv.find((a) => a.startsWith('--snapshots='))?.split('=')[1];
  const p2Pack = argv.find((a) => a.startsWith('--p2-pack='))?.split('=')[1];
  const snapshots = (many ?? one ?? '1,2')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { snapshots, p2Pack };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const results: unknown[] = [];

  for (const snapshotId of args.snapshots) {
    const run = runR1ArtifactOnly({
      backendRoot: ROOT,
      snapshotId,
      p2PackDir: args.p2Pack,
    });
    const p = run.envelope.payload;
    results.push({
      snapshotId,
      outDir: run.outDir,
      p2PackDir: run.p2PackDir,
      fieldResolutionStatus: p.fieldResolutionStatus,
      resolutionStatus: p.resolutionStatus,
      professionalField: p.primaryField?.fieldCode ?? p.primaryField?.sourceKey,
      primaryConfidence: p.primaryField?.confidence ?? null,
      secondaries: p.secondaryFields.map((f) => ({
        code: f.fieldCode ?? f.sourceKey,
        confidence: f.confidence,
      })),
      decisionCodes: p.decisionCodes,
      explanation: p.decisionExplanation,
    });
  }

  console.log(
    JSON.stringify(
      {
        phase: '8A',
        mode: 'ARTIFACT_ONLY',
        iaInvoked: false,
        status: 'DONE',
        results,
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (e) {
  console.log(
    JSON.stringify({
      status: 'FAILED',
      error: String(e instanceof Error ? e.message : e).slice(0, 300),
    }),
  );
  process.exit(1);
}
