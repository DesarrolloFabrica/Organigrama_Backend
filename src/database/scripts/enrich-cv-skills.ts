/**
 * CLI: npm run enrich:cv-skills -- …
 *
 * Dry-run:
 *   --document=… (--inventoryArtifact=… | --extractionId=…) --dry-run
 *
 * Persistencia:
 *   --extractionId=… --persist --i-confirm-persist [--activate --i-confirm-activate]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { CvSkillsEnrichmentModule } from '../../cv-skills-enrichment/cv-skills-enrichment.module';
import { CvSkillsEnrichmentOrchestratorService } from '../../cv-skills-enrichment/cv-skills-enrichment-orchestrator.service';
import { CvSkillsEnrichmentPersistRunnerService } from '../../cv-skills-enrichment/cv-skills-enrichment-persist-runner.service';
import {
  assertEnrichMainCli,
  parseEnrichCliArgs,
} from '../../cv-skills-enrichment/cv-skills-enrichment.cli-args';
import {
  buildRunInputFromArtifact,
  buildRunInputFromDatabase,
} from '../../cv-skills-enrichment/cv-skills-enrichment.inventory';
import { prepareCvPdfForExtraction } from './utils/extract-cv-skills-pipeline';

const TAG = '[CV Skills Enricher]';

function artifactFileName(document: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${document}-e1-${stamp}.json`;
}

async function main(): Promise<void> {
  const args = parseEnrichCliArgs(process.argv.slice(2));
  assertEnrichMainCli(args);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ds = app.get(DataSource);

    if (args.persist) {
      const runInput = await buildRunInputFromDatabase(
        ds,
        args.extractionId!,
        args.document,
      );

      if (!runInput.personCvId) {
        throw new Error('Extracción sin person_cv_id; abortado.');
      }
      if (runInput.skills.length === 0) {
        throw new Error('Inventario vacío: abortado antes de Gemini.');
      }

      console.log(`${TAG} PERSIST`);
      console.log(`extractionId: ${runInput.extractionId}`);
      console.log(`document: ${runInput.document}`);
      console.log(`personId: ${runInput.personId}`);
      console.log(`skills: ${runInput.skills.length}`);
      console.log(`pdfSha256: ${runInput.pdfSha256}`);
      console.log(`activate: ${args.activate ? 'yes' : 'no'}`);
      console.log(
        `${TAG} Confirmado --i-confirm-persist. Preparando PDF…`,
      );

      const prepared = await prepareCvPdfForExtraction({
        document: runInput.document,
        dataSource: ds,
      });

      if (prepared.pdfSha256 !== runInput.pdfSha256) {
        console.warn(
          `${TAG} ADVERTENCIA: pdfSha256 vivo (${prepared.pdfSha256}) ≠ extracción (${runInput.pdfSha256}).`,
        );
      }

      const runner = app
        .select(CvSkillsEnrichmentModule)
        .get(CvSkillsEnrichmentPersistRunnerService);

      const { outcome, artifact } = await runner.runPersist({
        pdfBuffer: prepared.pdfBuffer,
        input: {
          ...runInput,
          extractionId: runInput.extractionId!,
          personId: runInput.personId!,
          personCvId: runInput.personCvId,
          pdfSha256: prepared.pdfSha256,
        },
        model: args.model,
        blockConfig: {
          blockSize: args.blockSize,
          maxBlockAttempts: args.maxAttempts,
        },
        activate: args.activate,
      });

      console.log(`${TAG} outcome=${outcome.outcome}`);
      console.log(`${TAG} enrichmentId=${outcome.enrichmentId}`);
      console.log(`${TAG} status=${outcome.status} isActive=${outcome.isActive}`);
      console.log(`${TAG} skippedGemini=${outcome.skippedGemini}`);
      if (artifact) {
        const outDir = resolve(args.outputDir);
        mkdirSync(outDir, { recursive: true });
        const outPath = resolve(
          outDir,
          artifactFileName(runInput.document),
        );
        writeFileSync(outPath, JSON.stringify(artifact, null, 2), 'utf8');
        console.log(
          `${TAG} skills in/out=${artifact.metrics.inputSkills}/${artifact.metrics.outputSkills}`,
        );
        console.log(
          `${TAG} fills=${artifact.metrics.missingFilledEmpty} geminiCalls=${artifact.metrics.geminiCalls}`,
        );
        console.log(`${TAG} artifact=${outPath}`);
      }
      return;
    }

    // dry-run
    const document = args.document;
    console.log(`${TAG} dry-run`);
    if (args.inventoryArtifact) {
      console.log(`Documento: ${document}`);
      console.log(`Inventario ARTIFACT: ${args.inventoryArtifact}`);
    } else {
      console.log(`Inventario DATABASE extractionId: ${args.extractionId}`);
    }

    const runInput = args.extractionId
      ? await buildRunInputFromDatabase(ds, args.extractionId, document)
      : buildRunInputFromArtifact(args.inventoryArtifact!, document);

    if (runInput.skills.length === 0) {
      throw new Error('Inventario vacío: abortado antes de Gemini.');
    }

    console.log(`Documento: ${runInput.document}`);
    console.log(`skills: ${runInput.skills.length}`);

    const prepared = await prepareCvPdfForExtraction({
      document: runInput.document,
      dataSource: ds,
    });

    if (prepared.pdfSha256 !== runInput.pdfSha256) {
      console.warn(
        `${TAG} ADVERTENCIA: pdfSha256 del PDF vivo (${prepared.pdfSha256}) ` +
          `≠ inventario (${runInput.pdfSha256}). Se usa el PDF vivo para Gemini.`,
      );
    }

    const orchestrator = app
      .select(CvSkillsEnrichmentModule)
      .get(CvSkillsEnrichmentOrchestratorService);

    const artifact = await orchestrator.runDry({
      pdfBuffer: prepared.pdfBuffer,
      input: {
        ...runInput,
        pdfSha256: prepared.pdfSha256,
        personId: prepared.personId,
      },
      model: args.model,
      blockConfig: {
        blockSize: args.blockSize,
        maxBlockAttempts: args.maxAttempts,
      },
    });

    const outDir = resolve(args.outputDir);
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, artifactFileName(runInput.document));
    writeFileSync(outPath, JSON.stringify(artifact, null, 2), 'utf8');

    console.log(`${TAG} status=${artifact.meta.status}`);
    console.log(
      `${TAG} skills in/out=${artifact.metrics.inputSkills}/${artifact.metrics.outputSkills}`,
    );
    console.log(
      `${TAG} geminiCalls=${artifact.metrics.geminiCalls} fills=${artifact.metrics.missingFilledEmpty}`,
    );
    console.log(`${TAG} model=${artifact.meta.model}`);
    console.log(`${TAG} artifact=${outPath}`);
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(TAG, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
