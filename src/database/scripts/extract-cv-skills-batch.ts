/**
 * Script: npm run extract:cv-skills:batch -- --documents=d1,d2,...
 *
 * Validación por lote (secuencial) de extracción de skills.
 * Reutiliza downloadCvPdfBuffer + CvSkillsExtractionService vía pipeline compartido.
 *
 * Qué NO hace:
 *  - NO escribe en BD / person_cv / core.person.
 *  - NO ejecuta migración 011.
 *  - NO procesa en paralelo.
 *  - NO llama a Gemini si fallan validaciones previas.
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
import { DEFAULT_GEMINI_MODEL } from '../../cv-skills/cv-skills.types';
import {
  countExtractedSkills,
  ExtractPipelineError,
  runExtractCvSkillsPipeline,
  type ExtractPipelineStage,
} from './utils/extract-cv-skills-pipeline';

const TAG = '[CV Skills:batch]';

type BatchStage = ExtractPipelineStage | 'WRITE_FILE' | 'ARGUMENT_VALIDATION';

type SucceededDocSummary = {
  document: string;
  status: 'SUCCEEDED';
  personId: number;
  personName: string;
  skillsCount: number;
  languagesCount: number;
  certificationsCount: number;
  warningsCount: number;
  durationMs: number;
  outputFile: string;
};

type FailedDocSummary = {
  document: string;
  status: 'FAILED';
  stage: BatchStage;
  error: string;
  durationMs: number;
};

type DocSummary = SucceededDocSummary | FailedDocSummary;

type BatchSummary = {
  startedAt: string;
  finishedAt: string;
  requested: number;
  succeeded: number;
  failed: number;
  totalSkills: number;
  model: string;
  promptVersion: string;
  extractorVersion: string;
  documents: DocSummary[];
};

function parseDocumentsArg(argv: string[]): string[] {
  let raw: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith('--documents=')) {
      raw = arg.slice('--documents='.length).trim();
    } else if (arg === '--documents') {
      throw new Error(
        'Usa --documents=d1,d2,... (lista separada por comas, solo dígitos).',
      );
    }
  }
  if (!raw) {
    throw new Error(
      'Falta --documents=. Ejemplo: npm run extract:cv-skills:batch -- --documents=80723984,1042448655',
    );
  }

  const docs = raw
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

  if (docs.length === 0) {
    throw new Error('La lista --documents está vacía.');
  }

  for (const d of docs) {
    if (!/^\d+$/.test(d)) {
      throw new Error(
        `Documento inválido "${d}": se esperan solo dígitos (cédula).`,
      );
    }
  }

  return docs;
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .slice(0, 500);
}

function pad(value: string | number, width: number): string {
  const s = String(value);
  if (s.length >= width) return s;
  return s + ' '.repeat(width - s.length);
}

async function main(): Promise<void> {
  const documents = parseDocumentsArg(process.argv.slice(2));

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'Falta GEMINI_API_KEY en el entorno (.env). No se iniciará el lote.',
    );
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const promptVersion = CV_SKILLS_PROMPT_VERSION;
  const extractorVersion = CV_SKILLS_EXTRACTOR_VERSION;
  const outDir = resolve('tmp', 'cv-skills-validation');
  mkdirSync(outDir, { recursive: true });

  const batchStartedAt = new Date();
  const batchStartedMs = Date.now();

  console.log('');
  console.log(`${TAG} Validación por lote (secuencial)`);
  console.log(`${TAG} Documentos: ${documents.join(', ')}`);
  console.log(`${TAG} Modelo: ${model}`);
  console.log(`${TAG} Prompt: ${promptVersion} | Extractor: ${extractorVersion}`);
  console.log(`${TAG} Salida: ${outDir}`);
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const summaries: DocSummary[] = [];

  try {
    const ds = app.get(DataSource);
    const extraction = app.get(CvSkillsExtractionService);
    const config = app.get(ConfigService);

    if (!config.get<string>('GEMINI_API_KEY')?.trim()) {
      throw new Error('Falta GEMINI_API_KEY en ConfigService.');
    }

    for (const document of documents) {
      const docStartedMs = Date.now();
      const startedAtIso = new Date().toISOString();
      console.log(`${TAG} ── Documento ${document} ──`);

      try {
        const pipeline = await runExtractCvSkillsPipeline({
          document,
          dataSource: ds,
          extractionService: extraction,
        });

        const skillsCount = countExtractedSkills(pipeline.result);
        const outputRelative = `tmp/cv-skills-validation/${document}.json`;
        const outputAbsolute = resolve(outDir, `${document}.json`);

        const finishedAtIso = new Date().toISOString();
        const durationMs = Date.now() - docStartedMs;

        const outputPayload = {
          document: pipeline.document,
          personId: pipeline.personId,
          personName: pipeline.personName,
          personCvId: pipeline.personCvId,
          driveFileId: pipeline.driveFileId,
          driveFileName: pipeline.driveFileName,
          pdfByteSize: pipeline.pdfByteSize,
          model,
          promptVersion,
          extractorVersion,
          startedAt: startedAtIso,
          finishedAt: finishedAtIso,
          durationMs,
          geminiDurationMs: pipeline.geminiDurationMs,
          result: pipeline.result,
        };

        try {
          writeFileSync(
            outputAbsolute,
            `${JSON.stringify(outputPayload, null, 2)}\n`,
            'utf8',
          );
        } catch (error) {
          summaries.push({
            document,
            status: 'FAILED',
            stage: 'WRITE_FILE',
            error: safeErrorMessage(error),
            durationMs: Date.now() - docStartedMs,
          });
          console.error(
            `${TAG} FAILED [WRITE_FILE] document=${document}: ${safeErrorMessage(error)}`,
          );
          console.log('');
          continue;
        }

        summaries.push({
          document,
          status: 'SUCCEEDED',
          personId: pipeline.personId,
          personName: pipeline.personName,
          skillsCount,
          languagesCount: pipeline.result.languages.length,
          certificationsCount: pipeline.result.certifications.length,
          warningsCount: pipeline.result.warnings.length,
          durationMs,
          outputFile: outputRelative,
        });

        console.log(
          `${TAG} OK person=${pipeline.personId} skills=${skillsCount} ` +
            `langs=${pipeline.result.languages.length} ` +
            `certs=${pipeline.result.certifications.length} ` +
            `warnings=${pipeline.result.warnings.length} ` +
            `ms=${durationMs}`,
        );
      } catch (error) {
        const durationMs = Date.now() - docStartedMs;
        const stage: BatchStage =
          error instanceof ExtractPipelineError ? error.stage : 'GEMINI';
        const message = safeErrorMessage(error);

        summaries.push({
          document,
          status: 'FAILED',
          stage,
          error: message,
          durationMs,
        });

        console.error(
          `${TAG} FAILED [${stage}] document=${document}: ${message}`,
        );
      }

      console.log('');
    }
  } finally {
    await app.close();
  }

  const batchFinishedAt = new Date();
  const succeeded = summaries.filter((s) => s.status === 'SUCCEEDED');
  const failed = summaries.filter((s) => s.status === 'FAILED');
  const totalSkills = succeeded.reduce(
    (sum, s) => sum + (s.status === 'SUCCEEDED' ? s.skillsCount : 0),
    0,
  );

  const summary: BatchSummary = {
    startedAt: batchStartedAt.toISOString(),
    finishedAt: batchFinishedAt.toISOString(),
    requested: documents.length,
    succeeded: succeeded.length,
    failed: failed.length,
    totalSkills,
    model,
    promptVersion,
    extractorVersion,
    documents: summaries,
  };

  const summaryPath = resolve(outDir, 'summary.json');
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`${TAG} Resumen`);
  console.log(
    `${pad('Documento', 12)} ${pad('Persona', 28)} ${pad('Estado', 10)} ` +
      `${pad('Skills', 8)} ${pad('Idiomas', 8)} ${pad('Certs', 6)} ` +
      `${pad('Warn', 6)} ${pad('Tiempo', 10)}`,
  );
  console.log('-'.repeat(100));

  for (const row of summaries) {
    if (row.status === 'SUCCEEDED') {
      const persona = `${row.personId}`.slice(0, 6);
      console.log(
        `${pad(row.document, 12)} ${pad(persona + ' ' + row.personName.slice(0, 18), 28)} ` +
          `${pad(row.status, 10)} ${pad(row.skillsCount, 8)} ` +
          `${pad(row.languagesCount, 8)} ${pad(row.certificationsCount, 6)} ` +
          `${pad(row.warningsCount, 6)} ${pad(row.durationMs + 'ms', 10)}`,
      );
    } else {
      console.log(
        `${pad(row.document, 12)} ${pad('-', 28)} ${pad(row.status, 10)} ` +
          `${pad('-', 8)} ${pad('-', 8)} ${pad('-', 6)} ${pad('-', 6)} ` +
          `${pad(row.durationMs + 'ms', 10)}  [${row.stage}] ${row.error.slice(0, 60)}`,
      );
    }
  }

  console.log('');
  console.log(`Solicitados: ${summary.requested}`);
  console.log(`Exitosos: ${summary.succeeded}`);
  console.log(`Fallidos: ${summary.failed}`);
  console.log(`Total skills: ${summary.totalSkills}`);
  console.log(`Duración total: ${Date.now() - batchStartedMs} ms`);
  console.log(`Carpeta de resultados: ${outDir}`);
  console.log(`Summary: ${summaryPath}`);
  console.log('');
  console.log(
    `${TAG} Confirmación: no se escribió nada en la base de datos (solo lectura + JSON temporal).`,
  );

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('');
  console.error(`${TAG} ERROR FATAL: ${message}`);
  process.exitCode = 1;
});
