import { DataSource, QueryRunner } from 'typeorm';
import { buildDriveCvFile } from './drive-cv-path';
import {
  buildDriveCvSyncPlan,
  classifyExistingCv,
  extractProbableDocumentDigits,
  filterInventoryByArea,
  type CorePersonRow,
  type PersonCvRow,
} from './drive-cv-sync-planner';
import { parseDriveCvCliArgs } from './drive-cv-cli-args';
import {
  applyDriveCvPlan,
  deactivatePersonCv,
  extractReturningCount,
} from './drive-cv-sync-writer';

function baseCv(overrides: Partial<PersonCvRow> = {}): PersonCvRow {
  return {
    id: '1',
    person_id: '10',
    document: '123',
    drive_file_id: 'file-a',
    drive_file_name: '123.pdf',
    drive_web_url: 'https://drive/a',
    mime_type: 'application/pdf',
    is_active: true,
    drive_parent_folder_id: 'parent-a',
    drive_area_folder: 'SERVICIO',
    drive_subarea_folder: null,
    drive_relative_path: 'SERVICIO/123.pdf',
    drive_modified_time: '2026-01-01T00:00:00.000Z',
    drive_md5_checksum: 'abc',
    drive_file_size: 100,
    ...overrides,
  };
}

function basePerson(overrides: Partial<CorePersonRow> = {}): CorePersonRow {
  return {
    id: '10',
    document: '123',
    full_name: 'Ana Test',
    edu_email: 'ana@cun.edu.co',
    is_active: true,
    ...overrides,
  };
}

/**
 * Mock DataSource: enruta por fragmentos SQL del planificador.
 */
function mockPlannerDataSource(params: {
  activeCvs?: PersonCvRow[];
  persons?: CorePersonRow[];
  inactiveCounts?: Map<string, number>;
  hasMeta?: boolean;
}): DataSource {
  const activeCvs = params.activeCvs ?? [];
  const persons = params.persons ?? [];
  const inactiveCounts = params.inactiveCounts ?? new Map();
  const hasMeta = params.hasMeta ?? true;

  const query = jest.fn(async (sql: string, args?: unknown[]) => {
    const s = sql.replace(/\s+/g, ' ');

    if (s.includes('information_schema.columns')) {
      return hasMeta ? [{ column_name: 'drive_relative_path' }] : [];
    }

    if (
      s.includes('FROM organigrama.person_cv') &&
      s.includes('is_active = TRUE') &&
      !s.includes('person_id =')
    ) {
      return activeCvs;
    }

    if (s.includes('FROM core.person')) {
      const docs = (args?.[0] as string[]) ?? [];
      return persons.filter((p) => docs.includes(p.document));
    }

    if (
      s.includes('is_active = FALSE') &&
      s.includes('GROUP BY person_id')
    ) {
      const ids = (args?.[0] as string[]) ?? [];
      return ids
        .filter((id) => (inactiveCounts.get(id) ?? 0) > 0)
        .map((id) => ({
          person_id: id,
          n: String(inactiveCounts.get(id)),
        }));
    }

    return [];
  });

  return { query } as unknown as DataSource;
}

