/**
 * McCvSnapshotService — create/reuse desde documento ya preparado (buffer).
 * 4D.1: fetchDriveDocument WRAP sobre downloadCvPdfBuffer (sin extract/persist).
 * 4D.2: createOrReuseFromPersonCv orquesta Drive → hash → createFromPreparedDocument.
 * Sin UPDATE. Parsing fuera de transacción.
 */
import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { McCvSnapshot } from '../entities/mc-cv-snapshot.entity';
import type { CvDocumentTextExtractor } from './cv-document-text-extractor';
import { CvSectionDetector } from './cv-section-detector';
import { CvTextNormalizer } from './cv-text-normalizer';
import { UnpdfCvDocumentTextExtractor } from './unpdf-text-extractor.adapter';
import { assertMdeTarget, type MdeConnectionTarget } from './mde-guard';
import { P0SnapshotError } from './p0.errors';
import {
  P0DriveDocumentSource,
  type P0DriveDocumentSourceResult,
} from './p0-drive-document-source';
import type {
  McCvSnapshotCreationInput,
  McCvSnapshotCreationResult,
  McCvSnapshotMetadata,
  P0ParseStatus,
} from './p0.types';

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

const SUCCESS_WITH_TEXT: P0ParseStatus[] = ['PARSED', 'PARTIAL'];

export type McCvSnapshotServiceDeps = {
  extractor?: CvDocumentTextExtractor;
  normalizer?: CvTextNormalizer;
  sectionDetector?: CvSectionDetector;
  mdeTarget?: MdeConnectionTarget | null;
  driveSource?: P0DriveDocumentSource;
  dataSource?: DataSource;
};

@Injectable()
export class McCvSnapshotService {
  private readonly extractor: CvDocumentTextExtractor;
  private readonly normalizer: CvTextNormalizer;
  private readonly sectionDetector: CvSectionDetector;
  private readonly mdeTarget: MdeConnectionTarget | null;
  private readonly driveSource: P0DriveDocumentSource | null;
  private readonly dataSource: DataSource | null;

  constructor(
    @InjectRepository(McCvSnapshot)
    private readonly snapshots: Repository<McCvSnapshot>,
    dataSource: DataSource,
  ) {
    this.extractor = new UnpdfCvDocumentTextExtractor();
    this.normalizer = new CvTextNormalizer();
    this.sectionDetector = new CvSectionDetector();
    this.mdeTarget = null;
    this.dataSource = dataSource;
    this.driveSource = new P0DriveDocumentSource(dataSource);
  }

  /** Factory para tests / scripts con dependencias explícitas (sin Nest DI). */
  static create(
    snapshots: Repository<McCvSnapshot>,
    deps: McCvSnapshotServiceDeps = {},
  ): McCvSnapshotService {
    const svc = Object.create(McCvSnapshotService.prototype) as McCvSnapshotService;
    (svc as unknown as { snapshots: Repository<McCvSnapshot> }).snapshots =
      snapshots;
    (svc as unknown as { extractor: CvDocumentTextExtractor }).extractor =
      deps.extractor ?? new UnpdfCvDocumentTextExtractor();
    (svc as unknown as { normalizer: CvTextNormalizer }).normalizer =
      deps.normalizer ?? new CvTextNormalizer();
    (svc as unknown as { sectionDetector: CvSectionDetector }).sectionDetector =
      deps.sectionDetector ?? new CvSectionDetector();
    (svc as unknown as { mdeTarget: MdeConnectionTarget | null }).mdeTarget =
      deps.mdeTarget ?? null;
    (svc as unknown as { dataSource: DataSource | null }).dataSource =
      deps.dataSource ?? null;
    (svc as unknown as { driveSource: P0DriveDocumentSource | null }).driveSource =
      deps.driveSource ??
      (deps.dataSource
        ? new P0DriveDocumentSource(deps.dataSource)
        : null);
    return svc;
  }

