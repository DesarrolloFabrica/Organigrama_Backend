/**
 * FASE 8D — Primer P4 funcional (ARTIFACT_ONLY skill discovery).
 *
 *   npx ts-node --transpile-only scripts/mc1-p4-skill-discovery-8d.ts --snapshots=1,2 --confirm
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { runP4ArtifactOnly } from '../src/mc-pipeline/p4/p4-runner';

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
  const p3Pack = argv.find((a) => a.startsWith('--p3-pack='))?.split('=')[1];
  const snapshots = (many ?? one ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { snapshots, confirm: argv.includes('--confirm'), r1Pack, p3Pack };
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
      const run = await runP4ArtifactOnly({
        backendRoot: ROOT,
        snapshotId,
        dataSource: ds,
        apiKey: gem.GEMINI_API_KEY,
        model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
        outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
        r1PackDir: args.r1Pack,
        p3PackDir: args.p3Pack,
      });
      const p = run.envelope.payload;
      results.push({
        snapshotId,
        outDir: run.outDir,
        geminiInvoked: run.geminiInvoked,
        r1PackDir: run.loaded.r1PackDir,
        p3PackDir: run.loaded.p3PackDir,
        outcomeStatus: p.outcomeStatus,
        specialtiesEvaluated: p.specialtiesEvaluated,
        specialtyResults: p.specialtyResults.map((sr) => ({
          fieldCode: sr.fieldCode,
          specialtyCode: sr.specialtyCode,
          skills: sr.observedSkills.map((sk) => ({
            skillCode: sk.skillCode,
            name: sk.name,
            status: sk.status,
            confidence: sk.confidence,
            support: sk.supportingEvidenceUnitIds.length,
            tools: sk.toolOrTechnologySignals,
            signals: sk.supportingSignals,
            rationale: sk.rationaleCode,
          })),
        })),
        r1Unchanged: p.r1Unchanged,
        p3Unchanged: p.p3Unchanged,
        warningCodes: run.envelope.warnings.map((w) => w.code),
      });
    }
  } finally {
    await ds.destroy();
  }

  console.log(
    JSON.stringify({ phase: '8D', mode: 'ARTIFACT_ONLY', status: 'DONE', results }, null, 2),
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
