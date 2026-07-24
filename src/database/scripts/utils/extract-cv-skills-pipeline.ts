/**
 * Núcleo compartido: cédula → person → person_cv → Buffer → (opcional) extractSkills.
 * Usado por extract-cv-skills (individual) y extract-cv-skills-batch.
 * No escribe en BD ni en disco por sí mismo.
 */
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { CvSkillsExtractionService } from '../../../cv-skills/cv-skills-extraction.service';
import type { ExtractedCvSkills } from '../../../cv-skills/cv-skills.types';
import { downloadCvPdfBuffer } from './google-drive-cv-client';

export type ExtractPipelineStage =
  | 'PERSON_LOOKUP'
  | 'CV_LOOKUP'
  | 'DOWNLOAD'
  | 'PDF_VALIDATION'
  | 'GEMINI'
  | 'VALIDATION';

export class ExtractPipelineError extends Error {
  readonly stage: ExtractPipelineStage;

  constructor(stage: ExtractPipelineStage, message: string) {
    super(message);
    this.name = 'ExtractPipelineError';
    this.stage = stage;
  }
}

type CorePersonRow = {
  id: string;
  document: string;
  full_name: string;
};

type PersonCvRow = {
  id: string;
  person_id: string;
  document: string;
  drive_file_id: string | null;
  drive_file_name: string | null;
  mime_type: string | null;
  is_active: boolean;
};

/** PDF listo para Gemini o para chequeo de idempotencia (sha256). */
export type PreparedCvPdf = {
  document: string;
  personId: number;
  personName: string;
  personCvId: number;
  driveFileId: string;
  driveFileName: string;
  pdfByteSize: number;
  pdfSha256: string;
  pdfBuffer: Buffer;
};

export type ExtractPipelineSuccess = {
  document: string;
  personId: number;
  personName: string;
  personCvId: number;
  driveFileId: string;
  driveFileName: string;
  pdfByteSize: number;
  pdfSha256: string;
  result: ExtractedCvSkills;
  geminiDurationMs: number;
};

export function countExtractedSkills(result: ExtractedCvSkills): number {
  return result.categories.reduce((sum, c) => sum + c.skills.length, 0);
}

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Persona + CV activo + descarga + validación PDF + sha256.
 * No llama a Gemini.
 */
