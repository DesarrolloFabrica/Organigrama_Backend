/**
 * Script: npm run extract:cv-skills:version -- --versionId=4 --dry-run|--persist
 *
 * Fase 4B: dry-run o persist secuencial (solo versionId=4).
 * No deploy / Cloud Run / frontend.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { CvSkillsPersistenceService } from '../../cv-skills/cv-skills-persistence.service';
import { sanitizePersistenceErrorMessage } from '../../cv-skills/cv-skills-persistence.service';
import { CvSkillsExtractionService } from '../../cv-skills/cv-skills-extraction.service';
import { VACANCY_ROLE_NAMES_NORMALIZED } from '../../org-chart/org-chart-vacancy';
import {
  assertDryRunListIntegrity,
  assertPersistUniverseConsistency,
  classifyActiveCvBucket,
  classifyProcessStatus,
  CV_SKILLS_VERSION_DEFAULT_MODEL,
  CV_SKILLS_VERSION_EXTRACTOR,
  CV_SKILLS_VERSION_PROMPT,
  isVacancyCandidate,
  mapPipelineStageToPersistStage,
  maskDocument,
  parseVersionScriptArgs,
  selectPersistTargets,
  type ActiveCvRow,
  type DryRunPersonRef,
  type ExtractionRow,
} from './utils/cv-skills-version-dry-run';
import {
  ExtractPipelineError,
  extractSkillsFromPrepared,
  prepareCvPdfForExtraction,
} from './utils/extract-cv-skills-pipeline';

const TAG_DRY = '[CV Skills Version Dry Run]';
const TAG = '[CV Skills Version]';

type VersionRow = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  is_locked: boolean;
};

type PersonRow = {
  person_id: string;
  document: string;
  full_name: string;
  is_active: boolean;
  role_name: string | null;
};

type CvRow = {
  person_id: string;
  id: string;
  drive_file_id: string | null;
  drive_file_name: string | null;
  mime_type: string | null;
};

type ExtractionDbRow = {
  person_id: string;
  person_cv_id: string;
  status: string;
  is_active: boolean;
  model: string;
  prompt_version: string;
  extractor_version: string;
};

type BatchItem = {
  personId: number;
  documentMasked: string;
  fullName: string;
  personCvId?: number;
  outcome:
    | 'SUCCEEDED'
    | 'ALREADY_PROCESSED'
    | 'FAILED'
    | 'SKIPPED_INVALID_CV';
  extractionId?: string;
  skillsCount?: number;
  durationMs: number;
  errorStage?: string;
  errorMessage?: string;
};

type BatchSummary = {
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  version: { id: number; code: string };
  configuration: {
    model: string;
    promptVersion: string;
    extractorVersion: string;
    delayMs: number;
    limit: number | null;
    retryFailed: boolean;
  };
  counts: {
    target: number;
    attempted: number;
    succeeded: number;
    alreadyProcessed: number;
    failed: number;
    skipped: number;
  };
  items: BatchItem[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function formatEta(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'n/a';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m${rem}s`;
}

function writeBatchSummaryAtomic(path: string, summary: BatchSummary): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
}

async function loadUniverse(ds: DataSource, versionId: number) {
  const versions = await ds.query<VersionRow[]>(
    `SELECT id::text, code, name, is_active, is_locked
       FROM organigrama.org_chart_version
      WHERE id = $1`,
    [versionId],
  );
  if (versions.length === 0) {
    throw new Error(`No existe organigrama.org_chart_version id=${versionId}`);
  }
  const version = versions[0];

  const people = await ds.query<PersonRow[]>(
    `
    WITH version_ids AS (
      SELECT DISTINCT person_id
        FROM (
          SELECT parent_person_id AS person_id
            FROM organigrama.org_visual_relation
           WHERE version_id = $1 AND is_active = TRUE
          UNION
          SELECT child_person_id AS person_id
            FROM organigrama.org_visual_relation
           WHERE version_id = $1 AND is_active = TRUE
        ) u
       WHERE person_id IS NOT NULL
    )
    SELECT
      p.id::text AS person_id,
      p.document,
      p.full_name,
      p.is_active,
      ro.name AS role_name
    FROM version_ids v
    JOIN core.person p ON p.id = v.person_id
    LEFT JOIN organigrama.org_chart_person_override o
      ON o.person_id = p.id AND o.version_id = $1
    LEFT JOIN core.role ro
      ON ro.id = COALESCE(o.role_id_override, p.role_id)
    WHERE p.is_active = TRUE
    ORDER BY p.id
    `,
    [versionId],
  );

  const vacancies = people.filter((p) =>
    isVacancyCandidate({
      document: p.document,
      fullName: p.full_name,
      roleName: p.role_name,
      vacancyRoleNames: VACANCY_ROLE_NAMES_NORMALIZED,
    }),
  );
  const realPeople = people.filter(
    (p) =>
      !isVacancyCandidate({
        document: p.document,
        fullName: p.full_name,
        roleName: p.role_name,
        vacancyRoleNames: VACANCY_ROLE_NAMES_NORMALIZED,
      }),
  );

  const realIds = realPeople.map((p) => Number(p.person_id));
  const cvs =
    realIds.length === 0
      ? []
      : await ds.query<CvRow[]>(
          `
          SELECT person_id::text, id::text, drive_file_id, drive_file_name, mime_type
            FROM organigrama.person_cv
           WHERE is_active = TRUE
             AND person_id = ANY($1::bigint[])
          `,
          [realIds],
        );

  const cvsByPerson = new Map<string, ActiveCvRow[]>();
  for (const row of cvs) {
    const list = cvsByPerson.get(row.person_id) ?? [];
    list.push({
      personCvId: Number(row.id),
      driveFileName: (row.drive_file_name ?? '').trim() || '(sin nombre)',
      hasDriveFileId: Boolean(row.drive_file_id?.trim()),
      mimeType: row.mime_type,
    });
    cvsByPerson.set(row.person_id, list);
  }

  const extractions =
    realIds.length === 0
      ? []
      : await ds.query<ExtractionDbRow[]>(
          `
          SELECT person_id::text, person_cv_id::text, status, is_active,
                 model, prompt_version, extractor_version
            FROM organigrama.cv_extraction
           WHERE person_id = ANY($1::bigint[])
          `,
          [realIds],
        );

  const extractionsByPerson = new Map<string, ExtractionRow[]>();
  for (const row of extractions) {
    const list = extractionsByPerson.get(row.person_id) ?? [];
    list.push({
      personCvId: Number(row.person_cv_id),
      status: row.status,
      isActive: row.is_active,
      model: row.model,
      promptVersion: row.prompt_version,
      extractorVersion: row.extractor_version,
    });
    extractionsByPerson.set(row.person_id, list);
  }

  const model = CV_SKILLS_VERSION_DEFAULT_MODEL;
  const promptVersion = CV_SKILLS_VERSION_PROMPT;
  const extractorVersion = CV_SKILLS_VERSION_EXTRACTOR;

  const alreadyProcessed: DryRunPersonRef[] = [];
  const failedPreviously: DryRunPersonRef[] = [];
  const pending: DryRunPersonRef[] = [];
  const withoutCv: DryRunPersonRef[] = [];
  const invalidCv: DryRunPersonRef[] = [];

  let withProcessableCv = 0;
  let withoutActiveCv = 0;
  let invalidActiveCv = 0;

  for (const person of realPeople) {
    const pid = person.person_id;
    const personId = Number(pid);
    const activeCvs = cvsByPerson.get(pid) ?? [];
    const cvClass = classifyActiveCvBucket(activeCvs);
    const processableCv = cvClass.processableCv;

    if (cvClass.bucket === 'HAS_ACTIVE_CV') withProcessableCv += 1;
    else if (cvClass.bucket === 'NO_ACTIVE_CV') withoutActiveCv += 1;
    else invalidActiveCv += 1;

    const classification = classifyProcessStatus({
      bucket: cvClass.bucket,
      personCvId: processableCv?.personCvId,
      extractions: extractionsByPerson.get(pid) ?? [],
      model,
      promptVersion,
      extractorVersion,
    });

    const ref: DryRunPersonRef = {
      personId,
      document: person.document,
      fullName: person.full_name,
      personCvId: processableCv?.personCvId,
      driveFileName: processableCv?.driveFileName,
      classification,
      reason: cvClass.reason,
    };

    switch (classification) {
      case 'ALREADY_PROCESSED':
        alreadyProcessed.push(ref);
        break;
      case 'FAILED_PREVIOUSLY':
        failedPreviously.push(ref);
        break;
      case 'PENDING_PROCESSING':
        pending.push(ref);
        break;
      case 'NO_CV':
        withoutCv.push(ref);
        break;
      case 'INVALID_CV':
        invalidCv.push(ref);
        break;
    }
  }

  assertDryRunListIntegrity({
    alreadyProcessed,
    failedPreviously,
    pending,
    withoutCv,
    invalidCv,
    processableCvCount: withProcessableCv,
    realActivePeopleCount: realPeople.length,
  });

  return {
    version,
    peopleCount: people.length,
    vacanciesExcluded: vacancies.length,
    realPeopleCount: realPeople.length,
    withProcessableCv,
    withoutActiveCv,
    invalidActiveCv,
    alreadyProcessed,
    failedPreviously,
    pending,
    withoutCv,
    invalidCv,
    model,
    promptVersion,
    extractorVersion,
  };
}

async function runDryRun(
  universe: Awaited<ReturnType<typeof loadUniverse>>,
  versionId: number,
): Promise<void> {
  const {
    version,
    peopleCount,
    vacanciesExcluded,
    realPeopleCount,
    withProcessableCv,
    withoutActiveCv,
    invalidActiveCv,
    alreadyProcessed,
    failedPreviously,
    pending,
    withoutCv,
    invalidCv,
    model,
    promptVersion,
    extractorVersion,
  } = universe;

  const wouldCallGemini = pending.length + failedPreviously.length;
  const wouldSkip =
    alreadyProcessed.length + withoutCv.length + invalidCv.length;

  console.log(`Version ID: ${version.id}`);
  console.log(`Version code: ${version.code}`);
  console.log(`Version active: ${version.is_active}`);
  console.log(`Version locked: ${version.is_locked}`);
  console.log('');
  console.log(`Unique people in version (active in core): ${peopleCount}`);
  console.log(`Active real people: ${realPeopleCount}`);
  console.log(`Vacancies excluded: ${vacanciesExcluded}`);
  console.log('');
  console.log(`With active processable CV: ${withProcessableCv}`);
  console.log(`Without active CV: ${withoutActiveCv}`);
  console.log(`Invalid active CV: ${invalidActiveCv}`);
  console.log('');
  console.log(`Already processed: ${alreadyProcessed.length}`);
  console.log(`Failed previously: ${failedPreviously.length}`);
  console.log(`Pending processing: ${pending.length}`);
  console.log('');
  console.log(`Would call Gemini: ${wouldCallGemini}`);
  console.log(`Would skip: ${wouldSkip}`);

  const outDir = resolve('tmp', `cv-skills-version-${versionId}`);
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'dry-run-summary.json');
  writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        phase: '4A-dry-run',
        model,
        promptVersion,
        extractorVersion,
        version: {
          id: Number(version.id),
          code: version.code,
          name: version.name,
          isActive: version.is_active,
          isLocked: version.is_locked,
        },
        counts: {
          uniquePeopleInVersion: peopleCount,
          activeRealPeople: realPeopleCount,
          vacanciesExcluded,
          withActiveProcessableCv: withProcessableCv,
          withoutActiveCv: withoutActiveCv,
          invalidActiveCv: invalidActiveCv,
          alreadyProcessed: alreadyProcessed.length,
          failedPreviously: failedPreviously.length,
          pendingProcessing: pending.length,
          wouldCallGemini,
          wouldSkip,
        },
        alreadyProcessed,
        pending,
        failedPreviously,
        withoutCv,
        invalidCv,
        confirmations: {
          noPdfDownload: true,
          noGeminiCalls: true,
          noCloudWrites: true,
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log('');
  console.log(`Summary file: ${outPath}`);
}

async function runPersist(params: {
  ds: DataSource;
  extraction: CvSkillsExtractionService;
  persistence: CvSkillsPersistenceService;
  universe: Awaited<ReturnType<typeof loadUniverse>>;
  versionId: number;
  delayMs: number;
  limit: number | null;
  retryFailed: boolean;
}): Promise<void> {
  const {
    ds: _ds,
    extraction,
    persistence,
    universe,
    versionId,
    delayMs,
    limit,
    retryFailed,
  } = params;

  assertPersistUniverseConsistency({
    versionCode: universe.version.code,
    versionActive: universe.version.is_active,
    alreadyProcessed: universe.alreadyProcessed,
    pending: universe.pending,
    failedPreviously: universe.failedPreviously,
    invalidCv: universe.invalidCv,
    withProcessableCv: universe.withProcessableCv,
  });

  const targets = selectPersistTargets({
    pending: universe.pending,
    failedPreviously: universe.failedPreviously,
    retryFailed,
    limit,
  });

  console.log(
    `${TAG} Persist targets=${targets.length} ` +
      `(pending=${universe.pending.length} failed=${universe.failedPreviously.length} ` +
      `limit=${limit ?? 'none'} delayMs=${delayMs})`,
  );
  console.log(
    `${TAG} Ingrid omitida (ALREADY_PROCESSED). model=${universe.model} ` +
      `prompt=${universe.promptVersion} extractor=${universe.extractorVersion}`,
  );
  console.log('');

  const outDir = resolve('tmp', `cv-skills-version-${versionId}`);
  mkdirSync(outDir, { recursive: true });
  const summaryPath = resolve(outDir, 'batch-summary.json');

  const startedAt = new Date().toISOString();
  const batchStartedMs = Date.now();
  const summary: BatchSummary = {
    startedAt,
    updatedAt: startedAt,
    finishedAt: null,
    version: {
      id: Number(universe.version.id),
      code: universe.version.code,
    },
    configuration: {
      model: universe.model,
      promptVersion: universe.promptVersion,
      extractorVersion: universe.extractorVersion,
      delayMs,
      limit,
      retryFailed,
    },
    counts: {
      target: targets.length,
      attempted: 0,
      succeeded: 0,
      alreadyProcessed: 0,
      failed: 0,
      skipped: 0,
    },
    items: [],
  };
  writeBatchSummaryAtomic(summaryPath, summary);

  let geminiCalls = 0;

  for (let i = 0; i < targets.length; i++) {
    const person = targets[i];
    const index = i + 1;
    const personStarted = Date.now();
    let outcome: BatchItem['outcome'] = 'FAILED';
    let extractionId: string | undefined;
    let skillsCount: number | undefined;
    let errorStage: string | undefined;
    let errorMessage: string | undefined;
    let runningId: string | undefined;

    try {
      const prepared = await prepareCvPdfForExtraction({
        document: person.document,
        dataSource: params.ds,
      });

      if (prepared.personId !== person.personId) {
        throw new ExtractPipelineError(
          'PERSON_LOOKUP',
          `personId mismatch expected=${person.personId} got=${prepared.personId}`,
        );
      }

      const existing = await persistence.findExistingSucceededExtraction({
        personId: prepared.personId,
        pdfSha256: prepared.pdfSha256,
        model: universe.model,
        promptVersion: universe.promptVersion,
        extractorVersion: universe.extractorVersion,
      });

      if (existing) {
        outcome = 'ALREADY_PROCESSED';
        extractionId = existing.id;
        skillsCount = existing.skills_count ?? undefined;
      } else {
        const running = await persistence.createRunningExtraction({
          personId: prepared.personId,
          personCvId: prepared.personCvId,
          document: prepared.document,
          driveFileId: prepared.driveFileId,
          driveFileName: prepared.driveFileName,
          pdfSha256: prepared.pdfSha256,
          pdfByteSize: prepared.pdfByteSize,
          model: universe.model,
          promptVersion: universe.promptVersion,
          extractorVersion: universe.extractorVersion,
        });
        runningId = running.id;

        geminiCalls += 1;
        const extracted = await extractSkillsFromPrepared({
          prepared,
          extractionService: extraction,
        });

        const completed = await persistence.completeExtraction(
          running.id,
          extracted.result,
          { durationMs: extracted.geminiDurationMs },
        );
        outcome = 'SUCCEEDED';
        extractionId = completed.id;
        skillsCount = completed.skills_count ?? undefined;
      }
    } catch (error) {
      outcome = 'FAILED';
      errorStage = mapPipelineStageToPersistStage(
        error instanceof ExtractPipelineError ? error.stage : 'PERSISTENCE',
      );
      errorMessage = sanitizePersistenceErrorMessage(error);

      if (runningId) {
        try {
          await persistence.failExtraction(runningId, {
            errorStage,
            errorMessage,
          });
        } catch {
          // no abortar el lote
        }
      }
      // Fallos pre-RUNNING: solo en reporte local (etapa no persistible completa).
    }

    const durationMs = Date.now() - personStarted;
    summary.counts.attempted += 1;
    if (outcome === 'SUCCEEDED') summary.counts.succeeded += 1;
    else if (outcome === 'ALREADY_PROCESSED')
      summary.counts.alreadyProcessed += 1;
    else if (outcome === 'FAILED') summary.counts.failed += 1;
    else summary.counts.skipped += 1;

    summary.items.push({
      personId: person.personId,
      documentMasked: maskDocument(person.document),
      fullName: person.fullName,
      personCvId: person.personCvId,
      outcome,
      extractionId,
      skillsCount,
      durationMs,
      errorStage,
      errorMessage,
    });
    summary.updatedAt = new Date().toISOString();
    writeBatchSummaryAtomic(summaryPath, summary);

    const elapsed = Date.now() - batchStartedMs;
    const avg = elapsed / summary.counts.attempted;
    const remaining = (targets.length - summary.counts.attempted) * avg;

    console.log(
      `[${index}/${targets.length}] personId=${person.personId} ` +
        `document=${maskDocument(person.document)} outcome=${outcome} ` +
        `skills=${skillsCount ?? '-'} durationMs=${durationMs} ` +
        `elapsed=${formatEta(elapsed)} avg=${Math.round(avg)}ms eta=${formatEta(remaining)}` +
        (errorStage ? ` stage=${errorStage}` : ''),
    );

    if (i < targets.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  summary.finishedAt = new Date().toISOString();
  summary.updatedAt = summary.finishedAt;
  writeBatchSummaryAtomic(summaryPath, summary);

  console.log('');
  console.log(`${TAG} DONE target=${summary.counts.target}`);
  console.log(`  attempted=${summary.counts.attempted}`);
  console.log(`  succeeded=${summary.counts.succeeded}`);
  console.log(`  alreadyProcessed=${summary.counts.alreadyProcessed}`);
  console.log(`  failed=${summary.counts.failed}`);
  console.log(`  skipped=${summary.counts.skipped}`);
  console.log(`  geminiCalls=${geminiCalls}`);
  console.log(`  durationMs=${Date.now() - batchStartedMs}`);
  console.log(`  report=${summaryPath}`);
}

async function main(): Promise<void> {
  const args = parseVersionScriptArgs(process.argv.slice(2));
  const tag = args.dryRun ? TAG_DRY : TAG;

  console.log('');
  console.log(tag);
  console.log(
    `versionId=${args.versionId} mode=${args.dryRun ? 'dry-run' : 'persist'}`,
  );
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);
    const universe = await loadUniverse(ds, args.versionId);

    if (args.dryRun) {
      await runDryRun(universe, args.versionId);
      console.log(
        `${TAG_DRY} Confirmación: sin descarga PDF, sin Gemini, sin escrituras Cloud.`,
      );
      return;
    }

    const extraction = app.get(CvSkillsExtractionService);
    const persistence = app.get(CvSkillsPersistenceService);
    await runPersist({
      ds,
      extraction,
      persistence,
      universe,
      versionId: args.versionId,
      delayMs: args.delayMs,
      limit: args.limit,
      retryFailed: args.retryFailed,
    });
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('');
  console.error(`${TAG} ERROR: ${message}`);
  process.exitCode = 1;
});
