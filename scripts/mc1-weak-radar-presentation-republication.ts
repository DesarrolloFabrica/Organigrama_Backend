/**
 * FASE WEAK_RADAR_PRESENTATION_REPUBLICATION
 *
 * Overlay WEAK sobre PROFILE canónico + lineage. Gemini = 0. No P1–P4.
 *
 *   npx ts-node --transpile-only scripts/mc1-weak-radar-presentation-republication.ts
 *   npx ts-node --transpile-only scripts/mc1-weak-radar-presentation-republication.ts --confirm-import
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import {
  reassembleMc1Presentation,
  loadProfileEnvelope,
} from '../src/mc-pipeline/profile/profile-presentation-reassembly';
import { importMc1PresentationBatch } from '../src/mc-pipeline/person-profile/mc1-person-profile-importer';
import type { Mc1PersonCompetenciesPresentationDto } from '../src/mc-pipeline/person-profile/mc1-person-profile.types';
import type { ProfilePilotEnvelope } from '../src/mc-pipeline/profile/profile.types';
import {
  aggregateGeminiUsage,
  readGeminiLedgerEvents,
  resolveGeminiLedgerPath,
} from '../src/mc-pipeline/gemini';

const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'tmp/mc1-weak-radar-republication');
const CONFIRM = process.argv.includes('--confirm-import');

const PROFILE_ROOTS = [
  join(ROOT, 'tmp/mc1-data-governance-semantic-fix/profile'),
  join(ROOT, 'tmp/mc1-thinking-budget-experiment/profile'),
  join(ROOT, 'tmp/mc1-profile-pilot'),
];

const FUNCTIONAL: Record<'r1' | 'p3' | 'p4', string> = {
  r1: join(ROOT, 'tmp/mc1-r1-functional'),
  p3: join(ROOT, 'tmp/mc1-p3-functional'),
  p4: join(ROOT, 'tmp/mc1-p4-functional'),
};

/** Bindings not yet in person-snapshot-index.json. Snapshot 1 here is Nidia, not person 1. */
const EXTRA_BINDINGS: Array<{ personId: string; snapshotId: string; caseId: string }> = [
  { personId: '52', snapshotId: '20', caseId: 'person-sara' },
  { personId: '49', snapshotId: '21', caseId: 'person-haider' },
  { personId: '1228', snapshotId: '22', caseId: 'person-diego' },
  { personId: '1163', snapshotId: '1', caseId: 'person-nidia' },
];

const CONTROL_KEYS: Record<string, { axis: string; coverage: number; state: string }> = {
  '52': { axis: 'DA_GOVERNANCE_QUALITY', coverage: 48.6, state: 'OBSERVED' },
  '49': { axis: 'DA_GOVERNANCE_QUALITY', coverage: 0, state: 'NO_EVIDENCE' },
  '1228': { axis: 'DA_GOVERNANCE_QUALITY', coverage: 20, state: 'WEAK_EVIDENCE' },
  '1221': { axis: 'AV_EDITING_MONTAGE', coverage: 18.3, state: 'OBSERVED' },
  '1163': { axis: 'VD_EDITORIAL', coverage: 20, state: 'WEAK_EVIDENCE' },
  '1176': { axis: 'VD_MOTION', coverage: 20, state: 'WEAK_EVIDENCE' },
};

type Status =
  | 'READY'
  | 'ALREADY_CURRENT'
  | 'MISSING_PROFILE'
  | 'MISSING_P3'
  | 'MISSING_P4'
  | 'MISSING_R1'
  | 'LINEAGE_MISMATCH'
  | 'STALE_SOURCE'
  | 'INVALID_PROFILE'
  | 'OTHER';

type StoreRow = {
  id: string;
  person_id: string;
  config_fingerprint: string;
  produced_at: string;
  is_active: boolean;
  payload_json: Mc1PersonCompetenciesPresentationDto;
};

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

