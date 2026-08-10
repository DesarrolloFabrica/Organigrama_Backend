import type { DataSource } from 'typeorm';
import { P0DriveDocumentSource } from './p0-drive-document-source';
import { McCvSnapshotService } from './mc-cv-snapshot.service';
import * as driveClient from '../../database/scripts/utils/google-drive-cv-client';

describe('P0DriveDocumentSource', () => {
  const baseRow = {
    id: '7',
    person_id: '1163',
    drive_file_id: 'drive-abc',
    drive_file_name: 'cv.pdf',
    mime_type: 'application/pdf',
    drive_file_size: '1000',
    drive_modified_time: new Date('2026-01-01T00:00:00Z'),
    is_active: true,
  };

  function mockDs(rows: unknown[]): DataSource {
    return {
      query: jest.fn(async () => rows),
    } as unknown as DataSource;
  }

  it('descarga exitosa vía WRAP downloadFn', async () => {
    const buf = Buffer.from('%PDF-1.4 hello');
    const downloadFn = jest.fn(async () => buf);
    const source = new P0DriveDocumentSource(mockDs([baseRow]), { downloadFn });
    const r = await source.fetchByPersonCvId(7);
    expect(downloadFn).toHaveBeenCalledWith('drive-abc');
    expect(r.buffer).toBe(buf);
    expect(r.mimeType).toBe('application/pdf');
    expect(r.fileName).toBe('cv.pdf');
    expect(r.fileSize).toBe(buf.length);
    expect(r.driveFileId).toBe('drive-abc');
    expect(r.personCvId).toBe(7);
    expect(r.personId).toBe(1163);
  });

  it('ACTIVE_CV_NOT_FOUND si no hay fila', async () => {
    const source = new P0DriveDocumentSource(mockDs([]), {
      downloadFn: async () => Buffer.from('x'),
    });
    await expect(source.fetchByPersonCvId(1)).rejects.toMatchObject({
      code: 'ACTIVE_CV_NOT_FOUND',
    });
  });

  it('ACTIVE_CV_NOT_FOUND si inactivo', async () => {
    const source = new P0DriveDocumentSource(
      mockDs([{ ...baseRow, is_active: false }]),
      { downloadFn: async () => Buffer.from('x') },
    );
    await expect(source.fetchByPersonCvId(7)).rejects.toMatchObject({
      code: 'ACTIVE_CV_NOT_FOUND',
    });
  });

  it('DRIVE_FILE_NOT_FOUND sin drive_file_id', async () => {
    const source = new P0DriveDocumentSource(
      mockDs([{ ...baseRow, drive_file_id: null }]),
      { downloadFn: async () => Buffer.from('x') },
    );
    await expect(source.fetchByPersonCvId(7)).rejects.toMatchObject({
      code: 'DRIVE_FILE_NOT_FOUND',
    });
  });

  it('DRIVE_FILE_NOT_FOUND en 404 del wrapper', async () => {
    const source = new P0DriveDocumentSource(mockDs([baseRow]), {
      downloadFn: async () => {
        throw new Error('File not found 404');
      },
    });
    await expect(source.fetchByPersonCvId(7)).rejects.toMatchObject({
      code: 'DRIVE_FILE_NOT_FOUND',
    });
  });

  it('DRIVE_TIMEOUT', async () => {
    const source = new P0DriveDocumentSource(mockDs([baseRow]), {
      timeoutMs: 20,
      downloadFn: async () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(Buffer.from('%PDF')), 200);
        }),
    });
    await expect(source.fetchByPersonCvId(7)).rejects.toMatchObject({
      code: 'DRIVE_TIMEOUT',
    });
  });

  it('credenciales inválidas → DRIVE_DOWNLOAD_FAILED', async () => {
    const source = new P0DriveDocumentSource(mockDs([baseRow]), {
      downloadFn: async () => {
        throw new Error('invalid_grant unauthorized 401');
      },
    });
    await expect(source.fetchByPersonCvId(7)).rejects.toMatchObject({
      code: 'DRIVE_DOWNLOAD_FAILED',
    });
  });

  it('MIME incorrecto → UNSUPPORTED_FORMAT (sin descargar)', async () => {
    const downloadFn = jest.fn(async () => Buffer.from('x'));
    const source = new P0DriveDocumentSource(
      mockDs([{ ...baseRow, mime_type: 'application/msword' }]),
      { downloadFn },
    );
    await expect(source.fetchByPersonCvId(7)).rejects.toMatchObject({
      code: 'UNSUPPORTED_FORMAT',
    });
    expect(downloadFn).not.toHaveBeenCalled();
  });

  it('reutiliza export legacy downloadCvPdfBuffer por defecto', () => {
    expect(typeof driveClient.downloadCvPdfBuffer).toBe('function');
    const source = new P0DriveDocumentSource(mockDs([baseRow]));
    expect(source).toBeInstanceOf(P0DriveDocumentSource);
  });
});

describe('McCvSnapshotService.fetchDriveDocument', () => {
  it('delega al drive source sin persistir', async () => {
    const buf = Buffer.from('%PDF-ok');
    const driveSource = {
      fetchByPersonCvId: jest.fn(async () => ({
        buffer: buf,
        mimeType: 'application/pdf',
        fileName: 'a.pdf',
        fileSize: buf.length,
        driveFileId: 'f1',
        modifiedTime: null,
        personId: 1,
        personCvId: 7,
      })),
    };
    const svc = McCvSnapshotService.create({} as never, {
      driveSource: driveSource as never,
      mdeTarget: { host: '127.0.0.1', port: 5434, database: 'organigrama_mde' },
    });
    const r = await svc.fetchDriveDocument(7);
    expect(r.buffer).toBe(buf);
    expect(driveSource.fetchByPersonCvId).toHaveBeenCalledWith(7);
  });
});
