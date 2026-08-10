/**
 * FASE 11A — Content Presenter cohort Field discovery (stop at R1).
 *
 *   npx ts-node --transpile-only scripts/mc1-field-discovery-11a.ts --confirm
 *   npx ts-node --transpile-only scripts/mc1-field-discovery-11a.ts --confirm --only=person-katherin-araque
 *
 * "Presentador de contenido" = selection criterion only — never P2 evidence.
 * No P3/P4/Profile. No Cloud. Role never enters P2 payload.
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
import {
  packHasDecisions,
  resolveCohortArtifactDir,
} from '../src/mc-pipeline/p1-persistence/p1-artifact-pack-loader';
import { runP2ArtifactOnly } from '../src/mc-pipeline/p2/p2-runner';
import { runR1ArtifactOnly } from '../src/mc-pipeline/r1/r1-runner';
import { SPECIALTY_CATALOG_SCOPE } from '../src/mc-pipeline/catalog/specialties-visual-education';
import {
  P1_PROMPT_VERSION,
  P1_SEGMENTER_VERSION,
} from '../src/mc-pipeline/p1/p1.types';
import { buildP2UserPayload } from '../src/mc-pipeline/p2/p2-prompt-v1';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-field-discovery-11a');
const REPORT_PATH = join(OUT_DIR, 'cohort-report.json');
const MANIFEST_PATH = join(OUT_DIR, 'cohort-manifest.json');
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

/** Documents server-side only — never print in report. */
const COHORT: Array<{ caseId: string; document: string; label: string }> = [
  {
    caseId: 'person-katherin-araque',
    document: '1000020890',
    label: 'Katherin',
  },
  {
    caseId: 'person-danna-fierro',
    document: '1013102120',
    label: 'Danna',
  },
  {
    caseId: 'person-linda-aguilera',
    document: '1072896519',
    label: 'Linda',
  },
  {
    caseId: 'person-alejandra-sanabria',
    document: '1013100614',
    label: 'Alejandra',
  },
];

const ORG_CONTEXT_KEYS = [
  'role',
  'jobTitle',
  'job_title',
  'cargo',
  'title',
  'organizationalUnit',
  'organizational_unit',
  'area',
  'supervisor',
  'manager',
  'jefe',
  'coordination',
  'coordinacion',
  'hierarchy',
  'jerarquia',
  'team',
  'equipo',
  'presentador',
  'content presenter',
];

/** Practice buckets — git-safe category labels only. */
const PRACTICE_BUCKETS: Array<{ code: string; re: RegExp }> = [
  {
    code: 'ON_CAMERA_PRESENTATION',
    re: /presentaci[oó]n|presentador|frente a c[aá]mara|on[\s-]?camera|conducci[oó]n|anfitri[oó]n|host|locuci[oó]n|vocer[ií]a/,
  },
  {
    code: 'INSTITUTIONAL_COMMUNICATIONS',
    re: /comunicaci[oó]n institucional|comunicaci[oó]n corporativa|relaciones p[uú]blicas|prensa|vocer[ií]a institucional/,
  },
  {
    code: 'AUDIOVISUAL_PRODUCTION_CRAFT',
    re: /producci[oó]n audiovisual|edici[oó]n de video|rodaje|filmaci[oó]n|c[aá]mara|iluminaci[oó]n|montaje|postproducci[oó]n|guion t[eé]cnico/,
  },
  {
    code: 'CONTENT_CREATION_GENERIC',
    re: /contenido digital|creaci[oó]n de contenido|content creat|piezas de contenido|publicaci[oó]n de contenido/,
  },
  {
    code: 'SCRIPT_WRITING',
    re: /guion|gui[oó]n|script|redacci[oó]n|copywriting|escritura/,
  },
  {
    code: 'INTERVIEW_MODERATION',
    re: /entrevista|moderaci[oó]n|panel|foro|mesa redonda/,
  },
  {
    code: 'DIGITAL_MARKETING_PRACTICE',
    re: /marketing|campa[nñ]a|audiencia|engagement|growth|performance|seo|sem|analytics|m[eé]tricas|conversi[oó]n|funnel/,
  },
  {
    code: 'SOCIAL_MEDIA_PUBLISHING',
    re: /redes sociales|instagram|tiktok|youtube|facebook|community|social media/,
  },
  {
    code: 'VISUAL_DESIGN_PRACTICE',
    re: /dise[nñ]o gr[aá]fico|dise[nñ]o visual|branding|identidad visual|ilustraci[oó]n/,
  },
  {
    code: 'EDUCATION_FACILITATION',
    re: /docencia|taller|capacitaci[oó]n|facilitaci[oó]n|formaci[oó]n|educaci[oó]n/,
  },
];

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