describe('classifyExistingCv', () => {
  it('UNCHANGED cuando todo coincide', () => {
    const file = buildDriveCvFile({
      driveFileId: 'file-a',
      driveFileName: '123.pdf',
      parentFolderId: 'parent-a',
      folderPath: ['SERVICIO'],
      driveWebUrl: 'https://drive/a',
      modifiedTime: '2026-01-01T00:00:00.000Z',
      md5Checksum: 'abc',
      fileSize: 100,
    });
    expect(classifyExistingCv(baseCv(), file).status).toBe('UNCHANGED');
  });

  it('MOVED cuando cambia la ruta con mismo file id', () => {
    const file = buildDriveCvFile({
      driveFileId: 'file-a',
      driveFileName: '123.pdf',
      parentFolderId: 'parent-b',
      folderPath: ['B2B'],
      driveWebUrl: 'https://drive/a',
      modifiedTime: '2026-01-01T00:00:00.000Z',
      md5Checksum: 'abc',
      fileSize: 100,
    });
    expect(classifyExistingCv(baseCv(), file).status).toBe('MOVED');
  });

  it('UPDATED cuando cambia drive_file_id', () => {
    const file = buildDriveCvFile({
      driveFileId: 'file-b',
      driveFileName: '123.pdf',
      parentFolderId: 'parent-a',
      folderPath: ['SERVICIO'],
      driveWebUrl: 'https://drive/a',
      modifiedTime: '2026-01-01T00:00:00.000Z',
      md5Checksum: 'abc',
      fileSize: 100,
    });
    expect(classifyExistingCv(baseCv(), file).status).toBe('UPDATED');
  });

  it('UPDATED cuando cambia md5', () => {
    const file = buildDriveCvFile({
      driveFileId: 'file-a',
      driveFileName: '123.pdf',
      parentFolderId: 'parent-a',
      folderPath: ['SERVICIO'],
      driveWebUrl: 'https://drive/a',
      modifiedTime: '2026-01-01T00:00:00.000Z',
      md5Checksum: 'zzz',
      fileSize: 100,
    });
    expect(classifyExistingCv(baseCv(), file).status).toBe('UPDATED');
  });
});

describe('filterInventoryByArea', () => {
  const files = [
    buildDriveCvFile({
      driveFileId: '1',
      driveFileName: '1.pdf',
      parentFolderId: 'p',
      folderPath: ['SERVICIO'],
    }),
    buildDriveCvFile({
      driveFileId: '2',
      driveFileName: '2.pdf',
      parentFolderId: 'p',
      folderPath: ['OPERACIONES ACADEMICAS', 'INGENIERIA'],
    }),
    buildDriveCvFile({
      driveFileId: '3',
      driveFileName: '3.pdf',
      parentFolderId: 'p',
      folderPath: ['OPERACIONES ACADEMICAS', 'NEGOCIOS'],
    }),
  ];

  it('filtra por área case-insensitive y tildes', () => {
    const r = filterInventoryByArea(files, { area: 'servicio' });
    expect(r.filtered).toBe(true);
    expect(r.files).toHaveLength(1);
    expect(r.files[0].document).toBe('1');
  });

  it('filtra área + school', () => {
    const r = filterInventoryByArea(files, {
      area: 'OPERACIONES ACADEMICAS',
      school: 'ingenieria',
    });
    expect(r.files).toHaveLength(1);
    expect(r.files[0].document).toBe('2');
  });

  it('falla si el área no existe', () => {
    expect(() =>
      filterInventoryByArea(files, { area: 'NO EXISTE' }),
    ).toThrow(/no existe/);
  });
});

describe('extractProbableDocumentDigits', () => {
  it('extrae dígitos de nombres inválidos sin validar', () => {
    expect(extractProbableDocumentDigits('1082955522.pdf.pdf')).toBe(
      '1082955522',
    );
    expect(
      extractProbableDocumentDigits('1000518830_CamiloQuintero.pdf'),
    ).toBe('1000518830');
    expect(extractProbableDocumentDigits('52866878 .pdf')).toBe('52866878');
  });
});

