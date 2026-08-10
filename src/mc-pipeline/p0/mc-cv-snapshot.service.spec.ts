import { createHash } from 'node:crypto';
import type { Repository } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import { McCvSnapshot } from '../entities/mc-cv-snapshot.entity';
import { McCvSnapshotService } from './mc-cv-snapshot.service';
import type { CvDocumentTextExtractor } from './cv-document-text-extractor';
import { CvTextNormalizer } from './cv-text-normalizer';
import { P0SnapshotError } from './p0.errors';
import type { CvDocumentExtractionResult } from './p0.types';
import { buildSimplePdfWithText } from './__fixtures__/synthetic-pdf';

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function mockExtractor(
  result: CvDocumentExtractionResult,
): CvDocumentTextExtractor {
  return {
    name: 'mock',
    version: '1.0.0',
    extract: async () => result,
  };
}

function mockRepo(overrides: Partial<Repository<McCvSnapshot>> = {}) {
  const store: McCvSnapshot[] = [];
  const repo = {
    findOne: jest.fn(async ({ where }: { where: Record<string, string> }) => {
      return (
        store.find(
          (r) =>
            r.person_cv_id === where.person_cv_id &&
            r.source_hash === where.source_hash &&
            r.extractor_version === where.extractor_version &&
            r.normalizer_version === where.normalizer_version,
        ) ??
        store.find((r) => r.id === where.id) ??
        null
      );
    }),
    create: jest.fn((x: Partial<McCvSnapshot>) => ({ ...x }) as McCvSnapshot),
    save: jest.fn(async (x: McCvSnapshot) => {
      const row = { ...x, id: x.id ?? String(store.length + 1), created_at: new Date() };
      store.push(row);
      return row;
    }),
    manager: {
      transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => {
        const txRepo = {
          findOne: repo.findOne,
          create: repo.create,
          save: repo.save,
        };
        return fn({ getRepository: () => txRepo });
      }),
    },
    ...overrides,
  };
  return { repo: repo as unknown as Repository<McCvSnapshot>, store };
}

