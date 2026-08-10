/**
 * Lookup LOCAL (sin imprimir documentos) del estado pipeline Grupo B 9B.1.
 * Uso: npx ts-node --transpile-only scripts/mc1-profile-preview-person-status-9b1.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { Mc1ProfilePreviewService } from '../src/mc-pipeline/preview/mc1-profile-preview.service';

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
  const svc = new Mc1ProfilePreviewService(ROOT);
  const artifactCases = svc.listCases().filter((c) => c.kind === 'ARTIFACT_SNAPSHOT');

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

  const personRows: Array<{
    caseId: string;
    label: string;
    personFound: boolean;
    hasActiveCv: boolean;
    hasMcSnapshot: boolean;
    snapshotLocalizado: string | null;
    availability: string;
  }> = [];

  try {
    for (const { caseId, document } of svc.realPersonDocuments()) {
      const rows = await ds.query(
        `
        SELECT
          p.id AS person_id,
          p.full_name AS full_name,
          pc.id AS person_cv_id,
          (
            SELECT s.id::text
            FROM organigrama.mc_cv_snapshot s
            WHERE s.person_cv_id = pc.id
            ORDER BY s.created_at DESC NULLS LAST, s.id DESC
            LIMIT 1
          ) AS latest_snapshot_id
        FROM core.person p
        LEFT JOIN organigrama.person_cv pc
          ON pc.person_id = p.id AND pc.is_active = true
        WHERE p.document = $1
        LIMIT 1
        `,
        [document],
      );
      const row = rows?.[0];
      const label =
        REAL_LABEL(caseId) ||
        (row?.full_name ? String(row.full_name) : caseId);
      personRows.push({
        caseId,
        label,
        personFound: Boolean(row?.person_id),
        hasActiveCv: Boolean(row?.person_cv_id),
        hasMcSnapshot: Boolean(row?.latest_snapshot_id),
        snapshotLocalizado: null,
        availability: 'PIPELINE_NOT_READY',
      });
    }
  } finally {
    await ds.destroy();
  }

  console.log(
    JSON.stringify(
      {
        phase: '9B.1',
        artifactCases: artifactCases.map((c) => ({
          snapshot: c.snapshotId,
          availability: c.availability,
          fields: c.fieldCodes,
          hasRadar: c.hasRadar,
          r1: c.r1Status,
        })),
        realPersons: personRows.map((p) => ({
          persona: p.label,
          personFound: p.personFound,
          hasActiveCv: p.hasActiveCv,
          hasMcSnapshot: p.hasMcSnapshot,
          snapshotLocalizado: p.snapshotLocalizado,
          estadoPipeline: p.availability,
          previewDisponible: false,
        })),
      },
      null,
      2,
    ),
  );
}

function REAL_LABEL(caseId: string): string {
  const map: Record<string, string> = {
    'person-nidia': 'Nidia Marcela Prada Ramírez',
    'person-santiago': 'Santiago Vanegas García',
    'person-camilo': 'Camilo Andrés Quintero Vargas',
    'person-ginna': 'Ginna Marcela Garzón Toledo',
  };
  return map[caseId] ?? '';
}

main().catch((e) => {
  console.error(JSON.stringify({ status: 'ERROR', message: String(e?.message ?? e) }));
  process.exit(1);
});
