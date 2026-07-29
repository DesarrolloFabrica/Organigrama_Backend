/**
 * MC1 — Piloto masivo Fábrica de Contenidos.
 *
 * npm run mc:pilot-fabrica-contenidos -- --dry-run
 * npm run mc:pilot-fabrica-contenidos -- --execute --concurrency=3
 * npm run mc:pilot-fabrica-contenidos -- --document=1000590473 --execute
 *
 * Sin --execute: solo lectura (cohorte + auditoría + SHA).
 * No modifica Drive, catálogo, aliases, mappings, PA2, thresholds.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import {
  CV_SKILLS_EXTRACTOR_VERSION,
  CV_SKILLS_PROMPT_VERSION,
} from '../../cv-skills/cv-skills.constants';
import { CvSkillsExtractionService } from '../../cv-skills/cv-skills-extraction.service';
import { CvSkillsPersistenceService } from '../../cv-skills/cv-skills-persistence.service';
import { DEFAULT_GEMINI_MODEL } from '../../cv-skills/cv-skills.types';
import { CvSkillsEnrichmentModule } from '../../cv-skills-enrichment/cv-skills-enrichment.module';
import { CvSkillsEnrichmentPersistRunnerService } from '../../cv-skills-enrichment/cv-skills-enrichment-persist-runner.service';
import { buildRunInputFromDatabase } from '../../cv-skills-enrichment/cv-skills-enrichment.inventory';
import { CvEvidenceModule } from '../../cv-evidence/cv-evidence.module';
import { CvEvidencePersistenceService } from '../../cv-evidence/cv-evidence-persistence.service';
import { getEvidenceEngineConfig } from '../../cv-evidence/cv-evidence.config';
import { McCatalogModule } from '../../mc-catalog/mc-catalog.module';
import { McPa2Service } from '../../mc-catalog/mc-pa2.service';
import { classifyDomainConceptually } from '../../mc-catalog/mc-domain-qualification';
import type { McDomainQualification } from '../../mc-catalog/mc-domain-qualification';
import {
  countExtractedSkills,
  prepareCvPdfForExtraction,
  runExtractCvSkillsPipeline,
} from './utils/extract-cv-skills-pipeline';
import {
  actionForFabricaPipelineState,
  classifyFabricaCohortByRole,
  classifyFabricaContentClass,
  classifyFabricaPipelineState,
  FABRICA_PILOT_DOMAINS,
  isFabricaCohortIncluded,
  matchFabricaParentCandidates,
  type FabricaCohortClass,
  type FabricaContentClass,
  type FabricaPipelineState,
} from '../../org-chart/mc-fabrica-contenidos-cohort';

const TAG = '[MC1 Fábrica bulk pilot]';
const ROOT = resolve('tmp/mc1-fabrica-contenidos-bulk-pilot');

type CliArgs = {
  dryRun: boolean;
  execute: boolean;
  document?: string;
  concurrency: number;
  limit?: number;
  resume: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    dryRun: true,
    execute: false,
    concurrency: 3,
    resume: false,
  };
  for (const arg of argv) {
    if (arg === '--execute') {
      out.execute = true;
      out.dryRun = false;
    } else if (arg === '--dry-run') out.dryRun = true;
    else if (arg.startsWith('--document='))
      out.document = arg.slice('--document='.length).trim();
    else if (arg.startsWith('--concurrency='))
      out.concurrency = Math.max(
        1,
        Math.min(3, Number(arg.slice('--concurrency='.length)) || 3),
      );
    else if (arg.startsWith('--limit='))
      out.limit = Number(arg.slice('--limit='.length)) || undefined;
    else if (arg === '--resume') out.resume = true;
  }
  return out;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

type ChildRow = {
  relation_id: string;
  person_id: string;
  document: string | null;
  full_name: string;
  person_active: boolean;
  edu_email: string | null;
  role_name: string | null;
};

async function resolveActiveVersion(ds: DataSource) {
  const rows = await ds.query(
    `SELECT id::text, code, name, is_active, period_label
       FROM organigrama.org_chart_version WHERE is_active = TRUE`,
  );
  if (rows.length !== 1) {
    throw new Error(
      `Se esperaba exactamente 1 versión activa; encontradas=${rows.length}`,
    );
  }
  return rows[0] as {
    id: string;
    code: string;
    name: string;
    period_label: string | null;
  };
}

async function resolveParent(ds: DataSource, versionId: string) {
  const people = (await ds.query(
    `SELECT p.id::text AS person_id, p.document, p.full_name, p.is_active,
            p.edu_email, r.name AS role_name
       FROM core.person p
       LEFT JOIN core.role r ON r.id = p.role_id`,
  )) as Array<{
    person_id: string;
    document: string | null;
    full_name: string;
    is_active: boolean;
    edu_email: string | null;
    role_name: string | null;
  }>;

  const candidates = matchFabricaParentCandidates(
    people.map((p) => ({ ...p, fullName: p.full_name })),
  );
  if (candidates.length === 0) {
    throw new Error('No se encontró el nodo padre VACANTE Fábrica de Contenidos');
  }
  if (candidates.length > 1) {
    throw new Error(
      `Ambigüedad: ${candidates.length} nodos padre candidatos: ` +
        candidates.map((c) => c.person_id).join(', '),
    );
  }
  const parent = candidates[0];

  const childCount = await ds.query(
    `SELECT COUNT(*)::int AS n
       FROM organigrama.org_visual_relation
      WHERE version_id = $1 AND is_active = TRUE AND parent_person_id = $2`,
    [versionId, parent.person_id],
  );

  return {
    parent,
    directChildrenCount: Number(childCount[0]?.n || 0),
  };
}

async function loadDirectChildren(
  ds: DataSource,
  versionId: string,
  parentPersonId: string,
): Promise<ChildRow[]> {
  return ds.query(
    `SELECT ovr.id::text AS relation_id,
            ovr.child_person_id::text AS person_id,
            c.document,
            c.full_name,
            c.is_active AS person_active,
            c.edu_email,
            r.name AS role_name
       FROM organigrama.org_visual_relation ovr
       JOIN core.person c ON c.id = ovr.child_person_id
       LEFT JOIN core.role r ON r.id = c.role_id
      WHERE ovr.version_id = $1
        AND ovr.is_active = TRUE
        AND ovr.parent_person_id = $2
      ORDER BY c.full_name ASC`,
    [versionId, parentPersonId],
  );
}

async function auditPersonPipeline(ds: DataSource, child: ChildRow) {
  const cvs = await ds.query(
    `SELECT id::text, drive_file_id, is_active
       FROM organigrama.person_cv WHERE person_id = $1`,
    [child.person_id],
  );
  const activeCvs = cvs.filter((c: { is_active: boolean }) => c.is_active);
  const exts = await ds.query(
    `SELECT id::text, drive_file_id, pdf_sha256, status, is_active,
            model, prompt_version, extractor_version
       FROM organigrama.cv_extraction WHERE person_id = $1 ORDER BY id DESC`,
    [child.person_id],
  );
  const activeExt = exts.find(
    (e: { is_active: boolean; status: string }) =>
      e.is_active && e.status === 'SUCCEEDED',
  );
  const running = exts.some((e: { status: string }) =>
    ['RUNNING', 'PENDING'].includes(e.status),
  );
  const evals = await ds.query(
    `SELECT id::text, domain_code, is_active, status, domain_qualification,
            active_count, emergent_count, extraction_id::text,
            default_specialty_code
       FROM organigrama.mc_profile_evaluation
      WHERE person_id = $1 AND status = 'SUCCEEDED'
      ORDER BY is_active DESC, id DESC`,
    [child.person_id],
  );

  const pipelineState = classifyFabricaPipelineState({
    hasActivePersonCv: activeCvs.length === 1,
    activeCvDriveFileId: activeCvs[0]?.drive_file_id ?? null,
    activeExtraction: activeExt
      ? {
          id: activeExt.id,
          status: activeExt.status,
          isActive: activeExt.is_active,
          driveFileId: activeExt.drive_file_id,
        }
      : null,
    hasRunningOrPending: running,
  });

  return {
    activeCv: activeCvs[0] ?? null,
    activeCvCount: activeCvs.length,
    extractions: exts,
    activeExtraction: activeExt ?? null,
    evaluations: evals,
    pipelineState,
  };
}

async function maybeCompareSha(params: {
  document: string;
  ds: DataSource;
  pipelineState: FabricaPipelineState;
  activeCv: { drive_file_id: string } | null;
  activeExtraction: {
    drive_file_id: string;
    pdf_sha256: string;
  } | null;
}): Promise<{
  contentClass: FabricaContentClass;
  cvSha256: string | null;
  error?: string;
}> {
  if (
    params.pipelineState !== 'STALE_SELECTED_EXTRACTION' &&
    params.pipelineState !== 'NO_USABLE_EXTRACTION'
  ) {
    return { contentClass: 'NOT_APPLICABLE', cvSha256: null };
  }
  if (!params.document) {
    return { contentClass: 'UNVERIFIABLE', cvSha256: null, error: 'NO_DOCUMENT' };
  }
  try {
    const prepared = await prepareCvPdfForExtraction({
      document: params.document,
      dataSource: params.ds,
    });
    const contentClass = classifyFabricaContentClass({
      cvDriveFileId: params.activeCv?.drive_file_id ?? prepared.driveFileId,
      extractionDriveFileId: params.activeExtraction?.drive_file_id ?? null,
      cvSha256: prepared.pdfSha256,
      extractionSha256: params.activeExtraction?.pdf_sha256 ?? null,
    });
    return { contentClass, cvSha256: prepared.pdfSha256 };
  } catch (err) {
    return {
      contentClass: 'UNVERIFIABLE',
      cvSha256: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function evaluateDomains(params: {
  pa2: McPa2Service;
  extractionId: string;
  persist: boolean;
}): Promise<
  Array<{
    domainCode: string;
    rulesVersion: string;
    qualification: McDomainQualification;
    evaluationId: string | null;
    outcome: string;
    activeCount: number;
    emergentCount: number;
    hiddenCount: number;
    defaultSpecialtyCode: string | null;
    specialties: Array<{
      code: string;
      status: string;
      strength: number;
      coverage: number;
    }>;
    activateOnPersist: boolean;
  }>
> {
  const dryResults: Array<{
    domainCode: string;
    rulesVersion: string;
    qualification: McDomainQualification;
    dry: Awaited<ReturnType<McPa2Service['evaluateProfileDomain']>>;
  }> = [];
  for (const d of FABRICA_PILOT_DOMAINS) {
    const dry = await params.pa2.evaluateProfileDomain({
      extractionId: params.extractionId,
      domainCode: d.domainCode,
      rulesVersion: d.rulesVersion,
      persist: false,
    });
    const qualification = classifyDomainConceptually(dry.result, 'MEDIUM');
    dryResults.push({
      domainCode: d.domainCode,
      rulesVersion: d.rulesVersion,
      qualification,
      dry,
    });
  }

  const primaries = dryResults.filter((r) => r.qualification === 'PRIMARY_MATCH');
  let winner: string | null = null;
  if (primaries.length === 1) winner = primaries[0].domainCode;
  else if (primaries.length > 1) {
    primaries.sort(
      (a, b) =>
        b.dry.result.activeCount - a.dry.result.activeCount ||
        b.dry.result.emergentCount - a.dry.result.emergentCount,
    );
    winner = primaries[0].domainCode;
  } else {
    const secondaries = dryResults.filter(
      (r) => r.qualification === 'SECONDARY_SIGNAL',
    );
    if (secondaries.length) {
      secondaries.sort(
        (a, b) => b.dry.result.emergentCount - a.dry.result.emergentCount,
      );
      winner = secondaries[0].domainCode;
    }
  }

  const out: Array<{
    domainCode: string;
    rulesVersion: string;
    qualification: McDomainQualification;
    evaluationId: string | null;
    outcome: string;
    activeCount: number;
    emergentCount: number;
    hiddenCount: number;
    defaultSpecialtyCode: string | null;
    specialties: Array<{
      code: string;
      status: string;
      strength: number;
      coverage: number;
    }>;
    activateOnPersist: boolean;
  }> = [];
  // Persist non-winners first (inactive), then winner (active) if persist.
  const ordered = [...dryResults].sort((a, b) => {
    if (a.domainCode === winner) return 1;
    if (b.domainCode === winner) return -1;
    return a.domainCode.localeCompare(b.domainCode);
  });

  for (const r of ordered) {
    const activateOnPersist =
      params.persist &&
      r.domainCode === winner &&
      (r.qualification === 'PRIMARY_MATCH' ||
        r.qualification === 'SECONDARY_SIGNAL');

    let evaluationId: string | null = null;
    let outcome = 'DRY_RUN';
    if (params.persist) {
      // Persist OUTSIDE/INSUFFICIENT as inactive for trazabilidad.
      const saved = await params.pa2.evaluateProfileDomain({
        extractionId: params.extractionId,
        domainCode: r.domainCode,
        rulesVersion: r.rulesVersion,
        persist: true,
        activateOnPersist,
        domainQualification: r.qualification,
      });
      evaluationId = saved.evaluationId;
      outcome = saved.outcome;
    }

    out.push({
      domainCode: r.domainCode,
      rulesVersion: r.rulesVersion,
      qualification: r.qualification,
      evaluationId,
      outcome,
      activeCount: r.dry.result.activeCount,
      emergentCount: r.dry.result.emergentCount,
      hiddenCount: r.dry.result.hiddenCount,
      defaultSpecialtyCode: r.dry.result.defaultSpecialtyCode,
      specialties: r.dry.result.specialtyResults.map((s) => ({
        code: s.specialtyCode,
        status: s.presentationStatus,
        strength: s.strength,
        coverage: s.coverage,
      })),
      activateOnPersist,
    });
  }
  return out;
}

async function ensureChainAndEvaluate(params: {
  app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;
  document: string;
  extractionId: string;
  persist: boolean;
}): Promise<
  Awaited<ReturnType<typeof evaluateDomains>>
> {
  const ds = params.app.get(DataSource);
  const pa2 = params.app.select(McCatalogModule).get(McPa2Service);

  // Ensure enrichment+evidence active for extraction
  const enrichActive = await ds.query(
    `SELECT id::text FROM organigrama.cv_skill_enrichment
      WHERE extraction_id = $1 AND is_active = TRUE AND status = 'SUCCEEDED'
      LIMIT 1`,
    [params.extractionId],
  );
  if (!enrichActive.length && params.persist) {
    const prepared = await prepareCvPdfForExtraction({
      document: params.document,
      dataSource: ds,
    });
    const runInput = await buildRunInputFromDatabase(
      ds,
      params.extractionId,
      params.document,
    );
    const config = params.app.get(ConfigService);
    const model =
      config.get<string>('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;
    const enrichRunner = params.app
      .select(CvSkillsEnrichmentModule)
      .get(CvSkillsEnrichmentPersistRunnerService);
    await enrichRunner.runPersist({
      pdfBuffer: prepared.pdfBuffer,
      input: {
        ...runInput,
        extractionId: params.extractionId,
        personId: prepared.personId,
        personCvId: runInput.personCvId!,
        pdfSha256: runInput.pdfSha256,
      },
      model,
      blockConfig: { blockSize: 12, maxBlockAttempts: 2 },
      activate: true,
    });
  }

  const evidenceActive = await ds.query(
    `SELECT id::text FROM organigrama.cv_evidence_evaluation
      WHERE extraction_id = $1 AND is_active = TRUE AND status = 'SUCCEEDED'
      LIMIT 1`,
    [params.extractionId],
  );
  if (!evidenceActive.length && params.persist) {
    const enr = await ds.query(
      `SELECT id::text FROM organigrama.cv_skill_enrichment
        WHERE extraction_id = $1 AND is_active = TRUE AND status = 'SUCCEEDED'
        LIMIT 1`,
      [params.extractionId],
    );
    if (!enr[0]) throw new Error('Enrichment activo ausente tras persist');
    const evidencePersistence = params.app
      .select(CvEvidenceModule)
      .get(CvEvidencePersistenceService);
    await evidencePersistence.runPersist({
      enrichmentId: enr[0].id,
      activate: true,
      config: getEvidenceEngineConfig('er2'),
    });
  }

  return evaluateDomains({
    pa2,
    extractionId: params.extractionId,
    persist: params.persist,
  });
}

async function reextractPerson(params: {
  app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;
  document: string;
  previousExtractionId: string;
}): Promise<{ newExtractionId: string; skillsCount: number }> {
  const ds = params.app.get(DataSource);
  const extractionSvc = params.app.get(CvSkillsExtractionService);
  const persistence = params.app.get(CvSkillsPersistenceService);
  const config = params.app.get(ConfigService);
  const model =
    config.get<string>('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;
  const promptVersion = CV_SKILLS_PROMPT_VERSION;
  const extractorVersion = CV_SKILLS_EXTRACTOR_VERSION;

  const prepared = await prepareCvPdfForExtraction({
    document: params.document,
    dataSource: ds,
  });

  const existing = await persistence.findExistingSucceededExtraction({
    personId: prepared.personId,
    pdfSha256: prepared.pdfSha256,
    model,
    promptVersion,
    extractorVersion,
  });
  if (existing) {
    // Idempotencia: activar existente si hace falta
    if (!existing.is_active) {
      await ds.query(
        `UPDATE organigrama.cv_extraction SET is_active = FALSE, updated_at = NOW()
          WHERE person_id = $1 AND is_active = TRUE`,
        [String(prepared.personId)],
      );
      await ds.query(
        `UPDATE organigrama.cv_extraction SET is_active = TRUE, updated_at = NOW()
          WHERE id = $1 AND status = 'SUCCEEDED'`,
        [existing.id],
      );
    }
    return {
      newExtractionId: String(existing.id),
      skillsCount: Number(existing.skills_count || 0),
    };
  }

  const dry = await runExtractCvSkillsPipeline({
    document: params.document,
    dataSource: ds,
    extractionService: extractionSvc,
  });
  if (countExtractedSkills(dry.result) <= 0) {
    throw new Error('Preflight extracción: 0 skills');
  }

  const running = await persistence.createRunningExtraction({
    personId: prepared.personId,
    personCvId: prepared.personCvId,
    document: prepared.document,
    driveFileId: prepared.driveFileId,
    driveFileName: prepared.driveFileName,
    pdfSha256: prepared.pdfSha256,
    pdfByteSize: prepared.pdfByteSize,
    model,
    promptVersion,
    extractorVersion,
  });

  try {
    const completed = await persistence.completeExtraction(
      running.id,
      dry.result,
      { durationMs: dry.geminiDurationMs },
    );
    return {
      newExtractionId: String(completed.id),
      skillsCount: Number(completed.skills_count || 0),
    };
  } catch (err) {
    try {
      await persistence.failExtraction(running.id, {
        errorStage: 'FABRICA_BULK',
        errorMessage: (err instanceof Error ? err.message : String(err)).slice(
          0,
          2000,
        ),
      });
    } catch {
      /* ignore */
    }
    await ds.query(
      `UPDATE organigrama.cv_extraction SET is_active = TRUE, updated_at = NOW()
        WHERE id = $1 AND status = 'SUCCEEDED'`,
      [params.previousExtractionId],
    );
    throw err;
  }
}

