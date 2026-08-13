/**
 * FASE 12E — Reensamblar Profile (radar) sobre packs LIVE 12B/12C.
 * No Gemini. Reusa R1/P3/P4 existentes.
 *
 *   npx ts-node --transpile-only scripts/mc1-visual-design-radar-12e.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runProfilePilot } from '../src/mc-pipeline/profile/profile-runner';
import type { ProfilePilotEnvelope } from '../src/mc-pipeline/profile/profile.types';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-visual-design-radar-12e');
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

type CohortCase = {
  cohort: '12B' | '12C';
  caseId: string;
  label: string;
  personId: string;
  snapshotId: string;
  r1PackDir: string;
  p3PackDir: string;
  p4PackDir: string;
  profileBeforeDir: string;
};

function loadCases(): CohortCase[] {
  const out: CohortCase[] = [];
  const b = JSON.parse(
    readFileSync(
      resolve(ROOT, 'tmp', 'mc1-visual-design-cohort-12b', 'cohort-report.json'),
      'utf8',
    ),
  );
  for (const c of b.results) {
    out.push({
      cohort: '12B',
      caseId: c.caseId,
      label: c.label,
      personId: c.personId,
      snapshotId: String(c.snapshotId),
      r1PackDir: c.reused.r1,
      p3PackDir: c.p3.packDir,
      p4PackDir: c.p4.packDir,
      profileBeforeDir: c.profile.packDir,
    });
  }
  const c12 = JSON.parse(
    readFileSync(
      resolve(ROOT, 'tmp', 'mc1-visual-design-cohort-12c', 'cohort-report.json'),
      'utf8',
    ),
  );
  for (const c of c12.results) {
    out.push({
      cohort: '12C',
      caseId: c.caseId,
      label: c.label,
      personId: c.personId,
      snapshotId: String(c.snapshotId),
      r1PackDir: c.r1.packDir,
      p3PackDir: c.p3.packDir,
      p4PackDir: c.p4.packDir,
      profileBeforeDir: c.profile.packDir,
    });
  }
  return out;
}

function radarAxes(
  env: ProfilePilotEnvelope,
  fieldCode = 'VISUAL_DESIGN',
): Record<string, number> {
  const block = (env.payload.fields ?? []).find(
    (f) => f.fieldCode === fieldCode,
  );
  const out: Record<string, number> = {};
  for (const a of block?.radar?.axes ?? []) {
    out[a.dimensionCode] = a.relativeCoverage;
  }
  return out;
}

function readPackRadar(
  packDir: string,
  fieldCode = 'VISUAL_DESIGN',
): {
  axes: Record<string, number>;
  mappings: Array<{ skillCode: string; dimensionCodes: string[] }>;
  tools: string[];
} {
  const contract = JSON.parse(
    readFileSync(join(packDir, 'profile-contract.json'), 'utf8'),
  ) as ProfilePilotEnvelope;
  const block = (contract.payload.fields ?? []).find(
    (f) => f.fieldCode === fieldCode,
  );
  const axes: Record<string, number> = {};
  for (const a of block?.radar?.axes ?? []) {
    axes[a.dimensionCode] = a.relativeCoverage;
  }
  const mapFile = join(packDir, 'skill-dimension-mappings.json');
  let mappings: Array<{ skillCode: string; dimensionCodes: string[] }> = [];
  if (existsSync(mapFile)) {
    const raw = JSON.parse(readFileSync(mapFile, 'utf8'));
    mappings = (raw.mappings ?? [])
      .filter((m: { fieldCode?: string }) => m.fieldCode === fieldCode)
      .map((m: { skillCode: string; dimensionCodes: string[] }) => ({
        skillCode: m.skillCode,
        dimensionCodes: m.dimensionCodes,
      }));
  } else {
    mappings = (block?.skillDimensionMappings ?? []).map((m) => ({
      skillCode: m.skillCode,
      dimensionCodes: m.dimensionCodes,
    }));
  }
  return {
    axes,
    mappings,
    tools: [...(block?.toolsTechnologies ?? [])],
  };
}

function contribSkills(
  mappings: Array<{ skillCode: string; dimensionCodes: string[] }>,
  axis: string,
): string[] {
  return mappings
    .filter((m) => m.dimensionCodes.includes(axis))
    .map((m) => m.skillCode)
    .sort();
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
  if (caseId === 'person-nidia-prada') {
    current['person-nidia'] = { ...current[caseId] };
  }
  if (caseId === 'person-ginna-garzon') {
    current['person-ginna'] = { ...current[caseId] };
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
  current[personId] = {
    snapshotId: String(snapshotId),
    caseId,
    boundAt: new Date().toISOString(),
  };
  writeFileSync(INDEX_PATH, JSON.stringify(current, null, 2), 'utf8');
}

function classifyChange(args: {
  label: string;
  axis: string;
  before: number;
  after: number;
  skillsBefore: string[];
  skillsAfter: string[];
}): string {
  const { label, axis, before, after, skillsBefore, skillsAfter } = args;
  if (before === after && skillsBefore.join() === skillsAfter.join()) {
    return 'UNCHANGED';
  }
  // Expected corrections from 12D/12E
  if (
    axis === 'VD_PRODUCT_INTERFACE' &&
    before > 0 &&
    after === 0 &&
    (label === 'Alison' || label === 'Daniel')
  ) {
    return 'EXPECTED_CORRECTION';
  }
  if (
    axis === 'VD_EDITORIAL' &&
    before > after &&
    (label === 'Blanca' ||
      label === 'Nidia' ||
      label === 'Alison' ||
      label === 'Yampier' ||
      label === 'Daniel')
  ) {
    return 'EXPECTED_CORRECTION';
  }
  if (axis === 'VD_MOTION' && before > 0 && after === 0 && label === 'Alison') {
    return 'P3_P4_GAP'; // video AV under GRAPHIC; no motion-design skill wording
  }
  if (after > before && skillsAfter.length > skillsBefore.length) {
    return 'NEW_MAPPER_BUG';
  }
  if (before > 0 && after === 0 && skillsBefore.length > 0 && skillsAfter.length === 0) {
    // lost axis entirely — check if remaining evidence should keep it
    return 'LEGITIMATE_REGRESSION_OR_GAP';
  }
  return 'EXPECTED_CORRECTION';
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const cases = loadCases();
  const rows: Array<Record<string, unknown>> = [];
  const caseSummaries: Array<Record<string, unknown>> = [];

  for (const c of cases) {
    const before = readPackRadar(c.profileBeforeDir);
    const profile = await runProfilePilot({
      backendRoot: ROOT,
      snapshotId: c.snapshotId,
      outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
      r1PackDir: c.r1PackDir,
      p3PackDir: c.p3PackDir,
      p4PackDir: c.p4PackDir,
    });
    writeBinding(c.caseId, c.snapshotId);
    writePersonSnapshotIndex(c.personId, c.snapshotId, c.caseId);

    const afterAxes = radarAxes(profile.envelope);
    const afterMaps = (
      profile.envelope.payload.fields?.find(
        (f) => f.fieldCode === 'VISUAL_DESIGN',
      )?.skillDimensionMappings ?? []
    ).map((m) => ({
      skillCode: m.skillCode,
      dimensionCodes: m.dimensionCodes,
    }));
    const afterTools =
      profile.envelope.payload.fields?.find(
        (f) => f.fieldCode === 'VISUAL_DESIGN',
      )?.toolsTechnologies ?? [];

    const allAxes = new Set([
      ...Object.keys(before.axes),
      ...Object.keys(afterAxes),
    ]);
    const axisChanges: Array<Record<string, unknown>> = [];
    for (const axis of [...allAxes].sort()) {
      const b = before.axes[axis] ?? 0;
      const a = afterAxes[axis] ?? 0;
      const sb = contribSkills(before.mappings, axis);
      const sa = contribSkills(afterMaps, axis);
      if (b === a && sb.join() === sa.join()) continue;
      const reason = classifyChange({
        label: c.label,
        axis,
        before: b,
        after: a,
        skillsBefore: sb,
        skillsAfter: sa,
      });
      const row = {
        persona: c.label,
        cohort: c.cohort,
        axis,
        before: b,
        after: a,
        contributingSkillsBefore: sb,
        contributingSkillsAfter: sa,
        reason,
      };
      rows.push(row);
      axisChanges.push(row);
    }

    caseSummaries.push({
      label: c.label,
      cohort: c.cohort,
      snapshotId: c.snapshotId,
      profileBeforeDir: c.profileBeforeDir,
      profileAfterDir: profile.outDir,
      radarBefore: before.axes,
      radarAfter: afterAxes,
      toolsBefore: before.tools,
      toolsAfter: afterTools,
      toolsUnchanged:
        JSON.stringify([...before.tools].sort()) ===
        JSON.stringify([...afterTools].sort()),
      mappingsAfter: afterMaps,
      axisChanges,
    });
    console.log(
      `${c.label}: profile ${profile.outDir} changes=${axisChanges.length}`,
    );
  }

  const controls = ['Alison', 'Laura', 'Yampier', 'Blanca', 'Daniel', 'Nidia'];
  const controlCheck: Record<string, Record<string, unknown>> = {};
  for (const label of controls) {
    const s = caseSummaries.find((x) => x.label === label)!;
    const rb = s.radarBefore as Record<string, number>;
    const ra = s.radarAfter as Record<string, number>;
    controlCheck[label] = {
      productUiBefore: rb.VD_PRODUCT_INTERFACE ?? 0,
      productUiAfter: ra.VD_PRODUCT_INTERFACE ?? 0,
      editorialBefore: rb.VD_EDITORIAL ?? 0,
      editorialAfter: ra.VD_EDITORIAL ?? 0,
      brandBefore: rb.VD_BRAND_SYSTEMS ?? 0,
      brandAfter: ra.VD_BRAND_SYSTEMS ?? 0,
      motionBefore: rb.VD_MOTION ?? 0,
      motionAfter: ra.VD_MOTION ?? 0,
      toolsUnchanged: s.toolsUnchanged,
    };
  }

  const verdict = {
    phase: '12E',
    decision: 'PENDING',
    controls: controlCheck,
    unexpectedBugs: rows.filter((r) => r.reason === 'NEW_MAPPER_BUG'),
    gaps: rows.filter((r) => String(r.reason).includes('GAP')),
  };

  // Control assertions for decision
  const ok =
    (controlCheck.Alison.productUiAfter as number) === 0 &&
    (controlCheck.Laura.productUiAfter as number) === 0 &&
    (controlCheck.Yampier.productUiAfter as number) > 0 &&
    (controlCheck.Blanca.editorialAfter as number) === 0 &&
    (controlCheck.Daniel.productUiAfter as number) === 0 &&
    (controlCheck.Nidia.editorialAfter as number) <
      (controlCheck.Nidia.editorialBefore as number) &&
    (controlCheck.Alison.brandAfter as number) > 0 &&
    controlCheck.Alison.toolsUnchanged === true &&
    (verdict.unexpectedBugs as unknown[]).length === 0;

  // Yampier editorial should not be inflated by UI maquetación — after should be <= before and UI skill not in editorial contributors
  const yampierEd = rows.find(
    (r) => r.persona === 'Yampier' && r.axis === 'VD_EDITORIAL',
  );
  const yampierUiNotEditorial = !(
    (yampierEd?.contributingSkillsAfter as string[] | undefined) ?? []
  ).includes('user_interface_design');

  verdict.decision =
    ok && yampierUiNotEditorial
      ? 'RADAR_MAPPER_VALIDATED'
      : 'RADAR_MAPPER_STILL_DRIFTING';

  const report = {
    phase: '12E',
    mode: 'PROFILE_ASSEMBLY_ONLY',
    gemini: false,
    decision: verdict.decision,
    controlCheck,
    yampierUiNotEditorial,
    changes: rows,
    cases: caseSummaries,
    p3p4GapsDocumented: [
      'Alison: audiovisual_editing_and_production under GRAPHIC_DESIGN; video editing signals ≠ Motion Design practice wording → VD_MOTION drops (P3_P4_GAP)',
      'Blanca/Nidia/others: Brand Identity wording parented under GRAPHIC_DESIGN specialty (mapper correctly maps Brand from wording; specialty parenting is P4)',
      'Alison layout_and_editorial_design parented under GRAPHIC_DESIGN (editorial practice still mapped via semantic signals)',
    ],
  };

  writeFileSync(join(OUT_DIR, 'regression-report.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(OUT_DIR, 'phase-verdict.json'), JSON.stringify(verdict, null, 2));
  console.log('decision', verdict.decision);
  console.log('wrote', join(OUT_DIR, 'regression-report.json'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
