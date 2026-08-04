import { loadDriveVideoInventoryFile } from './drive-video-plan-load';
import { buildDriveVideoPlan, toPlanPersonRow } from './drive-video-planner';
import type {
  DriveVideoPlanItemInput,
  DriveVideoPlanVideoRow,
} from './drive-video-plan-types';
import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

function item(
  partial: Partial<DriveVideoPlanItemInput> & {
    driveFileId: string;
    driveFileName: string;
  },
): DriveVideoPlanItemInput {
  return {
    mimeType: 'video/mp4',
    relativePath: partial.driveFileName,
    modifiedTime: '2026-01-01T00:00:00.000Z',
    md5Checksum: 'abc',
    size: 100,
    document: '123',
    extension: 'mp4',
    validName: true,
    nameReason: null,
    formatClass: 'SUPPORTED_MVP',
    mimeExtensionInconsistent: false,
    ...partial,
  };
}

function video(
  partial: Partial<DriveVideoPlanVideoRow> & {
    id: string;
    person_id: string;
    drive_file_id: string;
  },
): DriveVideoPlanVideoRow {
  return {
    document: '123',
    drive_file_name: '123.mp4',
    mime_type: 'video/mp4',
    drive_modified_time: '2026-01-01T00:00:00.000Z',
    drive_md5_checksum: 'abc',
    drive_file_size: 100,
    drive_relative_path: '123.mp4',
    is_active: true,
    ...partial,
  };
}

function plan(
  items: DriveVideoPlanItemInput[],
  persons: ReturnType<typeof toPlanPersonRow>[],
  videos: DriveVideoPlanVideoRow[] = [],
) {
  const personsByDocument = new Map<string, typeof persons>();
  for (const p of persons) {
    const list = personsByDocument.get(p.document) ?? [];
    list.push(p);
    personsByDocument.set(p.document, list);
  }
  return buildDriveVideoPlan({
    items,
    personsByDocument,
    videos,
    inventorySource: 'test',
    database: 'core',
    personVideoRowsBefore: videos.length,
  });
}

