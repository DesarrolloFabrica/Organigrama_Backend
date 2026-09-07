/**
 * FASE WEAK_RADAR_SEMANTICS_DEPLOY_GATE
 *
 * Reensambla presentations desde R1+P3+P4 existentes + overlay WEAK.
 * Gemini = 0. No ejecuta P1–P4.
 *
 *   npx ts-node --transpile-only scripts/mc1-weak-radar-deploy-gate.ts
 *   npx ts-node --transpile-only scripts/mc1-weak-radar-deploy-gate.ts --confirm-import
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { reassembleMc1Presentation } from '../src/mc-pipeline/profile/profile-presentation-reassembly';
import { importMc1PresentationBatch } from '../src/mc-pipeline/person-profile/mc1-person-profile-importer';
import type { Mc1PersonCompetenciesPresentationDto } from '../src/mc-pipeline/person-profile/mc1-person-profile.types';

const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'tmp/mc1-weak-radar-deploy-gate');
const CONFIRM = process.argv.includes('--confirm-import');

type Pilot = {
  label: string;
  personId: string;
  snapshotId: string;
  role: string;
  r1: string;
  p3: string;
  p4: string;
  profile: string;
};

const PILOT: Pilot[] = [
  {
    label: 'Sara',
    personId: '52',
    snapshotId: '20',
    role: 'OBSERVED governance 48.6',
    r1: 'R1F-8A2-S20-20260813155543-f048aec4',
    p3: 'P3F-8B2-S20-20260813172432-0af23cd8',
    p4: 'P4F-8D-S20-20260813172450-a061a51f',
    profile:
      'tmp/mc1-data-governance-semantic-fix/profile/PROF-8E-S20-20260813172450',
  },
  {
    label: 'Haider',
    personId: '49',
    snapshotId: '21',
    role: 'NO_EVIDENCE governance',
    r1: 'R1F-8A2-S21-20260813173222-655bc99c',
    p3: 'P3F-8B2-S21-20260813173235-4f5e3ed0',
    p4: 'P4F-8D-S21-20260813173300-935b4573',
    profile:
      'tmp/mc1-data-governance-semantic-fix/profile/PROF-8E-S21-20260813173300',
  },
  {
    label: 'Diego',
    personId: '1228',
    snapshotId: '22',
    role: 'P3 OBSERVED + P4 WEAK',
    r1: 'R1F-8A2-S22-20260813173529-0f43eaf2',
    p3: 'P3F-8B2-S22-20260813173554-e1773a4d',
    p4: 'P4F-8D-S22-20260813173624-b77a6ad0',
    profile:
      'tmp/mc1-data-governance-semantic-fix/profile/PROF-8E-S22-20260813173624',
  },
  {
    label: 'Camilo R.',
    personId: '1221',
    snapshotId: '15',
    role: 'OBSERVED 18.3 editing',
    r1: 'R1F-8A2-S15-20260810194833-1a092cc8',
    p3: 'P3F-8B2-S15-20260810200135-a0c4b53d',
    p4: 'P4F-8D-S15-20260810200156-265d85fe',
    profile: 'tmp/mc1-profile-pilot/PROF-8E-S15-20260810200156',
  },
  {
    label: 'Nidia',
    personId: '1163',
    snapshotId: '1',
    role: 'VD EDITORIAL WEAK',
    r1: 'R1F-8A2-S1-20260813160150-2baecb53',
    p3: 'P3F-8B2-S1-20260813160211-c5adf067',
    p4: 'P4F-8D-S1-20260813160236-8e07473e',
    profile:
      'tmp/mc1-thinking-budget-experiment/profile/PROF-8E-S1-20260813160236',
  },
  {
    label: 'Juan Pablo',
    personId: '1176',
    snapshotId: '14',
    role: 'VD MOTION WEAK',
    r1: 'R1F-8A2-S14-20260810194606-d95f480f',
    p3: 'P3F-8B2-S14-20260810200104-f98a67fe',
    p4: 'P4F-8D-S14-20260810200124-0b452bc8',
    profile: 'tmp/mc1-profile-pilot/PROF-8E-S14-20260810200124',
  },
];

function loadEnv(path: string) {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith("'") && v.endsWith("'")) ||
      (v.startsWith('"') && v.endsWith('"'))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function cloudClient() {
  const env = loadEnv(resolve(ROOT, '.env'));
  return new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    database: env.DB_NAME,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    ssl:
      String(env.DB_SSL).toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });
}

function flattenAxes(p: Mc1PersonCompetenciesPresentationDto | null) {
  if (!p) return [];
  return p.fields.flatMap((f) =>
    f.competencyMap.dimensions.map((d) => ({
      field: f.code,
      code: d.code,
      relativeCoverage: d.relativeCoverage,
      evidenceState: d.evidenceState ?? null,
    })),
  );
}

function publicCounts(p: Mc1PersonCompetenciesPresentationDto | null) {
  if (!p) return { specialties: 0, skills: 0, specialtyCodes: [] as string[], skillCodes: [] as string[] };
  const specialtyCodes = p.fields.flatMap((f) =>
    f.specialties.map((s) => `${f.code}::${s.code}`),
  );
  const skillCodes = p.fields.flatMap((f) =>
    f.specialties.flatMap((s) =>
      s.skills.map((sk) => `${f.code}::${s.code}::${sk.code}`),
    ),
  );
  return {
    specialties: specialtyCodes.length,
    skills: skillCodes.length,
    specialtyCodes,
    skillCodes,
  };
}

function scanObservedBelow20() {
  const roots = [
    join(ROOT, 'tmp/mc1-profile-pilot'),
    join(ROOT, 'tmp/mc1-data-governance-semantic-fix/profile'),
    join(ROOT, 'tmp/mc1-thinking-budget-experiment/profile'),
  ];
  const personBySnapshot: Record<string, { personId: string; label: string }> = {
    '11': { personId: '5', label: 'Alejandro' },
    '15': { personId: '1221', label: 'Camilo R.' },
  };
  const hits: Array<Record<string, unknown>> = [];
  function walk(d: string) {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (n === 'profile-contract.json') {
        const env = JSON.parse(readFileSync(p, 'utf8'));
        const snapshotId = String(env.payload?.snapshotId ?? '');
        const who = personBySnapshot[snapshotId];
        for (const f of env.payload?.fields ?? []) {
          const maxRaw = Math.max(
            0,
            ...(f.radar?.axes ?? []).map((a: { rawScore?: number }) => a.rawScore ?? 0),
          );
          for (const a of f.radar?.axes ?? []) {
            if (a.relativeCoverage > 0 && a.relativeCoverage < 20) {
              const mappings = (f.skillDimensionMappings ?? []).filter(
                (m: { skillCode: string }) =>
                  (a.contributingSkillCodes ?? []).includes(m.skillCode),
              );
              hits.push({
                pack: p.replace(ROOT, ''),
                persona: who?.label ?? `snapshot ${snapshotId}`,
                personId: who?.personId ?? null,
                snapshotId,
                field: f.fieldCode,
                axis: a.dimensionCode,
                coverage: a.relativeCoverage,
                rawScore: a.rawScore,
                denominatorMaxRaw: maxRaw,
                formulaCheck:
                  maxRaw > 0
                    ? Number(((100 * (a.rawScore ?? 0)) / maxRaw).toFixed(1))
                    : null,
                skills: a.contributingSkillCodes,
                euCount: (a.supportingEvidenceUnitIds ?? []).length,
                publicSkillCount: (f.skills ?? []).length,
                publicSpecialtyCount: (f.specialties ?? []).length,
                mapping: mappings,
                classification:
                  maxRaw > 0 &&
                  Number(((100 * (a.rawScore ?? 0)) / maxRaw).toFixed(1)) ===
                    a.relativeCoverage
                    ? 'A+D_VALID_LOW_SHARE_OF_FIELD_MAX'
                    : 'REVIEW',
              });
            }
          }
        }
      }
    }
  }
  for (const r of roots) walk(r);
  return hits;
}

function scanMappingDebt() {
  const roots = [
    join(ROOT, 'tmp/mc1-profile-pilot'),
    join(ROOT, 'tmp/mc1-data-governance-semantic-fix/profile'),
    join(ROOT, 'tmp/mc1-thinking-budget-experiment/profile'),
  ];
  const debt: Array<Record<string, unknown>> = [];
  function walk(d: string) {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (n === 'profile-contract.json') {
        const env = JSON.parse(readFileSync(p, 'utf8'));
        for (const f of env.payload?.fields ?? []) {
          const contributing = new Set(
            (f.radar?.axes ?? []).flatMap(
              (a: { contributingSkillCodes?: string[] }) =>
                a.contributingSkillCodes ?? [],
            ),
          );
          for (const sk of f.skills ?? []) {
            if (!contributing.has(sk.skillCode)) {
              const mapped = (f.skillDimensionMappings ?? []).find(
                (m: { skillCode: string }) => m.skillCode === sk.skillCode,
              );
              debt.push({
                classification: 'RADAR_MAPPING_DEBT',
                snapshotId: env.payload?.snapshotId,
                pack: p.replace(ROOT, ''),
                field: f.fieldCode,
                specialty: sk.parentSpecialtyCode,
                skill: sk.skillCode,
                mappedDimensions: mapped?.dimensionCodes ?? [],
                missingAxisContribution: true,
              });
            }
          }
        }
      }
    }
  }
  for (const r of roots) walk(r);
  return debt;
}

async function readStore(personIds: string[]) {
  const cloud = cloudClient();
  await cloud.connect();
  try {
    const rows = await cloud.query(
      `SELECT person_id::text AS person_id,
              id::text AS id,
              config_fingerprint,
              produced_at,
              is_active,
              payload_json
         FROM organigrama.mc1_person_profile_presentation
        WHERE person_id = ANY($1::int[])
        ORDER BY person_id, is_active DESC, produced_at DESC`,
      [personIds],
    );
    return rows.rows as Array<{
      person_id: string;
      id: string;
      config_fingerprint: string;
      produced_at: string;
      is_active: boolean;
      payload_json: Mc1PersonCompetenciesPresentationDto;
    }>;
  } finally {
    await cloud.end();
  }
}

function flattenEnvelopeAxes(profileRel: string) {
  const env = JSON.parse(
    readFileSync(join(ROOT, profileRel, 'profile-contract.json'), 'utf8'),
  );
  return (env.payload?.fields ?? []).flatMap(
    (f: {
      fieldCode: string;
      radar?: { axes?: Array<{ dimensionCode: string; relativeCoverage: number }> };
    }) =>
      (f.radar?.axes ?? []).map((d) => ({
        field: f.fieldCode,
        code: d.dimensionCode,
        relativeCoverage: d.relativeCoverage,
      })),
  ) as Array<{ field: string; code: string; relativeCoverage: number }>;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const observedBelow20 = scanObservedBelow20();
  const mappingDebt = scanMappingDebt();

  const assembled = PILOT.map((p) => {
    const args = {
      backendRoot: ROOT,
      snapshotId: p.snapshotId,
      r1PackDir: join(ROOT, 'tmp/mc1-r1-functional', p.r1),
      p3PackDir: join(ROOT, 'tmp/mc1-p3-functional', p.p3),
      p4PackDir: join(ROOT, 'tmp/mc1-p4-functional', p.p4),
      profilePackDir: join(ROOT, p.profile),
    };
    const result = reassembleMc1Presentation(args);
    const again = reassembleMc1Presentation(args);
    const packAxes = flattenEnvelopeAxes(p.profile);
    const afterAxes = flattenAxes(result.presentation);
    const observedMutationsVsPack = afterAxes.filter((a) => {
      const b = packAxes.find((x) => x.field === a.field && x.code === a.code);
      return (b?.relativeCoverage ?? 0) > 0 && b!.relativeCoverage !== a.relativeCoverage;
    });
    const packSkills = result.envelope.payload.fields.flatMap((f) =>
      f.skills.map((s) => `${f.fieldCode}::${s.parentSpecialtyCode}::${s.skillCode}`),
    );
    return {
      person: p,
      result,
      idempotent: result.fingerprint === again.fingerprint,
      observedMutationsVsPack,
      inflationVsPack:
        JSON.stringify([...packSkills].sort()) !==
        JSON.stringify([...result.publicSkillCodes].sort())
          ? { packSkills, publicFromP4: result.publicSkillCodes }
          : null,
    };
  });

  const storeRows = await readStore(PILOT.map((p) => p.personId));
  const activeByPerson = new Map(
    storeRows.filter((r) => r.is_active).map((r) => [r.person_id, r]),
  );

  const diffs = assembled.map(({ person, result, idempotent, observedMutationsVsPack, inflationVsPack }) => {
    const before = activeByPerson.get(person.personId)?.payload_json ?? null;
    const after = result.presentation;
    const beforeAxes = flattenAxes(before);
    const afterAxes = flattenAxes(after);
    const axisDiff = afterAxes
      .map((a) => {
        const b = beforeAxes.find((x) => x.field === a.field && x.code === a.code);
        const beforeCov = b?.relativeCoverage ?? null;
        const beforeState = b?.evidenceState ?? null;
        const changed =
          beforeCov !== a.relativeCoverage || beforeState !== a.evidenceState;
        return changed
          ? {
              field: a.field,
              axis: a.code,
              before: beforeCov,
              after: a.relativeCoverage,
              beforeState,
              afterState: a.evidenceState,
              kind:
                beforeCov != null && beforeCov > 0 && beforeCov !== a.relativeCoverage
                  ? 'OBSERVED_COVERAGE_MUTATION'
                  : beforeCov === a.relativeCoverage
                    ? 'EVIDENCE_STATE_ONLY'
                    : beforeCov === 0 && a.relativeCoverage === 20
                      ? 'WEAK_PROMOTION'
                      : beforeCov == null
                        ? 'NEW_OR_MISSING_STORE'
                        : 'OTHER',
            }
          : null;
      })
      .filter(Boolean);
    const bCounts = publicCounts(before);
    const aCounts = publicCounts(after);
    const observedStoreMutations = axisDiff.filter(
      (d) => d && (d as { kind: string }).kind === 'OBSERVED_COVERAGE_MUTATION',
    );
    return {
      personId: person.personId,
      label: person.label,
      role: person.role,
      snapshotId: person.snapshotId,
      catalog: result.p4CatalogVersion,
      fingerprint: result.fingerprint,
      idempotent,
      observedMutationsVsPack,
      inflationVsPack,
      storeBefore: before
        ? {
            fingerprint: activeByPerson.get(person.personId)?.config_fingerprint,
            producedAt: activeByPerson.get(person.personId)?.produced_at,
          }
        : null,
      publicSpecialtiesBefore: bCounts.specialties,
      publicSpecialtiesAfter: aCounts.specialties,
      publicSkillsBefore: bCounts.skills,
      publicSkillsAfter: aCounts.skills,
      publicSpecialtyDelta: aCounts.specialtyCodes.filter(
        (c) => !bCounts.specialtyCodes.includes(c),
      ),
      publicSkillDelta: aCounts.skillCodes.filter(
        (c) => !bCounts.skillCodes.includes(c),
      ),
      observedStoreMutations,
      axisDiff,
      keyAxes: afterAxes.filter((a) =>
        [
          'DA_GOVERNANCE_QUALITY',
          'AV_EDITING_MONTAGE',
          'VD_EDITORIAL',
          'VD_MOTION',
          'SE_CLOUD_INFRA',
        ].includes(a.code),
      ),
      unmappedPublicSkills: result.unmappedPublicSkills,
    };
  });

  const batch = {
    configFingerprint: 'weak-radar-pilot',
    profiles: assembled.map(({ person, result }) => ({
      personId: person.personId,
      configFingerprint: result.fingerprint,
      producedAt: result.producedAt,
      payload: result.presentation,
    })),
  };
  writeFileSync(join(OUT, 'batch.json'), JSON.stringify(batch, null, 2));

  const dryRun = {
    status: 'DRY_RUN',
    gemini: { calls: 0, tokens: 0 },
    observedBelow20,
    mappingDebtCount: mappingDebt.length,
    mappingDebt,
    idempotence: assembled.every((a) => a.idempotent) ? 'PASS' : 'FAIL',
    diffs,
    inflationVsStore: {
      note: 'Store may be stale; cognitive inflation is overlay-vs-P3/P4 public lists (tested separately).',
    },
  };
  writeFileSync(join(OUT, 'dry-run.json'), JSON.stringify(dryRun, null, 2));

  let importResult: unknown = { skipped: true };
  if (CONFIRM) {
    const env = loadEnv(resolve(ROOT, '.env'));
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
      importResult = await importMc1PresentationBatch(
        ds,
        batch.profiles.map((p) => ({
          personId: p.personId,
          configFingerprint: p.configFingerprint,
          producedAt: p.producedAt,
          payload: p.payload,
        })),
      );
    } finally {
      await ds.destroy();
    }
    writeFileSync(join(OUT, 'import.json'), JSON.stringify(importResult, null, 2));
  }

  console.log(
    JSON.stringify(
      {
        status: CONFIRM ? 'IMPORTED' : 'DRY_RUN',
        gemini: { calls: 0, tokens: 0 },
        observedBelow20Count: observedBelow20.length,
        mappingDebtCount: mappingDebt.length,
        idempotence: dryRun.idempotence,
        persons: diffs.map((d) => ({
          label: d.label,
          personId: d.personId,
          axisChanges: d.axisDiff.length,
          observedMutationsVsPack: d.observedMutationsVsPack.length,
          observedStoreMutations: d.observedStoreMutations.length,
          specialtyDelta: d.publicSpecialtyDelta,
          skillDelta: d.publicSkillDelta,
          keyAxes: d.keyAxes,
          idempotent: d.idempotent,
        })),
        importResult,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error('DEPLOY_GATE_FAIL', String(e?.stack || e).slice(0, 2000));
  process.exit(1);
});
