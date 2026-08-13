/**
 * Construye tmp/mc1-presentation-import-batch.json desde perfiles locales AVAILABLE.
 * No escribe Cloud. Solo MDE + artefactos.
 *
 *   npx ts-node --transpile-only scripts/mc1-build-haider-branch-import-batch.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { readMc1PersonProfile } from '../src/mc-pipeline/person-profile';
import {
  MC1_PRESENTATION_STORE_SOURCE,
  validateMc1PresentationPayload,
} from '../src/mc-pipeline/person-profile/mc1-person-profile-store';

const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'tmp', 'mc1-presentation-import-batch.json');
const META = resolve(ROOT, 'tmp', 'mc1-haider-profile', 'import-batch-plan.json');

/** Primera rama Haider: completos + drift no bloqueante. Excluye taxonomy-blocked (Felipe). */
const CANDIDATES: Array<{
  personId: string;
  label: string;
  line: 'HAIDER' | 'SARA' | 'JOHAN' | 'FELIPE';
  configFingerprint: string;
  excludeReason?: string;
}> = [
  {
    personId: '49',
    label: 'Haider Yesid Bello Melo',
    line: 'HAIDER',
    configFingerprint: '1603c1a450c9174d',
  },
  {
    personId: '52',
    label: 'Sara Juliana Martinez Lopez',
    line: 'SARA',
    configFingerprint: 'c4c188838d15e4b6',
  },
  {
    personId: '1207',
    label: 'Diana Marcela Vargas Camargo',
    line: 'SARA',
    configFingerprint: 'c4c188838d15e4b6',
  },
  {
    personId: '1210',
    label: 'Maria Angelica Cruz Guerrero',
    line: 'SARA',
    configFingerprint: 'c4c188838d15e4b6',
  },
  {
    personId: '1211',
    label: 'Sandra Carolina Molano Castro',
    line: 'SARA',
    configFingerprint: 'c4c188838d15e4b6',
  },
  {
    personId: '1217',
    label: 'Jhonatan David Marquez Betancur',
    line: 'SARA',
    configFingerprint: 'c4c188838d15e4b6',
  },
  {
    personId: '2',
    label: 'Johan Sebastian Daza Sarmiento',
    line: 'JOHAN',
    configFingerprint: 'software-cohort-9e',
  },
  {
    personId: '1',
    label: 'Camilo Andres Quintero Vargas',
    line: 'JOHAN',
    configFingerprint: 'software-cohort-9e',
  },
  {
    personId: '3',
    label: 'Zuany Alejandro Acuna Velez',
    line: 'JOHAN',
    configFingerprint: 'software-cohort-9e',
  },
  {
    personId: '4',
    label: 'Jose Alejandro Camacho Cobos',
    line: 'JOHAN',
    configFingerprint: 'software-cohort-9e',
  },
  {
    personId: '5',
    label: 'Alejandro Castro Sanchez',
    line: 'JOHAN',
    configFingerprint: 'software-cohort-9e',
  },
  {
    personId: '1303',
    label: 'Felipe Guerrero Buenaventura',
    line: 'FELIPE',
    configFingerprint: '8d8de178be41c279',
    excludeReason: 'TAXONOMY_BLOCKED_PRIMARY_TAXONOMY_PENDING',
  },
  {
    personId: '1305',
    label: 'Victor Daniel Rodriguez Hurtado',
    line: 'FELIPE',
    configFingerprint: '8d8de178be41c279',
  },
  {
    personId: '1306',
    label: 'Paula Gonzalez Cabezas',
    line: 'FELIPE',
    configFingerprint: '8d8de178be41c279',
  },
  {
    personId: '1307',
    label: 'Natalia Tinjaca Gamba',
    line: 'FELIPE',
    configFingerprint: '8d8de178be41c279',
  },
  {
    personId: '1308',
    label: 'Nicolas Martinez Pena',
    line: 'FELIPE',
    configFingerprint: '8d8de178be41c279',
  },
  {
    personId: '1309',
    label: 'Christian Garzon Ortiz',
    line: 'FELIPE',
    configFingerprint: '8d8de178be41c279',
  },
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

function tryBetterFingerprint(personId: string, fallback: string): string {
  const paths = [
    resolve(ROOT, 'tmp', 'mc1-haider-profile', 'phase-verdict.json'),
    resolve(ROOT, 'tmp', 'mc1-sara-data-analytics-complete', 'phase-verdict.json'),
    resolve(
      ROOT,
      'tmp',
      'mc1-diana-digital-marketing-complete',
      'phase-verdict.json',
    ),
    resolve(ROOT, 'tmp', 'mc1-sara-children-live', 'cohort-report.json'),
    resolve(ROOT, 'tmp', 'mc1-felipe-team-cohort', 'cohort-report.json'),
    resolve(ROOT, 'tmp', 'mc1-software-cohort-9e', 'cohort-report.json'),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const j = JSON.parse(readFileSync(p, 'utf8'));
      if (Array.isArray(j.results)) {
        const hit = j.results.find(
          (r: { personId?: string }) => String(r.personId) === personId,
        );
        if (hit?.configFingerprint) return String(hit.configFingerprint);
        // cohort-level fingerprint only if person is in results
        if (hit && j.configFingerprint) return String(j.configFingerprint);
        continue;
      }
      if (j.configFingerprint && String(j.personId) === personId) {
        return String(j.configFingerprint);
      }
    } catch {
      /* ignore */
    }
  }
  return fallback;
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

  const included: Array<Record<string, unknown>> = [];
  const skipped: Array<Record<string, unknown>> = [];

  try {
    for (const c of CANDIDATES) {
      if (c.excludeReason) {
        skipped.push({
          personId: c.personId,
          label: c.label,
          reason: c.excludeReason,
        });
        continue;
      }

      const read = await readMc1PersonProfile({
        personId: c.personId,
        dataSource: ds,
        backendRoot: ROOT,
        allowArtifactLocal: true,
      });

      if (read.status !== 'AVAILABLE') {
        skipped.push({
          personId: c.personId,
          label: c.label,
          reason: `READER_${read.status}${
            read.status === 'INVALID' ? `:${read.reason}` : ''
          }`,
        });
        continue;
      }

      const payload = {
        ...read.presentation,
        source: MC1_PRESENTATION_STORE_SOURCE,
      };
      const validated = validateMc1PresentationPayload(payload);
      if (!validated.ok) {
        skipped.push({
          personId: c.personId,
          label: c.label,
          reason: `VALIDATION_${validated.reason}`,
        });
        continue;
      }

      // No importar tabs vacíos / taxonomy pending en payload
      const hasTaxonomyPending = validated.presentation.fields.some((f) =>
        /TAXONOMY_PENDING/i.test(String((f as { label?: string }).label ?? '')),
      );
      if (hasTaxonomyPending) {
        skipped.push({
          personId: c.personId,
          label: c.label,
          reason: 'TAXONOMY_PENDING_IN_PAYLOAD',
        });
        continue;
      }

      const emptyPrimary = validated.presentation.fields.some(
        (f) =>
          f.role === 'PRIMARY' &&
          f.specialties.length === 0 &&
          f.tools.length === 0,
      );
      if (emptyPrimary) {
        skipped.push({
          personId: c.personId,
          label: c.label,
          reason: 'EMPTY_PRIMARY_TAB',
        });
        continue;
      }

      const fp = tryBetterFingerprint(c.personId, c.configFingerprint);
      included.push({
        personId: c.personId,
        label: c.label,
        line: c.line,
        configFingerprint: fp,
        producedAt: new Date().toISOString(),
        payload: validated.presentation,
        fieldCodes: validated.presentation.fields.map((f) => f.code),
        specialtyCount: validated.presentation.fields.reduce(
          (n, f) => n + f.specialties.length,
          0,
        ),
        skillCount: validated.presentation.fields.reduce(
          (n, f) =>
            n + f.specialties.reduce((m, s) => m + s.skills.length, 0),
          0,
        ),
      });
    }
  } finally {
    await ds.destroy();
  }

  const batch = {
    phase: 'MC1_FIRST_PRODUCTION_SLICE_HAIDER_BRANCH',
    cloudWritesPending: true,
    configFingerprintNote:
      'Per-profile fingerprints from cohort/phase verdicts; payload source forced to CLOUD_PRESENTATION_STORE',
    profiles: included.map((p) => ({
      personId: p.personId,
      configFingerprint: p.configFingerprint,
      producedAt: p.producedAt,
      payload: p.payload,
    })),
  };

  mkdirSync(resolve(ROOT, 'tmp'), { recursive: true });
  mkdirSync(resolve(ROOT, 'tmp', 'mc1-haider-profile'), { recursive: true });
  writeFileSync(OUT, JSON.stringify(batch, null, 2), 'utf8');
  writeFileSync(
    META,
    JSON.stringify(
      {
        profilesToImport: included.length,
        skippedCount: skipped.length,
        included: included.map((p) => ({
          personId: p.personId,
          label: p.label,
          line: p.line,
          fieldCodes: p.fieldCodes,
          specialtyCount: p.specialtyCount,
          skillCount: p.skillCount,
          configFingerprint: p.configFingerprint,
        })),
        skipped,
        batchPath: OUT,
        note: 'Report count BEFORE any Cloud write',
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(
    JSON.stringify(
      {
        status: 'BATCH_READY',
        profilesToImport: included.length,
        skipped: skipped.length,
        includedPersonIds: included.map((p) => p.personId),
        skippedDetail: skipped,
        batchPath: OUT,
        planPath: META,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error('BATCH_BUILD_FAIL', String(e?.stack || e).slice(0, 600));
  process.exit(1);
});