  /**
   * Solo descarga: personCvId → WRAP downloadCvPdfBuffer → Buffer + meta.
   * No extrae, no normaliza, no persiste.
   */
  async fetchDriveDocument(
    personCvId: number,
  ): Promise<P0DriveDocumentSourceResult> {
    this.assertGuard();
    const source = this.driveSource;
    if (!source) {
      throw new P0SnapshotError({
        code: 'INVALID_INPUT',
        stage: 'DRIVE',
        retryable: false,
        messageSafe: 'drive source not configured',
      });
    }
    return source.fetchByPersonCvId(personCvId);
  }

  /**
   * Orquestación mínima P0: personCvId → Drive → SHA-256 → createFromPreparedDocument.
   * No inventa campaignId / pipelineRunId.
   */
  async createOrReuseFromPersonCv(
    personCvId: number,
  ): Promise<McCvSnapshotCreationResult> {
    const doc = await this.fetchDriveDocument(personCvId);
    const sourceHash = sha256Hex(doc.buffer);
    return this.createFromPreparedDocument({
      personId: doc.personId,
      personCvId: doc.personCvId,
      driveFileId: doc.driveFileId,
      driveFileName: doc.fileName,
      mimeType: doc.mimeType,
      buffer: doc.buffer,
      sourceHash,
      sourceSizeBytes: doc.buffer.byteLength,
      sourceModifiedTime: doc.modifiedTime,
    });
  }

  private assertGuard(): void {
    if (this.mdeTarget) {
      assertMdeTarget(this.mdeTarget);
    }
  }

  async findEquivalent(input: {
    personCvId: number;
    sourceHash: string;
    extractorVersion: string;
    normalizerVersion: string;
  }): Promise<McCvSnapshot | null> {
    return this.snapshots.findOne({
      where: {
        person_cv_id: String(input.personCvId),
        source_hash: input.sourceHash,
        extractor_version: input.extractorVersion,
        normalizer_version: input.normalizerVersion,
      },
    });
  }

  async getMetadata(snapshotId: string | number): Promise<McCvSnapshotMetadata | null> {
    const row = await this.snapshots.findOne({
      where: { id: String(snapshotId) },
    });
    if (!row) return null;
    return {
      snapshotId: row.id,
      personId: row.person_id,
      personCvId: row.person_cv_id,
      sourceHash: row.source_hash,
      mimeType: row.mime_type,
      pageCount: row.page_count,
      parseStatus: row.parse_status,
      extractorName: row.extractor_name,
      extractorVersion: row.extractor_version,
      normalizerName: row.normalizer_name,
      normalizerVersion: row.normalizer_version,
      normalizedTextHash: row.normalized_text_hash,
      sourceSizeBytes: row.source_size_bytes,
      createdAt: row.created_at,
      rawTextPresent: row.raw_text != null && row.raw_text.length > 0,
      normalizedTextPresent:
        row.normalized_text != null && row.normalized_text.length > 0,
    };
  }

