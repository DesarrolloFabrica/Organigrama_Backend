/**
 * Diagnose Camilo identity without printing document/PII text.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';

const ROOT = resolve(__dirname, '..');
const DOCUMENT = '1000518830';

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
  try {
    const rows = await ds.query(
      `
      SELECT
        p.id AS person_id,
        pc.id AS person_cv_id,
        pc.is_active,
        (pc.drive_file_id IS NOT NULL) AS has_drive_file_id,
        (pc.drive_file_name IS NOT NULL) AS has_drive_file_name,
        pc.mime_type,
        (
          SELECT COUNT(*)::int FROM organigrama.mc_cv_snapshot s
          WHERE s.person_cv_id = pc.id
        ) AS snapshot_count,
        (
          SELECT json_agg(json_build_object(
            'id', s.id::text,
            'parse_status', s.parse_status,
            'norm_len', length(COALESCE(s.normalized_text,'')),
            'created_at', s.created_at
          ) ORDER BY s.created_at DESC)
          FROM organigrama.mc_cv_snapshot s
          WHERE s.person_cv_id = pc.id
        ) AS snapshots
      FROM core.person p
      LEFT JOIN organigrama.person_cv pc ON pc.person_id = p.id
      WHERE p.document = $1
      `,
      [DOCUMENT],
    );
    console.log(
      JSON.stringify(
        {
          personFound: rows.length > 0,
          rows: rows.map((r: Record<string, unknown>) => ({
            personId: r.person_id,
            personCvId: r.person_cv_id,
            isActive: r.is_active,
            hasDriveFileId: r.has_drive_file_id,
            hasDriveFileName: r.has_drive_file_name,
            mimeType: r.mime_type,
            snapshotCount: r.snapshot_count,
            snapshots: r.snapshots,
          })),
          envHasGoogleCreds: Boolean(
            process.env.GOOGLE_APPLICATION_CREDENTIALS ||
              existsSync(resolve(ROOT, '.env')),
          ),
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
  console.log(JSON.stringify({ status: 'ERROR', message: String(e.message) }));
  process.exit(1);
});
