/**
 * Completa perfiles LEGAL (Edwar primary / Johana secondary)
 * desde P3→P4→Gate→Profile reutilizando P0–P1–P2–R1.
 *
 *   npx ts-node --transpile-only scripts/mc1-legal-complete.ts --confirm
 *
 * No reejecuta P0/P1/P2/R1. No ACADEMIC_RESEARCH. Cloud writes = 0.
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
import { resolveR1FieldCatalogCode } from '../src/mc-pipeline/r1/r1-field-catalog-resolver';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-legal-complete');
const FIELD_CODE = 'LEGAL';
const LEGAL_V1 = [
  'LEGAL_ADVISORY',
  'LEGAL_DOCUMENT_DRAFTING',
  'PUBLIC_SECTOR_CONTRACTING',
  'ADMINISTRATIVE_LAW',
  'LITIGATION_DISPUTES',
] as const;

type PersonCfg = {
  name: string;
  personId: string;
  personCvId: number;
  snapshotId: string;
  r1Pack: string;
  expectedPrimary: string;
  expectedLegalRole: 'PRIMARY' | 'SECONDARY';
};

const PEOPLE: PersonCfg[] = [
  {
    name: 'EDWAR STEVEN MONTOYA MONTOYA',
    personId: '1126',
    personCvId: 169,
    snapshotId: '115',
    r1Pack:
      'C:\\dev\\Organigrama\\Organigrama_Backend\\tmp\\mc1-r1-functional\\R1F-8A2-S115-20260812024313-0b78384e',
    expectedPrimary: 'LEGAL',
    expectedLegalRole: 'PRIMARY',
  },
  {
    name: 'JOHANA ALEXANDRA RESTREPO RESTREPO',
    personId: '1130',
    personCvId: 247,
    snapshotId: '136',
    r1Pack:
      'C:\\dev\\Organigrama\\Organigrama_Backend\\tmp\\mc1-r1-functional\\R1F-8A2-S136-20260812054241-e0613ed4',
    expectedPrimary: 'EDUCATION',
    expectedLegalRole: 'SECONDARY',
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
  const legalInScope = fieldsEval.some((f) => f.fieldCode === FIELD_CODE);
  const primaryResolved = resolveR1FieldCatalogCode(r1.payload.primaryField);
  const legalRole = fieldsEval.find((f) => f.fieldCode === FIELD_CODE)?.role;

  const sourceKeyProvenance = {
    primary: r1.payload.primaryField
      ? {
          sourceKey: r1.payload.primaryField.sourceKey,
          fieldCodeRaw: r1.payload.primaryField.fieldCode,
          resolved: primaryResolved,
        }
      : null,
    legalSecondary: (r1.payload.secondaryFields ?? [])
      .filter(
        (s) =>
          s.sourceKey === 'field.legal_services' ||
          s.sourceKey === 'field.legal_administrative',
      )
      .map((s) => ({
        sourceKey: s.sourceKey,
        fieldCodeRaw: s.fieldCode,
        resolved: resolveR1FieldCatalogCode(s),
      })),
  };

  if (!legalInScope) {
    return {
      personId: person.personId,
      name: person.name,
      status: 'SKIPPED_LEGAL_NOT_IN_SCOPE',
      r1PrimaryResolved: primaryResolved,
      sourceKeyProvenance,
      fieldsEvaluated: fieldsEval.map((f) => f.fieldCode),
    };
  }

  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      progress: 'PERSON_START',
      personId: person.personId,
      snapshotId: person.snapshotId,
      primaryResolved,
      legalRole,
      sourceKeyProvenance,
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

  const legalObserved = p3ByField[FIELD_CODE]?.observed ?? [];
  const legalWeak = p3ByField[FIELD_CODE]?.weak ?? [];

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
    (f) => f.role === 'PRIMARY',
  );
  const gate = (profile.envelope.payload.resolvedFieldsProvenance ?? []).find(
    (f) => f.fieldCode === FIELD_CODE,
  );

  const radarAxes = (field?.radar?.axes ?? []).map((a) => ({
    dimensionCode: a.dimensionCode,
    relativeCoverage: a.relativeCoverage,
    contributingSkillCodes: a.contributingSkillCodes ?? [],
  }));

  const radarGt0 = radarAxes.filter((a) => a.relativeCoverage > 0);

  const inventedSpecialty = [...legalObserved, ...legalWeak].some(
    (code) => !(LEGAL_V1 as readonly string[]).includes(code),
  );

  const forbiddenToolSkills = publicSkills.some((sk) =>
    ['SECOP', 'Ley 80', 'Ley 1150', 'Colombia Compra'].some((t) =>
      sk.skillCode.toLowerCase().includes(t.toLowerCase()),
    ),
  );

  const checks = {
    primaryIntact: primaryResolved === person.expectedPrimary,
    legalRoleExpected: legalRole === person.expectedLegalRole,
    taxonomyPending: !!gate?.taxonomyPending,
    gateReason: gate?.reasonCode ?? null,
    publicationStatus: gate?.publicationStatus ?? null,
    catalogAvailable: gate ? !gate.taxonomyPending : true,
    inventedSpecialty,
    weakPublishedAsSpecialty: (field?.specialties ?? []).some((s) =>
      legalWeak.includes(s.specialtyCode),
    ),
    weakPublicSkills: publicSkills.some(
      (sk) =>
        weakOnly.has(sk.parentSpecialtyCode) &&
        !observedP3.has(sk.parentSpecialtyCode),
    ),
    radarHasContributors: radarGt0.every(
      (a) => (a.contributingSkillCodes?.length ?? 0) > 0,
    ),
    mapperAvailable: dimensionsForField(FIELD_CODE).length === 6,
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    observedImpliesPublishable:
      legalObserved.length === 0 || gate?.publicationStatus === 'PUBLISHABLE',
    edwarLeavesTaxonomyPending:
      person.personId !== '1126' ||
      (legalObserved.length > 0 && gate?.taxonomyPending === false),
    johanaKeepsEducationPrimary:
      person.personId !== '1130' || primaryResolved === 'EDUCATION',
    johanaLegalSecondaryOnly:
      person.personId !== '1130' || legalRole === 'SECONDARY',
    forbiddenToolSkills,
    sourceKeysResolvedToLegal: sourceKeyProvenance.legalSecondary.every(
      (s) => s.resolved === 'LEGAL',
    ),
  };

  const validated =
    checks.primaryIntact &&
    checks.legalRoleExpected &&
    !checks.taxonomyPending &&
    checks.catalogAvailable &&
    !checks.inventedSpecialty &&
    !checks.weakPublishedAsSpecialty &&
    !checks.weakPublicSkills &&
    checks.mapperAvailable &&
    checks.radarHasContributors &&
    checks.observedImpliesPublishable &&
    checks.edwarLeavesTaxonomyPending &&
    checks.johanaKeepsEducationPrimary &&
    checks.johanaLegalSecondaryOnly &&
    !checks.forbiddenToolSkills;

  const report = {
    status: validated ? 'VALIDATED' : 'BLOCKED',
    personId: person.personId,
    name: person.name,
    personCvId: person.personCvId,
    snapshotId: person.snapshotId,
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    r1PrimaryResolved: primaryResolved,
    expectedPrimary: person.expectedPrimary,
    expectedLegalRole: person.expectedLegalRole,
    sourceKeyProvenance,
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
      LEGAL: { observed: legalObserved, weak: legalWeak },
      byField: p3ByField,
    },
    p4: { LEGAL: p4Rows },
    publicSkills: publicSkills
      .filter((s) =>
        [...legalObserved, ...legalWeak].includes(s.parentSpecialtyCode),
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
      p3Observed: legalObserved,
      p3Weak: legalWeak,
      gate: gate?.reasonCode,
      primaryResolved,
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
        hint: 'npx ts-node --transpile-only scripts/mc1-legal-complete.ts --confirm',
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
    legalSpecialties: specialtiesForField(FIELD_CODE).map((s) => s.code),
    legalDimensions: dimensionsForField(FIELD_CODE).map((d) => d.code),
    sourceKeyNormalization: {
      'field.legal_administrative': 'LEGAL',
      'field.legal_services': 'LEGAL',
    },
    people: PEOPLE.map((p) => ({
      personId: p.personId,
      snapshotId: p.snapshotId,
      r1Pack: p.r1Pack,
      expectedPrimary: p.expectedPrimary,
      expectedLegalRole: p.expectedLegalRole,
    })),
    reuse: { p0: true, p1: true, p2: true, r1: true },
    cloudWrites: 0,
    academicResearchUntouched: true,
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
    const edwar = results.find((r) => r.personId === '1126');
    const johana = results.find((r) => r.personId === '1130');

    const decision = allOk
      ? 'LEGAL_OPERATIONAL_VALIDATED'
      : 'LEGAL_FOUNDATION_VALIDATION_DRIFT';

    const table = results.map((r) => {
      const rep = r as {
        p3?: { LEGAL?: { observed?: string[]; weak?: string[] } };
        publicSkills?: Array<{ skillCode: string; name: string }>;
        profileField?: {
          tools?: string[];
          radarAxes?: Array<{ relativeCoverage: number }>;
        };
        gate?: { reasonCode?: string; taxonomyPending?: boolean };
      };
      const legalP3 = rep.p3?.LEGAL;
      const radarGt0 =
        rep.profileField?.radarAxes?.filter((a) => a.relativeCoverage > 0)
          .length ?? 0;
      return {
        persona: r.personId,
        p3Observed: legalP3?.observed?.join(', ') ?? '—',
        p3Weak: legalP3?.weak?.join(', ') ?? '—',
        p4Skills:
          rep.publicSkills?.map((s) => s.skillCode).join(', ') ?? '—',
        tools: rep.profileField?.tools?.join(', ') ?? '—',
        gateLegal: rep.gate?.reasonCode ?? '—',
        radarGt0,
        profile: r.status,
      };
    });

    const cohort = {
      decision,
      specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
      specialtiesV1: specialtiesForField(FIELD_CODE).map((s) => s.code),
      dimensions: dimensionsForField(FIELD_CODE).map((d) => d.code),
      cloudWrites: 0,
      sourceKeyProvenance: {
        'field.legal_administrative': 'LEGAL',
        'field.legal_services': 'LEGAL',
      },
      results,
      table,
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
          table,
          cloudWrites: 0,
        },
        null,
        2,
      ),
    );

    console.log(JSON.stringify({ decision, table, cohort: { gaps: cohort.gaps } }, null, 2));
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
