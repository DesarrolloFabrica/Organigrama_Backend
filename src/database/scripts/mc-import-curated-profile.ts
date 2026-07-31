/**
 * CLI: importación controlada de un perfil curado (Fase 2).
 *
 * Dry-run (default):
 *   npm run mc:import-curated-profile -- --file=path.json
 *
 * Execute:
 *   npm run mc:import-curated-profile -- --file=path.json --execute --confirm
 */

import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { CvSkillsPersistenceService } from '../../cv-skills/cv-skills-persistence.service';
import { CvSkillsEnrichmentPersistenceService } from '../../cv-skills-enrichment/cv-skills-enrichment-persistence.service';
import { CvEvidencePersistenceService } from '../../cv-evidence/cv-evidence-persistence.service';
import { McPa2Service } from '../../mc-catalog/mc-pa2.service';
import {
  assertImportWriteFlags,
  assertSinglePersonDocument,
  importCuratedProfile,
  parseCuratedImportCliArgs,
} from '../../mc-catalog/curated-profile';

const TAG = '[MC Curated Profile Import]';

async function main(): Promise<void> {
  const args = parseCuratedImportCliArgs(process.argv.slice(2));
  assertImportWriteFlags(args);
  if (!args.file) {
    throw new Error(
      'Requiere --file=ruta.json [--document=] [--out=] [--execute --confirm]',
    );
  }

  const mode = args.execute ? 'EXECUTE' : 'DRY-RUN';
  console.log(`${TAG} mode=${mode}`);

  const filePath = resolve(process.cwd(), args.file);
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  assertSinglePersonDocument(raw);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const report = await importCuratedProfile(
      raw,
      {
        dataSource: app.get(DataSource),
        extractionPersistence: app.get(CvSkillsPersistenceService),
        enrichmentPersistence: app.get(CvSkillsEnrichmentPersistenceService),
        evidencePersistence: app.get(CvEvidencePersistenceService),
        pa2: app.get(McPa2Service),
      },
      {
        documentOverride: args.documentOverride,
        execute: args.execute,
        allowReactivateIdentical: args.allowReactivateIdentical,
        verify: args.verify,
      },
    );

    console.log(`${TAG} outcome=${report.outcome}`);
    console.log(
      `${TAG} person=${report.person.documentMasked} ` +
        `personId=${report.person.personId ?? 'n/a'} ` +
        `cv=${report.person.personCvId ?? 'n/a'}`,
    );
    console.log(
      `${TAG} fingerprint=${report.contentFingerprint ?? 'n/a'} ` +
        `activeExtraction=${report.currentActiveExtractionId ?? 'n/a'}`,
    );
    console.log(
      `${TAG} domain=${report.domain.declared} status=${report.domain.validatedStatus}`,
    );
    console.log(
      `${TAG} skills existing=${report.skills.existing.length} ` +
        `aliases=${report.skills.aliases.length} ` +
        `create=${report.skills.approvedForCreation.length} ` +
        `omit=${report.skills.omitted.length} ` +
        `mappings=${report.skills.mappingsToCreate.length}`,
    );
    if (report.execution) {
      console.log(
        `${TAG} executed extraction=${report.execution.extractionId} ` +
          `enrichment=${report.execution.enrichmentId} ` +
          `evidence=${report.execution.evidenceEvaluationId} ` +
          `pa2=${report.execution.profileEvaluationId} ` +
          `verified=${report.execution.verified}`,
      );
    }
    for (const err of report.errors) {
      console.log(`${TAG} ERROR [${err.code}] ${err.path}: ${err.message}`);
    }
    for (const warn of report.warnings.slice(0, 30)) {
      console.log(`${TAG} WARN  [${warn.code}] ${warn.path}: ${warn.message}`);
    }

    if (args.out) {
      const outPath = resolve(process.cwd(), args.out);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
      console.log(`${TAG} report → ${outPath}`);
    }

    if (
      report.outcome === 'BLOCKED' ||
      report.outcome === 'FAILED' ||
      report.errors.some((e) => e.severity === 'error')
    ) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    `${TAG} FATAL:`,
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
