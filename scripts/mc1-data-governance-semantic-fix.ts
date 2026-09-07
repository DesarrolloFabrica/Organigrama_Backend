/**
 * DATA_GOVERNANCE semantic fix — LIVE validation (Sara / Haider / Diego).
 *
 *   npx ts-node --transpile-only scripts/mc1-data-governance-semantic-fix.ts --confirm
 *
 * P1 unchanged. 12I/radar/P4 policy unchanged. Cloud writes = 0.
 * P3 catalog 1.13.0 + prompt 1.1.0 invalidates P3→P4 reuse.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import {
  createMdeDataSource,
  createP0Service,
} from '../src/mc-observatory/p0-bootstrap';
import { runP1ForMember } from '../src/mc-observatory/p1-member-runner';
import { runP2ArtifactOnly } from '../src/mc-pipeline/p2/p2-runner';
import { runR1ArtifactOnly } from '../src/mc-pipeline/r1/r1-runner';
import { runP3ArtifactOnly } from '../src/mc-pipeline/p3/p3-runner';
import { runP4ArtifactOnly } from '../src/mc-pipeline/p4/p4-runner';
import { runProfilePilot } from '../src/mc-pipeline/profile/profile-runner';
import {
  SPECIALTY_CATALOG_DA_VERSION,
  SPECIALTY_CATALOG_VERSION,
} from '../src/mc-pipeline/catalog/specialties-visual-education';
import {
  P3_PROMPT_VERSION,
  P3_REASONING_POLICY_VERSION,
} from '../src/mc-pipeline/p3/p3.types';
import { listObservedP4Skills } from '../src/mc-pipeline/profile/profile-pack-loader';
import { loadP2EvidenceFromP1Pack } from '../src/mc-pipeline/p2/p2-evidence-loader';
import {
  aggregateGeminiUsage,
  readGeminiLedgerEvents,
} from '../src/mc-pipeline/gemini';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-data-governance-semantic-fix');
const SARA_R1 =
  'C:\\dev\\organigrama\\Organigrama_Backend\\tmp\\mc1-r1-functional\\R1F-8A2-S20-20260813155543-f048aec4';

const PEOPLE = {
  sara: {
    key: 'sara',
    label: 'Sara Juliana Martínez López',
    personId: '52',
    personCvId: 225,
    role: 'positive' as const,
    reuseP0P1P2R1: true,
    snapshotHint: '20',
  },
  haider: {
    key: 'haider',
    label: 'Haider Yesid Bello Melo',
    personId: '49',
    personCvId: 242,
    role: 'negative' as const,
    reuseP0P1P2R1: false,
    snapshotHint: null as string | null,
  },
  diego: {
    key: 'diego',
    label: 'Diego Stiven Gutierrez Orjuela',
    personId: '1228',
    personCvId: 126,
    role: 'regression' as const,
    reuseP0P1P2R1: false,
    snapshotHint: null as string | null,
  },
};

function loadEnvFile(path: string, allow: Set<string> | null = null) {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (allow && !allow.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function govBlob(u: {
  evidenceKind?: string;
  normalizedActivity?: string | null;
  object?: string | null;
  result?: string | null;
}): string {
  return `${u.normalizedActivity ?? ''} ${u.object ?? ''} ${u.result ?? ''}`.toLowerCase();
}

function looksLikeGovPractice(blob: string): boolean {
  return /gobernanz|integridad|trazabilidad|calidad (de|del) (la )?dat|gobierno de datos/.test(
    blob,
  );
}

function looksLikeTechOnly(blob: string): boolean {
  return /sql|etl|pipeline|gcp|aws|repositorio|arquitectura|power bi|dashboard/.test(
    blob,
  );
}

function writeP1DecisionsSidecar(
  p1OutDir: string,
  decisions: Map<string, string>,
) {
  const candidatesFile = existsSync(join(p1OutDir, 'candidates.json'))
    ? (JSON.parse(readFileSync(join(p1OutDir, 'candidates.json'), 'utf8')) as {
        candidates?: Array<{ candidateId: string }>;
      })
    : { candidates: [] };
  const batchesFile = existsSync(join(p1OutDir, 'batches.json'))
    ? (JSON.parse(readFileSync(join(p1OutDir, 'batches.json'), 'utf8')) as {
        batches?: Array<{ batchId: string; candidateIds: string[] }>;
      })
    : { batches: [] };
  const candToBatch = new Map<string, string>();
  for (const b of batchesFile.batches ?? []) {
    for (const id of b.candidateIds) candToBatch.set(id, b.batchId);
  }
  const ids = [
    ...new Set([
      ...(candidatesFile.candidates ?? []).map((c) => c.candidateId),
      ...decisions.keys(),
    ]),
  ];
  const rows = ids.map((candidateId) => {
    const decision = decisions.get(candidateId) ?? 'REJECTED_CONTEXT_ONLY';
    return {
      candidateId,
      decision,
      reasonCode:
        decision === 'REVIEW_REQUIRED'
          ? 'NEEDS_REVIEW'
          : String(decision).startsWith('REJECTED')
            ? 'REJECTED'
            : 'OK',
      batchId: candToBatch.get(candidateId) ?? 'unknown',
    };
  });
  writeFileSync(
    join(p1OutDir, 'decisions.json'),
    JSON.stringify({ decisions: rows }, null, 2),
    'utf8',
  );
}

function p3BySpecialty(envelope: {
  payload: {
    fieldResults?: Array<{
      fieldCode: string;
      observedSpecialties?: Array<{
        specialtyCode: string;
        status: string;
        confidence: number;
        supportingEvidenceUnitIds: string[];
        rationaleCode: string;
      }>;
    }>;
  };
}) {
  const rows: Array<{
    fieldCode: string;
    specialtyCode: string;
    status: string;
    confidence: number;
    support: number;
    ids: string[];
    rationaleCode: string;
  }> = [];
  for (const fr of envelope.payload.fieldResults ?? []) {
    for (const s of fr.observedSpecialties ?? []) {
      rows.push({
        fieldCode: fr.fieldCode,
        specialtyCode: s.specialtyCode,
        status: s.status,
        confidence: s.confidence,
        support: s.supportingEvidenceUnitIds.length,
        ids: s.supportingEvidenceUnitIds,
        rationaleCode: s.rationaleCode,
      });
    }
  }
  return rows;
}

async function copyPersonCvFromCloud(args: {
  personId: number;
  cloud: Record<string, string>;
  mde: { host: string; port: number; database: string; username: string; password: string };
}) {
  const cloud = new Client({
    host: args.cloud.DB_HOST,
    port: Number(args.cloud.DB_PORT || 5432),
    database: args.cloud.DB_NAME,
    user: args.cloud.DB_USERNAME,
    password: args.cloud.DB_PASSWORD,
    ssl:
      String(args.cloud.DB_SSL).toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });
  const local = new Client({
    host: args.mde.host,
    port: args.mde.port,
    database: args.mde.database,
    user: args.mde.username,
    password: args.mde.password,
  });
  await cloud.connect();
  await local.connect();
  try {
    const people = await cloud.query(
      `SELECT id, document, full_name, COALESCE(is_active, true) AS is_active
         FROM core.person WHERE id = $1`,
      [args.personId],
    );
    const cvs = await cloud.query(
      `SELECT pc.id, pc.person_id, pc.document, pc.drive_file_id, pc.drive_file_name,
              pc.drive_web_url, pc.mime_type, pc.is_active, pc.synced_at,
              pc.drive_parent_folder_id, pc.drive_area_folder, pc.drive_subarea_folder,
              pc.drive_relative_path, pc.drive_modified_time, pc.drive_md5_checksum,
              pc.drive_file_size, pc.created_at
         FROM organigrama.person_cv pc
        WHERE pc.person_id = $1 AND pc.is_active = true
        ORDER BY pc.id`,
      [args.personId],
    );
    await local.query('BEGIN');
    try {
      for (const p of people.rows) {
        await local.query(
          `INSERT INTO core.person (id, document, full_name, is_active)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (id) DO UPDATE
             SET document=EXCLUDED.document, full_name=EXCLUDED.full_name, is_active=EXCLUDED.is_active`,
          [p.id, p.document, p.full_name, p.is_active],
        );
      }
      if (people.rows.length) {
        await local.query(
          `SELECT setval(pg_get_serial_sequence('core.person','id'),
                  GREATEST((SELECT MAX(id) FROM core.person), 1))`,
        );
      }
      for (const cv of cvs.rows) {
        await local.query(
          `INSERT INTO organigrama.person_cv (
             id, person_id, document, drive_file_id, drive_file_name, drive_web_url,
             mime_type, is_active, synced_at, drive_parent_folder_id, drive_area_folder,
             drive_subarea_folder, drive_relative_path, drive_modified_time,
             drive_md5_checksum, drive_file_size, created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           ON CONFLICT (id) DO UPDATE SET
             person_id=EXCLUDED.person_id, document=EXCLUDED.document,
             drive_file_id=EXCLUDED.drive_file_id, drive_file_name=EXCLUDED.drive_file_name,
             drive_web_url=EXCLUDED.drive_web_url, mime_type=EXCLUDED.mime_type,
             is_active=EXCLUDED.is_active, synced_at=EXCLUDED.synced_at,
             drive_parent_folder_id=EXCLUDED.drive_parent_folder_id,
             drive_area_folder=EXCLUDED.drive_area_folder,
             drive_subarea_folder=EXCLUDED.drive_subarea_folder,
             drive_relative_path=EXCLUDED.drive_relative_path,
             drive_modified_time=EXCLUDED.drive_modified_time,
             drive_md5_checksum=EXCLUDED.drive_md5_checksum,
             drive_file_size=EXCLUDED.drive_file_size`,
          [
            cv.id, cv.person_id, cv.document, cv.drive_file_id, cv.drive_file_name,
            cv.drive_web_url, cv.mime_type, cv.is_active, cv.synced_at,
            cv.drive_parent_folder_id, cv.drive_area_folder, cv.drive_subarea_folder,
            cv.drive_relative_path, cv.drive_modified_time, cv.drive_md5_checksum,
            cv.drive_file_size, cv.created_at,
          ],
        );
      }
      if (cvs.rows.length) {
        await local.query(
          `SELECT setval(pg_get_serial_sequence('organigrama.person_cv','id'),
                  GREATEST((SELECT MAX(id) FROM organigrama.person_cv), 1))`,
        );
      }
      await local.query('COMMIT');
    } catch (e) {
      await local.query('ROLLBACK');
      throw e;
    }
    const cv = cvs.rows.sort((a, b) => Number(b.id) - Number(a.id))[0];
    return {
      personId: args.personId,
      document: people.rows[0]?.document ?? null,
      personCvId: cv?.id ?? null,
      driveFileId: cv?.drive_file_id ?? null,
      driveFileName: cv?.drive_file_name ?? null,
      mimeType: cv?.mime_type ?? null,
    };
  } finally {
    await cloud.end();
    await local.end();
  }
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        hint: 'npx ts-node --transpile-only scripts/mc1-data-governance-semantic-fix.ts --confirm',
      }),
    );
    process.exit(2);
  }

  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const driveAllow = new Set([
    'GOOGLE_DRIVE_CV_FOLDER_ID',
    'GOOGLE_DRIVE_CV_TOKEN_PATH',
    'GOOGLE_DRIVE_CV_AUTH_MODE',
    'GOOGLE_DRIVE_CV_OAUTH_CLIENT_PATH',
  ]);
  const driveEnv = loadEnvFile(resolve(ROOT, '.env'), driveAllow);
  for (const [k, v] of Object.entries(driveEnv)) {
    if (!process.env[k]?.trim()) process.env[k] = v;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  process.env.MC1_GEMINI_LEDGER_PATH = join(OUT_DIR, 'events.jsonl');

  const mdeEnv = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const gem = loadEnvFile(
    resolve(ROOT, 'secrets/mc1-p1-prototype.local.env'),
    new Set(['GEMINI_API_KEY', 'GEMINI_MODEL']),
  );
  const cloudEnv = loadEnvFile(resolve(ROOT, '.env'));
  const mde = {
    host: mdeEnv.MDE_DB_HOST,
    port: Number(mdeEnv.MDE_DB_PORT),
    database: mdeEnv.MDE_DB_NAME,
    username: mdeEnv.MDE_DB_USERNAME,
    password: mdeEnv.MDE_DB_PASSWORD,
  };
  assertMdeTarget(mde);
  if (!gem.GEMINI_API_KEY) {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'NO_GEMINI_KEY' }));
    process.exit(2);
  }
  const model = gem.GEMINI_MODEL || 'gemini-3.6-flash';
  const runId = `dg-fix-${Date.now()}`;

  const baseline = {
    sara: { DATA_ENGINEERING: 'OBSERVED', DATA_GOVERNANCE: 'WEAK', radarGovernance: 0 },
    haider: { DATA_ENGINEERING: 'UNKNOWN', DATA_GOVERNANCE: 'UNKNOWN', radarGovernance: 'UNKNOWN' },
    diego: { DATA_ENGINEERING: 'OBSERVED (doc)', DATA_GOVERNANCE: 'NOT_LISTED (doc)', radarGovernance: 'UNKNOWN' },
  };
  writeFileSync(join(OUT_DIR, 'baseline.json'), JSON.stringify(baseline, null, 2));

  const bootstrap: Record<string, { personCvId: number | null; driveFileId: string | null; document: string | null }> = {};
  for (const p of [PEOPLE.haider, PEOPLE.diego]) {
    const copied = await copyPersonCvFromCloud({
      personId: Number(p.personId),
      cloud: cloudEnv,
      mde,
    });
    bootstrap[p.key] = copied;
    if (copied.personCvId) p.personCvId = Number(copied.personCvId);
  }
  writeFileSync(join(OUT_DIR, 'bootstrap.json'), JSON.stringify({ cloudWrites: 0, bootstrap }, null, 2));

  const dsP0 = await createMdeDataSource(mde);
  const p0svc = createP0Service(dsP0, mde);
  const p0Haider = await p0svc.createOrReuseFromPersonCv(PEOPLE.haider.personCvId);
  const p0Diego = await p0svc.createOrReuseFromPersonCv(PEOPLE.diego.personCvId);
  await dsP0.destroy();

  const snapshots = {
    sara: PEOPLE.sara.snapshotHint!,
    haider: String(p0Haider.snapshotId),
    diego: String(p0Diego.snapshotId),
  };
  writeFileSync(
    join(OUT_DIR, 'p0.json'),
    JSON.stringify(
      {
        haider: {
          personId: PEOPLE.haider.personId,
          personCvId: PEOPLE.haider.personCvId,
          snapshotId: snapshots.haider,
          outcome: p0Haider.outcome,
          sourceHash: p0Haider.sourceHash,
          parseStatus: p0Haider.parseStatus,
          pageCount: p0Haider.pageCount,
        },
        diego: {
          personId: PEOPLE.diego.personId,
          personCvId: PEOPLE.diego.personCvId,
          snapshotId: snapshots.diego,
          outcome: p0Diego.outcome,
          sourceHash: p0Diego.sourceHash,
          parseStatus: p0Diego.parseStatus,
          pageCount: p0Diego.pageCount,
        },
      },
      null,
      2,
    ),
  );

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

  const results: Record<string, unknown> = {};
  try {
    for (const person of [PEOPLE.sara, PEOPLE.haider, PEOPLE.diego]) {
      const priorPath = join(OUT_DIR, `${person.key}.json`);
      if (person.key === 'sara' && existsSync(priorPath)) {
        results[person.key] = JSON.parse(readFileSync(priorPath, 'utf8'));
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({ progress: person.key, skipped: 'PRIOR_RESULT', gov: (results[person.key] as { DATA_GOVERNANCE?: string }).DATA_GOVERNANCE }));
        continue;
      }
      const snapshotId = snapshots[person.key as keyof typeof snapshots];
      const phases: Record<string, string> = {};
      let r1Pack = person.reuseP0P1P2R1 ? SARA_R1 : undefined;

      if (!person.reuseP0P1P2R1) {
        const snap = (
          await ds.query(
            `SELECT id::text AS id, normalized_text, pages, sectioned_content,
                    parse_status, drive_file_id, source_hash
               FROM organigrama.mc_cv_snapshot WHERE id = $1`,
            [snapshotId],
          )
        )[0];
        if (!snap?.normalized_text || snap.parse_status !== 'PARSED') {
          throw new Error(`SNAPSHOT_NOT_READY:${person.key}:${snapshotId}`);
        }
        const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
        const prototypeId = `P1P-DGFIX-S${snapshotId}-${stamp}-${randomUUID().slice(0, 8)}`;
        const p1OutDir = resolve(ROOT, 'tmp', 'mc1-p1-prototype', prototypeId);
        mkdirSync(p1OutDir, { recursive: true });
        const pages =
          typeof snap.pages === 'string' ? JSON.parse(snap.pages) : snap.pages;
        const sectioned =
          typeof snap.sectioned_content === 'string'
            ? JSON.parse(snap.sectioned_content)
            : snap.sectioned_content;
        const p1 = await runP1ForMember({
          prototypeId,
          snapshotId,
          normalizedText: snap.normalized_text,
          pages,
          sectionedContent: sectioned,
          apiKey: gem.GEMINI_API_KEY,
          model,
          outDir: p1OutDir,
          personId: person.personId,
          personCvId: String(person.personCvId),
          runId: `${runId}-${person.key}`,
          backendRoot: ROOT,
        });
        if (!p1.ok) throw new Error(`P1_FAILED:${person.key}:${p1.errorCode ?? p1.status}`);
        writeP1DecisionsSidecar(p1OutDir, p1.decisions);
        phases.P1 = p1.executionStatus;
        const p2 = await runP2ArtifactOnly({
          backendRoot: ROOT,
          snapshotId,
          dataSource: ds,
          apiKey: gem.GEMINI_API_KEY,
          model,
          outRoot: resolve(ROOT, 'tmp', 'mc1-p2-functional'),
          personId: person.personId,
          pipelineRunId: `${runId}-${person.key}`,
        });
        phases.P2 = p2.executionStatus;
        const r1 = runR1ArtifactOnly({
          backendRoot: ROOT,
          snapshotId,
          p2PackDir: p2.outDir,
        });
        phases.R1 = 'EXECUTED_LOCAL';
        r1Pack = r1.outDir;
      } else {
        phases.P0 = 'REUSED';
        phases.P1 = 'REUSED';
        phases.P2 = 'REUSED';
        phases.R1 = 'REUSED';
        if (!existsSync(SARA_R1)) throw new Error('SARA_R1_MISSING');
      }

      const p3 = await runP3ArtifactOnly({
        backendRoot: ROOT,
        snapshotId,
        dataSource: ds,
        apiKey: gem.GEMINI_API_KEY,
        model,
        outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
        r1PackDir: r1Pack,
        personId: person.personId,
        pipelineRunId: `${runId}-${person.key}`,
      });
      phases.P3 = p3.executionStatus;

      const p4 = await runP4ArtifactOnly({
        backendRoot: ROOT,
        snapshotId,
        dataSource: ds,
        apiKey: gem.GEMINI_API_KEY,
        model,
        outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
        r1PackDir: r1Pack,
        p3PackDir: p3.outDir,
        personId: person.personId,
        pipelineRunId: `${runId}-${person.key}`,
      });
      phases.P4 = p4.executionStatus;

      const profile = await runProfilePilot({
        backendRoot: ROOT,
        snapshotId,
        outRoot: resolve(OUT_DIR, 'profile'),
        dataSource: ds,
        r1PackDir: r1Pack,
        p3PackDir: p3.outDir,
        p4PackDir: p4.outDir,
      });
      phases.Profile = 'ASSEMBLED';

      const specs = p3BySpecialty(p3.envelope);
      const da = specs.filter((s) => s.fieldCode === 'DATA_ANALYTICS');
      const gov = da.find((s) => s.specialtyCode === 'DATA_GOVERNANCE');
      const de = da.find((s) => s.specialtyCode === 'DATA_ENGINEERING');
      const field = profile.envelope.payload.fields.find(
        (f) => f.fieldCode === 'DATA_ANALYTICS',
      );
      const govAxis = field?.radar?.axes?.find(
        (a) => a.dimensionCode === 'DA_GOVERNANCE_QUALITY',
      );
      const publicSkills = listObservedP4Skills(
        p4.envelope,
        da.filter((s) => s.status === 'OBSERVED').map((s) => ({
          fieldCode: s.fieldCode,
          specialtyCode: s.specialtyCode,
        })),
      );
      const govSkills = (p4.envelope.payload.specialtyResults ?? [])
        .filter((r) => r.specialtyCode === 'DATA_GOVERNANCE')
        .flatMap((r) =>
          (r.observedSkills ?? []).map((sk) => ({
            skillCode: sk.skillCode,
            status: sk.status,
            ids: sk.supportingEvidenceUnitIds,
            signals: sk.supportingSignals,
          })),
        );

      let evidenceFlags: unknown = null;
      try {
        const ev = await loadP2EvidenceFromP1Pack({
          backendRoot: ROOT,
          snapshotId,
          dataSource: ds,
        });
        evidenceFlags = {
          unitCount: ev.units.length,
          govPracticeUnits: ev.units.filter((u) => looksLikeGovPractice(govBlob(u))).map((u) => ({
            id: u.evidenceUnitId,
            kind: u.evidenceKind,
            explicitness: u.explicitness,
          })),
          techOnlyApprox: ev.units.filter((u) => {
            const b = govBlob(u);
            return looksLikeTechOnly(b) && !looksLikeGovPractice(b);
          }).length,
        };
      } catch {
        evidenceFlags = { error: 'P1_EVIDENCE_UNAVAILABLE' };
      }

      const dual = Boolean(
        de?.status === 'OBSERVED' &&
          gov?.status === 'OBSERVED' &&
          de.ids.some((id) => gov.ids.includes(id)),
      );

      results[person.key] = {
        personId: person.personId,
        snapshotId,
        phases,
        p3Pack: p3.outDir,
        p4Pack: p4.outDir,
        profilePack: profile.outDir,
        specialties: da,
        DATA_ENGINEERING: de?.status ?? 'NOT_EMITTED',
        DATA_GOVERNANCE: gov?.status ?? 'NOT_EMITTED',
        governanceSupports: gov?.ids ?? [],
        dualAttributionSharedIds: dual,
        p4GovernanceSkills: govSkills,
        publicGovernanceSkills: publicSkills
          .filter((s) => s.parentSpecialtyCode === 'DATA_GOVERNANCE')
          .map((s) => s.skillCode),
        radarGovernance: govAxis?.relativeCoverage ?? 0,
        evidenceFlags,
      };
      writeFileSync(
        join(OUT_DIR, `${person.key}.json`),
        JSON.stringify(results[person.key], null, 2),
      );
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ progress: person.key, phases, gov: gov?.status ?? 'NOT_EMITTED' }));
    }
  } finally {
    await ds.destroy();
  }

  const events = readGeminiLedgerEvents(ROOT);
  const usage = aggregateGeminiUsage(events);
  const sara = results.sara as {
    DATA_ENGINEERING: string;
    DATA_GOVERNANCE: string;
    radarGovernance: number;
    dualAttributionSharedIds: boolean;
    governanceSupports: string[];
    evidenceFlags: { govPracticeUnits?: Array<{ kind: string }> };
  };
  const haider = results.haider as { DATA_GOVERNANCE: string };
  const diego = results.diego as { DATA_GOVERNANCE: string };

  const saraGovPractice =
    (sara.evidenceFlags?.govPracticeUnits ?? []).filter((u) => u.kind !== 'KNOWLEDGE_STATEMENT')
      .length > 0;
  const saraFixed =
    sara.DATA_ENGINEERING === 'OBSERVED' &&
    sara.DATA_GOVERNANCE === 'OBSERVED' &&
    saraGovPractice &&
    sara.radarGovernance > 0;
  const haiderOk = haider.DATA_GOVERNANCE !== 'OBSERVED';
  const diegoOk = diego.DATA_GOVERNANCE !== 'OBSERVED';
  const verdict = saraFixed && haiderOk && diegoOk
    ? 'SARA_FIXED_WITHOUT_HAIDER_DIEGO_FALSE_POSITIVES'
    : 'FIX_NOT_VALIDATED';

  const report = {
    status: verdict === 'SARA_FIXED_WITHOUT_HAIDER_DIEGO_FALSE_POSITIVES'
      ? 'DATA_GOVERNANCE_FIX_VALIDATED'
      : 'DATA_GOVERNANCE_FIX_BLOCKED',
    catalogVersion: SPECIALTY_CATALOG_VERSION,
    daCatalogVersion: SPECIALTY_CATALOG_DA_VERSION,
    p3PromptVersion: P3_PROMPT_VERSION,
    p3ReasoningPolicy: P3_REASONING_POLICY_VERSION,
    p1: 'UNCHANGED',
    p4: 'UNCHANGED_POLICY',
    publicationGate: 'UNCHANGED_12I',
    radarFrontend: 'UNCHANGED',
    baseline,
    results,
    usage,
    reusedPhasesNote: 'Sara P0–R1 reused; P3/P4 executed after catalog/prompt bump. Haider/Diego P0 created/reused then P1–P4 as needed.',
    verdict,
    production: 'local-only',
  };
  writeFileSync(join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, verdict, usage }, null, 2));
  process.exit(verdict === 'SARA_FIXED_WITHOUT_HAIDER_DIEGO_FALSE_POSITIVES' ? 0 : 3);
}

main().catch((e) => {
  console.error('DG_FIX_FAIL', String(e?.stack || e).slice(0, 1200));
  process.exit(1);
});
