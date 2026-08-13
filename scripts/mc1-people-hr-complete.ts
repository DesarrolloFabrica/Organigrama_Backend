/**
 * Completa perfiles PEOPLE_HR (José/Katiuska/Paula/Nataly) secondary
 * desde P3→P4→Profile reutilizando P0–P1–P2–R1.
 *
 *   npx ts-node --transpile-only scripts/mc1-people-hr-complete.ts --confirm
 *
 * No reejecuta P0/P1/P2/R1. No cambia primary. Cloud writes = 0.
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
import {
  loadR1Contract,
  resolveFieldsToEvaluate,
} from '../src/mc-pipeline/p3/p3-context-loader';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-people-hr-complete');
const FIELD_CODE = 'PEOPLE_HR';
const PRIMARY_EXPECTED = 'FINANCE_ADMIN';

type PersonCfg = {
  name: string;
  personId: string;
  personCvId: number;
  snapshotId: string;
  r1Pack: string;
};

const PEOPLE: PersonCfg[] = [
  {
    name: 'JOSE ALEJANDRO CRUZ NAVARRO',
    personId: '1265',
    personCvId: 140,
    snapshotId: '69',
    r1Pack:
      'C:\\dev\\Organigrama\\Organigrama_Backend\\tmp\\mc1-r1-functional\\R1F-8A2-S69-20260811232914-9eb4c3fc',
  },
  {
    name: 'KATIUSKA FUENTES IBAÑEZ',
    personId: '1266',
    personCvId: 133,
    snapshotId: '70',
    r1Pack:
      'C:\\dev\\Organigrama\\Organigrama_Backend\\tmp\\mc1-r1-functional\\R1F-8A2-S70-20260811233202-c19ae133',
  },
  {
    name: 'PAULA ANDREA TERREROS GRACIA',
    personId: '1271',
    personCvId: 138,
    snapshotId: '73',
    r1Pack:
      'C:\\dev\\Organigrama\\Organigrama_Backend\\tmp\\mc1-r1-functional\\R1F-8A2-S73-20260811234111-8ba43db9',
  },
  {
    name: 'NATALY VANESSA TORRES RODRIGUEZ',
    personId: '1272',
    personCvId: 142,
    snapshotId: '74',
    r1Pack:
      'C:\\dev\\Organigrama\\Organigrama_Backend\\tmp\\mc1-r1-functional\\R1F-8A2-S74-20260811234348-203accc9',
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

async function processPerson(
  ds: DataSource,
  gem: { GEMINI_API_KEY: string; GEMINI_MODEL?: string },
  person: PersonCfg,
) {
  const model = gem.GEMINI_MODEL || 'gemini-3.6-flash';
  const personOut = join(OUT_DIR, `person-${person.personId}`);
  mkdirSync(personOut, { recursive: true });

  if (!existsSync(person.r1Pack)) {
    return {
      personId: person.personId,
      name: person.name,
      status: 'BLOCKED',
      reason: 'R1_PACK_MISSING',
      r1Pack: person.r1Pack,
    };
  }

  const r1 = loadR1Contract(person.r1Pack);
  const fieldsEval = resolveFieldsToEvaluate(r1);
  const hrInScope = fieldsEval.some((f) => f.fieldCode === FIELD_CODE);
  const primary =
    r1.payload.primaryField?.fieldCode ?? r1.payload.primaryDomainCode ?? null;

  if (!hrInScope) {
    return {
      personId: person.personId,
      name: person.name,
      status: 'SKIPPED_HR_SECONDARY_NOT_IN_SCOPE',
      r1Primary: primary,
      fieldsEvaluated: fieldsEval.map((f) => f.fieldCode),
    };
  }

  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      progress: 'PERSON_START',
      personId: person.personId,
      snapshotId: person.snapshotId,
      primary,
      fields: fieldsEval.map((f) => f.fieldCode),
    }),
  );

  const p3 = await runP3ArtifactOnly({
    backendRoot: ROOT,
    snapshotId: person.snapshotId,
    dataSource: ds,
    apiKey: gem.GEMINI_API_KEY,
    model,
    outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
    r1PackDir: person.r1Pack,
  });

  const p4 = await runP4ArtifactOnly({
    backendRoot: ROOT,
    snapshotId: person.snapshotId,
    dataSource: ds,
    apiKey: gem.GEMINI_API_KEY,
    model,
    outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
    r1PackDir: person.r1Pack,
    p3PackDir: p3.outDir,
  });

  const profile = await runProfilePilot({
    backendRoot: ROOT,
    snapshotId: person.snapshotId,
    outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
    dataSource: ds,
    r1PackDir: person.r1Pack,
    p3PackDir: p3.outDir,
    p4PackDir: p4.outDir,
  });

  const reader = await readMc1PersonProfile({
    personId: person.personId,
    dataSource: ds,
    backendRoot: ROOT,
  });

  const p3ByField: Record<string, { observed: string[]; weak: string[] }> = {};
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
  const weakOnly = new Set(Object.values(p3ByField).flatMap((x) => x.weak));

  const p4Rows = (p4.envelope.payload.specialtyResults ?? [])
    .filter((r) => r.fieldCode === FIELD_CODE || !r.fieldCode)
    .map((r) => ({
      fieldCode: r.fieldCode,
      specialtyCode: r.specialtyCode,
      skills: (r.observedSkills ?? [])
        .filter((sk) => !sk.status || sk.status === 'OBSERVED')
        .map((sk) => ({
          skillCode: sk.skillCode,
          name: sk.name,
          tools: sk.toolOrTechnologySignals ?? [],
          supportingSignals: sk.supportingSignals ?? [],
        })),
      tools: [
        ...new Set(
          (r.observedSkills ?? []).flatMap(
            (sk) => sk.toolOrTechnologySignals ?? [],
          ),
        ),
      ],
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
  const primaryField = profile.envelope.payload.fields.find(
    (f) => f.fieldCode === PRIMARY_EXPECTED || f.role === 'PRIMARY',
  );
  const gate = (profile.envelope.payload.resolvedFieldsProvenance ?? []).find(
    (f) => f.fieldCode === FIELD_CODE,
  );

  const radarAxes = (field?.radar?.axes ?? []).map((a) => ({
    dimensionCode: a.dimensionCode,
    relativeCoverage: a.relativeCoverage,
    contributingSkillCodes: a.contributingSkillCodes ?? [],
  }));

  const inventedSpecialty = (p3ByField[FIELD_CODE]?.observed ?? [])
    .concat(p3ByField[FIELD_CODE]?.weak ?? [])
    .some(
      (code) =>
        !['TALENT_ACQUISITION', 'WORKFORCE_ADMINISTRATION'].includes(code),
    );

  const hrObserved = p3ByField[FIELD_CODE]?.observed ?? [];
  const hrWeak = p3ByField[FIELD_CODE]?.weak ?? [];

  const checks = {
    primaryIntact: primary === PRIMARY_EXPECTED,
    peopleHrSecondaryRole:
      fieldsEval.find((f) => f.fieldCode === FIELD_CODE)?.role === 'SECONDARY',
    taxonomyPending: !!gate?.taxonomyPending,
    gateReason: gate?.reasonCode ?? null,
    publicationStatus: gate?.publicationStatus ?? null,
    catalogAvailable: gate ? !gate.taxonomyPending : true,
    inventedSpecialty,
    weakPublishedAsSpecialty: (field?.specialties ?? []).some((s) =>
      hrWeak.includes(s.specialtyCode),
    ),
    weakPublicSkills: publicSkills.some(
      (sk) =>
        weakOnly.has(sk.parentSpecialtyCode) &&
        !observedP3.has(sk.parentSpecialtyCode),
    ),
    radarHasContributors: radarAxes
      .filter((a) => a.relativeCoverage > 0)
      .every((a) => (a.contributingSkillCodes?.length ?? 0) > 0),
    mapperAvailable: dimensionsForField(FIELD_CODE).length === 7,
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    observedImpliesPublishable:
      hrObserved.length === 0 ||
      gate?.publicationStatus === 'PUBLISHABLE',
    noObservedImpliesProvenanceOnly:
      hrObserved.length > 0 ||
      gate?.reasonCode === 'SECONDARY_NO_OBSERVED_SPECIALTY',
  };

  const validated =
    checks.primaryIntact &&
    checks.peopleHrSecondaryRole &&
    !checks.taxonomyPending &&
    checks.catalogAvailable &&
    !checks.inventedSpecialty &&
    !checks.weakPublishedAsSpecialty &&
    !checks.weakPublicSkills &&
    checks.mapperAvailable &&
    checks.radarHasContributors &&
    checks.observedImpliesPublishable &&
    checks.noObservedImpliesProvenanceOnly;

  const report = {
    status: validated ? 'VALIDATED' : 'BLOCKED',
    personId: person.personId,
    name: person.name,
    personCvId: person.personCvId,
    snapshotId: person.snapshotId,
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    r1Primary: primary,
    fieldsEvaluated: fieldsEval.map((f) => ({
      fieldCode: f.fieldCode,
      role: f.role,
    })),
    packs: {
      r1: person.r1Pack,
      p3: p3.outDir,
      p4: p4.outDir,
      profile: profile.outDir,
    },
    p3: {
      PEOPLE_HR: { observed: hrObserved, weak: hrWeak },
      byField: p3ByField,
    },
    p4: {
      PEOPLE_HR: p4Rows.filter(
        (r) =>
          !r.fieldCode ||
          r.fieldCode === FIELD_CODE ||
          hrObserved.includes(r.specialtyCode) ||
          hrWeak.includes(r.specialtyCode),
      ),
    },
    publicSkills: publicSkills
      .filter((s) =>
        [...hrObserved, ...hrWeak].includes(s.parentSpecialtyCode),
      )
      .map((s) => ({
        skillCode: s.skillCode,
        name: s.name,
        parentSpecialtyCode: s.parentSpecialtyCode,
      })),
    gate,
    profileField: field
      ? {
          role: field.role,
          specialties: field.specialties.map((s) => s.specialtyCode),
          skillCount: field.skills.length,
          tools: field.toolsTechnologies,
          radar: Object.fromEntries(
            radarAxes.map((a) => [a.dimensionCode, a.relativeCoverage]),
          ),
          radarAxes,
        }
      : null,
    primaryProfile: primaryField
      ? {
          fieldCode: primaryField.fieldCode,
          role: primaryField.role,
          specialties: primaryField.specialties.map((s) => s.specialtyCode),
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

  writeFileSync(
    join(personOut, 'completion-report.json'),
    JSON.stringify(report, null, 2),
  );

  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      progress: 'PERSON_DONE',
      personId: person.personId,
      status: report.status,
      p3Observed: hrObserved,
      p3Weak: hrWeak,
      gate: gate?.reasonCode,
      primary,
    }),
  );

  return report;
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        hint: 'npx ts-node --transpile-only scripts/mc1-people-hr-complete.ts --confirm',
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

  mkdirSync(OUT_DIR, { recursive: true });

  const preflight = {
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    hrSpecialties: specialtiesForField(FIELD_CODE).map((s) => s.code),
    hrDimensions: dimensionsForField(FIELD_CODE).map((d) => d.code),
    people: PEOPLE.map((p) => ({
      personId: p.personId,
      snapshotId: p.snapshotId,
      r1Pack: p.r1Pack,
      primaryExpected: PRIMARY_EXPECTED,
      peopleHrRole: 'SECONDARY',
    })),
    reuse: { p0: true, p1: true, p2: true, r1: true },
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
    const results: Awaited<ReturnType<typeof processPerson>>[] = [];
    for (const person of PEOPLE) {
      results.push(
        await processPerson(
          ds,
          {
            GEMINI_API_KEY: gem.GEMINI_API_KEY,
            GEMINI_MODEL: gem.GEMINI_MODEL,
          },
          person,
        ),
      );
    }

    const allOk = results.every((r) => r.status === 'VALIDATED');
    const anyObserved = results.some(
      (r) =>
        Array.isArray((r as { p3?: { PEOPLE_HR?: { observed?: string[] } } }).p3
          ?.PEOPLE_HR?.observed) &&
        ((r as { p3: { PEOPLE_HR: { observed: string[] } } }).p3.PEOPLE_HR
          .observed.length ?? 0) > 0,
    );

    const decision =
      allOk && anyObserved
        ? 'PEOPLE_HR_OPERATIONAL_VALIDATED'
        : allOk
          ? 'PEOPLE_HR_NEEDS_MORE_EVIDENCE'
          : 'PEOPLE_HR_NEEDS_MORE_EVIDENCE';

    const coverage = results.map((r) => ({
      personId: r.personId,
      name: (r as { name?: string }).name,
      status: r.status,
      p3: (r as { p3?: unknown }).p3,
      gate: (r as { gate?: unknown }).gate,
      profileField: (r as { profileField?: unknown }).profileField,
      primaryProfile: (r as { primaryProfile?: unknown }).primaryProfile,
    }));

    const cohort = {
      decision,
      specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
      specialtiesV1: specialtiesForField(FIELD_CODE).map((s) => s.code),
      dimensions: dimensionsForField(FIELD_CODE).map((d) => d.code),
      cloudWrites: 0,
      results,
      coverage,
      gaps: allOk
        ? []
        : results
            .filter((r) => r.status !== 'VALIDATED')
            .map((r) => ({
              personId: r.personId,
              status: r.status,
              checks: (r as { checks?: unknown }).checks,
            })),
    };

    writeFileSync(
      join(OUT_DIR, 'cohort-verdict.json'),
      JSON.stringify(cohort, null, 2),
    );
    writeFileSync(
      join(OUT_DIR, 'phase-verdict.json'),
      JSON.stringify(
        {
          decision,
          specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
          specialtiesV1: cohort.specialtiesV1,
          dimensions: cohort.dimensions,
          cloudWrites: 0,
          validatedPersonIds: results
            .filter((r) => r.status === 'VALIDATED')
            .map((r) => r.personId),
          coverage,
        },
        null,
        2,
      ),
    );

    console.log(
      JSON.stringify(
        {
          decision,
          specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
          validated: results.filter((r) => r.status === 'VALIDATED').length,
          total: results.length,
          coverage: coverage.map((c) => ({
            personId: c.personId,
            status: c.status,
            observed:
              (c.p3 as { PEOPLE_HR?: { observed?: string[] } } | undefined)
                ?.PEOPLE_HR?.observed ?? [],
            weak:
              (c.p3 as { PEOPLE_HR?: { weak?: string[] } } | undefined)?.PEOPLE_HR
                ?.weak ?? [],
            gate: (c.gate as { reasonCode?: string } | undefined)?.reasonCode,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
