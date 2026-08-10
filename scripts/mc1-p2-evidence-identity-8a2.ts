/**
 * FASE 8A.2 — Validación local de identidad canónica (sin Gemini).
 * npx ts-node --transpile-only scripts/mc1-p2-evidence-identity-8a2.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import {
  assertStableCanonicalIds,
  loadP2EvidenceFromP1Pack,
} from '../src/mc-pipeline/p2/p2-evidence-loader';

const ROOT = resolve(__dirname, '..');

function loadEnvFile(path: string) {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    out[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }
  return out;
}

async function main() {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const mde = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  assertMdeTarget({
    host: mde.MDE_DB_HOST,
    port: Number(mde.MDE_DB_PORT),
    database: mde.MDE_DB_NAME,
  });

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

  const rows: unknown[] = [];
  try {
    for (const snapshotId of ['1', '2']) {
      const a = await loadP2EvidenceFromP1Pack({
        backendRoot: ROOT,
        snapshotId,
        dataSource: ds,
      });
      const b = await loadP2EvidenceFromP1Pack({
        backendRoot: ROOT,
        snapshotId,
        dataSource: ds,
      });
      assertStableCanonicalIds(a.units, b.units);
      const ids = a.units.map((u) => u.evidenceUnitId);
      const originals = a.units.map((u) => u.originalEvidenceUnitId);
      rows.push({
        snapshotId,
        units: a.units.length,
        uniqueCanonicalIds: new Set(ids).size,
        uniqueOriginalIds: new Set(originals).size,
        reloadStable: true,
        sampleCanonicalId: ids[0] ?? null,
        p1ArtifactDigest: a.p1ArtifactDigest,
      });
    }
  } finally {
    await ds.destroy();
  }

  console.log(
    JSON.stringify(
      { phase: '8A.2', check: 'EVIDENCE_IDENTITY', status: 'OK', rows },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      status: 'FAILED',
      error: String(e instanceof Error ? e.message : e).slice(0, 400),
      details: e instanceof Error && 'details' in e ? (e as { details: unknown }).details : undefined,
    }),
  );
  process.exit(1);
});
