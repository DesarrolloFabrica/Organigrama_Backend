/**
 * MC1 — Piloto de reextracción controlada (Diseño Visual).
 *
 * npm run mc:pilot-reextract-visual -- --documents=1000035262,1000590473 --i-confirm-persist
 * npm run mc:pilot-reextract-visual -- --documents=1000035262 --dry-run-only
 *
 * Conserva historial. Rollback documentado si falla post-extracción.
 * No modifica catálogo/mappings/PA2 thresholds/API/frontend/Drive.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { mkdirSync, writeFileSync } from 'node:fs';
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
import {
  countExtractedSkills,
  prepareCvPdfForExtraction,
  runExtractCvSkillsPipeline,
} from './utils/extract-cv-skills-pipeline';
import { createDriveCvClient } from './utils/google-drive-cv-client';

const TAG = '[MC1 Visual reextract pilot]';
const ROOT = resolve('tmp/mc-visual-design-reextraction-pilot');
const VISUAL_HINTS_MOLANO =
  /diseno|graf|identidad|branding|ilustr|arte|pieza|interact|animacion|figma|illustrator|photoshop|indesign/i;
const VISUAL_HINTS_100059 =
  /ux|ui|prototip|figma|adobe.?xd|editorial|identidad|pedagog|motion|illustrator|photoshop|after.?effects|redes/i;

type PilotArgs = {
  documents: string[];
  dryRunOnly: boolean;
  confirmPersist: boolean;
};

function parseArgs(argv: string[]): PilotArgs {
  const out: PilotArgs = {
    documents: ['1000035262', '1000590473'],
    dryRunOnly: false,
    confirmPersist: false,
  };
  for (const arg of argv) {
    if (arg.startsWith('--documents=')) {
      out.documents = arg
        .slice('--documents='.length)
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
    } else if (arg === '--dry-run-only') out.dryRunOnly = true;
    else if (arg === '--i-confirm-persist') out.confirmPersist = true;
  }
  return out;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function tableExists(ds: DataSource, table: string): Promise<boolean> {
  const rows = await ds.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'organigrama' AND table_name = $1`,
    [table],
  );
  return rows.length > 0;
}

async function columnExists(
  ds: DataSource,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await ds.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'organigrama'
        AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return rows.length > 0;
}

/**
 * Migración 022 aditiva: requerida por la entidad TypeORM vigente.
 * No cambia reglas PA2 / thresholds / mappings.
 */
async function ensureDomainQualificationColumn(ds: DataSource): Promise<boolean> {
  if (await columnExists(ds, 'mc_profile_evaluation', 'domain_qualification')) {
    return false;
  }
  console.log(
    `${TAG} aplicando migración 022 (ADD domain_qualification) — prerequisito de entidad PA2`,
  );
  await ds.query(`
    ALTER TABLE organigrama.mc_profile_evaluation
      ADD COLUMN IF NOT EXISTS domain_qualification VARCHAR(32) NULL
  `);
  await ds.query(`
    ALTER TABLE organigrama.mc_profile_evaluation
      DROP CONSTRAINT IF EXISTS chk_mc_profile_eval_domain_qualification
  `);
  await ds.query(`
    ALTER TABLE organigrama.mc_profile_evaluation
      ADD CONSTRAINT chk_mc_profile_eval_domain_qualification
      CHECK (
        domain_qualification IS NULL
        OR domain_qualification IN (
          'PRIMARY_MATCH',
          'SECONDARY_SIGNAL',
          'OUTSIDE',
          'INSUFFICIENT_EVIDENCE'
        )
      )
  `);
  return true;
}

