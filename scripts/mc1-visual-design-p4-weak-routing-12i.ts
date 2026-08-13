/**
 * FASE 12I — Reejecución controlada P4 (WEAK routing) sobre casos 12G.
 * Reusa R1/P3 de 12F; solo P4 (+ Profile assembly) LIVE.
 *
 *   npx ts-node --transpile-only scripts/mc1-visual-design-p4-weak-routing-12i.ts --confirm
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { runP4ArtifactOnly } from '../src/mc-pipeline/p4/p4-runner';
import {
  P4_CONTRACT_VERSION,
  P4_PROMPT_VERSION,
  P4_ROUTING_POLICY_VERSION,
} from '../src/mc-pipeline/p4/p4.types';
import { loadP3Contract } from '../src/mc-pipeline/p4/p4-context-loader';
import { loadP4Contract } from '../src/mc-pipeline/profile/profile-pack-loader';
import { runProfilePilot } from '../src/mc-pipeline/profile/profile-runner';

const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'tmp', 'mc1-visual-design-p4-weak-routing-12i');

type CaseDef = {
  id: string;
  personId: string;
  label: string;
  snapshotId: string;
  role: 'CONTEXT_LOSS' | 'UPSTREAM' | 'OBSERVED_CONTROL';
  skillNeedle: string;
  expectedAfterParent?: string;
  mustNotCreate?: string;
};

const CASES: CaseDef[] = [
  {
    id: 'CL_DARIO_MOTION',
    personId: '1175',
    label: 'Dario Fernando',
    snapshotId: '24',
    role: 'CONTEXT_LOSS',
    skillNeedle: 'animación|animacion|video y animación|motion',
    expectedAfterParent: 'MOTION_DESIGN',
  },
  {
    id: 'CL_DIEGO_ILLUSTRATION',
    personId: '1168',
    label: 'Diego Fernando',
    snapshotId: '25',
    role: 'CONTEXT_LOSS',
    skillNeedle: 'illustration|ilustración|ilustracion',
    expectedAfterParent: 'ILLUSTRATION',
  },
  {
    id: 'CL_DIEGO_EDITORIAL',
    personId: '1168',
    label: 'Diego Fernando',
    snapshotId: '25',
    role: 'CONTEXT_LOSS',
    skillNeedle: 'editorial',
    expectedAfterParent: 'EDITORIAL_DESIGN',
  },
  {
    id: 'CL_HARI_BRAND',
    personId: '1188',
    label: 'Hari Steffan',
    snapshotId: '27',
    role: 'CONTEXT_LOSS',
    skillNeedle: 'branding|identidad',
    expectedAfterParent: 'BRAND_IDENTITY_DESIGN',
  },
  {
    id: 'CL_LUIS_EDITORIAL',
    personId: '1181',
    label: 'Luis Miguel',
    snapshotId: '32',
    role: 'CONTEXT_LOSS',
    skillNeedle: 'editorial|maquetación|maquetacion|diagramación|diagramacion',
    expectedAfterParent: 'EDITORIAL_DESIGN',
  },
  {
    id: 'CL_OSWALDO_MOTION',
    personId: '1170',
    label: 'Oswaldo Enrique',
    snapshotId: '33',
    role: 'CONTEXT_LOSS',
    skillNeedle: 'motion',
    expectedAfterParent: 'MOTION_DESIGN',
  },
  {
    id: 'UP_LUIS_ILLUSTRATION',
    personId: '1181',
    label: 'Luis Miguel',
    snapshotId: '32',
    role: 'UPSTREAM',
    skillNeedle: 'ilustración|ilustracion|bocet',
    mustNotCreate: 'ILLUSTRATION',
  },
  {
    id: 'UP_OSWALDO_BRAND',
    personId: '1170',
    label: 'Oswaldo Enrique',
    snapshotId: '33',
    role: 'UPSTREAM',
    skillNeedle: 'identidad',
    mustNotCreate: 'BRAND_IDENTITY_DESIGN',
  },
  {
    id: 'CTL_HERMIDA_UX',
    personId: '1187',
    label: 'Juan Andres Hermida',
    snapshotId: '28',
    role: 'OBSERVED_CONTROL',
    skillNeedle: 'ux|ui|interfaz|interacción|interaccion|interface|experience',
    expectedAfterParent: 'UX_PRODUCT_DESIGN',
  },
  {
    id: 'CTL_JULIANA_EDITORIAL',
    personId: '1186',
    label: 'Juliana Sofia',
    snapshotId: '30',
    role: 'OBSERVED_CONTROL',
    skillNeedle: 'editorial|maquetación|maquetacion',
    expectedAfterParent: 'EDITORIAL_DESIGN',
  },
  {
    id: 'CTL_LAURA_BRAND',
    personId: '1167',
    label: 'Laura Melisa',
    snapshotId: '31',
    role: 'OBSERVED_CONTROL',
    skillNeedle: 'brand|identidad',
    expectedAfterParent: 'BRAND_IDENTITY_DESIGN',
  },
  {
    id: 'CTL_LAURA_ILLUSTRATION',
    personId: '1167',
    label: 'Laura Melisa',
    snapshotId: '31',
    role: 'OBSERVED_CONTROL',
    skillNeedle: 'illustration|ilustración|ilustracion',
    expectedAfterParent: 'ILLUSTRATION',
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

function findPack(
  rootRel: string,
  snapshotId: string,
  prefixes: string[],
): string | null {
  const root = resolve(ROOT, rootRel);
  if (!existsSync(root)) return null;
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  for (const prefix of prefixes) {
    const dirs = readdirSync(root)
      .filter((n) => n.startsWith(`${prefix}${snapshotId}-`))
      .map((n) => join(root, n))
      .filter((p) => statSync(p).isDirectory())
      .sort();
    if (dirs.length) return dirs[dirs.length - 1];
  }
  return null;
}

function flatSkills(p4Path: string) {
  const env = loadP4Contract(p4Path);
  return (env.payload.specialtyResults ?? []).flatMap((sr) =>
    sr.observedSkills.map((sk) => ({
      skillCode: sk.skillCode,
      name: sk.name,
      parentSpecialtyCode: sk.parentSpecialtyCode,
      status: sk.status,
    })),
  );
}

function matchSkill(
  skills: Array<{ name: string; parentSpecialtyCode: string; skillCode: string }>,
  needle: string,
) {
  const re = new RegExp(needle, 'i');
  return skills.find((s) => re.test(s.name) || re.test(s.skillCode)) ?? null;
}

function p3Statuses(p3Path: string) {
  const p3 = loadP3Contract(p3Path);
  const out: Array<{ code: string; status: string }> = [];
  for (const fr of p3.payload.fieldResults ?? []) {
    if (fr.fieldCode !== 'VISUAL_DESIGN') continue;
    for (const s of fr.observedSpecialties ?? []) {
      out.push({ code: s.specialtyCode, status: s.status });
    }
  }
  return out;
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        hint: '--confirm required (invokes Gemini for P4)',
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
  const model = gem.GEMINI_MODEL || 'gemini-3.6-flash';

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

  mkdirSync(OUT, { recursive: true });

  const snapshotIds = [...new Set(CASES.map((c) => c.snapshotId))];
  const runBySnap = new Map<
    string,
    {
      beforeP4: string;
      afterP4: string;
      p3: string;
      r1: string;
      profileDir?: string;
      fingerprint?: string;
      geminiInvoked: boolean;
      hints: unknown[];
      specialtiesEvaluated: unknown[];
    }
  >();

  for (const snapshotId of snapshotIds) {
    const r1 = findPack('tmp/mc1-r1-functional', snapshotId, ['R1F-8A2-S']);
    const p3 = findPack('tmp/mc1-p3-functional', snapshotId, [
      'P3F-8B2-S',
      'P3F-8B-S',
    ]);
    const beforeP4 = findPack('tmp/mc1-p4-functional', snapshotId, ['P4F-8D-S']);
    if (!r1 || !p3 || !beforeP4) {
      throw new Error(`missing packs for snapshot ${snapshotId}`);
    }

    const p4 = await runP4ArtifactOnly({
      backendRoot: ROOT,
      snapshotId,
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model,
      outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
      r1PackDir: r1,
      p3PackDir: p3,
      campaignId: 'MC1-P4-12I-WEAK-ROUTING',
      pipelineRunId: `p4-12i-${snapshotId}-${Date.now()}`,
    });

    const profile = await runProfilePilot({
      backendRoot: ROOT,
      snapshotId,
      r1PackDir: r1,
      p3PackDir: p3,
      p4PackDir: p4.outDir,
      outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
      dataSource: ds,
    });

    runBySnap.set(snapshotId, {
      beforeP4,
      afterP4: p4.outDir,
      p3,
      r1,
      profileDir: profile.outDir,
      fingerprint: p4.envelope.payload.configFingerprint,
      geminiInvoked: p4.geminiInvoked,
      hints: p4.envelope.payload.specialtyCorroborationHints ?? [],
      specialtiesEvaluated: p4.envelope.payload.specialtiesEvaluated,
    });
  }

  const caseResults = CASES.map((c) => {
    const run = runBySnap.get(c.snapshotId)!;
    const beforeSkills = flatSkills(run.beforeP4);
    const afterSkills = flatSkills(run.afterP4);
    const before = matchSkill(beforeSkills, c.skillNeedle);
    const after = matchSkill(afterSkills, c.skillNeedle);
    const p3 = p3Statuses(run.p3);

    let verdict = 'UNKNOWN';
    if (c.role === 'CONTEXT_LOSS') {
      if (!before || !after) verdict = 'SKILL_NOT_FOUND';
      else if (
        before.parentSpecialtyCode === 'GRAPHIC_DESIGN' &&
        after.parentSpecialtyCode === c.expectedAfterParent
      ) {
        verdict = 'ROUTING_FIXED';
      } else if (
        before.parentSpecialtyCode === 'GRAPHIC_DESIGN' &&
        after.parentSpecialtyCode === 'GRAPHIC_DESIGN'
      ) {
        verdict = 'STILL_UNDER_GRAPHIC';
      } else {
        verdict = `MOVED_${before.parentSpecialtyCode}_TO_${after.parentSpecialtyCode}`;
      }
    } else if (c.role === 'UPSTREAM') {
      const invented = afterSkills.some(
        (s) => s.parentSpecialtyCode === c.mustNotCreate,
      );
      const evalHas = (run.specialtiesEvaluated as Array<{ specialtyCode: string }>).some(
        (s) => s.specialtyCode === c.mustNotCreate,
      );
      verdict =
        !invented && !evalHas && !p3.some((x) => x.code === c.mustNotCreate)
          ? 'NO_RESCUE_OK'
          : 'UNEXPECTED_RESCUE';
    } else if (c.role === 'OBSERVED_CONTROL') {
      if (!after) verdict = 'SKILL_NOT_FOUND';
      else if (after.parentSpecialtyCode === c.expectedAfterParent)
        verdict = 'STABLE_OBSERVED';
      else verdict = `DRIFTED_TO_${after.parentSpecialtyCode}`;
    }

    return {
      ...c,
      beforeParent: before?.parentSpecialtyCode ?? null,
      afterParent: after?.parentSpecialtyCode ?? null,
      beforeName: before?.name ?? null,
      afterName: after?.name ?? null,
      p3Statuses: p3,
      hints: run.hints,
      fingerprint: run.fingerprint,
      geminiInvoked: run.geminiInvoked,
      afterP4: run.afterP4,
      profileDir: run.profileDir,
      verdict,
    };
  });

  const contextLoss = caseResults.filter((r) => r.role === 'CONTEXT_LOSS');
  const fixed = contextLoss.filter((r) => r.verdict === 'ROUTING_FIXED').length;
  const upstreamOk = caseResults
    .filter((r) => r.role === 'UPSTREAM')
    .every((r) => r.verdict === 'NO_RESCUE_OK');
  const controlsOk = caseResults
    .filter((r) => r.role === 'OBSERVED_CONTROL')
    .every((r) => r.verdict === 'STABLE_OBSERVED');

  const decision =
    fixed >= 4 && upstreamOk && controlsOk
      ? 'P3_P4_WEAK_ROUTING_VALIDATED'
      : 'P3_P4_WEAK_ROUTING_STILL_DRIFTING';

  const report = {
    phase: '12I',
    contractBefore: { version: '1.0.0', prompt: 'MC1.P4.PROMPT.FUNCTIONAL.1.0.0' },
    contractAfter: {
      version: P4_CONTRACT_VERSION,
      prompt: P4_PROMPT_VERSION,
      routingPolicy: P4_ROUTING_POLICY_VERSION,
    },
    model,
    geminiLive: true,
    caseResults,
    metrics: {
      contextLossFixed: fixed,
      contextLossTotal: contextLoss.length,
      upstreamOk,
      controlsOk,
    },
    decision,
    radarFilterLocation:
      'profile-pack-loader.listObservedP4Skills(p4, observedP3) called from profile-assembler.assembleProfilePilot',
  };

  writeFileSync(join(OUT, 'validation-report.json'), JSON.stringify(report, null, 2));
  writeFileSync(
    join(OUT, 'phase-verdict.json'),
    JSON.stringify({ decision, metrics: report.metrics }, null, 2),
  );

  console.log(JSON.stringify(report, null, 2));
  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