describe('buildDriveCvSyncPlan — desactivaciones', () => {
  it('person_cv activo sin archivo → DEACTIVATE_MISSING (absent)', async () => {
    const ds = mockPlannerDataSource({
      activeCvs: [baseCv({ id: '99', document: '999', person_id: '50' })],
      persons: [basePerson({ id: '50', document: '999' })],
    });
    const plan = await buildDriveCvSyncPlan({
      dataSource: ds,
      files: [],
    });
    const missing = plan.items.filter((i) => i.status === 'MISSING_FROM_DRIVE');
    expect(missing).toHaveLength(1);
    expect(missing[0].action).toBe('DEACTIVATE_MISSING');
    expect(missing[0].deactivateReason).toBe('absent');
    expect(plan.summary.deactivateMissingCount).toBe(1);
  });

  it('candidato inválido: no enlaza; DEACTIVATE + invalid_candidate_detected', async () => {
    const invalid = buildDriveCvFile({
      driveFileId: 'inv',
      driveFileName: '123_Nombre.pdf',
      parentFolderId: 'p',
      folderPath: ['SERVICIO'],
    });
    expect(invalid.document).toBeNull();

    const ds = mockPlannerDataSource({
      activeCvs: [baseCv()],
      persons: [basePerson()],
    });
    const plan = await buildDriveCvSyncPlan({
      dataSource: ds,
      files: [invalid],
    });

    expect(plan.summary.byStatus.INVALID_FILENAME).toBe(1);
    const missing = plan.items.find((i) => i.status === 'MISSING_FROM_DRIVE');
    expect(missing?.action).toBe('DEACTIVATE_MISSING');
    expect(missing?.deactivateReason).toBe('invalid_filename');
    expect(missing?.reasons).toContain('invalid_candidate_detected');
    expect(missing?.invalidCandidates?.[0]?.driveFileName).toBe(
      '123_Nombre.pdf',
    );
    // No debe existir NEW/UPDATED enlazando el inválido
    expect(plan.summary.insertCount).toBe(0);
    expect(plan.summary.updateUpdatedCount).toBe(0);
  });

  it('duplicado Drive → DEACTIVATE_DUPLICATE si hay person_cv activo', async () => {
    const a = buildDriveCvFile({
      driveFileId: 'a',
      driveFileName: '1000019945.pdf',
      parentFolderId: 'p1',
      folderPath: ['SERVICIO'],
    });
    const b = buildDriveCvFile({
      driveFileId: 'b',
      driveFileName: '1000019945.pdf',
      parentFolderId: 'p2',
      folderPath: ['B2B'],
    });
    const ds = mockPlannerDataSource({
      activeCvs: [
        baseCv({
          id: '7',
          document: '1000019945',
          person_id: '70',
          drive_file_name: '1000019945.pdf',
        }),
      ],
      persons: [basePerson({ id: '70', document: '1000019945' })],
    });
    const plan = await buildDriveCvSyncPlan({
      dataSource: ds,
      files: [a, b],
    });
    const dup = plan.items.find((i) => i.status === 'DUPLICATE_DOCUMENT');
    expect(dup?.action).toBe('DEACTIVATE_DUPLICATE');
    expect(dup?.deactivateReason).toBe('duplicate_document');
    expect(plan.summary.deactivateDuplicateCount).toBe(1);
  });

  it('CORE_DOCUMENT_DUPLICATED → REPORT_ONLY (no desactiva)', async () => {
    const file = buildDriveCvFile({
      driveFileId: 'f',
      driveFileName: '555.pdf',
      parentFolderId: 'p',
      folderPath: ['SERVICIO'],
    });
    const ds = mockPlannerDataSource({
      activeCvs: [],
      persons: [
        basePerson({ id: '1', document: '555' }),
        basePerson({ id: '2', document: '555', full_name: 'Otro' }),
      ],
    });
    const plan = await buildDriveCvSyncPlan({
      dataSource: ds,
      files: [file],
    });
    const item = plan.items.find((i) => i.status === 'CORE_DOCUMENT_DUPLICATED');
    expect(item?.action).toBe('REPORT_ONLY');
    expect(plan.summary.deactivateMissingCount).toBe(0);
    expect(plan.summary.deactivateDuplicateCount).toBe(0);
  });

  it('DB_INCONSISTENCY → REPORT_ONLY (no desactiva)', async () => {
    const file = buildDriveCvFile({
      driveFileId: 'f',
      driveFileName: '123.pdf',
      parentFolderId: 'p',
      folderPath: ['SERVICIO'],
    });
    const ds = mockPlannerDataSource({
      activeCvs: [
        baseCv({ id: '1', person_id: '10' }),
        baseCv({ id: '2', person_id: '10', drive_file_id: 'other' }),
      ],
      persons: [basePerson()],
    });
    const plan = await buildDriveCvSyncPlan({
      dataSource: ds,
      files: [file],
    });
    const item = plan.items.find((i) => i.status === 'DB_INCONSISTENCY');
    expect(item?.action).toBe('REPORT_ONLY');
    expect(plan.summary.deactivateMissingCount).toBe(0);
  });

  it('con filtros: no genera desactivaciones globales', async () => {
    const scoped = buildDriveCvFile({
      driveFileId: '1',
      driveFileName: '111.pdf',
      parentFolderId: 'p',
      folderPath: ['SERVICIO'],
    });
    const ds = mockPlannerDataSource({
      activeCvs: [
        baseCv({
          id: '1',
          person_id: '10',
          document: '111',
          drive_file_name: '111.pdf',
        }),
        // Fuera del filtro: no debe desactivarse
        baseCv({
          id: '2',
          person_id: '20',
          document: '222',
          drive_file_name: '222.pdf',
        }),
      ],
      persons: [
        basePerson({ id: '10', document: '111' }),
        basePerson({ id: '20', document: '222' }),
      ],
    });
    const plan = await buildDriveCvSyncPlan({
      dataSource: ds,
      files: [scoped],
      filter: { area: 'SERVICIO' },
    });
    expect(plan.filtered).toBe(true);
    expect(plan.summary.deactivateMissingCount).toBe(0);
    expect(plan.items.some((i) => i.status === 'MISSING_FROM_DRIVE')).toBe(
      false,
    );
  });

  it('NEW first_cv vs replacement_after_inactive', async () => {
    const file = buildDriveCvFile({
      driveFileId: 'n',
      driveFileName: '888.pdf',
      parentFolderId: 'p',
      folderPath: ['SERVICIO'],
    });
    const dsFirst = mockPlannerDataSource({
      activeCvs: [],
      persons: [basePerson({ id: '88', document: '888' })],
      inactiveCounts: new Map(),
    });
    const first = await buildDriveCvSyncPlan({
      dataSource: dsFirst,
      files: [file],
    });
    expect(first.items.find((i) => i.status === 'NEW')?.reasons).toEqual([
      'first_cv',
    ]);

    const dsRepl = mockPlannerDataSource({
      activeCvs: [],
      persons: [basePerson({ id: '88', document: '888' })],
      inactiveCounts: new Map([['88', 2]]),
    });
    const repl = await buildDriveCvSyncPlan({
      dataSource: dsRepl,
      files: [file],
    });
    const newItem = repl.items.find((i) => i.status === 'NEW');
    expect(newItem?.action).toBe('INSERT');
    expect(newItem?.reasons).toContain('replacement_after_inactive');
  });

  it('proyección: activos_finales = actuales - desactivados + inserts', async () => {
    const newFile = buildDriveCvFile({
      driveFileId: 'n',
      driveFileName: '200.pdf',
      parentFolderId: 'p',
      folderPath: ['SERVICIO'],
    });
    const keep = buildDriveCvFile({
      driveFileId: 'file-a',
      driveFileName: '123.pdf',
      parentFolderId: 'parent-a',
      folderPath: ['SERVICIO'],
      driveWebUrl: 'https://drive/a',
      modifiedTime: '2026-01-01T00:00:00.000Z',
      md5Checksum: 'abc',
      fileSize: 100,
    });
    const ds = mockPlannerDataSource({
      activeCvs: [
        baseCv(),
        baseCv({ id: '2', person_id: '20', document: '999' }),
      ],
      persons: [
        basePerson(),
        basePerson({ id: '20', document: '999' }),
        basePerson({ id: '30', document: '200' }),
      ],
    });
    const plan = await buildDriveCvSyncPlan({
      dataSource: ds,
      files: [keep, newFile],
    });
    // 1 UNCHANGED (123), 1 MISSING (999), 1 NEW (200)
    expect(plan.summary.insertCount).toBe(1);
    expect(plan.summary.deactivateMissingCount).toBe(1);
    expect(plan.summary.projectedActiveAfterFullApply).toBe(2); // 2 - 1 + 1
  });
});

