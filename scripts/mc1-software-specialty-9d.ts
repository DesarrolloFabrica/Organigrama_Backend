/**
 * FASE 9D — Apply SOFTWARE_ENGINEERING Specialty V1 on real snapshot 8.
 * Regenerates only P3 → P4 → Profile. Reuses existing P1/P2/R1.
 *
 *   npx ts-node --transpile-only scripts/mc1-software-specialty-9d.ts --confirm
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { runP3ArtifactOnly } from '../src/mc-pipeline/p3/p3-runner';
import { runP4ArtifactOnly } from '../src/mc-pipeline/p4/p4-runner';
import { runProfilePilot } from '../src/mc-pipeline/profile/profile-runner';
import { SPECIALTY_CATALOG_VERSION } from '../src/mc-pipeline/catalog/specialties-visual-education';

const ROOT = resolve(__dirname, '..');
const SNAPSHOT_ID = '8';
const CASE_ID = 'person-camilo';
const R1_PACK = resolve(
  ROOT,
  'tmp',
  'mc1-r1-functional',
  'R1F-8A2-S8-20260810151310-e59a8ed6',
);
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
        hint: '--confirm required (invokes Gemini for P3/P4)',
      }),
    );
    process.exit(2);
  }
  if (!existsSync(R1_PACK)) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'R1_PACK_MISSING',
        r1Pack: R1_PACK,
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

  try {
    const p3 = await runP3ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: SNAPSHOT_ID,
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
      outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
      r1PackDir: R1_PACK,
    });

    const p3Observed = (p3.envelope.payload.fieldResults ?? []).flatMap((f) =>
      (f.observedSpecialties ?? []).map((s) => ({
        fieldCode: f.fieldCode,
        specialtyCode: s.specialtyCode,
        status: s.status,
        confidence: s.confidence,
        evidenceCount: s.supportingEvidenceUnitIds?.length ?? 0,
      })),
    );

    const p4 = await runP4ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: SNAPSHOT_ID,
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
      outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
      r1PackDir: R1_PACK,
      p3PackDir: p3.outDir,
    });

    const profile = await runProfilePilot({
      backendRoot: ROOT,
      snapshotId: SNAPSHOT_ID,
      outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
      dataSource: ds,
      r1PackDir: R1_PACK,
      p3PackDir: p3.outDir,
      p4PackDir: p4.outDir,
    });

    writeBindings(SNAPSHOT_ID);

    const field = profile.envelope.payload.fields[0];
    console.log(
      JSON.stringify(
        {
          phase: '9D',
          status: 'DONE',
          specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
          snapshotId: SNAPSHOT_ID,
          reused: { r1Pack: R1_PACK, p0: true, p1: true, p2: true, r1: true },
          p3: {
            origin: 'CREATED',
            packDir: p3.outDir,
            outcomeStatus: p3.envelope.payload.outcomeStatus,
            geminiInvoked: p3.geminiInvoked,
            specialties: p3Observed,
          },
          p4: {
            origin: 'CREATED',
            packDir: p4.outDir,
            outcomeStatus: p4.envelope.payload.outcomeStatus,
            geminiInvoked: p4.geminiInvoked,
            specialtyResults: (p4.envelope.payload.specialtyResults ?? []).map(
              (sr) => ({
                specialtyCode: sr.specialtyCode,
                skills: (sr.observedSkills ?? []).map((sk) => ({
                  skillCode: sk.skillCode,
                  name: sk.name,
                  status: sk.status,
                  confidence: sk.confidence,
                  evidenceCount: sk.supportingEvidenceUnitIds?.length ?? 0,
                  tools: sk.toolOrTechnologySignals ?? [],
                })),
              }),
            ),
          },
          profile: {
            origin: 'CREATED',
            packDir: profile.outDir,
            fieldCode: field?.fieldCode ?? null,
            derivedPresentationLabel: field?.derivedPresentationLabel ?? null,
            specialtyCodes: (field?.specialties ?? []).map(
              (s) => s.specialtyCode,
            ),
            skillCount: field?.skills?.length ?? 0,
            toolCount: field?.toolsTechnologies?.length ?? 0,
            evidenceVolume: field?.evidenceVolume ?? null,
            radar: (field?.radar?.axes ?? []).map((a) => ({
              dimension: a.label,
              code: a.dimensionCode,
              rawScore: a.rawScore,
              relativeCoverage: a.relativeCoverage,
            })),
            warnings: profile.envelope.warnings.map((w) => w.code),
          },
          previewBinding: { caseId: CASE_ID, snapshotId: SNAPSHOT_ID },
        },
        null,
        2,
      ),
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