describe('McCvSnapshotService', () => {
  const buffer = buildSimplePdfWithText(['Hola mundo profesional']);
  const hash = sha256(buffer);

  const okExtract: CvDocumentExtractionResult = {
    status: 'PARSED',
    rawText: '---PAGE 1---\n\nHola mundo profesional',
    pages: [{ pageNumber: 1, text: 'Hola mundo profesional', characterCount: 22 }],
    pageCount: 1,
    metadata: {},
    warnings: [],
  };

  it('CREATED en primer insert', async () => {
    const { repo } = mockRepo();
    const svc = McCvSnapshotService.create(repo, {
      extractor: mockExtractor(okExtract),
      normalizer: new CvTextNormalizer(),
      mdeTarget: { host: '127.0.0.1', port: 5434, database: 'organigrama_mde' },
    });
    const r = await svc.createFromPreparedDocument({
      personId: 1,
      personCvId: 1,
      driveFileId: 'file1',
      driveFileName: 'a.pdf',
      mimeType: 'application/pdf',
      buffer,
      sourceHash: hash,
      sourceSizeBytes: buffer.length,
    });
    expect(r.outcome).toBe('CREATED');
    expect(r.parseStatus).toBe('PARSED');
  });

  it('REUSED en segunda llamada equivalente', async () => {
    const { repo } = mockRepo();
    const svc = McCvSnapshotService.create(repo, {
      extractor: mockExtractor(okExtract),
      mdeTarget: { host: '127.0.0.1', port: 5434, database: 'organigrama_mde' },
    });
    const input = {
      personId: 1,
      personCvId: 1,
      driveFileId: 'file1',
      driveFileName: 'a.pdf',
      mimeType: 'application/pdf',
      buffer,
      sourceHash: hash,
      sourceSizeBytes: buffer.length,
    };
    const a = await svc.createFromPreparedDocument(input);
    const b = await svc.createFromPreparedDocument(input);
    expect(a.outcome).toBe('CREATED');
    expect(b.outcome).toBe('REUSED');
    expect(b.snapshotId).toBe(a.snapshotId);
  });

  it('falla guard MDE', async () => {
    const { repo } = mockRepo();
    const svc = McCvSnapshotService.create(repo, {
      extractor: mockExtractor(okExtract),
      mdeTarget: { host: '8.8.8.8', port: 5434, database: 'organigrama_mde' },
    });
    await expect(
      svc.createFromPreparedDocument({
        personId: 1,
        personCvId: 1,
        driveFileId: 'f',
        driveFileName: 'a.pdf',
        mimeType: 'application/pdf',
        buffer,
        sourceHash: hash,
        sourceSizeBytes: buffer.length,
      }),
    ).rejects.toBeInstanceOf(P0SnapshotError);
  });

  it('unique race → REUSED', async () => {
    const existing = {
      id: '99',
      person_cv_id: '1',
      source_hash: hash,
      extractor_version: '1.0.0',
      normalizer_version: '1.0.0',
      parse_status: 'PARSED',
      page_count: 1,
      extractor_name: 'mock',
      normalizer_name: 'deterministic-cv-text-normalizer',
      normalized_text_hash: 'b'.repeat(64),
    } as McCvSnapshot;

    const { repo } = mockRepo();
    (repo.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    (repo.manager.transaction as jest.Mock).mockImplementation(async () => {
      const err = new QueryFailedError('INSERT', [], new Error('dup'));
      (err as QueryFailedError & { driverError: { code: string } }).driverError = {
        code: '23505',
      };
      throw err;
    });

    const svc = McCvSnapshotService.create(repo, {
      extractor: mockExtractor(okExtract),
      mdeTarget: { host: '127.0.0.1', port: 5434, database: 'organigrama_mde' },
    });
    const r = await svc.createFromPreparedDocument({
      personId: 1,
      personCvId: 1,
      driveFileId: 'f',
      driveFileName: 'a.pdf',
      mimeType: 'application/pdf',
      buffer,
      sourceHash: hash,
      sourceSizeBytes: buffer.length,
    });
    expect(r.outcome).toBe('REUSED');
    expect(r.snapshotId).toBe('99');
  });

  it('getMetadata no expone textos', async () => {
    const { repo, store } = mockRepo();
    store.push({
      id: '5',
      person_id: '1',
      person_cv_id: '2',
      source_hash: hash,
      mime_type: 'application/pdf',
      page_count: 1,
      parse_status: 'PARSED',
      extractor_name: 'mock',
      extractor_version: '1.0.0',
      normalizer_name: 'n',
      normalizer_version: '1.0.0',
      normalized_text_hash: 'c'.repeat(64),
      source_size_bytes: '10',
      created_at: new Date(),
      raw_text: 'SECRET',
      normalized_text: 'SECRET',
    } as McCvSnapshot);
    const svc = McCvSnapshotService.create(repo);
    const meta = await svc.getMetadata(5);
    expect(meta?.rawTextPresent).toBe(true);
    expect(JSON.stringify(meta)).not.toContain('SECRET');
  });

  it('createOrReuseFromPersonCv orquesta Drive → CREATED', async () => {
    const { repo } = mockRepo();
    const driveSource = {
      fetchByPersonCvId: jest.fn(async () => ({
        buffer,
        mimeType: 'application/pdf',
        fileName: 'cv.pdf',
        fileSize: buffer.length,
        driveFileId: 'drive-abc',
        modifiedTime: null,
        personId: 1163,
        personCvId: 7,
      })),
    };
    const svc = McCvSnapshotService.create(repo, {
      extractor: mockExtractor(okExtract),
      normalizer: new CvTextNormalizer(),
      mdeTarget: { host: '127.0.0.1', port: 5434, database: 'organigrama_mde' },
      driveSource: driveSource as never,
    });
    const r = await svc.createOrReuseFromPersonCv(7);
    expect(driveSource.fetchByPersonCvId).toHaveBeenCalledWith(7);
    expect(r.outcome).toBe('CREATED');
    expect(r.sourceHash).toBe(hash);
  });
});
