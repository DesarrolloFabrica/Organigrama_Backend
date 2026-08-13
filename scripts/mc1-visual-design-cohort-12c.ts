/**
 * FASE 12C — Visual Design second sibling cohort LIVE full pipeline.
 *
 *   npx ts-node --transpile-only scripts/mc1-visual-design-cohort-12c.ts --confirm --force-live-ai
 *
 * P0→P1→P2→R1→P3→P4→Profile. Role never sent to Gemini.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
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
import { SPECIALTY_CATALOG_SCOPE } from '../src/mc-pipeline/catalog/specialties-visual-education';
import {
  P1_PROMPT_VERSION,
  P1_SEGMENTER_VERSION,
} from '../src/mc-pipeline/p1/p1.types';
import { readMc1PersonProfile } from '../src/mc-pipeline/person-profile';
import type { ProfilePilotEnvelope } from '../src/mc-pipeline/profile/profile.types';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-visual-design-cohort-12c');
const REPORT_PATH = join(OUT_DIR, 'cohort-report.json');
const BINDINGS_PATH = resolve(
  ROOT,
  'tmp',
  'mc1-profile-preview',
  'real-person-bindings.json',
);
const INDEX_PATH = resolve(
  ROOT,
  'tmp',
  'mc1-profile-preview',
  'person-snapshot-index.json',
);

const VD_AXES = [
  'VD_VISUAL_COMMUNICATION',
  'VD_BRAND_SYSTEMS',
  'VD_EDITORIAL',
  'VD_PRODUCT_INTERFACE',
  'VD_ILLUSTRATION',
  'VD_MOTION',
  'VD_PRODUCTION_CRAFT',
] as const;

/** Frozen after selection — documents from Cloud RO bootstrap. */
const COHORT: Array<{
  caseId: string;
  document: string;
  selectionRole: string;
}> = [
  {
    caseId: 'person-laura-patino',
    document: '1023899594',
    selectionRole: 'DISEÑADOR UX/UI',
  },
  {
    caseId: 'person-blanca-herrera',
    document: '1031167800',
    selectionRole: 'ANALISTA DE DISEÑO DE CONTENIDOS',
  },
  {
    caseId: 'person-daissy-ardila',
    document: '1031164534',
    selectionRole: 'ANALISTA DE DISEÑO DE CONTENIDOS',
  },
  {
    caseId: 'person-daniel-perez',
    document: '1032488010',
    selectionRole: 'ANALISTA DE DISEÑO DE CONTENIDOS',
  },
  {
    caseId: 'person-yampier-sanchez',
    document: '1000616663',
    selectionRole: 'ANALISTA DE DISEÑO DE CONTENIDOS',
  },
];

