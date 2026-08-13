/**
 * Cohorte Líder de Servicio (Ingrid + hijos directos v4) — LIVE full pipeline.
 * Catálogo vigente 1.9.0 (incl. CUSTOMER_SUCCESS). Sin modificar MC1.
 *
 *   node scripts/mc1-service-lookup.js
 *   node scripts/mc1-service-bootstrap.js
 *   npx ts-node --transpile-only scripts/mc1-service-cohort.ts --confirm
 *
 * Un fallo individual no detiene la cohorte. EMPTY_DOCUMENT → recuperación documental.
 * Cloud writes solo en reasociación documental inequívoca. No deploy.
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
import { tryRecoverEmptyDocument } from './mc1-service-doc-recovery';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-service-cohort');
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

type CohortMember = {
  personId: string;
  personCvId: number;
  label: string;
  selectionRole: string;
  caseId: string;
  cohortRole: 'LEADER' | 'MEMBER';
  document: string | null;
};

function loadCohortFromLookup(): CohortMember[] {
  const lookupPath = join(OUT_DIR, 'lookup.json');
  if (!existsSync(lookupPath)) {
    throw new Error('Missing lookup.json — run mc1-service-lookup.js first');
  }
  const lookup = JSON.parse(readFileSync(lookupPath, 'utf8')) as {
    cohort: Array<{
      personId: number;
      personCvId: number | null;
      fullName: string;
      document: string | null;
      role: string;
      selectionRole: string;
      caseId: string;
    }>;
  };
  return lookup.cohort
    .filter((c) => c.personCvId)
    .map((c) => ({
      personId: String(c.personId),
      personCvId: Number(c.personCvId),
      label: c.fullName,
      selectionRole: c.selectionRole,
      caseId: c.caseId,
      cohortRole: c.role === 'LEADER' ? 'LEADER' : 'MEMBER',
      document: c.document ?? null,
    }));
}

const COHORT: CohortMember[] = loadCohortFromLookup();

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
    phase: 'SERVICE_LEADER_COHORT',
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
    { re: /vinculaci[oó]n|admisi[oó]n|matr[ií]cula|inscripci[oó]n/, label: 'vinculación/admisión' },
    { re: /crm|salesforce|hubspot|pipeline comercial/, label: 'CRM/comercial' },
    { re: /atenci[oó]n al cliente|servicio al cliente|call center|contact center/, label: 'atención al cliente' },
    { re: /ventas|comercial|b2b|negociaci[oó]n/, label: 'ventas/B2B' },
    { re: /gesti[oó]n documental|tramites|tr[aá]mites|oficina/, label: 'gestión documental/trámites' },
    { re: /educaci[oó]n|formaci[oó]n|capacitaci[oó]n|docencia/, label: 'educación' },
    { re: /marketing|campa[nñ]a|redes sociales/, label: 'marketing' },
    { re: /datos|analytics|excel|power bi|sql/, label: 'datos/analytics' },
    { re: /administraci[oó]n|finanzas|contabilidad|facturaci[oó]n/, label: 'admin/finanzas' },
    { re: /proyecto|coordinaci[oó]n|liderazgo|supervisi[oó]n/, label: 'coordinación/supervisión' },
  ];
  for (const p of patterns) {
    if (p.re.test(text)) hints.push(p.label);
  }
  if (!hints.length) {
    hints.push(`prácticas asociadas a ${domainCode} (revisar CV)`);
  }
  return hints.slice(0, 8);
}

async function processPerson(args: {
  member: CohortMember;
  gem: Record<string, string>;
  mde: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  frozen: ReturnType<typeof buildFrozenConfig>;
  model: string;
}): Promise<Record<string, unknown>> {
  const { member, gem, mde, frozen, model } = args;

  let docRecovery: unknown = null;
  const dsP0 = await createMdeDataSource(mde);
  let p0 = createP0Service(dsP0, mde);
  let p0Result = await p0.createOrReuseFromPersonCv(member.personCvId);
  let snapshotId = String(p0Result.snapshotId);
  let p0Origin = p0Result.outcome === 'CREATED' ? 'CREATED' : 'REUSED_VALID';

  // Inspect parse_status; recover if EMPTY / SCANNED
  const snapCheck = (
    await dsP0.query(
      `SELECT parse_status, length(COALESCE(normalized_text,'')) AS nlen
         FROM organigrama.mc_cv_snapshot WHERE id = $1`,
      [snapshotId],
    )
  )[0] as { parse_status?: string; nlen?: string } | undefined;

  if (
    snapCheck &&
    (snapCheck.parse_status === 'EMPTY_DOCUMENT' ||
      snapCheck.parse_status === 'SCANNED_OR_IMAGE_ONLY' ||
      Number(snapCheck.nlen || 0) < 200)
  ) {
    const recovery = await tryRecoverEmptyDocument({
      personId: Number(member.personId),
      personCvId: member.personCvId,
      fullName: member.label,
      document: member.document,
      backendRoot: ROOT,
      outDir: join(OUT_DIR, 'doc-recovery'),
    });
    docRecovery = recovery;
    if (recovery.status === 'RECOVERED') {
      p0 = createP0Service(dsP0, mde);
      p0Result = await p0.createOrReuseFromPersonCv(member.personCvId);
      snapshotId = String(p0Result.snapshotId);
      p0Origin = p0Result.outcome === 'CREATED' ? 'CREATED' : 'REUSED_VALID';
    }
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
    const snap = (
      await ds.query(
        `SELECT id::text AS id, normalized_text, pages, sectioned_content,
                parse_status, page_count, length(normalized_text) AS nlen
           FROM organigrama.mc_cv_snapshot WHERE id = $1`,
        [snapshotId],
      )
    )[0];
    if (!snap?.normalized_text || Number(snap.nlen) < 200) {
      throw new Error(
        `SNAPSHOT_NOT_READY:${snapshotId}:status=${snap?.parse_status}:nlen=${snap?.nlen}`,
      );
    }
    if (
      snap.parse_status !== 'PARSED' &&
      snap.parse_status !== 'PARTIAL'
    ) {
      throw new Error(
        `SNAPSHOT_NOT_READY:${snapshotId}:status=${snap?.parse_status}:nlen=${snap?.nlen}`,
      );
    }

    const stamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const prototypeId = `P1P-SVC-S${snapshotId}-${stamp}-${randomUUID().slice(0, 8)}`;
    const p1OutDir = resolve(ROOT, 'tmp', 'mc1-p1-prototype', prototypeId);
    mkdirSync(p1OutDir, { recursive: true });
    writeFileSync(
      join(p1OutDir, 'prototype-manifest.json'),
      JSON.stringify(
        {
          classification: 'CONFIDENTIAL',
          operationType: 'P1_SERVICE_COHORT_LIVE',
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

    const pagesRaw =
      typeof snap.pages === 'string' ? JSON.parse(snap.pages) : snap.pages;
    const sectioned =
      typeof snap.sectioned_content === 'string'
        ? JSON.parse(snap.sectioned_content)
        : snap.sectioned_content;

    // PARTIAL / empty trailing pages: drop pages without text so P1 pageCoverageRatio=1.
    let pages = pagesRaw;
    if (Array.isArray(pagesRaw)) {
      const nonEmpty = pagesRaw.filter(
        (p: { text?: string; characterCount?: number }) =>
          Number(p?.characterCount ?? 0) > 0 ||
          String(p?.text || '').trim().length > 0,
      );
      if (nonEmpty.length > 0 && nonEmpty.length < pagesRaw.length) {
        pages = nonEmpty;
      }
    }

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

    let p3: Awaited<ReturnType<typeof runP3ArtifactOnly>> | null = null;
    let p4: Awaited<ReturnType<typeof runP4ArtifactOnly>> | null = null;
    const p3ByField: Record<string, { observed: string[]; weak: string[] }> =
      {};
    let p4Rows: Array<{
      fieldCode: string;
      specialtyCode: string;
      skillsObserved: string[];
      tools: string[];
    }> = [];
    let specialtiesEvaluated: unknown[] = [];
    let routingCandidates: string[] = [];

    // Always run P3/P4 runners (abstain when out of scope); only mark LIVE when in-scope.
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
    routingCandidates = (
      specialtiesEvaluated as Array<{
        evaluationRole?: string;
        specialtyCode: string;
      }>
    )
      .filter((s) => s.evaluationRole === 'ROUTING_CANDIDATE')
      .map((s) => s.specialtyCode);

    const profile = await runProfilePilot({
      backendRoot: ROOT,
      snapshotId,
      outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
      dataSource: ds,
      r1PackDir: r1.outDir,
      p3PackDir: p3.outDir,
      p4PackDir: p4.outDir,
    });

    writeBinding(member.caseId, snapshotId);
    writePersonSnapshotIndex(member.personId, snapshotId, member.caseId);

    const reader = await readMc1PersonProfile({
      personId: member.personId,
      dataSource: ds,
      backendRoot: ROOT,
      allowArtifactLocal: true,
    });
    const profileSummary = summarizeProfile(profile.envelope);
    const anomalies: Array<{ code: string; detail: string }> = [];

    for (const code of taxonomyPendingFields) {
      anomalies.push({
        code: 'NEW_DOMAIN_TAXONOMY_PENDING',
        detail: `Field ${code} resolved by R1 without specialty catalog; P3/P4 skipped for this Field`,
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
    if (p1Stats.inferred > 0) {
      anomalies.push({
        code: 'P1_EXTRACTION_DRIFT',
        detail: `INFERRED_PRESENT:${p1Stats.inferred}`,
      });
    }

    const domainPracticeNotes = taxonomyPendingFields.map((code) => ({
      fieldCode: code,
      practicesFromCv: extractDomainPracticeHints(
        String(snap.normalized_text),
        code,
      ),
    }));

    const primaryGate = profileSummary.fields.find((f) => f.role === 'PRIMARY')
      ?.publicationGate;

    let personDecision: string;
    if (primaryTaxonomyPending) {
      personDecision = 'TAXONOMY_PENDING';
    } else if (
      anomalies.some((a) =>
        ['PUBLICATION_DRIFT', 'RADAR_DRIFT', 'P1_EXTRACTION_DRIFT'].includes(
          a.code,
        ),
      )
    ) {
      personDecision = 'VALIDATED_WITH_DRIFT';
    } else if (taxonomyPendingFields.length) {
      personDecision = 'VALIDATED_WITH_DRIFT';
    } else {
      personDecision = 'VALIDATED';
    }

    return {
      caseId: member.caseId,
      label: member.label,
      selectionRole: member.selectionRole,
      cohortRole: member.cohortRole,
      status: 'DONE',
      personDecision,
      personId: member.personId,
      personCvId: member.personCvId,
      snapshotId,
      p0: p0Origin,
      docRecovery,
      configFingerprint: frozen.configFingerprint,
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
        primaryTaxonomyPending,
        pendingFields: taxonomyPendingFields,
        inScopeFields,
        domainPracticeNotes,
      },
      p3: {
        origin: inScopeFields.length ? 'LIVE' : 'ABSTAINED_TAXONOMY_PENDING',
        packDir: p3.outDir,
        geminiInvoked: !!p3.geminiInvoked,
        byField: p3ByField,
        skippedFields: taxonomyPendingFields,
      },
      p4: {
        origin: inScopeFields.length ? 'LIVE' : 'ABSTAINED_TAXONOMY_PENDING',
        packDir: p4.outDir,
        geminiInvoked: !!p4.geminiInvoked,
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
        personDecision,
        readerStatus: reader.status,
        primary,
        primaryGateReason: primaryGate?.reasonCode ?? null,
        taxonomyPending: primaryTaxonomyPending,
      },
    };
  } finally {
    await ds.destroy();
  }
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        hint: 'node scripts/mc1-service-lookup.js && node scripts/mc1-service-bootstrap.js && npx ts-node --transpile-only scripts/mc1-service-cohort.ts --confirm',
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
  process.env.NODE_ENV = 'development';
  process.env.MC1_ALLOW_ARTIFACT_LOCAL = 'true';

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

  const onlyEnv = process.env.MC1_SERVICE_ONLY?.trim();
  const onlyIds = onlyEnv
    ? new Set(onlyEnv.split(/[,\s]+/).filter(Boolean))
    : null;
  const members = onlyIds
    ? COHORT.filter((m) => onlyIds.has(m.personId))
    : COHORT;

  const priorPath = join(OUT_DIR, 'cohort-report.json');
  const priorResults: Array<Record<string, unknown>> =
    onlyIds && existsSync(priorPath)
      ? (
          JSON.parse(readFileSync(priorPath, 'utf8')) as {
            results: Array<Record<string, unknown>>;
          }
        ).results.filter((r) => !onlyIds.has(String(r.personId)))
      : [];

  const lookup = existsSync(join(OUT_DIR, 'lookup.json'))
    ? JSON.parse(readFileSync(join(OUT_DIR, 'lookup.json'), 'utf8'))
    : { expected: 15, found: members.length, withoutCv: [] };

  const results: Array<Record<string, unknown>> = [...priorResults];

  // Register without-CV as SKIPPED (do not stop cohort)
  if (!onlyIds) {
    for (const w of lookup.withoutCv || []) {
      results.push({
        personId: String(w.personId),
        label: w.fullName,
        status: 'SKIPPED_NO_CV',
        personDecision: 'NEEDS_INTERVENTION',
        error: w.document
          ? 'NO_ACTIVE_PERSON_CV'
          : 'NO_DOCUMENT_AND_NO_CV',
        document: w.document ?? null,
      });
    }
  }

  for (const member of members) {
    console.error(`SERVICE_PROCESS ${member.personId} ${member.label}`);
    try {
      const r = await processPerson({ member, gem, mde, frozen, model });
      results.push(r);
      writeFileSync(
        join(OUT_DIR, `person-${member.personId}.json`),
        JSON.stringify(r, null, 2),
        'utf8',
      );
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e).slice(0, 400);
      // Last-chance EMPTY recovery if thrown before snap check
      if (/EMPTY_DOCUMENT|SNAPSHOT_NOT_READY/i.test(msg)) {
        try {
          const recovery = await tryRecoverEmptyDocument({
            personId: Number(member.personId),
            personCvId: member.personCvId,
            fullName: member.label,
            document: member.document,
            backendRoot: ROOT,
            outDir: join(OUT_DIR, 'doc-recovery'),
          });
          if (recovery.status === 'RECOVERED') {
            const r = await processPerson({ member, gem, mde, frozen, model });
            results.push({ ...r, docRecoveryRetry: recovery });
            writeFileSync(
              join(OUT_DIR, `person-${member.personId}.json`),
              JSON.stringify(results[results.length - 1], null, 2),
              'utf8',
            );
            continue;
          }
          results.push({
            caseId: member.caseId,
            label: member.label,
            personId: member.personId,
            personCvId: member.personCvId,
            status: 'ERROR',
            personDecision: 'CV_EXTRACTION_BLOCKED',
            error: msg,
            docRecovery: recovery,
          });
          continue;
        } catch (e2) {
          results.push({
            caseId: member.caseId,
            label: member.label,
            personId: member.personId,
            personCvId: member.personCvId,
            status: 'ERROR',
            personDecision: 'ERROR',
            error: `${msg} | recovery=${String(e2 instanceof Error ? e2.message : e2).slice(0, 200)}`,
          });
          continue;
        }
      }
      results.push({
        caseId: member.caseId,
        label: member.label,
        personId: member.personId,
        personCvId: member.personCvId,
        status: 'ERROR',
        personDecision: 'ERROR',
        error: msg,
      });
    }
  }

  // stable order by lookup cohort
  const orderIds = (lookup.cohort || []).map((c: { personId: number }) =>
    String(c.personId),
  );
  results.sort((a, b) => {
    const ia = orderIds.indexOf(String(a.personId));
    const ib = orderIds.indexOf(String(b.personId));
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });

  const domains = [
    ...new Set(
      results
        .map((r) => (r.r1 as { primary?: string } | undefined)?.primary)
        .filter(Boolean) as string[],
    ),
  ];
  const taxonomyPending = results.filter(
    (r) => r.personDecision === 'TAXONOMY_PENDING',
  );
  const withDrift = results.filter(
    (r) => r.personDecision === 'VALIDATED_WITH_DRIFT',
  );
  const validated = results.filter((r) => r.personDecision === 'VALIDATED');
  const errors = results.filter(
    (r) =>
      r.status === 'ERROR' ||
      r.personDecision === 'CV_EXTRACTION_BLOCKED' ||
      r.personDecision === 'ERROR',
  );
  const skipped = results.filter((r) => r.status === 'SKIPPED_NO_CV');
  const available = results.filter(
    (r) =>
      (r.personDetail as { status?: string } | undefined)?.status ===
        'AVAILABLE' ||
      (r.mc1ProfileFinalStatus as { readerStatus?: string } | undefined)
        ?.readerStatus === 'AVAILABLE',
  );

  let decision: string;
  if (taxonomyPending.length) {
    decision = 'SERVICE_COHORT_TAXONOMY_PENDING';
  } else if (withDrift.length || errors.length || skipped.length) {
    decision = 'SERVICE_COHORT_VALIDATED_WITH_DRIFT';
  } else if (
    validated.length + withDrift.length >=
    Number(lookup.withCv || members.length)
  ) {
    decision = 'SERVICE_COHORT_VALIDATED';
  } else {
    decision = 'SERVICE_COHORT_VALIDATED_WITH_DRIFT';
  }

  const compactRows = results.map((r) => {
    const p3 = (r.p3 as { byField?: Record<string, { observed: string[]; weak: string[] }> })
      ?.byField;
    const obs = p3
      ? Object.entries(p3).flatMap(([f, v]) =>
          (v.observed || []).map((s) => `${f}:${s}`),
        )
      : [];
    const weak = p3
      ? Object.entries(p3).flatMap(([f, v]) =>
          (v.weak || []).map((s) => `${f}:${s}`),
        )
      : [];
    const p4 = (
      r.p4 as { specialtyResults?: Array<{ skillsObserved?: string[] }> }
    )?.specialtyResults;
    const skills = p4?.flatMap((x) => x.skillsObserved || []) || [];
    const gate = (r.publicationGate as { reasonCode?: string } | null)
      ?.reasonCode;
    const radar = r.radar || null;
    return {
      persona: r.label,
      personId: r.personId,
      cv: r.personCvId ?? null,
      p1EU: (r.p1 as { evidenceUnits?: number } | undefined)?.evidenceUnits ?? null,
      r1: r.r1
        ? {
            primary: (r.r1 as { primary?: string }).primary,
            secondaries: (r.r1 as { secondaries?: unknown[] }).secondaries,
          }
        : null,
      p3Obs: obs,
      p3Weak: weak,
      p4Skills: skills,
      gate: gate ?? null,
      radar,
      estado: r.personDecision || r.status,
    };
  });

  const needsIntervention = results
    .filter(
      (r) =>
        r.status === 'SKIPPED_NO_CV' ||
        r.status === 'ERROR' ||
        r.personDecision === 'TAXONOMY_PENDING' ||
        r.personDecision === 'CV_EXTRACTION_BLOCKED' ||
        r.personDecision === 'NEEDS_INTERVENTION',
    )
    .map((r) => ({
      personId: r.personId,
      label: r.label,
      reason: r.personDecision || r.status,
      error: r.error ?? null,
    }));

  const report = {
    cloudWrites: results.some(
      (r) =>
        (r.docRecovery as { status?: string } | undefined)?.status ===
          'RECOVERED' ||
        (r.docRecoveryRetry as { status?: string } | undefined)?.status ===
          'RECOVERED',
    )
      ? 'DOC_RECOVERY_ONLY'
      : 0,
    decision,
    configFingerprint: frozen.configFingerprint,
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    expected: lookup.expected ?? 15,
    found: lookup.found ?? results.length,
    withCv: lookup.withCv ?? members.length,
    processed: results.filter((r) => r.status === 'DONE').length,
    profilesComplete: validated.length + withDrift.length,
    mc1ProfileAvailable: available.length,
    taxonomyPending: taxonomyPending.length,
    driftNonBlocking: withDrift.length,
    documentaryProblems: results.filter(
      (r) =>
        r.personDecision === 'CV_EXTRACTION_BLOCKED' ||
        r.status === 'SKIPPED_NO_CV',
    ).length,
    errors: errors.length,
    skippedNoCv: skipped.length,
    domainsFound: domains,
    taxonomyPendingDomains: [
      ...new Set(
        taxonomyPending.flatMap(
          (r) =>
            ((r.taxonomy as { pendingFields?: string[] })?.pendingFields ||
              []) as string[],
        ),
      ),
    ],
    needsIntervention,
    compactRows,
    results,
  };

  writeFileSync(join(OUT_DIR, 'cohort-report.json'), JSON.stringify(report, null, 2));
  writeFileSync(
    join(OUT_DIR, 'phase-verdict.json'),
    JSON.stringify(
      {
        decision,
        specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
        expected: report.expected,
        found: report.found,
        withCv: report.withCv,
        processed: report.processed,
        mc1ProfileAvailable: report.mc1ProfileAvailable,
        taxonomyPending: report.taxonomyPending,
        documentaryProblems: report.documentaryProblems,
        errors: report.errors,
        domainsFound: domains,
        needsIntervention,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(OUT_DIR, 'compact-summary.json'),
    JSON.stringify({ decision, compactRows, needsIntervention }, null, 2),
  );

  console.log(
    JSON.stringify(
      {
        decision,
        configFingerprint: frozen.configFingerprint,
        processed: report.processed,
        domainsFound: domains,
        taxonomyPendingDomains: report.taxonomyPendingDomains,
        needsIntervention,
        people: compactRows.map((r) => ({
          personId: r.personId,
          label: r.persona,
          status: r.estado,
          primary: r.r1?.primary ?? null,
        })),
        report: join(OUT_DIR, 'cohort-report.json'),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error('SERVICE_COHORT_FAIL', String(e?.stack || e).slice(0, 800));
  process.exit(1);
});
