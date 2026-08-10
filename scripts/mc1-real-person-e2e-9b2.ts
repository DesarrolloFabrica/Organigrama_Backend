/**
 * FASE 9B.2 — End-to-end real person (Camilo) ARTIFACT_ONLY.
 *
 *   npx ts-node --transpile-only scripts/mc1-real-person-e2e-9b2.ts --confirm
 *
 * Localiza por documento (solo server-side), P0 create/reuse, P1→…→Profile.
 * No imprime PII ni texto de CV.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import {
  createMdeDataSource,
  createP0Service,
} from '../src/mc-observatory/p0-bootstrap';
import { runP1ForMember } from '../src/mc-observatory/p1-member-runner';
import {
  packHasDecisions,
  resolveCohortArtifactDir,
} from '../src/mc-pipeline/p1-persistence/p1-artifact-pack-loader';
import { runP2ArtifactOnly } from '../src/mc-pipeline/p2/p2-runner';
import { runR1ArtifactOnly } from '../src/mc-pipeline/r1/r1-runner';
import { runP3ArtifactOnly } from '../src/mc-pipeline/p3/p3-runner';
import { runP4ArtifactOnly } from '../src/mc-pipeline/p4/p4-runner';
import { runProfilePilot } from '../src/mc-pipeline/profile/profile-runner';
import { SPECIALTY_CATALOG_SCOPE } from '../src/mc-pipeline/catalog/specialties-visual-education';
import {
  P1_PROMPT_VERSION,
  P1_SEGMENTER_VERSION,
} from '../src/mc-pipeline/p1/p1.types';
import { randomUUID } from 'node:crypto';

const ROOT = resolve(__dirname, '..');
const CASE_ID = 'person-camilo';
const DOCUMENT = '1000518830';
const BINDINGS_PATH = resolve(
  ROOT,
  'tmp',
  'mc1-profile-preview',
  'real-person-bindings.json',
);

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

function writeBindings(snapshotId: string) {
  mkdirSync(resolve(ROOT, 'tmp', 'mc1-profile-preview'), { recursive: true });
  let current: Record<string, { snapshotId: string; boundAt: string }> = {};
  if (existsSync(BINDINGS_PATH)) {
    try {
      current = JSON.parse(readFileSync(BINDINGS_PATH, 'utf8'));
    } catch {
      current = {};
    }
  }
  current[CASE_ID] = {
    snapshotId: String(snapshotId),
    boundAt: new Date().toISOString(),
  };
  writeFileSync(BINDINGS_PATH, JSON.stringify(current, null, 2), 'utf8');
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
      }),
    );
    process.exit(2);
  }

  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  // Drive credentials from .env (never DB_*)
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

  const mdeEnv = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const gem = loadEnvFile(
    resolve(ROOT, 'secrets/mc1-p1-prototype.local.env'),
    new Set(['GEMINI_API_KEY', 'GEMINI_MODEL']),
  );
  const mde = {
    host: mdeEnv.MDE_DB_HOST,
    port: Number(mdeEnv.MDE_DB_PORT),
    database: mdeEnv.MDE_DB_NAME,
    username: mdeEnv.MDE_DB_USERNAME,
    password: mdeEnv.MDE_DB_PASSWORD,
  };
  assertMdeTarget(mde);
  if (!gem.GEMINI_API_KEY) {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'NO_GEMINI_KEY' }));
    process.exit(2);
  }

  const dsP0 = await createMdeDataSource(mde);
  const p0 = createP0Service(dsP0, mde);

  const rows = await dsP0.query(
    `
    SELECT
      p.id AS person_id,
      pc.id AS person_cv_id,
      (
        SELECT s.id::text
        FROM organigrama.mc_cv_snapshot s
        WHERE s.person_cv_id = pc.id AND s.parse_status = 'PARSED'
          AND s.normalized_text IS NOT NULL AND length(s.normalized_text) > 0
        ORDER BY s.created_at DESC NULLS LAST, s.id DESC
        LIMIT 1
      ) AS ready_snapshot_id
    FROM core.person p
    LEFT JOIN organigrama.person_cv pc
      ON pc.person_id = p.id AND pc.is_active = true
    WHERE p.document = $1
    LIMIT 1
    `,
    [DOCUMENT],
  );
  const row = rows?.[0];
  if (!row?.person_cv_id) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'PERSON_CV_NOT_FOUND',
        caseId: CASE_ID,
      }),
    );
    await dsP0.destroy();
    process.exit(2);
  }

  const personCvId = Number(row.person_cv_id);
  let snapshotId = row.ready_snapshot_id ? String(row.ready_snapshot_id) : null;
  let p0Origin: 'REUSED_EXISTING_PARSED' | 'CREATED' | 'REUSED_P0' =
    'REUSED_EXISTING_PARSED';

  if (!snapshotId) {
    const result = await p0.createOrReuseFromPersonCv(personCvId);
    snapshotId = String(result.snapshotId);
    p0Origin = result.outcome === 'CREATED' ? 'CREATED' : 'REUSED_P0';
  }

  await dsP0.destroy();

  // Shared TypeORM DS for P1/P2/P3/P4 evidence loads
  const ds = new DataSource({
    type: 'postgres',
    host: mde.host,
    port: mde.port,
    username: mde.username,
    password: mde.password,
    database: mde.database,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();

  const stages: Record<string, unknown> = {
    caseId: CASE_ID,
    personCvId,
    snapshotId,
    p0: p0Origin,
  };

  try {
    // P1 — reuse pack with decisions if present
    let p1Dir = resolveCohortArtifactDir(ROOT, snapshotId);
    let p1Origin = 'REUSED';
    if (!p1Dir || !packHasDecisions(p1Dir)) {
      const snap = (
        await ds.query(
          `SELECT id::text AS id, normalized_text, pages, sectioned_content, parse_status
             FROM organigrama.mc_cv_snapshot WHERE id = $1`,
          [snapshotId],
        )
      )[0];
      if (!snap?.normalized_text || snap.parse_status !== 'PARSED') {
        throw new Error(`SNAPSHOT_NOT_READY:${snapshotId}`);
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
            operationType: 'P1_9B2_REAL_PERSON',
            prototypeId,
            snapshotId: String(snapshotId),
            segmenterVersion: P1_SEGMENTER_VERSION,
            promptVersion: P1_PROMPT_VERSION,
            modelProvider: 'google-genai',
            modelVersion: gem.GEMINI_MODEL || 'gemini-3.6-flash',
            startedAt: new Date().toISOString(),
            persistence: 'NONE',
          },
          null,
          2,
        ),
        'utf8',
      );
      const pages =
        typeof snap.pages === 'string' ? JSON.parse(snap.pages) : snap.pages;
      const sectioned =
        typeof snap.sectioned_content === 'string'
          ? JSON.parse(snap.sectioned_content)
          : snap.sectioned_content;
      const p1Result = await runP1ForMember({
        prototypeId,
        snapshotId: String(snapshotId),
        normalizedText: snap.normalized_text,
        pages,
        sectionedContent: sectioned,
        apiKey: gem.GEMINI_API_KEY,
        model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
        outDir,
      });
      if (!p1Result.ok) {
        throw new Error(`P1_FAILED:${p1Result.errorCode ?? p1Result.status}`);
      }
      const batchesFile = JSON.parse(
        readFileSync(join(outDir, 'batches.json'), 'utf8'),
      ) as { batches: Array<{ batchId: string; candidateIds: string[] }> };
      const candToBatch = new Map<string, string>();
      for (const b of batchesFile.batches) {
        for (const id of b.candidateIds) candToBatch.set(id, b.batchId);
      }
      const decisions = [...p1Result.decisions.entries()].map(
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
        join(outDir, 'decisions.json'),
        JSON.stringify({ decisions }, null, 2),
        'utf8',
      );
      p1Dir = outDir;
      p1Origin = 'CREATED';
    }
    stages.p1 = { origin: p1Origin, packDir: p1Dir };

    // P2
    const p2 = await runP2ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
      outRoot: resolve(ROOT, 'tmp', 'mc1-p2-functional'),
    });
    stages.p2 = {
      origin: 'CREATED',
      packDir: p2.outDir,
      outcomeStatus: p2.envelope.payload.outcomeStatus,
      candidates: p2.envelope.payload.domainCandidates.map((c) => ({
        domainCode: c.domainCode,
        status: c.candidateStatus,
        confidence: c.confidence,
      })),
    };

    // R1
    const r1 = runR1ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      p2PackDir: p2.outDir,
    });
    const primary = r1.envelope.payload.primaryField?.fieldCode ?? null;
    stages.r1 = {
      origin: 'CREATED',
      packDir: r1.outDir,
      status: r1.envelope.payload.fieldResolutionStatus,
      primary,
      secondaries: (r1.envelope.payload.secondaryFields ?? []).map((f) => ({
        code: f.fieldCode,
        confidence: f.confidence,
      })),
      decisionCodes: r1.envelope.payload.decisionCodes,
    };

    const catalogGap =
      primary && !SPECIALTY_CATALOG_SCOPE.has(primary)
        ? `SPECIALTY_CATALOG_NOT_AVAILABLE:${primary}`
        : null;
    stages.catalogGap = catalogGap;

    // P3 (may evaluate zero fields if primary out of specialty scope)
    const p3 = await runP3ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
      outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
      r1PackDir: r1.outDir,
    });
    const p3Observed = (p3.envelope.payload.fieldResults ?? []).flatMap((f) =>
      (f.observedSpecialties ?? [])
        .filter((s) => s.status === 'OBSERVED')
        .map((s) => s.specialtyCode),
    );
    stages.p3 = {
      origin: 'CREATED',
      packDir: p3.outDir,
      outcomeStatus: p3.envelope.payload.outcomeStatus,
      fieldsEvaluated: (p3.envelope.payload.fieldResults ?? []).map(
        (f) => f.fieldCode,
      ),
      observedSpecialties: p3Observed,
    };

    // P4 — runner abstains cleanly when no OBSERVED specialties
    const p4 = await runP4ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
      outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
      r1PackDir: r1.outDir,
      p3PackDir: p3.outDir,
    });
    stages.p4 = {
      origin: p3Observed.length
        ? 'CREATED'
        : 'ABSTAINED_NO_OBSERVED_SPECIALTY',
      packDir: p4.outDir,
      outcomeStatus: p4.envelope.payload.outcomeStatus,
      geminiInvoked: p4.geminiInvoked,
    };

    const profile = await runProfilePilot({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
      dataSource: ds,
      r1PackDir: r1.outDir,
      p3PackDir: p3.outDir,
      p4PackDir: p4.outDir,
    });
    stages.profile = {
      origin: 'CREATED',
      packDir: profile.outDir,
      fields: profile.envelope.payload.fields.map((f) => ({
        fieldCode: f.fieldCode,
        role: f.role,
        specialtyCount: f.specialties.length,
        skillCount: f.skills.length,
        evidenceVolume: f.evidenceVolume,
      })),
      warnings: profile.envelope.warnings.map((w) => w.code),
    };

    writeBindings(String(snapshotId));
    stages.previewBinding = { caseId: CASE_ID, snapshotId, path: BINDINGS_PATH };

    console.log(
      JSON.stringify({ phase: '9B.2', status: 'DONE', stages }, null, 2),
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      status: 'FAILED',
      error: String(e instanceof Error ? e.message : e).slice(0, 500),
    }),
  );
  process.exit(1);
});
