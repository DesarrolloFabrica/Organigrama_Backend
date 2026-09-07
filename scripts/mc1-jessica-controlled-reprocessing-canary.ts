/**
 * Canary aislado: SOLO Jesica personId=1171.
 *
 *   npx ts-node --transpile-only scripts/mc1-jessica-controlled-reprocessing-canary.ts --preflight
 *   npx ts-node --transpile-only scripts/mc1-jessica-controlled-reprocessing-canary.ts --confirm
 *   npx ts-node --transpile-only scripts/mc1-jessica-controlled-reprocessing-canary.ts --publish
 *   npx ts-node --transpile-only scripts/mc1-jessica-controlled-reprocessing-canary.ts --smoke
 *
 * No procesa a nadie más. --force / MC1_FORCE_GEMINI bloquean.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import {
  createMdeDataSource,
  createP0Service,
} from '../src/mc-observatory/p0-bootstrap';
import { runP1ForMember } from '../src/mc-observatory/p1-member-runner';
import { DeterministicEvidenceCandidateSegmenter } from '../src/mc-pipeline/p1/deterministic-evidence-candidate-segmenter';
import { P1EvidenceBatchBuilder } from '../src/mc-pipeline/p1/p1-evidence-batch-builder';
import { runP2ArtifactOnly } from '../src/mc-pipeline/p2/p2-runner';
import { runR1ArtifactOnly } from '../src/mc-pipeline/r1/r1-runner';
import { runP3ArtifactOnly } from '../src/mc-pipeline/p3/p3-runner';
import { runP4ArtifactOnly } from '../src/mc-pipeline/p4/p4-runner';
import { runProfilePilot } from '../src/mc-pipeline/profile/profile-runner';
import {
  SPECIALTY_BY_CODE,
  SPECIALTY_CATALOG_SCOPE,
  SPECIALTY_CATALOG_VERSION,
} from '../src/mc-pipeline/catalog/specialties-visual-education';
import { PROFESSIONAL_FIELD_CATALOG_VERSION } from '../src/mc-pipeline/catalog/professional-fields';
import {
  P1_CONTRACT_VERSION,
  P1_PROMPT_VERSION,
  P1_SEGMENTER_VERSION,
} from '../src/mc-pipeline/p1/p1.types';
import { P2_CONTRACT_VERSION, P2_PROMPT_VERSION } from '../src/mc-pipeline/p2/p2.types';
import { R1_CONTRACT_VERSION } from '../src/mc-pipeline/r1/r1.types';
import {
  P3_CONTRACT_VERSION,
  P3_PROMPT_VERSION,
  P3_REASONING_POLICY_VERSION,
} from '../src/mc-pipeline/p3/p3.types';
import {
  P4_CONTRACT_VERSION,
  P4_PROMPT_VERSION,
  P4_ROUTING_POLICY_VERSION,
} from '../src/mc-pipeline/p4/p4.types';
import {
  PROFILE_CONTRACT_VERSION,
  type ProfilePilotEnvelope,
} from '../src/mc-pipeline/profile/profile.types';
import { PROFILE_RADAR_FORMULA_VERSION } from '../src/mc-pipeline/profile/profile-radar';
import {
  WEAK_EVIDENCE_FLOOR,
  PROFILE_RADAR_WEAK_SEMANTICS_VERSION,
} from '../src/mc-pipeline/profile/profile-radar-weak-semantics';
import { classifyFieldPublication, selectPublishableFields } from '../src/mc-pipeline/profile/profile-publication-gate';
import {
  isP2DeterministicAuthorityEnabled,
  isP2DeterministicSkipGeminiEnabled,
  isShadowResolverEnabled,
} from '../src/mc-pipeline/shadow-resolver/flags';
import { isP2CanaryEnabled } from '../src/mc-pipeline/shadow-resolver/canary-design';
import {
  aggregateGeminiUsage,
  filterLedgerByRun,
  readGeminiLedgerEvents,
} from '../src/mc-pipeline/gemini/gemini-ledger';
import { importMc1PresentationBatch } from '../src/mc-pipeline/person-profile/mc1-person-profile-importer';
import { validateMc1PresentationPayload } from '../src/mc-pipeline/person-profile/mc1-person-profile-store';
import type { Mc1PersonCompetenciesPresentationDto } from '../src/mc-pipeline/person-profile/mc1-person-profile.types';

const ROOT = resolve(__dirname, '..');
const REPO_TMP = resolve(ROOT, '..', 'tmp', 'mc1-jessica-controlled-reprocessing-canary');
const PERSON_ID = '1171';
const EXPECTED_SNAPSHOT_ID = '3';
const P0_VERSION = 'MC1.P0.SNAPSHOT.4D.2';

const FIELD_LABELS: Record<string, string> = {
  VISUAL_DESIGN: 'Diseño Visual',
  EDUCATION: 'Educación',
  SOFTWARE_ENGINEERING: 'Ingeniería de Software',
  PROJECT_PROGRAM_MGMT: 'Gestión de Proyectos / Programas',
  AUDIOVISUAL_PRODUCTION: 'Producción Audiovisual',
  DATA_ANALYTICS: 'Datos y Analítica',
};

const PRICING = {
  MODEL: 'gemini-3.6-flash',
  INPUT_PRICE: 0.75,
  OUTPUT_PRICE: 3.75,
  THINKING_PRICE: 'billed as output; no separate line',
  SOURCE: 'https://ai.google.dev/gemini-api/docs/pricing#gemini-3.6-flash',
  DATE: '2026-08-20',
  TIER: 'Paid Tier Standard (intro through 2026-12-31)',
};

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
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2), 'utf8');
}

function envOn(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function blocked(reason: string, extra: Record<string, unknown> = {}): never {
  const payload = { status: 'BLOCKED', reason, personId: PERSON_ID, ...extra };
  writeJson(REPO_TMP, 'blocked.json', payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(2);
}

function specialtyLabel(code: string): string {
  return SPECIALTY_BY_CODE.get(code)?.name ?? code;
}

function toPresentation(
  envelope: ProfilePilotEnvelope,
): Mc1PersonCompetenciesPresentationDto {
  const fields = selectPublishableFields(envelope.payload.fields ?? []);
  return {
    status: 'AVAILABLE',
    source: 'ARTIFACT_ONLY_LOCAL',
    fields: fields.map((f) => {
      const skillsBySpec = new Map<string, Array<{ code: string; name: string }>>();
      for (const sp of f.specialties ?? []) skillsBySpec.set(sp.specialtyCode, []);
      for (const sk of f.skills ?? []) {
        const key = sk.parentSpecialtyCode;
        if (!skillsBySpec.has(key)) skillsBySpec.set(key, []);
        skillsBySpec.get(key)!.push({ code: sk.skillCode, name: sk.name });
      }
      return {
        code: f.fieldCode,
        label: FIELD_LABELS[f.fieldCode] ?? f.fieldCode,
        role: f.role,
        confidence: f.r1Confidence,
        derivedPresentationLabel: f.derivedPresentationLabel ?? null,
        specialties: (f.specialties ?? []).map((s) => ({
          code: s.specialtyCode,
          label: specialtyLabel(s.specialtyCode),
          confidence: s.confidence,
          skills: skillsBySpec.get(s.specialtyCode) ?? [],
        })),
        tools: [...(f.toolsTechnologies ?? [])],
        competencyMap: {
          dimensions: (f.radar?.axes ?? []).map((a) => ({
            code: a.dimensionCode,
            label: a.label,
            relativeCoverage: a.relativeCoverage,
            ...(a.evidenceState ? { evidenceState: a.evidenceState } : {}),
          })),
        },
        evidenceVolume: f.evidenceVolume,
      };
    }),
  };
}

async function preflight(): Promise<{
  personCvId: number;
  snapshotId: string;
  batches: number;
  estimate: Record<string, unknown>;
  frozen: Record<string, unknown>;
}> {
  mkdirSync(REPO_TMP, { recursive: true });

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

  if (process.argv.includes('--force') || envOn('MC1_FORCE_GEMINI')) {
    blocked('FORCE_FORBIDDEN');
  }
  if (isP2DeterministicAuthorityEnabled()) blocked('EXPERIMENTAL_AUTHORITY_ACTIVE');
  if (isP2DeterministicSkipGeminiEnabled()) blocked('EXPERIMENTAL_P2_SKIP_ACTIVE');
  if (isP2CanaryEnabled()) blocked('CAMILO_CANARY_FLAG_ACTIVE');
  if (isShadowResolverEnabled()) blocked('SHADOW_RESOLVER_ENABLED');
  if (envOn('MC1_P2_DETERMINISTIC_RESOLVER_ENABLED')) {
    blocked('DETERMINISTIC_RESOLVER_ENV_ON');
  }

  const experimental = {
    candidate1: 'INACTIVE (module experimental/, not imported by runners)',
    candidate2Authority: isP2DeterministicAuthorityEnabled(),
    deterministicP2Skip: isP2DeterministicSkipGeminiEnabled(),
    shadowResolver: isShadowResolverEnabled(),
    camiloCanary: isP2CanaryEnabled(),
    semanticReuseInRunners: false,
  };

  const versions = {
    p0: P0_VERSION,
    p1: {
      contract: P1_CONTRACT_VERSION,
      prompt: P1_PROMPT_VERSION,
      segmenter: P1_SEGMENTER_VERSION,
    },
    p2: { contract: P2_CONTRACT_VERSION, prompt: P2_PROMPT_VERSION },
    r1: { contract: R1_CONTRACT_VERSION },
    p3: {
      contract: P3_CONTRACT_VERSION,
      prompt: P3_PROMPT_VERSION,
      reasoning: P3_REASONING_POLICY_VERSION,
    },
    p4: {
      contract: P4_CONTRACT_VERSION,
      prompt: P4_PROMPT_VERSION,
      routing: P4_ROUTING_POLICY_VERSION,
    },
    catalogs: {
      fields: PROFESSIONAL_FIELD_CATALOG_VERSION,
      specialties: SPECIALTY_CATALOG_VERSION,
    },
    publicationGate: '12I/12A classifyFieldPublication + OBSERVED_P3_PARENT_ONLY_12I',
    profileAssembler: PROFILE_CONTRACT_VERSION,
    radarFormula: PROFILE_RADAR_FORMULA_VERSION,
    weakRadar: {
      version: PROFILE_RADAR_WEAK_SEMANTICS_VERSION,
      NO_EVIDENCE: 0,
      WEAK_EVIDENCE: WEAK_EVIDENCE_FLOOR,
      OBSERVED: '8E intacta',
    },
  };

  const mdeEnv = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const cloudEnv = loadEnvFile(resolve(ROOT, '.env'));
  const mde = {
    host: mdeEnv.MDE_DB_HOST,
    port: Number(mdeEnv.MDE_DB_PORT),
    database: mdeEnv.MDE_DB_NAME,
    username: mdeEnv.MDE_DB_USERNAME,
    password: mdeEnv.MDE_DB_PASSWORD,
  };
  assertMdeTarget(mde);

  const { Client } = require('pg') as typeof import('pg');
  const cloud = new Client({
    host: cloudEnv.DB_HOST,
    port: Number(cloudEnv.DB_PORT || 5432),
    database: cloudEnv.DB_NAME,
    user: cloudEnv.DB_USERNAME,
    password: cloudEnv.DB_PASSWORD,
    ssl: cloudEnv.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await cloud.connect();
  await cloud.query('SET default_transaction_read_only = on');
  const cloudPerson = (
    await cloud.query(
      `SELECT p.id::text, p.full_name, p.document, cv.id::text AS person_cv_id,
              cv.drive_file_id, cv.is_active
         FROM core.person p
         JOIN organigrama.person_cv cv ON cv.person_id = p.id AND cv.is_active = true
        WHERE p.id = $1`,
      [PERSON_ID],
    )
  ).rows[0];
  const cloudPresentation = (
    await cloud.query(
      `SELECT count(*)::int AS n
         FROM organigrama.mc1_person_profile_presentation
        WHERE person_id = $1 AND is_active = true`,
      [PERSON_ID],
    )
  ).rows[0];
  await cloud.end();

  if (!cloudPerson) blocked('CLOUD_PERSON_OR_CV_MISSING');
  if (String(cloudPerson.id) !== PERSON_ID) blocked('PERSON_ID_MISMATCH');

  const dsP0 = await createMdeDataSource(mde);
  const p0svc = createP0Service(dsP0, mde);
  const snapRows = await dsP0.query(
    `SELECT s.id::text, s.person_id::text, s.person_cv_id::text, s.drive_file_id,
            s.parse_status, s.page_count, s.source_hash, s.source_size_bytes,
            char_length(s.normalized_text) AS nlen, s.extractor_version,
            s.normalizer_version, cv.is_active AS cv_is_active,
            cv.drive_file_id AS cv_drive
       FROM organigrama.mc_cv_snapshot s
       JOIN organigrama.person_cv cv ON cv.id = s.person_cv_id
      WHERE s.id = $1`,
    [EXPECTED_SNAPSHOT_ID],
  );
  const snap = snapRows[0];
  if (!snap) {
    await dsP0.destroy();
    blocked('SNAPSHOT_3_MISSING');
  }
  if (String(snap.person_id) !== PERSON_ID) {
    await dsP0.destroy();
    blocked('P0_REUSE_INVALID', { detail: 'snapshot person_id != 1171' });
  }
  if (snap.drive_file_id !== cloudPerson.drive_file_id) {
    await dsP0.destroy();
    blocked('P0_REUSE_INVALID', {
      detail: 'snapshot drive_file_id != Cloud active CV',
      snapshotDrive: snap.drive_file_id,
      cloudDrive: cloudPerson.drive_file_id,
    });
  }
  if (snap.parse_status !== 'PARSED' || Number(snap.nlen) < 100) {
    await dsP0.destroy();
    blocked('P0_REUSE_INVALID', { detail: 'snapshot not PARSED with text' });
  }

  let driveHash: string | null = null;
  let driveHashMatch: boolean | null = null;
  try {
    const doc = await p0svc.fetchDriveDocument(Number(snap.person_cv_id));
    driveHash = createHash('sha256').update(doc.buffer).digest('hex');
    driveHashMatch = driveHash === snap.source_hash;
    if (doc.driveFileId !== snap.drive_file_id || !driveHashMatch) {
      await dsP0.destroy();
      blocked('P0_REUSE_INVALID', {
        detail: 'Drive hash or file id mismatch vs snapshot 3',
        driveHashMatch,
      });
    }
  } catch (e) {
    await dsP0.destroy();
    blocked('P0_REUSE_INVALID', {
      detail: 'Drive fetch failed; refusing silent reuse',
      error: String(e instanceof Error ? e.message : e).slice(0, 200),
    });
  }

  const fullSnap = (
    await dsP0.query(
      `SELECT normalized_text, pages, sectioned_content
         FROM organigrama.mc_cv_snapshot WHERE id = $1`,
      [EXPECTED_SNAPSHOT_ID],
    )
  )[0];
  const pages =
    typeof fullSnap.pages === 'string' ? JSON.parse(fullSnap.pages) : fullSnap.pages;
  const sectioned =
    typeof fullSnap.sectioned_content === 'string'
      ? JSON.parse(fullSnap.sectioned_content)
      : fullSnap.sectioned_content;
  const segmenter = new DeterministicEvidenceCandidateSegmenter();
  const segmented = segmenter.segment({
    snapshotId: EXPECTED_SNAPSHOT_ID,
    normalizedText: fullSnap.normalized_text,
    pages,
    sectionedContent: sectioned,
  });
  const candidates = segmented.candidates;
  const batches = new P1EvidenceBatchBuilder().build(candidates).length;
  await dsP0.destroy();

  const model = PRICING.MODEL;
  const expectedCalls = batches + 3;
  const p1In = Math.round((10992 * batches) / 5);
  const p1OutCand = Math.round((7421 * batches) / 5);
  const p1Think = Math.round((11181 * batches) / 5);
  const restIn = 6220 + 7372 + 6035;
  const restCand = 6146 + 1267 + 2291;
  const restThink = 5993 + 2951 + 2625;
  const expectedInput = p1In + restIn;
  const expectedCand = p1OutCand + restCand;
  const expectedThink = p1Think + restThink;
  const expectedTotal = expectedInput + expectedCand + expectedThink;
  const expectedUsd =
    (expectedInput * PRICING.INPUT_PRICE) / 1_000_000 +
    ((expectedCand + expectedThink) * PRICING.OUTPUT_PRICE) / 1_000_000;

  const frozen = {
    phase: 'JESSICA_CONTROLLED_CANARY',
    personId: PERSON_ID,
    snapshotId: EXPECTED_SNAPSHOT_ID,
    p0Version: P0_VERSION,
    p1SegmenterVersion: P1_SEGMENTER_VERSION,
    p1PromptVersion: P1_PROMPT_VERSION,
    p1ContractVersion: P1_CONTRACT_VERSION,
    geminiModel: model,
    p2Version: `${P2_CONTRACT_VERSION}/${P2_PROMPT_VERSION}`,
    r1Version: R1_CONTRACT_VERSION,
    p3Version: `${P3_CONTRACT_VERSION}/${P3_PROMPT_VERSION}`,
    p4Version: `${P4_CONTRACT_VERSION}/${P4_PROMPT_VERSION}`,
    p4RoutingPolicyVersion: P4_ROUTING_POLICY_VERSION,
    profileAssemblyVersion: PROFILE_CONTRACT_VERSION,
    radarFormulaVersion: PROFILE_RADAR_FORMULA_VERSION,
    weakRadarVersion: PROFILE_RADAR_WEAK_SEMANTICS_VERSION,
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    fieldCatalogVersion: PROFESSIONAL_FIELD_CATALOG_VERSION,
    publicSkillFilter: 'OBSERVED_P3_PARENT_ONLY_12I',
  };
  const configFingerprint = createHash('sha256')
    .update(JSON.stringify(frozen))
    .digest('hex')
    .slice(0, 16);

  const estimate = {
    METHOD: 'P1 tokens scaled from control 1349 by predicted batches; P2-P4 unscaled MEASURED',
    EXPECTED_CALLS: expectedCalls,
    EXPECTED_P1_BATCHES: batches,
    EXPECTED_INPUT_TOKENS: expectedInput,
    EXPECTED_OUTPUT_TOKENS: expectedCand,
    EXPECTED_THINKING_TOKENS: expectedThink,
    EXPECTED_TOTAL_TOKENS: expectedTotal,
    EXPECTED_USD: Number(expectedUsd.toFixed(6)),
    PRICING,
  };

  const report = {
    personId: PERSON_ID,
    nombre: cloudPerson.full_name,
    document: cloudPerson.document,
    cloudCv: {
      personCvId: cloudPerson.person_cv_id,
      driveFileId: cloudPerson.drive_file_id,
      isActive: cloudPerson.is_active,
    },
    cloudActivePresentationCount: cloudPresentation.n,
    snapshot: {
      id: snap.id,
      personId: snap.person_id,
      personCvId: snap.person_cv_id,
      driveFileId: snap.drive_file_id,
      parseStatus: snap.parse_status,
      pageCount: snap.page_count,
      normalizedTextLen: snap.nlen,
      sourceHash: snap.source_hash,
    },
    p0Reuse: {
      status: 'P0_REUSE_VALID',
      driveHashMatch,
      predictedP1Batches: batches,
      candidateCount: candidates.length,
    },
    experimental,
    versions,
    frozen: { ...frozen, configFingerprint },
    estimate,
  };
  writeJson(REPO_TMP, 'preflight.json', report);
  return {
    personCvId: Number(snap.person_cv_id),
    snapshotId: String(snap.id),
    batches,
    estimate,
    frozen: { ...frozen, configFingerprint },
  };
}

async function runPipeline(pre: Awaited<ReturnType<typeof preflight>>) {
  const gem = loadEnvFile(
    resolve(ROOT, 'secrets/mc1-p1-prototype.local.env'),
    new Set(['GEMINI_API_KEY', 'GEMINI_MODEL']),
  );
  if (!gem.GEMINI_API_KEY) blocked('NO_GEMINI_KEY');
  const model = gem.GEMINI_MODEL || PRICING.MODEL;

  const runId = `JESSICA-CANARY-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
  const ledgerPath = join(REPO_TMP, 'gemini-ledger', 'events.jsonl');
  mkdirSync(join(REPO_TMP, 'gemini-ledger'), { recursive: true });
  process.env.MC1_GEMINI_LEDGER_PATH = ledgerPath;

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

  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const mdeEnv = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const mde = {
    host: mdeEnv.MDE_DB_HOST,
    port: Number(mdeEnv.MDE_DB_PORT),
    database: mdeEnv.MDE_DB_NAME,
    username: mdeEnv.MDE_DB_USERNAME,
    password: mdeEnv.MDE_DB_PASSWORD,
  };
  assertMdeTarget(mde);

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

  const snapshotId = pre.snapshotId;
  const snap = (
    await ds.query(
      `SELECT id::text AS id, normalized_text, pages, sectioned_content,
              parse_status, page_count, length(normalized_text) AS nlen
         FROM organigrama.mc_cv_snapshot WHERE id = $1`,
      [snapshotId],
    )
  )[0];
  if (!snap?.normalized_text || snap.parse_status !== 'PARSED') {
    await ds.destroy();
    blocked('SNAPSHOT_NOT_READY');
  }

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const prototypeId = `P1P-JESSICA-CANARY-S${snapshotId}-${stamp}-${randomUUID().slice(0, 8)}`;
  const p1OutDir = resolve(ROOT, 'tmp', 'mc1-p1-prototype', prototypeId);
  mkdirSync(p1OutDir, { recursive: true });
  writeFileSync(
    join(p1OutDir, 'prototype-manifest.json'),
    JSON.stringify(
      {
        classification: 'CONFIDENTIAL',
        operationType: 'P1_JESSICA_CANARY',
        prototypeId,
        snapshotId,
        personId: PERSON_ID,
        runId,
        contractVersion: P1_CONTRACT_VERSION,
        modelVersion: model,
        startedAt: new Date().toISOString(),
        persistence: 'NONE',
        resultOrigin: 'LIVE',
      },
      null,
      2,
    ),
    'utf8',
  );

  const pages = typeof snap.pages === 'string' ? JSON.parse(snap.pages) : snap.pages;
  const sectioned =
    typeof snap.sectioned_content === 'string'
      ? JSON.parse(snap.sectioned_content)
      : snap.sectioned_content;

  const p1Result = await runP1ForMember({
    prototypeId,
    snapshotId,
    normalizedText: snap.normalized_text,
    pages,
    sectionedContent: sectioned,
    apiKey: gem.GEMINI_API_KEY,
    model,
    outDir: p1OutDir,
    personId: PERSON_ID,
    personCvId: String(pre.personCvId),
    runId,
    backendRoot: ROOT,
  });
  if (!p1Result.ok) {
    await ds.destroy();
    blocked('P1_FAILED', { errorCode: p1Result.errorCode, status: p1Result.status });
  }

  const batchesFile = JSON.parse(readFileSync(join(p1OutDir, 'batches.json'), 'utf8')) as {
    batches: Array<{ batchId: string; candidateIds: string[] }>;
  };
  const candToBatch = new Map<string, string>();
  for (const b of batchesFile.batches) {
    for (const id of b.candidateIds) candToBatch.set(id, b.batchId);
  }
  const decisions = [...p1Result.decisions.entries()].map(([candidateId, decision]) => ({
    candidateId,
    decision,
    reasonCode:
      decision === 'REVIEW_REQUIRED'
        ? 'NEEDS_REVIEW'
        : String(decision).startsWith('REJECTED')
          ? 'REJECTED'
          : 'OK',
    batchId: candToBatch.get(candidateId) ?? 'unknown',
  }));
  writeFileSync(join(p1OutDir, 'decisions.json'), JSON.stringify({ decisions }, null, 2), 'utf8');

  const p2 = await runP2ArtifactOnly({
    backendRoot: ROOT,
    snapshotId,
    dataSource: ds,
    apiKey: gem.GEMINI_API_KEY,
    model,
    outRoot: join(REPO_TMP, 'artifacts', 'p2'),
    personId: PERSON_ID,
    pipelineRunId: runId,
  });
  const r1 = runR1ArtifactOnly({
    backendRoot: ROOT,
    snapshotId,
    p2PackDir: p2.outDir,
  });
  const r1p = r1.envelope.payload;
  const primary = r1p.primaryField?.fieldCode ?? null;
  const secondaries = (r1p.secondaryFields ?? []).map((f) => f.fieldCode);
  const r1Fields = [...(primary ? [primary] : []), ...secondaries];
  const inScopeFields = r1Fields.filter((c) => SPECIALTY_CATALOG_SCOPE.has(c));

  const p3 = await runP3ArtifactOnly({
    backendRoot: ROOT,
    snapshotId,
    dataSource: ds,
    apiKey: gem.GEMINI_API_KEY,
    model,
    outRoot: join(REPO_TMP, 'artifacts', 'p3'),
    r1PackDir: r1.outDir,
    personId: PERSON_ID,
    pipelineRunId: runId,
  });
  const p4 = await runP4ArtifactOnly({
    backendRoot: ROOT,
    snapshotId,
    dataSource: ds,
    apiKey: gem.GEMINI_API_KEY,
    model,
    outRoot: join(REPO_TMP, 'artifacts', 'p4'),
    r1PackDir: r1.outDir,
    p3PackDir: p3.outDir,
    personId: PERSON_ID,
    pipelineRunId: runId,
  });

  const profile = await runProfilePilot({
    backendRoot: ROOT,
    snapshotId,
    outRoot: join(REPO_TMP, 'artifacts', 'profile'),
    dataSource: ds,
    r1PackDir: r1.outDir,
    p3PackDir: p3.outDir,
    p4PackDir: p4.outDir,
  });

  await ds.destroy();

  try {
    cpSync(p1OutDir, join(REPO_TMP, 'artifacts', 'p1'), { recursive: true });
  } catch {
    /* ignore */
  }

  const presentation = toPresentation(profile.envelope);
  const validation = validateMc1PresentationPayload({
    ...presentation,
    source: 'CLOUD_PRESENTATION_STORE',
  });

  const p3Observed: string[] = [];
  const p3Weak: string[] = [];
  for (const fr of p3.envelope.payload.fieldResults ?? []) {
    for (const s of fr.observedSpecialties ?? []) {
      if (s.status === 'OBSERVED') p3Observed.push(s.specialtyCode);
      if (s.status === 'WEAK') p3Weak.push(s.specialtyCode);
    }
  }
  const publicSpecs = presentation.fields.flatMap((f) => f.specialties.map((s) => s.code));
  const publicSkills = presentation.fields.flatMap((f) =>
    f.specialties.flatMap((s) => s.skills.map((sk) => sk.code)),
  );
  const weakAsPublic = publicSpecs.filter((c) => p3Weak.includes(c) && !p3Observed.includes(c));

  const axes = presentation.fields.flatMap((f) =>
    (f.competencyMap.dimensions ?? []).map((d) => ({
      field: f.code,
      ...d,
    })),
  );
  const noEvidence = axes.filter((a) => a.evidenceState === 'NO_EVIDENCE' || a.relativeCoverage === 0);
  const weakAxes = axes.filter((a) => a.evidenceState === 'WEAK_EVIDENCE');
  const observedAxes = axes.filter((a) => a.evidenceState === 'OBSERVED');
  const weakNot20 = weakAxes.filter((a) => a.relativeCoverage !== WEAK_EVIDENCE_FLOOR);
  const noEvNot0 = noEvidence.filter(
    (a) => a.evidenceState === 'NO_EVIDENCE' && a.relativeCoverage !== 0,
  );

  const drift: Array<{ class: string; detail: string }> = [];
  if (primary === 'VISUAL_DESIGN') {
    drift.push({ class: 'EXPECTED_DRIFT', detail: 'PRIMARY=VISUAL_DESIGN matches 12B VD antecedent' });
  } else if (primary === 'EDUCATION' || primary === 'AUDIOVISUAL_PRODUCTION') {
    drift.push({ class: 'COMPATIBLE_DRIFT', detail: `PRIMARY=${primary} adjacent to VD 12B` });
  } else if (!primary) {
    drift.push({ class: 'CRITICAL_DRIFT', detail: 'R1 produced no PRIMARY' });
  } else {
    drift.push({ class: 'SUSPICIOUS_DRIFT', detail: `PRIMARY=${primary} not VD family` });
  }
  if (weakAsPublic.length) {
    drift.push({ class: 'CRITICAL_DRIFT', detail: `WEAK specialties published: ${weakAsPublic.join(',')}` });
  }
  if (weakNot20.length) {
    drift.push({ class: 'CRITICAL_DRIFT', detail: 'WEAK_EVIDENCE axis not flat 20' });
  }
  if (noEvNot0.length) {
    drift.push({ class: 'CRITICAL_DRIFT', detail: 'NO_EVIDENCE axis not 0' });
  }
  if (!validation.ok) {
    drift.push({ class: 'CRITICAL_DRIFT', detail: `presentation invalid: ${validation.reason}` });
  }
  if (!presentation.fields.length) {
    drift.push({ class: 'CRITICAL_DRIFT', detail: 'no publishable fields' });
  }

  const worst = drift.some((d) => d.class === 'CRITICAL_DRIFT')
    ? 'CRITICAL_DRIFT'
    : drift.some((d) => d.class === 'SUSPICIOUS_DRIFT')
      ? 'SUSPICIOUS_DRIFT'
      : drift.some((d) => d.class === 'COMPATIBLE_DRIFT')
        ? 'COMPATIBLE_DRIFT'
        : 'EXPECTED_DRIFT';

  const publishable = worst !== 'CRITICAL_DRIFT' && validation.ok && presentation.fields.length > 0;

  const events = existsSync(ledgerPath) ? readGeminiLedgerEvents(ROOT) : [];
  const mine = filterLedgerByRun(events, runId);
  const totals = aggregateGeminiUsage(mine);
  const byPhase = { P1: aggregateGeminiUsage(mine.filter((e) => e.phase === 'P1')), P2: aggregateGeminiUsage(mine.filter((e) => e.phase === 'P2')), P3: aggregateGeminiUsage(mine.filter((e) => e.phase === 'P3')), P4: aggregateGeminiUsage(mine.filter((e) => e.phase === 'P4')) };

  const inputTok = totals.promptTokens ?? 0;
  const outTok = totals.candidateTokens ?? 0;
  const thinkTok = totals.thinkingTokens ?? 0;
  const actualUsd =
    (inputTok * PRICING.INPUT_PRICE) / 1_000_000 +
    ((outTok + thinkTok) * PRICING.OUTPUT_PRICE) / 1_000_000;

  const gate = {
    status: publishable ? 'PASS' : 'FAIL',
    worstDrift: worst,
    drift,
    newPublicSpecialties: publicSpecs,
    newPublicSkills: publicSkills,
    weakAxes: weakAxes.map((a) => a.code),
    observedAxes: observedAxes.map((a) => a.code),
    noEvidenceAxes: noEvidence.map((a) => a.code),
    publicationGateByField: presentation.fields.map((f) => {
      const raw = (profile.envelope.payload.fields ?? []).find((x) => x.fieldCode === f.code);
      return raw ? classifyFieldPublication(raw) : null;
    }),
    p4GeminiInvoked: p4.geminiInvoked,
    p3Observed,
    p3Weak,
  };

  const importBatch = {
    configFingerprint: String(pre.frozen.configFingerprint),
    profiles: [
      {
        personId: PERSON_ID,
        configFingerprint: String(pre.frozen.configFingerprint),
        producedAt: new Date().toISOString(),
        payload: { ...presentation, source: 'CLOUD_PRESENTATION_STORE' },
      },
    ],
  };

  const pipelineReport = {
    runId,
    personId: PERSON_ID,
    otherUsersProcessed: 0,
    p0: { status: 'REUSED', snapshotId },
    p1: {
      status: p1Result.executionStatus,
      calls: byPhase.P1.calls,
      batches: p1Result.batchCount,
      units: p1Result.units.length,
      geminiInvoked: p1Result.geminiInvoked,
      packDir: p1OutDir,
    },
    p2: {
      status: p2.executionStatus,
      calls: byPhase.P2.calls,
      geminiInvoked: p2.geminiInvoked,
      packDir: p2.outDir,
      candidates: p2.envelope.payload.domainCandidates.map((c) => ({
        domainCode: c.domainCode,
        status: c.candidateStatus,
      })),
    },
    r1: { status: r1p.fieldResolutionStatus, primary, secondaries, packDir: r1.outDir },
    p3: {
      status: p3.executionStatus,
      calls: byPhase.P3.calls,
      geminiInvoked: p3.geminiInvoked,
      packDir: p3.outDir,
    },
    p4: {
      status: p4.executionStatus,
      calls: byPhase.P4.calls,
      geminiInvoked: p4.geminiInvoked,
      packDir: p4.outDir,
    },
    profile: { packDir: profile.outDir, r1Status: profile.envelope.payload.r1FieldResolutionStatus },
    presentation,
    gate,
    ledger: {
      runId,
      totals,
      byPhase,
      actualUsd: Number(actualUsd.toFixed(6)),
      estimate: pre.estimate,
    },
    inScopeFields,
  };

  writeJson(REPO_TMP, 'pipeline-report.json', pipelineReport);
  writeJson(REPO_TMP, 'publication-gate.json', gate);
  writeJson(REPO_TMP, 'presentation.json', presentation);
  writeJson(REPO_TMP, 'import-batch.json', importBatch);
  writeJson(REPO_TMP, 'semantic-validation.json', { drift, worst, primary, p3Observed, p3Weak });
  writeJson(REPO_TMP, 'cost-actual.json', {
    runId,
    totals,
    byPhase,
    actualUsd: Number(actualUsd.toFixed(6)),
    estimate: pre.estimate,
    PRICING,
  });

  return { publishable, runId, gate, presentation, actualUsd, totals, byPhase };
}