function specialtyCatalogStatus(fieldCode: string | null): string {
  if (!fieldCode) return 'MISSING';
  if (SPECIALTY_CATALOG_SCOPE.has(fieldCode)) return 'READY';
  return 'MISSING';
}

function auditP2PayloadShape(): {
  ORGANIZATIONAL_CONTEXT_IN_P2: boolean;
  keysFound: string[];
  CONTENT_PRESENTER_LABEL_IN_P2: boolean;
} {
  const sample = buildP2UserPayload({
    snapshotId: 'audit',
    p1ArtifactDigest: 'digest',
    units: [
      {
        evidenceUnitId: 'ceu_x',
        evidenceKind: 'ACTION',
        explicitness: 'EXPLICIT',
        pageNumber: 1,
        normalizedActivity: 'sample',
        object: null,
        toolOrMethod: null,
        result: null,
        scope: null,
        temporalContext: null,
      },
    ],
  });
  const parsed = JSON.parse(sample) as Record<string, unknown>;
  const blob = sample.toLowerCase();
  const keysFound: string[] = [];
  for (const k of ORG_CONTEXT_KEYS) {
    if (k in parsed || blob.includes(`"${k.toLowerCase()}"`)) {
      keysFound.push(k);
    }
  }
  return {
    ORGANIZATIONAL_CONTEXT_IN_P2: keysFound.length > 0,
    keysFound: [...new Set(keysFound)],
    CONTENT_PRESENTER_LABEL_IN_P2:
      blob.includes('presentador de contenido') ||
      blob.includes('content presenter'),
  };
}

