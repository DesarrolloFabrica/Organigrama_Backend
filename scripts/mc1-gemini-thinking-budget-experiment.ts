/**
 * Experimento thinking budget — 3 personas, T0 + T1/T2/T3 aislados por fase.
 * NO cambia thinkingConfig productivo (ausente). Overrides solo en este script.
 *
 *   npx ts-node --transpile-only scripts/mc1-gemini-thinking-budget-experiment.ts --confirm
 *
 * gemini-3.6-flash: thinkingLevel minimal|low|medium|high (default medium si absent).
 * No mezclar thinkingLevel con thinkingBudget.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { createMdeDataSource, createP0Service } from '../src/mc-observatory/p0-bootstrap';
import { runP1ForMember } from '../src/mc-observatory/p1-member-runner';
import { runP2ArtifactOnly } from '../src/mc-pipeline/p2/p2-runner';
import { runR1ArtifactOnly } from '../src/mc-pipeline/r1/r1-runner';
import { runP3ArtifactOnly } from '../src/mc-pipeline/p3/p3-runner';
import { runP4ArtifactOnly } from '../src/mc-pipeline/p4/p4-runner';
import { runProfilePilot } from '../src/mc-pipeline/profile/profile-runner';
import {
  P1_PROMPT_VERSION,
  P1_SEGMENTER_VERSION,
} from '../src/mc-pipeline/p1/p1.types';
import {
  aggregateGeminiUsage,
  filterLedgerByRun,
  groupGeminiUsage,
  readGeminiLedgerEvents,
  type Mc1ThinkingConfig,
} from '../src/mc-pipeline/gemini';
import { serializeThinkingConfig } from '../src/mc-pipeline/gemini/gemini-thinking-config';

const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'tmp', 'mc1-thinking-budget-experiment');
const LEDGER_PATH = join(OUT, 'events.jsonl');
const HARD_CAP = 120;
const EXPERIMENT_ID = 'mc1-tb-v1';

const GOV_RE =
  /gobernanza|gobierno de datos|integridad|trazabilidad|calidad de (la )?dat|data[\s_-]?quality|data[\s_-]?governance/i;

type VariantId = 'T0' | 'T1' | 'T2' | 'T3';
type SemanticDiff =
  | 'NONE'
  | 'COSMETIC'
  | 'ACCEPTABLE'
  | 'SEMANTIC_DRIFT'
  | 'CRITICAL_REGRESSION'
  | 'UNSUPPORTED';

const VARIANTS: Record<
  VariantId,
  { label: string; thinking: Mc1ThinkingConfig | undefined }
> = {
  T0: { label: 'BASELINE_DEFAULT', thinking: undefined },
  T1: { label: 'HIGH_REDUCED', thinking: { thinkingLevel: 'low' } },
  T2: { label: 'MINIMAL', thinking: { thinkingLevel: 'minimal' } },
  T3: { label: 'DISABLED_BUDGET0', thinking: { thinkingBudget: 0 } },
};

const COHORT_QUERY = [
  { key: 'sara', document: '1019117022', domainHint: 'DATA_ANALYTICS' },
  { key: 'johan', document: '1020841798', domainHint: 'SOFTWARE_ENGINEERING' },
  { key: 'nidia', document: '1015482688', domainHint: 'VISUAL_DESIGN' },
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

function writeJson(path: string, data: unknown) {
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
}

function fpOverrides(variant: VariantId): Record<string, string> {
  return {
    thinkingExperiment: EXPERIMENT_ID,
    thinkingVariant: variant,
    thinking: serializeThinkingConfig(VARIANTS[variant].thinking),
  };
}

function usageOf(runId: string) {
  const events = filterLedgerByRun(readGeminiLedgerEvents(ROOT), runId);
  const t = aggregateGeminiUsage(events);
  const byPhase = groupGeminiUsage(events, 'phase');
  return {
    calls: t.calls,
    promptTokens: t.calls === 0 ? 0 : t.promptTokens,
    candidateTokens: t.calls === 0 ? 0 : t.candidateTokens,
    thinkingTokens: t.thinkingTokens,
    totalTokens: t.calls === 0 ? 0 : t.totalTokens,
    durationMs: t.durationMs,
    thinkingUsage: t.thinkingUsage,
    byPhase,
  };
}

const GOV_BLOB = (u: {
  normalizedActivity?: string | null;
  object?: string | null;
  result?: string | null;
  toolOrMethod?: string | null;
}) =>
  [u.normalizedActivity, u.object, u.result, u.toolOrMethod]
    .filter(Boolean)
    .join(' ');

function p1Summary(dir: string) {
  const ve = JSON.parse(readFileSync(join(dir, 'validated-evidence.json'), 'utf8')) as {
    units?: Array<{
      evidencePrototypeId?: string;
      candidateId?: string;
      explicitness?: string;
      reviewRequired?: boolean;
      evidenceKind?: string;
      normalizedActivity?: string | null;
      object?: string | null;
      result?: string | null;
      toolOrMethod?: string | null;
    }>;
  };
  const units = ve.units ?? [];
  const explicitness: Record<string, number> = {};
  let reviewRequired = 0;
  let govHits = 0;
  const keys: string[] = [];
  for (const u of units) {
    explicitness[u.explicitness ?? 'UNK'] = (explicitness[u.explicitness ?? 'UNK'] ?? 0) + 1;
    if (u.reviewRequired) reviewRequired += 1;
    const blob = GOV_BLOB(u);
    if (GOV_RE.test(blob)) govHits += 1;
    keys.push(
      `${u.evidenceKind ?? ''}|${(u.normalizedActivity ?? '').toLowerCase().slice(0, 80)}`,
    );
  }
  return {
    unitCount: units.length,
    explicitness,
    reviewRequired,
    govHits,
    keys,
  };
}

function p2Summary(dir: string) {
  const env = JSON.parse(readFileSync(join(dir, 'p2-contract.json'), 'utf8')) as {
    payload: {
      outcomeStatus?: string;
      domainCandidates?: Array<{
        domainCode: string | null;
        candidateStatus: string;
        confidence: number;
        rank: number;
        coverageRatio?: number;
        ambiguityFlags?: string[];
        supportingEvidenceUnitIds?: string[];
        contradictingEvidenceUnitIds?: string[];
      }>;
    };
  };
  const cands = [...(env.payload.domainCandidates ?? [])].sort(
    (a, b) => a.rank - b.rank,
  );
  return {
    outcomeStatus: env.payload.outcomeStatus,
    primary: cands[0]?.domainCode ?? null,
    domains: cands.map((c) => ({
      domainCode: c.domainCode,
      status: c.candidateStatus,
      confidence: c.confidence,
      rank: c.rank,
      coverageRatio: c.coverageRatio ?? null,
      ambiguityFlags: c.ambiguityFlags ?? [],
      support: c.supportingEvidenceUnitIds?.length ?? 0,
      contradictions: c.contradictingEvidenceUnitIds?.length ?? 0,
    })),
  };
}

function p3Summary(dir: string) {
  const env = JSON.parse(readFileSync(join(dir, 'p3-contract.json'), 'utf8')) as {
    payload: {
      fieldResults?: Array<{
        fieldCode: string;
        observedSpecialties?: Array<{
          specialtyCode: string;
          status: string;
          confidence: number;
          supportingEvidenceUnitIds?: string[];
        }>;
      }>;
    };
  };
  const specs: Array<{
    fieldCode: string;
    specialtyCode: string;
    status: string;
    confidence: number;
    support: number;
  }> = [];
  for (const fr of env.payload.fieldResults ?? []) {
    for (const s of fr.observedSpecialties ?? []) {
      specs.push({
        fieldCode: fr.fieldCode,
        specialtyCode: s.specialtyCode,
        status: s.status,
        confidence: s.confidence,
        support: s.supportingEvidenceUnitIds?.length ?? 0,
      });
    }
  }
  return {
    specialties: specs,
    observed: specs.filter((s) => s.status === 'OBSERVED').map((s) => s.specialtyCode),
    weak: specs.filter((s) => s.status === 'WEAK').map((s) => s.specialtyCode),
  };
}

function p4Summary(dir: string) {
  const env = JSON.parse(readFileSync(join(dir, 'p4-contract.json'), 'utf8')) as {
    payload: {
      specialtyResults?: Array<{
        observedSkills?: Array<{
          skillCode: string;
          name?: string;
          parentSpecialtyCode?: string;
          status?: string;
          supportingEvidenceUnitIds?: string[];
        }>;
      }>;
    };
  };
  const skills: Array<{
    skillCode: string;
    name: string;
    parentSpecialtyCode: string;
    status: string;
    support: number;
  }> = [];
  for (const sr of env.payload.specialtyResults ?? []) {
    for (const sk of sr.observedSkills ?? []) {
      skills.push({
        skillCode: sk.skillCode,
        name: sk.name ?? '',
        parentSpecialtyCode: sk.parentSpecialtyCode ?? '',
        status: sk.status ?? '',
        support: sk.supportingEvidenceUnitIds?.length ?? 0,
      });
    }
  }
  return {
    skills,
    skillCodes: skills.map((s) => s.skillCode),
    govSkills: skills.filter((s) =>
      GOV_RE.test(`${s.skillCode} ${s.name} ${s.parentSpecialtyCode}`),
    ),
  };
}

function profileSummary(dir: string) {
  const env = JSON.parse(readFileSync(join(dir, 'profile-contract.json'), 'utf8')) as {
    payload: {
      r1FieldResolutionStatus?: string;
      fields?: Array<{
        fieldCode: string;
        role: string;
        specialties?: Array<{ specialtyCode: string }>;
        skills?: Array<{ skillCode: string; name: string }>;
        radar?: { axes?: Array<{ dimensionCode: string; relativeCoverage: number }> };
      }>;
    };
  };
  const fields = env.payload.fields ?? [];
  const da = fields.find((f) => f.fieldCode === 'DATA_ANALYTICS');
  const gov = da?.radar?.axes?.find((a) => a.dimensionCode === 'DA_GOVERNANCE_QUALITY');
  return {
    r1Status: env.payload.r1FieldResolutionStatus,
    fieldCodes: fields.map((f) => f.fieldCode),
    daGovernanceCoverage: gov?.relativeCoverage ?? null,
    daSkills: (da?.skills ?? []).map((s) => s.skillCode),
  };
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 1 : inter / union;
}

function classifyP1(
  base: ReturnType<typeof p1Summary>,
  cur: ReturnType<typeof p1Summary>,
  isSara: boolean,
): SemanticDiff {
  if (base.unitCount === 0 && cur.unitCount === 0) return 'NONE';
  const lost = base.unitCount - cur.unitCount;
  if (isSara && base.govHits > 0 && cur.govHits === 0) return 'CRITICAL_REGRESSION';
  if (lost > 0 && lost / Math.max(base.unitCount, 1) >= 0.3) {
    return 'CRITICAL_REGRESSION';
  }
  const jac = jaccard(base.keys, cur.keys);
  if (jac >= 0.92 && Math.abs(lost) <= 1) return jac === 1 ? 'NONE' : 'COSMETIC';
  if (jac >= 0.75 && !(isSara && cur.govHits < base.govHits)) return 'ACCEPTABLE';
  if (isSara && cur.govHits < base.govHits) return 'SEMANTIC_DRIFT';
  return 'SEMANTIC_DRIFT';
}

function classifyP2(
  base: ReturnType<typeof p2Summary>,
  cur: ReturnType<typeof p2Summary>,
): SemanticDiff {
  if (base.primary && cur.primary && base.primary !== cur.primary) {
    return 'CRITICAL_REGRESSION';
  }
  const bd = base.domains.map((d) => d.domainCode ?? '').filter(Boolean);
  const cd = cur.domains.map((d) => d.domainCode ?? '').filter(Boolean);
  const jac = jaccard(bd, cd);
  if (jac === 1) {
    const confDrift = base.domains.some((b, i) => {
      const c = cur.domains[i];
      return c && Math.abs((c.confidence ?? 0) - (b.confidence ?? 0)) > 0.15;
    });
    return confDrift ? 'COSMETIC' : 'NONE';
  }
  if (jac >= 0.67) return 'ACCEPTABLE';
  return 'SEMANTIC_DRIFT';
}

function classifyP3(
  base: ReturnType<typeof p3Summary>,
  cur: ReturnType<typeof p3Summary>,
): SemanticDiff {
  const lostObs = base.observed.filter((s) => !cur.observed.includes(s));
  if (lostObs.length) return 'CRITICAL_REGRESSION';
  const jac = jaccard(
    [...base.observed, ...base.weak],
    [...cur.observed, ...cur.weak],
  );
  const weakToObs = base.weak.filter((s) => cur.observed.includes(s));
  const obsToWeak = base.observed.filter((s) => cur.weak.includes(s));
  if (obsToWeak.length) return 'SEMANTIC_DRIFT';
  if (jac === 1 && weakToObs.length === 0) return 'NONE';
  if (jac >= 0.8) return 'ACCEPTABLE';
  return 'SEMANTIC_DRIFT';
}

function classifyP4(
  base: ReturnType<typeof p4Summary>,
  cur: ReturnType<typeof p4Summary>,
  isSara: boolean,
): SemanticDiff {
  if (isSara && base.govSkills.length > 0 && cur.govSkills.length === 0) {
    return 'CRITICAL_REGRESSION';
  }
  const lost = base.skillCodes.filter((s) => !cur.skillCodes.includes(s));
  if (lost.length >= 2 || (lost.length === 1 && base.skillCodes.length <= 3)) {
    return lost.length / Math.max(base.skillCodes.length, 1) >= 0.4
      ? 'CRITICAL_REGRESSION'
      : 'SEMANTIC_DRIFT';
  }
  const jac = jaccard(base.skillCodes, cur.skillCodes);
  if (jac === 1) return 'NONE';
  if (jac >= 0.8) return 'ACCEPTABLE';
  return 'SEMANTIC_DRIFT';
}

async function runP1(args: {
  ds: DataSource;
  snapshotId: string;
  personId: string;
  personCvId: string;
  apiKey: string;
  model: string;
  runId: string;
  variant: VariantId;
  outDir: string;
  reuseSearchRoot?: string;
}) {
  const snap = (
    await args.ds.query(
      `SELECT normalized_text, pages, sectioned_content, parse_status
         FROM organigrama.mc_cv_snapshot WHERE id = $1`,
      [args.snapshotId],
    )
  )[0];
  if (!snap?.normalized_text || snap.parse_status !== 'PARSED') {
    throw new Error(`SNAPSHOT_NOT_READY:${args.snapshotId}`);
  }
  mkdirSync(args.outDir, { recursive: true });
  const prototypeId = args.outDir.split(/[/\\]/).pop()!;
  writeFileSync(
    join(args.outDir, 'prototype-manifest.json'),
    JSON.stringify(
      {
        classification: 'CONFIDENTIAL',
        operationType: 'P1_THINKING_BUDGET_EXPERIMENT',
        prototypeId,
        snapshotId: args.snapshotId,
        contractVersion: '2.0.0',
        segmenterVersion: P1_SEGMENTER_VERSION,
        promptVersion: P1_PROMPT_VERSION,
        thinkingVariant: args.variant,
        startedAt: new Date().toISOString(),
        persistence: 'NONE',
      },
      null,
      2,
    ),
    'utf8',
  );
  const pages = typeof snap.pages === 'string' ? JSON.parse(snap.pages) : snap.pages;
  const sectioned =
    typeof snap.sectioned_content === 'string'
      ? JSON.parse(snap.sectioned_content)
      : snap.sectioned_content;
  const p1 = await runP1ForMember({
    prototypeId,
    snapshotId: args.snapshotId,
    normalizedText: snap.normalized_text,
    pages,
    sectionedContent: sectioned,
    apiKey: args.apiKey,
    model: args.model,
    outDir: args.outDir,
    personId: args.personId,
    personCvId: args.personCvId,
    runId: args.runId,
    backendRoot: ROOT,
    forceRecompute: false,
    fingerprintOverrides: fpOverrides(args.variant),
    reuseSearchRoot: args.reuseSearchRoot ?? resolve(args.outDir, '..'),
    thinkingConfig: VARIANTS[args.variant].thinking,
  });
  if (!p1.ok) throw new Error(`P1_FAILED:${p1.errorCode ?? p1.status}`);
  const batchesFile = JSON.parse(
    readFileSync(join(args.outDir, 'batches.json'), 'utf8'),
  ) as { batches: Array<{ batchId: string; candidateIds: string[] }> };
  const candToBatch = new Map<string, string>();
  for (const b of batchesFile.batches) {
    for (const id of b.candidateIds) candToBatch.set(id, b.batchId);
  }
  writeFileSync(
    join(args.outDir, 'decisions.json'),
    JSON.stringify(
      {
        decisions: [...p1.decisions.entries()].map(([candidateId, decision]) => ({
          candidateId,
          decision,
          reasonCode: String(decision).startsWith('REJECTED')
            ? 'REJECTED'
            : decision === 'REVIEW_REQUIRED'
              ? 'NEEDS_REVIEW'
              : 'OK',
          batchId: candToBatch.get(candidateId) ?? 'unknown',
        })),
      },
      null,
      2,
    ),
    'utf8',
  );
  return p1;
}

type PersonCtx = {
  key: string;
  personId: string;
  snapshotId: string;
  personCvId: string;
  domainHint: string;
  packs: {
    p1: string;
    p2: string;
    r1: string;
    p3: string;
    p4: string;
    profile: string;
  };
  p1Batches: number;
};

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        costCap: HARD_CAP,
        hint: '--confirm required',
      }),
    );
    process.exit(2);
  }

  mkdirSync(OUT, { recursive: true });
  process.env.MC1_GEMINI_LEDGER_PATH = LEDGER_PATH;
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const mde = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const gem = loadEnvFile(
    resolve(ROOT, 'secrets/mc1-p1-prototype.local.env'),
    new Set(['GEMINI_API_KEY', 'GEMINI_MODEL']),
  );
  const driveAllow = new Set([
    'GOOGLE_DRIVE_CV_FOLDER_ID',
    'GOOGLE_DRIVE_CV_TOKEN_PATH',
    'GOOGLE_DRIVE_CV_AUTH_MODE',
    'GOOGLE_DRIVE_CV_OAUTH_CLIENT_PATH',
  ]);
  const driveEnv = loadEnvFile(resolve(ROOT, '.env'), driveAllow);
  for (const [k, v] of Object.entries(driveEnv)) {
    if (!process.env[k]?.trim()) process.env[k] = v;
  }
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

  const costCap = {
    hardCapCalls: HARD_CAP,
    planned: {
      t0: '3 personas × (P1 batches + P2 + P3 + P4); estimado 24, peor 57',
      variants:
        'por fase aislada: P1×3 niveles×batches; P2/P3/P4 ×3 personas ×3 niveles ×1',
      estimateTypical: 105,
      note: 'T0 thinkingConfig absent. T1 level=low. T2 level=minimal. T3 budget=0. Stop-early on CRITICAL_REGRESSION. P1 variants last to avoid contaminating latest P1 pack.',
      productionThinkingUnchanged: true,
    },
  };
  writeJson(join(OUT, 'cost-cap.json'), costCap);
  console.log(JSON.stringify({ status: 'COST_CAP', ...costCap }, null, 2));

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

  const matrix: unknown[] = [];
  const people: PersonCtx[] = [];
  let t3Unsupported = false;
  let totalCalls = 0;

  try {
    const mdeTarget = {
      host: mde.MDE_DB_HOST,
      port: Number(mde.MDE_DB_PORT),
      database: mde.MDE_DB_NAME,
      username: mde.MDE_DB_USERNAME,
      password: mde.MDE_DB_PASSWORD,
    };
    const dsP0 = await createMdeDataSource(mdeTarget);
    const p0 = createP0Service(dsP0, mdeTarget);

    for (const c of COHORT_QUERY) {
      const rows = await ds.query(
        `
        SELECT
          p.id::text AS person_id,
          pc.id::text AS person_cv_id,
          (
            SELECT s.id::text
              FROM organigrama.mc_cv_snapshot s
             WHERE s.person_cv_id = pc.id
               AND s.parse_status = 'PARSED'
               AND s.normalized_text IS NOT NULL
               AND length(s.normalized_text) > 0
             ORDER BY s.created_at DESC NULLS LAST, s.id DESC
             LIMIT 1
          ) AS snapshot_id
        FROM core.person p
        JOIN organigrama.person_cv pc
          ON pc.person_id = p.id AND pc.is_active = true
        WHERE p.document = $1
        LIMIT 1
        `,
        [c.document],
      );
      const row = rows?.[0];
      if (!row?.person_cv_id) throw new Error(`PERSON_NOT_FOUND:${c.key}`);
      let snapshotId = row.snapshot_id ? String(row.snapshot_id) : '';
      if (!snapshotId) {
        const created = await p0.createOrReuseFromPersonCv(Number(row.person_cv_id));
        snapshotId = String(created.snapshotId);
      }
      people.push({
        key: c.key,
        personId: String(row.person_id),
        snapshotId,
        personCvId: String(row.person_cv_id),
        domainHint: c.domainHint,
        packs: { p1: '', p2: '', r1: '', p3: '', p4: '', profile: '' },
        p1Batches: 0,
      });
    }
    await dsP0.destroy();
    writeJson(
      join(OUT, 'cohort.json'),
      people.map((p) => ({
        key: p.key,
        personId: p.personId,
        snapshotId: p.snapshotId,
        domainHint: p.domainHint,
      })),
    );

    for (const p of people) {
      const runId = `tb-T0-${p.key}-${Date.now()}`;
      const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      const p1Out = resolve(
        ROOT,
        'tmp',
        'mc1-p1-prototype',
        `P1P-V11-6I-S${p.snapshotId}-${stamp}-${randomUUID().slice(0, 8)}`,
      );
      const p1 = await runP1({
        ds,
        snapshotId: p.snapshotId,
        personId: p.personId,
        personCvId: p.personCvId,
        apiKey: gem.GEMINI_API_KEY,
        model,
        runId,
        variant: 'T0',
        outDir: p1Out,
        reuseSearchRoot: resolve(ROOT, 'tmp', 'mc1-p1-prototype'),
      });
      p.p1Batches = p1.batchCount;
      p.packs.p1 = p1Out;
      const p2 = await runP2ArtifactOnly({
        backendRoot: ROOT,
        snapshotId: p.snapshotId,
        dataSource: ds,
        apiKey: gem.GEMINI_API_KEY,
        model,
        outRoot: resolve(ROOT, 'tmp', 'mc1-p2-functional'),
        pipelineRunId: runId,
        personId: p.personId,
        fingerprintOverrides: fpOverrides('T0'),
        thinkingConfig: undefined,
      });
      p.packs.p2 = p2.outDir;
      const r1 = runR1ArtifactOnly({
        backendRoot: ROOT,
        snapshotId: p.snapshotId,
        p2PackDir: p2.outDir,
      });
      p.packs.r1 = r1.outDir;
      const p3 = await runP3ArtifactOnly({
        backendRoot: ROOT,
        snapshotId: p.snapshotId,
        dataSource: ds,
        apiKey: gem.GEMINI_API_KEY,
        model,
        outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
        r1PackDir: r1.outDir,
        pipelineRunId: runId,
        personId: p.personId,
        fingerprintOverrides: fpOverrides('T0'),
      });
      p.packs.p3 = p3.outDir;
      const p4 = await runP4ArtifactOnly({
        backendRoot: ROOT,
        snapshotId: p.snapshotId,
        dataSource: ds,
        apiKey: gem.GEMINI_API_KEY,
        model,
        outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
        r1PackDir: r1.outDir,
        p3PackDir: p3.outDir,
        pipelineRunId: runId,
        personId: p.personId,
        fingerprintOverrides: fpOverrides('T0'),
      });
      p.packs.p4 = p4.outDir;
      const prof = await runProfilePilot({
        backendRoot: ROOT,
        snapshotId: p.snapshotId,
        outRoot: resolve(OUT, 'profile'),
        dataSource: ds,
        r1PackDir: r1.outDir,
        p3PackDir: p3.outDir,
        p4PackDir: p4.outDir,
      });
      p.packs.profile = prof.outDir;
      const u = usageOf(runId);
      totalCalls += u.calls;
      writeJson(join(OUT, 'baseline', `${p.key}.json`), {
        personKey: p.key,
        personId: p.personId,
        snapshotId: p.snapshotId,
        packs: p.packs,
        p1: p1Summary(p.packs.p1),
        p2: p2Summary(p.packs.p2),
        p3: p3Summary(p.packs.p3),
        p4: p4Summary(p.packs.p4),
        profile: profileSummary(p.packs.profile),
        r1Primary: r1.envelope.payload.primaryField?.fieldCode ?? null,
        usage: u,
        thinking: 'absent',
      });
      for (const phase of ['P1', 'P2', 'P3', 'P4'] as const) {
        const ph = u.byPhase[phase];
        matrix.push({
          person: p.key,
          phase,
          config: 'T0',
          thinking: ph?.thinkingTokens ?? null,
          total: ph?.totalTokens ?? null,
          promptTokens: ph?.promptTokens ?? null,
          candidateTokens: ph?.candidateTokens ?? null,
          durationMs: ph?.durationMs ?? null,
          calls: ph?.calls ?? 0,
          saving: 0,
          semanticDiff: '—',
          verdict: 'BASELINE',
        });
      }
      if (totalCalls >= HARD_CAP) throw new Error(`HARD_CAP_REACHED:${totalCalls}`);
    }

    const remainingAfterT0 = HARD_CAP - totalCalls;
    const p1Avg = Math.max(
      ...people.map((p) => p.p1Batches),
      1,
    );
    let variantIds: VariantId[] = ['T1', 'T2', 'T3'];
    const p1Cost = people.length * variantIds.length * p1Avg;
    const restCost = people.length * variantIds.length * 3;
    if (p1Cost + restCost > remainingAfterT0) {
      variantIds = ['T1', 'T2'];
    }

    const runVariantPhase = async (
      p: PersonCtx,
      phase: 'P1' | 'P2' | 'P3' | 'P4',
      variant: VariantId,
    ) => {
      const runId = `tb-${variant}-${phase}-${p.key}-${Date.now()}`;
      const thinking = VARIANTS[variant].thinking;
      const ov = fpOverrides(variant);
      try {
        if (phase === 'P2') {
          const r = await runP2ArtifactOnly({
            backendRoot: ROOT,
            snapshotId: p.snapshotId,
            dataSource: ds,
            apiKey: gem.GEMINI_API_KEY,
            model,
            outRoot: resolve(OUT, 'p2', p.key, variant),
            pipelineRunId: runId,
            personId: p.personId,
            fingerprintOverrides: ov,
            thinkingConfig: thinking,
          });
          return { dir: r.outDir, runId };
        }
        if (phase === 'P3') {
          const r = await runP3ArtifactOnly({
            backendRoot: ROOT,
            snapshotId: p.snapshotId,
            dataSource: ds,
            apiKey: gem.GEMINI_API_KEY,
            model,
            outRoot: resolve(OUT, 'p3', p.key, variant),
            r1PackDir: p.packs.r1,
            pipelineRunId: runId,
            personId: p.personId,
            fingerprintOverrides: ov,
            thinkingConfig: thinking,
          });
          return { dir: r.outDir, runId };
        }
        if (phase === 'P4') {
          const r = await runP4ArtifactOnly({
            backendRoot: ROOT,
            snapshotId: p.snapshotId,
            dataSource: ds,
            apiKey: gem.GEMINI_API_KEY,
            model,
            outRoot: resolve(OUT, 'p4', p.key, variant),
            r1PackDir: p.packs.r1,
            p3PackDir: p.packs.p3,
            pipelineRunId: runId,
            personId: p.personId,
            fingerprintOverrides: ov,
            thinkingConfig: thinking,
          });
          return { dir: r.outDir, runId };
        }
        const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
        const p1Out = resolve(
          OUT,
          'p1',
          p.key,
          variant,
          `P1P-TB-S${p.snapshotId}-${stamp}-${randomUUID().slice(0, 8)}`,
        );
        await runP1({
          ds,
          snapshotId: p.snapshotId,
          personId: p.personId,
          personCvId: p.personCvId,
          apiKey: gem.GEMINI_API_KEY,
          model,
          runId,
          variant,
          outDir: p1Out,
          reuseSearchRoot: resolve(OUT, 'p1', p.key, variant),
        });
        return { dir: p1Out, runId };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (variant === 'T3' && /thinking|invalid|400|unsupported/i.test(msg)) {
          t3Unsupported = true;
          return { dir: null, runId, error: msg };
        }
        throw err;
      }
    };

    const phaseOrder: Array<'P2' | 'P3' | 'P4' | 'P1'> = ['P2', 'P3', 'P4', 'P1'];
    for (const phase of phaseOrder) {
      for (const p of people) {
        let stop = false;
        for (const variant of variantIds) {
          if (stop || (variant === 'T3' && t3Unsupported)) {
            matrix.push({
              person: p.key,
              phase,
              config: variant,
              thinking: null,
              total: null,
              saving: null,
              semanticDiff: t3Unsupported && variant === 'T3' ? 'UNSUPPORTED' : 'SKIPPED_STOP_EARLY',
              verdict: 'SKIPPED',
            });
            continue;
          }
          if (totalCalls >= HARD_CAP) throw new Error(`HARD_CAP_REACHED:${totalCalls}`);
          const ran = await runVariantPhase(p, phase, variant);
          const u = usageOf(ran.runId);
          totalCalls += u.calls;
          const base = JSON.parse(
            readFileSync(join(OUT, 'baseline', `${p.key}.json`), 'utf8'),
          ) as {
            p1: ReturnType<typeof p1Summary>;
            p2: ReturnType<typeof p2Summary>;
            p3: ReturnType<typeof p3Summary>;
            p4: ReturnType<typeof p4Summary>;
            usage: ReturnType<typeof usageOf>;
          };
          let diff: SemanticDiff = 'NONE';
          if (!ran.dir) {
            diff = 'UNSUPPORTED';
          } else if (phase === 'P1') diff = classifyP1(base.p1, p1Summary(ran.dir), p.key === 'sara');
          else if (phase === 'P2') diff = classifyP2(base.p2, p2Summary(ran.dir));
          else if (phase === 'P3') diff = classifyP3(base.p3, p3Summary(ran.dir));
          else diff = classifyP4(base.p4, p4Summary(ran.dir), p.key === 'sara');

          if (phase === 'P4' && ran.dir && p.key === 'sara') {
            const prof = await runProfilePilot({
              backendRoot: ROOT,
              snapshotId: p.snapshotId,
              outRoot: resolve(OUT, 'profile-variants'),
              dataSource: ds,
              r1PackDir: p.packs.r1,
              p3PackDir: p.packs.p3,
              p4PackDir: ran.dir,
            });
            const ps = profileSummary(prof.outDir);
            const bProf = profileSummary(p.packs.profile);
            if (
              (bProf.daGovernanceCoverage ?? 0) > 0 &&
              (ps.daGovernanceCoverage == null || ps.daGovernanceCoverage === 0)
            ) {
              diff = 'CRITICAL_REGRESSION';
            }
          }

          const basePh = base.usage.byPhase?.[phase];
          const baseThink = basePh?.thinkingTokens ?? null;
          const baseTot = basePh?.totalTokens ?? null;
          const thinkSave =
            baseThink != null && u.thinkingTokens != null
              ? Math.round((1 - u.thinkingTokens / Math.max(baseThink, 1)) * 1000) / 10
              : null;
          const totSave =
            baseTot != null && u.totalTokens != null
              ? Math.round(
                  (1 - Number(u.totalTokens) / Math.max(Number(baseTot), 1)) * 1000,
                ) / 10
              : null;
          const verdict =
            diff === 'CRITICAL_REGRESSION'
              ? 'REJECT'
              : diff === 'UNSUPPORTED'
                ? 'UNSUPPORTED'
                : diff === 'SEMANTIC_DRIFT'
                  ? 'CAUTION'
                  : 'KEEP';
          matrix.push({
            person: p.key,
            phase,
            config: variant,
            thinking: u.thinkingTokens,
            total: u.totalTokens,
            promptTokens: u.promptTokens,
            candidateTokens: u.candidateTokens,
            durationMs: u.durationMs,
            calls: u.calls,
            thinkingSavePctVsPersonT0: thinkSave,
            totalSavePctVsPersonT0: totSave,
            semanticDiff: diff,
            verdict,
            geminiInvoked: u.calls > 0,
          });
          writeJson(join(OUT, 'runs', `${p.key}-${phase}-${variant}.json`), {
            packs: ran.dir,
            usage: u,
            diff,
          });
          if (diff === 'CRITICAL_REGRESSION') stop = true;
        }
      }
    }

    const report = {
      status: 'EXPERIMENT_COMPLETE',
      hardCap: HARD_CAP,
      totalCalls,
      t3Unsupported,
      variants: Object.fromEntries(
        Object.entries(VARIANTS).map(([k, v]) => [
          k,
          { label: v.label, thinking: serializeThinkingConfig(v.thinking) },
        ]),
      ),
      cohort: people.map((p) => ({
        key: p.key,
        personId: p.personId,
        snapshotId: p.snapshotId,
        domainHint: p.domainHint,
        p1Batches: p.p1Batches,
      })),
      matrix,
    };
    writeJson(join(OUT, 'experiment-report.json'), report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
