/**
 * FASE 12B — Visual Design specialty application on frozen 12A cohort.
 * Reuses P0/P1/P2/R1 from 12A. Runs only P3 → P4 → Profile Assembly.
 *
 *   npx ts-node --transpile-only scripts/mc1-visual-design-cohort-12b.ts --confirm
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { runP3ArtifactOnly } from '../src/mc-pipeline/p3/p3-runner';
import { runP4ArtifactOnly } from '../src/mc-pipeline/p4/p4-runner';
import { runProfilePilot } from '../src/mc-pipeline/profile/profile-runner';
import { SPECIALTY_CATALOG_SCOPE } from '../src/mc-pipeline/catalog/specialties-visual-education';
import type { ProfilePilotEnvelope } from '../src/mc-pipeline/profile/profile.types';
import { readMc1PersonProfile } from '../src/mc-pipeline/person-profile';

const ROOT = resolve(__dirname, '..');
const SOURCE_12A = resolve(
  ROOT,
  'tmp',
  'mc1-design-sibling-cohort-12a',
  'cohort-report.json',
);
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-visual-design-cohort-12b');
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

const VD_AXES = [
  'VD_VISUAL_COMMUNICATION',
  'VD_BRAND_SYSTEMS',
  'VD_EDITORIAL',
  'VD_PRODUCT_INTERFACE',
  'VD_ILLUSTRATION',
  'VD_MOTION',
  'VD_PRODUCTION_CRAFT',
] as const;

const LABEL: Record<string, string> = {
  'person-nidia-prada': 'Nidia',
  'person-jesica-carrillo': 'Jesica',
  'person-alison-castro': 'Alison',
  'person-anibal-angulo': 'Anibal',
  'person-ginna-garzon': 'Ginna',
};

type SourceCase = {
  caseId: string;
  personId: string;
  snapshotId: string;
  r1PackDir: string;
  primary: string | null;
  secondaries: string[];
  r1Status: string;
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
  // alias for Nidia historical caseId used in DOCUMENT_CASE_REGISTRY
  if (caseId === 'person-nidia-prada') {
    current['person-nidia'] = {
      snapshotId: String(snapshotId),
      boundAt: new Date().toISOString(),
    };
  }
  if (caseId === 'person-ginna-garzon') {
    current['person-ginna'] = {
      snapshotId: String(snapshotId),
      boundAt: new Date().toISOString(),
    };
  }
  writeFileSync(BINDINGS_PATH, JSON.stringify(current, null, 2), 'utf8');
}

function writePersonSnapshotIndex(
  personId: string,
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

function loadSourceCases(): SourceCase[] {
  const raw = JSON.parse(readFileSync(SOURCE_12A, 'utf8')) as {
    results: Array<{
      caseId: string;
      personId: string;
      snapshotId: string;
      status: string;
      r1?: {
        packDir?: string;
        status?: string;
        primary?: string | null;
        secondaries?: Array<{ code?: string }>;
      };
    }>;
  };
  return raw.results
    .filter((r) => r.status === 'DONE' && r.r1?.packDir)
    .map((r) => ({
      caseId: r.caseId,
      personId: String(r.personId),
      snapshotId: String(r.snapshotId),
      r1PackDir: String(r.r1!.packDir),
      primary: r.r1?.primary ?? null,
      secondaries: (r.r1?.secondaries ?? [])
        .map((s) => s.code)
        .filter((c): c is string => !!c),
      r1Status: r.r1?.status ?? 'UNKNOWN',
    }));
}

function summarizeProfile(envelope: ProfilePilotEnvelope) {
  const resolved = envelope.payload.resolvedFieldsProvenance ?? [];
  const publishable = envelope.payload.fields ?? [];
  const fields = publishable.map((f) => {
    const radar: Record<string, number> = {};
    for (const a of f.radar?.axes ?? []) {
      radar[a.dimensionCode] = a.relativeCoverage;
    }
    return {
      fieldCode: f.fieldCode,
      role: f.role,
      publicationStatus: f.publicationStatus,
      taxonomyPending: f.taxonomyPending,
      specialties: f.specialties.map((s) => s.specialtyCode),
      skills: f.skills.map((sk) => ({
        skillCode: sk.skillCode,
        name: sk.name,
        parentSpecialtyCode: sk.parentSpecialtyCode,
      })),
      tools: f.toolsTechnologies,
      evidenceVolume: f.evidenceVolume,
      radar,
      vdRadar: Object.fromEntries(
        VD_AXES.map((code) => [code, radar[code] ?? null]),
      ),
    };
  });

  const hidden = resolved
    .filter((r) => r.publicationStatus === 'PROVENANCE_ONLY')
    .map((r) => ({
      fieldCode: r.fieldCode,
      role: r.role,
      reasonCode: r.reasonCode,
    }));

  return {
    r1Status: envelope.payload.r1FieldResolutionStatus,
    resolvedFields: resolved.map((r) => ({
      fieldCode: r.fieldCode,
      role: r.role,
      publicationStatus: r.publicationStatus,
      reasonCode: r.reasonCode,
      observedSpecialtyCount: r.observedSpecialtyCount,
    })),
    publishableFields: fields.map((f) => f.fieldCode),
    hiddenFields: hidden,
    fields,
    warnings: envelope.warnings?.map((w) => w.code) ?? [],
    gate:
      envelope.payload.presentationNotes?.fieldPublicationGate ?? null,
  };
}

async function processCase(args: {
  c: SourceCase;
  gem: Record<string, string>;
  ds: DataSource;
}): Promise<Record<string, unknown>> {
  const { c, gem, ds } = args;
  if (!existsSync(c.r1PackDir)) {
    return {
      caseId: c.caseId,
      label: LABEL[c.caseId] ?? c.caseId,
      status: 'PROCESSING_ERROR',
      error: 'R1_PACK_MISSING',
      r1Pack: c.r1PackDir,
    };
  }

  const p3 = await runP3ArtifactOnly({
    backendRoot: ROOT,
    snapshotId: c.snapshotId,
    dataSource: ds,
    apiKey: gem.GEMINI_API_KEY,
    model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
    outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
    r1PackDir: c.r1PackDir,
  });

  const p3ByField: Record<
    string,
    { observed: string[]; weak: string[]; all: unknown[] }
  > = {};
  for (const fr of p3.envelope.payload.fieldResults ?? []) {
    const observed: string[] = [];
    const weak: string[] = [];
    const all: unknown[] = [];
    for (const s of fr.observedSpecialties ?? []) {
      all.push({
        specialtyCode: s.specialtyCode,
        status: s.status,
        confidence: s.confidence,
        evidenceCount: s.supportingEvidenceUnitIds?.length ?? 0,
      });
      if (s.status === 'OBSERVED') observed.push(s.specialtyCode);
      if (s.status === 'WEAK') weak.push(s.specialtyCode);
    }
    p3ByField[fr.fieldCode] = { observed, weak, all };
  }

  const p4 = await runP4ArtifactOnly({
    backendRoot: ROOT,
    snapshotId: c.snapshotId,
    dataSource: ds,
    apiKey: gem.GEMINI_API_KEY,
    model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
    outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
    r1PackDir: c.r1PackDir,
    p3PackDir: p3.outDir,
  });

  const p4Rows = (p4.envelope.payload.specialtyResults ?? []).map((sr) => ({
    fieldCode: sr.fieldCode,
    specialtyCode: sr.specialtyCode,
    skillsObserved: (sr.observedSkills ?? [])
      .filter((sk) => sk.status === 'OBSERVED')
      .map((sk) => sk.skillCode || sk.name),
    skillsWeak: (sr.observedSkills ?? [])
      .filter((sk) => sk.status === 'WEAK')
      .map((sk) => sk.skillCode || sk.name),
    skillNames: (sr.observedSkills ?? [])
      .filter((sk) => sk.status === 'OBSERVED')
      .map((sk) => sk.name),
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
    snapshotId: c.snapshotId,
    outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
    dataSource: ds,
    r1PackDir: c.r1PackDir,
    p3PackDir: p3.outDir,
    p4PackDir: p4.outDir,
  });

  writeBinding(c.caseId, c.snapshotId);
  writePersonSnapshotIndex(c.personId, c.snapshotId, c.caseId);

  const reader = await readMc1PersonProfile({
    personId: c.personId,
    dataSource: ds,
    backendRoot: ROOT,
  });

  // Gate simulation for resolved-but-not-in-payload (assembler already filtered)
  const gateCheck = (profile.envelope.payload.resolvedFieldsProvenance ?? []).map(
    (r) => ({
      fieldCode: r.fieldCode,
      role: r.role,
      publicationStatus: r.publicationStatus,
      reasonCode: r.reasonCode,
    }),
  );

  return {
    caseId: c.caseId,
    label: LABEL[c.caseId] ?? c.caseId,
    status: 'DONE',
    personId: c.personId,
    snapshotId: c.snapshotId,
    reused: { p0: true, p1: true, p2: true, r1: c.r1PackDir },
    r1Source: {
      status: c.r1Status,
      primary: c.primary,
      secondaries: c.secondaries,
    },
    p3: {
      origin: 'LIVE',
      packDir: p3.outDir,
      geminiInvoked: !!p3.geminiInvoked,
      resultOrigin: p3.geminiInvoked ? 'LIVE' : 'NONE',
      byField: p3ByField,
      fieldsEvaluated: p3.envelope.payload.fieldsEvaluated ?? [],
    },
    p4: {
      origin: 'LIVE',
      packDir: p4.outDir,
      geminiInvoked: !!p4.geminiInvoked,
      resultOrigin: p4.geminiInvoked ? 'LIVE' : 'NONE',
      specialtyResults: p4Rows,
    },
    profile: {
      origin: 'CREATED',
      packDir: profile.outDir,
      summary: summarizeProfile(profile.envelope),
      gateCheck,
    },
    personDetail: {
      status: reader.status,
      tabs:
        reader.status === 'AVAILABLE'
          ? reader.presentation.fields.map((f) => ({
              code: f.code,
              role: f.role,
              specialtyCount: f.specialties?.length ?? 0,
              toolCount: f.tools?.length ?? 0,
              radarAxes: f.competencyMap?.dimensions?.length ?? 0,
            }))
          : [],
      fallbackLegacy: false,
    },
  };
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'REQUIRES_CONFIRM' }));
    process.exit(2);
  }
  if (!existsSync(SOURCE_12A)) {
    console.log(
      JSON.stringify({ status: 'BLOCKED', reason: 'MISSING_12A_REPORT' }),
    );
    process.exit(2);
  }

  const only = process.argv
    .find((a) => a.startsWith('--only='))
    ?.split('=')[1]
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
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

  const cases = loadSourceCases().filter(
    (c) => !only || only.includes(c.caseId),
  );

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
          error: String(e instanceof Error ? e.message : e).slice(0, 400),
        });
      }
    }
  } finally {
    await ds.destroy();
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    phase: '12B',
    mode: 'LIVE_GEMINI_P3_P4_PROFILE',
    status: 'DONE',
    model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
    reusedUpstream: '12A_P0_P1_P2_R1',
    specialtyCatalogScopeHasVD: SPECIALTY_CATALOG_SCOPE.has('VISUAL_DESIGN'),
    fieldPublicationGate: 'MC1.PROFILE.PUBLICATION_GATE.1.0.0',
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
