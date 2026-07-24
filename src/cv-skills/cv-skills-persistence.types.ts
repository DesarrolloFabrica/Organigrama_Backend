/**
 * Contratos de entrada/salida para persistencia de extracciones de skills.
 * No llama a Gemini ni descarga Drive.
 */

import type { ExtractedCvSkills } from './cv-skills.types';
import type { CvExtraction } from './entities/cv-extraction.entity';

export interface PersistCvSkillsInput {
  personId: number;
  personCvId: number;
  document: string;
  driveFileId: string;
  driveFileName: string;
  /** SHA-256 hex del PDF (64 chars). */
  pdfSha256: string;
  /** Bytes del PDF; NOT NULL en SQL (pdf_byte_size > 0). */
  pdfByteSize: number;
  model: string;
  promptVersion: string;
  extractorVersion: string;
  result: ExtractedCvSkills;
  /** Opcional: no hay columna duration_ms; se guarda en raw_result.meta. */
  durationMs?: number;
}

export interface RegisterCvExtractionFailureInput {
  personId: number;
  personCvId: number;
  document: string;
  driveFileId: string;
  driveFileName: string;
  pdfSha256: string;
  pdfByteSize: number;
  model: string;
  promptVersion: string;
  extractorVersion: string;
  errorStage: string;
  errorMessage: string;
  durationMs?: number;
}

export interface CreateRunningExtractionInput {
  personId: number;
  personCvId: number;
  document: string;
  driveFileId: string;
  driveFileName: string;
  pdfSha256: string;
  pdfByteSize: number;
  model: string;
  promptVersion: string;
  extractorVersion: string;
}

export interface FailExtractionInput {
  errorStage: string;
  errorMessage: string;
  durationMs?: number;
}

export interface CompleteExtractionMetadata {
  durationMs?: number;
}

export type PersistSucceededResult =
  | { status: 'ALREADY_EXISTS'; extraction: CvExtraction }
  | { status: 'CREATED'; extraction: CvExtraction };

export class CvSkillsAliasConflictError extends Error {
  readonly aliasKey: string;
  readonly existingSkillId: string;
  readonly requestedSkillId: string;

  constructor(
    aliasKey: string,
    existingSkillId: string,
    requestedSkillId: string,
  ) {
    super(
      `Alias "${aliasKey}" ya pertenece a skill_id=${existingSkillId}; ` +
        `no se puede reasignar a skill_id=${requestedSkillId}.`,
    );
    this.name = 'CvSkillsAliasConflictError';
    this.aliasKey = aliasKey;
    this.existingSkillId = existingSkillId;
    this.requestedSkillId = requestedSkillId;
  }
}

export class CvSkillsPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CvSkillsPersistenceError';
  }
}
