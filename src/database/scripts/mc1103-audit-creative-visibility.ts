/**
 * MC1.10.3 — Diagnóstico de visibilidad de competencias (equipo creativo focal).
 *
 * npm run mc:audit-creative-visibility
 * npm run mc:audit-creative-visibility -- --documents=1015482688,1032488010 --api-check --export-json
 * npm run mc:audit-creative-visibility -- --repair-nidia
 * npm run mc:audit-creative-visibility -- --dry-run-repair
 * npm run mc:audit-creative-visibility -- --reevaluate-ginna
 * npm run mc:audit-creative-visibility -- --persist-ginna
 * npm run mc:audit-creative-visibility -- --browser-check
 *
 * Read-only por defecto (5 documentos focal). --repair-nidia solo con flag explícito.
 * --reevaluate-ginna / --persist-ginna: MC1.10.4 Ginna (1030646495), sin mappings/umbrales.
 * --browser-check: recordatorio E2E Frontend (no ejecuta browser desde backend).
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { McCatalogModule } from '../../mc-catalog/mc-catalog.module';
import { McPa2Service } from '../../mc-catalog/mc-pa2.service';
import type { McPa2EngineRunResult } from '../../mc-catalog/mc-pa2.types';
import { OrgChartCompetenciesService } from '../../org-chart/org-chart-competencies.service';
import type { OrgViewerContext } from '../../org-chart/org-viewer-context';
import { DataSource } from 'typeorm';

const TAG = '[MC1.10.3]';
const TAG_GINNA = '[MC1.10.4]';

const NIDIA_DOCUMENT = '1015482688';
const GINNA_DOCUMENT = '1030646495';

const DEFAULT_DOCUMENTS = [
  NIDIA_DOCUMENT,
  '1032488010',
  '1022445625',
  '1000944247',
  '1030646495',
];

const REPAIR_DOMAIN_RULES: ReadonlyArray<{
  domainCode: string;
  rulesVersion: string;
}> = [
  { domainCode: 'VISUAL_DESIGN', rulesVersion: 'pa2-visual-design-1.1.0' },
  {
    domainCode: 'AUDIOVISUAL_PRODUCTION',
    rulesVersion: 'pa2-audiovisual-production-1.0.0',
  },
  { domainCode: 'SOFTWARE', rulesVersion: 'pa2-software-1.1.0' },
];

interface ScriptArgs {
  documents: string[];
  apiCheck: boolean;
  exportJson: string;
  repairNidia: boolean;
  dryRunRepair: boolean;
  reevaluateGinna: boolean;
  persistGinna: boolean;
  browserCheck: boolean;
}

interface PersonRow {
  id: string;
  full_name: string;
  document: string;
  is_active: boolean;
  role_name: string | null;
  area_name: string | null;
}

interface EvalRow {
  id: string;
  is_active: boolean;
  status: string;
  domain_code: string;
  default_specialty_code: string | null;
  active_count: number;
  emergent_count: number;
  hidden_count: number;
  extraction_id: string;
  enrichment_id: string;
  evidence_evaluation_id: string;
  engine_rules_version: string;
  catalog_version: string;
  catalog_active: boolean;
  catalog_version_id: string;
  created_at: string;
  completed_at: string | null;
}

interface PersonAudit {
  document: string;
  person: PersonRow | null;
  error?: string;
  chain: {
    cvs: unknown[];
    extractions: unknown[];
    enrichments: unknown[];
    evidences: unknown[];
    activeCvId: string | null;
    activeExtractionId: string | null;
    activeEnrichmentId: string | null;
    activeEvidenceId: string | null;
    chainAligned: boolean;
  };
  evaluations: EvalRow[];
  activeEvaluation: EvalRow | null;
  staleDiagnosis: {
    hasActiveEval: boolean;
    activeEvalCatalogActive: boolean | null;
    activeEvalCatalogVersion: string | null;
    expectedStaleWarnings: string[];
    matchesKnownStalePattern: boolean;
  };
  api: Record<string, unknown> | null;
}

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    documents: [...DEFAULT_DOCUMENTS],
    apiCheck: true,
    exportJson: 'tmp/mc1103-audit-creative-visibility.json',
    repairNidia: false,
    dryRunRepair: false,
    reevaluateGinna: false,
    persistGinna: false,
    browserCheck: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--documents=')) {
      const raw = arg.slice('--documents='.length).trim();
      out.documents = raw
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
    } else if (arg === '--api-check') {
      out.apiCheck = true;
    } else if (arg === '--skip-api-check' || arg === '--no-api-check') {
      out.apiCheck = false;
    } else if (arg.startsWith('--export-json=')) {
      out.exportJson = arg.slice('--export-json='.length);
    } else if (arg === '--export-json') {
      out.exportJson = 'tmp/mc1103-audit-creative-visibility.json';
    } else if (arg === '--repair-nidia') {
      out.repairNidia = true;
    } else if (arg === '--dry-run-repair') {
      out.dryRunRepair = true;
    } else if (arg === '--reevaluate-ginna') {
      out.reevaluateGinna = true;
    } else if (arg === '--persist-ginna') {
      out.persistGinna = true;
    } else if (arg === '--browser-check') {
      out.browserCheck = true;
    }
  }

  return out;
}

function resolveRunMode(args: ScriptArgs): string {
  if (args.repairNidia) return 'REPAIR_NIDIA';
  if (args.dryRunRepair) return 'DRY_RUN_REPAIR';
  if (args.persistGinna) return 'PERSIST_GINNA';
  if (args.reevaluateGinna) return 'REEVALUATE_GINNA';
  return 'AUDIT_READONLY';
}

async function loadPerson(
  ds: DataSource,
  document: string,
): Promise<PersonRow | null> {
  const rows = (await ds.query(
    `SELECT p.id::text, p.full_name, p.document, p.is_active,
            r.name AS role_name, a.name AS area_name
       FROM core.person p
       LEFT JOIN core.role r ON r.id = p.role_id
       LEFT JOIN core.area a ON a.id = p.area_id
      WHERE p.document = $1`,
    [document],
  )) as PersonRow[];
  return rows.length === 1 ? rows[0] : null;
}

async function auditPersonChain(
  ds: DataSource,
  personId: string,
): Promise<PersonAudit['chain']> {
  const cvs = await ds.query(
    `SELECT id::text, is_active, drive_file_name, drive_md5_checksum, synced_at
       FROM organigrama.person_cv WHERE person_id = $1 ORDER BY id DESC`,
    [personId],
  );
  const extractions = await ds.query(
    `SELECT id::text, person_cv_id::text, status, is_active, pdf_sha256
       FROM organigrama.cv_extraction WHERE person_id = $1 ORDER BY id DESC`,
    [personId],
  );
  const enrichments = await ds.query(
    `SELECT id::text, extraction_id::text, status, is_active, pdf_sha256
       FROM organigrama.cv_skill_enrichment WHERE person_id = $1 ORDER BY id DESC`,
    [personId],
  );
  const evidences = await ds.query(
    `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active
       FROM organigrama.cv_evidence_evaluation WHERE person_id = $1 ORDER BY id DESC`,
    [personId],
  );

  const activeCv = cvs.find((c: { is_active: boolean }) => c.is_active) ?? null;
  const activeExt =
    extractions.find(
      (e: { is_active: boolean; status: string }) =>
        e.is_active && e.status === 'SUCCEEDED',
    ) ?? null;
  const activeEnr =
    enrichments.find(
      (e: { is_active: boolean; status: string }) =>
        e.is_active && e.status === 'SUCCEEDED',
    ) ?? null;
  const activeEv =
    evidences.find(
      (e: { is_active: boolean; status: string }) =>
        e.is_active && e.status === 'SUCCEEDED',
    ) ?? null;

  const chainAligned =
    Boolean(activeCv) &&
    Boolean(activeExt) &&
    Boolean(activeEnr) &&
    Boolean(activeEv) &&
    String(activeExt?.person_cv_id) === String(activeCv?.id) &&
    String(activeEnr?.extraction_id) === String(activeExt?.id) &&
    String(activeEv?.enrichment_id) === String(activeEnr?.id) &&
    String(activeEv?.extraction_id) === String(activeExt?.id);

  return {
    cvs,
    extractions,
    enrichments,
    evidences,
    activeCvId: activeCv?.id ?? null,
    activeExtractionId: activeExt?.id ?? null,
    activeEnrichmentId: activeEnr?.id ?? null,
    activeEvidenceId: activeEv?.id ?? null,
    chainAligned,
  };
}

async function loadEvaluations(
  ds: DataSource,
  personId: string,
): Promise<EvalRow[]> {
  return ds.query(
    `SELECT e.id::text, e.is_active, e.status, e.domain_code,
            e.default_specialty_code, e.active_count, e.emergent_count, e.hidden_count,
            e.extraction_id::text, e.enrichment_id::text, e.evidence_evaluation_id::text,
            e.engine_rules_version,
            cv.version AS catalog_version, cv.is_active AS catalog_active,
            cv.id::text AS catalog_version_id,
            e.created_at, e.completed_at
       FROM organigrama.mc_profile_evaluation e
       JOIN organigrama.mc_catalog_version cv ON cv.id = e.catalog_version_id
      WHERE e.person_id = $1
      ORDER BY e.id DESC`,
    [personId],
  );
}

function diagnoseStale(activeEval: EvalRow | null): PersonAudit['staleDiagnosis'] {
  const expectedStaleWarnings: string[] = [];
  if (!activeEval) {
    return {
      hasActiveEval: false,
      activeEvalCatalogActive: null,
      activeEvalCatalogVersion: null,
      expectedStaleWarnings,
      matchesKnownStalePattern: false,
    };
  }

  if (!activeEval.catalog_active) {
    expectedStaleWarnings.push('STALE_CATALOG_NOT_ACTIVE');
  }

  const matchesKnownStalePattern =
    activeEval.is_active &&
    activeEval.status === 'SUCCEEDED' &&
    !activeEval.catalog_active;

  return {
    hasActiveEval: activeEval.is_active,
    activeEvalCatalogActive: activeEval.catalog_active,
    activeEvalCatalogVersion: activeEval.catalog_version,
    expectedStaleWarnings,
    matchesKnownStalePattern,
  };
}

async function fetchApiSummary(
  competencies: OrgChartCompetenciesService,
  personId: string,
): Promise<Record<string, unknown>> {
  const viewer: OrgViewerContext = {
    personId,
    eduEmail: 'mc1103@local',
    permissions: ['ORG_READ_ALL'],
  };
  const summary = await competencies.getExplorerSummary(viewer, personId, '0', {
    includeHidden: false,
    includeAudit: true,
  });
  const domain = summary.domains?.[0];
  return {
    availabilityStatus: summary.availabilityStatus,
    warnings: summary.warnings ?? [],
    evaluationId: summary.evaluation?.id ?? null,
    evaluationCatalogVersion: summary.evaluation?.audit?.catalogVersion ?? null,
    domainCode: domain?.code ?? null,
    defaultSpecialty: domain?.defaultSpecialtyCode ?? null,
    specialties: (domain?.specialties ?? []).map((s) => ({
      code: s.code,
      status: s.presentationStatus,
      isDefault: s.isDefault,
    })),
    staleWarningsMatchDiagnosis: summary.warnings ?? [],
  };
}

async function loadGlobalConsistency(
  ds: DataSource,
  personIds: string[],
): Promise<Record<string, unknown>> {
  if (!personIds.length) {
    return {
      totalEvaluations: 0,
      activeEvaluations: 0,
      inactiveEvaluations: 0,
      activeDuplicates: [],
    };
  }

  const counts = (await ds.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE e.is_active)::int AS active,
            COUNT(*) FILTER (WHERE NOT e.is_active)::int AS inactive
       FROM organigrama.mc_profile_evaluation e
      WHERE e.person_id = ANY($1::bigint[])`,
    [personIds],
  )) as Array<{ total: number; active: number; inactive: number }>;

  const activeDuplicates = await ds.query(
    `SELECT e.person_id::text, p.document, p.full_name, e.domain_code,
            COUNT(*)::int AS active_count,
            array_agg(e.id::text ORDER BY e.id DESC) AS evaluation_ids
       FROM organigrama.mc_profile_evaluation e
       JOIN core.person p ON p.id = e.person_id
      WHERE e.is_active = TRUE AND e.person_id = ANY($1::bigint[])
      GROUP BY e.person_id, p.document, p.full_name, e.domain_code
     HAVING COUNT(*) > 1`,
    [personIds],
  );

  const activeCatalog = (await ds.query(
    `SELECT id::text, version, is_active, created_at
       FROM organigrama.mc_catalog_version
      WHERE is_active = TRUE
      ORDER BY id DESC
      LIMIT 1`,
  )) as Array<{ id: string; version: string; is_active: boolean }>;

  return {
    totalEvaluations: counts[0]?.total ?? 0,
    activeEvaluations: counts[0]?.active ?? 0,
    inactiveEvaluations: counts[0]?.inactive ?? 0,
    activeDuplicates,
    activeCatalog: activeCatalog[0] ?? null,
  };
}

async function auditPerson(
  ds: DataSource,
  competencies: OrgChartCompetenciesService,
  document: string,
  apiCheck: boolean,
): Promise<PersonAudit> {
  const person = await loadPerson(ds, document);
  if (!person) {
    return {
      document,
      person: null,
      error: `Persona no encontrada o ambigua: ${document}`,
      chain: {
        cvs: [],
        extractions: [],
        enrichments: [],
        evidences: [],
        activeCvId: null,
        activeExtractionId: null,
        activeEnrichmentId: null,
        activeEvidenceId: null,
        chainAligned: false,
      },
      evaluations: [],
      activeEvaluation: null,
      staleDiagnosis: diagnoseStale(null),
      api: null,
    };
  }

  const chain = await auditPersonChain(ds, person.id);
  const evaluations = await loadEvaluations(ds, person.id);
  const activeEvaluation =
    evaluations.find((e) => e.is_active && e.status === 'SUCCEEDED') ?? null;
  const staleDiagnosis = diagnoseStale(activeEvaluation);

  let api: Record<string, unknown> | null = null;
  if (apiCheck) {
    api = await fetchApiSummary(competencies, person.id);
    if (api && staleDiagnosis.expectedStaleWarnings.length > 0) {
      const apiWarnings = (api.warnings as string[]) ?? [];
      api.staleDiagnosisConfirmed = staleDiagnosis.expectedStaleWarnings.every(
        (w) => apiWarnings.includes(w),
      );
    }
  }

  return {
    document,
    person,
    chain,
    evaluations,
    activeEvaluation,
    staleDiagnosis,
    api,
  };
}

interface Pa2DryRunReport {
  domainCode: string;
  rulesVersion: string;
  outcome: string;
  activeCount: number;
  emergentCount: number;
  hiddenCount: number;
  defaultSpecialtyCode: string | null;
  isPrimaryMatch: boolean;
  error?: string;
}

async function runPa2DryRuns(
  pa2: McPa2Service,
  extractionId: string,
  logTag: string,
  personLabel: string,
): Promise<Pa2DryRunReport[]> {
  const reports: Pa2DryRunReport[] = [];

  for (const { domainCode, rulesVersion } of REPAIR_DOMAIN_RULES) {
    try {
      const outcome = await pa2.evaluateProfileDomain({
        extractionId,
        domainCode,
        rulesVersion,
        persist: false,
      });
      const result = outcome.result as McPa2EngineRunResult;
      reports.push({
        domainCode,
        rulesVersion,
        outcome: outcome.outcome,
        activeCount: result.activeCount,
        emergentCount: result.emergentCount,
        hiddenCount: result.hiddenCount,
        defaultSpecialtyCode: result.defaultSpecialtyCode,
        isPrimaryMatch: result.activeCount >= 1,
      });
      console.log(
        `${logTag} PA2 dry-run ${personLabel} ${domainCode}: ACTIVE=${result.activeCount} ` +
          `EMERGENT=${result.emergentCount} PRIMARY=${result.activeCount >= 1}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${logTag} PA2 dry-run ERROR ${domainCode}: ${message}`);
      reports.push({
        domainCode,
        rulesVersion,
        outcome: 'ERROR',
        activeCount: 0,
        emergentCount: 0,
        hiddenCount: 0,
        defaultSpecialtyCode: null,
        isPrimaryMatch: false,
        error: message,
      });
    }
  }

  return reports;
}

function selectGinnaPersistTarget(
  dryRuns: Pa2DryRunReport[],
): { domainCode: string; rulesVersion: string } | null {
  const visual = dryRuns.find((d) => d.domainCode === 'VISUAL_DESIGN');
  const av = dryRuns.find(
    (d) => d.domainCode === 'AUDIOVISUAL_PRODUCTION',
  );

  if (visual?.isPrimaryMatch && (visual.activeCount ?? 0) >= 1) {
    return REPAIR_DOMAIN_RULES.find((r) => r.domainCode === 'VISUAL_DESIGN')!;
  }

  const avPrimary = av?.isPrimaryMatch && (av.activeCount ?? 0) >= 1;
  const visualPrimary = visual?.isPrimaryMatch && (visual.activeCount ?? 0) >= 1;

  if (avPrimary && !visualPrimary) {
    return REPAIR_DOMAIN_RULES.find(
      (r) => r.domainCode === 'AUDIOVISUAL_PRODUCTION',
    )!;
  }

  return null;
}

async function reevaluateGinna(
  ds: DataSource,
  pa2: McPa2Service,
  competencies: OrgChartCompetenciesService,
  apiCheck: boolean,
): Promise<Record<string, unknown>> {
  console.log(
    `${TAG_GINNA} reevaluate Ginna documento=${GINNA_DOCUMENT} (dry-run only)`,
  );

  const person = await loadPerson(ds, GINNA_DOCUMENT);
  if (!person) {
    throw new Error(`Ginna no encontrada: documento ${GINNA_DOCUMENT}`);
  }

  const chain = await auditPersonChain(ds, person.id);
  if (!chain.chainAligned || !chain.activeExtractionId) {
    return {
      status: 'SKIPPED',
      reason: 'CHAIN_INCOMPLETE',
      document: GINNA_DOCUMENT,
      chain,
      dryRuns: [],
    };
  }

  const dryRuns = await runPa2DryRuns(
    pa2,
    chain.activeExtractionId,
    TAG_GINNA,
    'Ginna',
  );

  let apiAfter: Record<string, unknown> | null = null;
  if (apiCheck) {
    apiAfter = await fetchApiSummary(competencies, person.id);
  }

  return {
    status: 'DRY_RUN',
    personId: person.id,
    document: GINNA_DOCUMENT,
    chain,
    dryRuns,
    apiAfter,
  };
}

async function persistGinna(
  ds: DataSource,
  pa2: McPa2Service,
  competencies: OrgChartCompetenciesService,
  apiCheck: boolean,
): Promise<Record<string, unknown>> {
  console.log(
    `${TAG_GINNA} persist Ginna documento=${GINNA_DOCUMENT} (dry-run previo obligatorio)`,
  );

  const person = await loadPerson(ds, GINNA_DOCUMENT);
  if (!person) {
    throw new Error(`Ginna no encontrada: documento ${GINNA_DOCUMENT}`);
  }

  const chain = await auditPersonChain(ds, person.id);
  if (!chain.chainAligned || !chain.activeExtractionId) {
    return {
      status: 'SKIPPED',
      reason: 'CHAIN_INCOMPLETE',
      document: GINNA_DOCUMENT,
      chain,
      dryRuns: [],
      persist: null,
      apiAfter: null,
    };
  }

  const dryRuns = await runPa2DryRuns(
    pa2,
    chain.activeExtractionId,
    TAG_GINNA,
    'Ginna',
  );

  const target = selectGinnaPersistTarget(dryRuns);
  let persist: Record<string, unknown> | null = null;

  if (!target) {
    console.warn(
      `${TAG_GINNA} persist omitido: Caso C / NO_PRIMARY — ningún dominio creativo ` +
        `con activeCount>=1 bajo catálogo activo`,
    );
    persist = {
      status: 'SKIPPED',
      reason: 'NO_PRIMARY',
      policyCase: 'CASO_C',
      visualActiveCount:
        dryRuns.find((d) => d.domainCode === 'VISUAL_DESIGN')?.activeCount ?? 0,
      avActiveCount:
        dryRuns.find((d) => d.domainCode === 'AUDIOVISUAL_PRODUCTION')
          ?.activeCount ?? 0,
    };
  } else {
    console.log(
      `${TAG_GINNA} persist ${target.domainCode} para Ginna bajo catálogo activo`,
    );
    const persistOutcome = await pa2.evaluateProfileDomain({
      extractionId: chain.activeExtractionId,
      domainCode: target.domainCode,
      rulesVersion: target.rulesVersion,
      persist: true,
    });
    persist = {
      status: persistOutcome.outcome,
      evaluationId: persistOutcome.evaluationId,
      domainCode: target.domainCode,
      activeCount: persistOutcome.result.activeCount,
      note:
        'persistEvaluation desactiva evaluaciones previas person_id+domain_code; ' +
        'eval histórica en catálogo inactivo queda is_active=false',
    };
    console.log(
      `${TAG_GINNA} persist resultado=${persistOutcome.outcome} evalId=${persistOutcome.evaluationId}`,
    );
  }

  let apiAfter: Record<string, unknown> | null = null;
  if (
    apiCheck &&
    (persist?.status === 'SEEDED' || persist?.status === 'ALREADY_EXISTS')
  ) {
    apiAfter = await fetchApiSummary(competencies, person.id);
    console.log(
      `${TAG_GINNA} API post-persist availability=${apiAfter.availabilityStatus} ` +
        `warnings=${JSON.stringify(apiAfter.warnings)}`,
    );
  }

  return {
    status: persist?.status === 'SKIPPED' ? 'SKIPPED' : 'PERSISTED',
    personId: person.id,
    document: GINNA_DOCUMENT,
    chain,
    dryRuns,
    persist,
    apiAfter,
  };
}

function logBrowserCheckReminder(): void {
  console.log(`${TAG} browser-check: E2E en Frontend (no se ejecuta desde backend):`);
  console.log(
    `${TAG}   cd Organigrama_Frontend && npx playwright test creative-competencies-visibility`,
  );
}

async function repairNidia(
  ds: DataSource,
  pa2: McPa2Service,
  competencies: OrgChartCompetenciesService,
  dryRunOnly: boolean,
  apiCheck: boolean,
): Promise<Record<string, unknown>> {
  console.log(
    `${TAG} repair Nidia documento=${NIDIA_DOCUMENT} dryRunOnly=${dryRunOnly}`,
  );

  const person = await loadPerson(ds, NIDIA_DOCUMENT);
  if (!person) {
    throw new Error(`Nidia no encontrada: documento ${NIDIA_DOCUMENT}`);
  }

  const chain = await auditPersonChain(ds, person.id);
  if (!chain.chainAligned || !chain.activeExtractionId) {
    return {
      status: 'SKIPPED',
      reason: 'CHAIN_INCOMPLETE',
      chain,
      dryRuns: [],
      persist: null,
      apiAfter: null,
    };
  }

  const dryRuns = await runPa2DryRuns(
    pa2,
    chain.activeExtractionId,
    TAG,
    'Nidia',
  );
  const visual = dryRuns.find((d) => d.domainCode === 'VISUAL_DESIGN');
  const visualPrimary = visual?.isPrimaryMatch === true && visual.activeCount >= 1;

  let persist: Record<string, unknown> | null = null;

  if (dryRunOnly) {
    console.log(`${TAG} dry-run-repair: sin persistencia`);
    persist = { status: 'DRY_RUN_ONLY', visualPrimary };
  } else if (!visualPrimary) {
    console.warn(
      `${TAG} repair omitido: VISUAL_DESIGN sin PRIMARY (activeCount>=1) bajo catálogo activo`,
    );
    persist = {
      status: 'SKIPPED',
      reason: 'VISUAL_DESIGN_NOT_PRIMARY',
      visualActiveCount: visual?.activeCount ?? 0,
    };
  } else {
    console.log(`${TAG} persist VISUAL_DESIGN para Nidia bajo catálogo activo`);
    const persistOutcome = await pa2.evaluateProfileDomain({
      extractionId: chain.activeExtractionId,
      domainCode: 'VISUAL_DESIGN',
      rulesVersion: 'pa2-visual-design-1.1.0',
      persist: true,
    });
    persist = {
      status: persistOutcome.outcome,
      evaluationId: persistOutcome.evaluationId,
      domainCode: 'VISUAL_DESIGN',
      activeCount: persistOutcome.result.activeCount,
      note:
        'persistEvaluation desactiva evaluaciones previas person_id+domain_code; ' +
        'eval histórica en catálogo inactivo queda is_active=false',
    };
    console.log(
      `${TAG} persist resultado=${persistOutcome.outcome} evalId=${persistOutcome.evaluationId}`,
    );
  }

  let apiAfter: Record<string, unknown> | null = null;
  if (apiCheck && persist?.status === 'SEEDED') {
    apiAfter = await fetchApiSummary(competencies, person.id);
    console.log(
      `${TAG} API post-repair availability=${apiAfter.availabilityStatus} ` +
        `warnings=${JSON.stringify(apiAfter.warnings)}`,
    );
  } else if (apiCheck && persist?.status === 'ALREADY_EXISTS') {
    apiAfter = await fetchApiSummary(competencies, person.id);
  }

  return {
    status: dryRunOnly ? 'DRY_RUN' : (persist?.status ?? 'UNKNOWN'),
    personId: person.id,
    document: NIDIA_DOCUMENT,
    chain,
    dryRuns,
    persist,
    apiAfter,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const runMode = resolveRunMode(args);

  console.log(
    `${TAG} Inicio mode=${runMode} documentos=${args.documents.join(',')} ` +
      `apiCheck=${args.apiCheck} browserCheck=${args.browserCheck}`,
  );

  if (args.browserCheck) {
    logBrowserCheckReminder();
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ds = app.get(DataSource);
  const competencies = app.get(OrgChartCompetenciesService);
  const pa2 = app.select(McCatalogModule).get(McPa2Service);

  try {
    const personAudits: PersonAudit[] = [];
    const personIds: string[] = [];

    for (const document of args.documents) {
      console.log(`${TAG} ── documento=${document} ──`);
      const audit = await auditPerson(ds, competencies, document, args.apiCheck);
      personAudits.push(audit);

      if (audit.person) {
        personIds.push(audit.person.id);
        console.log(
          `${TAG} ${audit.person.full_name} chainAligned=${audit.chain.chainAligned} ` +
            `evalActiva=${audit.activeEvaluation?.id ?? '—'} ` +
            `catalog=${audit.activeEvaluation?.catalog_version ?? '—'} ` +
            `catalogActive=${audit.activeEvaluation?.catalog_active ?? '—'}`,
        );
        if (audit.api) {
          console.log(
            `${TAG} API availability=${audit.api.availabilityStatus} ` +
              `warnings=${JSON.stringify(audit.api.warnings)}`,
          );
        }
        if (audit.staleDiagnosis.matchesKnownStalePattern) {
          console.warn(
            `${TAG} STALE detectado: eval activa #${audit.activeEvaluation?.id} ` +
              `en catálogo inactivo ${audit.activeEvaluation?.catalog_version} ` +
              `→ frontend vacío/stale (MC1.10.2 no desactivó a Nidia)`,
          );
        }
      } else {
        console.warn(`${TAG} ${audit.error}`);
      }
    }

    const globalConsistency = await loadGlobalConsistency(ds, personIds);

    let repair: Record<string, unknown> | null = null;
    if (args.repairNidia) {
      repair = await repairNidia(ds, pa2, competencies, false, args.apiCheck);
    } else if (args.dryRunRepair) {
      repair = await repairNidia(ds, pa2, competencies, true, args.apiCheck);
    }

    let ginna: Record<string, unknown> | null = null;
    if (args.persistGinna) {
      ginna = await persistGinna(ds, pa2, competencies, args.apiCheck);
    } else if (args.reevaluateGinna) {
      ginna = await reevaluateGinna(ds, pa2, competencies, args.apiCheck);
    }

    const nidiaAudit = personAudits.find((a) => a.document === NIDIA_DOCUMENT);
    const verifiedRootCause = {
      hypothesis:
        'Evaluación activa en catálogo inactivo → API STALE / STALE_CATALOG_NOT_ACTIVE → FE vacío',
      nidiaActiveEvalId: nidiaAudit?.activeEvaluation?.id ?? null,
      nidiaActiveEvalCatalog: nidiaAudit?.activeEvaluation?.catalog_version ?? null,
      nidiaCatalogActive: nidiaAudit?.activeEvaluation?.catalog_active ?? null,
      nidiaApiStatus: nidiaAudit?.api?.availabilityStatus ?? null,
      nidiaApiWarnings: nidiaAudit?.api?.warnings ?? null,
      activeCatalogNow: globalConsistency.activeCatalog,
      confirmedByScript:
        nidiaAudit?.staleDiagnosis.matchesKnownStalePattern === true &&
        Array.isArray(nidiaAudit?.api?.warnings) &&
        (nidiaAudit.api.warnings as string[]).includes('STALE_CATALOG_NOT_ACTIVE'),
      mc1102DidNotDeactivateNidia:
        nidiaAudit?.staleDiagnosis.matchesKnownStalePattern === true,
    };

    const report = {
      phase: 'MC1.10.3',
      generatedAt: new Date().toISOString(),
      mode:
        runMode === 'AUDIT_READONLY'
          ? 'AUDIT_READONLY'
          : `AUDIT_WITH_${runMode}`,
      documents: args.documents,
      personAudits,
      globalConsistency,
      verifiedRootCause,
      repair,
      ginna,
      browserCheckRequested: args.browserCheck,
    };

    mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
    const outPath = resolve(process.cwd(), args.exportJson);
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`${TAG} artefacto=${outPath}`);

    console.log(
      JSON.stringify(
        {
          persons: personAudits.map((a) => ({
            document: a.document,
            name: a.person?.full_name,
            chainAligned: a.chain.chainAligned,
            activeEval: a.activeEvaluation?.id,
            catalog: a.activeEvaluation?.catalog_version,
            catalogActive: a.activeEvaluation?.catalog_active,
            apiStatus: a.api?.availabilityStatus,
            stalePattern: a.staleDiagnosis.matchesKnownStalePattern,
          })),
          globalConsistency,
          verifiedRootCause,
          repairStatus: repair?.status ?? null,
          ginnaStatus: ginna?.status ?? null,
          ginnaPersist: ginna?.persist ?? null,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(TAG, e instanceof Error ? e.message : e);
  process.exit(1);
});
