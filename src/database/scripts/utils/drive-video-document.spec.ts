import { parseDriveVideoFileName } from './drive-video-document';

describe('parseDriveVideoFileName', () => {
  it('acepta ejemplos válidos del contrato', () => {
    expect(parseDriveVideoFileName('1070007550.mp4')).toEqual({
      document: '1070007550',
      extension: 'mp4',
      validName: true,
      reason: null,
    });
    expect(parseDriveVideoFileName('1070007550-presentacion.mp4')).toEqual({
      document: '1070007550',
      extension: 'mp4',
      validName: true,
      reason: null,
    });
    expect(parseDriveVideoFileName('1070007550_presentacion.webm')).toEqual({
      document: '1070007550',
      extension: 'webm',
      validName: true,
      reason: null,
    });
    expect(parseDriveVideoFileName('1070007550-foo.mov')).toEqual({
      document: '1070007550',
      extension: 'mov',
      validName: true,
      reason: null,
    });
  });

  it('normaliza extensión a minúsculas y hace trim', () => {
    expect(parseDriveVideoFileName('  123.MP4  ').extension).toBe('mp4');
  });

  it('rechaza patrones inválidos', () => {
    expect(parseDriveVideoFileName('presentacion-1070007550.mp4').validName).toBe(
      false,
    );
    expect(parseDriveVideoFileName('1070007550 presentacion.mp4').validName).toBe(
      false,
    );
    expect(parseDriveVideoFileName('HV_1070007550.mp4').validName).toBe(false);
    expect(parseDriveVideoFileName('1070007550.pdf').validName).toBe(false);
    expect(parseDriveVideoFileName('1070007550.avi').validName).toBe(false);
    expect(parseDriveVideoFileName('').reason).toBe('EMPTY_NAME');
  });

  it('no convierte el documento a número', () => {
    const r = parseDriveVideoFileName('0123456789.mp4');
    expect(r.document).toBe('0123456789');
    expect(typeof r.document).toBe('string');
  });
});