async function captureBaseline(
  ds: DataSource,
  document: string,
  personId: string,
): Promise<Record<string, unknown>> {
  const cvs = await ds.query(
    `SELECT id::text, person_id::text, document, drive_file_id, drive_file_name,
            drive_relative_path, mime_type, is_active, synced_at::text
       FROM organigrama.person_cv WHERE person_id = $1 ORDER BY is_active DESC, id DESC`,
    [personId],
  );
  const exts = await ds.query(
    `SELECT id::text, person_cv_id::text, document, drive_file_id, pdf_sha256,
            status, is_active, model, prompt_version, extractor_version,
            skills_count, started_at::text, finished_at::text, warnings
       FROM organigrama.cv_extraction WHERE person_id = $1 ORDER BY id DESC`,
    [personId],
  );
  const activeExt = exts.find(
    (e: { is_active: boolean; status: string }) =>
      e.is_active && e.status === 'SUCCEEDED',
  );
  let skills: unknown[] = [];
  if (activeExt) {
    skills = await ds.query(
      `SELECT sk.normalized_key, sk.normalized_name, sk.skill_type,
              es.original_name, LEFT(COALESCE(es.evidence,''), 80) AS evidence_snip
         FROM organigrama.cv_extraction_skill es
         JOIN organigrama.cv_skill sk ON sk.id = es.skill_id
        WHERE es.extraction_id = $1
        ORDER BY es.sort_order NULLS LAST, es.id`,
      [activeExt.id],
    );
  }
  const langs = activeExt
    ? await ds.query(
        `SELECT name, level FROM organigrama.cv_extraction_language WHERE extraction_id = $1`,
        [activeExt.id],
      )
    : [];
  const certs = activeExt
    ? await ds.query(
        `SELECT name, issuer FROM organigrama.cv_extraction_certification WHERE extraction_id = $1`,
        [activeExt.id],
      )
    : [];
  const enrich = await ds.query(
    `SELECT id::text, extraction_id::text, status, is_active, pdf_sha256,
            input_skills_count, output_skills_count
       FROM organigrama.cv_skill_enrichment
      WHERE person_id = $1 ORDER BY is_active DESC, id DESC LIMIT 5`,
    [personId],
  );
  const evidence = await ds.query(
    `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active
       FROM organigrama.cv_evidence_evaluation
      WHERE person_id = $1 ORDER BY is_active DESC, id DESC LIMIT 5`,
    [personId],
  );

  const hasQual = await columnExists(
    ds,
    'mc_profile_evaluation',
    'domain_qualification',
  );
  const visualEval = await ds.query(
    `SELECT id::text, extraction_id::text, status, is_active, domain_code,
            ${hasQual ? 'domain_qualification,' : ''}
            active_count, emergent_count, hidden_count,
            engine_rules_version, mapping_pack_version, catalog_version_id::text
       FROM organigrama.mc_profile_evaluation
      WHERE person_id = $1 AND domain_code = 'VISUAL_DESIGN'
      ORDER BY is_active DESC, id DESC LIMIT 5`,
    [personId],
  );

  let evalSets: unknown[] = [];
  if (await tableExists(ds, 'mc_evaluation_set')) {
    evalSets = await ds.query(
      `SELECT id::text, status, schema_version, qualification_policy_version, context_hash
         FROM organigrama.mc_evaluation_set
        WHERE person_id = $1 ORDER BY id DESC LIMIT 3`,
      [personId],
    );
  }

  return {
    document,
    personId,
    capturedAt: new Date().toISOString(),
    schemaNotes: {
      hasDomainQualification: hasQual,
      hasEvaluationSet: await tableExists(ds, 'mc_evaluation_set'),
    },
    personCv: cvs.find((c: { is_active: boolean }) => c.is_active) ?? null,
    activeExtraction: activeExt ?? null,
    extractions: exts.map((e: Record<string, unknown>) => ({
      id: e.id,
      drive_file_id: e.drive_file_id,
      pdf_sha256: e.pdf_sha256,
      status: e.status,
      is_active: e.is_active,
      skills_count: e.skills_count,
      model: e.model,
      prompt_version: e.prompt_version,
      extractor_version: e.extractor_version,
    })),
    skills,
    languages: langs,
    certifications: certs,
    enrichments: enrich,
    evidences: evidence,
    visualEvaluations: visualEval,
    evaluationSets: evalSets,
  };
}

async function rollbackToPreviousExtraction(
  persistence: CvSkillsPersistenceService,
  ds: DataSource,
  previousExtractionId: string,
  newExtractionId: string,
): Promise<void> {
  // Documented emergency path: deactivate new, reactivate previous (SUCCEEDED only).
  await ds.query(
    `UPDATE organigrama.cv_extraction
        SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1 AND is_active = TRUE`,
    [newExtractionId],
  );
  await ds.query(
    `UPDATE organigrama.cv_extraction
        SET is_active = TRUE, updated_at = NOW()
      WHERE id = $1 AND status = 'SUCCEEDED' AND is_active = FALSE`,
    [previousExtractionId],
  );
  void persistence;
}

