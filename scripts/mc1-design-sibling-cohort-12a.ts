/**
 * FASE 12A — Design sibling cohort LIVE discovery (P0→P1→P2→R1 only).
 *
 *   npx ts-node --transpile-only scripts/mc1-design-sibling-cohort-12a.ts --confirm --force-live-ai
 *
 * NO P3 / P4 / Profile Assembly. Role used only for cohort selection (not Gemini).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import {
  createMdeDataSource,
  createP0Service,
} from '../src/mc-observatory/p0-bootstrap';
import { runP1ForMember } from '../src/mc-observatory/p1-member-runner';
import { runP2ArtifactOnly } from '../src/mc-pipeline/p2/p2-runner';
import { runR1ArtifactOnly } from '../src/mc-pipeline/r1/r1-runner';
import {
  P1_PROMPT_VERSION,
  P1_SEGMENTER_VERSION,
} from '../src/mc-pipeline/p1/p1.types';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-design-sibling-cohort-12a');
const REPORT_PATH = join(OUT_DIR, 'cohort-report.json');

/** Frozen after sibling discovery. Documents from Cloud RO bootstrap. */
const COHORT: Array<{
  caseId: string;
  document: string;
  selectionRole: string;
}> = [
  {
    caseId: 'person-nidia-prada',
    document: '1015482688',
    selectionRole: 'DISEÑADOR UX/UI',
  },
  {
    caseId: 'person-jesica-carrillo',
    document: '1000732617',
    selectionRole: 'DISEÑADOR UX/UI',
  },
  {
    caseId: 'person-alison-castro',
    document: '1000622424',
    selectionRole: 'ANALISTA DE DISEÑO DE CONTENIDOS',
  },
  {
    caseId: 'person-anibal-angulo',
    document: '1193092980',
    selectionRole: 'ANALISTA DE DISEÑO DE CONTENIDOS',
  },
  {
    caseId: 'person-ginna-garzon',
    document: '1030646495',
    selectionRole: 'ANALISTA DE DISEÑO DE CONTENIDOS',
  },
];

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

