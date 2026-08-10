/**
 * FASE 8E — Complete MC1 Profile Pilot (ARTIFACT_ONLY assembly).
 *
 *   npx ts-node --transpile-only scripts/mc1-profile-pilot-8e.ts --snapshots=1,2
 *
 * Opcional --with-mde para boost de explicitness desde Evidence Units.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { runProfilePilot } from '../src/mc-pipeline/profile/profile-runner';

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

function parseArgs(argv: string[]) {
  const one = argv.find((a) => a.startsWith('--snapshot='))?.split('=')[1];
  const many = argv.find((a) => a.startsWith('--snapshots='))?.split('=')[1];
  const snapshots = (many ?? one ?? '1,2')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    snapshots,
    withMde: argv.includes('--with-mde'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let ds: DataSource | undefined;

  if (args.withMde) {
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
    }
    const mde = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
    assertMdeTarget({
      host: mde.MDE_DB_HOST,
      port: Number(mde.MDE_DB_PORT),
      database: mde.MDE_DB_NAME,
    });
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
    await ds.initialize();
  }

  const results: unknown[] = [];
  try {
    for (const snapshotId of args.snapshots) {
      const run = await runProfilePilot({
        backendRoot: ROOT,
        snapshotId,
        outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
        dataSource: ds,
      });
      const p = run.envelope.payload;
      results.push({
        snapshotId,
        outDir: run.outDir,
        r1Status: p.r1FieldResolutionStatus,
        fields: p.fields.map((f) => ({
          fieldCode: f.fieldCode,
          role: f.role,
          specialties: f.specialties,
          skills: f.skills.map((s) => ({
            code: s.skillCode,
            name: s.name,
            specialty: s.parentSpecialtyCode,
            support: s.supportingEvidenceUnitIds.length,
          })),
          tools: f.toolsTechnologies,
          evidenceVolume: f.evidenceVolume,
          evidenceUnitCount: f.evidenceUnitCount,
          radar: f.radar.axes.map((a) => ({
            dimension: a.dimensionCode,
            label: a.label,
            rawScore: a.rawScore,
            relativeCoverage: a.relativeCoverage,
          })),
          mappings: f.skillDimensionMappings.map((m) => ({
            skill: m.skillCode,
            dims: m.dimensionCodes,
            justification: m.mappingJustification,
          })),
        })),
        formulaVersion: p.presentationNotes.formulaVersion,
        provenance: p.provenance,
      });
    }
  } finally {
    if (ds?.isInitialized) await ds.destroy();
  }

  console.log(
    JSON.stringify(
      { phase: '8E', mode: 'ARTIFACT_ONLY', status: 'DONE', results },
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
    }),
  );
  process.exit(1);
});
