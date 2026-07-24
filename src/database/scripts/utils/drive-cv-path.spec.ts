import { buildDriveCvFile, buildRelativePath } from './drive-cv-path';

describe('drive-cv-path', () => {
  it('construye ruta bajo área', () => {
    const file = buildDriveCvFile({
      driveFileId: 'id1',
      driveFileName: '123.pdf',
      parentFolderId: 'p1',
      folderPath: ['SERVICIO'],
    });
    expect(file.areaFolder).toBe('SERVICIO');
    expect(file.subareaFolder).toBeNull();
    expect(file.relativePath).toBe('SERVICIO/123.pdf');
    expect(file.document).toBe('123');
  });

  it('construye ruta área/escuela', () => {
    const file = buildDriveCvFile({
      driveFileId: 'id2',
      driveFileName: '456.pdf',
      parentFolderId: 'p2',
      folderPath: ['OPERACIONES ACADEMICAS', 'INGENIERIA'],
    });
    expect(file.areaFolder).toBe('OPERACIONES ACADEMICAS');
    expect(file.subareaFolder).toBe('INGENIERIA');
    expect(file.relativePath).toBe(
      'OPERACIONES ACADEMICAS/INGENIERIA/456.pdf',
    );
  });

  it('conserva profundidad > 2', () => {
    const path = ['A', 'B', 'C'];
    expect(buildRelativePath(path, '789.pdf')).toBe('A/B/C/789.pdf');
    const file = buildDriveCvFile({
      driveFileId: 'id3',
      driveFileName: '789.pdf',
      parentFolderId: 'p3',
      folderPath: path,
    });
    expect(file.folderPath).toEqual(['A', 'B', 'C']);
    expect(file.areaFolder).toBe('A');
    expect(file.subareaFolder).toBe('B');
    expect(file.relativePath).toBe('A/B/C/789.pdf');
  });
});
