/**
 * READ-ONLY prepare: map PROF-8E-S20-20260813172450 → presentation DTO.
 * No Gemini. No importer write. Writes batch JSON + dry-run report.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { mapProfilePackToPresentation } from '../src/mc-pipeline/person-profile';
import {
  MC1_PRESENTATION_STORE_SOURCE,
  validateMc1PresentationPayload,
} from '../src/mc-pipeline/person-profile/mc1-person-profile-store';
import type { ProfilePilotEnvelope } from '../src/mc-pipeline/profile/profile.types';

const ROOT = resolve(__dirname, '..');
const PACK_DIR = resolve(
  ROOT,
  'tmp/mc1-data-governance-semantic-fix/profile/PROF-8E-S20-20260813172450',
);
const OUT_DIR = resolve(ROOT, 'tmp/mc1-data-governance-semantic-fix/publish-sara');
const PERSON_ID = '52';

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

function profileFingerprint(envelope: unknown): string {
  return `profile-sha256:${createHash('sha256')
    .update(JSON.stringify(envelope))
    .digest('hex')
    .slice(0, 24)}`;
}

function axesOf(payload: {
  fields?: Array<{
    code?: string;
    competencyMap?: { dimensions?: Array<{ code: string; label: string; relativeCoverage: number }> };
  }>;
}) {
  const da = payload.fields?.find((f) => f.code === 'DATA_ANALYTICS');
  return (da?.competencyMap?.dimensions ?? []).map((d) => ({
    code: d.code,
    label: d.label,
    relativeCoverage: d.relativeCoverage,
  }));
}

async function main() {
  const envelope = JSON.parse(
    readFileSync(resolve(PACK_DIR, 'profile-contract.json'), 'utf8'),
  ) as ProfilePilotEnvelope;
  const producedAtMs = Date.parse(envelope.producedAt ?? '');
  if (String(envelope.payload?.snapshotId) !== '20') {
    throw new Error(`SNAPSHOT_MISMATCH:${envelope.payload?.snapshotId}`);
  }
  const da = envelope.payload.fields.find((f) => f.fieldCode === 'DATA_ANALYTICS');
  if (!da) throw new Error('DA_FIELD_MISSING');
  if (da.publicationStatus !== 'PUBLISHABLE') {
    throw new Error(`NOT_PUBLISHABLE:${da.publicationStatus}`);
  }
  const govSpec = da.specialties?.find((s) => s.specialtyCode === 'DATA_GOVERNANCE');
  const govSkill = da.skills?.find(
    (s) => s.skillCode === 'data_governance_and_integrity_management',
  );
  const govAxis = da.radar?.axes?.find((a) => a.dimensionCode === 'DA_GOVERNANCE_QUALITY');
  if (!govSpec) throw new Error('DATA_GOVERNANCE_SPECIALTY_MISSING');
  if (!govSkill) throw new Error('GOVERNANCE_SKILL_MISSING');
  if (govAxis?.relativeCoverage !== 48.6) {
    throw new Error(`GOVERNANCE_AXIS_NOT_48_6:${govAxis?.relativeCoverage}`);
  }

  const presentation = mapProfilePackToPresentation({
    packDir: PACK_DIR,
    envelope,
    producedAtMs: Number.isFinite(producedAtMs) ? producedAtMs : 0,
  });
  const validated = validateMc1PresentationPayload({
    ...presentation,
    source: MC1_PRESENTATION_STORE_SOURCE,
  });
  if (!validated.ok) throw new Error(`DTO_INVALID:${validated.reason}`);

  const fingerprint = profileFingerprint(envelope);
  const dto = validated.presentation;
  const newAxes = axesOf(dto);
  const newGov = newAxes.find((a) => a.code === 'DA_GOVERNANCE_QUALITY');
  if (newGov?.relativeCoverage !== 48.6) {
    throw new Error(`DTO_GOV_NOT_48_6:${newGov?.relativeCoverage}`);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const batch = {
    configFingerprint: fingerprint,
    profiles: [
      {
        personId: PERSON_ID,
        configFingerprint: fingerprint,
        producedAt: envelope.producedAt,
        payload: dto,
      },
    ],
  };
  writeFileSync(resolve(OUT_DIR, 'batch.json'), JSON.stringify(batch, null, 2));

  const env = loadEnv(resolve(ROOT, '.env'));
  const cloud = new Client({
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
  await cloud.connect();
  let current: Record<string, unknown> = { missing: true };
  try {
    const rows = await cloud.query(
      `SELECT person_id::text AS person_id,
              config_fingerprint,
              produced_at,
              is_active,
              payload_json
         FROM organigrama.mc1_person_profile_presentation
        WHERE person_id = $1
        ORDER BY is_active DESC, produced_at DESC`,
      [PERSON_ID],
    );
    const active = rows.rows.find((r) => r.is_active);
    const oldAxes = axesOf(active?.payload_json ?? {});
    current = {
      rowCount: rows.rows.length,
      activeCount: rows.rows.filter((r) => r.is_active).length,
      active: active
        ? {
            produced_at: active.produced_at,
            fingerprint: active.config_fingerprint,
            specialties: (active.payload_json?.fields ?? [])
              .find((f: { code?: string }) => f.code === 'DATA_ANALYTICS')
              ?.specialties?.map((s: { code?: string }) => s.code),
            axes: oldAxes,
            governance: oldAxes.find((a) => a.code === 'DA_GOVERNANCE_QUALITY')
              ?.relativeCoverage,
          }
        : null,
    };
  } finally {
    await cloud.end();
  }

  const dryRun = {
    status: 'DRY_RUN',
    targetPerson: PERSON_ID,
    sourcePack: 'PROF-8E-S20-20260813172450',
    snapshotId: '20',
    catalogVersion: '1.13.0',
    publicationGate: da.publicationReasonCode,
    publicationStatus: da.publicationStatus,
    currentActivePresentation: 'old',
    incomingPresentation: 'new',
    storeBefore: current,
    incoming: {
      producedAt: envelope.producedAt,
      fingerprint,
      specialties: dto.fields[0]?.specialties.map((s) => s.code),
      axes: newAxes,
      governance: newGov.relativeCoverage,
      status: dto.status,
      fieldCodes: dto.fields.map((f) => f.code),
    },
    fieldsChanged: {
      governance: `${(current as { active?: { governance?: number } }).active?.governance ?? '?'} → 48.6`,
      specialtiesAdded: ['DATA_GOVERNANCE'],
    },
    otherPersons: 'NONE',
    gemini: { calls: 0, tokens: 0 },
  };
  writeFileSync(resolve(OUT_DIR, 'dry-run.json'), JSON.stringify(dryRun, null, 2));
  console.log(JSON.stringify(dryRun, null, 2));
}

main().catch((e) => {
  console.error('PREPARE_FAIL', String(e?.stack || e).slice(0, 1200));
  process.exit(1);
});
