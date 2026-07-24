import { compareDriveCvInventories } from '../diag-drive-cv-compare';
import { buildDriveCvFile } from './drive-cv-path';

describe('compareDriveCvInventories', () => {
  it('SAME_FILE_ID', () => {
    const src = buildDriveCvFile({
      driveFileId: 'same',
      driveFileName: '1.pdf',
      parentFolderId: 'p',
      folderPath: [],
      md5Checksum: 'm',
      fileSize: 10,
    });
    const tgt = buildDriveCvFile({
      driveFileId: 'same',
      driveFileName: '1.pdf',
      parentFolderId: 'q',
      folderPath: ['SERVICIO'],
      md5Checksum: 'm',
      fileSize: 10,
    });
    const items = compareDriveCvInventories([src], [tgt]);
    expect(items.find((i) => i.document === '1')?.status).toBe('SAME_FILE_ID');
  });

  it('ONLY_SOURCE / ONLY_TARGET', () => {
    const src = buildDriveCvFile({
      driveFileId: 'a',
      driveFileName: '1.pdf',
      parentFolderId: 'p',
      folderPath: [],
    });
    const tgt = buildDriveCvFile({
      driveFileId: 'b',
      driveFileName: '2.pdf',
      parentFolderId: 'p',
      folderPath: ['B2B'],
    });
    const items = compareDriveCvInventories([src], [tgt]);
    expect(items.find((i) => i.document === '1')?.status).toBe('ONLY_SOURCE');
    expect(items.find((i) => i.document === '2')?.status).toBe('ONLY_TARGET');
  });
});
