/**
 * Completa perfil Diana (1207) desde P3→P4→Profile reutilizando P1/P2/R1.
 *
 *   npx ts-node --transpile-only scripts/mc1-diana-digital-marketing-complete.ts --confirm
 *
 * No reejecuta P0/P1/P2/R1. Cloud writes = 0. No toca Sara.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { runP3ArtifactOnly } from '../src/mc-pipeline/p3/p3-runner';
import { runP4ArtifactOnly } from '../src/mc-pipeline/p4/p4-runner';
import { runProfilePilot } from '../src/mc-pipeline/profile/profile-runner';
import { readMc1PersonProfile } from '../src/mc-pipeline/person-profile';
import {
  SPECIALTY_CATALOG_VERSION,
  specialtiesForField,
} from '../src/mc-pipeline/catalog/specialties-visual-education';
import { dimensionsForField } from '../src/mc-pipeline/profile/profile-dimensions';
import { listObservedP4Skills } from '../src/mc-pipeline/profile/profile-pack-loader';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-diana-digital-marketing-complete');
const SNAPSHOT_ID = '41';
const PERSON_ID = '1207';
const FIELD_CODE = 'DIGITAL_MARKETING';
const R1_PACK =
  'C:\\dev\\Organigrama\\Organigrama_Backend\\tmp\\mc1-r1-functional\\R1F-8A2-S41-20260811194539-fe32c131';

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
  if (!process.argv.includes('--confirm')) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        hint: 'npx ts-node --transpile-only scripts/mc1-diana-digital-marketing-complete.ts --confirm',
      }),
    );
    process.exit(2);
  }

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
  if (!existsSync(R1_PACK)) {
    console.log(
      JSON.stringify({ status: 'BLOCKED', reason: 'R1_PACK_MISSING', R1_PACK }),
    );
    process.exit(2);
  }

  const model = gem.GEMINI_MODEL || 'gemini-3.6-flash';
  mkdirSync(OUT_DIR, { recursive: true });

  const preflight = {
    personId: PERSON_ID,
    snapshotId: SNAPSHOT_ID,
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    daSpecialties: specialtiesForField(FIELD_CODE).map((s) => s.code),
    daDimensions: dimensionsForField(FIELD_CODE).map((d) => d.code),
    reuse: { p0: true, p1: true, p2: true, r1: true, r1Pack: R1_PACK },
    cloudWrites: 0,
  };
  writeFileSync(join(OUT_DIR, 'preflight.json'), JSON.stringify(preflight, null, 2));

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
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ progress: 'P3_START' }));
    const p3 = await runP3ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: SNAPSHOT_ID,
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model,
      outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
      r1PackDir: R1_PACK,
    });

    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ progress: 'P4_START', p3: p3.outDir }));
    const p4 = await runP4ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: SNAPSHOT_ID,
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model,
      outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
      r1PackDir: R1_PACK,
      p3PackDir: p3.outDir,
    });

    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ progress: 'PROFILE_START', p4: p4.outDir }));
    const profile = await runProfilePilot({
      backendRoot: ROOT,
      snapshotId: SNAPSHOT_ID,
      outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
      dataSource: ds,
      r1PackDir: R1_PACK,
      p3PackDir: p3.outDir,
      p4PackDir: p4.outDir,
    });

    const reader = await readMc1PersonProfile({
      personId: PERSON_ID,
      dataSource: ds,
      backendRoot: ROOT,
    });

    const p3ByField: Record<
      string,
      { observed: string[]; weak: string[] }
    > = {};
    for (const fr of p3.envelope.payload.fieldResults ?? []) {
      const observed: string[] = [];
      const weak: string[] = [];
      for (const s of fr.observedSpecialties ?? []) {
        if (s.status === 'OBSERVED') observed.push(s.specialtyCode);
        if (s.status === 'WEAK') weak.push(s.specialtyCode);
      }
      p3ByField[fr.fieldCode] = { observed, weak };
    }

    const observedP3 = new Set(
      Object.values(p3ByField).flatMap((x) => x.observed),
    );
    const weakOnly = new Set(
      Object.values(p3ByField).flatMap((x) => x.weak),
    );

    const p4Rows = (p4.envelope.payload.specialtyResults ?? []).map((r) => ({
      specialtyCode: r.specialtyCode,
      skills: (r.observedSkills ?? [])
        .filter((sk) => !sk.status || sk.status === 'OBSERVED')
        .map((sk) => ({
          skillCode: sk.skillCode,
          name: sk.name,
          tools: sk.toolOrTechnologySignals ?? [],
          supportingSignals: sk.supportingSignals ?? [],
          supportingEvidenceUnitIds: sk.supportingEvidenceUnitIds ?? [],
        })),
    }));

    const publicSkills = listObservedP4Skills(
      p4.envelope,
      Object.entries(p3ByField).flatMap(([fieldCode, v]) =>
        v.observed.map((specialtyCode) => ({ fieldCode, specialtyCode })),
      ),
    );

    const field = profile.envelope.payload.fields.find(
      (f) => f.fieldCode === FIELD_CODE,
    );
    const gate = (profile.envelope.payload.resolvedFieldsProvenance ?? []).find(
      (f) => f.fieldCode === FIELD_CODE,
    );

    const radarAxes = (field?.radar?.axes ?? []).map((a) => ({
      dimensionCode: a.dimensionCode,
      relativeCoverage: a.relativeCoverage,
      contributingSkillCodes: a.contributingSkillCodes ?? [],
    }));

    const checks = {
      hasDigitalMarketingTab: !!field,
      taxonomyPending: !!gate?.taxonomyPending,
      gateReason: gate?.reasonCode ?? null,
      publicationStatus: gate?.publicationStatus ?? null,
      emptySpecialtyPublished: (field?.specialties ?? []).some(
        (s) =>
          !(field?.skills ?? []).some(
            (sk) => sk.parentSpecialtyCode === s.specialtyCode,
          ),
      ),
      weakPublicSkills: publicSkills.some((sk) =>
        weakOnly.has(sk.parentSpecialtyCode) &&
        !observedP3.has(sk.parentSpecialtyCode),
      ),
      radarHasContributors: radarAxes
        .filter((a) => a.relativeCoverage > 0)
        .every((a) => (a.contributingSkillCodes?.length ?? 0) > 0),
      mapperAvailable: dimensionsForField(FIELD_CODE).length === 6,
      specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    };

    const decision =
      checks.hasDigitalMarketingTab &&
      !checks.taxonomyPending &&
      checks.publicationStatus === 'PUBLISHABLE' &&
      checks.mapperAvailable &&
      checks.radarHasContributors &&
      !checks.weakPublicSkills &&
      (field?.specialties?.length ?? 0) > 0 &&
      (field?.skills?.length ?? 0) > 0
        ? 'DIGITAL_MARKETING_OPERATIONAL_DIANA_VALIDATED'
        : 'DIGITAL_MARKETING_IMPLEMENTATION_BLOCKED';

    const report = {
      decision,
      cloudWrites: 0,
      personId: PERSON_ID,
      personCvId: 20,
      snapshotId: SNAPSHOT_ID,
      specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
      packs: {
        r1: R1_PACK,
        p3: p3.outDir,
        p4: p4.outDir,
        profile: profile.outDir,
      },
      p3: p3ByField,
      p4: p4Rows,
      publicSkills: publicSkills.map((s) => ({
        skillCode: s.skillCode,
        name: s.name,
        parentSpecialtyCode: s.parentSpecialtyCode,
      })),
      gate,
      profileField: field
        ? {
            specialties: field.specialties.map((s) => s.specialtyCode),
            skillCount: field.skills.length,
            tools: field.toolsTechnologies,
            radar: Object.fromEntries(
              radarAxes.map((a) => [a.dimensionCode, a.relativeCoverage]),
            ),
            radarAxes,
          }
        : null,
      personDetail:
        reader.status === 'AVAILABLE'
          ? {
              tabs: reader.presentation.fields.map((f) => ({
                code: f.code,
                role: f.role,
                specialtyCount: f.specialties?.length ?? 0,
                toolCount: f.tools?.length ?? 0,
                radarAxes: f.competencyMap?.dimensions?.length ?? 0,
              })),
            }
          : { status: reader.status },
      checks,
      warnings: {
        p3: p3.envelope.warnings?.map((w) => w.code) ?? [],
        p4: p4.envelope.warnings?.map((w) => w.code) ?? [],
        profile: profile.envelope.warnings?.map((w) => w.code) ?? [],
      },
    };

    writeFileSync(join(OUT_DIR, 'completion-report.json'), JSON.stringify(report, null, 2));
    writeFileSync(
      join(OUT_DIR, 'phase-verdict.json'),
      JSON.stringify(
        {
          decision,
          cloudWrites: 0,
          specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
          checks,
          p3: p3ByField,
          gateReason: gate?.reasonCode,
        },
        null,
        2,
      ),
    );

    console.log(
      JSON.stringify({
        status: 'DONE',
        decision,
        cloudWrites: 0,
        out: join(OUT_DIR, 'completion-report.json'),
        p3Observed: p3ByField[FIELD_CODE]?.observed ?? [],
        p3Weak: p3ByField[FIELD_CODE]?.weak ?? [],
        skills: field?.skills?.length ?? 0,
        tools: field?.toolsTechnologies?.length ?? 0,
        gate: gate?.reasonCode,
      }),
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
