/**
 * Completa perfiles CUSTOMER_SUCCESS (Paula/Jeimy/Yenny + Jonh CS secondary)
 * desde P3→P4→Profile reutilizando P0–P1–P2–R1.
 *
 *   npx ts-node --transpile-only scripts/mc1-b2b-customer-success-complete.ts --confirm
 *
 * No reejecuta P0/P1/P2/R1. Cloud writes = 0. Leidy excluida (CV_EXTRACTION_BLOCKED).
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
import { resolveFieldsToEvaluate } from '../src/mc-pipeline/p3/p3-context-loader';
import { loadR1Contract } from '../src/mc-pipeline/p3/p3-context-loader';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-b2b-customer-success-complete');
const FIELD_CODE = 'CUSTOMER_SUCCESS';

type PersonCfg = {
  name: string;
  personId: string;
  personCvId: number;
  snapshotId: string;
  r1Pack: string;
  primaryExpected: string;
  processCsSecondaryOnly?: boolean;
};

const PEOPLE: PersonCfg[] = [
  {
    name: 'Paula Andrea Ortiz Andapiña',
    personId: '1195',
    personCvId: 193,
    snapshotId: '47',
    r1Pack:
      'C:\\dev\\Organigrama\\Organigrama_Backend\\tmp\\mc1-r1-functional\\R1F-8A2-S47-20260811210952-f664ba38',
    primaryExpected: 'CUSTOMER_SUCCESS',
  },
  {
    name: 'Naranjo Herrera Jeimy Johana',
    personId: '1196',
    personCvId: 194,
    snapshotId: '48',
    r1Pack:
      'C:\\dev\\Organigrama\\Organigrama_Backend\\tmp\\mc1-r1-functional\\R1F-8A2-S48-20260811211133-dae60e49',
    primaryExpected: 'CUSTOMER_SUCCESS',
  },
  {
    name: 'Paez Castro Yenny Paola',
    personId: '1198',
    personCvId: 196,
    snapshotId: '50',
    r1Pack:
      'C:\\dev\\Organigrama\\Organigrama_Backend\\tmp\\mc1-r1-functional\\R1F-8A2-S50-20260811211429-7dc7159e',
    primaryExpected: 'CUSTOMER_SUCCESS',
  },
  {
    name: 'Jonh Cesar Cuevas Muñoz',
    personId: '1191',
    personCvId: 197,
    snapshotId: '46',
    r1Pack:
      'C:\\dev\\Organigrama\\Organigrama_Backend\\tmp\\mc1-r1-functional\\R1F-8A2-S46-20260811212352-d35db773',
    primaryExpected: 'EDUCATION',
    processCsSecondaryOnly: true,
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
  const csInScope = fieldsEval.some((f) => f.fieldCode === FIELD_CODE);

  if (person.processCsSecondaryOnly && !csInScope) {
    return {
      personId: person.personId,
      name: person.name,
      status: 'SKIPPED_CS_SECONDARY_NOT_IN_SCOPE',
      r1Primary: r1.payload.primaryField?.fieldCode ?? null,
      fieldsEvaluated: fieldsEval.map((f) => f.fieldCode),
      note: 'MULTI_FIELD/R1 no incluye CUSTOMER_SUCCESS en scope P3; no se fuerza',
    };
  }

  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      progress: 'PERSON_START',
      personId: person.personId,
      snapshotId: person.snapshotId,
      csInScope,
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

  const p4Rows = (p4.envelope.payload.specialtyResults ?? []).map((r) => ({
    specialtyCode: r.specialtyCode,
    skills: (r.observedSkills ?? [])
      .filter((sk) => !sk.status || sk.status === 'OBSERVED')
      .map((sk) => ({
        skillCode: sk.skillCode,
        name: sk.name,
        tools: sk.toolOrTechnologySignals ?? [],
        supportingSignals: sk.supportingSignals ?? [],
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

  const crmAsTool = (field?.toolsTechnologies ?? []).some((t) =>
    /crm|zoho|salesforce|sinu|five9/i.test(t),
  );
  const crmAsSpecialty = (field?.specialties ?? []).some((s) =>
    /crm/i.test(s.specialtyCode),
  );

  const checks = {
    hasCustomerSuccessTab: !!field,
    taxonomyPending: !!gate?.taxonomyPending,
    gateReason: gate?.reasonCode ?? null,
    publicationStatus: gate?.publicationStatus ?? null,
    emptySpecialtyPublished: (field?.specialties ?? []).some(
      (s) =>
        !(field?.skills ?? []).some(
          (sk) => sk.parentSpecialtyCode === s.specialtyCode,
        ),
    ),
    weakPublicSkills: publicSkills.some(
      (sk) =>
        weakOnly.has(sk.parentSpecialtyCode) &&
        !observedP3.has(sk.parentSpecialtyCode),
    ),
    radarHasContributors: radarAxes
      .filter((a) => a.relativeCoverage > 0)
      .every((a) => (a.contributingSkillCodes?.length ?? 0) > 0),
    mapperAvailable: dimensionsForField(FIELD_CODE).length === 6,
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    crmAsToolNotSpecialty: !crmAsSpecialty,
    crmSeenAsTool: crmAsTool,
  };

  const validated =
    checks.hasCustomerSuccessTab &&
    !checks.taxonomyPending &&
    checks.publicationStatus === 'PUBLISHABLE' &&
    checks.mapperAvailable &&
    checks.radarHasContributors &&
    !checks.weakPublicSkills &&
    (field?.specialties?.length ?? 0) > 0 &&
    (field?.skills?.length ?? 0) > 0 &&
    checks.crmAsToolNotSpecialty;

  const report = {
    status: validated ? 'VALIDATED' : 'BLOCKED',
    personId: person.personId,
    name: person.name,
    personCvId: person.personCvId,
    snapshotId: person.snapshotId,
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
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
      p3Observed: p3ByField[FIELD_CODE]?.observed ?? [],
      p3Weak: p3ByField[FIELD_CODE]?.weak ?? [],
      gate: gate?.reasonCode,
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
        hint: 'npx ts-node --transpile-only scripts/mc1-b2b-customer-success-complete.ts --confirm',
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
    csSpecialties: specialtiesForField(FIELD_CODE).map((s) => s.code),
    csDimensions: dimensionsForField(FIELD_CODE).map((d) => d.code),
    people: PEOPLE.map((p) => ({
      personId: p.personId,
      snapshotId: p.snapshotId,
      r1Pack: p.r1Pack,
      processCsSecondaryOnly: !!p.processCsSecondaryOnly,
    })),
    excluded: {
      leidy: {
        personId: '1197',
        status: 'CV_EXTRACTION_BLOCKED',
        note: 'EMPTY_DOCUMENT — fuera de este fix',
      },
    },
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

    const primaryResults = results.filter(
      (r) => r.personId !== '1191' && 'status' in r,
    );
    const jonh = results.find((r) => r.personId === '1191');
    const allPrimaryOk = primaryResults.every((r) => r.status === 'VALIDATED');

    const decision = allPrimaryOk
      ? 'CUSTOMER_SUCCESS_OPERATIONAL_B2B_VALIDATED'
      : 'CUSTOMER_SUCCESS_NEEDS_MORE_EVIDENCE';

    const cohort = {
      decision,
      specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
      cloudWrites: 0,
      leidy: { personId: '1197', status: 'CV_EXTRACTION_BLOCKED' },
      results,
      jonhCsSecondary: jonh
        ? {
            status: jonh.status,
            p3Cs: (jonh as { p3?: Record<string, unknown> }).p3?.[FIELD_CODE],
            gate: (jonh as { gate?: unknown }).gate ?? null,
          }
        : null,
      gaps: allPrimaryOk
        ? []
        : primaryResults
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
          cloudWrites: 0,
          primaryValidated: primaryResults
            .filter((r) => r.status === 'VALIDATED')
            .map((r) => r.personId),
          jonhStatus: jonh?.status ?? null,
          leidy: 'CV_EXTRACTION_BLOCKED',
        },
        null,
        2,
      ),
    );

    console.log(
      JSON.stringify({
        status: 'DONE',
        decision,
        specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
        out: join(OUT_DIR, 'cohort-verdict.json'),
        people: results.map((r) => ({
          personId: r.personId,
          status: r.status,
        })),
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
