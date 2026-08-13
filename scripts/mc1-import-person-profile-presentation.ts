/**
 * Importa presentaciones MC1 precomputadas a organigrama.mc1_person_profile_presentation.
 *
 *   npx ts-node --transpile-only scripts/mc1-import-person-profile-presentation.ts --file=path/to/batch.json --confirm
 *
 * batch.json:
 * {
 *   "configFingerprint": "optional-default",
 *   "profiles": [
 *     {
 *       "personId": "1163",
 *       "configFingerprint": "7f8451bd6269f6fc",
 *       "producedAt": "2026-08-11T18:00:00.000Z",
 *       "payload": { "status": "AVAILABLE", "source": "...", "fields": [ ... ] }
 *     }
 *   ]
 * }
 *
 * También acepta un array JSON de profiles.
 * Usa DB_* de .env (Cloud) por defecto. --mde para MDE local.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import {
  importMc1PresentationBatch,
  type Mc1PresentationImportRecord,
} from '../src/mc-pipeline/person-profile/mc1-person-profile-importer';

const ROOT = resolve(__dirname, '..');

function loadEnvFile(path: string) {
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

function parseArgs(argv: string[]) {
  const file = argv.find((a) => a.startsWith('--file='))?.split('=')[1];
  return {
    file,
    confirm: argv.includes('--confirm'),
    mde: argv.includes('--mde'),
    atomic: argv.includes('--atomic'),
  };
}

function normalizeRecords(
  raw: unknown,
  defaultFingerprint?: string,
): Mc1PresentationImportRecord[] {
  let list: unknown[] = [];
  let batchFp = defaultFingerprint;
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (typeof o.configFingerprint === 'string') {
      batchFp = o.configFingerprint;
    }
    if (Array.isArray(o.profiles)) list = o.profiles;
    else if (Array.isArray(o.items)) list = o.items;
    else {
      throw new Error('BATCH_SHAPE_INVALID');
    }
  } else {
    throw new Error('BATCH_NOT_OBJECT_OR_ARRAY');
  }

  return list.map((item, idx) => {
    if (item == null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`ITEM_${idx}_NOT_OBJECT`);
    }
    const r = item as Record<string, unknown>;
    const personId = r.personId ?? r.person_id;
    const payload = r.payload ?? r.presentation ?? r.mc1Profile ?? r;
    const fp =
      (typeof r.configFingerprint === 'string' && r.configFingerprint) ||
      (typeof r.config_fingerprint === 'string' && r.config_fingerprint) ||
      batchFp;
    return {
      personId: personId as string | number,
      payload,
      configFingerprint: String(fp ?? ''),
      producedAt:
        typeof r.producedAt === 'string'
          ? r.producedAt
          : typeof r.produced_at === 'string'
            ? r.produced_at
            : undefined,
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.confirm) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        hint: '--confirm required',
      }),
    );
    process.exit(2);
  }
  if (!args.file) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'FILE_REQUIRED',
        hint: '--file=path/to/batch.json',
      }),
    );
    process.exit(2);
  }

  const filePath = resolve(ROOT, args.file);
  if (!existsSync(filePath)) {
    console.log(
      JSON.stringify({ status: 'BLOCKED', reason: 'FILE_NOT_FOUND', filePath }),
    );
    process.exit(2);
  }

  const records = normalizeRecords(JSON.parse(readFileSync(filePath, 'utf8')));

  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }

  let ds: DataSource;
  if (args.mde) {
    const mde = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
    ds = new DataSource({
      type: 'postgres',
      host: mde.MDE_DB_HOST,
      port: Number(mde.MDE_DB_PORT),
      username: mde.MDE_DB_USERNAME,
      password: mde.MDE_DB_PASSWORD,
      database: mde.MDE_DB_NAME,
      synchronize: false,
      logging: false,
    });
  } else {
    const env = loadEnvFile(resolve(ROOT, '.env'));
    ds = new DataSource({
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

  await ds.initialize();
  try {
    const result = await importMc1PresentationBatch(ds, records, {
      atomicBatch: args.atomic,
    });
    console.log(
      JSON.stringify(
        {
          status: 'DONE',
          target: args.mde ? 'MDE' : 'CLOUD_ENV',
          file: filePath,
          ...result,
        },
        null,
        2,
      ),
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      status: 'FAILED',
      error: String(e instanceof Error ? e.message : e).slice(0, 400),
    }),
  );
  process.exit(1);
});
