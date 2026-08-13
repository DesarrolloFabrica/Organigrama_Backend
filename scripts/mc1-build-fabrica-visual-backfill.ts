/**
 * Builds the exact, prevalidated Fábrica Visual Design presentation backfill.
 *
 * This script is read-only against Cloud. It only writes a local batch and
 * preflight report under tmp/mc1-fabrica-visual-backfill.
 * It never runs P0-P4 or invokes an AI model.
 *
 *   npx ts-node --transpile-only scripts/mc1-build-fabrica-visual-backfill.ts
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { mapProfilePackToPresentation } from '../src/mc-pipeline/person-profile';
import {
  MC1_PRESENTATION_STORE_SOURCE,
  validateMc1PresentationPayload,
} from '../src/mc-pipeline/person-profile/mc1-person-profile-store';
import { findBestValidProfilePack } from '../src/mc-pipeline/preview/mc1-profile-preview.service';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-fabrica-visual-backfill');
const INDEX_PATH = resolve(
  ROOT,
  'tmp',
  'mc1-profile-preview',
  'person-snapshot-index.json',
);
const PARENT_PERSON_ID = '1206';
const TARGET_FIELD = 'VISUAL_DESIGN';
const TARGET_PERSON_IDS = [
  '1163',
  '1164',
  '1166',
  '1167',
  '1168',
  '1169',
  '1170',
  '1175',
  '1176',
  '1179',
  '1182',
  '1184',
  '1186',
  '1188',
  '1190',
] as const;

type PersonSnapshotIndex = Record<
  string,
  { snapshotId?: string; caseId?: string; boundAt?: string }
>;

type CloudTargetRow = {
  person_id: string;
  full_name: string;
  person_active: boolean;
  direct_child_of_fabrica: boolean;
  active_cv_count: number;
  active_presentation_count: number;
  active_version_ids: string[] | null;
};

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function profileFingerprint(envelope: unknown): string {
  return `profile-sha256:${createHash('sha256')
    .update(JSON.stringify(envelope))
    .digest('hex')
    .slice(0, 24)}`;
}

function buildCloudDataSource(): DataSource {
  const env = loadEnvFile(resolve(ROOT, '.env'));
  return new DataSource({
    type: 'postgres',
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl:
      String(env.DB_SSL).toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : false,
    synchronize: false,
    logging: false,
  });
}

async function main(): Promise<void> {
  if (!existsSync(INDEX_PATH)) throw new Error('PERSON_SNAPSHOT_INDEX_MISSING');
  const index = JSON.parse(
    readFileSync(INDEX_PATH, 'utf8'),
  ) as PersonSnapshotIndex;

  const cloud = buildCloudDataSource();
  await cloud.initialize();

  try {
    const cloudRows = (await cloud.query(
      `
      SELECT p.id::text AS person_id,
             p.full_name,
             p.is_active AS person_active,
             EXISTS (
               SELECT 1
                 FROM organigrama.org_visual_relation r
                 JOIN organigrama.org_chart_version v
                   ON v.id = r.version_id AND v.is_active = TRUE
                WHERE r.is_active = TRUE
                  AND r.parent_person_id = $2::bigint
                  AND r.child_person_id = p.id
             ) AS direct_child_of_fabrica,
             (SELECT COUNT(*)::int
                FROM organigrama.person_cv cv
               WHERE cv.person_id = p.id AND cv.is_active = TRUE
             ) AS active_cv_count,
             (SELECT COUNT(*)::int
                FROM organigrama.mc1_person_profile_presentation m
               WHERE m.person_id = p.id AND m.is_active = TRUE
             ) AS active_presentation_count,
             ARRAY(
               SELECT DISTINCT v.id::text
                 FROM organigrama.org_visual_relation r
                 JOIN organigrama.org_chart_version v
                   ON v.id = r.version_id AND v.is_active = TRUE
                WHERE r.is_active = TRUE
                  AND r.parent_person_id = $2::bigint
                  AND r.child_person_id = p.id
                ORDER BY v.id::text
             ) AS active_version_ids
        FROM core.person p
       WHERE p.id = ANY($1::bigint[])
       ORDER BY p.id
      `,
      [TARGET_PERSON_IDS, PARENT_PERSON_ID],
    )) as CloudTargetRow[];

    const baselineRows = (await cloud.query(
      `
      SELECT COUNT(*) FILTER (WHERE m.is_active = TRUE)::int AS active_profiles,
             COUNT(*) FILTER (
               WHERE m.is_active = TRUE
                 AND EXISTS (
                   SELECT 1
                     FROM jsonb_array_elements(m.payload_json->'fields') f
                    WHERE f->>'code' = $1
                 )
             )::int AS active_visual_profiles,
             COUNT(*) FILTER (
               WHERE m.is_active = TRUE
                 AND EXISTS (
                   SELECT 1
                     FROM organigrama.org_visual_relation r
                     JOIN organigrama.org_chart_version v
                       ON v.id = r.version_id AND v.is_active = TRUE
                    WHERE r.is_active = TRUE
                      AND r.parent_person_id = $2::bigint
                      AND r.child_person_id = m.person_id
                 )
                 AND EXISTS (
                   SELECT 1
                     FROM jsonb_array_elements(m.payload_json->'fields') f
                    WHERE f->>'code' = $1
                 )
             )::int AS fabrica_visual_profiles
        FROM organigrama.mc1_person_profile_presentation m
      `,
      [TARGET_FIELD, PARENT_PERSON_ID],
    )) as Array<{
      active_profiles: number;
      active_visual_profiles: number;
      fabrica_visual_profiles: number;
    }>;

    const cloudById = new Map(cloudRows.map((row) => [row.person_id, row]));
    const failures: Array<{ personId: string; reason: string }> = [];
    const profiles: Array<Record<string, unknown>> = [];
    const targetEvidence: Array<Record<string, unknown>> = [];

    for (const personId of TARGET_PERSON_IDS) {
      const cloudRow = cloudById.get(personId);
      if (!cloudRow) {
        failures.push({ personId, reason: 'PERSON_NOT_FOUND' });
        continue;
      }
      if (!cloudRow.person_active) {
        failures.push({ personId, reason: 'PERSON_NOT_ACTIVE' });
      }
      if (!cloudRow.direct_child_of_fabrica) {
        failures.push({ personId, reason: 'NOT_DIRECT_CHILD_OF_FABRICA' });
      }
      if (Number(cloudRow.active_cv_count) < 1) {
        failures.push({ personId, reason: 'ACTIVE_CV_MISSING' });
      }
      if (Number(cloudRow.active_presentation_count) !== 0) {
        failures.push({
          personId,
          reason: `ACTIVE_PRESENTATION_COUNT_${cloudRow.active_presentation_count}`,
        });
      }

      const snapshotId = String(index[personId]?.snapshotId ?? '').trim();
      if (!snapshotId) {
        failures.push({ personId, reason: 'SNAPSHOT_BINDING_MISSING' });
        continue;
      }
      const pack = findBestValidProfilePack(ROOT, snapshotId);
      if (!pack) {
        failures.push({ personId, reason: 'VALID_PROFILE_PACK_MISSING' });
        continue;
      }

      const rawPresentation = mapProfilePackToPresentation(pack);
      const validated = validateMc1PresentationPayload({
        ...rawPresentation,
        source: MC1_PRESENTATION_STORE_SOURCE,
      });
      if (!validated.ok) {
        failures.push({
          personId,
          reason: `PRESENTATION_${validated.reason}`,
        });
        continue;
      }

      const fields = validated.presentation.fields;
      const visualField = fields.find((field) => field.code === TARGET_FIELD);
      if (!visualField) {
        failures.push({ personId, reason: 'VISUAL_DESIGN_FIELD_MISSING' });
        continue;
      }
      if (!visualField.specialties.length && !visualField.tools.length) {
        failures.push({ personId, reason: 'VISUAL_DESIGN_FIELD_EMPTY' });
        continue;
      }
      if (
        fields.some(
          (field) =>
            field.role === 'PRIMARY' &&
            !field.specialties.length &&
            !field.tools.length,
        )
      ) {
        failures.push({ personId, reason: 'EMPTY_PRIMARY_FIELD' });
        continue;
      }

      const fingerprint = profileFingerprint(pack.envelope);
      profiles.push({
        personId,
        configFingerprint: fingerprint,
        producedAt: pack.envelope.producedAt,
        payload: validated.presentation,
      });
      targetEvidence.push({
        personId,
        fullName: cloudRow.full_name,
        snapshotId,
        pack: basename(pack.packDir),
        producedAt: pack.envelope.producedAt,
        configFingerprint: fingerprint,
        activeVersionIds: cloudRow.active_version_ids ?? [],
        activeCvCount: Number(cloudRow.active_cv_count),
        activePresentationCount: Number(cloudRow.active_presentation_count),
        fieldCodes: fields.map((field) => field.code),
        visualRole: visualField.role,
        visualSpecialtyCount: visualField.specialties.length,
        visualSkillCount: visualField.specialties.reduce(
          (count, specialty) => count + specialty.skills.length,
          0,
        ),
        visualToolCount: visualField.tools.length,
      });
    }

    const uniqueProfileIds = new Set(
      profiles.map((profile) => String(profile.personId)),
    );
    if (profiles.length !== TARGET_PERSON_IDS.length) {
      failures.push({
        personId: '*',
        reason: `PROFILE_COUNT_${profiles.length}_EXPECTED_${TARGET_PERSON_IDS.length}`,
      });
    }
    if (uniqueProfileIds.size !== TARGET_PERSON_IDS.length) {
      failures.push({ personId: '*', reason: 'TARGET_IDS_NOT_UNIQUE' });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '').slice(0, 15);
    const batchPath = resolve(
      OUT_DIR,
      `mc1-fabrica-visual-presentation-backfill-${timestamp}.json`,
    );
    const reportPath = resolve(OUT_DIR, `preflight-${timestamp}.json`);
    const baseline = baselineRows[0] ?? {
      active_profiles: 0,
      active_visual_profiles: 0,
      fabrica_visual_profiles: 0,
    };
    const report = {
      phase: 'MC1_FABRICA_VISUAL_PRESENTATION_BACKFILL',
      builtAt: now.toISOString(),
      cloudWritesPerformed: false,
      parentPersonId: PARENT_PERSON_ID,
      targetField: TARGET_FIELD,
      expectedPersonIds: TARGET_PERSON_IDS,
      baseline: {
        activeProfiles: Number(baseline.active_profiles),
        activeVisualProfiles: Number(baseline.active_visual_profiles),
        fabricaVisualProfiles: Number(baseline.fabrica_visual_profiles),
      },
      validation: {
        passed: failures.length === 0,
        expectedCount: TARGET_PERSON_IDS.length,
        readyCount: profiles.length,
        failures,
      },
      targets: targetEvidence,
      rollback: {
        previousActiveRowsExpected: 0,
        strategy:
          'Deactivate only rows inserted by this batch, matched by person_id and config_fingerprint.',
      },
    };

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    if (failures.length) {
      console.log(
        JSON.stringify(
          {
            status: 'BLOCKED',
            reportPath,
            expectedCount: TARGET_PERSON_IDS.length,
            readyCount: profiles.length,
            failures,
          },
          null,
          2,
        ),
      );
      process.exitCode = 2;
      return;
    }

    const batch = {
      phase: 'MC1_FABRICA_VISUAL_PRESENTATION_BACKFILL',
      builtAt: now.toISOString(),
      parentPersonId: PARENT_PERSON_ID,
      targetField: TARGET_FIELD,
      expectedPersonIds: TARGET_PERSON_IDS,
      fingerprintMethod: 'sha256(profile-contract envelope), first 24 hex',
      profiles,
    };
    writeFileSync(batchPath, JSON.stringify(batch, null, 2), 'utf8');

    console.log(
      JSON.stringify(
        {
          status: 'BATCH_READY',
          batchPath,
          reportPath,
          expectedCount: TARGET_PERSON_IDS.length,
          readyCount: profiles.length,
          baseline: report.baseline,
          targets: targetEvidence.map((target) => ({
            personId: target.personId,
            snapshotId: target.snapshotId,
            visualRole: target.visualRole,
            visualSpecialtyCount: target.visualSpecialtyCount,
            visualSkillCount: target.visualSkillCount,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await cloud.destroy();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      status: 'FAILED',
      error: String(error instanceof Error ? error.message : error).slice(
        0,
        500,
      ),
    }),
  );
  process.exit(1);
});
