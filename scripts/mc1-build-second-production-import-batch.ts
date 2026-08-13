/**
 * Segundo batch MC1 → Cloud presentation store.
 * Descubre perfiles AVAILABLE desde artefactos locales; clasifica SAFE vs HOLD.
 *
 *   npx ts-node --transpile-only scripts/mc1-build-second-production-import-batch.ts
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { readMc1PersonProfile } from '../src/mc-pipeline/person-profile';
import {
  MC1_PRESENTATION_STORE_SOURCE,
  validateMc1PresentationPayload,
} from '../src/mc-pipeline/person-profile/mc1-person-profile-store';

const ROOT = resolve(__dirname, '..');
const TMP = resolve(ROOT, 'tmp');
const TS = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
const OUT = resolve(TMP, `mc1-presentation-import-batch-${TS}.json`);
const PLAN = resolve(TMP, 'mc1-second-production-slice', 'import-batch-plan.json');

/** Ya en Cloud desde primer slice (2026-08-11). */
const ALREADY_IN_CLOUD = new Set([
  '1', '2', '3', '4', '5', '49', '52', '1207', '1210', '1211', '1217',
  '1305', '1307', '1308', '1309',
]);

type Discovered = {
  personId: string;
  label: string;
  cohort: string;
  personDecision?: string;
  configFingerprint?: string;
};