describe('parseDriveCvCliArgs — deactivate-missing', () => {
  it('sin flags → mode diag', () => {
    expect(parseDriveCvCliArgs([]).mode).toBe('diag');
  });

  it('dry-run y apply no pueden coexistir', () => {
    expect(() =>
      parseDriveCvCliArgs(['--dry-run', '--apply']),
    ).toThrow(/No combines/);
  });

  it('--school requiere --area', () => {
    expect(() =>
      parseDriveCvCliArgs(['--school=INGENIERIA']),
    ).toThrow(/requiere --area/);
  });

  it('parsea dry-run y apply', () => {
    expect(parseDriveCvCliArgs(['--dry-run']).mode).toBe('dry-run');
    expect(parseDriveCvCliArgs(['--apply']).mode).toBe('apply');
  });

  it('--deactivate-missing sin dry-run/apply falla', () => {
    expect(() =>
      parseDriveCvCliArgs(['--deactivate-missing']),
    ).toThrow(/solo es válido/);
  });

  it('--deactivate-missing con filtros falla', () => {
    expect(() =>
      parseDriveCvCliArgs([
        '--dry-run',
        '--deactivate-missing',
        '--area=SERVICIO',
      ]),
    ).toThrow(/no puede usarse con/);
  });

  it('--deactivate-missing con dry-run OK', () => {
    const a = parseDriveCvCliArgs(['--dry-run', '--deactivate-missing']);
    expect(a.mode).toBe('dry-run');
    expect(a.deactivateMissing).toBe(true);
  });

  it('--deactivate-missing con apply OK', () => {
    const a = parseDriveCvCliArgs(['--apply', '--deactivate-missing']);
    expect(a.mode).toBe('apply');
    expect(a.deactivateMissing).toBe(true);
  });

  it('parsea --document', () => {
    const a = parseDriveCvCliArgs(['--dry-run', '--document=1000019945']);
    expect(a.mode).toBe('dry-run');
    expect(a.document).toBe('1000019945');
  });

  it('--document inválido falla', () => {
    expect(() =>
      parseDriveCvCliArgs(['--dry-run', '--document=abc']),
    ).toThrow(/solo dígitos/);
  });

  it('--document con --deactivate-missing falla', () => {
    expect(() =>
      parseDriveCvCliArgs([
        '--dry-run',
        '--document=1000019945',
        '--deactivate-missing',
      ]),
    ).toThrow(/no puede usarse con --document/);
  });
});