async function publish() {
  const gatePath = join(REPO_TMP, 'publication-gate.json');
  const batchPath = join(REPO_TMP, 'import-batch.json');
  if (!existsSync(gatePath) || !existsSync(batchPath)) blocked('GATE_ARTIFACTS_MISSING');
  const gate = JSON.parse(readFileSync(gatePath, 'utf8')) as { status: string; worstDrift: string };
  if (gate.status !== 'PASS' || gate.worstDrift === 'CRITICAL_DRIFT') {
    blocked('PUBLICATION_GATE_FAIL', gate);
  }
  const batch = JSON.parse(readFileSync(batchPath, 'utf8'));
  const ids = (batch.profiles ?? []).map((p: { personId: string }) => String(p.personId));
  if (ids.length !== 1 || ids[0] !== PERSON_ID) blocked('IMPORT_BATCH_NOT_SOLO_JESSICA', { ids });

  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const env = loadEnvFile(resolve(ROOT, '.env'));
  const ds = new DataSource({
    type: 'postgres',
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();
  try {
    const result = await importMc1PresentationBatch(ds, [
      {
        personId: PERSON_ID,
        payload: batch.profiles[0].payload,
        configFingerprint: batch.profiles[0].configFingerprint,
        producedAt: batch.profiles[0].producedAt,
      },
    ]);
    writeJson(REPO_TMP, 'import-result.json', result);
    console.log(JSON.stringify({ status: 'PUBLISHED', personId: PERSON_ID, result }, null, 2));
  } finally {
    await ds.destroy();
  }
}

function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const crypto = require('crypto') as typeof import('crypto');
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

async function smoke() {
  const env = loadEnvFile(resolve(ROOT, '.env'));
  if (!env.AUTH_JWT_SECRET) blocked('AUTH_JWT_SECRET_MISSING');
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    {
      personId: '1229',
      googleSubject: 'jessica-canary-smoke',
      googleEmail: 'desarrollofabrica@cun.edu.co',
      eduEmail: 'desarrollofabrica@cun.edu.co',
      permissions: ['ORG_READ_ALL', 'ORG_ADMIN'],
      iat: now,
      exp: now + 20 * 60,
    },
    env.AUTH_JWT_SECRET,
  );
  const url =
    'https://organigrama-backend-550902908078.us-central1.run.app/api/org-chart/person/1171/competencies/professional-profile?includeAudit=true';
  const res = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as Record<string, unknown>;
  const mc1 = (body.mc1Profile ?? null) as Record<string, unknown> | null;
  const fields = (mc1?.fields as unknown[]) || [];
  const smokeReport = {
    http: res.status,
    mc1Status: mc1?.status ?? null,
    source: mc1?.source ?? null,
    fieldCodes: fields.map((f) => (f as { code?: string }).code),
    primary: fields.find((f) => (f as { role?: string }).role === 'PRIMARY'),
    fallbackClassificationPending:
      mc1?.status !== 'AVAILABLE' &&
      String(body.warning ?? body.message ?? '').includes('clasificación'),
  };
  writeJson(REPO_TMP, 'production-smoke.json', { url, ...smokeReport, rawKeys: Object.keys(body) });
  console.log(JSON.stringify({ status: 'SMOKE', ...smokeReport }, null, 2));
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.some((a) => /personId=/.test(a) && !a.includes('1171'))) {
    blocked('OTHER_PERSON_FORBIDDEN');
  }
  if (argv.includes('--publish')) {
    await publish();
    return;
  }
  if (argv.includes('--smoke')) {
    await smoke();
    return;
  }
  const pre = await preflight();
  if (argv.includes('--preflight') && !argv.includes('--confirm')) {
    console.log(JSON.stringify({ status: 'PREFLIGHT_OK', p0: 'P0_REUSE_VALID', estimate: pre.estimate }, null, 2));
    return;
  }
  if (!argv.includes('--confirm')) {
    blocked('REQUIRES_CONFIRM', { hint: '--preflight or --confirm' });
  }
  const result = await runPipeline(pre);
  console.log(
    JSON.stringify(
      {
        status: result.publishable ? 'PIPELINE_OK_GATE_PASS' : 'PIPELINE_OK_GATE_FAIL',
        personId: PERSON_ID,
        otherUsersProcessed: 0,
        publishable: result.publishable,
        runId: result.runId,
        calls: result.totals.calls,
        tokens: result.totals.totalTokens,
        usd: result.actualUsd,
        NEXT: result.publishable ? 'run --publish then --smoke' : 'DO_NOT_PUBLISH',
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});