async function collectUnmappedSkills(ds: DataSource, personIds: string[]) {
  if (!personIds.length) return [];
  try {
    const rows = await ds.query(
      `SELECT s.normalized_key, s.normalized_name, s.skill_type,
              COUNT(DISTINCT e.person_id)::int AS persons,
              array_agg(DISTINCT e.document) AS documents
         FROM organigrama.cv_extraction e
         JOIN organigrama.cv_extraction_skill es ON es.extraction_id = e.id
         JOIN organigrama.cv_skill s ON s.id = es.skill_id
        WHERE e.person_id = ANY($1::bigint[])
          AND e.is_active = TRUE
          AND e.status = 'SUCCEEDED'
        GROUP BY s.normalized_key, s.normalized_name, s.skill_type
        ORDER BY persons DESC, s.normalized_name ASC
        LIMIT 200`,
      [personIds],
    );
    // Inventario bruto; el estado UNMAPPED se afina offline (mappings no mutados aquí).
    return rows.map((r: Record<string, unknown>) => ({
      skillKey: r.normalized_key,
      skillName: r.normalized_name,
      skillType: r.skill_type,
      persons: r.persons,
      documents: r.documents,
      status: 'SIGNAL_INVENTORY',
    }));
  } catch (err) {
    return [
      {
        error: err instanceof Error ? err.message : String(err),
        status: 'INVENTORY_FAILED',
      },
    ];
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(resolve(ROOT, 'per-person'), { recursive: true });
  mkdirSync(resolve(ROOT, 'dry-run'), { recursive: true });
  mkdirSync(resolve(ROOT, 'browser-verification'), { recursive: true });

  const resumePath = resolve(ROOT, 'execution-summary.json');
  const doneDocs = new Set<string>();
  if (args.resume && existsSync(resumePath)) {
    try {
      const prev = JSON.parse(readFileSync(resumePath, 'utf8')) as {
        results?: Array<{ document?: string; status?: string }>;
      };
      for (const r of prev.results || []) {
        if (r.document && r.status === 'COMPLETED') doneDocs.add(r.document);
      }
    } catch {
      /* ignore */
    }
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);
    const version = await resolveActiveVersion(ds);
    const { parent, directChildrenCount } = await resolveParent(ds, version.id);
    const children = await loadDirectChildren(ds, version.id, parent.person_id);

    console.log(
      `${TAG} parent=${parent.person_id} children=${children.length} version=${version.code}`,
    );

    const cohortRows: Array<{
      personId: string;
      document: string | null;
      fullName: string;
      role: string | null;
      email: string | null;
      relationId: string;
      personActive: boolean;
      cohortClassification: FabricaCohortClass;
      cohortReason: string;
      included: boolean;
      pipelineState: FabricaPipelineState;
      action: ReturnType<typeof actionForFabricaPipelineState> | 'SKIP_MANUAL_REVIEW';
      contentClass: FabricaContentClass;
      cvSha256: string | null;
      shaError: string | null;
      activeCvId: string | null;
      activeCvDriveFileId: string | null;
      activeExtractionId: string | null;
      activeExtractionDriveFileId: string | null;
      activeExtractionSha: string | null;
      evaluations: unknown[];
    }> = [];
    for (const child of children) {
      const cohort = classifyFabricaCohortByRole(child.role_name);
      const audit = await auditPersonPipeline(ds, child);
      let contentClass: FabricaContentClass = 'NOT_APPLICABLE';
      let cvSha256: string | null = null;
      let shaError: string | undefined;
      if (isFabricaCohortIncluded(cohort.classification) && child.document) {
        const cmp = await maybeCompareSha({
          document: child.document,
          ds,
          pipelineState: audit.pipelineState,
          activeCv: audit.activeCv,
          activeExtraction: audit.activeExtraction,
        });
        contentClass = cmp.contentClass;
        cvSha256 = cmp.cvSha256;
        shaError = cmp.error;
      }
      const action = isFabricaCohortIncluded(cohort.classification)
        ? actionForFabricaPipelineState(audit.pipelineState, contentClass)
        : 'SKIP_MANUAL_REVIEW';

      cohortRows.push({
        personId: child.person_id,
        document: child.document,
        fullName: child.full_name,
        role: child.role_name,
        email: child.edu_email,
        relationId: child.relation_id,
        personActive: child.person_active,
        cohortClassification: cohort.classification,
        cohortReason: cohort.reason,
        included: isFabricaCohortIncluded(cohort.classification),
        pipelineState: audit.pipelineState,
        action,
        contentClass,
        cvSha256,
        shaError: shaError ?? null,
        activeCvId: audit.activeCv?.id ?? null,
        activeCvDriveFileId: audit.activeCv?.drive_file_id ?? null,
        activeExtractionId: audit.activeExtraction?.id ?? null,
        activeExtractionDriveFileId:
          audit.activeExtraction?.drive_file_id ?? null,
        activeExtractionSha: audit.activeExtraction?.pdf_sha256 ?? null,
        evaluations: audit.evaluations,
      });
    }

    const metrics = {
      directChildren: cohortRows.length,
      included: cohortRows.filter((r) => r.included).length,
      excludePresenter: cohortRows.filter(
        (r) => r.cohortClassification === 'EXCLUDE_PRESENTER',
      ).length,
      excludeAdministrative: cohortRows.filter(
        (r) => r.cohortClassification === 'EXCLUDE_ADMINISTRATIVE',
      ).length,
      excludeOther: cohortRows.filter(
        (r) => r.cohortClassification === 'EXCLUDE_OTHER_ROLE',
      ).length,
      manualReview: cohortRows.filter(
        (r) => r.cohortClassification === 'MANUAL_REVIEW',
      ).length,
      withoutDocument: cohortRows.filter((r) => !r.document).length,
      withoutActiveCv: cohortRows.filter((r) => !r.activeCvId).length,
      includeDesign: cohortRows.filter(
        (r) => r.cohortClassification === 'INCLUDE_DESIGN',
      ).length,
      includeAudiovisual: cohortRows.filter(
        (r) => r.cohortClassification === 'INCLUDE_AUDIOVISUAL',
      ).length,
      includeBoth: cohortRows.filter(
        (r) => r.cohortClassification === 'INCLUDE_DESIGN_AND_AUDIOVISUAL',
      ).length,
    };

    const preflight = {
      generatedAt: new Date().toISOString(),
      mode: args.execute ? 'EXECUTE' : 'DRY_RUN_READONLY',
      activeVersion: version,
      parent: {
        personId: parent.person_id,
        document: parent.document,
        fullName: parent.full_name,
        role: parent.role_name,
        email: parent.edu_email,
        isActive: parent.is_active,
        directChildrenCount,
      },
      metrics,
      presentersExcluded: cohortRows
        .filter((r) => r.cohortClassification === 'EXCLUDE_PRESENTER')
        .map((r) => ({
          document: r.document,
          fullName: r.fullName,
          role: r.role,
          reason:
            'Las presentadoras no fueron evaluadas porque su dominio profesional aún no está modelado. No fueron clasificadas artificialmente dentro de Diseño Visual ni Producción Audiovisual.',
        })),
      cohort: cohortRows,
    };
    writeJson(resolve(ROOT, 'cohort-preflight.json'), preflight);
    console.log(`${TAG} preflight → ${resolve(ROOT, 'cohort-preflight.json')}`);
    console.log(`${TAG} metrics`, metrics);

    if (!args.execute) {
      writeJson(resolve(ROOT, 'execution-summary.json'), {
        generatedAt: new Date().toISOString(),
        mode: 'DRY_RUN_READONLY',
        note: 'Sin --execute: no se llamó a Gemini ni se persistió. Use --execute para procesar.',
        metrics,
        parent: preflight.parent,
      });
      return;
    }

    let included = cohortRows.filter((r) => r.included && r.document);
    if (args.document) {
      included = included.filter((r) => r.document === args.document);
    }
    if (args.resume) {
      included = included.filter((r) => !doneDocs.has(String(r.document)));
    }
    if (args.limit && args.limit > 0) {
      included = included.slice(0, args.limit);
    }

    console.log(
      `${TAG} EXECUTE persons=${included.length} concurrency=${args.concurrency}`,
    );

    const results = await mapPool(
      included,
      args.concurrency,
      async (row) => {
        const startedAt = new Date().toISOString();
        const t0 = Date.now();
        console.log(`${TAG} → ${row.document} ${row.fullName} action=${row.action}`);
        try {
          if (
            row.action === 'SKIP_NO_CV' ||
            row.action === 'SKIP_PDF_INACCESSIBLE' ||
            row.action === 'SKIP_RUNNING' ||
            row.action === 'SKIP_UNVERIFIABLE' ||
            row.action === 'REPOINT_OR_METADATA_REPAIR' ||
            row.action === 'SKIP_MANUAL_REVIEW'
          ) {
            const result = {
              document: row.document,
              personId: row.personId,
              status: 'SKIPPED',
              action: row.action,
              pipelineState: row.pipelineState,
              contentClass: row.contentClass,
              startedAt,
              finishedAt: new Date().toISOString(),
              durationMs: Date.now() - t0,
            };
            writeJson(
              resolve(ROOT, 'per-person', `${row.document}.json`),
              result,
            );
            return result;
          }

          let extractionId = row.activeExtractionId;
          let reextracted = false;
          if (
            row.action === 'REEXTRACT_CURRENT_CV' ||
            row.action === 'CREATE_EXTRACTION'
          ) {
            if (!row.activeExtractionId && row.action === 'REEXTRACT_CURRENT_CV') {
              throw new Error('STALE sin extracción activa previa');
            }
            const rx = await reextractPerson({
              app,
              document: String(row.document),
              previousExtractionId: String(row.activeExtractionId || '0'),
            });
            extractionId = rx.newExtractionId;
            reextracted = true;
          }

          if (!extractionId) {
            throw new Error('Sin extractionId usable');
          }

          const domains = await ensureChainAndEvaluate({
            app,
            document: String(row.document),
            extractionId: String(extractionId),
            persist: true,
          });

          const result = {
            document: row.document,
            personId: row.personId,
            fullName: row.fullName,
            role: row.role,
            status: 'COMPLETED',
            action: row.action,
            pipelineStateBefore: row.pipelineState,
            reextracted,
            extractionId,
            domains,
            startedAt,
            finishedAt: new Date().toISOString(),
            durationMs: Date.now() - t0,
          };
          writeJson(
            resolve(ROOT, 'per-person', `${row.document}.json`),
            result,
          );
          console.log(
            `${TAG} ✓ ${row.document} ext=${extractionId} ` +
              domains
                .map((d) => `${d.domainCode}:${d.qualification}`)
                .join(' '),
          );
          return result;
        } catch (err) {
          const result = {
            document: row.document,
            personId: row.personId,
            status: 'ERROR',
            action: row.action,
            error: err instanceof Error ? err.message : String(err),
            startedAt,
            finishedAt: new Date().toISOString(),
            durationMs: Date.now() - t0,
          };
          writeJson(
            resolve(ROOT, 'per-person', `${row.document}.json`),
            result,
          );
          console.error(`${TAG} ✗ ${row.document}`, result.error);
          return result;
        }
      },
    );

    const includedPersonIds = included.map((r) => r.personId);
    const unmatched = await collectUnmappedSkills(ds, includedPersonIds);
    writeJson(resolve(ROOT, 'unmatched-skills.json'), {
      generatedAt: new Date().toISOString(),
      items: unmatched,
    });

    const coverage = {
      VISUAL_DESIGN: { PRIMARY_MATCH: 0, SECONDARY_SIGNAL: 0, OUTSIDE: 0, INSUFFICIENT_EVIDENCE: 0 },
      AUDIOVISUAL_PRODUCTION: {
        PRIMARY_MATCH: 0,
        SECONDARY_SIGNAL: 0,
        OUTSIDE: 0,
        INSUFFICIENT_EVIDENCE: 0,
      },
    };
    for (const r of results) {
      if (r.status !== 'COMPLETED' || !('domains' in r)) continue;
      for (const d of (r as { domains: Array<{ domainCode: string; qualification: string }> }).domains) {
        const bucket = coverage[d.domainCode as keyof typeof coverage];
        if (bucket && d.qualification in bucket) {
          bucket[d.qualification as keyof typeof bucket] += 1;
        }
      }
    }
    writeJson(resolve(ROOT, 'coverage-matrix.json'), {
      generatedAt: new Date().toISOString(),
      qualificationCounts: coverage,
      unmatchedTop: unmatched.slice(0, 40),
    });

    writeJson(resolve(ROOT, 'execution-summary.json'), {
      generatedAt: new Date().toISOString(),
      mode: 'EXECUTE',
      concurrency: args.concurrency,
      parent: preflight.parent,
      metrics,
      results,
      counts: {
        completed: results.filter((r) => r.status === 'COMPLETED').length,
        skipped: results.filter((r) => r.status === 'SKIPPED').length,
        errors: results.filter((r) => r.status === 'ERROR').length,
      },
      qualificationCounts: coverage,
    });
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(TAG, err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
