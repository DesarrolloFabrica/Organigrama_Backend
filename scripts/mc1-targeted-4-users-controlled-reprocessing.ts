/**
 * Targeted 4: 1082 Raul, 1268 Sara, 1303 Felipe, 1077 Leidy.
 * Orden: menor costo esperado. Budget USD 1.50. HIGH preflight 1.10.
 *
 *   npx ts-node --transpile-only scripts/mc1-targeted-4-users-controlled-reprocessing.ts --confirm
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { Client } from 'pg';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { createMdeDataSource, createP0Service } from '../src/mc-observatory/p0-bootstrap';
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
  SPECIALTY_CATALOG_VERSION,
} from '../src/mc-pipeline/catalog/specialties-visual-education';
import {
  PROFESSIONAL_FIELDS,
  PROFESSIONAL_FIELD_CATALOG_VERSION,
} from '../src/mc-pipeline/catalog/professional-fields';
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
const OUT = resolve(ROOT, '..', 'tmp', 'mc1-targeted-4-users-controlled-reprocessing');
const P0_VERSION = 'MC1.P0.SNAPSHOT.4D.2';
const BUDGET_USD = 1.5;
const ALLOWED = new Set(['1082', '1268', '1303', '1077']);
const TARGET_IDS = ['1082', '1268', '1303', '1077'];

const COHORT = [
  { personId: '1082', name: 'Raul Valencia Cifuentes', uiBefore: 'PARTIAL_CLASSIFICATION_SUMMARY', predictedP1Batches: 5 },
  { personId: '1268', name: 'Sara Murillo Fonseca', uiBefore: 'PARTIAL_CLASSIFICATION_SUMMARY', predictedP1Batches: 5 },
  { personId: '1303', name: 'Felipe Guerrero Buenaventura', uiBefore: 'NO_COMPETENCY_EVALUATION', predictedP1Batches: 6 },
  { personId: '1077', name: 'Leidy Viviana Bernal León', uiBefore: 'LEGACY_PROFILE', predictedP1Batches: 7 },
] as const;

const JESSICA = {
  personId: '1171',
  pages: 2,
  textLength: 2930,
  p1Batches: 5,
  evidenceUnits: 27,
  p1Calls: 5,
  p2Calls: 1,
  p3Calls: 1,
  p4Calls: 1,
  totalCalls: 8,
  inputTokens: 30916,
  outputTokens: 17085,
  thinkingTokens: 29983,
  totalTokens: 77984,
  p1Tokens: 30319,
  p234Tokens: 47665,
  actualUsd: 0.199692,
};

const PRICING = {
  MODEL: 'gemini-3.6-flash',
  INPUT_PRICE: 0.75,
  OUTPUT_PRICE: 3.75,
  SOURCE: 'https://ai.google.dev/gemini-api/docs/pricing#gemini-3.6-flash',
  DATE: '2026-08-20',
};

const FIELD_LABEL = new Map(PROFESSIONAL_FIELDS.map((f) => [f.code, f.name]));

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

function usdOf(input: number, billedOut: number) {
  return (input * PRICING.INPUT_PRICE) / 1_000_000 + (billedOut * PRICING.OUTPUT_PRICE) / 1_000_000;
}

function stop(reason: string, extra: Record<string, unknown> = {}): never {
  const payload = { status: 'STOPPED', reason, otherPersonsProcessed: 0, ...extra };
  writeJson(OUT, 'stopped.json', payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(2);
}

function specialtyLabel(code: string) {
  return SPECIALTY_BY_CODE.get(code)?.name ?? code;
}

function toPresentation(envelope: ProfilePilotEnvelope): Mc1PersonCompetenciesPresentationDto {
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
        label: FIELD_LABEL.get(f.fieldCode) ?? f.fieldCode,
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

function applyDriveEnv() {
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
}

function mdeTarget() {
  const mdeEnv = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const mde = {
    host: mdeEnv.MDE_DB_HOST,
    port: Number(mdeEnv.MDE_DB_PORT),
    database: mdeEnv.MDE_DB_NAME,
    username: mdeEnv.MDE_DB_USERNAME,
    password: mdeEnv.MDE_DB_PASSWORD,
  };
  assertMdeTarget(mde);
  return mde;
}

async function copyPersonCvFromCloud(personId: string) {
  const cloudEnv = loadEnvFile(resolve(ROOT, '.env'));
  const mde = mdeTarget();
  const cloud = new Client({
    host: cloudEnv.DB_HOST,
    port: Number(cloudEnv.DB_PORT || 5432),
    database: cloudEnv.DB_NAME,
    user: cloudEnv.DB_USERNAME,
    password: cloudEnv.DB_PASSWORD,
    ssl: cloudEnv.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  const local = new Client({
    host: mde.host,
    port: mde.port,
    database: mde.database,
    user: mde.username,
    password: mde.password,
  });
  await cloud.connect();
  await local.connect();
  try {
    await cloud.query('SET default_transaction_read_only = on');
    const people = await cloud.query(
      `SELECT id, document, full_name, COALESCE(is_active, true) AS is_active
         FROM core.person WHERE id = $1`,
      [personId],
    );
    const cvs = await cloud.query(
      `SELECT pc.id, pc.person_id, pc.document, pc.drive_file_id, pc.drive_file_name,
              pc.drive_web_url, pc.mime_type, pc.is_active, pc.synced_at,
              pc.drive_parent_folder_id, pc.drive_area_folder, pc.drive_subarea_folder,
              pc.drive_relative_path, pc.drive_modified_time, pc.drive_md5_checksum,
              pc.drive_file_size, pc.created_at
         FROM organigrama.person_cv pc
        WHERE pc.person_id = $1 AND pc.is_active = true
        ORDER BY pc.id`,
      [personId],
    );
    if (!people.rows[0] || !cvs.rows[0]) {
      throw new Error('CLOUD_PERSON_OR_CV_MISSING');
    }
    await local.query('BEGIN');
    try {
      const p = people.rows[0];
      await local.query(
        `INSERT INTO core.person (id, document, full_name, is_active)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE
           SET document=EXCLUDED.document, full_name=EXCLUDED.full_name, is_active=EXCLUDED.is_active`,
        [p.id, p.document, p.full_name, p.is_active],
      );
      await local.query(
        `SELECT setval(pg_get_serial_sequence('core.person','id'),
                GREATEST((SELECT MAX(id) FROM core.person), 1))`,
      );
      for (const cv of cvs.rows) {
        await local.query(
          `INSERT INTO organigrama.person_cv (
             id, person_id, document, drive_file_id, drive_file_name, drive_web_url,
             mime_type, is_active, synced_at, drive_parent_folder_id, drive_area_folder,
             drive_subarea_folder, drive_relative_path, drive_modified_time,
             drive_md5_checksum, drive_file_size, created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           ON CONFLICT (id) DO UPDATE SET
             person_id=EXCLUDED.person_id, document=EXCLUDED.document,
             drive_file_id=EXCLUDED.drive_file_id, drive_file_name=EXCLUDED.drive_file_name,
             drive_web_url=EXCLUDED.drive_web_url, mime_type=EXCLUDED.mime_type,
             is_active=EXCLUDED.is_active, synced_at=EXCLUDED.synced_at,
             drive_parent_folder_id=EXCLUDED.drive_parent_folder_id,
             drive_area_folder=EXCLUDED.drive_area_folder,
             drive_subarea_folder=EXCLUDED.drive_subarea_folder,
             drive_relative_path=EXCLUDED.drive_relative_path,
             drive_modified_time=EXCLUDED.drive_modified_time,
             drive_md5_checksum=EXCLUDED.drive_md5_checksum,
             drive_file_size=EXCLUDED.drive_file_size`,
          [
            cv.id, cv.person_id, cv.document, cv.drive_file_id, cv.drive_file_name,
            cv.drive_web_url, cv.mime_type, cv.is_active, cv.synced_at,
            cv.drive_parent_folder_id, cv.drive_area_folder, cv.drive_subarea_folder,
            cv.drive_relative_path, cv.drive_modified_time, cv.drive_md5_checksum,
            cv.drive_file_size, cv.created_at,
          ],
        );
      }
      await local.query(
        `SELECT setval(pg_get_serial_sequence('organigrama.person_cv','id'),
                GREATEST((SELECT MAX(id) FROM organigrama.person_cv), 1))`,
      );
      await local.query('COMMIT');
    } catch (e) {
      await local.query('ROLLBACK');
      throw e;
    }
    const cv = cvs.rows[0];
    return {
      personId,
      document: people.rows[0].document as string,
      fullName: people.rows[0].full_name as string,
      personCvId: Number(cv.id),
      driveFileId: String(cv.drive_file_id),
    };
  } finally {
    await cloud.end();
    await local.end();
  }
}

function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const crypto = require('crypto') as typeof import('crypto');
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

async function smokePerson(personId: string) {
  const env = loadEnvFile(resolve(ROOT, '.env'));
  if (!env.AUTH_JWT_SECRET) throw new Error('AUTH_JWT_SECRET_MISSING');
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    {
      personId: '1229',
      googleSubject: 'targeted4-smoke',
      googleEmail: 'desarrollofabrica@cun.edu.co',
      eduEmail: 'desarrollofabrica@cun.edu.co',
      permissions: ['ORG_READ_ALL', 'ORG_ADMIN'],
      iat: now,
      exp: now + 20 * 60,
    },
    env.AUTH_JWT_SECRET,
  );
  const url = `https://organigrama-backend-550902908078.us-central1.run.app/api/org-chart/person/${personId}/competencies/professional-profile?includeAudit=true`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as Record<string, unknown>;
  const mc1 = (body.mc1Profile ?? null) as Record<string, unknown> | null;
  const fields = (mc1?.fields as unknown[]) || [];
  const primary = fields.find((f) => (f as { role?: string }).role === 'PRIMARY') as
    | Record<string, unknown>
    | undefined;
  return {
    http: res.status,
    mc1Status: mc1?.status ?? null,
    source: mc1?.source ?? null,
    fieldCodes: fields.map((f) => (f as { code?: string }).code),
    primary: primary
      ? {
          code: primary.code,
          specialties: ((primary.specialties as unknown[]) ?? []).map(
            (s) => (s as { code?: string }).code,
          ),
          competencyMap: primary.competencyMap,
        }
      : null,
    ok:
      res.status === 200 &&
      mc1?.status === 'AVAILABLE' &&
      mc1?.source === 'CLOUD_PRESENTATION_STORE',
  };
}

async function publishPerson(personDir: string, personId: string) {
  const gate = JSON.parse(readFileSync(join(personDir, 'publication-gate.json'), 'utf8')) as {
    status: string;
    worstDrift: string;
  };
  const batch = JSON.parse(readFileSync(join(personDir, 'import-batch.json'), 'utf8'));
  const ids = (batch.profiles ?? []).map((p: { personId: string }) => String(p.personId));
  if (gate.status !== 'PASS' || gate.worstDrift === 'CRITICAL_DRIFT') {
    throw new Error('PUBLICATION_GATE_FAILURE');
  }
  if (ids.length !== 1 || ids[0] !== personId) {
    throw new Error(`IMPORT_BATCH_NOT_SOLO:${ids.join(',')}`);
  }
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
        personId,
        payload: batch.profiles[0].payload,
        configFingerprint: batch.profiles[0].configFingerprint,
        producedAt: batch.profiles[0].producedAt,
      },
    ]);
    writeJson(personDir, 'import-result.json', result);
    return result;
  } finally {
    await ds.destroy();
  }
}

type PersonResult = {
  personId: string;
  name: string;
  status: string;
  pages: number | null;
  textLength: number | null;
  p1Batches: number;
  p1Calls: number;
  p2Calls: number;
  p3Calls: number;
  p4Calls: number;
  totalCalls: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  p1Tokens: number;
  p234Tokens: number;
  actualUsd: number;
  evidenceUnits: number;
  p2Primary: string | null;
  p2Secondaries: string[];
  r1Status: string | null;
  r1Primary: string | null;
  p3Observed: string[];
  p3Weak: string[];
  p4PublicSkills: string[];
  firstRequiredStage: string;
  reusedStages: string[];
  executedStages: string[];
  publicationStatus: string;
  apiSmoke: Record<string, unknown> | null;
  frontendStateBefore: string;
  frontendStateAfter: string | null;
  drift: string;
  stopReason: string | null;
};

function projectRemainingUsd(done: PersonResult[], remaining: typeof COHORT[number][]) {
  if (!remaining.length) return 0;
  if (!done.length) {
    return remaining.reduce((s, p) => s + (0.05 + p.predictedP1Batches * 0.0235 + 0.12), 0);
  }
  const p1Tok = done.reduce((s, r) => s + r.p1Tokens, 0);
  const p1B = done.reduce((s, r) => s + Math.max(1, r.p1Batches), 0);
  const p234Tok = done.reduce((s, r) => s + r.p234Tokens, 0) / done.length;
  const perBatch = p1Tok / p1B;
  const inRatio =
    done.reduce((s, r) => s + r.inputTokens, 0) / done.reduce((s, r) => s + r.totalTokens, 0);
  let usd = 0;
  for (const p of remaining) {
    const tokens = p.predictedP1Batches * perBatch + p234Tok;
    const input = tokens * inRatio;
    usd += usdOf(input, tokens - input);
  }
  return usd;
}

async function processPerson(member: (typeof COHORT)[number], runStamp: string): Promise<PersonResult> {
  const personId = member.personId;
  const personDir = join(OUT, personId);
  mkdirSync(personDir, { recursive: true });

  const gem = loadEnvFile(
    resolve(ROOT, 'secrets/mc1-p1-prototype.local.env'),
    new Set(['GEMINI_API_KEY', 'GEMINI_MODEL']),
  );
  if (!gem.GEMINI_API_KEY) throw new Error('NO_GEMINI_KEY');
  const model = gem.GEMINI_MODEL || PRICING.MODEL;
  if (model !== PRICING.MODEL) {
    throw new Error(`UNEXPECTED_GEMINI_BEHAVIOR:model=${model}`);
  }

  applyDriveEnv();
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const mde = mdeTarget();
  const copied = await copyPersonCvFromCloud(personId);
  if (copied.personId !== personId) stop('PERSON_ID_MISMATCH', { copied });

  const dsP0 = await createMdeDataSource(mde);
  const p0svc = createP0Service(dsP0, mde);
  const p0Result = await p0svc.createOrReuseFromPersonCv(copied.personCvId);
  const snapshotId = String(p0Result.snapshotId);
  const p0Status = p0Result.outcome === 'CREATED' ? 'CREATED' : 'REUSED';
  const snap = (
    await dsP0.query(
      `SELECT id::text AS id, normalized_text, pages, sectioned_content,
              parse_status, page_count, char_length(normalized_text) AS nlen
         FROM organigrama.mc_cv_snapshot WHERE id = $1`,
      [snapshotId],
    )
  )[0];
  if (!snap?.normalized_text || snap.parse_status !== 'PARSED') {
    await dsP0.destroy();
    throw new Error('PIPELINE_FAILURE:SNAPSHOT_NOT_READY');
  }
  const pages =
    typeof snap.pages === 'string' ? JSON.parse(snap.pages) : snap.pages;
  const sectioned =
    typeof snap.sectioned_content === 'string'
      ? JSON.parse(snap.sectioned_content)
      : snap.sectioned_content;
  const predicted = new P1EvidenceBatchBuilder().build(
    new DeterministicEvidenceCandidateSegmenter().segment({
      snapshotId,
      normalizedText: snap.normalized_text,
      pages,
      sectionedContent: sectioned,
    }).candidates,
  ).length;
  await dsP0.destroy();

  const runId = `TARGET4-${personId}-${runStamp}`;
  const frozenPhase = 'TARGETED_4_CONTROLLED';
  const frozen = {
    phase: frozenPhase,
    personId,
    snapshotId,
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

  const prototypeId = `P1P-TARGET4-${personId}-S${snapshotId}-${runStamp}-${randomUUID().slice(0, 8)}`;
  const p1OutDir = resolve(ROOT, 'tmp', 'mc1-p1-prototype', prototypeId);
  mkdirSync(p1OutDir, { recursive: true });
  writeFileSync(
    join(p1OutDir, 'prototype-manifest.json'),
    JSON.stringify(
      {
        classification: 'CONFIDENTIAL',
        operationType: 'P1_TARGETED_4_CONTROLLED',
        prototypeId,
        snapshotId,
        personId,
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

  const p1Result = await runP1ForMember({
    prototypeId,
    snapshotId,
    normalizedText: snap.normalized_text,
    pages,
    sectionedContent: sectioned,
    apiKey: gem.GEMINI_API_KEY,
    model,
    outDir: p1OutDir,
    personId,
    personCvId: String(copied.personCvId),
    runId,
    backendRoot: ROOT,
  });
  if (!p1Result.ok) {
    await ds.destroy();
    throw new Error(`PIPELINE_FAILURE:P1:${p1Result.errorCode}`);
  }

  const batchesFile = JSON.parse(readFileSync(join(p1OutDir, 'batches.json'), 'utf8')) as {
    batches: Array<{ batchId: string; candidateIds: string[] }>;
  };
  const candToBatch = new Map<string, string>();
  for (const b of batchesFile.batches) {
    for (const id of b.candidateIds) candToBatch.set(id, b.batchId);
  }
  writeFileSync(
    join(p1OutDir, 'decisions.json'),
    JSON.stringify(
      {
        decisions: [...p1Result.decisions.entries()].map(([candidateId, decision]) => ({
          candidateId,
          decision,
          batchId: candToBatch.get(candidateId) ?? 'unknown',
        })),
      },
      null,
      2,
    ),
    'utf8',
  );

  const p2 = await runP2ArtifactOnly({
    backendRoot: ROOT,
    snapshotId,
    dataSource: ds,
    apiKey: gem.GEMINI_API_KEY,
    model,
    outRoot: join(personDir, 'artifacts', 'p2'),
    personId,
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

  const p3 = await runP3ArtifactOnly({
    backendRoot: ROOT,
    snapshotId,
    dataSource: ds,
    apiKey: gem.GEMINI_API_KEY,
    model,
    outRoot: join(personDir, 'artifacts', 'p3'),
    r1PackDir: r1.outDir,
    personId,
    pipelineRunId: runId,
  });
  const p4 = await runP4ArtifactOnly({
    backendRoot: ROOT,
    snapshotId,
    dataSource: ds,
    apiKey: gem.GEMINI_API_KEY,
    model,
    outRoot: join(personDir, 'artifacts', 'p4'),
    r1PackDir: r1.outDir,
    p3PackDir: p3.outDir,
    personId,
    pipelineRunId: runId,
  });
  const profile = await runProfilePilot({
    backendRoot: ROOT,
    snapshotId,
    outRoot: join(personDir, 'artifacts', 'profile'),
    dataSource: ds,
    r1PackDir: r1.outDir,
    p3PackDir: p3.outDir,
    p4PackDir: p4.outDir,
  });
  await ds.destroy();

  try {
    cpSync(p1OutDir, join(personDir, 'artifacts', 'p1'), { recursive: true });
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
    (f.competencyMap.dimensions ?? []).map((d) => ({ field: f.code, ...d })),
  );
  const noEvidence = axes.filter((a) => a.evidenceState === 'NO_EVIDENCE');
  const weakAxes = axes.filter((a) => a.evidenceState === 'WEAK_EVIDENCE');
  const observedAxes = axes.filter((a) => a.evidenceState === 'OBSERVED');
  const weakNot20 = weakAxes.filter((a) => a.relativeCoverage !== WEAK_EVIDENCE_FLOOR);
  const noEvNot0 = noEvidence.filter((a) => a.relativeCoverage !== 0);
  const observedBelow20 = observedAxes.filter((a) => a.relativeCoverage < 20);

  const drift: Array<{ class: string; detail: string }> = [];
  if (!primary) drift.push({ class: 'CRITICAL_DRIFT', detail: 'R1 produced no PRIMARY' });
  if (personId === '1077' && primary === 'PEOPLE_HR') {
    drift.push({
      class: 'COMPATIBLE_DRIFT',
      detail: 'Leidy PRIMARY=PEOPLE_HR; PA2 histórico era TALENT_MANAGEMENT (no es catálogo MC1)',
    });
  } else if (personId === '1077' && primary === 'EDUCATION') {
    drift.push({ class: 'COMPATIBLE_DRIFT', detail: 'Leidy PRIMARY=EDUCATION vs PA2 TALENT; cargo coordinador académico' });
  } else if (personId === '1303' && primary) {
    drift.push({
      class: 'EXPECTED_DRIFT',
      detail: `Felipe PRIMARY=${primary}; TAXONOMY_BLOCKED histórico no es gold; pipeline productivo actual`,
    });
  } else if (primary) {
    drift.push({ class: 'EXPECTED_DRIFT', detail: `PRIMARY=${primary} from productive pipeline` });
  }
  if (weakAsPublic.length) {
    drift.push({ class: 'CRITICAL_DRIFT', detail: `WEAK specialties published: ${weakAsPublic.join(',')}` });
  }
  if (weakNot20.length) drift.push({ class: 'CRITICAL_DRIFT', detail: 'WEAK_EVIDENCE axis not flat 20' });
  if (noEvNot0.length) drift.push({ class: 'CRITICAL_DRIFT', detail: 'NO_EVIDENCE axis not 0' });
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
  const publishable =
    worst !== 'CRITICAL_DRIFT' &&
    worst !== 'SUSPICIOUS_DRIFT' &&
    validation.ok &&
    presentation.fields.length > 0;

  const ledgerPath = join(OUT, 'gemini-ledger', 'events.jsonl');
  const events = existsSync(ledgerPath) ? readGeminiLedgerEvents(ROOT) : [];
  const mine = filterLedgerByRun(events, runId);
  const totals = aggregateGeminiUsage(mine);
  const byPhase = {
    P1: aggregateGeminiUsage(mine.filter((e) => e.phase === 'P1')),
    P2: aggregateGeminiUsage(mine.filter((e) => e.phase === 'P2')),
    P3: aggregateGeminiUsage(mine.filter((e) => e.phase === 'P3')),
    P4: aggregateGeminiUsage(mine.filter((e) => e.phase === 'P4')),
  };
  const inputTok = totals.promptTokens ?? 0;
  const outTok = totals.candidateTokens ?? 0;
  const thinkTok = totals.thinkingTokens ?? 0;
  const actualUsd = usdOf(inputTok, outTok + thinkTok);
  const p1Tokens = byPhase.P1.totalTokens ?? 0;
  const p234Tokens = (totals.totalTokens ?? 0) - p1Tokens;
  const otherIds = [...new Set(mine.map((e) => e.personId).filter((id) => id && id !== personId))];
  if (otherIds.length) {
    throw new Error(`UNEXPECTED_GEMINI_BEHAVIOR:otherIds=${otherIds.join(',')}`);
  }
  if ((totals.failedCalls ?? 0) > 0) {
    throw new Error(`UNEXPECTED_GEMINI_BEHAVIOR:failedCalls=${totals.failedCalls}`);
  }

  const p2Active = [...p2.envelope.payload.domainCandidates]
    .filter((c) => c.candidateStatus === 'ACTIVE' && c.domainCode)
    .sort((a, b) => a.rank - b.rank);
  const p2Primary = p2Active[0]?.domainCode ?? null;
  const p2Secondaries = p2Active.slice(1).map((c) => c.domainCode!) ;

  const gate = {
    status: publishable ? 'PASS' : 'FAIL',
    worstDrift: worst,
    drift,
    newPublicSpecialties: publicSpecs,
    newPublicSkills: publicSkills,
    weakAxes: weakAxes.map((a) => a.code),
    observedAxes: observedAxes.map((a) => a.code),
    noEvidenceAxes: noEvidence.map((a) => a.code),
    observedBelow20: observedBelow20.map((a) => ({ code: a.code, relativeCoverage: a.relativeCoverage })),
    publicationGateByField: presentation.fields.map((f) => {
      const raw = (profile.envelope.payload.fields ?? []).find((x) => x.fieldCode === f.code);
      return raw ? classifyFieldPublication(raw) : null;
    }),
    p4GeminiInvoked: p4.geminiInvoked,
    p3Observed,
    p3Weak,
  };

  writeJson(personDir, 'publication-gate.json', gate);
  writeJson(personDir, 'presentation.json', presentation);
  writeJson(personDir, 'import-batch.json', {
    configFingerprint,
    profiles: [
      {
        personId,
        configFingerprint,
        producedAt: new Date().toISOString(),
        payload: { ...presentation, source: 'CLOUD_PRESENTATION_STORE' },
      },
    ],
  });
  writeJson(personDir, 'pipeline-report.json', {
    runId,
    personId,
    p0: { status: p0Status, snapshotId, pageCount: snap.page_count, textLength: snap.nlen, predictedP1Batches: predicted },
    p1: { status: p1Result.executionStatus, calls: byPhase.P1.calls, batches: p1Result.batchCount, units: p1Result.units.length },
    p2: { status: p2.executionStatus, calls: byPhase.P2.calls, primary: p2Primary, secondaries: p2Secondaries },
    r1: { status: r1p.fieldResolutionStatus, primary, secondaries },
    p3: { status: p3.executionStatus, calls: byPhase.P3.calls, observed: p3Observed, weak: p3Weak },
    p4: { status: p4.executionStatus, calls: byPhase.P4.calls, geminiInvoked: p4.geminiInvoked },
    gate,
    ledger: { totals, byPhase, actualUsd: Number(actualUsd.toFixed(6)) },
  });
  writeJson(personDir, 'cost-actual.json', {
    runId,
    totals,
    byPhase,
    actualUsd: Number(actualUsd.toFixed(6)),
    PRICING,
  });

  const base: PersonResult = {
    personId,
    name: member.name,
    status: publishable ? 'PIPELINE_OK_GATE_PASS' : 'PIPELINE_OK_GATE_FAIL',
    pages: Number(snap.page_count),
    textLength: Number(snap.nlen),
    p1Batches: p1Result.batchCount,
    p1Calls: byPhase.P1.calls,
    p2Calls: byPhase.P2.calls,
    p3Calls: byPhase.P3.calls,
    p4Calls: byPhase.P4.calls,
    totalCalls: totals.calls,
    inputTokens: inputTok,
    outputTokens: outTok,
    thinkingTokens: thinkTok,
    totalTokens: totals.totalTokens ?? 0,
    p1Tokens,
    p234Tokens,
    actualUsd: Number(actualUsd.toFixed(6)),
    evidenceUnits: p1Result.units.length,
    p2Primary,
    p2Secondaries,
    r1Status: r1p.fieldResolutionStatus,
    r1Primary: primary,
    p3Observed,
    p3Weak,
    p4PublicSkills: publicSkills,
    firstRequiredStage: 'P1',
    reusedStages: [] as string[],
    executedStages: ['P0', 'P1', 'P2', 'R1', 'P3', 'P4', 'PROFILE'],
    publicationStatus: 'NOT_PUBLISHED',
    apiSmoke: null,
    frontendStateBefore: member.uiBefore,
    frontendStateAfter: null,
    drift: worst,
    stopReason: null,
  };

  if (!publishable) {
    base.status = worst === 'SUSPICIOUS_DRIFT' ? 'SUSPICIOUS_DRIFT' : 'PUBLICATION_GATE_FAILURE';
    base.stopReason =
      worst === 'CRITICAL_DRIFT'
        ? 'CRITICAL_DRIFT'
        : worst === 'SUSPICIOUS_DRIFT'
          ? 'SUSPICIOUS_DRIFT'
          : 'PUBLICATION_GATE_FAILURE';
    return base;
  }

  const imported = await publishPerson(personDir, personId);
    const publishedCount = (imported.inserted ?? 0) + (imported.updated ?? 0);
    base.publicationStatus = publishedCount > 0 ? 'PUBLISHED' : JSON.stringify(imported);
  const smoke = await smokePerson(personId);
  writeJson(personDir, 'production-smoke.json', smoke);
  base.apiSmoke = smoke;
  if (!smoke.ok) {
    base.status = 'PRODUCTION_SMOKE_FAILURE';
    base.stopReason = 'PIPELINE_FAILURE';
    base.frontendStateAfter = String(smoke.mc1Status);
    return base;
  }
  base.frontendStateAfter = 'MC1_AVAILABLE';
  base.status = 'COMPLETED';
  return base;
}

async function census() {
  const cloudEnv = loadEnvFile(resolve(ROOT, '.env'));
  const cloud = new Client({
    host: cloudEnv.DB_HOST,
    port: Number(cloudEnv.DB_PORT || 5432),
    database: cloudEnv.DB_NAME,
    user: cloudEnv.DB_USERNAME,
    password: cloudEnv.DB_PASSWORD,
    ssl: cloudEnv.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await cloud.connect();
  try {
    await cloud.query('SET default_transaction_read_only = on');
    const rows = (
      await cloud.query(
        `SELECT person_id::text, count(*)::int AS n
           FROM organigrama.mc1_person_profile_presentation
          WHERE is_active = true AND person_id = ANY($1::bigint[])
          GROUP BY person_id`,
        [TARGET_IDS],
      )
    ).rows as Array<{ person_id: string; n: number }>;
    const withProfile = new Set(rows.map((r) => r.person_id));
    const missing = TARGET_IDS.filter((id) => !withProfile.has(id));
    return {
      targeted: 4,
      nowWithActivePresentation: withProfile.size,
      remainingMissing: missing.length,
      missingIds: missing,
      presentIds: [...withProfile].sort(),
    };
  } finally {
    await cloud.end();
  }
}

function cv(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, cv: mean === 0 ? Infinity : Math.sqrt(variance) / mean };
}

function costModel(rows: Array<{
  personId: string;
  pages: number | null;
  textLength: number | null;
  p1Batches: number;
  evidenceUnits: number;
  totalTokens: number;
  actualUsd: number;
}>) {
  const predictors = [
    { name: 'pageCount', of: (r: (typeof rows)[0]) => r.pages ?? 0 },
    { name: 'textLength', of: (r: (typeof rows)[0]) => r.textLength ?? 0 },
    { name: 'p1Batches', of: (r: (typeof rows)[0]) => r.p1Batches },
    { name: 'evidenceUnits', of: (r: (typeof rows)[0]) => r.evidenceUnits },
  ] as const;
  const ranked = predictors.map((p) => {
    const unitCost = rows.map((r) => r.actualUsd / Math.max(p.of(r), 0.0001));
    const c = cv(unitCost);
    return { predictor: p.name, usdPerUnitCv: Number(c.cv.toFixed(4)), meanUsdPerUnit: Number(c.mean.toFixed(6)) };
  }).sort((a, b) => a.usdPerUnitCv - b.usdPerUnitCv);
  return ranked;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(OUT, 'gemini-ledger'), { recursive: true });
  process.env.MC1_GEMINI_LEDGER_PATH = join(OUT, 'gemini-ledger', 'events.jsonl');

  if (process.argv.includes('--force') || envOn('MC1_FORCE_GEMINI')) {
    stop('FORCE_FORBIDDEN');
  }
  if (isP2DeterministicAuthorityEnabled()) stop('EXPERIMENTAL_AUTHORITY_ACTIVE');
  if (isP2DeterministicSkipGeminiEnabled()) stop('EXPERIMENTAL_P2_SKIP_ACTIVE');
  if (isP2CanaryEnabled()) stop('CAMILO_CANARY_FLAG_ACTIVE');
  if (isShadowResolverEnabled()) stop('SHADOW_RESOLVER_ENABLED');
  if (!process.argv.includes('--confirm')) stop('REQUIRES_CONFIRM');

  const extra = process.argv.map((a) => a.match(/personId=(\d+)/)?.[1]).filter(Boolean) as string[];
  if (extra.some((id) => !ALLOWED.has(id))) stop('OTHER_PERSON_FORBIDDEN', { extra });

  const runStamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const completed: PersonResult[] = [];
  const failed: PersonResult[] = [];
  let stopReason: string | null = null;

  for (let i = 0; i < COHORT.length; i++) {
    const member = COHORT[i];
    const remainingIncluding = COHORT.slice(i);
    const projected = projectRemainingUsd(completed, [...remainingIncluding]);
    const spent = completed.reduce((s, r) => s + r.actualUsd, 0);
    const wouldExceed = spent + projected > BUDGET_USD + 0.000001;
    writeJson(OUT, 'budget-checkpoint.json', {
      beforePerson: member.personId,
      spent,
      projectedRemainingIncludingCurrent: Number(projected.toFixed(6)),
      projectedTotal: Number((spent + projected).toFixed(6)),
      guardrail: BUDGET_USD,
      wouldExceed,
    });
    if (wouldExceed) {
      stopReason = 'STOP_BUDGET_GUARDRAIL';
      writeJson(OUT, 'stopped.json', {
        status: 'STOPPED',
        reason: stopReason,
        nextPersonNotStarted: member.personId,
        spent,
        projected,
      });
      break;
    }

    console.error(`\n=== START ${member.personId} ${member.name} ===`);
    let result: PersonResult;
    try {
      result = await processPerson(member, runStamp);
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      const reason = msg.startsWith('UNEXPECTED_GEMINI')
        ? 'UNEXPECTED_GEMINI_BEHAVIOR'
        : msg.startsWith('PUBLICATION')
          ? 'PUBLICATION_GATE_FAILURE'
          : 'PIPELINE_FAILURE';
      result = {
        personId: member.personId,
        name: member.name,
        status: reason,
        pages: null,
        textLength: null,
        p1Batches: 0,
        p1Calls: 0,
        p2Calls: 0,
        p3Calls: 0,
        p4Calls: 0,
        totalCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        thinkingTokens: 0,
        totalTokens: 0,
        p1Tokens: 0,
        p234Tokens: 0,
        actualUsd: 0,
        evidenceUnits: 0,
        p2Primary: null,
        p2Secondaries: [],
        r1Status: null,
        r1Primary: null,
        p3Observed: [],
        p3Weak: [],
        p4PublicSkills: [],
        firstRequiredStage: 'P1',
        reusedStages: [],
        executedStages: [],
        publicationStatus: 'NOT_PUBLISHED',
        apiSmoke: null,
        frontendStateBefore: member.uiBefore,
        frontendStateAfter: null,
        drift: 'CRITICAL_DRIFT',
        stopReason: reason,
      };
      writeJson(join(OUT, member.personId), 'person-error.json', {
        error: msg,
        stack: e instanceof Error ? e.stack : null,
      });
    }
    writeJson(join(OUT, member.personId), 'person-result.json', result);
    if (result.stopReason) {
      failed.push(result);
      stopReason = result.stopReason;
      break;
    }
    completed.push(result);
    const spentNow = completed.reduce((s, r) => s + r.actualUsd, 0);
    const rest = COHORT.slice(i + 1);
    const projRest = projectRemainingUsd(completed, [...rest]);
    writeJson(OUT, 'budget-after.json', {
      afterPerson: member.personId,
      spent: spentNow,
      projectedRemaining: Number(projRest.toFixed(6)),
      projectedTotal: Number((spentNow + projRest).toFixed(6)),
      guardrail: BUDGET_USD,
    });
    if (rest.length && spentNow + projRest > BUDGET_USD + 0.000001) {
      stopReason = 'STOP_BUDGET_GUARDRAIL';
      break;
    }
  }

  const all = [...completed, ...failed];
  const totals = all.reduce(
    (s, r) => ({
      calls: s.calls + r.totalCalls,
      input: s.input + r.inputTokens,
      output: s.output + r.outputTokens,
      thinking: s.thinking + r.thinkingTokens,
      tokens: s.tokens + r.totalTokens,
      usd: s.usd + r.actualUsd,
      p1Tokens: s.p1Tokens + r.p1Tokens,
      p234Tokens: s.p234Tokens + r.p234Tokens,
      p1Batches: s.p1Batches + r.p1Batches,
    }),
    { calls: 0, input: 0, output: 0, thinking: 0, tokens: 0, usd: 0, p1Tokens: 0, p234Tokens: 0, p1Batches: 0 },
  );

  const modelRows = [
    JESSICA,
    ...completed.map((r) => ({
      personId: r.personId,
      pages: r.pages,
      textLength: r.textLength,
      p1Batches: r.p1Batches,
      evidenceUnits: r.evidenceUnits,
      totalTokens: r.totalTokens,
      actualUsd: r.actualUsd,
    })),
  ];
  const ranked = completed.length ? costModel(modelRows) : [];
  const pop = await census();

  const summary = {
    status: stopReason
      ? stopReason === 'STOP_BUDGET_GUARDRAIL'
        ? 'STOPPED_BUDGET_GUARDRAIL'
        : 'STOPPED_GATE'
      : completed.length === 4
        ? 'COHORT_COMPLETE'
        : 'COHORT_INCOMPLETE',
    personsAttempted: completed.length + failed.length,
    personsCompleted: completed.map((r) => r.personId),
    personsFailed: failed.map((r) => r.personId),
    stopReason,
    persons: all,
    gemini: {
      calls: totals.calls,
      inputTokens: totals.input,
      outputTokens: totals.output,
      thinkingTokens: totals.thinking,
      totalTokens: totals.tokens,
      actualUsd: Number(totals.usd.toFixed(6)),
    },
    budget: {
      estimated: { calls: '32-35', tokens: '277k-408k', usd: '0.71-1.10', expected: 0.834 },
      actualUsd: Number(totals.usd.toFixed(6)),
      guardrail: BUDGET_USD,
      status: totals.usd <= BUDGET_USD ? 'UNDER_GUARDRAIL' : 'OVER_GUARDRAIL',
    },
    costModel: {
      tokensPerP1Batch: totals.p1Batches ? Number((totals.p1Tokens / totals.p1Batches).toFixed(1)) : null,
      usdPerP1Batch: totals.p1Batches ? Number((totals.usd / totals.p1Batches).toFixed(6)) : null,
      p1ShareOfTokens: totals.tokens ? Number((totals.p1Tokens / totals.tokens).toFixed(4)) : null,
      VARIABLE_P1_COST: Number(usdOf(
        completed.reduce((s, r) => s + r.inputTokens * (r.p1Tokens / Math.max(r.totalTokens, 1)), 0),
        completed.reduce((s, r) => s + (r.outputTokens + r.thinkingTokens) * (r.p1Tokens / Math.max(r.totalTokens, 1)), 0),
      ).toFixed(6)),
      P2_P3_P4_COST: Number((totals.usd - (totals.tokens ? totals.usd * (totals.p1Tokens / totals.tokens) : 0)).toFixed(6)),
      predictorRanking: ranked,
      bestCostPredictor: ranked[0]?.predictor ?? null,
    },
    census: pop,
    otherPersonsProcessed: 0,
    NEXT: 'STOP — WAIT_FOR_HUMAN_DECISION',
  };
  // simpler P1 vs P234 usd split using token share
  if (totals.tokens) {
    summary.costModel.VARIABLE_P1_COST = Number((totals.usd * (totals.p1Tokens / totals.tokens)).toFixed(6));
    summary.costModel.P2_P3_P4_COST = Number((totals.usd * (totals.p234Tokens / totals.tokens)).toFixed(6));
  }
  writeJson(OUT, 'summary.json', summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});
