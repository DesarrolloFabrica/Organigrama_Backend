/**
 * MC1 — Piloto MVP coordinadores de escuela (C1 dry-run / C2 execute).
 *
 * npm run mc:pilot-school-coordinators -- --dry-run
 * npm run mc:pilot-school-coordinators -- --execute --confirm
 * npm run mc:pilot-school-coordinators -- --execute --confirm --document=1117526801
 * npm run mc:pilot-school-coordinators -- --execute --confirm --concurrency=1 --resume
 *
 * Sin --execute: writes = 0.
 * --execute requiere --confirm (aprobación explícita C2).
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  actionForSchoolC1,
  classifySchoolContentClass,
  classifySchoolPipelineState,
  diagnoseNewDomainOverall,
  classifyClusterSignal,
  MATRIX_COMPETENCY_ROWS,
  matrixStrengthFromLevels,
  SCHOOL_COORDINATORS_EXPECTED,
  SCHOOL_COORDINATORS_OPERATIVE_DOMAINS,
  resolveSchoolCoordinatorIdentity,
  type SchoolCoordinatorC1Action,
  type SchoolCoordinatorContentClass,
  type SchoolCoordinatorPipelineState,
  type ProvisionalClusterCode,
  type ClusterSignalClass,
} from '../../org-chart/mc-school-coordinators-cohort';
import { buildMvpProfessionalCapabilities } from '../../org-chart/mc-mvp-capability-projection';

const TAG = '[MC1 School coordinators]';
const ROOT = resolve('tmp/mc1-school-coordinators-mvp');

type CliArgs = {
  dryRun: boolean;
  execute: boolean;
  confirm: boolean;
  document?: string;
  resume: boolean;
  concurrency: number;
};

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    dryRun: true,
    execute: false,
    confirm: false,
    resume: false,
    concurrency: 2,
  };
  for (const arg of argv) {
    if (arg === '--execute') {
      out.execute = true;
      out.dryRun = false;
    } else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--confirm') out.confirm = true;
    else if (arg.startsWith('--document='))
      out.document = arg.slice('--document='.length).trim();
    else if (arg === '--resume') out.resume = true;
    else if (arg.startsWith('--concurrency=')) {
      out.concurrency = Math.max(
        1,
        Math.min(2, Number(arg.slice('--concurrency='.length)) || 2),
      );
    }
  }
  if (!out.execute) out.dryRun = true;
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

type TargetPerson = {
  key: string;
  expectedName: string;
  schoolLabel: string;
  personId: string;
  document: string;
  fullName: string;
  role: string | null;
  email: string | null;
  c1Action: SchoolCoordinatorC1Action;
  pipelineState: SchoolCoordinatorPipelineState;
  contentClass: SchoolCoordinatorContentClass;
  activeCvId: string;
  activeCvDriveFileId: string;
  previousExtractionId: string | null;
  previousExtractionSha: string | null;
  apt: boolean;
  abortReason?: string;
};

async function captureBaseline(ds: DataSource, personId: string, document: string) {
  const cvs = await ds.query(
    `SELECT id::text, drive_file_id, drive_file_name, is_active, mime_type
       FROM organigrama.person_cv WHERE person_id = $1`,
    [personId],
  );
  const exts = await ds.query(
    `SELECT id::text, drive_file_id, pdf_sha256, status, is_active, model,
            prompt_version, extractor_version, skills_count, finished_at
       FROM organigrama.cv_extraction WHERE person_id = $1 ORDER BY id DESC`,
    [personId],
  );
  const activeExt = exts.find(
    (e: { is_active: boolean; status: string }) =>
      e.is_active && e.status === 'SUCCEEDED',
  );
  let skills: unknown[] = [];
  let languages: unknown[] = [];
  let certifications: unknown[] = [];
  let enrichment: unknown = null;
  let evidence: unknown = null;
  if (activeExt) {
    skills = await ds.query(
      `SELECT s.normalized_name, s.skill_type, ces.original_name
         FROM organigrama.cv_extraction_skill ces
         JOIN organigrama.cv_skill s ON s.id = ces.skill_id
        WHERE ces.extraction_id = $1 ORDER BY ces.sort_order`,
      [activeExt.id],
    );
    languages = await ds.query(
      `SELECT name, level FROM organigrama.cv_extraction_language
        WHERE extraction_id = $1`,
      [activeExt.id],
    ).catch(() => []);
    certifications = await ds.query(
      `SELECT name, issuer FROM organigrama.cv_extraction_certification
        WHERE extraction_id = $1`,
      [activeExt.id],
    ).catch(() => []);
    const enr = await ds.query(
      `SELECT id::text, status, is_active FROM organigrama.cv_skill_enrichment
        WHERE extraction_id = $1 ORDER BY id DESC LIMIT 3`,
      [activeExt.id],
    );
    enrichment = enr;
    const ev = await ds.query(
      `SELECT id::text, status, is_active FROM organigrama.cv_evidence_evaluation
        WHERE extraction_id = $1 ORDER BY id DESC LIMIT 3`,
      [activeExt.id],
    );
    evidence = ev;
  }
  const evals = await ds.query(
    `SELECT id::text, domain_code, is_active, status, domain_qualification,
            extraction_id::text, active_count, emergent_count
       FROM organigrama.mc_profile_evaluation
      WHERE person_id = $1 ORDER BY id DESC LIMIT 20`,
    [personId],
  );
  writeJson(resolve(ROOT, 'before', `${document}.json`), {
    capturedAt: new Date().toISOString(),
    personId,
    document,
    person_cv: cvs,
    extractions: exts.map((e: Record<string, unknown>) => ({
      id: e.id,
      drive_file_id: e.drive_file_id,
      pdf_sha256: e.pdf_sha256,
      status: e.status,
      is_active: e.is_active,
      model: e.model,
      prompt_version: e.prompt_version,
      extractor_version: e.extractor_version,
      skills_count: e.skills_count,
    })),
    activeExtractionId: activeExt?.id ?? null,
    skills,
    languages,
    certifications,
    enrichment,
    evidence,
    evaluations: evals,
  });
}

async function evaluateDomains(params: {
  pa2: McPa2Service;
  extractionId: string;
  persist: boolean;
}) {
  const dryResults: Array<{
    domainCode: string;
    rulesVersion: string;
    qualification: McDomainQualification;
    dry: Awaited<ReturnType<McPa2Service['evaluateProfileDomain']>>;
  }> = [];
  for (const d of SCHOOL_COORDINATORS_OPERATIVE_DOMAINS) {
    const dry = await params.pa2.evaluateProfileDomain({
      extractionId: params.extractionId,
      domainCode: d.domainCode,
      rulesVersion: d.rulesVersion,
      persist: false,
    });
    dryResults.push({
      domainCode: d.domainCode,
      rulesVersion: d.rulesVersion,
      qualification: classifyDomainConceptually(dry.result, 'MEDIUM'),
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
  for (const r of dryResults) {
    const activateOnPersist =
      params.persist &&
      r.domainCode === winner &&
      (r.qualification === 'PRIMARY_MATCH' ||
        r.qualification === 'SECONDARY_SIGNAL');
    let evaluationId: string | null = null;
    let outcome = 'DRY_RUN';
    if (params.persist) {
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
}) {
  const ds = params.app.get(DataSource);
  const pa2 = params.app.select(McCatalogModule).get(McPa2Service);

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

async function extractOrReuse(params: {
  app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;
  document: string;
  previousExtractionId: string | null;
}): Promise<{
  extractionId: string;
  skillsCount: number;
  reextracted: boolean;
  action: 'REEXTRACT' | 'FIRST_EXTRACTION' | 'NO_ACTION';
}> {
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
      extractionId: String(existing.id),
      skillsCount: Number(existing.skills_count || 0),
      reextracted: false,
      action: 'NO_ACTION',
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
      extractionId: String(completed.id),
      skillsCount: Number(completed.skills_count || 0),
      reextracted: true,
      action: params.previousExtractionId ? 'REEXTRACT' : 'FIRST_EXTRACTION',
    };
  } catch (err) {
    try {
      await persistence.failExtraction(running.id, {
        errorStage: 'SCHOOL_COORDINATORS_C2',
        errorMessage: (err instanceof Error ? err.message : String(err)).slice(
          0,
          2000,
        ),
      });
    } catch {
      /* ignore */
    }
    if (params.previousExtractionId) {
      await ds.query(
        `UPDATE organigrama.cv_extraction SET is_active = TRUE, updated_at = NOW()
          WHERE id = $1 AND status = 'SUCCEEDED'`,
        [params.previousExtractionId],
      );
    }
    throw err;
  }
}