  async createFromPreparedDocument(
    input: McCvSnapshotCreationInput,
  ): Promise<McCvSnapshotCreationResult> {
    this.assertGuard();

    if (!/^[a-f0-9]{64}$/.test(input.sourceHash)) {
      throw new P0SnapshotError({
        code: 'INVALID_INPUT',
        stage: 'PERSIST',
        retryable: false,
        messageSafe: 'sourceHash must be 64 lowercase hex chars',
      });
    }

    const existing = await this.findEquivalent({
      personCvId: input.personCvId,
      sourceHash: input.sourceHash,
      extractorVersion: this.extractor.version,
      normalizerVersion: this.normalizer.version,
    });
    if (existing) {
      return this.toResult('REUSED', existing, []);
    }

    // Parsing fuera de TX
    const extracted = await this.extractor.extract({
      buffer: input.buffer,
      mimeType: input.mimeType,
      fileName: input.driveFileName,
    });

    let normalizedText: string | null = null;
    let normalizedTextHash: string | null = null;
    let sectioned: unknown = {
      sections: [],
      unclassifiedText: [],
      detectorName: this.sectionDetector.name,
      detectorVersion: this.sectionDetector.version,
      warnings: [],
    };
    const warnings = [...extracted.warnings];

    if (SUCCESS_WITH_TEXT.includes(extracted.status)) {
      try {
        const norm = this.normalizer.normalize(extracted.rawText);
        normalizedText = norm.normalizedText;
        normalizedTextHash = norm.normalizedTextHash;
        warnings.push(...norm.warnings);
        const sections = this.sectionDetector.detect({
          normalizedText: norm.normalizedText,
          pages: extracted.pages,
        });
        sectioned = sections;
        warnings.push(...sections.warnings);
      } catch (err) {
        throw new P0SnapshotError({
          code: 'NORMALIZATION_FAILED',
          stage: 'NORMALIZE',
          retryable: false,
          messageSafe: 'normalization failed',
          technicalCause: err instanceof Error ? err.name : 'unknown',
        });
      }
    }

    const parseStatus = extracted.status;
    const rowPartial: Partial<McCvSnapshot> = {
      person_id: String(input.personId),
      person_cv_id: String(input.personCvId),
      drive_file_id: input.driveFileId,
      drive_file_name: input.driveFileName,
      mime_type: input.mimeType,
      source_hash: input.sourceHash,
      source_size_bytes: String(input.sourceSizeBytes),
      source_modified_time: input.sourceModifiedTime ?? null,
      raw_text: SUCCESS_WITH_TEXT.includes(parseStatus)
        ? extracted.rawText
        : extracted.rawText || null,
      normalized_text: normalizedText,
      normalized_text_hash: normalizedTextHash,
      page_count: extracted.pageCount,
      pages: extracted.pages,
      sectioned_content: sectioned,
      extractor_name: this.extractor.name,
      extractor_version: this.extractor.version,
      normalizer_name: this.normalizer.name,
      normalizer_version: this.normalizer.version,
      parse_status: parseStatus,
      parse_warnings: warnings,
      parse_error_code: extracted.errorCode ?? null,
      parse_error_detail_safe: extracted.errorDetailSafe ?? null,
    };

    // TX corta: re-check + insert; carrera unique → REUSED
    try {
      const saved = await this.snapshots.manager.transaction(async (manager) => {
        const repo = manager.getRepository(McCvSnapshot);
        const again = await repo.findOne({
          where: {
            person_cv_id: String(input.personCvId),
            source_hash: input.sourceHash,
            extractor_version: this.extractor.version,
            normalizer_version: this.normalizer.version,
          },
        });
        if (again) return { outcome: 'REUSED' as const, row: again };

        const entity = repo.create(rowPartial);
        const inserted = await repo.save(entity);
        return { outcome: 'CREATED' as const, row: inserted };
      });

      return this.toResult(saved.outcome, saved.row, warnings);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const code = (err as QueryFailedError & { driverError?: { code?: string } })
          .driverError?.code;
        if (code === '23505') {
          const raced = await this.findEquivalent({
            personCvId: input.personCvId,
            sourceHash: input.sourceHash,
            extractorVersion: this.extractor.version,
            normalizerVersion: this.normalizer.version,
          });
          if (raced) {
            return this.toResult('REUSED', raced, warnings);
          }
          throw new P0SnapshotError({
            code: 'IDEMPOTENCY_CONFLICT',
            stage: 'IDEMPOTENCY',
            retryable: true,
            messageSafe: 'unique conflict without readable equivalent row',
          });
        }
      }
      throw new P0SnapshotError({
        code: 'SNAPSHOT_PERSIST_FAILED',
        stage: 'PERSIST',
        retryable: true,
        messageSafe: 'failed to persist snapshot',
        technicalCause: err instanceof Error ? err.name : 'unknown',
      });
    }
  }

  private toResult(
    outcome: 'CREATED' | 'REUSED',
    row: McCvSnapshot,
    warnings: string[],
  ): McCvSnapshotCreationResult {
    return {
      outcome,
      snapshotId: row.id,
      parseStatus: row.parse_status,
      pageCount: row.page_count,
      sourceHash: row.source_hash,
      normalizedTextHash: row.normalized_text_hash,
      extractorName: row.extractor_name,
      extractorVersion: row.extractor_version,
      normalizerName: row.normalizer_name,
      normalizerVersion: row.normalizer_version,
      warnings,
    };
  }
}
