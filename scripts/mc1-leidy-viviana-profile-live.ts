/**
 * LEIDY VIVIANA BERNAL LEÓN — LIVE full pipeline (catálogo 1.11.0).
 *
 *   node scripts/mc1-leidy-viviana-preflight.js
 *   npx ts-node --transpile-only scripts/mc1-leidy-viviana-profile-live.ts --confirm
 *
 * Solo Leidy (1077/182). Evidence-first: no asumir EDUCATION por cargo/área.
 * Cloud writes = 0. No procesa hijos. No foundations. No deploy.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
  SPECIALTY_CATALOG_SCOPE,
  SPECIALTY_CATALOG_VERSION,
} from '../src/mc-pipeline/catalog/specialties-visual-education';
import {
  P1_CONTRACT_VERSION,
  P1_PROMPT_VERSION,
  P1_SEGMENTER_VERSION,
} from '../src/mc-pipeline/p1/p1.types';
import { P2_CONTRACT_VERSION, P2_PROMPT_VERSION } from '../src/mc-pipeline/p2/p2.types';
import { R1_CONTRACT_VERSION } from '../src/mc-pipeline/r1/r1.types';
import { P3_CONTRACT_VERSION, P3_PROMPT_VERSION } from '../src/mc-pipeline/p3/p3.types';
import {
  P4_CONTRACT_VERSION,
  P4_PROMPT_VERSION,
  P4_ROUTING_POLICY_VERSION,
} from '../src/mc-pipeline/p4/p4.types';
import {
  PROFILE_CONTRACT_VERSION,
  type ProfilePilotEnvelope,
} from '../src/mc-pipeline/profile/profile.types';
import { PROFILE_RADAR_FORMULA_VERSION } from '../src/mc-pipeline/profile/profile-radar';
import { readMc1PersonProfile } from '../src/mc-pipeline/person-profile';
import { classifyFieldPublication } from '../src/mc-pipeline/profile/profile-publication-gate';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-leidy-viviana-profile');
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

const RADAR_MAPPER_VERSION = 'VD_MAPPER_12E_SEMANTIC_BLOB_V1';
const P0_VERSION = 'MC1.P0.SNAPSHOT.4D.2';

const LEIDY = {
  personId: '1077',
  personCvId: 182,
  label: 'LEIDY VIVIANA BERNAL LEÓN',
  document: '1070007550',
  selectionRole: 'COODINADOR OPERATIVO ACADEMICO',
  caseId: 'person-leidy-viviana-bernal-leon-1077',
  childrenExcluded: [
    '601', // Viviana Andrea Cabrera Cabrera
    '1078', // Maira Alejandra Doncel Largo
    '1079', // Andrés Felipe Prieto Lizarazo
    '1080', // Carlos Andres Rodriguez
    '1297', // Aura Marcela Royero Vergara
  ],
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

function buildFrozenConfig(model: string) {
  const config = {
    phase: 'LEIDY_VIVIANA_OPERACION_ACADEMICA',
    p0Version: P0_VERSION,
    p1SegmenterVersion: P1_SEGMENTER_VERSION,
    p1PromptVersion: P1_PROMPT_VERSION,
    p1ContractVersion: P1_CONTRACT_VERSION,
    geminiModel: model,
    p2Version: `${P2_CONTRACT_VERSION}/${P2_PROMPT_VERSION}`,
    r1Version: R1_CONTRACT_VERSION,
    p3Version: `${P3_CONTRACT_VERSION}/${P3_PROMPT_VERSION}`,
    p4Version: `${P4_CONTRACT_VERSION}/${P4_PROMPT_VERSION}`,
    p4RoutingPolicyVersion: P4_ROUTING_POLICY_VERSION,
    profileAssemblyVersion: PROFILE_CONTRACT_VERSION,
    radarFormulaVersion: PROFILE_RADAR_FORMULA_VERSION,
    radarMapperVersion: RADAR_MAPPER_VERSION,
    publicSkillFilter: 'OBSERVED_P3_PARENT_ONLY_12I',
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    specialtyCatalogScope: [...SPECIALTY_CATALOG_SCOPE].sort(),
  };
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(config))
    .digest('hex')
    .slice(0, 16);
  return { ...config, configFingerprint: fingerprint };
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
    const gate = classifyFieldPublication(f);
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
      publicationGate: gate,
      emptyTabRisk:
        f.specialties.length === 0 &&
        f.skills.length === 0 &&
        (f.toolsTechnologies?.length ?? 0) === 0 &&
        !gate.taxonomyPending,
    };
  });
  return {
    r1Status: envelope.payload.r1FieldResolutionStatus,
    resolvedFields: resolved,
    publishableFields: fields
      .filter((f) => f.publicationGate.status === 'PUBLISHABLE')
      .map((f) => f.fieldCode),
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

function extractDomainPracticeHints(
  normalizedText: string,
  domainCode: string,
): string[] {
  const text = normalizedText.toLowerCase();
  const hints: string[] = [];
  const patterns: Array<{ re: RegExp; label: string }> = [
    { re: /docencia|facilitaci[oó]n|dise[nñ]o instruccional|curr[ií]culo|evaluaci[oó]n del aprendizaje|pedagog/, label: 'práctica educativa (EDUCATION)' },
    { re: /gesti[oó]n acad[eé]mica|operaci[oó]n acad[eé]mica|registro|matr[ií]cula|admisi[oó]n/, label: 'operación/registros académicos' },
    { re: /procesos|documentaci[oó]n|seguimiento operativo|reporting|control|solicitudes/, label: 'admin/operaciones' },
    { re: /proyecto|PMP|scrum|agile|cronograma|programa/, label: 'gestión de proyectos' },
    { re: /servicio al cliente|atenci[oó]n|acompa[nñ]amiento|usuario|estudiante aspirante/, label: 'customer success / atención' },
    { re: /datos|analytics|bi |power bi|sql|dashboard|indicadores/, label: 'datos/analytics' },
    { re: /selecci[oó]n|reclutamiento|talento|recursos humanos|personal/, label: 'people/HR' },
    { re: /finanzas|presupuesto|facturaci[oó]n|compras|administraci[oó]n/, label: 'admin/finanzas' },
    { re: /software|desarrollo|programaci[oó]n|backend|frontend/, label: 'software' },
    { re: /marketing|campa[nñ]a|growth|seo|sem/, label: 'marketing digital' },
  ];
  for (const p of patterns) {
    if (p.re.test(text)) hints.push(p.label);
  }
  if (hints.length === 0) {
    hints.push(
      `prácticas textuales asociadas a candidato ${domainCode} (revisar CV completo)`,
    );
  }
  return hints.slice(0, 8);
}

function educationVsOpsControl(normalizedText: string) {
  const text = normalizedText.toLowerCase();
  const buckets = {
    A_educacion_practica: [] as string[],
    B_admin_operativa: [] as string[],
    C_ppm: [] as string[],
    D_customer_success: [] as string[],
    E_data_analytics: [] as string[],
    F_people_hr: [] as string[],
    G_other: [] as string[],
  };
  const checks: Array<{ bucket: keyof typeof buckets; re: RegExp; label: string }> = [
    { bucket: 'A_educacion_practica', re: /docencia|facilitaci[oó]n|dise[nñ]o instruccional|curr[ií]culo|evaluaci[oó]n del aprendizaje|pedagog[ií]a|clase|estudiantes en aula/, label: 'docencia/DI/currículo/evaluación' },
    { bucket: 'B_admin_operativa', re: /operaci[oó]n acad[eé]mica|procesos acad[eé]micos|registros?|documentaci[oó]n|seguimiento|reporting|control de|gesti[oó]n de solicitudes|coordinaci[oó]n operativa|matr[ií]cul/, label: 'operación/registros/procesos' },
    { bucket: 'C_ppm', re: /gesti[oó]n de proyectos|programas?|cronograma|pmo|scrum|agile|planificaci[oó]n estrat[eé]gica/, label: 'PPM' },
    { bucket: 'D_customer_success', re: /atenci[oó]n al|servicio al|acompa[nñ]amiento|experiencia del usuario|pqrs|mesa de ayuda/, label: 'atención/CS' },
    { bucket: 'E_data_analytics', re: /indicadores|dashboard|power bi|anal[ií]tica|sql|datos para decisi[oó]n/, label: 'datos/analytics' },
    { bucket: 'F_people_hr', re: /selecci[oó]n de personal|reclutamiento|recursos humanos|talento humano|vinculaci[oó]n de personal/, label: 'HR' },
  ];
  for (const c of checks) {
    if (c.re.test(text)) buckets[c.bucket].push(c.label);
  }
  return {
    note: 'Cargo/área/institución educativa NO son evidencia. Operación académica ≠ EDUCATION por defecto.',
    buckets,
    educationAssumedFromTitle: false,
  };
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        hint: 'node scripts/mc1-leidy-viviana-preflight.js && npx ts-node --transpile-only scripts/mc1-leidy-viviana-profile-live.ts --confirm',
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

  const model = gem.GEMINI_MODEL || 'gemini-3.6-flash';
  const frozen = buildFrozenConfig(model);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, 'frozen-config.json'),
    JSON.stringify(frozen, null, 2),
    'utf8',
  );

  const dsP0 = await createMdeDataSource(mde);
  const p0 = createP0Service(dsP0, mde);
  const p0Result = await p0.createOrReuseFromPersonCv(LEIDY.personCvId);
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
      const blocked = {
        cloudWrites: 0,
        decision: 'LEIDY_PROFILE_DOCUMENT_BLOCKED',
        personId: LEIDY.personId,
        personCvId: LEIDY.personCvId,
        snapshotId,
        parseStatus: snap?.parse_status ?? null,
        nlen: snap?.nlen ?? 0,
        reason:
          snap?.parse_status === 'EMPTY_DOCUMENT'
            ? 'EMPTY_DOCUMENT'
            : `SNAPSHOT_NOT_READY:${snap?.parse_status ?? 'MISSING'}`,
        childrenExcluded: LEIDY.childrenExcluded,
      };
      writeFileSync(
        join(OUT_DIR, 'leidy-viviana-profile-report.json'),
        JSON.stringify(blocked, null, 2),
        'utf8',
      );
      writeFileSync(
        join(OUT_DIR, 'phase-verdict.json'),
        JSON.stringify(blocked, null, 2),
        'utf8',
      );
      console.log(JSON.stringify(blocked, null, 2));
      return;
    }

    const identityText = String(snap.normalized_text).toLowerCase();
    const identityOk =
      (/leidy/.test(identityText) && /bernal/.test(identityText)) ||
      identityText.includes(LEIDY.document);
    if (!identityOk) {
      const blocked = {
        cloudWrites: 0,
        decision: 'LEIDY_PROFILE_DOCUMENT_BLOCKED',
        reason: 'IDENTITY_MISMATCH_PDF',
        personId: LEIDY.personId,
        personCvId: LEIDY.personCvId,
        snapshotId,
        childrenExcluded: LEIDY.childrenExcluded,
      };
      writeFileSync(
        join(OUT_DIR, 'leidy-viviana-profile-report.json'),
        JSON.stringify(blocked, null, 2),
        'utf8',
      );
      console.log(JSON.stringify(blocked, null, 2));
      return;
    }

    const stamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const prototypeId = `P1P-LEIDY-S${snapshotId}-${stamp}-${randomUUID().slice(0, 8)}`;
    const p1OutDir = resolve(ROOT, 'tmp', 'mc1-p1-prototype', prototypeId);
    mkdirSync(p1OutDir, { recursive: true });
    writeFileSync(
      join(p1OutDir, 'prototype-manifest.json'),
      JSON.stringify(
        {
          classification: 'CONFIDENTIAL',
          operationType: 'P1_LEIDY_LIVE',
          prototypeId,
          snapshotId,
          contractVersion: P1_CONTRACT_VERSION,
          segmenterVersion: P1_SEGMENTER_VERSION,
          promptVersion: P1_PROMPT_VERSION,
          modelProvider: 'google-genai',
          modelVersion: model,
          configFingerprint: frozen.configFingerprint,
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
      snapshotId,
      normalizedText: snap.normalized_text,
      pages,
      sectionedContent: sectioned,
      apiKey: gem.GEMINI_API_KEY,
      model,
      outDir: p1OutDir,
    });
    if (!p1Result.ok) {
      throw new Error(`P1_FAILED:${p1Result.errorCode ?? p1Result.status}`);
    }

    const batchesFile = JSON.parse(
      readFileSync(join(p1OutDir, 'batches.json'), 'utf8'),
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
      join(p1OutDir, 'decisions.json'),
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
      inferred: units.filter((u) => u.explicitness === 'INFERRED').length,
      reviewRequired: decisions.filter((d) => d.decision === 'REVIEW_REQUIRED')
        .length,
      batches: p1Result.batchCount,
      executionId: prototypeId,
      geminiInvoked: true,
      resultOrigin: 'LIVE' as const,
    };

    const p2 = await runP2ArtifactOnly({
      backendRoot: ROOT,
      snapshotId,
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model,
      outRoot: resolve(ROOT, 'tmp', 'mc1-p2-functional'),
    });

    const r1 = runR1ArtifactOnly({
      backendRoot: ROOT,
      snapshotId,
      p2PackDir: p2.outDir,
    });
    const r1p = r1.envelope.payload;
    const primary = r1p.primaryField?.fieldCode ?? null;
    const secondaries = (r1p.secondaryFields ?? []).map((f) => ({
      code: f.fieldCode,
      confidence: f.confidence,
    }));

    const r1Fields = [
      ...(primary ? [primary] : []),
      ...secondaries.map((s) => s.code).filter(Boolean),
    ] as string[];
    const taxonomyPendingFields = r1Fields.filter(
      (c) => !SPECIALTY_CATALOG_SCOPE.has(c),
    );
    const inScopeFields = r1Fields.filter((c) =>
      SPECIALTY_CATALOG_SCOPE.has(c),
    );
    const primaryTaxonomyPending =
      !!primary && !SPECIALTY_CATALOG_SCOPE.has(primary);
    const newDomainPending = taxonomyPendingFields.length > 0;

    let p3: Awaited<ReturnType<typeof runP3ArtifactOnly>> | null = null;
    let p4: Awaited<ReturnType<typeof runP4ArtifactOnly>> | null = null;
    const p3ByField: Record<
      string,
      { observed: string[]; weak: string[] }
    > = {};
    let p4Rows: Array<{
      fieldCode: string;
      specialtyCode: string;
      skillsObserved: string[];
      tools: string[];
    }> = [];
    let specialtiesEvaluated: unknown[] = [];
    let routingCandidates: string[] = [];

    if (inScopeFields.length > 0) {
      p3 = await runP3ArtifactOnly({
        backendRoot: ROOT,
        snapshotId,
        dataSource: ds,
        apiKey: gem.GEMINI_API_KEY,
        model,
        outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
        r1PackDir: r1.outDir,
      });
      for (const fr of p3.envelope.payload.fieldResults ?? []) {
        const observed: string[] = [];
        const weak: string[] = [];
        for (const s of fr.observedSpecialties ?? []) {
          if (s.status === 'OBSERVED') observed.push(s.specialtyCode);
          if (s.status === 'WEAK') weak.push(s.specialtyCode);
        }
        p3ByField[fr.fieldCode] = { observed, weak };
      }

      p4 = await runP4ArtifactOnly({
        backendRoot: ROOT,
        snapshotId,
        dataSource: ds,
        apiKey: gem.GEMINI_API_KEY,
        model,
        outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
        r1PackDir: r1.outDir,
        p3PackDir: p3.outDir,
      });
      p4Rows = (p4.envelope.payload.specialtyResults ?? []).map((sr) => ({
        fieldCode: sr.fieldCode,
        specialtyCode: sr.specialtyCode,
        skillsObserved: (sr.observedSkills ?? [])
          .filter((sk) => sk.status === 'OBSERVED')
          .map((sk) => sk.skillCode || sk.name),
        tools: [
          ...new Set(
            (sr.observedSkills ?? []).flatMap(
              (sk) => sk.toolOrTechnologySignals ?? [],
            ),
          ),
        ],
      }));
      specialtiesEvaluated = p4.envelope.payload.specialtiesEvaluated ?? [];
      routingCandidates = (specialtiesEvaluated as Array<{
        evaluationRole?: string;
        specialtyCode: string;
      }>)
        .filter((s) => s.evaluationRole === 'ROUTING_CANDIDATE')
        .map((s) => s.specialtyCode);
    }

    // Profile: if no in-scope P3/P4, still assemble from R1 (+ empty specialty packs via runner if needed)
    // When taxonomy-only, create minimal empty packs so profile can run on R1 provenance.
    let p3PackDir = p3?.outDir ?? null;
    let p4PackDir = p4?.outDir ?? null;
    if (!p3PackDir || !p4PackDir) {
      // Run P3/P4 artifact runners anyway — they abstain when fieldsToEvaluate empty.
      if (!p3) {
        p3 = await runP3ArtifactOnly({
          backendRoot: ROOT,
          snapshotId,
          dataSource: ds,
          apiKey: gem.GEMINI_API_KEY,
          model,
          outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
          r1PackDir: r1.outDir,
        });
        p3PackDir = p3.outDir;
      }
      if (!p4) {
        p4 = await runP4ArtifactOnly({
          backendRoot: ROOT,
          snapshotId,
          dataSource: ds,
          apiKey: gem.GEMINI_API_KEY,
          model,
          outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
          r1PackDir: r1.outDir,
          p3PackDir: p3PackDir!,
        });
        p4PackDir = p4.outDir;
      }
    }

    const profile = await runProfilePilot({
      backendRoot: ROOT,
      snapshotId,
      outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
      dataSource: ds,
      r1PackDir: r1.outDir,
      p3PackDir: p3PackDir!,
      p4PackDir: p4PackDir!,
    });

    writeBinding(LEIDY.caseId, snapshotId);
    writePersonSnapshotIndex(LEIDY.personId, snapshotId, LEIDY.caseId);

    const reader = await readMc1PersonProfile({
      personId: LEIDY.personId,
      dataSource: ds,
      backendRoot: ROOT,
    });

    const profileSummary = summarizeProfile(profile.envelope);
    const anomalies: Array<{ code: string; detail: string }> = [];

    for (const code of taxonomyPendingFields) {
      anomalies.push({
        code: 'NEW_DOMAIN_TAXONOMY_PENDING',
        detail: `Field ${code} resolved by R1 without specialty catalog; P3/P4 construction skipped for this Field`,
      });
    }
    for (const f of profileSummary.fields) {
      if (f.emptyTabRisk) {
        anomalies.push({
          code: 'PUBLICATION_DRIFT',
          detail: `empty publishable field ${f.fieldCode}`,
        });
      }
    }

    const domainPracticeNotes = taxonomyPendingFields.map((code) => ({
      fieldCode: code,
      practicesFromCv: extractDomainPracticeHints(
        String(snap.normalized_text),
        code,
      ),
    }));

    const hardDrift = anomalies.some((a) =>
      ['PUBLICATION_DRIFT', 'RADAR_DRIFT', 'P1_EXTRACTION_DRIFT'].includes(
        a.code,
      ),
    );

    let decision: string;
    if (primaryTaxonomyPending || (newDomainPending && inScopeFields.length === 0)) {
      decision = 'LEIDY_PROFILE_TAXONOMY_PENDING';
    } else if (hardDrift) {
      decision = 'LEIDY_PROFILE_VALIDATED_WITH_DRIFT';
    } else if (newDomainPending) {
      // primary in catalog but secondary new domain
      decision = 'LEIDY_PROFILE_VALIDATED_WITH_DRIFT';
      anomalies.push({
        code: 'TAXONOMY_GAP_SECONDARY',
        detail: `secondary fields pending taxonomy: ${taxonomyPendingFields.join(',')}`,
      });
    } else {
      decision = 'LEIDY_PROFILE_VALIDATED';
    }

    const primaryGate = profileSummary.fields.find((f) => f.role === 'PRIMARY')
      ?.publicationGate;

    const report = {
      cloudWrites: 0,
      decision,
      configFingerprint: frozen.configFingerprint,
      specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
      personId: LEIDY.personId,
      personCvId: LEIDY.personCvId,
      label: LEIDY.label,
      selectionRole: LEIDY.selectionRole,
      document: LEIDY.document,
      childrenExcluded: LEIDY.childrenExcluded,
      identityCheck: {
        ok: true,
        matchedNameTokens: true,
        matchedDocument: identityText.includes(LEIDY.document),
      },
      educationVsOpsControl: educationVsOpsControl(String(snap.normalized_text)),
      snapshotId,
      p0: p0Origin,
      p0Meta: {
        parseStatus: snap.parse_status,
        pageCount: snap.page_count,
        normalizedLen: snap.nlen,
      },
      p1: { origin: 'LIVE', packDir: p1OutDir, ...p1Stats },
      p2: {
        origin: 'LIVE',
        packDir: p2.outDir,
        geminiInvoked: !!p2.geminiInvoked,
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
      taxonomy: {
        newDomainPending,
        primaryTaxonomyPending,
        pendingFields: taxonomyPendingFields,
        inScopeFields,
        domainPracticeNotes,
      },
      p3: {
        origin: inScopeFields.length ? 'LIVE' : 'ABSTAINED_TAXONOMY_PENDING',
        packDir: p3PackDir,
        geminiInvoked: !!p3?.geminiInvoked,
        byField: p3ByField,
        skippedFields: taxonomyPendingFields,
      },
      p4: {
        origin: inScopeFields.length ? 'LIVE' : 'ABSTAINED_TAXONOMY_PENDING',
        packDir: p4PackDir,
        geminiInvoked: !!p4?.geminiInvoked,
        specialtiesEvaluated,
        routingCandidates,
        specialtyResults: p4Rows,
      },
      publicationGate: primaryGate ?? null,
      profile: {
        origin: 'CREATED',
        packDir: profile.outDir,
        summary: profileSummary,
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
      },
      radar: Object.fromEntries(
        (profileSummary.fields ?? []).map((f) => [f.fieldCode, f.radar]),
      ),
      anomalies,
      mc1ProfileFinalStatus: {
        decision,
        readerStatus: reader.status,
        primary,
        primaryGateReason: primaryGate?.reasonCode ?? null,
        taxonomyPending: primaryTaxonomyPending,
      },
    };

    writeFileSync(
      join(OUT_DIR, 'leidy-viviana-profile-report.json'),
      JSON.stringify(report, null, 2),
      'utf8',
    );
    writeFileSync(
      join(OUT_DIR, 'phase-verdict.json'),
      JSON.stringify(
        {
          decision,
          personId: LEIDY.personId,
          personCvId: LEIDY.personCvId,
          snapshotId,
          primary,
          taxonomyPendingFields,
          configFingerprint: frozen.configFingerprint,
          closedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      'utf8',
    );

    console.log(
      JSON.stringify(
        {
          decision,
          personId: LEIDY.personId,
          personCvId: LEIDY.personCvId,
          snapshotId,
          primary,
          secondaries,
          taxonomyPendingFields,
          p1EvidenceUnits: p1Stats.evidenceUnits,
          publicationGate: primaryGate?.reasonCode ?? null,
          configFingerprint: frozen.configFingerprint,
          report: join(OUT_DIR, 'leidy-viviana-profile-report.json'),
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
  console.error('LEIDY_PROFILE_FAIL', String(e?.stack || e).slice(0, 800));
  process.exit(1);
});