function cloudDataSource() {
  const env = loadEnv(resolve(ROOT, '.env'));
  return new DataSource({
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
}

function packName(dir: string): string {
  return basename(String(dir || '').replace(/\\/g, '/'));
}

function resolveNamedPack(kind: 'r1' | 'p3' | 'p4', provenancePath?: string | null): string | null {
  if (!provenancePath) return null;
  if (existsSync(provenancePath)) return provenancePath;
  const name = packName(provenancePath);
  if (!name) return null;
  const candidate = join(FUNCTIONAL[kind], name);
  return existsSync(join(candidate, kind === 'r1' ? 'r1-contract.json' : `${kind}-contract.json`))
    ? candidate
    : existsSync(candidate)
      ? candidate
      : null;
}

function ledgerSnapshot() {
  const secrets = loadEnv(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  if (secrets.MC1_GEMINI_LEDGER_PATH && !process.env.MC1_GEMINI_LEDGER_PATH) {
    process.env.MC1_GEMINI_LEDGER_PATH = secrets.MC1_GEMINI_LEDGER_PATH;
  }
  const path = resolveGeminiLedgerPath(ROOT);
  const exists = existsSync(path);
  const st = exists ? statSync(path) : null;
  const events = readGeminiLedgerEvents(ROOT);
  const totals = aggregateGeminiUsage(events);
  return {
    path,
    exists,
    bytes: st?.size ?? 0,
    mtime: st?.mtime?.toISOString() ?? null,
    eventCount: events.length,
    calls: totals.calls,
    totalTokens: totals.totalTokens,
    successfulCalls: totals.successfulCalls,
  };
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

function flattenPackAxes(env: ProfilePilotEnvelope) {
  return env.payload.fields.flatMap((f) =>
    (f.radar?.axes ?? []).map((a) => ({
      field: f.fieldCode,
      code: a.dimensionCode,
      relativeCoverage: a.relativeCoverage,
      evidenceState: a.evidenceState ?? null,
    })),
  );
}

function publicFromPresentation(p: Mc1PersonCompetenciesPresentationDto | null) {
  if (!p) return { specialtyCodes: [] as string[], skillCodes: [] as string[] };
  return {
    specialtyCodes: p.fields.flatMap((f) => f.specialties.map((s) => `${f.code}::${s.code}`)),
    skillCodes: p.fields.flatMap((f) =>
      f.specialties.flatMap((s) => s.skills.map((sk) => `${f.code}::${s.code}::${sk.code}`)),
    ),
  };
}

function publicFromEnvelope(env: ProfilePilotEnvelope) {
  return {
    specialtyCodes: env.payload.fields.flatMap((f) =>
      f.specialties.map((s) => `${f.fieldCode}::${s.specialtyCode}`),
    ),
    skillCodes: env.payload.fields.flatMap((f) =>
      f.skills.map((s) => `${f.fieldCode}::${s.parentSpecialtyCode}::${s.skillCode}`),
    ),
  };
}

function discoverProfilePacks() {
  const packs: Array<{
    packDir: string;
    snapshotId: string;
    producedAt: string;
    producedAtMs: number;
  }> = [];
  function walk(d: string) {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (n === 'profile-contract.json') {
        if (p.includes('profile-variants')) continue;
        try {
          const env = JSON.parse(readFileSync(p, 'utf8')) as ProfilePilotEnvelope;
          if (env.contractCode !== 'MC1.PROFILE.PILOT') continue;
          const snapshotId = String(env.payload?.snapshotId ?? '');
          if (!snapshotId || !env.payload?.fields?.length) continue;
          const producedAt = env.producedAt ?? '';
          packs.push({
            packDir: p.replace(/[\\/]profile-contract\.json$/, ''),
            snapshotId,
            producedAt,
            producedAtMs: Date.parse(producedAt) || 0,
          });
        } catch {
          /* skip */
        }
      }
    }
  }
  for (const r of PROFILE_ROOTS) walk(r);
  packs.sort((a, b) => b.producedAtMs - a.producedAtMs);
  return packs;
}

function loadBindings(): Map<string, { snapshotId: string; caseId: string }> {
  const map = new Map<string, { snapshotId: string; caseId: string }>();
  const indexPath = join(ROOT, 'tmp/mc1-profile-preview/person-snapshot-index.json');
  if (existsSync(indexPath)) {
    const index = JSON.parse(readFileSync(indexPath, 'utf8')) as Record<
      string,
      { snapshotId?: string; caseId?: string }
    >;
    for (const [personId, v] of Object.entries(index)) {
      if (v?.snapshotId) {
        map.set(String(personId), {
          snapshotId: String(v.snapshotId),
          caseId: String(v.caseId ?? `person-${personId}`),
        });
      }
    }
  }
  for (const e of EXTRA_BINDINGS) {
    map.set(e.personId, { snapshotId: e.snapshotId, caseId: e.caseId });
  }
  return map;
}

async function readAllStore(): Promise<StoreRow[]> {
  const cloud = cloudClient();
  await cloud.connect();
  try {
    const rows = await cloud.query(
      `SELECT id::text AS id,
              person_id::text AS person_id,
              config_fingerprint,
              produced_at,
              is_active,
              payload_json
         FROM organigrama.mc1_person_profile_presentation
        ORDER BY person_id, is_active DESC, produced_at DESC`,
    );
    return rows.rows as StoreRow[];
  } finally {
    await cloud.end();
  }
}

type PlanRow = {
  personId: string;
  caseId: string | null;
  sourceProfileId: string | null;
  sourceSnapshot: string | null;
  lineageStatus: Status;
  currentPresentationId: string | null;
  currentProducedAt: string | null;
  currentFingerprint: string | null;
  action: 'IMPORT' | 'NOOP' | 'SKIP';
  changeKind: 'OVERLAY_CHANGE' | 'SOURCE_REPLACEMENT' | 'INSERT' | 'NONE' | 'SKIP';
  axesChanged: number;
  weakAxesAdded: number;
  observedAxesChanged: number;
  publicSpecialtiesChanged: number;
  publicSkillsChanged: number;
  overlaySpecialtyDelta: number;
  overlaySkillDelta: number;
  fingerprint: string | null;
  reason: string;
  requiresGemini: boolean;
  remediation: 'CAN_FIX_WITHOUT_AI' | 'REQUIRES_REPROCESSING' | null;
};

function classifyPerson(args: {
  personId: string;
  binding: { snapshotId: string; caseId: string } | undefined;
  store: StoreRow | null;
  packs: ReturnType<typeof discoverProfilePacks>;
}): PlanRow {
  const base: PlanRow = {
    personId: args.personId,
    caseId: args.binding?.caseId ?? null,
    sourceProfileId: null,
    sourceSnapshot: args.binding?.snapshotId ?? null,
    lineageStatus: 'OTHER',
    currentPresentationId: args.store?.id ?? null,
    currentProducedAt: args.store?.produced_at ?? null,
    currentFingerprint: args.store?.config_fingerprint ?? null,
    action: 'SKIP',
    changeKind: 'SKIP',
    axesChanged: 0,
    weakAxesAdded: 0,
    observedAxesChanged: 0,
    publicSpecialtiesChanged: 0,
    publicSkillsChanged: 0,
    overlaySpecialtyDelta: 0,
    overlaySkillDelta: 0,
    fingerprint: null,
    reason: '',
    requiresGemini: false,
    remediation: null,
  };

  if (!args.binding) {
    return {
      ...base,
      lineageStatus: 'MISSING_PROFILE',
      reason: 'No snapshot binding for person',
      requiresGemini: true,
      remediation: 'REQUIRES_REPROCESSING',
    };
  }

  const candidates = args.packs.filter((p) => p.snapshotId === args.binding!.snapshotId);
  if (!candidates.length) {
    return {
      ...base,
      lineageStatus: 'MISSING_PROFILE',
      reason: `No PROFILE pack for snapshot ${args.binding.snapshotId}`,
      requiresGemini: true,
      remediation: 'REQUIRES_REPROCESSING',
    };
  }

  let lastErr = '';
  for (const cand of candidates) {
    let env: ProfilePilotEnvelope;
    try {
      env = loadProfileEnvelope(cand.packDir);
    } catch (e) {
      lastErr = String(e);
      continue;
    }
    if (!env.payload?.fields?.length) {
      lastErr = 'INVALID_PROFILE empty fields';
      continue;
    }
    const prov = env.payload.provenance;
    const r1 = resolveNamedPack('r1', prov?.r1PackDir);
    const p3 = resolveNamedPack('p3', prov?.p3PackDir);
    const p4 = resolveNamedPack('p4', prov?.p4PackDir);
    if (!p3) {
      lastErr = 'MISSING_P3';
      continue;
    }
    if (!p4) {
      lastErr = 'MISSING_P4';
      continue;
    }
    if (!r1) {
      lastErr = 'MISSING_R1';
      continue;
    }
    try {
      const result = reassembleMc1Presentation({
        backendRoot: ROOT,
        snapshotId: args.binding.snapshotId,
        r1PackDir: r1,
        p3PackDir: p3,
        p4PackDir: p4,
        profilePackDir: cand.packDir,
      });
      const packPub = publicFromEnvelope(env);
      const afterPub = publicFromPresentation(result.presentation);
      const packAxes = flattenPackAxes(env);
      const afterAxes = flattenAxes(result.presentation);
      const observedAxesChanged = afterAxes.filter((a) => {
        const b = packAxes.find((x) => x.field === a.field && x.code === a.code);
        return (b?.relativeCoverage ?? 0) > 0 && b!.relativeCoverage !== a.relativeCoverage;
      }).length;
      const overlaySpecialtyDelta = afterPub.specialtyCodes.filter(
        (c) => !packPub.specialtyCodes.includes(c),
      ).length;
      const overlaySkillDelta = afterPub.skillCodes.filter(
        (c) => !packPub.skillCodes.includes(c),
      ).length;
      const weakAxesAdded = afterAxes.filter((a) => {
        const b = packAxes.find((x) => x.field === a.field && x.code === a.code);
        return (
          (b?.relativeCoverage ?? 0) === 0 &&
          a.relativeCoverage === 20 &&
          a.evidenceState === 'WEAK_EVIDENCE'
        );
      }).length;

      const storeAxes = flattenAxes(args.store?.payload_json ?? null);
      const storePub = publicFromPresentation(args.store?.payload_json ?? null);
      const observedStoreMutations = afterAxes.filter((a) => {
        const b = storeAxes.find((x) => x.field === a.field && x.code === a.code);
        return (b?.relativeCoverage ?? 0) > 0 && b!.relativeCoverage !== a.relativeCoverage;
      }).length;
      const axesChanged = afterAxes.filter((a) => {
        const b = storeAxes.find((x) => x.field === a.field && x.code === a.code);
        return !b || b.relativeCoverage !== a.relativeCoverage || b.evidenceState !== a.evidenceState;
      }).length;

      const already =
        !!args.store &&
        args.store.config_fingerprint === result.fingerprint &&
        axesChanged === 0;

      let changeKind: PlanRow['changeKind'] = 'OVERLAY_CHANGE';
      if (!args.store) changeKind = 'INSERT';
      else if (already) changeKind = 'NONE';
      else if (observedStoreMutations > 0) changeKind = 'SOURCE_REPLACEMENT';

      const publicSpecialtiesChanged = afterPub.specialtyCodes.filter(
        (c) => !storePub.specialtyCodes.includes(c),
      ).length;
      const publicSkillsChanged = afterPub.skillCodes.filter(
        (c) => !storePub.skillCodes.includes(c),
      ).length;

      return {
        ...base,
        sourceProfileId: packName(cand.packDir),
        sourceSnapshot: args.binding.snapshotId,
        lineageStatus: already ? 'ALREADY_CURRENT' : 'READY',
        action: already ? 'NOOP' : 'IMPORT',
        changeKind,
        axesChanged,
        weakAxesAdded,
        observedAxesChanged,
        publicSpecialtiesChanged,
        publicSkillsChanged,
        overlaySpecialtyDelta,
        overlaySkillDelta,
        fingerprint: result.fingerprint,
        reason: already
          ? 'Store already has overlay fingerprint'
          : changeKind === 'SOURCE_REPLACEMENT'
            ? 'Canonical PROFILE differs from Cloud OBSERVED coverages; overlay itself did not mutate pack OBSERVED'
            : changeKind === 'INSERT'
              ? 'No active Cloud presentation'
              : 'WEAK overlay / evidenceState vs current store',
        requiresGemini: false,
        remediation: null,
      };
    } catch (e) {
      lastErr = String(e instanceof Error ? e.message : e).slice(0, 240);
      if (/LINEAGE_|CATALOG_VERSION_MISMATCH|SNAPSHOT_MISMATCH|PROFILE_SNAPSHOT/.test(lastErr)) {
        continue;
      }
      continue;
    }
  }

  const status: Status = lastErr.includes('MISSING_P3')
    ? 'MISSING_P3'
    : lastErr.includes('MISSING_P4')
      ? 'MISSING_P4'
      : lastErr.includes('MISSING_R1')
        ? 'MISSING_R1'
        : /LINEAGE_|CATALOG_VERSION|SNAPSHOT_MISMATCH/.test(lastErr)
          ? 'LINEAGE_MISMATCH'
          : lastErr.includes('INVALID_PROFILE')
            ? 'INVALID_PROFILE'
            : 'LINEAGE_MISMATCH';
  const needsAi = status === 'MISSING_PROFILE' || status === 'INVALID_PROFILE';
  return {
    ...base,
    lineageStatus: status,
    reason: lastErr || 'No lineage-valid PROFILE pack',
    requiresGemini: needsAi,
    remediation: needsAi ? 'REQUIRES_REPROCESSING' : 'CAN_FIX_WITHOUT_AI',
  };
}

function assembleReady(row: PlanRow) {
  const packs = discoverProfilePacks();
  const cand = packs.find((p) => packName(p.packDir) === row.sourceProfileId);
  if (!cand || !row.sourceSnapshot) throw new Error(`READY pack missing for ${row.personId}`);
  const env = loadProfileEnvelope(cand.packDir);
  const r1 = resolveNamedPack('r1', env.payload.provenance?.r1PackDir);
  const p3 = resolveNamedPack('p3', env.payload.provenance?.p3PackDir);
  const p4 = resolveNamedPack('p4', env.payload.provenance?.p4PackDir);
  if (!r1 || !p3 || !p4) throw new Error(`READY lineage dirs missing for ${row.personId}`);
  return reassembleMc1Presentation({
    backendRoot: ROOT,
    snapshotId: row.sourceSnapshot,
    r1PackDir: r1,
    p3PackDir: p3,
    p4PackDir: p4,
    profilePackDir: cand.packDir,
  });
}

async function validateApi(personIds: string[]) {
  const login = await fetch('http://localhost:3000/api/auth/dev-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'desarrollofabrica@cun.edu.co' }),
  });
  const lj = (await login.json()) as { accessToken?: string };
  if (!lj.accessToken) {
    return { ok: false, error: `dev-login ${login.status}` };
  }
  const sample: Array<Record<string, unknown>> = [];
  for (const id of personIds) {
    const r = await fetch(
      `http://localhost:3000/api/org-chart/person/${id}/competencies/professional-profile`,
      { headers: { Authorization: `Bearer ${lj.accessToken}` } },
    );
    const j = (await r.json()) as {
      mc1Profile?: Mc1PersonCompetenciesPresentationDto;
      availabilityStatus?: string;
    };
    const axes = flattenAxes(j.mc1Profile ?? null);
    const expect = CONTROL_KEYS[id];
    const hit = expect ? axes.find((a) => a.code === expect.axis) : null;
    sample.push({
      personId: id,
      http: r.status,
      source: j.mc1Profile?.source ?? null,
      availability: j.availabilityStatus ?? null,
      control: expect
        ? {
            axis: expect.axis,
            expected: expect,
            actual: hit
              ? { coverage: hit.relativeCoverage, state: hit.evidenceState }
              : null,
            pass: !!hit && hit.relativeCoverage === expect.coverage && hit.evidenceState === expect.state,
          }
        : {
            axisCount: axes.length,
            states: [...new Set(axes.map((a) => a.evidenceState))],
          },
    });
  }
  return { ok: true, sample };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const ledgerBefore = ledgerSnapshot();
  const packs = discoverProfilePacks();
  const bindings = loadBindings();
  const storeRows = await readAllStore();
  const active = storeRows.filter((r) => r.is_active);
  const activeByPerson = new Map(active.map((r) => [r.person_id, r]));

  const personIds = new Set<string>([...bindings.keys(), ...active.map((r) => r.person_id)]);
  const plan: PlanRow[] = [...personIds]
    .sort((a, b) => Number(a) - Number(b))
    .map((personId) =>
      classifyPerson({
        personId,
        binding: bindings.get(personId),
        store: activeByPerson.get(personId) ?? null,
        packs,
      }),
    );

  const snapshotsWithPacks = [...new Set(packs.map((p) => p.snapshotId))];
  const boundSnapshots = new Set([...bindings.values()].map((b) => b.snapshotId));
  const unboundSnapshots = snapshotsWithPacks.filter((s) => !boundSnapshots.has(s));

  const census = {
    totalPersonsDiscovered: plan.length,
    byStatus: plan.reduce(
      (acc, r) => {
        acc[r.lineageStatus] = (acc[r.lineageStatus] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    ready: plan.filter((p) => p.lineageStatus === 'READY').length,
    alreadyCurrent: plan.filter((p) => p.lineageStatus === 'ALREADY_CURRENT').length,
    skipped: plan.filter((p) => p.action === 'SKIP').length,
    unboundProfileSnapshots: unboundSnapshots,
    gemini: { calls: 0, tokens: 0 },
    ledgerBefore,
  };
  writeFileSync(join(OUT, 'census.json'), JSON.stringify({ census, persons: plan }, null, 2));

  const overlayObservedMutations = plan.reduce((n, p) => n + p.observedAxesChanged, 0);
  const overlaySpecMutations = plan.reduce((n, p) => n + p.overlaySpecialtyDelta, 0);
  const overlaySkillMutations = plan.reduce((n, p) => n + p.overlaySkillDelta, 0);
  const blocked =
    overlayObservedMutations > 0 ||
    overlaySpecMutations > 0 ||
    overlaySkillMutations > 0 ||
    plan.some((p) => p.lineageStatus === 'READY' && p.action === 'IMPORT' && !p.sourceProfileId);

  const dryRunSummary = {
    personsDiscovered: census.totalPersonsDiscovered,
    READY: census.ready,
    ALREADY_CURRENT: census.alreadyCurrent,
    SKIPPED: census.skipped,
    presentationsChanging: plan.filter((p) => p.action === 'IMPORT').length,
    weakAxes0to20: plan.reduce((n, p) => n + p.weakAxesAdded, 0),
    sourceReplacements: plan.filter((p) => p.changeKind === 'SOURCE_REPLACEMENT').length,
    observedAxesMutatedByOverlay: overlayObservedMutations,
    publicSpecialtiesMutatedByOverlay: overlaySpecMutations,
    publicSkillsMutatedByOverlay: overlaySkillMutations,
    blocked,
  };

  writeFileSync(
    join(OUT, 'republication-plan.json'),
    JSON.stringify({ summary: dryRunSummary, plan }, null, 2),
  );

  const skipped = plan
    .filter((p) => p.action === 'SKIP')
    .map((p) => ({
      personId: p.personId,
      reason: p.reason,
      missingArtifact: p.lineageStatus,
      expectedRemediation: p.remediation,
      requiresGemini: p.requiresGemini,
    }));
  writeFileSync(join(OUT, 'skipped.json'), JSON.stringify(skipped, null, 2));

  writeFileSync(
    join(OUT, 'before-store.json'),
    JSON.stringify(
      active.map((r) => ({
        personId: r.person_id,
        id: r.id,
        fingerprint: r.config_fingerprint,
        producedAt: r.produced_at,
        isActive: r.is_active,
      })),
      null,
      2,
    ),
  );

  const out: Record<string, unknown> = {
    status: blocked ? 'REPUBLICATION_BLOCKED' : CONFIRM ? 'IMPORTING' : 'DRY_RUN',
    census,
    dryRun: dryRunSummary,
    gemini: { calls: 0, tokens: 0 },
  };

  if (blocked) {
    writeFileSync(join(OUT, 'import-report.json'), JSON.stringify({ skipped: true, blocked: true }, null, 2));
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (!CONFIRM) {
    writeFileSync(join(OUT, 'import-report.json'), JSON.stringify({ skipped: true }, null, 2));
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  const ready = plan.filter((p) => p.action === 'IMPORT');
  const records = ready.map((row) => {
    const assembled = assembleReady(row);
    return {
      personId: row.personId,
      configFingerprint: assembled.fingerprint,
      producedAt: assembled.producedAt,
      payload: assembled.presentation,
    };
  });

  const ds = cloudDataSource();
  await ds.initialize();
  let importResult;
  try {
    importResult = await importMc1PresentationBatch(ds, records);
  } finally {
    await ds.destroy();
  }
  writeFileSync(join(OUT, 'import-report.json'), JSON.stringify(importResult, null, 2));

  const ds2 = cloudDataSource();
  await ds2.initialize();
  let second;
  try {
    second = await importMc1PresentationBatch(ds2, records);
  } finally {
    await ds2.destroy();
  }
  const idempotent =
    second.inserted === 0 &&
    second.updated === 0 &&
    second.rejected === 0 &&
    second.unchanged === records.length;
  writeFileSync(
    join(OUT, 'idempotency-report.json'),
    JSON.stringify({ second, written: second.inserted + second.updated, verdict: idempotent ? 'PASS' : 'FAIL' }, null, 2),
  );

  const storeAfter = await readAllStore();
  const activeAfter = storeAfter.filter((r) => r.is_active);
  const controls: Record<string, unknown> = {};
  for (const [personId, expect] of Object.entries(CONTROL_KEYS)) {
    const row = activeAfter.find((r) => r.person_id === personId);
    const axes = flattenAxes(row?.payload_json ?? null);
    const hit = axes.find((a) => a.code === expect.axis);
    controls[personId] = {
      expected: expect,
      actual: hit
        ? { coverage: hit.relativeCoverage, state: hit.evidenceState }
        : null,
      pass: !!hit && hit.relativeCoverage === expect.coverage && hit.evidenceState === expect.state,
      source: row?.payload_json?.source ?? null,
    };
  }

  const extraDomain = ['1', '2', '5', '1172', '1212'].map((id) => {
    const row = activeAfter.find((r) => r.person_id === id);
    const axes = flattenAxes(row?.payload_json ?? null);
    return {
      personId: id,
      hasStore: !!row,
      states: [...new Set(axes.map((a) => a.evidenceState))],
      weakCount: axes.filter((a) => a.evidenceState === 'WEAK_EVIDENCE').length,
      observedBelow20: axes.filter(
        (a) => a.evidenceState === 'OBSERVED' && a.relativeCoverage > 0 && a.relativeCoverage < 20,
      ),
    };
  });

  const apiIds = [...Object.keys(CONTROL_KEYS), ...ready.map((r) => r.personId).filter((id) => !CONTROL_KEYS[id])].slice(0, 10);
  const api = await validateApi([...new Set(apiIds)]);
  const ledgerAfter = ledgerSnapshot();

  const validation = {
    controls,
    extraDomain,
    api,
    ledger: {
      before: ledgerBefore,
      after: ledgerAfter,
      callsDelta: ledgerAfter.calls - ledgerBefore.calls,
      tokensDelta: (ledgerAfter.totalTokens ?? 0) - (ledgerBefore.totalTokens ?? 0),
    },
    frontend: {
      note: 'Contract already distinguishes NO_EVIDENCE / WEAK (amber) / OBSERVED; sample via API states.',
    },
  };
  writeFileSync(join(OUT, 'validation-report.json'), JSON.stringify(validation, null, 2));

  out.status = idempotent ? 'IMPORTED' : 'IMPORTED_IDEMPOTENCY_FAIL';
  out.import = {
    personsAttempted: records.length,
    inserted: importResult.inserted,
    updated: importResult.updated,
    unchanged: importResult.unchanged,
    rejected: importResult.rejected,
    failed: importResult.rejected,
    rowsDeactivated: importResult.updated,
  };
  out.idempotency = { secondWrites: second.inserted + second.updated, verdict: idempotent ? 'PASS' : 'FAIL' };
  out.ledgerDelta = validation.ledger;
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error('REPUBLICATION_FAIL', String(e?.stack || e).slice(0, 4000));
  process.exit(1);
});