describe('buildDriveVideoPlan', () => {
  const person = toPlanPersonRow({
    id: '10',
    document: '123',
    is_active: true,
    roleName: 'ANALISTA',
    fullName: 'X',
  });

  it('NEW cuando persona elegible sin video activo', () => {
    const r = plan([item({ driveFileId: 'f1', driveFileName: '123.mp4' })], [
      person,
    ]);
    expect(r.items[0].action).toBe('NEW');
    expect(r.summary.byAction.NEW).toBe(1);
  });

  it('NO_CHANGE cuando mismo archivo y meta', () => {
    const r = plan(
      [item({ driveFileId: 'f1', driveFileName: '123.mp4' })],
      [person],
      [
        video({
          id: 'v1',
          person_id: '10',
          drive_file_id: 'f1',
          drive_file_name: '123.mp4',
          drive_relative_path: '123.mp4',
        }),
      ],
    );
    expect(r.items[0].action).toBe('NO_CHANGE');
  });

  it('METADATA_CHANGED con mismo drive_file_id y ruta distinta', () => {
    const r = plan(
      [
        item({
          driveFileId: 'f1',
          driveFileName: '123.mp4',
          relativePath: 'AREA/123.mp4',
        }),
      ],
      [person],
      [
        video({
          id: 'v1',
          person_id: '10',
          drive_file_id: 'f1',
          drive_relative_path: 'OLD/123.mp4',
        }),
      ],
    );
    expect(r.items[0].action).toBe('METADATA_CHANGED');
  });

  it('REPLACE con distinto drive_file_id activo', () => {
    const r = plan(
      [item({ driveFileId: 'f2', driveFileName: '123.mp4', md5Checksum: 'zzz' })],
      [person],
      [video({ id: 'v1', person_id: '10', drive_file_id: 'f1' })],
    );
    expect(r.items[0].action).toBe('REPLACE');
  });

  it('PERSON_NOT_FOUND', () => {
    const r = plan(
      [item({ driveFileId: 'f1', driveFileName: '999.mp4', document: '999' })],
      [],
    );
    expect(r.items[0].action).toBe('PERSON_NOT_FOUND');
  });

  it('PERSON_MATCH_MULTIPLE', () => {
    const r = plan(
      [item({ driveFileId: 'f1', driveFileName: '123.mp4' })],
      [
        person,
        toPlanPersonRow({
          id: '11',
          document: '123',
          is_active: true,
          roleName: 'ANALISTA',
          fullName: 'Y',
        }),
      ],
    );
    expect(r.items[0].action).toBe('PERSON_MATCH_MULTIPLE');
  });

  it('PERSON_INACTIVE', () => {
    const r = plan(
      [item({ driveFileId: 'f1', driveFileName: '123.mp4' })],
      [
        toPlanPersonRow({
          id: '10',
          document: '123',
          is_active: false,
          roleName: 'ANALISTA',
          fullName: 'X',
        }),
      ],
    );
    expect(r.items[0].action).toBe('PERSON_INACTIVE');
  });

  it('VACANCY_NOT_ELIGIBLE', () => {
    const r = plan(
      [item({ driveFileId: 'f1', driveFileName: '123.mp4' })],
      [
        toPlanPersonRow({
          id: '10',
          document: '123',
          is_active: true,
          roleName: 'VACANTE',
          fullName: 'VACANTE - X',
        }),
      ],
    );
    expect(r.items[0].action).toBe('VACANCY_NOT_ELIGIBLE');
  });

  it('DRIVE_FILE_ALREADY_LINKED', () => {
    const r = plan(
      [item({ driveFileId: 'f1', driveFileName: '123.mp4' })],
      [person],
      [
        video({
          id: 'v9',
          person_id: '99',
          drive_file_id: 'f1',
          document: 'other',
        }),
      ],
    );
    expect(r.items[0].action).toBe('DRIVE_FILE_ALREADY_LINKED');
  });

  it('INVALID_NAME con hint de renombrado si solo dígitos', () => {
    const r = plan(
      [
        item({
          driveFileId: 'f1',
          driveFileName: '1000810767',
          document: null,
          extension: null,
          validName: false,
          nameReason: 'INVALID_PATTERN',
        }),
      ],
      [],
    );
    expect(r.items[0].action).toBe('INVALID_NAME');
    expect(r.items[0].renameHint).toBe('1000810767-presentacion.mp4');
  });

  it('DUPLICATE_DOCUMENT', () => {
    const r = plan(
      [
        item({ driveFileId: 'f1', driveFileName: '123.mp4', document: '123' }),
        item({
          driveFileId: 'f2',
          driveFileName: '123-presentacion.mp4',
          document: '123',
        }),
      ],
      [person],
    );
    expect(r.items.every((i) => i.action === 'DUPLICATE_DOCUMENT')).toBe(true);
  });

  it('UNSUPPORTED_FORMAT para webm', () => {
    const r = plan(
      [
        item({
          driveFileId: 'f1',
          driveFileName: '123.webm',
          extension: 'webm',
          formatClass: 'INVENTORY_ONLY',
          mimeType: 'video/webm',
        }),
      ],
      [person],
    );
    expect(r.items[0].action).toBe('UNSUPPORTED_FORMAT');
  });

  it('MIME_EXTENSION_MISMATCH', () => {
    const r = plan(
      [
        item({
          driveFileId: 'f1',
          driveFileName: '123.mp4',
          mimeExtensionInconsistent: true,
          mimeType: 'video/webm',
        }),
      ],
      [person],
    );
    expect(r.items[0].action).toBe('MIME_EXTENSION_MISMATCH');
  });

  it('summary no incluye acciones de escritura reales (solo conteos dry-run)', () => {
    const r = plan([item({ driveFileId: 'f1', driveFileName: '123.mp4' })], [
      person,
    ]);
    expect(r.summary.personVideoRowsAfter).toBe(r.summary.personVideoRowsBefore);
    expect(r.summary.writableWouldBe.new).toBe(1);
  });
});

describe('loadDriveVideoInventoryFile', () => {
  it('rechaza inventario inválido', () => {
    const p = resolve(process.cwd(), 'tmp-test-invalid-inv.json');
    writeFileSync(p, JSON.stringify({ items: [] }), 'utf8');
    expect(() => loadDriveVideoInventoryFile(p)).toThrow(/vacío|inválido/i);
    unlinkSync(p);
  });

  it('carga inventario mínimo válido', () => {
    const p = resolve(process.cwd(), 'tmp-test-valid-inv.json');
    writeFileSync(
      p,
      JSON.stringify({
        summary: { generatedAt: '2026-01-01T00:00:00.000Z', rootFolderId: 'r' },
        items: [
          {
            driveFileId: 'f1',
            driveFileName: '1.mp4',
            mimeType: 'video/mp4',
            relativePath: '1.mp4',
            modifiedTime: null,
            md5Checksum: null,
            size: 1,
            document: '1',
            extension: 'mp4',
            validName: true,
            nameReason: null,
            formatClass: 'SUPPORTED_MVP',
            mimeExtensionInconsistent: false,
          },
        ],
      }),
      'utf8',
    );
    const loaded = loadDriveVideoInventoryFile(p);
    expect(loaded.items).toHaveLength(1);
    unlinkSync(p);
  });
});