async function processDocument(params: {
  document: string;
  dryRunOnly: boolean;
  confirmPersist: boolean;
  app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;
}): Promise<Record<string, unknown>> {
  const { document, dryRunOnly, confirmPersist, app } = params;
  const ds = app.get(DataSource);
  const extractionSvc = app.get(CvSkillsExtractionService);
  const persistence = app.get(CvSkillsPersistenceService);
  const config = app.get(ConfigService);
  const drive = createDriveCvClient();

  const model = config.get<string>('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;
  const promptVersion = CV_SKILLS_PROMPT_VERSION;
  const extractorVersion = CV_SKILLS_EXTRACTOR_VERSION;

  // --- preconditions ---
  const persons = await ds.query(
    `SELECT id::text AS id FROM core.person WHERE document = $1`,
    [document],
  );
  if (persons.length !== 1) {
    return { document, result: 'ABORTED', reason: 'PERSON_LOOKUP' };
  }
  const personId = persons[0].id as string;

  const cvs = await ds.query(
    `SELECT id::text AS id, drive_file_id, drive_file_name, mime_type, is_active,
            drive_relative_path
       FROM organigrama.person_cv WHERE person_id = $1 AND is_active = TRUE`,
    [personId],
  );
  if (cvs.length !== 1) {
    return {
      document,
      result: 'ABORTED',
      reason: 'PERSON_CV_COUNT',
      activeCvCount: cvs.length,
    };
  }

  const exts = await ds.query(
    `SELECT id::text AS id, drive_file_id, pdf_sha256, status, is_active,
            person_cv_id::text AS person_cv_id
       FROM organigrama.cv_extraction WHERE person_id = $1`,
    [personId],
  );
  const activeExt = exts.find(
    (e: { is_active: boolean; status: string }) =>
      e.is_active && e.status === 'SUCCEEDED',
  );
  if (!activeExt) {
    return { document, result: 'ABORTED', reason: 'NO_ACTIVE_SUCCEEDED' };
  }
  const running = exts.filter((e: { status: string }) =>
    ['RUNNING', 'PENDING'].includes(e.status),
  );
  if (running.length > 0) {
    return { document, result: 'ABORTED', reason: 'RUNNING_OR_PENDING' };
  }
  if (String(activeExt.drive_file_id) === String(cvs[0].drive_file_id)) {
    return { document, result: 'ABORTED', reason: 'NOT_STALE' };
  }

  const prepared = await prepareCvPdfForExtraction({ document, dataSource: ds });
  const metaResp = await drive.files.get({
    fileId: prepared.driveFileId,
    fields: 'id,name,mimeType,modifiedTime,md5Checksum,size',
    supportsAllDrives: true,
  });
  const meta = metaResp.data;
  const oldSha = String(activeExt.pdf_sha256).toLowerCase();
  const newSha = prepared.pdfSha256.toLowerCase();
  const contentClass =
    oldSha === newSha
      ? 'SAME_CONTENT_DIFFERENT_FILE_ID'
      : 'DIFFERENT_CONTENT';

  if (contentClass === 'SAME_CONTENT_DIFFERENT_FILE_ID') {
    return {
      document,
      result: 'REPOINT_OR_METADATA_REPAIR',
      contentClass,
      oldSha,
      newSha,
      cvFileId: cvs[0].drive_file_id,
      extFileId: activeExt.drive_file_id,
    };
  }

  const before = await captureBaseline(ds, document, personId);
  writeJson(resolve(ROOT, 'before', `${document}.json`), before);

  // --- dry-run extraction ---
  console.log(`${TAG} ${document}: dry-run Gemini…`);
  const dryPipeline = await runExtractCvSkillsPipeline({
    document,
    dataSource: ds,
    extractionService: extractionSvc,
  });
  const skillNames = dryPipeline.result.categories.flatMap((c) =>
    c.skills.map((s) => ({
      key: s.normalizedName,
      original: s.originalName,
      type: s.skillType,
    })),
  );
  const hintRe =
    document === '1000035262' ? VISUAL_HINTS_MOLANO : VISUAL_HINTS_100059;
  const visualHits = skillNames.filter(
    (s) => hintRe.test(s.key) || hintRe.test(s.original),
  );

  const dryRunPayload = {
    document,
    personId,
    personCvId: prepared.personCvId,
    driveFileId: prepared.driveFileId,
    pdfSha256: prepared.pdfSha256,
    pdfByteSize: prepared.pdfByteSize,
    contentClass,
    driveMeta: {
      name: meta.name,
      modifiedTime: meta.modifiedTime,
      md5Checksum: meta.md5Checksum,
      size: meta.size,
    },
    model,
    promptVersion,
    extractorVersion,
    skillsCount: countExtractedSkills(dryPipeline.result),
    languages: dryPipeline.result.languages.length,
    certifications: dryPipeline.result.certifications.length,
    warnings: dryPipeline.result.warnings,
    visualHintHits: visualHits,
    result: dryPipeline.result,
    geminiDurationMs: dryPipeline.geminiDurationMs,
    preflightOk:
      countExtractedSkills(dryPipeline.result) > 0 &&
      prepared.pdfSha256 === dryPipeline.pdfSha256 &&
      prepared.driveFileId === dryPipeline.driveFileId,
  };
  writeJson(resolve(ROOT, 'dry-run', `${document}.json`), dryRunPayload);

  if (!dryRunPayload.preflightOk) {
    return {
      document,
      result: 'ABORTED',
      reason: 'PREFLIGHT_FAILED',
      dryRun: dryRunPayload,
    };
  }

  if (dryRunOnly || !confirmPersist) {
    return {
      document,
      result: 'DRY_RUN_ONLY',
      contentClass,
      dryRunSkills: dryRunPayload.skillsCount,
      visualHintHits: visualHits.length,
      previousExtractionId: activeExt.id,
    };
  }

  // --- persist extraction ---
  const existing = await persistence.findExistingSucceededExtraction({
    personId: Number(personId),
    pdfSha256: prepared.pdfSha256,
    model,
    promptVersion,
    extractorVersion,
  });
  if (existing) {
    return {
      document,
      result: 'ABORTED',
      reason: 'IDEMPOTENCY_HIT_UNEXPECTED',
      existingId: existing.id,
    };
  }

    console.log(`${TAG} ${document}: createRunningExtraction…`);
  const runningExt = await persistence.createRunningExtraction({
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

  let newExtractionId = String(runningExt.id);
  try {
    // Reutiliza el resultado del preflight (sin segunda llamada a Gemini).
    const completed = await persistence.completeExtraction(
      runningExt.id,
      dryPipeline.result,
      { durationMs: dryPipeline.geminiDurationMs },
    );
    newExtractionId = String(completed.id);
    console.log(
      `${TAG} ${document}: extraction SUCCEEDED id=${newExtractionId} skills=${completed.skills_count}`,
    );

    // enrich
    console.log(`${TAG} ${document}: enrichment…`);
    const runInput = await buildRunInputFromDatabase(
      ds,
      newExtractionId,
      document,
    );
    const enrichRunner = app
      .select(CvSkillsEnrichmentModule)
      .get(CvSkillsEnrichmentPersistRunnerService);
    const enrichOut = await enrichRunner.runPersist({
      pdfBuffer: prepared.pdfBuffer,
      input: {
        ...runInput,
        extractionId: newExtractionId,
        personId: prepared.personId,
        personCvId: String(prepared.personCvId),
        pdfSha256: runInput.pdfSha256,
      },
      model,
      blockConfig: { blockSize: 12, maxBlockAttempts: 2 },
      activate: true,
    });
    const enrichmentId = String(enrichOut.outcome.enrichmentId);
    console.log(`${TAG} ${document}: enrichment id=${enrichmentId}`);

    // evidence
    console.log(`${TAG} ${document}: evidence…`);
    const evidencePersistence = app
      .select(CvEvidenceModule)
      .get(CvEvidencePersistenceService);
    const evidenceOut = await evidencePersistence.runPersist({
      enrichmentId,
      activate: true,
      config: getEvidenceEngineConfig('er2'),
    });
    const evidenceId = String(evidenceOut.evaluationId ?? '');
    console.log(`${TAG} ${document}: evidence id=${evidenceId || '(see outcome)'}`);

    // PA2 Visual (+ Evaluation Set vía persistencia PA2 vigente cuando aplica)
    console.log(`${TAG} ${document}: PA2 VISUAL_DESIGN…`);
    const pa2 = app.select(McCatalogModule).get(McPa2Service);
    const pa2Dry = await pa2.evaluateProfileDomain({
      extractionId: newExtractionId,
      domainCode: 'VISUAL_DESIGN',
      persist: false,
    });
    const qualification = classifyDomainConceptually(pa2Dry.result, 'MEDIUM');
    const pa2Out = await pa2.evaluateProfileDomain({
      extractionId: newExtractionId,
      domainCode: 'VISUAL_DESIGN',
      persist: true,
      domainQualification: qualification,
    });

    const after = await captureBaseline(ds, document, personId);
    writeJson(resolve(ROOT, 'after', `${document}.json`), {
      ...after,
      pilot: {
        previousExtractionId: activeExt.id,
        newExtractionId,
        enrichmentId,
        evidenceOutcome: evidenceOut,
        pa2: {
          evaluationId: pa2Out.evaluationId,
          outcome: pa2Out.outcome,
          qualification,
          activeCount: pa2Out.result.activeCount,
          emergentCount: pa2Out.result.emergentCount,
          hiddenCount: pa2Out.result.hiddenCount,
          specialties: pa2Out.result.specialtyResults.map((s) => ({
            code: s.specialtyCode,
            status: s.presentationStatus,
            strength: s.strength,
            coverage: s.coverage,
          })),
        },
        contentClass,
        sha256: prepared.pdfSha256,
        driveFileId: prepared.driveFileId,
      },
    });

    // verify single active
    const actives = await ds.query(
      `SELECT id::text, status, is_active, drive_file_id, pdf_sha256
         FROM organigrama.cv_extraction
        WHERE person_id = $1 AND is_active = TRUE`,
      [personId],
    );

    return {
      document,
      result: 'COMPLETED',
      previousExtractionId: activeExt.id,
      newExtractionId,
      enrichmentId,
      evidenceId: evidenceId || null,
      evaluationId: pa2Out.evaluationId,
      qualification,
      activeCount: pa2Out.result.activeCount,
      emergentCount: pa2Out.result.emergentCount,
      skillsBefore: before.activeExtraction
        ? (before.activeExtraction as { skills_count?: number }).skills_count
        : null,
      skillsAfter: (after.activeExtraction as { skills_count?: number } | null)
        ?.skills_count,
      driveFileIdBefore: activeExt.drive_file_id,
      driveFileIdAfter: prepared.driveFileId,
      shaBefore: activeExt.pdf_sha256,
      shaAfter: prepared.pdfSha256,
      activeExtractions: actives,
      integrityOk:
        actives.length === 1 &&
        actives[0].id === newExtractionId &&
        actives[0].status === 'SUCCEEDED' &&
        actives[0].drive_file_id === prepared.driveFileId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${TAG} ${document}: FAIL ${message}`);
    try {
      const rows = await ds.query(
        `SELECT status, is_active FROM organigrama.cv_extraction WHERE id = $1`,
        [newExtractionId],
      );
      const st = rows[0] as { status: string; is_active: boolean } | undefined;
      if (st && (st.status === 'RUNNING' || st.status === 'PENDING')) {
        await persistence.failExtraction(newExtractionId, {
          errorStage: 'PILOT_REEXTRACT',
          errorMessage: message.slice(0, 2000),
        });
      } else if (st?.is_active) {
        await rollbackToPreviousExtraction(
          persistence,
          ds,
          String(activeExt.id),
          newExtractionId,
        );
        console.log(
          `${TAG} ${document}: rollback → previous extraction ${activeExt.id}`,
        );
      }
    } catch (rb) {
      console.error(`${TAG} recovery/rollback failed`, rb);
    }
    return {
      document,
      result: 'FAILED_ROLLED_BACK',
      error: message,
      previousExtractionId: activeExt.id,
      newExtractionId,
    };
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dryRunOnly && !args.confirmPersist) {
    throw new Error(
      'Requiere --dry-run-only o --i-confirm-persist. Ejemplo: --i-confirm-persist',
    );
  }

  mkdirSync(resolve(ROOT, 'before'), { recursive: true });
  mkdirSync(resolve(ROOT, 'dry-run'), { recursive: true });
  mkdirSync(resolve(ROOT, 'after'), { recursive: true });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const results: Record<string, unknown>[] = [];
  let appliedMigration022 = false;
  try {
    if (args.confirmPersist) {
      const ds = app.get(DataSource);
      appliedMigration022 = await ensureDomainQualificationColumn(ds);
    }
    for (const document of args.documents) {
      console.log(`\n${TAG} === ${document} ===`);
      const r = await processDocument({
        document,
        dryRunOnly: args.dryRunOnly,
        confirmPersist: args.confirmPersist,
        app,
      });
      results.push(r);
      console.log(`${TAG} result=${r.result}`);
    }
  } finally {
    await app.close();
  }

  writeJson(resolve(ROOT, 'pilot-summary.json'), {
    generatedAt: new Date().toISOString(),
    dryRunOnly: args.dryRunOnly,
    appliedMigration022,
    results,
  });
  console.log(`\n${TAG} summary=${resolve(ROOT, 'pilot-summary.json')}`);
}

main().catch((err) => {
  console.error(TAG, err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
