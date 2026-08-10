/**
 * FASE 10C — AUDIOVISUAL Specialty Application + Three Person Validation.
 * Reuses P0/P1/P2/R1 from 10A. Runs only P3 → P4 → Profile.
 *
 *   npx ts-node --transpile-only scripts/mc1-audiovisual-cohort-10c.ts --confirm
 *   npx ts-node --transpile-only scripts/mc1-audiovisual-cohort-10c.ts --confirm --only=person-santiago-vanegas
 *
 * Reports use caseId only (no documents/PII). No Cloud persistence.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { runP3ArtifactOnly } from '../src/mc-pipeline/p3/p3-runner';
import { runP4ArtifactOnly } from '../src/mc-pipeline/p4/p4-runner';
import { runProfilePilot } from '../src/mc-pipeline/profile/profile-runner';
import { SPECIALTY_CATALOG_VERSION } from '../src/mc-pipeline/catalog/specialties-visual-education';
import type { ProfilePilotEnvelope } from '../src/mc-pipeline/profile/profile.types';

const ROOT = resolve(__dirname, '..');
const MANIFEST_PATH = resolve(
  ROOT,
  'tmp',
  'mc1-field-discovery-10a',
  'cohort-manifest.json',
);
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-audiovisual-cohort-10c');
const REPORT_PATH = join(OUT_DIR, 'cohort-report.json');
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

type ManifestCase = {
  caseId: string;
  personId: string;
  snapshotId: string;
  p1: string;
  p2: string;
  r1: string;
};

const LABEL: Record<string, string> = {
  'person-santiago-vanegas': 'Santiago',
  'person-juan-pablo-sanabria': 'Juan Pablo',
  'person-camilo-ramirez': 'Camilo Ramírez',
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
  // Same person as Group B caseId for Santiago
  if (caseId === 'person-santiago-vanegas') {
    current['person-santiago'] = {
      snapshotId: String(snapshotId),
      boundAt: new Date().toISOString(),
    };
  }
  writeFileSync(BINDINGS_PATH, JSON.stringify(current, null, 2), 'utf8');
}

function mergePersonSnapshotIndex(
  rows: Array<{ personId: string; snapshotId: string; caseId: string }>,
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
  const now = new Date().toISOString();
  for (const r of rows) {
    current[String(r.personId)] = {
      snapshotId: String(r.snapshotId),
      caseId: r.caseId,
      boundAt: now,
    };
  }
  writeFileSync(INDEX_PATH, JSON.stringify(current, null, 2), 'utf8');
}

function summarizeProfile(envelope: ProfilePilotEnvelope) {
  const fields = envelope.payload.fields.map((f) => {
    const radar: Record<string, number> = {};
    for (const a of f.radar?.axes ?? []) {
      radar[a.dimensionCode] = a.relativeCoverage;
    }
    const dominant =
      [...(f.radar?.axes ?? [])].sort(
        (a, b) => b.relativeCoverage - a.relativeCoverage,
      )[0] ?? null;
    return {
      fieldCode: f.fieldCode,
      role: f.role,
      r1Confidence: f.r1Confidence,
      specialties: f.specialties.map((s) => ({
        specialtyCode: s.specialtyCode,
        confidence: s.confidence,
      })),
      skills: f.skills.map((sk) => ({
        skillCode: sk.skillCode,
        name: sk.name,
        parentSpecialtyCode: sk.parentSpecialtyCode,
        confidence: sk.confidence,
        evidenceCount: sk.supportingEvidenceUnitIds?.length ?? 0,
      })),
      tools: f.toolsTechnologies,
      evidenceVolume: f.evidenceVolume,
      evidenceUnitCount: f.evidenceUnitCount,
      radar,
      radarDebug: (f.radar?.axes ?? []).map((a) => ({
        dimensionCode: a.dimensionCode,
        relativeCoverage: a.relativeCoverage,
        rawScore: a.rawScore,
      })),
      dominantRadar: dominant
        ? {
            code: dominant.dimensionCode,
            label: dominant.label,
            coverage: dominant.relativeCoverage,
          }
        : null,
      derivedPresentationLabel: f.derivedPresentationLabel ?? null,
    };
  });

  const av = fields.find((f) => f.fieldCode === 'AUDIOVISUAL_PRODUCTION');
  const vd = fields.find((f) => f.fieldCode === 'VISUAL_DESIGN');

  return {
    r1Status: envelope.payload.r1FieldResolutionStatus,
    fieldCodes: fields.map((f) => f.fieldCode),
    fields,
    avSpecialties: (av?.specialties ?? []).map((s) => s.specialtyCode),
    vdSpecialties: (vd?.specialties ?? []).map((s) => s.specialtyCode),
    avRadar: av?.radar ?? {},
    vdRadar: vd?.radar ?? {},
    avDominant: av?.dominantRadar ?? null,
    evidenceVolumeAv: av?.evidenceVolume ?? null,
  };
}

async function processCase(args: {
  c: ManifestCase;
  gem: Record<string, string>;
  ds: DataSource;
}): Promise<Record<string, unknown>> {
  const { c, gem, ds } = args;
  if (!existsSync(c.r1)) {
    return {
      caseId: c.caseId,
      label: LABEL[c.caseId] ?? c.caseId,
      status: 'PROCESSING_ERROR',
      error: 'R1_PACK_MISSING',
      r1Pack: c.r1,
    };
  }

  const p3 = await runP3ArtifactOnly({
    backendRoot: ROOT,
    snapshotId: c.snapshotId,
    dataSource: ds,
    apiKey: gem.GEMINI_API_KEY,
    model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
    outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
    r1PackDir: c.r1,
  });

  const p3Rows = (p3.envelope.payload.fieldResults ?? []).flatMap((f) =>
    (f.observedSpecialties ?? []).map((s) => ({
      fieldCode: f.fieldCode,
      specialtyCode: s.specialtyCode,
      status: s.status,
      confidence: s.confidence,
      evidenceCount: s.supportingEvidenceUnitIds?.length ?? 0,
      evidenceIds: s.supportingEvidenceUnitIds ?? [],
    })),
  );

  const p4 = await runP4ArtifactOnly({
    backendRoot: ROOT,
    snapshotId: c.snapshotId,
    dataSource: ds,
    apiKey: gem.GEMINI_API_KEY,
    model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
    outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
    r1PackDir: c.r1,
    p3PackDir: p3.outDir,
  });

  const p4Rows = (p4.envelope.payload.specialtyResults ?? []).map((sr) => ({
    fieldCode: sr.fieldCode,
    specialtyCode: sr.specialtyCode,
    skills: (sr.observedSkills ?? []).map((sk) => ({
      skillCode: sk.skillCode,
      name: sk.name,
      status: sk.status,
      confidence: sk.confidence,
      evidenceCount: sk.supportingEvidenceUnitIds?.length ?? 0,
      tools: sk.toolOrTechnologySignals ?? [],
      signals: sk.supportingSignals ?? [],
    })),
  }));

  const profile = await runProfilePilot({
    backendRoot: ROOT,
    snapshotId: c.snapshotId,
    outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
    dataSource: ds,
    r1PackDir: c.r1,
    p3PackDir: p3.outDir,
    p4PackDir: p4.outDir,
  });

  writeBinding(c.caseId, c.snapshotId);

  return {
    caseId: c.caseId,
    label: LABEL[c.caseId] ?? c.caseId,
    status: 'DONE',
    personId: c.personId,
    snapshotId: c.snapshotId,
    reused: { p0: true, p1: true, p2: true, r1: c.r1 },
    p3: {
      origin: 'CREATED',
      packDir: p3.outDir,
      outcomeStatus: p3.envelope.payload.outcomeStatus,
      geminiInvoked: p3.geminiInvoked,
      fieldsEvaluated: p3.envelope.payload.fieldsEvaluated ?? [],
      specialties: p3Rows,
    },
    p4: {
      origin: 'CREATED',
      packDir: p4.outDir,
      outcomeStatus: p4.envelope.payload.outcomeStatus,
      geminiInvoked: p4.geminiInvoked,
      specialtyResults: p4Rows,
    },
    profile: {
      origin: 'CREATED',
      packDir: profile.outDir,
      summary: summarizeProfile(profile.envelope),
    },
  };
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        hint: '--confirm required (invokes Gemini for P3/P4)',
      }),
    );
    process.exit(2);
  }
  if (!existsSync(MANIFEST_PATH)) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: '10A_MANIFEST_MISSING',
        path: MANIFEST_PATH,
      }),
    );
    process.exit(2);
  }

  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  const only = onlyArg
    ? onlyArg
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const mdeEnv = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const gem = loadEnvFile(
    resolve(ROOT, 'secrets/mc1-p1-prototype.local.env'),
    new Set(['GEMINI_API_KEY', 'GEMINI_MODEL']),
  );
  assertMdeTarget({
    host: mdeEnv.MDE_DB_HOST,
    port: Number(mdeEnv.MDE_DB_PORT),
    database: mdeEnv.MDE_DB_NAME,
  });
  if (!gem.GEMINI_API_KEY) {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'NO_GEMINI_KEY' }));
    process.exit(2);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as {
    cases: ManifestCase[];
  };
  const cases = manifest.cases.filter((c) => !only || only.includes(c.caseId));

  const ds = new DataSource({
    type: 'postgres',
    host: mdeEnv.MDE_DB_HOST,
    port: Number(mdeEnv.MDE_DB_PORT),
    username: mdeEnv.MDE_DB_USERNAME,
    password: mdeEnv.MDE_DB_PASSWORD,
    database: mdeEnv.MDE_DB_NAME,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();

  const results: unknown[] = [];
  try {
    for (const c of cases) {
      try {
        const r = await processCase({ c, gem, ds });
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
          label: LABEL[c.caseId] ?? c.caseId,
          status: 'PROCESSING_ERROR',
          error: String(e instanceof Error ? e.message : e).slice(0, 500),
        });
      }
    }
  } finally {
    await ds.destroy();
  }

  mergePersonSnapshotIndex(
    cases.map((c) => ({
      personId: c.personId,
      snapshotId: c.snapshotId,
      caseId: c.caseId,
    })),
  );

  mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    phase: '10C',
    mode: 'ARTIFACT_ONLY',
    status: 'DONE',
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    reusedUpstream: true,
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