export async function prepareCvPdfForExtraction(params: {
  document: string;
  dataSource: DataSource;
}): Promise<PreparedCvPdf> {
  const { document, dataSource } = params;

  let persons: CorePersonRow[];
  try {
    persons = await dataSource.query<CorePersonRow[]>(
      `SELECT id, document, full_name
         FROM core.person
        WHERE document = $1`,
      [document],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ExtractPipelineError('PERSON_LOOKUP', message);
  }

  if (persons.length === 0) {
    throw new ExtractPipelineError(
      'PERSON_LOOKUP',
      `No existe persona en core.person con document="${document}".`,
    );
  }
  if (persons.length > 1) {
    throw new ExtractPipelineError(
      'PERSON_LOOKUP',
      `Hay ${persons.length} personas en core.person con document="${document}"; se esperaba una.`,
    );
  }

  const person = persons[0];
  const personId = Number(person.id);
  if (!Number.isFinite(personId)) {
    throw new ExtractPipelineError(
      'PERSON_LOOKUP',
      `person.id="${person.id}" no es numérico.`,
    );
  }

  let cvs: PersonCvRow[];
  try {
    cvs = await dataSource.query<PersonCvRow[]>(
      `SELECT id, person_id, document, drive_file_id, drive_file_name,
              mime_type, is_active
         FROM organigrama.person_cv
        WHERE person_id = $1 AND is_active = TRUE
        LIMIT 2`,
      [person.id],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ExtractPipelineError('CV_LOOKUP', message);
  }

  if (cvs.length === 0) {
    throw new ExtractPipelineError(
      'CV_LOOKUP',
      `La persona ${personId} (document=${document}) no tiene registro activo en organigrama.person_cv.`,
    );
  }
  if (cvs.length > 1) {
    throw new ExtractPipelineError(
      'CV_LOOKUP',
      `Hay ${cvs.length} registros activos en person_cv para person_id=${personId}; se esperaba uno.`,
    );
  }

  const cv = cvs[0];
  const personCvId = Number(cv.id);
  if (!Number.isFinite(personCvId)) {
    throw new ExtractPipelineError(
      'CV_LOOKUP',
      `person_cv.id="${cv.id}" no es numérico.`,
    );
  }

  const driveFileId = cv.drive_file_id?.trim() ?? '';
  if (!driveFileId) {
    throw new ExtractPipelineError(
      'CV_LOOKUP',
      `person_cv.id=${cv.id} no tiene drive_file_id; no se puede descargar.`,
    );
  }

  const driveFileName = cv.drive_file_name?.trim() ?? '';
  if (!driveFileName) {
    throw new ExtractPipelineError(
      'CV_LOOKUP',
      `person_cv.id=${cv.id} no tiene drive_file_name.`,
    );
  }

  const mime = (cv.mime_type ?? '').trim().toLowerCase();
  if (mime !== 'application/pdf') {
    throw new ExtractPipelineError(
      'PDF_VALIDATION',
      `MIME inesperado "${cv.mime_type ?? '(null)'}"; se requiere application/pdf.`,
    );
  }

  let buffer: Buffer;
  try {
    buffer = await downloadCvPdfBuffer(driveFileId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ExtractPipelineError('DOWNLOAD', message);
  }

  if (buffer.length === 0) {
    throw new ExtractPipelineError(
      'PDF_VALIDATION',
      'El Buffer descargado está vacío.',
    );
  }
  const header = buffer.subarray(0, Math.min(5, buffer.length)).toString('utf8');
  if (!header.startsWith('%PDF')) {
    throw new ExtractPipelineError(
      'PDF_VALIDATION',
      'El Buffer descargado no comienza con %PDF; posible archivo corrupto o no-PDF.',
    );
  }

  return {
    document,
    personId,
    personName: person.full_name,
    personCvId,
    driveFileId,
    driveFileName,
    pdfByteSize: buffer.length,
    pdfSha256: sha256Hex(buffer),
    pdfBuffer: buffer,
  };
}

/**
 * Llama a Gemini + validación sobre un PDF ya preparado.
 */
export async function extractSkillsFromPrepared(params: {
  prepared: PreparedCvPdf;
  extractionService: CvSkillsExtractionService;
}): Promise<ExtractPipelineSuccess> {
  const { prepared, extractionService } = params;
  const geminiStarted = Date.now();
  let result: ExtractedCvSkills;
  try {
    result = await extractionService.extractSkills(prepared.pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stage: ExtractPipelineStage = message.includes(
      'CvSkillsValidationError',
    )
      ? 'VALIDATION'
      : message.includes('no devolvió JSON') || message.includes('parseable')
        ? 'VALIDATION'
        : 'GEMINI';
    throw new ExtractPipelineError(stage, message);
  }

  return {
    document: prepared.document,
    personId: prepared.personId,
    personName: prepared.personName,
    personCvId: prepared.personCvId,
    driveFileId: prepared.driveFileId,
    driveFileName: prepared.driveFileName,
    pdfByteSize: prepared.pdfByteSize,
    pdfSha256: prepared.pdfSha256,
    result,
    geminiDurationMs: Date.now() - geminiStarted,
  };
}

/**
 * Pipeline completo: prepare + Gemini.
 */
export async function runExtractCvSkillsPipeline(params: {
  document: string;
  dataSource: DataSource;
  extractionService: CvSkillsExtractionService;
}): Promise<ExtractPipelineSuccess> {
  const prepared = await prepareCvPdfForExtraction({
    document: params.document,
    dataSource: params.dataSource,
  });
  return extractSkillsFromPrepared({
    prepared,
    extractionService: params.extractionService,
  });
}
