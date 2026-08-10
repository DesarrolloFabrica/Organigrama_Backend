/**
 * Fuente documental P0 — WRAP sobre downloadCvPdfBuffer legacy.
 * No duplica OAuth/Drive. No escribe BD. No extrae ni normaliza.
 */
import type { DataSource } from 'typeorm';
import { downloadCvPdfBuffer } from '../../database/scripts/utils/google-drive-cv-client';
import { P0SnapshotError } from './p0.errors';

export type P0DriveDocumentSourceResult = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  fileSize: number;
  driveFileId: string;
  modifiedTime: Date | null;
  personId: number;
  personCvId: number;
};

type PersonCvDriveRow = {
  id: string;
  person_id: string;
  drive_file_id: string | null;
  drive_file_name: string | null;
  mime_type: string | null;
  drive_file_size: string | null;
  drive_modified_time: Date | null;
  is_active: boolean;
};

export type P0DriveDownloadFn = (fileId: string) => Promise<Buffer>;

export type P0DriveDocumentSourceOptions = {
  /** Inyectable para tests — por defecto WRAP de downloadCvPdfBuffer. */
  downloadFn?: P0DriveDownloadFn;
  /** Timeout de descarga (ms). Default 60s. */
  timeoutMs?: number;
  /** Si true (default), exige person_cv.is_active. */
  requireActive?: boolean;
};

const DEFAULT_TIMEOUT_MS = 60_000;

export class P0DriveDocumentSource {
  private readonly downloadFn: P0DriveDownloadFn;
  private readonly timeoutMs: number;
  private readonly requireActive: boolean;

  constructor(
    private readonly dataSource: DataSource,
    options: P0DriveDocumentSourceOptions = {},
  ) {
    this.downloadFn = options.downloadFn ?? downloadCvPdfBuffer;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.requireActive = options.requireActive ?? true;
  }

  /**
   * personCvId → metadatos person_cv → downloadCvPdfBuffer → Buffer + meta.
   * Sin transformación del contenido.
   */
  async fetchByPersonCvId(
    personCvId: number,
  ): Promise<P0DriveDocumentSourceResult> {
    if (!Number.isFinite(personCvId) || personCvId <= 0) {
      throw new P0SnapshotError({
        code: 'INVALID_INPUT',
        stage: 'DRIVE',
        retryable: false,
        messageSafe: 'personCvId inválido',
      });
    }

    let rows: PersonCvDriveRow[];
    try {
      rows = await this.dataSource.query<PersonCvDriveRow[]>(
        `SELECT id, person_id, drive_file_id, drive_file_name, mime_type,
                drive_file_size, drive_modified_time, is_active
           FROM organigrama.person_cv
          WHERE id = $1
          LIMIT 1`,
        [personCvId],
      );
    } catch (err) {
      throw new P0SnapshotError({
        code: 'DRIVE_DOWNLOAD_FAILED',
        stage: 'DRIVE',
        retryable: true,
        messageSafe: 'failed to resolve person_cv',
        technicalCause: err instanceof Error ? err.name : 'query_error',
      });
    }

    if (rows.length === 0) {
      throw new P0SnapshotError({
        code: 'ACTIVE_CV_NOT_FOUND',
        stage: 'DRIVE',
        retryable: false,
        messageSafe: 'person_cv not found',
      });
    }

    const cv = rows[0];
    if (this.requireActive && !cv.is_active) {
      throw new P0SnapshotError({
        code: 'ACTIVE_CV_NOT_FOUND',
        stage: 'DRIVE',
        retryable: false,
        messageSafe: 'person_cv is not active',
      });
    }

    const driveFileId = cv.drive_file_id?.trim() ?? '';
    if (!driveFileId) {
      throw new P0SnapshotError({
        code: 'DRIVE_FILE_NOT_FOUND',
        stage: 'DRIVE',
        retryable: false,
        messageSafe: 'person_cv has no drive_file_id',
      });
    }

    const fileName = cv.drive_file_name?.trim() ?? '';
    if (!fileName) {
      throw new P0SnapshotError({
        code: 'DRIVE_FILE_NOT_FOUND',
        stage: 'DRIVE',
        retryable: false,
        messageSafe: 'person_cv has no drive_file_name',
      });
    }

    const mimeType = (cv.mime_type ?? '').trim();
    if (mimeType.toLowerCase() !== 'application/pdf') {
      throw new P0SnapshotError({
        code: 'UNSUPPORTED_FORMAT',
        stage: 'DRIVE',
        retryable: false,
        messageSafe: 'person_cv mimeType is not application/pdf',
      });
    }

    let buffer: Buffer;
    try {
      buffer = await this.withTimeout(
        this.downloadFn(driveFileId),
        this.timeoutMs,
      );
    } catch (err) {
      if (err instanceof P0SnapshotError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();
      if (
        lower.includes('404') ||
        lower.includes('not found') ||
        lower.includes('file not found')
      ) {
        throw new P0SnapshotError({
          code: 'DRIVE_FILE_NOT_FOUND',
          stage: 'DRIVE',
          retryable: false,
          messageSafe: 'drive file not found',
          technicalCause: 'not_found',
        });
      }
      if (
        lower.includes('invalid_grant') ||
        lower.includes('unauthorized') ||
        lower.includes('401') ||
        lower.includes('403')
      ) {
        throw new P0SnapshotError({
          code: 'DRIVE_DOWNLOAD_FAILED',
          stage: 'DRIVE',
          retryable: true,
          messageSafe: 'drive credentials or authorization failed',
          technicalCause: 'auth',
        });
      }
      throw new P0SnapshotError({
        code: 'DRIVE_DOWNLOAD_FAILED',
        stage: 'DRIVE',
        retryable: true,
        messageSafe: 'drive download failed',
        technicalCause: err instanceof Error ? err.name : 'download_error',
      });
    }

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new P0SnapshotError({
        code: 'DRIVE_DOWNLOAD_FAILED',
        stage: 'DRIVE',
        retryable: true,
        messageSafe: 'drive returned empty buffer',
      });
    }

    return {
      buffer,
      mimeType,
      fileName,
      fileSize: buffer.length,
      driveFileId,
      modifiedTime: cv.drive_modified_time
        ? new Date(cv.drive_modified_time)
        : null,
      personId: Number(cv.person_id),
      personCvId: Number(cv.id),
    };
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(
              new P0SnapshotError({
                code: 'DRIVE_TIMEOUT',
                stage: 'DRIVE',
                retryable: true,
                messageSafe: `drive download timed out after ${ms}ms`,
              }),
            );
          }, ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
