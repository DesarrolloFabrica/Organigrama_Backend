/**
 * FASE 11D.3 — COMMUNICATIONS cohort LIVE Gemini rebuild.
 *
 *   npx ts-node --transpile-only scripts/mc1-communications-cohort-11d3.ts --confirm --force-live-ai
 *
 * Full P0→P1→P2→R1→P3→P4→Profile LIVE. No historical pack reuse when --force-live-ai.
 * Role/hierarchy never enter Gemini payloads. Reports use caseId only (no documents/PII).
 * DIGITAL_MARKETING specialty catalog still missing — gap preserved (no improvised catalog).
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
import { findBestValidProfilePack } from '../src/mc-pipeline/preview/mc1-profile-preview.service';
import type { ProfilePilotEnvelope } from '../src/mc-pipeline/profile/profile.types';

const ROOT = resolve(__dirname, '..');
const BINDINGS_PATH = resolve(
  ROOT,
  'tmp',
  'mc1-profile-preview',
  'real-person-bindings.json',
);
const INDEX_PATH = resolve(
  ROOT,
  'tmp',
  'mc1-profile-preview',
  'person-snapshot-index.json',
);
const REPORT_PATH = resolve(
  ROOT,
  'tmp',
  'mc1-communications-cohort-11d3',
  'cohort-report.json',
);

/** Document lookup is server-side only; never print in reports. */
const COHORT: Array<{
  caseId: string;
  document: string;
  reuseProfileOnly?: boolean;
}> = [
  { caseId: 'person-katherin-araque', document: '1000020890' },
  { caseId: 'person-danna-fierro', document: '1013102120' },
  { caseId: 'person-linda-aguilera', document: '1072896519' },
  { caseId: 'person-alejandra-sanabria', document: '1013100614' },
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

function writeBinding(caseId: string, snapshotId: string) {
  mkdirSync(resolve(ROOT, 'tmp', 'mc1-profile-preview'), { recursive: true });
  let current: Record<string, { snapshotId: string; boundAt: string }> = {};
  if (existsSync(BINDINGS_PATH)) {
    try {
      current = JSON.parse(readFileSync(BINDINGS_PATH, 'utf8'));
    } catch {
      current = {};
    }
  }
  current[caseId] = {
    snapshotId: String(snapshotId),
    boundAt: new Date().toISOString(),
  };
  writeFileSync(BINDINGS_PATH, JSON.stringify(current, null, 2), 'utf8');
}

function writePersonSnapshotIndex(
  personId: string | number,
  snapshotId: string,
  caseId: string,
) {
  mkdirSync(resolve(ROOT, 'tmp', 'mc1-profile-preview'), { recursive: true });
  let current: Record<
    string,
    { snapshotId: string; caseId?: string; boundAt?: string }
  > = {};
  if (existsSync(INDEX_PATH)) {
    try {
      current = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    } catch {
      current = {};
    }
  }
  current[String(personId)] = {
    snapshotId: String(snapshotId),
    caseId,
    boundAt: new Date().toISOString(),
  };
  writeFileSync(INDEX_PATH, JSON.stringify(current, null, 2), 'utf8');
}

function summarizeProfile(envelope: ProfilePilotEnvelope) {
  const fields = envelope.payload.fields ?? [];
  if (!fields.length) {
    return {
      fieldCodes: [] as string[],
      multiField: false,
      specialties: [] as string[],
      skillCount: 0,
      tools: [] as string[],
      evidenceVolume: null as string | null,
      derivedPresentationLabel: null as string | null,
      radar: {} as Record<string, number>,
      radarByField: {} as Record<string, Record<string, number>>,
      dominantRadar: null as string | null,
      warnings: envelope.warnings ?? [],
    };
  }
  const radarByField: Record<string, Record<string, number>> = {};
  for (const f of fields) {
    const radar: Record<string, number> = {};
    for (const a of f.radar?.axes ?? []) {
      radar[a.dimensionCode] = a.relativeCoverage;
    }
    radarByField[f.fieldCode] = radar;
  }
  const primary =
    fields.find((f) => f.role === 'PRIMARY') ?? fields[0];
  const radar = radarByField[primary.fieldCode] ?? {};
  const dominant =
    [...(primary.radar?.axes ?? [])].sort(
      (a, b) => b.relativeCoverage - a.relativeCoverage,
    )[0] ?? null;
  return {
    fieldCodes: fields.map((x) => x.fieldCode),
    multiField: fields.length > 1,
    fieldRoles: fields.map((f) => ({
      fieldCode: f.fieldCode,
      role: f.role,
    })),
    specialties: fields.flatMap((f) =>
      f.specialties.map((s) => s.specialtyCode),
    ),
    specialtiesByField: fields.map((f) => ({
      fieldCode: f.fieldCode,
      specialties: f.specialties.map((s) => s.specialtyCode),
    })),
    skillCount: fields.reduce((n, f) => n + f.skills.length, 0),
    skillNames: fields.flatMap((f) => f.skills.map((s) => s.name)),
    skillsBySpecialty: fields.flatMap((f) =>
      f.specialties.map((sp) => ({
        fieldCode: f.fieldCode,
        specialtyCode: sp.specialtyCode,
        skills: f.skills
          .filter((sk) => sk.parentSpecialtyCode === sp.specialtyCode)
          .map((sk) => sk.skillCode || sk.name),
      })),
    ),
    tools: [
      ...new Set(fields.flatMap((f) => f.toolsTechnologies ?? [])),
    ],
    evidenceVolume: primary.evidenceVolume,
    evidenceVolumeByField: fields.map((f) => ({
      fieldCode: f.fieldCode,
      evidenceVolume: f.evidenceVolume,
    })),
    derivedPresentationLabel: primary.derivedPresentationLabel ?? null,
    radar,
    radarByField,
    dominantRadar: dominant
      ? { code: dominant.dimensionCode, coverage: dominant.relativeCoverage }
      : null,
    warnings: envelope.warnings ?? [],
  };
}

function communicationsResolved(r1Payload: {
  fieldResolutionStatus: string;
  primaryField?: { fieldCode: string | null } | null;
  secondaryFields?: Array<{ fieldCode: string | null }> | null;
}): boolean {
  if (r1Payload.fieldResolutionStatus === 'UNRESOLVED') return false;
  const codes = [
    r1Payload.primaryField?.fieldCode,
    ...(r1Payload.secondaryFields ?? []).map((f) => f.fieldCode),
  ].filter((c): c is string => !!c);
  return codes.includes('COMMUNICATIONS');
}

function digitalMarketingGap(r1Payload: {
  primaryField?: { fieldCode: string | null } | null;
  secondaryFields?: Array<{ fieldCode: string | null }> | null;
}): boolean {
  const codes = [
    r1Payload.primaryField?.fieldCode,
    ...(r1Payload.secondaryFields ?? []).map((f) => f.fieldCode),
  ].filter((c): c is string => !!c);
  return (
    codes.includes('DIGITAL_MARKETING') &&
    !SPECIALTY_CATALOG_SCOPE.has('DIGITAL_MARKETING')
  );
}

async function ensureDecisionsJson(p1Dir: string) {
  if (packHasDecisions(p1Dir)) return;
  const batchesFile = JSON.parse(
    readFileSync(join(p1Dir, 'batches.json'), 'utf8'),
  ) as { batches: Array<{ batchId: string; candidateIds: string[] }> };
  const validated = JSON.parse(
    readFileSync(join(p1Dir, 'validated-evidence.json'), 'utf8'),
  ) as { units?: Array<{ candidateId?: string }> };
  const candidates = JSON.parse(
    readFileSync(join(p1Dir, 'candidates.json'), 'utf8'),
  ) as { candidates?: Array<{ candidateId: string }> };
  const candToBatch = new Map<string, string>();
  for (const b of batchesFile.batches) {
    for (const id of b.candidateIds) candToBatch.set(id, b.batchId);
  }
  const withUnits = new Set(
    (validated.units ?? [])
      .map((u) => u.candidateId)
      .filter((x): x is string => !!x),
  );
  const allIds =
    candidates.candidates?.map((c) => c.candidateId) ??
    [...candToBatch.keys()];
  const decisions = allIds.map((candidateId) => ({
    candidateId,
    decision: withUnits.has(candidateId) ? 'ACCEPTED' : 'REJECTED_NO_UNIT',
    reasonCode: withUnits.has(candidateId) ? 'OK' : 'REJECTED',
    batchId: candToBatch.get(candidateId) ?? 'unknown',
  }));
  writeFileSync(
    join(p1Dir, 'decisions.json'),
    JSON.stringify({ decisions }, null, 2),
    'utf8',
  );
}

async function processCase(args: {
  caseId: string;
  document: string;
  reuseProfileOnly?: boolean;
  forceLiveAi?: boolean;
  gem: Record<string, string>;
  mde: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
}): Promise<Record<string, unknown>> {
  const { caseId, document, reuseProfileOnly, forceLiveAi, gem, mde } = args;

  void reuseProfileOnly;

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
    [document],
  );
  const row = rows?.[0];
  if (!row?.person_cv_id) {
    await dsP0.destroy();
    return { caseId, status: 'PROCESSING_ERROR', error: 'PERSON_CV_NOT_FOUND' };
  }
  const personId = String(row.person_id);
  const personCvId = Number(row.person_cv_id);
  let snapshotId = row.ready_snapshot_id ? String(row.ready_snapshot_id) : null;
  let p0Origin: string = 'REUSED_VALID';
  if (!snapshotId) {
    const result = await p0.createOrReuseFromPersonCv(personCvId);
    snapshotId = String(result.snapshotId);
    p0Origin = result.outcome === 'CREATED' ? 'CREATED' : 'REUSED_VALID';
  }
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
    let p1Dir =
      forceLiveAi ? null : resolveCohortArtifactDir(ROOT, snapshotId!);
    let p1Origin = 'REUSED';
    let p1GeminiInvoked = false;
    let p1Stats: Record<string, unknown> = {};
    if (!p1Dir || !packHasDecisions(p1Dir)) {
      if (p1Dir && !packHasDecisions(p1Dir) && !forceLiveAi) {
        await ensureDecisionsJson(p1Dir);
        p1Origin = 'REUSED_DECISIONS_FIXED';
      } else {
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
              operationType: 'P1_11D2_AUDIOVISUAL_LIVE',
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
        p1Dir = outDir;
        p1Origin = 'LIVE';
        p1GeminiInvoked = true;
        const units = p1Result.units ?? [];
        p1Stats = {
          candidates: p1Result.candidateCount ?? decisions.length,
          evidenceUnits: units.length,
          explicit: units.filter((u) => u.explicitness === 'EXPLICIT').length,
          stronglySupported: units.filter(
            (u) => u.explicitness === 'STRONGLY_SUPPORTED',
          ).length,
          batches: p1Result.batchCount ?? batchesFile.batches.length,
          reviewRequired: decisions.filter(
            (d) => d.decision === 'REVIEW_REQUIRED',
          ).length,
          resultOrigin: 'LIVE',
          model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
          executionId: prototypeId,
          geminiInvoked: true,
        };
      }
    }

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
    const primary = r1p.primaryField?.fieldCode ?? null;
    const hasCommunications = communicationsResolved(r1p);
    const hasDigitalMarketingGap = digitalMarketingGap(r1p);

    let p3Origin: string = 'SKIPPED_NO_IN_SCOPE_FIELD';
    let p3Pack: string | null = null;
    let p3Observed: Array<{ specialtyCode: string; confidence?: number; fieldCode?: string }> = [];
    let p3Weak: Array<{ specialtyCode: string; confidence?: number; fieldCode?: string }> = [];
    let p3GeminiInvoked = false;
    let p4Origin = 'SKIPPED';
    let p4Pack: string | null = null;
    let p4GeminiInvoked = false;
    let p4Summary: unknown = null;
    let profilePack: string | null = null;
    let profileSummary: ReturnType<typeof summarizeProfile> | null = null;
    const warnings: string[] = [];
    if (hasDigitalMarketingGap) {
      warnings.push('SPECIALTY_CATALOG_NOT_AVAILABLE:DIGITAL_MARKETING');
    }

    // P3 runs when R1 has any in-scope field (COMM and other frozen catalogs).
    const inScope =
      (primary && SPECIALTY_CATALOG_SCOPE.has(primary)) ||
      (r1p.secondaryFields ?? []).some(
        (f) => !!f.fieldCode && SPECIALTY_CATALOG_SCOPE.has(f.fieldCode),
      );

    if (inScope) {
      const p3 = await runP3ArtifactOnly({
        backendRoot: ROOT,
        snapshotId: String(snapshotId),
        dataSource: ds,
        apiKey: gem.GEMINI_API_KEY,
        model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
        outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
        r1PackDir: r1.outDir,
      });
      p3Origin = 'LIVE';
      p3Pack = p3.outDir;
      p3GeminiInvoked = !!p3.geminiInvoked;
      for (const fr of p3.envelope.payload.fieldResults ?? []) {
        for (const s of fr.observedSpecialties ?? []) {
          if (s.status === 'OBSERVED') {
            p3Observed.push({
              specialtyCode: s.specialtyCode,
              confidence: s.confidence,
              fieldCode: fr.fieldCode,
            });
          }
          if (s.status === 'WEAK') {
            p3Weak.push({
              specialtyCode: s.specialtyCode,
              confidence: s.confidence,
              fieldCode: fr.fieldCode,
            });
          }
        }
      }

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
      p4Origin = p3Observed.length
        ? 'LIVE'
        : 'ABSTAINED_NO_OBSERVED_SPECIALTY';
      p4Pack = p4.outDir;
      p4GeminiInvoked = !!p4.geminiInvoked;
      p4Summary = (p4.envelope.payload.specialtyResults ?? []).map((sr) => ({
        specialtyCode: sr.specialtyCode,
        skillsObserved: (sr.observedSkills ?? [])
          .filter((sk) => sk.status === 'OBSERVED')
          .map((sk) => sk.skillCode || sk.name),
        skillsWeak: (sr.observedSkills ?? [])
          .filter((sk) => sk.status === 'WEAK')
          .map((sk) => sk.skillCode || sk.name),
        tools: [
          ...new Set(
            (sr.observedSkills ?? []).flatMap(
              (sk) => sk.toolOrTechnologySignals ?? [],
            ),
          ),
        ],
      }));

      const profile = await runProfilePilot({
        backendRoot: ROOT,
        snapshotId: String(snapshotId),
        outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
        dataSource: ds,
        r1PackDir: r1.outDir,
        p3PackDir: p3.outDir,
        p4PackDir: p4.outDir,
      });
      profilePack = profile.outDir;
      profileSummary = summarizeProfile(profile.envelope);
    } else {
      // Still assemble profile with field-only if R1 resolved something
      const p3 = await runP3ArtifactOnly({
        backendRoot: ROOT,
        snapshotId: String(snapshotId),
        dataSource: ds,
        apiKey: gem.GEMINI_API_KEY,
        model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
        outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
        r1PackDir: r1.outDir,
      });
      p3Origin = 'LIVE_ABSTAIN_OR_OUT_OF_SCOPE';
      p3Pack = p3.outDir;
      p3GeminiInvoked = !!p3.geminiInvoked;
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
      p4Origin = 'ABSTAINED';
      p4Pack = p4.outDir;
      p4GeminiInvoked = !!p4.geminiInvoked;
      const profile = await runProfilePilot({
        backendRoot: ROOT,
        snapshotId: String(snapshotId),
        outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
        dataSource: ds,
        r1PackDir: r1.outDir,
        p3PackDir: p3.outDir,
        p4PackDir: p4.outDir,
      });
      profilePack = profile.outDir;
      profileSummary = summarizeProfile(profile.envelope);
    }

    writeBinding(caseId, String(snapshotId));
    writePersonSnapshotIndex(personId, String(snapshotId), caseId);

    return {
      caseId,
      status: 'DONE',
      personId,
      personCvId,
      snapshotId,
      communicationsResolved: hasCommunications,
      digitalMarketingCatalogGap: hasDigitalMarketingGap,
      warnings,
      p0: p0Origin,
      p1: {
        origin: p1Origin,
        packDir: p1Dir,
        geminiInvoked: p1GeminiInvoked,
        resultOrigin: p1GeminiInvoked ? 'LIVE' : p1Origin,
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
        })),
      },
      r1: {
        origin: 'CREATED',
        packDir: r1.outDir,
        status: r1p.fieldResolutionStatus,
        primary,
        secondaries: (r1p.secondaryFields ?? []).map((f) => ({
          code: f.fieldCode,
          confidence: f.confidence,
        })),
        decisionCodes: r1p.decisionCodes,
      },
      p3: {
        origin: p3Origin,
        packDir: p3Pack,
        observed: p3Observed,
        weak: p3Weak,
        geminiInvoked: p3GeminiInvoked,
        resultOrigin: p3GeminiInvoked ? 'LIVE' : p3Origin,
      },
      p4: {
        origin: p4Origin,
        packDir: p4Pack,
        geminiInvoked: p4GeminiInvoked,
        resultOrigin: p4GeminiInvoked ? 'LIVE' : p4Origin,
        specialtyResults: p4Summary,
      },
      profile: profileSummary,
      packDir: profilePack,
    };
  } finally {
    await ds.destroy();
  }
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
        reuseProfileOnly: c.reuseProfileOnly,
        forceLiveAi,
        gem,
        mde,
      });
      results.push(r);
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
        status: 'PROCESSING_ERROR',
        error: String(e instanceof Error ? e.message : e).slice(0, 400),
      });
    }
  }

  mkdirSync(resolve(ROOT, 'tmp', 'mc1-communications-cohort-11d3'), {
    recursive: true,
  });
  const report = {
    phase: '11D.3',
    mode: 'LIVE_GEMINI',
    forceLiveAi,
    status: 'DONE',
    specialtyCatalogVersion: SPECIALTY_CATALOG_SCOPE.has('COMMUNICATIONS')
      ? 'COMM_IN_SCOPE'
      : 'CHECK_CATALOG',
    model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
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
