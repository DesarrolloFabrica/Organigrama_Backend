/**
 * FASE 5G.1 — Evidence Observatory Pilot CLI
 *
 * npm run mc:observatory-pilot -- --dry-run
 * npm run mc:observatory-pilot -- --execute --confirm
 *
 * No P2. No Publisher. No Cloud. No tablas nuevas. No .env raíz para DB.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import {
  assertExecuteFlags,
  detectCloudConfigPresent,
  evaluateGuardrails,
} from '../src/mc-observatory/observatory-guardrails';
import {
  FROZEN_P1_CONFIG,
} from '../src/mc-observatory/observatory.constants';
import {
  ObservatoryRunService,
  redactCohortForConsole,
} from '../src/mc-observatory/observatory-run-service';
import { createMdeDataSource, createP0Service } from '../src/mc-observatory/p0-bootstrap';
import { hashObject } from '../src/mc-observatory/hash';
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

async function main() {
  const argv = process.argv.slice(2);
  try {
    assertExecuteFlags(argv);
  } catch (e) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: String(e instanceof Error ? e.message : e),
      }),
    );
    process.exit(2);
  }

  const dryRun = argv.includes('--dry-run');
  const execute = argv.includes('--execute');
  const confirm = argv.includes('--confirm');

  // Clear root DB_* to avoid accidental Cloud/.env root usage for DB
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }

  // Drive credentials (solo claves Drive; nunca DB_* del .env raíz)
  const driveAllow = new Set([
    'GOOGLE_DRIVE_CV_FOLDER_ID',
    'GOOGLE_DRIVE_CV_TOKEN_PATH',
    'GOOGLE_DRIVE_CV_AUTH_MODE',
    'GOOGLE_DRIVE_CV_OAUTH_CLIENT_PATH',
  ]);
  const driveEnv = loadEnvFile(resolve(ROOT, '.env'), driveAllow);
  for (const [k, v] of Object.entries(driveEnv)) {
    if (!process.env[k]?.trim()) process.env[k] = v;
  }

  const mde = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const host = mde.MDE_DB_HOST;
  const port = Number(mde.MDE_DB_PORT);
  const database = mde.MDE_DB_NAME;
  const username = mde.MDE_DB_USERNAME;
  const password = mde.MDE_DB_PASSWORD;

  const gemini = loadEnvFile(
    resolve(ROOT, 'secrets/mc1-p1-prototype.local.env'),
    new Set(['GEMINI_API_KEY', 'GEMINI_MODEL']),
  );
  const apiKey = gemini.GEMINI_API_KEY?.trim() || '';
  const model =
    gemini.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  const client = new Client({
    host,
    port,
    user: username,
    password,
    database,
  });

  try {
    await client.connect();
  } catch {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'MDE_CONNECT_FAILED' }));
    process.exit(3);
  }

  const svc = new ObservatoryRunService(ROOT, client);

  if (dryRun) {
    try {
      const plan = await svc.buildDryRunPlan();
      const guards = evaluateGuardrails({
        mde: { host, port, database },
        cohort: plan.cohortSpec,
        modelVersion: FROZEN_P1_CONFIG.modelVersion,
        segmenterVersion: FROZEN_P1_CONFIG.segmenterVersion,
        promptVersion: FROZEN_P1_CONFIG.promptVersion,
        contractVersion: FROZEN_P1_CONFIG.contractVersion,
        geminiApiKeyPresent: apiKey.length >= 20,
        publisherEnabled: false,
        p2Enabled: false,
        cloudConfigPresent: detectCloudConfigPresent(process.env),
        execute: false,
        confirm: false,
        dryRunPlanHash: plan.reproHash,
        expectedDryRunPlanHash: plan.reproHash,
      });

      if (!guards.ok) {
        console.log(
          JSON.stringify({
            status: 'BLOCKED',
            mode: 'DRY_RUN',
            errors: guards.errors,
          }),
        );
        await client.end();
        process.exit(4);
      }

      // model in secrets must match frozen for future execute
      if (model !== FROZEN_P1_CONFIG.modelVersion) {
        console.log(
          JSON.stringify({
            status: 'BLOCKED',
            mode: 'DRY_RUN',
            reason: 'MODEL_VERSION_MISMATCH',
          }),
        );
        await client.end();
        process.exit(4);
      }

      const root = await svc.writeDryRunArtifacts(plan);
      console.log(
        JSON.stringify(
          {
            status: 'DRY_RUN_READY',
            mode: 'DRY_RUN',
            cohort: redactCohortForConsole(plan.cohortSpec),
            reproHash: plan.reproHash,
            configFingerprint: plan.configFingerprint.slice(0, 16) + '…',
            estimatedP1Calls: plan.estimatedP1Calls,
            estimatedBatches: plan.estimatedBatches,
            estimatedDurationMs: plan.estimatedDurationMs,
            membersNeedingP0: plan.membersNeedingP0,
            anchorReusePlan: plan.anchorReusePlan,
            artifactRoot: root,
            next: 'npm run mc:observatory-pilot -- --execute --confirm',
            aiCalled: false,
            p0Called: false,
            pdfDownloaded: false,
          },
          null,
          2,
        ),
      );
      await client.end();
      process.exit(0);
    } catch (e) {
      console.log(
        JSON.stringify({
          status: 'BLOCKED',
          mode: 'DRY_RUN',
          reason: String(e instanceof Error ? e.message : e).slice(0, 200),
        }),
      );
      await client.end();
      process.exit(5);
    }
  }

  // EXECUTE
  let dryRunPlan;
  try {
    dryRunPlan = svc.loadDryRunPlan();
  } catch {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'DRY_RUN_PLAN_MISSING' }));
    await client.end();
    process.exit(6);
  }

  // Rebuild cohort to verify reproHash stability (member identity)
  const fresh = await svc.buildDryRunPlan();
  const sameMembers =
    fresh.cohortSpec.members.length === dryRunPlan.cohortSpec.members.length &&
    fresh.cohortSpec.members.every((m, i) => {
      const o = dryRunPlan.cohortSpec.members[i];
      return m.personCvId === o.personCvId && m.role === o.role;
    });
  if (!sameMembers || fresh.reproHash !== dryRunPlan.reproHash) {
    // Allow snapshotId fill-in after P0 without blocking if personCvId+role stable
    const identityHash = (spec: typeof dryRunPlan.cohortSpec) =>
      hashObject(
        spec.members.map((m) => ({
          personCvId: m.personCvId,
          role: m.role,
          selectionReasonCode: m.selectionReasonCode,
        })),
      );
    const idA = identityHash(dryRunPlan.cohortSpec);
    const idB = identityHash(fresh.cohortSpec);
    if (idA !== idB) {
      console.log(
        JSON.stringify({
          status: 'BLOCKED',
          reason: 'DRY_RUN_REPRO_HASH_CHANGED',
          expected: dryRunPlan.reproHash.slice(0, 12),
          actual: fresh.reproHash.slice(0, 12),
        }),
      );
      await client.end();
      process.exit(7);
    }
    // Update plan members with fresh snapshotIds while keeping frozen reproHash from dry-run identity
    dryRunPlan = {
      ...dryRunPlan,
      cohortSpec: {
        ...dryRunPlan.cohortSpec,
        members: dryRunPlan.cohortSpec.members.map((m) => {
          const f = fresh.cohortSpec.members.find(
            (x) => x.personCvId === m.personCvId && x.role === m.role,
          );
          return f
            ? {
                ...m,
                snapshotId: f.snapshotId ?? m.snapshotId,
                snapshotStatus: f.snapshotStatus ?? m.snapshotStatus,
                selectionMetrics: f.selectionMetrics,
              }
            : m;
        }),
      },
    };
  }

  const guards = evaluateGuardrails({
    mde: { host, port, database },
    cohort: dryRunPlan.cohortSpec,
    modelVersion: model,
    segmenterVersion: FROZEN_P1_CONFIG.segmenterVersion,
    promptVersion: FROZEN_P1_CONFIG.promptVersion,
    contractVersion: FROZEN_P1_CONFIG.contractVersion,
    geminiApiKeyPresent: apiKey.length >= 20,
    publisherEnabled: false,
    p2Enabled: false,
    cloudConfigPresent: detectCloudConfigPresent(process.env),
    execute,
    confirm,
    dryRunPlanHash: dryRunPlan.reproHash,
    expectedDryRunPlanHash: fresh.reproHash,
  });

  if (!guards.ok) {
    console.log(JSON.stringify({ status: 'BLOCKED', errors: guards.errors }));
    await client.end();
    process.exit(8);
  }

  const ds = await createMdeDataSource({
    host,
    port,
    database,
    username,
    password,
  });
  const p0 = createP0Service(ds, { host, port, database });

  try {
    const run = await svc.execute({
      apiKey,
      model,
      p0,
      dryRunPlan,
    });
    const topKind = Object.entries(run.aggregateMetrics.evidenceKindTotals).sort(
      (a, b) => b[1] - a[1],
    )[0];

    console.log(
      JSON.stringify(
        {
          status: run.manifest.status,
          observatoryRunId: run.manifest.observatoryRunId,
          cohortCode: run.manifest.cohortCode,
          cohortVersion: run.manifest.cohortVersion,
          reproHash: run.manifest.cohortReproHash,
          membersCompleted: run.aggregateMetrics.membersCompleted,
          membersPartial: run.aggregateMetrics.membersPartial,
          snapshotsCreated: run.aggregateMetrics.snapshotsCreated,
          snapshotsReused: run.aggregateMetrics.snapshotsReused,
          totalBatches: run.aggregateMetrics.totalBatches,
          retries: run.aggregateMetrics.totalRetries,
          durationMs: run.aggregateMetrics.totalDurationMs,
          evidenceUnitsTotal: run.aggregateMetrics.totalEvidenceUnits,
          evidenceKindTop: topKind ? topKind[0] : null,
          explicit: run.aggregateMetrics.explicitTotal,
          stronglySupported: run.aggregateMetrics.stronglySupportedTotal,
          inferred: run.aggregateMetrics.inferredTotal,
          reviewRequired: run.aggregateMetrics.reviewRequiredTotal,
          outliers: run.aggregateMetrics.outlierMemberIndexes,
          signatures: run.memberResults.filter((m) => m.signature).length,
          publisherInvoked: false,
          p2Invoked: false,
          databasePersistence: false,
          artifactRoot: run.manifest.artifactRoot,
        },
        null,
        2,
      ),
    );
  } finally {
    await ds.destroy();
    await client.end();
  }
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      status: 'FAILED',
      reason: String(e instanceof Error ? e.message : e).slice(0, 200),
    }),
  );
  process.exit(1);
});