function categorizePractices(p1Dir: string): {
  buckets: Record<string, { count: number; sampleUnitIds: string[] }>;
  evidenceKindCounts: Record<string, number>;
} {
  const buckets: Record<
    string,
    { count: number; sampleUnitIds: string[] }
  > = {};
  const evidenceKindCounts: Record<string, number> = {};
  try {
    const ve = JSON.parse(
      readFileSync(join(p1Dir, 'validated-evidence.json'), 'utf8'),
    ) as {
      units?: Array<{
        evidenceUnitId?: string;
        evidenceKind?: string;
        normalizedActivity?: string | null;
        object?: string | null;
        result?: string | null;
        toolOrMethod?: string | null;
      }>;
    };
    for (const u of ve.units ?? []) {
      const kind = u.evidenceKind ?? 'UNKNOWN';
      evidenceKindCounts[kind] = (evidenceKindCounts[kind] ?? 0) + 1;
      const blob = [
        u.normalizedActivity,
        u.object,
        u.result,
        u.toolOrMethod,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const id = u.evidenceUnitId ?? 'unknown';
      for (const b of PRACTICE_BUCKETS) {
        if (!b.re.test(blob)) continue;
        if (!buckets[b.code]) buckets[b.code] = { count: 0, sampleUnitIds: [] };
        buckets[b.code].count += 1;
        if (buckets[b.code].sampleUnitIds.length < 3) {
          buckets[b.code].sampleUnitIds.push(id);
        }
      }
    }
  } catch {
    /* optional */
  }
  return { buckets, evidenceKindCounts };
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

function mergePersonSnapshotIndex(
  rows: Array<{ personId: string; snapshotId: string; caseId: string }>,
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
  const now = new Date().toISOString();
  for (const r of rows) {
    current[String(r.personId)] = {
      snapshotId: String(r.snapshotId),
      caseId: r.caseId,
      boundAt: now,
    };
  }
  writeFileSync(INDEX_PATH, JSON.stringify(current, null, 2), 'utf8');
}

async function processCase(args: {
  caseId: string;
  document: string;
  label: string;
  gem: Record<string, string>;
  mde: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
}): Promise<Record<string, unknown>> {
  const { caseId, document, label, gem, mde } = args;

  const dsP0 = await createMdeDataSource(mde);
  const p0 = createP0Service(dsP0, mde);
  const rows = await dsP0.query(
    `
    SELECT
      p.id AS person_id,
      pc.id AS person_cv_id,
      (
        SELECT s.id::text
        FROM organigrama.mc_cv_snapshot s
        WHERE s.person_cv_id = pc.id AND s.parse_status = 'PARSED'
          AND s.normalized_text IS NOT NULL AND length(s.normalized_text) > 0
        ORDER BY s.created_at DESC NULLS LAST, s.id DESC
        LIMIT 1
      ) AS ready_snapshot_id
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
    return { caseId, label, status: 'BLOCKED', error: 'PERSON_CV_NOT_FOUND' };
  }
  const personId = String(row.person_id);
  const personCvId = Number(row.person_cv_id);
  let snapshotId = row.ready_snapshot_id ? String(row.ready_snapshot_id) : null;
  let p0Origin = 'REUSED_EXISTING_PARSED';
  if (!snapshotId) {
    const result = await p0.createOrReuseFromPersonCv(personCvId);
    snapshotId = String(result.snapshotId);
    p0Origin = result.outcome === 'CREATED' ? 'CREATED' : 'REUSED_P0';
  }
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
    let p1Dir = resolveCohortArtifactDir(ROOT, snapshotId!);
    let p1Origin = 'REUSED';
    let evidenceUnits = 0;
    let reviewRequired = 0;

    if (!p1Dir || !packHasDecisions(p1Dir)) {
      const snap = (
        await ds.query(
          `SELECT id::text AS id, normalized_text, pages, sectioned_content, parse_status
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
            operationType: 'P1_11A_FIELD_DISCOVERY',
            prototypeId,
            snapshotId: String(snapshotId),
            contractVersion: '2.0.0',
            segmenterVersion: P1_SEGMENTER_VERSION,
            promptVersion: P1_PROMPT_VERSION,
            modelProvider: 'google-genai',
            modelVersion: gem.GEMINI_MODEL || 'gemini-3.6-flash',
            startedAt: new Date().toISOString(),
            persistence: 'NONE',
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
      p1Dir = outDir;
      p1Origin = 'CREATED';
      evidenceUnits = p1Result.units?.length ?? 0;
      reviewRequired = decisions.filter(
        (d) => d.decision === 'REVIEW_REQUIRED',
      ).length;
    } else {
      try {
        const summary = JSON.parse(
          readFileSync(join(p1Dir, 'execution-summary.json'), 'utf8'),
        ) as { evidenceUnits?: number; reviewRequired?: number };
        evidenceUnits = summary.evidenceUnits ?? 0;
        reviewRequired = summary.reviewRequired ?? 0;
        if (!evidenceUnits) {
          const ve = JSON.parse(
            readFileSync(join(p1Dir, 'validated-evidence.json'), 'utf8'),
          ) as { units?: unknown[] };
          evidenceUnits = ve.units?.length ?? 0;
        }
      } catch {
        /* optional */
      }
    }

    const practices = categorizePractices(p1Dir!);

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

    let p1Digest: string | null = null;
    try {
      const prov = JSON.parse(
        readFileSync(join(p2.outDir, 'provenance.json'), 'utf8'),
      ) as {
        envelopeMeta?: { p1ArtifactDigest?: string };
      };
      p1Digest = prov.envelopeMeta?.p1ArtifactDigest ?? null;
    } catch {
      /* optional */
    }

    writeBinding(caseId, String(snapshotId));

    return {
      caseId,
      label,
      status: 'DONE',
      personId,
      personCvId,
      snapshotId,
      p0: p0Origin,
      p1: {
        origin: p1Origin,
        packDir: p1Dir,
        evidenceUnits,
        reviewRequired,
        artifactDigest: p1Digest,
      },
      p2: {
        origin: 'CREATED',
        packDir: p2.outDir,
        outcomeStatus: p2.envelope.payload.outcomeStatus,
        candidates: p2.envelope.payload.domainCandidates.map((c) => ({
          rank: c.rank,
          domainCode: c.domainCode,
          confidence: c.confidence,
          catalogStatus: c.catalogStatus,
          status: c.candidateStatus,
          ambiguityFlags: c.ambiguityFlags ?? [],
          supportCount: c.supportingEvidenceUnitIds?.length ?? 0,
        })),
      },
      r1: {
        origin: 'CREATED',
        packDir: r1.outDir,
        status: r1p.fieldResolutionStatus,
        resolutionStatus: r1p.resolutionStatus,
        primary,
        primaryConfidence: r1p.primaryField?.confidence ?? null,
        secondaries: (r1p.secondaryFields ?? []).map((f) => ({
          code: f.fieldCode,
          confidence: f.confidence,
        })),
        decisionCodes: r1p.decisionCodes,
      },
      taxonomy: {
        primaryField: primary,
        specialtyCatalog: specialtyCatalogStatus(primary),
        secondaryCatalogs: (r1p.secondaryFields ?? []).map((f) => ({
          field: f.fieldCode,
          specialtyCatalog: specialtyCatalogStatus(f.fieldCode),
        })),
      },
      practiceSignals: practices,
      p3: 'SKIPPED_STOP_AT_R1',
      p4: 'SKIPPED_STOP_AT_R1',
      profile: 'SKIPPED_STOP_AT_R1',
    };
  } finally {
    await ds.destroy();
  }
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(
      JSON.stringify({ status: 'BLOCKED', reason: 'REQUIRES_CONFIRM' }),
    );
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

  const antiBias = auditP2PayloadShape();
  const cases = COHORT.filter((c) => !only || only.includes(c.caseId));
  const results: unknown[] = [];

  for (const c of cases) {
    try {
      const r = await processCase({
        caseId: c.caseId,
        document: c.document,
        label: c.label,
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
        label: c.label,
        status: 'FAILED',
        error: String(e instanceof Error ? e.message : e).slice(0, 400),
      });
    }
  }

  mergePersonSnapshotIndex(
    (results as Array<Record<string, unknown>>)
      .filter((r) => r.personId && r.snapshotId)
      .map((r) => ({
        personId: String(r.personId),
        snapshotId: String(r.snapshotId),
        caseId: String(r.caseId),
      })),
  );

  mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    phase: '11A',
    mode: 'ARTIFACT_ONLY',
    status: 'DONE',
    stopAt: 'R1',
    selectionCriterion: 'CONTENT_PRESENTER_ORG_ROLE_EXTERNAL_ONLY',
    antiBias,
    results,
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(
    MANIFEST_PATH,
    JSON.stringify(
      {
        phase: '11A',
        cases: (results as Array<Record<string, unknown>>).map((r) => ({
          caseId: r.caseId,
          personId: r.personId,
          snapshotId: r.snapshotId,
          p1: (r.p1 as { packDir?: string })?.packDir ?? null,
          p2: (r.p2 as { packDir?: string })?.packDir ?? null,
          r1: (r.r1 as { packDir?: string })?.packDir ?? null,
        })),
      },
      null,
      2,
    ),
    'utf8',
  );
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
