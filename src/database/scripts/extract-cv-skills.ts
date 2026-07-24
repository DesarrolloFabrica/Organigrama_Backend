/**
 * Script: npm run extract:cv-skills -- --document=<cedula> [--persist]
 *
 * Sin --persist: persona → person_cv → PDF → Gemini → tmp/cv-skills/<cedula>.json
 * Con --persist: además persiste vía CvSkillsPersistenceService (idempotente).
 *
 * Qué NO hace:
 *  - NO procesa más de una persona.
 *  - NO crea endpoints ni toca frontend.
 *  - NO hace deploy / Cloud Run.
 */

import * as dotenv from 'dotenv';
dotenv.config();

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
import {
  countExtractedSkills,
  ExtractPipelineError,
  extractSkillsFromPrepared,
  prepareCvPdfForExtraction,
  runExtractCvSkillsPipeline,
} from './utils/extract-cv-skills-pipeline';

const TAG = '[CV Skills]';

type Outcome =
  | 'EXTRACTED_AND_PERSISTED'
  | 'ALREADY_PROCESSED'
  | 'EXTRACTED_JSON_ONLY'
  | 'FAILED';

function parseArgs(argv: string[]): { document: string; persist: boolean } {
  let document: string | undefined;
  let persist = false;
  let documentCount = 0;

  for (const arg of argv) {
    if (arg.startsWith('--document=')) {
      documentCount += 1;
      document = arg.slice('--document='.length).trim();
    } else if (arg === '--document') {
      throw new Error(
        'Usa el formato --document=<cedula> (un solo valor, sin espacios).',
      );
    } else if (arg === '--persist') {
      persist = true;
    } else if (arg.startsWith('--persist=')) {
      const v = arg.slice('--persist='.length).trim().toLowerCase();
      persist = v === 'true' || v === '1' || v === 'yes';
    }
  }

  if (documentCount === 0 || !document) {
    throw new Error(
      'Falta --document=<cedula>. Ejemplo: npm run extract:cv-skills -- --document=1000019945 --persist',
    );
  }
  if (documentCount > 1) {
    throw new Error(
      `Se recibieron ${documentCount} valores --document; solo se permite uno.`,
    );
  }
  if (!/^\d+$/.test(document)) {
    throw new Error(
      `Documento inválido "${document}": se esperan solo dígitos (cédula).`,
    );
  }

  return { document, persist };
}

function printOutcome(outcome: Outcome, details?: string): void {
  console.log('');
  console.log(`OUTCOME: ${outcome}`);
  if (details) console.log(details);
  console.log('');
}