const LABEL: Record<string, string> = {
  'person-laura-patino': 'Laura',
  'person-blanca-herrera': 'Blanca',
  'person-daissy-ardila': 'Daissy',
  'person-daniel-perez': 'Daniel',
  'person-yampier-sanchez': 'Yampier',
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

function writeBinding(caseId: string, snapshotId: string) {
  mkdirSync(resolve(ROOT, 'tmp', 'mc1-profile-preview'), { recursive: true });
  let current: Record<string, { snapshotId: string; boundAt: string }> = {};
  if (existsSync(BINDINGS_PATH)) {
    try {
      current = JSON.parse(readFileSync(BINDINGS_PATH, 'utf8'));
    } catch {
      current = {};
    }
  }
  current[caseId] = {
    snapshotId: String(snapshotId),
    boundAt: new Date().toISOString(),
  };
  writeFileSync(BINDINGS_PATH, JSON.stringify(current, null, 2), 'utf8');
}

function writePersonSnapshotIndex(
  personId: string,
  snapshotId: string,
  caseId: string,
) {
  mkdirSync(resolve(ROOT, 'tmp', 'mc1-profile-preview'), { recursive: true });
  let current: Record<
    string,
    { snapshotId: string; caseId?: string; boundAt?: string }
  > = {};
  if (existsSync(INDEX_PATH)) {
    try {
      current = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    } catch {
      current = {};
    }
  }
  current[String(personId)] = {
    snapshotId: String(snapshotId),
    caseId,
    boundAt: new Date().toISOString(),
  };
  writeFileSync(INDEX_PATH, JSON.stringify(current, null, 2), 'utf8');
}

function summarizeProfile(envelope: ProfilePilotEnvelope) {
  const resolved = envelope.payload.resolvedFieldsProvenance ?? [];
  const fields = (envelope.payload.fields ?? []).map((f) => {
    const radar: Record<string, number> = {};
    for (const a of f.radar?.axes ?? []) {
      radar[a.dimensionCode] = a.relativeCoverage;
    }
    const dominant =
      [...(f.radar?.axes ?? [])].sort(
        (a, b) => b.relativeCoverage - a.relativeCoverage,
      )[0] ?? null;
    return {
      fieldCode: f.fieldCode,
      role: f.role,
      specialties: f.specialties.map((s) => s.specialtyCode),
      skills: f.skills.map((sk) => ({
        skillCode: sk.skillCode,
        name: sk.name,
        parentSpecialtyCode: sk.parentSpecialtyCode,
      })),
      tools: f.toolsTechnologies,
      evidenceVolume: f.evidenceVolume,
      radar,
      vdRadar: Object.fromEntries(
        VD_AXES.map((code) => [code, radar[code] ?? null]),
      ),
      dominantRadar: dominant
        ? { code: dominant.dimensionCode, coverage: dominant.relativeCoverage }
        : null,
    };
  });
  return {
    r1Status: envelope.payload.r1FieldResolutionStatus,
    resolvedFields: resolved,
    publishableFields: fields.map((f) => f.fieldCode),
    hiddenFields: resolved
      .filter((r) => r.publicationStatus === 'PROVENANCE_ONLY')
      .map((r) => ({
        fieldCode: r.fieldCode,
        role: r.role,
        reasonCode: r.reasonCode,
      })),
    fields,
    warnings: (envelope.warnings ?? []).map((w) => w.code),
  };
}

async function processCase(args: {
  caseId: string;
  document: string;
  selectionRole: string;
  gem: Record<string, string>;
  mde: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
}): Promise<Record<string, unknown>> {
  const { caseId, document, selectionRole, gem, mde } = args;

  const dsP0 = await createMdeDataSource(mde);
  const p0 = createP0Service(dsP0, mde);
  const rows = await dsP0.query(
    `
    SELECT p.id AS person_id, pc.id AS person_cv_id
    FROM core.person p
    LEFT JOIN organigrama.person_cv pc
      ON pc.person_id = p.id AND pc.is_active = true
    WHERE p.document = $1
    LIMIT 1
    `,
    [document],
  );
  const row = rows?.[0];
  if (!row?.person_cv_id) {
    await dsP0.destroy();
    return { caseId, status: 'PROCESSING_ERROR', error: 'PERSON_CV_NOT_FOUND' };
  }
  const personId = String(row.person_id);
  const personCvId = Number(row.person_cv_id);
  const p0Result = await p0.createOrReuseFromPersonCv(personCvId);
  const snapshotId = String(p0Result.snapshotId);
  const p0Origin = p0Result.outcome === 'CREATED' ? 'CREATED' : 'REUSED_VALID';
  await dsP0.destroy();

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

  try {
    const snap = (
      await ds.query(
        `SELECT id::text AS id, normalized_text, pages, sectioned_content,
                parse_status, page_count, length(normalized_text) AS nlen
           FROM organigrama.mc_cv_snapshot WHERE id = $1`,
        [snapshotId],
      )
    )[0];
    if (!snap?.normalized_text || snap.parse_status !== 'PARSED') {
      throw new Error(`SNAPSHOT_NOT_READY:${snapshotId}`);
    }

    const stamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const prototypeId = `P1P-V11-6I-S${snapshotId}-${stamp}-${randomUUID().slice(0, 8)}`;
    const outDir = resolve(ROOT, 'tmp', 'mc1-p1-prototype', prototypeId);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, 'prototype-manifest.json'),
      JSON.stringify(
        {
          classification: 'CONFIDENTIAL',
          operationType: 'P1_12C_VD_SECOND_COHORT_LIVE',
          prototypeId,
          snapshotId: String(snapshotId),
          contractVersion: '2.0.0',
          segmenterVersion: P1_SEGMENTER_VERSION,
          promptVersion: P1_PROMPT_VERSION,
          modelProvider: 'google-genai',
          modelVersion: gem.GEMINI_MODEL || 'gemini-3.6-flash',
          startedAt: new Date().toISOString(),
          persistence: 'NONE',
          resultOrigin: 'LIVE',
        },
        null,
        2,
      ),
      'utf8',
    );

    const pages =
      typeof snap.pages === 'string' ? JSON.parse(snap.pages) : snap.pages;
    const sectioned =
      typeof snap.sectioned_content === 'string'
        ? JSON.parse(snap.sectioned_content)
        : snap.sectioned_content;

    const p1Result = await runP1ForMember({
      prototypeId,
      snapshotId: String(snapshotId),
      normalizedText: snap.normalized_text,
      pages,
      sectionedContent: sectioned,
      apiKey: gem.GEMINI_API_KEY,
      model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
      outDir,
    });
    if (!p1Result.ok) {
      throw new Error(`P1_FAILED:${p1Result.errorCode ?? p1Result.status}`);
    }

    const batchesFile = JSON.parse(
      readFileSync(join(outDir, 'batches.json'), 'utf8'),
    ) as { batches: Array<{ batchId: string; candidateIds: string[] }> };
    const candToBatch = new Map<string, string>();
    for (const b of batchesFile.batches) {
      for (const id of b.candidateIds) candToBatch.set(id, b.batchId);
    }
    const decisions = [...p1Result.decisions.entries()].map(
      ([candidateId, decision]) => ({
        candidateId,
        decision,
        reasonCode:
          decision === 'REVIEW_REQUIRED'
            ? 'NEEDS_REVIEW'
            : String(decision).startsWith('REJECTED')
              ? 'REJECTED'
              : 'OK',
        batchId: candToBatch.get(candidateId) ?? 'unknown',
      }),
    );
    writeFileSync(
      join(outDir, 'decisions.json'),
      JSON.stringify({ decisions }, null, 2),
      'utf8',
    );

    const units = p1Result.units ?? [];
    const p1Stats = {
      candidates: p1Result.candidateCount,
      evidenceUnits: units.length,
      explicit: units.filter((u) => u.explicitness === 'EXPLICIT').length,
      stronglySupported: units.filter(
        (u) => u.explicitness === 'STRONGLY_SUPPORTED',
      ).length,
      batches: p1Result.batchCount,
      reviewRequired: decisions.filter((d) => d.decision === 'REVIEW_REQUIRED')
        .length,
      executionId: prototypeId,
      geminiInvoked: true,
      resultOrigin: 'LIVE' as const,
    };

    const p2 = await runP2ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
      outRoot: resolve(ROOT, 'tmp', 'mc1-p2-functional'),
    });

    const r1 = runR1ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      p2PackDir: p2.outDir,
    });
    const r1p = r1.envelope.payload;
    const primary = r1p.primaryField?.fieldCode ?? null;
    const secondaries = (r1p.secondaryFields ?? []).map((f) => ({
      code: f.fieldCode,
      confidence: f.confidence,
    }));

    const inScope =
      (primary && SPECIALTY_CATALOG_SCOPE.has(primary)) ||
      secondaries.some((f) => !!f.code && SPECIALTY_CATALOG_SCOPE.has(f.code));

    const p3 = await runP3ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
      outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
      r1PackDir: r1.outDir,
    });

    const p3ByField: Record<
      string,
      { observed: string[]; weak: string[] }
    > = {};
    for (const fr of p3.envelope.payload.fieldResults ?? []) {
      const observed: string[] = [];
      const weak: string[] = [];
      for (const s of fr.observedSpecialties ?? []) {
        if (s.status === 'OBSERVED') observed.push(s.specialtyCode);
        if (s.status === 'WEAK') weak.push(s.specialtyCode);
      }
      p3ByField[fr.fieldCode] = { observed, weak };
    }

    const p4 = await runP4ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
      outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
      r1PackDir: r1.outDir,
      p3PackDir: p3.outDir,
    });

    const p4Rows = (p4.envelope.payload.specialtyResults ?? []).map((sr) => ({
      fieldCode: sr.fieldCode,
      specialtyCode: sr.specialtyCode,
      skillsObserved: (sr.observedSkills ?? [])
        .filter((sk) => sk.status === 'OBSERVED')
        .map((sk) => sk.skillCode || sk.name),
      skillNames: (sr.observedSkills ?? [])
        .filter((sk) => sk.status === 'OBSERVED')
        .map((sk) => sk.name),
      tools: [
        ...new Set(
          (sr.observedSkills ?? []).flatMap(
            (sk) => sk.toolOrTechnologySignals ?? [],
          ),
        ),
      ],
    }));

    const profile = await runProfilePilot({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
      dataSource: ds,
      r1PackDir: r1.outDir,
      p3PackDir: p3.outDir,
      p4PackDir: p4.outDir,
    });

    writeBinding(caseId, snapshotId);
    writePersonSnapshotIndex(personId, snapshotId, caseId);

    const reader = await readMc1PersonProfile({
      personId,
      dataSource: ds,
      backendRoot: ROOT,
    });

    return {
      caseId,
      label: LABEL[caseId] ?? caseId,
      selectionRole,
      status: 'DONE',
      personId,
      personCvId,
      snapshotId,
      p0: p0Origin,
      p0Meta: {
        parseStatus: snap.parse_status,
        pageCount: snap.page_count,
        normalizedLen: snap.nlen,
        fidelity:
          snap.parse_status === 'PARSED' && Number(snap.nlen) > 500
            ? 'HIGH_FIDELITY'
            : 'CHECK',
      },
      p1: { origin: 'LIVE', packDir: outDir, ...p1Stats },
      p2: {
        origin: 'LIVE',
        packDir: p2.outDir,
        geminiInvoked: !!p2.geminiInvoked,
        resultOrigin: p2.geminiInvoked ? 'LIVE' : 'NONE',
        candidates: p2.envelope.payload.domainCandidates.map((c) => ({
          domainCode: c.domainCode,
          status: c.candidateStatus,
          confidence: c.confidence,
        })),
      },
      r1: {
        origin: 'CREATED',
        packDir: r1.outDir,
        status: r1p.fieldResolutionStatus,
        primary,
        secondaries,
        decisionCodes: r1p.decisionCodes,
      },
      p3: {
        origin: inScope ? 'LIVE' : 'LIVE_OR_ABSTAIN',
        packDir: p3.outDir,
        geminiInvoked: !!p3.geminiInvoked,
        resultOrigin: p3.geminiInvoked ? 'LIVE' : 'NONE',
        byField: p3ByField,
      },
      p4: {
        origin: 'LIVE',
        packDir: p4.outDir,
        geminiInvoked: !!p4.geminiInvoked,
        resultOrigin: p4.geminiInvoked ? 'LIVE' : 'NONE',
        specialtyResults: p4Rows,
      },
      profile: {
        origin: 'CREATED',
        packDir: profile.outDir,
        summary: summarizeProfile(profile.envelope),
      },
      personDetail: {
        status: reader.status,
        tabs:
          reader.status === 'AVAILABLE'
            ? reader.presentation.fields.map((f) => ({
                code: f.code,
                role: f.role,
                specialtyCount: f.specialties?.length ?? 0,
                toolCount: f.tools?.length ?? 0,
                radarAxes: f.competencyMap?.dimensions?.length ?? 0,
              }))
            : [],
        fallbackLegacy: false,
      },
    };
  } finally {
    await ds.destroy();
  }
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'REQUIRES_CONFIRM' }));
    process.exit(2);
  }
  const only = process.argv
    .find((a) => a.startsWith('--only='))
    ?.split('=')[1]
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

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

  const mdeEnv = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const gem = loadEnvFile(
    resolve(ROOT, 'secrets/mc1-p1-prototype.local.env'),
    new Set(['GEMINI_API_KEY', 'GEMINI_MODEL']),
  );
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

  const cases = COHORT.filter((c) => !only || only.includes(c.caseId));
  const results: unknown[] = [];
  for (const c of cases) {
    try {
      const r = await processCase({
        caseId: c.caseId,
        document: c.document,
        selectionRole: c.selectionRole,
        gem,
        mde,
      });
      results.push(r);
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          progress: c.caseId,
          status: (r as { status?: string }).status,
        }),
      );
    } catch (e) {
      results.push({
        caseId: c.caseId,
        label: LABEL[c.caseId],
        selectionRole: c.selectionRole,
        status: 'PROCESSING_ERROR',
        error: String(e instanceof Error ? e.message : e).slice(0, 400),
      });
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    phase: '12C',
    mode: 'LIVE_GEMINI_FULL_PIPELINE',
    status: 'DONE',
    model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
    parentId: 1206,
    fieldPublicationGate: 'MC1.PROFILE.PUBLICATION_GATE.1.0.0',
    cohort: COHORT,
    results,
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      status: 'FAILED',
      error: String(e instanceof Error ? e.message : e).slice(0, 500),
    }),
  );
  process.exit(1);
});