async function loadMvpFromExtraction(ds: DataSource, extractionId: string) {
  const rows = await ds.query(
    `SELECT s.normalized_name, ces.original_name, s.skill_type,
            ei.evidence_level, ei.has_work_experience,
            ei.substantive_evidence_count, ces.evidence AS evidence_text,
            ces.evidence_items
       FROM organigrama.cv_extraction_skill ces
       JOIN organigrama.cv_skill s ON s.id = ces.skill_id
       LEFT JOIN organigrama.cv_evidence_evaluation ev
         ON ev.extraction_id = ces.extraction_id
        AND ev.is_active = TRUE AND ev.status = 'SUCCEEDED'
       LEFT JOIN organigrama.cv_evidence_evaluation_item ei
         ON ei.evaluation_id = ev.id AND ei.extraction_skill_id = ces.id
      WHERE ces.extraction_id = $1`,
    [extractionId],
  );
  return buildMvpProfessionalCapabilities(
    rows.map((r: Record<string, unknown>) => ({
      normalizedName: String(r.normalized_name ?? ''),
      originalName: r.original_name ? String(r.original_name) : null,
      skillType: r.skill_type ? String(r.skill_type) : null,
      evidenceLevel: r.evidence_level ? String(r.evidence_level) : null,
      hasWorkExperience:
        r.has_work_experience == null ? null : Boolean(r.has_work_experience),
      substantiveCount:
        r.substantive_evidence_count == null
          ? null
          : Number(r.substantive_evidence_count),
      evidenceText: r.evidence_text ? String(r.evidence_text) : null,
      evidenceItems:
        (r.evidence_items as Array<{
          sourceType?: string;
          evidenceText?: string;
        }> | null) ?? null,
    })),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `${TAG} mode=${args.execute ? 'EXECUTE' : 'DRY_RUN'} concurrency=${args.concurrency}`,
  );

  if (args.execute && !args.confirm) {
    console.error(
      `${TAG} --execute requiere --confirm (aprobación explícita Fase C2). writes=0`,
    );
    process.exitCode = 2;
    return;
  }

  mkdirSync(resolve(ROOT, 'before'), { recursive: true });
  mkdirSync(resolve(ROOT, 'after'), { recursive: true });
  mkdirSync(resolve(ROOT, 'per-person'), { recursive: true });
  mkdirSync(resolve(ROOT, 'browser-verification'), { recursive: true });
  mkdirSync(resolve(ROOT, 'preflight'), { recursive: true });

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

    const targets: TargetPerson[] = [];

    for (const expected of SCHOOL_COORDINATORS_EXPECTED) {
      const identity = resolveSchoolCoordinatorIdentity(
        expected,
        people.map((p) => ({
          personId: p.person_id,
          document: p.document,
          fullName: p.full_name,
          roleName: p.role_name,
          email: p.edu_email,
          isActive: p.is_active,
        })),
      );
      if (identity.status !== 'RESOLVED' || !identity.selected?.document) {
        targets.push({
          key: expected.key,
          expectedName: expected.expectedName,
          schoolLabel: expected.schoolLabel,
          personId: '',
          document: '',
          fullName: expected.expectedName,
          role: null,
          email: null,
          c1Action: 'MANUAL_REVIEW',
          pipelineState: 'MANUAL_REVIEW',
          contentClass: 'UNVERIFIABLE',
          activeCvId: '',
          activeCvDriveFileId: '',
          previousExtractionId: null,
          previousExtractionSha: null,
          apt: false,
          abortReason: identity.reason,
        });
        continue;
      }

      const selected = identity.selected;
      const rel = await ds.query(
        `SELECT ovr.id::text FROM organigrama.org_visual_relation ovr
          WHERE ovr.child_person_id = $1 AND ovr.version_id = $2
            AND ovr.is_active = TRUE LIMIT 1`,
        [selected.personId, version.id],
      );
      if (!rel[0]) {
        targets.push({
          key: expected.key,
          expectedName: expected.expectedName,
          schoolLabel: expected.schoolLabel,
          personId: selected.personId,
          document: selected.document!,
          fullName: selected.fullName,
          role: selected.roleName,
          email: selected.email,
          c1Action: 'MANUAL_REVIEW',
          pipelineState: 'MANUAL_REVIEW',
          contentClass: 'UNVERIFIABLE',
          activeCvId: '',
          activeCvDriveFileId: '',
          previousExtractionId: null,
          previousExtractionSha: null,
          apt: false,
          abortReason: 'NOT_IN_ACTIVE_VERSION',
        });
        continue;
      }

      const cvs = await ds.query(
        `SELECT id::text, drive_file_id, drive_file_name, is_active, mime_type
           FROM organigrama.person_cv WHERE person_id = $1`,
        [selected.personId],
      );
      const activeCvs = cvs.filter((c: { is_active: boolean }) => c.is_active);
      const exts = await ds.query(
        `SELECT id::text, drive_file_id, pdf_sha256, status, is_active
           FROM organigrama.cv_extraction WHERE person_id = $1 ORDER BY id DESC`,
        [selected.personId],
      );
      const activeExt = exts.find(
        (e: { is_active: boolean; status: string }) =>
          e.is_active && e.status === 'SUCCEEDED',
      );
      const running = exts.some((e: { status: string }) =>
        ['RUNNING', 'PENDING'].includes(e.status),
      );
      const activeExtCount = exts.filter(
        (e: { is_active: boolean }) => e.is_active,
      ).length;

      let pipelineState = classifySchoolPipelineState({
        hasActivePersonCv: activeCvs.length === 1,
        activeCvDriveFileId: activeCvs[0]?.drive_file_id ?? null,
        activeExtraction: activeExt
          ? {
              status: activeExt.status,
              isActive: activeExt.is_active,
              driveFileId: activeExt.drive_file_id,
            }
          : null,
        hasRunningOrPending: running,
      });

      let contentClass: SchoolCoordinatorContentClass = 'NOT_APPLICABLE';
      let abortReason: string | undefined;

      if (activeCvs.length !== 1) {
        abortReason = 'ACTIVE_CV_COUNT';
      } else if (activeExtCount > 1) {
        abortReason = 'MULTIPLE_ACTIVE_EXTRACTIONS';
      } else if (running) {
        abortReason = 'RUNNING_OR_PENDING';
      } else {
        try {
          const prepared = await prepareCvPdfForExtraction({
            document: selected.document!,
            dataSource: ds,
          });
          if (!prepared.pdfByteSize || prepared.pdfByteSize <= 0) {
            abortReason = 'PDF_EMPTY';
          }
          if (pipelineState === 'STALE_SELECTED_EXTRACTION') {
            contentClass = classifySchoolContentClass({
              cvDriveFileId: activeCvs[0].drive_file_id,
              extractionDriveFileId: activeExt?.drive_file_id ?? null,
              cvSha256: prepared.pdfSha256,
              extractionSha256: activeExt?.pdf_sha256 ?? null,
            });
            if (contentClass === 'SAME_CONTENT_DIFFERENT_FILE_ID') {
              pipelineState = 'SAME_CONTENT_DIFFERENT_FILE_ID';
            }
          }
        } catch (err) {
          abortReason = err instanceof Error ? err.message : String(err);
          pipelineState = 'PDF_NOT_ACCESSIBLE';
        }
      }

      const c1Action = abortReason
        ? 'MANUAL_REVIEW'
        : actionForSchoolC1({
            identityStatus: 'RESOLVED',
            pipelineState,
            contentClass,
            inActiveVersion: true,
          });

      targets.push({
        key: expected.key,
        expectedName: expected.expectedName,
        schoolLabel: expected.schoolLabel,
        personId: selected.personId,
        document: selected.document!,
        fullName: selected.fullName,
        role: selected.roleName,
        email: selected.email,
        c1Action,
        pipelineState,
        contentClass,
        activeCvId: activeCvs[0]?.id ?? '',
        activeCvDriveFileId: activeCvs[0]?.drive_file_id ?? '',
        previousExtractionId: activeExt?.id ?? null,
        previousExtractionSha: activeExt?.pdf_sha256 ?? null,
        apt: !abortReason && c1Action !== 'MANUAL_REVIEW' && c1Action !== 'BLOCKED_NO_CV',
        abortReason,
      });
    }

    writeJson(resolve(ROOT, 'cohort.json'), {
      generatedAt: new Date().toISOString(),
      phase: args.execute ? 'C2' : 'C1',
      writes: args.execute ? 'pending' : 0,
      activeVersion: version,
      preflight: targets.map((t) => ({
        document: t.document,
        personId: t.personId,
        personCvId: t.activeCvId,
        previousExtractionId: t.previousExtractionId,
        pipelineState: t.pipelineState,
        c1Action: t.c1Action,
        apt: t.apt,
        abortReason: t.abortReason ?? null,
      })),
    });

    console.log(`${TAG} preflight:`);
    for (const t of targets) {
      console.log(
        `  ${t.document || t.key} state=${t.pipelineState} action=${t.c1Action} apt=${t.apt}`,
      );
    }

    if (!args.execute) {
      console.log(`${TAG} DRY_RUN only — use --execute --confirm for C2`);
      return;
    }

    let work = targets.filter((t) => t.apt && t.document);
    if (args.document) work = work.filter((t) => t.document === args.document);
    if (args.resume) work = work.filter((t) => !doneDocs.has(t.document));

    console.log(`${TAG} EXECUTE persons=${work.length}`);

    const results = await mapPool(work, args.concurrency, async (t) => {
      const startedAt = new Date().toISOString();
      const t0 = Date.now();
      console.log(`${TAG} → ${t.document} ${t.fullName} ${t.c1Action}`);
      try {
        await captureBaseline(ds, t.personId, t.document);

        let extractionId = t.previousExtractionId;
        let reextracted = false;
        let extractAction: string = t.c1Action;

        if (
          t.c1Action === 'REEXTRACT' ||
          t.c1Action === 'FIRST_EXTRACTION'
        ) {
          const rx = await extractOrReuse({
            app,
            document: t.document,
            previousExtractionId: t.previousExtractionId,
          });
          extractionId = rx.extractionId;
          reextracted = rx.reextracted;
          extractAction = rx.action;
        } else if (t.c1Action === 'EVALUATE_CURRENT_EXTRACTION') {
          extractAction = 'NO_ACTION';
        }

        if (!extractionId) throw new Error('Sin extractionId');

        const domains = await ensureChainAndEvaluate({
          app,
          document: t.document,
          extractionId,
          persist: true,
        });

        const hasPublishable = domains.some(
          (d) =>
            d.qualification === 'PRIMARY_MATCH' ||
            d.qualification === 'SECONDARY_SIGNAL',
        );
        const mvp = await loadMvpFromExtraction(ds, extractionId);
        mvp.classificationPending = !hasPublishable;

        const after = {
          document: t.document,
          personId: t.personId,
          extractionId,
          domains,
          mvp: {
            consolidated: mvp.consolidatedCapabilities.length,
            complementary: mvp.complementaryCapabilities.length,
            emerging: mvp.emergingCapabilities.length,
            tools: mvp.tools.length,
            methodologies: mvp.methodologies.length,
            qualityAlerts: mvp.qualityAlerts,
            classificationPending: mvp.classificationPending,
          },
          mvpDetail: mvp,
        };
        writeJson(resolve(ROOT, 'after', `${t.document}.json`), after);

        const result = {
          document: t.document,
          personId: t.personId,
          fullName: t.fullName,
          school: t.schoolLabel,
          role: t.role,
          status: 'COMPLETED',
          action: extractAction,
          pipelineStateBefore: t.pipelineState,
          previousExtractionId: t.previousExtractionId,
          extractionId,
          reextracted,
          domains,
          mvp: after.mvp,
          qualityAlerts: mvp.qualityAlerts,
          startedAt,
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - t0,
        };
        writeJson(resolve(ROOT, 'per-person', `${t.document}.json`), result);
        console.log(
          `${TAG} ✓ ${t.document} ext=${extractionId} ` +
            domains.map((d) => `${d.domainCode}:${d.qualification}`).join(' ') +
            ` mvp=${mvp.consolidatedCapabilities.length}/${mvp.complementaryCapabilities.length}`,
        );
        return result;
      } catch (err) {
        const result = {
          document: t.document,
          personId: t.personId,
          fullName: t.fullName,
          status: 'ERROR',
          action: t.c1Action,
          error: err instanceof Error ? err.message : String(err),
          startedAt,
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - t0,
        };
        writeJson(resolve(ROOT, 'per-person', `${t.document}.json`), result);
        console.error(`${TAG} ✗ ${t.document}`, result.error);
        return result;
      }
    });

    // Matrix + domain analysis from after files
    const mvpByKey = new Map<string, ReturnType<typeof buildMvpProfessionalCapabilities>>();
    for (const t of work) {
      const afterPath = resolve(ROOT, 'after', `${t.document}.json`);
      if (!existsSync(afterPath)) continue;
      const after = JSON.parse(readFileSync(afterPath, 'utf8')) as {
        mvpDetail?: ReturnType<typeof buildMvpProfessionalCapabilities>;
      };
      if (after.mvpDetail) mvpByKey.set(t.key, after.mvpDetail);
    }

    const matrix = {
      generatedAt: new Date().toISOString(),
      rows: MATRIX_COMPETENCY_ROWS.map((row) => {
        const cells: Record<string, string> = {};
        for (const expected of SCHOOL_COORDINATORS_EXPECTED) {
          const mvp = mvpByKey.get(expected.key);
          if (!mvp) {
            cells[expected.key] = 'ABSENT';
            continue;
          }
          const all = [
            ...mvp.consolidatedCapabilities,
            ...mvp.complementaryCapabilities,
            ...mvp.emergingCapabilities,
          ];
          const levels = all
            .filter((c) =>
              row.needles.some((n) =>
                `${c.label} ${c.originalSignals.join(' ')}`
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .includes(
                    n
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .toLowerCase(),
                  ),
              ),
            )
            .map((c) =>
              c.evidenceLevel === 'STRONG'
                ? ('STRONG_PROFESSIONAL_EVIDENCE' as const)
                : c.evidenceLevel === 'MODERATE'
                  ? ('MODERATE_PROFESSIONAL_EVIDENCE' as const)
                  : ('TOOL_OR_TERM_ONLY' as const),
            );
          cells[expected.key] = matrixStrengthFromLevels(levels);
        }
        return { key: row.key, label: row.label, family: row.family, cells };
      }),
    };
    writeJson(resolve(ROOT, 'capability-matrix.json'), matrix);

    const clusterAgg = new Map<
      ProvisionalClusterCode,
      { persons: Set<string>; strong: number; moderate: number; comps: Map<string, number> }
    >();
    for (const [key, mvp] of mvpByKey) {
      for (const cap of [
        ...mvp.consolidatedCapabilities,
        ...mvp.complementaryCapabilities,
      ]) {
        for (const cluster of cap.clusters) {
          if (!clusterAgg.has(cluster)) {
            clusterAgg.set(cluster, {
              persons: new Set(),
              strong: 0,
              moderate: 0,
              comps: new Map(),
            });
          }
          const a = clusterAgg.get(cluster)!;
          a.persons.add(key);
          if (cap.evidenceLevel === 'STRONG') a.strong += 1;
          if (cap.evidenceLevel === 'MODERATE') a.moderate += 1;
          a.comps.set(cap.label, (a.comps.get(cap.label) || 0) + 1);
        }
      }
    }

    const profilesWithoutDomain = results.filter((r) => {
      if (r.status !== 'COMPLETED' || !('domains' in r)) return false;
      const domains = (r as { domains: Array<{ qualification: string }> }).domains;
      return !domains.some(
        (d) =>
          d.qualification === 'PRIMARY_MATCH' ||
          d.qualification === 'SECONDARY_SIGNAL',
      );
    }).length;

    const clusters = [...clusterAgg.entries()].map(([code, a]) => {
      const signalClass: ClusterSignalClass = classifyClusterSignal({
        personCount: a.persons.size,
        strongHits: a.strong,
        coveredByOperativeDomain: false,
      });
      return {
        provisionalCluster: code,
        personKeys: [...a.persons],
        personCount: a.persons.size,
        strongEvidence: a.strong,
        moderateEvidence: a.moderate,
        topCompetencies: [...a.comps.entries()]
          .sort((x, y) => y[1] - x[1])
          .slice(0, 10)
          .map(([name, count]) => ({ name, count })),
        signalClass,
        note: 'Etiqueta provisional. No crear en catálogo.',
      };
    });

    const diagnosis = diagnoseNewDomainOverall({
      clusters: clusters.map((c) => ({
        signalClass: c.signalClass,
        personCount: c.personCount,
      })),
      profilesWithoutRepresentableDomain: profilesWithoutDomain,
    });

    writeJson(resolve(ROOT, 'new-domain-analysis.json'), {
      generatedAt: new Date().toISOString(),
      diagnosis,
      profilesWithoutRepresentableDomain: profilesWithoutDomain,
      clusters,
      recommendation:
        diagnosis === 'STRONG_DOMAIN_CANDIDATE' ||
        diagnosis === 'DOMAIN_CANDIDATE_REQUIRES_MORE_PROFILES'
          ? 'REQUIRE_MORE_PROFILES'
          : diagnosis === 'WEAK_NEW_DOMAIN_SIGNAL'
            ? 'KEEP_AS_CROSS_DOMAIN_CAPABILITIES'
            : 'KEEP_AS_CROSS_DOMAIN_CAPABILITIES',
      antiForce:
        'La escuela no implica dominio. Liderazgo/comunicación/proyectos son transversales.',
    });

    const unmatched: Array<{
      signal: string;
      personKey: string;
      status: string;
      cluster: ProvisionalClusterCode | null;
      evidenceLevel: string;
      action: string;
    }> = [];
    for (const [key, mvp] of mvpByKey) {
      for (const cap of [
        ...mvp.consolidatedCapabilities,
        ...mvp.complementaryCapabilities,
        ...mvp.emergingCapabilities,
      ]) {
        unmatched.push({
          signal: cap.label,
          personKey: key,
          status: cap.normalization,
          cluster: cap.clusters[0] ?? null,
          evidenceLevel: cap.evidenceLevel,
          action:
            cap.normalization === 'UNMAPPED_SIGNAL'
              ? 'REVIEW_FOR_ALIAS_OR_CATALOG'
              : 'OBSERVE',
        });
      }
    }
    writeJson(resolve(ROOT, 'unmatched-skills.json'), {
      generatedAt: new Date().toISOString(),
      items: unmatched,
    });

    writeJson(resolve(ROOT, 'execution-summary.json'), {
      generatedAt: new Date().toISOString(),
      mode: 'EXECUTE_C2',
      concurrency: args.concurrency,
      results,
      counts: {
        completed: results.filter((r) => r.status === 'COMPLETED').length,
        errors: results.filter((r) => r.status === 'ERROR').length,
        aborted: targets.filter((t) => !t.apt).length,
      },
      diagnosis,
    });

    writeJson(resolve(ROOT, 'browser-verification', 'sample-plan.json'), {
      status: 'PLAN_ONLY_UI_SESSION_PENDING',
      documents: work.map((t) => t.document),
      checks: [
        'ficha carga',
        'competencias consolidadas visibles cuando existan',
        'herramientas separadas',
        'sin dominio ficticio',
        'mensaje clasificación pendiente cuando aplique',
        'selector solo con 2+ dominios',
      ],
    });

    console.log(
      `${TAG} FASE C2 done completed=${results.filter((r) => r.status === 'COMPLETED').length} errors=${results.filter((r) => r.status === 'ERROR').length} diagnosis=${diagnosis}`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(TAG, err);
  process.exitCode = 1;
});
