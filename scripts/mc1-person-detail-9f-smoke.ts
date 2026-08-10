/**
 * FASE 9F — smoke validation of local MC1 reader for software cohort.
 *   npx ts-node --transpile-only scripts/mc1-person-detail-9f-smoke.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { readMc1PersonProfile } from '../src/mc-pipeline/person-profile';

const ROOT = resolve(__dirname, '..');
const COHORT = [
  { caseId: 'person-camilo', personId: '1' },
  { caseId: 'person-johan', personId: '2' },
  { caseId: 'person-zuany', personId: '3' },
  { caseId: 'person-jose', personId: '4' },
  { caseId: 'person-alejandro', personId: '5' },
  { caseId: 'person-unknown', personId: '99' },
];

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
    for (const c of COHORT) {
      const r = await readMc1PersonProfile({
        personId: c.personId,
        dataSource: ds,
        backendRoot: ROOT,
      });
      if (r.status !== 'AVAILABLE') {
        rows.push({ caseId: c.caseId, personId: c.personId, status: r.status });
        continue;
      }
      rows.push({
        caseId: c.caseId,
        personId: c.personId,
        status: r.status,
        fields: r.presentation.fields.map((f) => ({
          code: f.code,
          role: f.role,
          specs: f.specialties.map((s) => s.code),
          skillCount: f.specialties.reduce((n, s) => n + s.skills.length, 0),
          toolCount: f.tools.length,
          dominant:
            [...f.competencyMap.dimensions].sort(
              (a, b) => b.relativeCoverage - a.relativeCoverage,
            )[0]?.label ?? null,
        })),
      });
    }
  } finally {
    await ds.destroy();
  }
  console.log(JSON.stringify({ phase: '9F-smoke', rows }, null, 2));
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