async function main(): Promise<void> {
  const { document, persist } = parseArgs(process.argv.slice(2));

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'Falta GEMINI_API_KEY en el entorno (.env). No se llamará a Gemini.',
    );
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const promptVersion = CV_SKILLS_PROMPT_VERSION;
  const extractorVersion = CV_SKILLS_EXTRACTOR_VERSION;

  console.log('');
  console.log(`${TAG} Prueba individual${persist ? ' + persistencia' : ''}`);
  console.log(`Documento: ${document}`);
  console.log(`Persist: ${persist ? 'yes' : 'no'}`);
  console.log(`Modelo: ${model}`);
  console.log(`Prompt: ${promptVersion} | Extractor: ${extractorVersion}`);
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);
    const extraction = app.get(CvSkillsExtractionService);
    const persistence = app.get(CvSkillsPersistenceService);
    const config = app.get(ConfigService);

    if (!config.get<string>('GEMINI_API_KEY')?.trim()) {
      throw new Error(
        'Falta GEMINI_API_KEY en ConfigService. No se llamará a Gemini.',
      );
    }

    if (!persist) {
      const pipeline = await runExtractCvSkillsPipeline({
        document,
        dataSource: ds,
        extractionService: extraction,
      });

      const outDir = resolve('tmp', 'cv-skills');
      const outPath = resolve(outDir, `${document}.json`);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        outPath,
        `${JSON.stringify(
          {
            document: pipeline.document,
            personId: pipeline.personId,
            personName: pipeline.personName,
            personCvId: pipeline.personCvId,
            sourceFileName: pipeline.driveFileName,
            driveFileId: pipeline.driveFileId,
            pdfSha256: pipeline.pdfSha256,
            pdfByteSize: pipeline.pdfByteSize,
            extractedAt: new Date().toISOString(),
            model,
            promptVersion,
            extractorVersion,
            result: pipeline.result,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );

      console.log(`Persona: ${pipeline.personId} - ${pipeline.personName}`);
      console.log(`Skills: ${countExtractedSkills(pipeline.result)}`);
      console.log(`JSON: ${outPath}`);
      printOutcome('EXTRACTED_JSON_ONLY', outPath);
      return;
    }

    // ----- --persist -----
    const prepared = await prepareCvPdfForExtraction({
      document,
      dataSource: ds,
    });

    console.log(`Persona: ${prepared.personId} - ${prepared.personName}`);
    console.log(`person_cv_id: ${prepared.personCvId}`);
    console.log(`Archivo: ${prepared.driveFileName}`);
    console.log(`PDF: ${prepared.pdfByteSize} bytes`);
    console.log(`SHA-256: ${prepared.pdfSha256}`);
    console.log('');

    const existing = await persistence.findExistingSucceededExtraction({
      personId: prepared.personId,
      pdfSha256: prepared.pdfSha256,
      model,
      promptVersion,
      extractorVersion,
    });

    if (existing) {
      console.log(
        `${TAG} Idempotencia: ya existe SUCCEEDED id=${existing.id} (sin Gemini).`,
      );
      printOutcome(
        'ALREADY_PROCESSED',
        `extractionId=${existing.id} skills_count=${existing.skills_count ?? 'n/a'}`,
      );
      return;
    }

    console.log('Creando extracción RUNNING...');
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
    console.log(`RUNNING id=${running.id}`);
    console.log('Enviando PDF a Gemini...');

    try {
      const extracted = await extractSkillsFromPrepared({
        prepared,
        extractionService: extraction,
      });

      console.log(
        `Gemini OK skills=${countExtractedSkills(extracted.result)} ` +
          `langs=${extracted.result.languages.length} ` +
          `certs=${extracted.result.certifications.length} ` +
          `warnings=${extracted.result.warnings.length} ` +
          `ms=${extracted.geminiDurationMs}`,
      );

      const completed = await persistence.completeExtraction(
        running.id,
        extracted.result,
        { durationMs: extracted.geminiDurationMs },
      );

      // También JSON local de auditoría (sin PDF).
      const outDir = resolve('tmp', 'cv-skills');
      const outPath = resolve(outDir, `${document}.json`);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        outPath,
        `${JSON.stringify(
          {
            outcome: 'EXTRACTED_AND_PERSISTED',
            extractionId: completed.id,
            document,
            personId: prepared.personId,
            personName: prepared.personName,
            personCvId: prepared.personCvId,
            driveFileId: prepared.driveFileId,
            driveFileName: prepared.driveFileName,
            pdfSha256: prepared.pdfSha256,
            pdfByteSize: prepared.pdfByteSize,
            model,
            promptVersion,
            extractorVersion,
            skillsCount: completed.skills_count,
            result: extracted.result,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );

      printOutcome(
        'EXTRACTED_AND_PERSISTED',
        `extractionId=${completed.id} skills_count=${completed.skills_count} json=${outPath}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stage =
        error instanceof ExtractPipelineError ? error.stage : 'PERSISTENCE';

      try {
        await persistence.failExtraction(running.id, {
          errorStage: stage,
          errorMessage: message,
        });
      } catch (failError) {
        console.error(
          `${TAG} No se pudo marcar FAILED: ${
            failError instanceof Error ? failError.message : String(failError)
          }`,
        );
      }

      printOutcome('FAILED', `[${stage}] ${message}`);
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('');
  console.error(`${TAG} ERROR: ${message}`);
  printOutcome('FAILED', message);
  process.exitCode = 1;
});