async function processCase(args: {
  caseId: string;
  document: string;
  forceLiveAi: boolean;
  gem: Record<string, string>;
  mde: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
}): Promise<Record<string, unknown>> {
  const { caseId, document, forceLiveAi, gem, mde } = args;
  void forceLiveAi;

  const dsP0 = await createMdeDataSource(mde);
  const p0 = createP0Service(dsP0, mde);
  const rows = await dsP0.query(
    `
    SELECT p.id AS person_id, pc.id AS person_cv_id
    FROM core.person p
    LEFT JOIN organigrama.person_cv pc
      ON pc.person_id = p.id AND pc.is_active = true
    WHERE p.document = $1
    LIMIT 1
    `,
    [document],
  );
  const row = rows?.[0];
  if (!row?.person_cv_id) {
    await dsP0.destroy();
    return { caseId, status: 'PROCESSING_ERROR', error: 'PERSON_CV_NOT_FOUND' };
  }
  const personId = String(row.person_id);
  const personCvId = Number(row.person_cv_id);

  // Always create/reuse from THIS MDE (idempotent by source hash).
  const p0Result = await p0.createOrReuseFromPersonCv(personCvId);
  const snapshotId = String(p0Result.snapshotId);
  const p0Origin = p0Result.outcome === 'CREATED' ? 'CREATED' : 'REUSED_VALID';
  await dsP0.destroy();

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

  try {
    const snap = (
      await ds.query(
        `SELECT id::text AS id, normalized_text, pages, sectioned_content,
                parse_status, page_count, length(normalized_text) AS nlen
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
          operationType: 'P1_12A_DESIGN_SIBLING_LIVE',
          prototypeId,
          snapshotId: String(snapshotId),
          contractVersion: '2.0.0',
          segmenterVersion: P1_SEGMENTER_VERSION,
          promptVersion: P1_PROMPT_VERSION,
          modelProvider: 'google-genai',
          modelVersion: gem.GEMINI_MODEL || 'gemini-3.6-flash',
          startedAt: new Date().toISOString(),
          persistence: 'NONE',
          resultOrigin: 'LIVE',
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

    const units = p1Result.units ?? [];
    const p1Stats = {
      candidates: p1Result.candidateCount,
      evidenceUnits: units.length,
      explicit: units.filter((u) => u.explicitness === 'EXPLICIT').length,
      stronglySupported: units.filter(
        (u) => u.explicitness === 'STRONGLY_SUPPORTED',
      ).length,
      batches: p1Result.batchCount,
      reviewRequired: decisions.filter((d) => d.decision === 'REVIEW_REQUIRED')
        .length,
      executionId: prototypeId,
      geminiInvoked: true,
      resultOrigin: 'LIVE' as const,
      model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
    };

    const p2 = await runP2ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
      outRoot: resolve(ROOT, 'tmp', 'mc1-p2-functional'),
    });

    const r1 = runR1ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      p2PackDir: p2.outDir,
    });
    const r1p = r1.envelope.payload;

    return {
      caseId,
      status: 'DONE',
      personId,
      personCvId,
      snapshotId,
      p0: p0Origin,
      p0Meta: {
        parseStatus: snap.parse_status,
        pageCount: snap.page_count,
        normalizedLen: snap.nlen,
        fidelity:
          snap.parse_status === 'PARSED' && Number(snap.nlen) > 500
            ? 'HIGH_FIDELITY'
            : 'CHECK',
      },
      p1: {
        origin: 'LIVE',
        packDir: outDir,
        ...p1Stats,
      },
      p2: {
        origin: 'LIVE',
        packDir: p2.outDir,
        geminiInvoked: !!p2.geminiInvoked,
        resultOrigin: p2.geminiInvoked ? 'LIVE' : 'NONE',
        candidates: p2.envelope.payload.domainCandidates.map((c) => ({
          domainCode: c.domainCode,
          status: c.candidateStatus,
          confidence: c.confidence,
          publication: 'PUBLICATION_NOT_EVALUATED',
        })),
      },
      r1: {
        origin: 'CREATED',
        packDir: r1.outDir,
        status: r1p.fieldResolutionStatus,
        primary: r1p.primaryField?.fieldCode ?? null,
        primaryPublication: 'PUBLICATION_NOT_EVALUATED',
        secondaries: (r1p.secondaryFields ?? []).map((f) => ({
          code: f.fieldCode,
          confidence: f.confidence,
          publication: 'PUBLICATION_NOT_EVALUATED',
        })),
        decisionCodes: r1p.decisionCodes,
        note: 'RESOLVED; publication deferred until P3/P4 (12A)',
      },
      p3: { executed: false },
      p4: { executed: false },
      profile: { executed: false },
    };
  } finally {
    await ds.destroy();
  }
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'REQUIRES_CONFIRM' }));
    process.exit(2);
  }
  const only = process.argv
    .find((a) => a.startsWith('--only='))
    ?.split('=')[1]
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const forceLiveAi =
    process.argv.includes('--force-live-ai') ||
    !process.argv.includes('--allow-reuse');

  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
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

  const cases = COHORT.filter((c) => !only || only.includes(c.caseId));
  const results: unknown[] = [];
  for (const c of cases) {
    try {
      const r = await processCase({
        caseId: c.caseId,
        document: c.document,
        forceLiveAi,
        gem,
        mde,
      });
      results.push({ ...r, selectionRole: c.selectionRole });
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          progress: c.caseId,
          status: (r as { status?: string }).status,
        }),
      );
    } catch (e) {
      results.push({
        caseId: c.caseId,
        selectionRole: c.selectionRole,
        status: 'PROCESSING_ERROR',
        error: String(e instanceof Error ? e.message : e).slice(0, 400),
      });
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    phase: '12A',
    mode: 'LIVE_GEMINI_P0_P1_P2_R1',
    forceLiveAi,
    status: 'DONE',
    model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
    p3Executed: false,
    p4Executed: false,
    profileExecuted: false,
    fieldPublicationGate: 'MC1.PROFILE.PUBLICATION_GATE.1.0.0',
    cohort: COHORT,
    results,
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
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