function loadEnvFile(path: string) {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function discoverPersonArtifacts(): Discovered[] {
  const byId = new Map<string, Discovered>();
  if (!existsSync(TMP)) return [];

  for (const entry of readdirSync(TMP)) {
    if (!entry.startsWith('mc1-') || entry === 'mc1-profile-preview') continue;
    const dir = join(TMP, entry);
    if (!statSync(dir).isDirectory()) continue;

    for (const file of readdirSync(dir)) {
      const m = /^person-(\d+)\.json$/.exec(file);
      if (!m) continue;
      const personId = m[1];
      try {
        const j = JSON.parse(readFileSync(join(dir, file), 'utf8'));
        const existing = byId.get(personId);
        const fp = j.configFingerprint ?? existing?.configFingerprint;
        byId.set(personId, {
          personId,
          label: j.label ?? existing?.label ?? personId,
          cohort: entry,
          personDecision: j.personDecision ?? j.mc1ProfileFinalStatus?.personDecision ?? existing?.personDecision,
          configFingerprint: fp,
        });
      } catch {
        /* skip malformed */
      }
    }
  }
  return [...byId.values()].sort((a, b) => Number(a.personId) - Number(b.personId));
}

function hasWeakPublic(fields: unknown[]): boolean {
  return JSON.stringify(fields).includes('"status":"WEAK"');
}

function classifyHoldReason(
  personDecision: string | undefined,
  fields: Array<{ role: string; specialties: unknown[]; tools: unknown[] }>,
): string | null {
  const primaryFields = fields.filter((f) => f.role === 'PRIMARY');
  const publishablePrimary = primaryFields.filter(
    (f) => f.specialties.length > 0 || f.tools.length > 0,
  );

  if (/PRIMARY_TAXONOMY_PENDING/i.test(personDecision ?? '')) {
    if (publishablePrimary.length === 0) {
      return 'HOLD_FOR_TAXONOMY:PRIMARY_TAXONOMY_PENDING_NO_PUBLISHABLE_PRIMARY';
    }
  }

  const emptyPrimary = primaryFields.some(
    (f) => f.specialties.length === 0 && f.tools.length === 0,
  );
  if (emptyPrimary && primaryFields.length > 0) {
    return 'HOLD_FOR_TAXONOMY:EMPTY_PRIMARY_TAB';
  }

  if (fields.length === 0) {
    return 'HOLD_FOR_TAXONOMY:NO_PUBLISHABLE_FIELDS';
  }

  return null;
}

async function main() {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  process.env.NODE_ENV = 'development';
  process.env.MC1_ALLOW_ARTIFACT_LOCAL = 'true';

  const mdeEnv = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const mde = {
    host: mdeEnv.MDE_DB_HOST,
    port: Number(mdeEnv.MDE_DB_PORT),
    database: mdeEnv.MDE_DB_NAME,
    username: mdeEnv.MDE_DB_USERNAME,
    password: mdeEnv.MDE_DB_PASSWORD,
  };
  assertMdeTarget(mde);

  const discovered = discoverPersonArtifacts();
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

  const safeToImport: Array<Record<string, unknown>> = [];
  const held: Array<Record<string, unknown>> = [];
  const excluded: Array<Record<string, unknown>> = [];
  const alreadyInCloud: Array<Record<string, unknown>> = [];

  try {
    for (const d of discovered) {
      const read = await readMc1PersonProfile({
        personId: d.personId,
        dataSource: ds,
        backendRoot: ROOT,
        allowArtifactLocal: true,
      });

      if (read.status !== 'AVAILABLE') {
        excluded.push({
          personId: d.personId,
          label: d.label,
          cohort: d.cohort,
          personDecision: d.personDecision,
          reason: `READER_${read.status}${read.status === 'INVALID' ? `:${(read as { reason?: string }).reason}` : ''}`,
        });
        continue;
      }

      const payload = {
        ...read.presentation,
        source: MC1_PRESENTATION_STORE_SOURCE,
      };
      const validated = validateMc1PresentationPayload(payload);
      if (!validated.ok) {
        excluded.push({
          personId: d.personId,
          label: d.label,
          cohort: d.cohort,
          reason: `VALIDATION_${validated.reason}`,
        });
        continue;
      }

      const fields = validated.presentation.fields;
      if (hasWeakPublic(fields)) {
        excluded.push({
          personId: d.personId,
          label: d.label,
          cohort: d.cohort,
          reason: 'WEAK_SPECIALTY_PUBLIC',
        });
        continue;
      }

      const holdReason = classifyHoldReason(d.personDecision, fields);
      if (holdReason) {
        held.push({
          personId: d.personId,
          label: d.label,
          cohort: d.cohort,
          personDecision: d.personDecision,
          reason: holdReason,
          fieldCodes: fields.map((f) => f.code),
        });
        continue;
      }

      const record = {
        personId: d.personId,
        label: d.label,
        cohort: d.cohort,
        personDecision: d.personDecision,
        configFingerprint: d.configFingerprint ?? 'unknown',
        producedAt: new Date().toISOString(),
        payload: validated.presentation,
        fieldCodes: fields.map((f) => f.code),
        primaryField: fields.find((f) => f.role === 'PRIMARY')?.code ?? null,
        specialtyCount: fields.reduce((n, f) => n + f.specialties.length, 0),
        skillCount: fields.reduce(
          (n, f) => n + f.specialties.reduce((m, s) => m + s.skills.length, 0),
          0,
        ),
        alreadyInCloud: ALREADY_IN_CLOUD.has(d.personId),
      };

      if (ALREADY_IN_CLOUD.has(d.personId)) {
        alreadyInCloud.push(record);
      }

      safeToImport.push(record);
    }
  } finally {
    await ds.destroy();
  }

  const newProfiles = safeToImport.filter((p) => !ALREADY_IN_CLOUD.has(String(p.personId)));

  const batch = {
    phase: 'MC1_SECOND_PRODUCTION_SLICE',
    cloudWritesPending: true,
    builtAt: new Date().toISOString(),
    configFingerprintNote: 'Per-profile fingerprints from cohort artifacts',
    summary: {
      discovered: discovered.length,
      safeToImport: safeToImport.length,
      newProfiles: newProfiles.length,
      alreadyInCloudEligible: alreadyInCloud.length,
      held: held.length,
      excluded: excluded.length,
    },
    profiles: safeToImport.map((p) => ({
      personId: p.personId,
      configFingerprint: p.configFingerprint,
      producedAt: p.producedAt,
      payload: p.payload,
    })),
  };

  mkdirSync(resolve(TMP, 'mc1-second-production-slice'), { recursive: true });
  writeFileSync(OUT, JSON.stringify(batch, null, 2), 'utf8');
  writeFileSync(
    PLAN,
    JSON.stringify(
      {
        batchPath: OUT,
        summary: batch.summary,
        safeToImport: safeToImport.map((p) => ({
          personId: p.personId,
          label: p.label,
          cohort: p.cohort,
          personDecision: p.personDecision,
          primaryField: p.primaryField,
          fieldCodes: p.fieldCodes,
          specialtyCount: p.specialtyCount,
          skillCount: p.skillCount,
          alreadyInCloud: p.alreadyInCloud,
        })),
        held,
        excluded,
        note: 'Import only SAFE_TO_IMPORT. Held = taxonomy pending without publishable primary.',
      },
      null,
      2,
    ),
    'utf8',
  );

  // Also write canonical path for importer
  writeFileSync(resolve(TMP, 'mc1-presentation-import-batch.json'), JSON.stringify(batch, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        status: 'BATCH_READY',
        batchPath: OUT,
        planPath: PLAN,
        ...batch.summary,
        newPersonIds: newProfiles.map((p) => p.personId),
        heldPersonIds: held.map((p) => p.personId),
        excludedCount: excluded.length,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error('BATCH_BUILD_FAIL', String(e?.stack || e).slice(0, 800));
  process.exit(1);
});
