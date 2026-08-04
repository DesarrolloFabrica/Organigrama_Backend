import {
  classifyDriveVideoFormat,
  mimeExtensionInconsistent,
} from './drive-video-format';

describe('classifyDriveVideoFormat', () => {
  it('clasifica mp4 como SUPPORTED_MVP', () => {
    expect(
      classifyDriveVideoFormat({ mimeType: 'video/mp4', extension: 'mp4' }),
    ).toBe('SUPPORTED_MVP');
  });

  it('clasifica webm como INVENTORY_ONLY', () => {
    expect(
      classifyDriveVideoFormat({ mimeType: 'video/webm', extension: 'webm' }),
    ).toBe('INVENTORY_ONLY');
  });

  it('clasifica mov/quicktime como INCOMPATIBLE_MVP', () => {
    expect(
      classifyDriveVideoFormat({
        mimeType: 'video/quicktime',
        extension: 'mov',
      }),
    ).toBe('INCOMPATIBLE_MVP');
  });

  it('clasifica otros como NON_VIDEO', () => {
    expect(
      classifyDriveVideoFormat({
        mimeType: 'application/pdf',
        extension: 'pdf',
      }),
    ).toBe('NON_VIDEO');
  });
});

describe('mimeExtensionInconsistent', () => {
  it('detecta mp4 con MIME ajeno', () => {
    expect(
      mimeExtensionInconsistent({
        mimeType: 'video/webm',
        extension: 'mp4',
      }),
    ).toBe(true);
  });

  it('acepta mp4 coherente', () => {
    expect(
      mimeExtensionInconsistent({
        mimeType: 'video/mp4',
        extension: 'mp4',
      }),
    ).toBe(false);
  });
});
