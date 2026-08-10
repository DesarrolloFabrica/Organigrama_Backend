/**
 * FASE 8B — Primer P3 funcional (ARTIFACT_ONLY specialty discovery).
 *
 *   npx ts-node --transpile-only scripts/mc1-p3-specialty-discovery-8b.ts --snapshots=1,2 --confirm
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { runP3ArtifactOnly } from '../src/mc-pipeline/p3/p3-runner';

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
  const one = argv.find((a) => a.startsWith('--snapshot='))?.split('=')[1];
  const many = argv.find((a) => a.startsWith('--snapshots='))?.split('=')[1];
  const r1Pack = argv.find((a) => a.startsWith('--r1-pack='))?.split('=')[1];
  const snapshots = (many ?? one ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    snapshots,
    confirm: argv.includes('--confirm'),
    r1Pack,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.confirm) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        hint: '--confirm required (invokes Gemini)',
      }),
    );
    process.exit(2);
  }
  if (!args.snapshots.length) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'SNAPSHOT_REQUIRED',
        hint: '--snapshot=1 or --snapshots=1,2',
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
      const run = await runP3ArtifactOnly({
        backendRoot: ROOT,
        snapshotId,
        dataSource: ds,
        apiKey: gem.GEMINI_API_KEY,
        model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
        outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
        r1PackDir: args.r1Pack,
      });
      const p = run.envelope.payload;
      results.push({
        snapshotId,
        outDir: run.outDir,
        geminiInvoked: run.geminiInvoked,
        r1PackDir: run.loaded.r1PackDir,
        r1Status: p.r1FieldResolutionStatus,
        fieldsEvaluated: p.fieldsEvaluated,
        outcomeStatus: p.outcomeStatus,
        r1Unchanged: p.r1Unchanged,
        fieldResults: p.fieldResults.map((fr) => ({
          fieldCode: fr.fieldCode,
          specialties: fr.observedSpecialties.map((s) => ({
            code: s.specialtyCode,
            status: s.status,
            confidence: s.confidence,
            support: s.supportingEvidenceUnitIds.length,
            rationale: s.rationaleCode,
          })),
        })),
        warningCodes: run.envelope.warnings.map((w) => w.code),
      });
    }
  } finally {
    await ds.destroy();
  }

  console.log(
    JSON.stringify(
      {
        phase: '8B',
        mode: 'ARTIFACT_ONLY',
        status: 'DONE',
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      status: 'FAILED',
      error: String(e instanceof Error ? e.message : e).slice(0, 400),
    }),
  );
  process.exit(1);
});