describe('drive-cv-sync-writer', () => {
  it('extractReturningCount lee arrays RETURNING', () => {
    expect(extractReturningCount([{ id: '1' }])).toBe(1);
    expect(extractReturningCount([])).toBe(0);
    expect(extractReturningCount({ rowCount: 1 })).toBe(1);
  });

  it('deactivatePersonCv exige rowCount=1 y SQL is_active=FALSE', async () => {
    const queries: { sql: string; params: unknown[] }[] = [];
    const qr = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return [{ id: params[0] }];
      }),
    } as unknown as QueryRunner;

    await deactivatePersonCv(qr, {
      status: 'MISSING_FROM_DRIVE',
      action: 'DEACTIVATE_MISSING',
      document: '123',
      reasons: ['absent'],
      driveFiles: [],
      person: null,
      personCv: baseCv({ id: '42' }),
    });

    expect(queries[0].sql).toMatch(/is_active = FALSE/);
    expect(queries[0].sql).toMatch(/is_active = TRUE/);
    expect(queries[0].sql).toMatch(/RETURNING id/);
    expect(queries[0].params).toEqual(['42']);
  });

  it('deactivatePersonCv aborta si rowCount=0', async () => {
    const qr = {
      query: jest.fn(async () => []),
    } as unknown as QueryRunner;

    await expect(
      deactivatePersonCv(qr, {
        status: 'MISSING_FROM_DRIVE',
        action: 'DEACTIVATE_MISSING',
        document: '123',
        reasons: ['absent'],
        driveFiles: [],
        person: null,
        personCv: baseCv({ id: '42' }),
      }),
    ).rejects.toThrow(/rowCount=0/);
  });

  it('apply sin deactivateMissing no ejecuta DEACTIVATE', async () => {
    const executed: string[] = [];
    const qr = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async (sql: string) => {
        executed.push(sql);
        if (sql.includes('INSERT')) return [];
        return [{ id: '1' }];
      }),
    };
    const ds = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('information_schema')) {
          return [{ column_name: 'drive_relative_path' }];
        }
        return [];
      }),
      createQueryRunner: () => qr,
    } as unknown as DataSource;

    const file = buildDriveCvFile({
      driveFileId: 'n',
      driveFileName: '200.pdf',
      parentFolderId: 'p',
      folderPath: ['SERVICIO'],
    });

    const result = await applyDriveCvPlan(
      ds,
      [
        {
          status: 'NEW',
          action: 'INSERT',
          document: '200',
          reasons: ['first_cv'],
          driveFiles: [file],
          person: basePerson({ id: '30', document: '200' }),
          personCv: null,
        },
        {
          status: 'MISSING_FROM_DRIVE',
          action: 'DEACTIVATE_MISSING',
          document: '999',
          reasons: ['absent'],
          driveFiles: [],
          person: null,
          personCv: baseCv({ id: '9', document: '999' }),
        },
      ],
      { deactivateMissing: false },
    );

    expect(result.inserted).toBe(1);
    expect(result.deactivated).toBe(0);
    expect(result.deactivationsSkipped).toBe(1);
    expect(executed.some((s) => s.includes('is_active = FALSE'))).toBe(false);
  });

  it('apply con deactivateMissing desactiva y hace rollback ante error', async () => {
    const qr = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async () => []), // rowCount 0 → error
    };
    const ds = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('information_schema')) {
          return [{ column_name: 'drive_relative_path' }];
        }
        return [];
      }),
      createQueryRunner: () => qr,
    } as unknown as DataSource;

    await expect(
      applyDriveCvPlan(
        ds,
        [
          {
            status: 'MISSING_FROM_DRIVE',
            action: 'DEACTIVATE_MISSING',
            document: '999',
            reasons: ['absent'],
            driveFiles: [],
            person: null,
            personCv: baseCv({ id: '9' }),
          },
        ],
        { deactivateMissing: true },
      ),
    ).rejects.toThrow(/rowCount=0/);

    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(qr.commitTransaction).not.toHaveBeenCalled();
  });

  it('ciclo histórico: DEACTIVATE luego INSERT replacement (acciones del plan)', async () => {
    // Simula: CV activo desactivado conceptualmente; aparece archivo → NEW INSERT
    const file = buildDriveCvFile({
      driveFileId: 'new-id',
      driveFileName: '123.pdf',
      parentFolderId: 'p',
      folderPath: ['SERVICIO'],
    });
    const ds = mockPlannerDataSource({
      activeCvs: [], // ya no hay activo
      persons: [basePerson()],
      inactiveCounts: new Map([['10', 1]]),
    });
    const plan = await buildDriveCvSyncPlan({
      dataSource: ds,
      files: [file],
    });
    const neu = plan.items.find((i) => i.status === 'NEW');
    expect(neu?.action).toBe('INSERT');
    expect(neu?.reasons).toContain('replacement_after_inactive');
  });
});
