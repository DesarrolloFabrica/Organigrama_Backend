import { createHash } from 'node:crypto';
import {
  DRIVE_VIDEO_APPLY_DESTINATION,
  DRIVE_VIDEO_APPROVED_PLAN_EXPECTATIONS,
  type DriveVideoApplyPlanFile,
  type DriveVideoApplyPlanItem,
} from './drive-video-apply-types';
import {
  validateApprovedDriveVideoPlan,
  validatePersonVideoRowSnapshot,
} from './drive-video-apply-validator';
import { parseSyncDriveVideoArgs } from './drive-video-sync-cli-args';
import { applyNewPersonVideosInTransaction } from './drive-video-sync-writer';
import { emptyActionCounts } from './drive-video-plan-types';

function makeNewItem(
  i: number,
  overrides?: Partial<DriveVideoApplyPlanItem>,
): DriveVideoApplyPlanItem {
  return {
    action: 'NEW',
    reasons: ['NO_ACTIVE_PERSON_VIDEO'],
    document: `100000000${i}`,
    personId: String(1000 + i),
    driveFileId: `file-${i}`,
    driveFileName: `100000000${i}-presentacion.mp4`,
    relativePath: `AREA/100000000${i}-presentacion.mp4`,
    mimeType: 'video/mp4',
    formatClass: 'SUPPORTED_MVP',
    size: 10,
    md5Checksum: `md5-${i}`,
    modifiedTime: '2026-01-01T00:00:00.000Z',
    personMatch: 'PERSON_MATCH_UNIQUE',
    eligibility: 'ELIGIBLE_PERSON',
    activeVideoId: null,
    ...overrides,
  };
}

function finalizePlan(
  items: DriveVideoApplyPlanItem[],
  rowsBefore: number,
  extraSummary?: Partial<DriveVideoApplyPlanFile['summary']>,
): DriveVideoApplyPlanFile {
  const byAction = emptyActionCounts();
  for (const it of items) {
    byAction[it.action] += 1;
  }
  const newCount = byAction.NEW;
  const replaceCount = byAction.REPLACE;
  const metaCount = byAction.METADATA_CHANGED;
  const noChange = byAction.NO_CHANGE;
  const invalidName = byAction.INVALID_NAME;
  return {
    summary: {
      generatedAt: '2026-08-05T12:00:00.000Z',
      inventorySource: '/tmp/inv.json',
      database: 'core',
      inventoryTotal: items.length,
      validNames: items.length - invalidName,
      invalidNames: invalidName,
      personsFound: items.filter((i) => i.personId != null).length,
      personsNotFound: byAction.PERSON_NOT_FOUND,
      personsAmbiguous: byAction.PERSON_MATCH_MULTIPLE,
      personsInactive: byAction.PERSON_INACTIVE,
      vacanciesExcluded: byAction.VACANCY_NOT_ELIGIBLE,
      byAction,
      writableWouldBe: {
        new: newCount,
        replace: replaceCount,
        metadataChanged: metaCount,
      },
      blockedOrReportOnly:
        items.length - newCount - noChange - replaceCount - metaCount,
      personVideoRowsBefore: rowsBefore,
      personVideoRowsAfter: rowsBefore,
      ...extraSummary,
    },
    items,
  };
}

function fullInitialPlan(): DriveVideoApplyPlanFile {
  const newItems = Array.from({ length: 13 }, (_, i) => makeNewItem(i));
  const invalid: DriveVideoApplyPlanItem = {
    action: 'INVALID_NAME',
    reasons: ['INVALID_PATTERN'],
    document: null,
    personId: null,
    driveFileId: 'bad-file',
    driveFileName: '1000810767',
    relativePath: 'AREA/1000810767',
    mimeType: 'video/mp4',
    formatClass: 'SUPPORTED_MVP',
    size: 1,
    md5Checksum: 'x',
    modifiedTime: null,
    renameHint: '1000810767-presentacion.mp4',
  };
  return finalizePlan([...newItems, invalid], 0);
}

function partialOneNewPlan(rowsBefore = 13): DriveVideoApplyPlanFile {
  return finalizePlan(
    [
      makeNewItem(0, {
        document: '1000810767',
        personId: '2001',
        driveFileId: 'file-1000810767',
        driveFileName: '1000810767-presentacion.mp4',
        relativePath: 'AREA/1000810767-presentacion.mp4',
      }),
    ],
    rowsBefore,
  );
}

describe('validateApprovedDriveVideoPlan (incremental-safe)', () => {
  it('acepta plan completo coherente (13 NEW + 1 INVALID_NAME, rowsBefore=0)', () => {
    const plan = fullInitialPlan();
    const raw = JSON.stringify(plan);
    const r = validateApprovedDriveVideoPlan(plan, raw);
    expect(r.ok).toBe(true);
    expect(r.newItems).toHaveLength(13);
    expect(r.omittedInvalidName).toHaveLength(1);
    expect(r.planHash).toBe(createHash('sha256').update(raw).digest('hex'));
  });

  it('acepta plan parcial de 1 NEW con tabla previamente poblada (rowsBefore=13)', () => {
    const plan = partialOneNewPlan(13);
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(true);
    expect(r.newItems).toHaveLength(1);
    expect(plan.summary.inventoryTotal).toBe(1);
    expect(plan.summary.personVideoRowsBefore).toBe(13);
  });

  it('acepta plan parcial NEW + INVALID_NAME', () => {
    const plan = finalizePlan(
      [
        makeNewItem(1),
        {
          action: 'INVALID_NAME',
          reasons: ['INVALID_PATTERN'],
          document: null,
          personId: null,
          driveFileId: 'bad',
          driveFileName: 'x',
          relativePath: 'x',
          mimeType: 'video/mp4',
          formatClass: 'SUPPORTED_MVP',
          size: 1,
          md5Checksum: null,
          modifiedTime: null,
        },
      ],
      13,
    );
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(true);
    expect(r.newItems).toHaveLength(1);
    expect(r.omittedInvalidName).toHaveLength(1);
  });

  it('rechaza inventoryTotal !== items.length', () => {
    const plan = partialOneNewPlan(13);
    plan.summary.inventoryTotal = 99;
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'INVENTORY_TOTAL_MISMATCH')).toBe(
      true,
    );
  });

  it('rechaza byAction inconsistente', () => {
    const plan = partialOneNewPlan(13);
    plan.summary.byAction.NEW = 0;
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'SUMMARY_BY_ACTION_MISMATCH')).toBe(
      true,
    );
  });

  it('rechaza NEW con personId duplicado', () => {
    const plan = finalizePlan(
      [makeNewItem(0), makeNewItem(1, { personId: makeNewItem(0).personId })],
      13,
    );
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'NEW_DUP_PERSON')).toBe(true);
  });

  it('rechaza NEW con driveFileId duplicado', () => {
    const plan = finalizePlan(
      [
        makeNewItem(0),
        makeNewItem(1, { driveFileId: makeNewItem(0).driveFileId }),
      ],
      13,
    );
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'NEW_DUP_FILE')).toBe(true);
  });

  it('rechaza NEW=0 con NO_WRITABLE_NEW', () => {
    const plan = finalizePlan(
      [
        makeNewItem(0, {
          action: 'NO_CHANGE',
          reasons: ['SAME_ACTIVE'],
          activeVideoId: 'vid-1',
        }),
      ],
      14,
    );
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'NO_WRITABLE_NEW')).toBe(true);
  });

  it('rechaza REPLACE', () => {
    const plan = finalizePlan(
      [makeNewItem(0, { action: 'REPLACE', reasons: ['DIFF_FILE'] })],
      13,
    );
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(false);
    expect(
      r.issues.some(
        (i) =>
          i.code === 'FORBIDDEN_ACTION' ||
          i.code === 'FORBIDDEN_WRITABLE' ||
          i.code === 'NO_WRITABLE_NEW',
      ),
    ).toBe(true);
  });

  it('rechaza METADATA_CHANGED', () => {
    const plan = finalizePlan(
      [
        makeNewItem(0, {
          action: 'METADATA_CHANGED',
          reasons: ['NAME'],
        }),
      ],
      13,
    );
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(false);
    expect(
      r.issues.some(
        (i) =>
          i.code === 'FORBIDDEN_ACTION' || i.code === 'FORBIDDEN_WRITABLE',
      ),
    ).toBe(true);
  });

  it('rechaza URL pública en NEW', () => {
    const plan = finalizePlan(
      [
        makeNewItem(0, {
          relativePath: 'https://drive.google.com/file/d/xxx',
        }),
      ],
      13,
    );
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'NEW_PUBLIC_URL')).toBe(true);
  });

  it('mensajes de validación no exponen documento completo en mismatches de summary', () => {
    const plan = partialOneNewPlan(13);
    plan.summary.byAction.NEW = 9;
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    const blob = r.issues.map((i) => i.message).join('|');
    expect(blob).not.toMatch(/1000810767/);
  });

  it('destino estable database=core; sin métricas fijas 14/13/1/0', () => {
    expect(DRIVE_VIDEO_APPLY_DESTINATION.database).toBe('core');
    expect(DRIVE_VIDEO_APPROVED_PLAN_EXPECTATIONS.database).toBe('core');
    expect(
      Object.keys(DRIVE_VIDEO_APPROVED_PLAN_EXPECTATIONS),
    ).toEqual(['database']);
  });
});

describe('validatePersonVideoRowSnapshot', () => {
  it('acepta tabla poblada si live === plan.personVideoRowsBefore', () => {
    expect(validatePersonVideoRowSnapshot(13, 13)).toBeNull();
    expect(validatePersonVideoRowSnapshot(0, 0)).toBeNull();
  });

  it('rechaza snapshot stale solo con conteos (sin PII)', () => {
    const issue = validatePersonVideoRowSnapshot(14, 13);
    expect(issue).not.toBeNull();
    expect(issue!.code).toBe('PLAN_SNAPSHOT_STALE');
    expect(issue!.message).toBe(
      'person_video filas live=14, plan generado con filas=13',
    );
    expect(issue!.message).not.toMatch(/1000|document|@/);
  });
});

describe('parseSyncDriveVideoArgs', () => {
  it('rechaza solo --execute', () => {
    expect(() => parseSyncDriveVideoArgs(['--execute'])).toThrow(/AMBOS flags/i);
  });

  it('rechaza solo --confirm-cloud-video-sync', () => {
    expect(() =>
      parseSyncDriveVideoArgs(['--confirm-cloud-video-sync']),
    ).toThrow(/AMBOS flags/i);
  });

  it('dry-run por defecto', () => {
    const a = parseSyncDriveVideoArgs([]);
    expect(a.dryRun).toBe(true);
    expect(a.execute).toBe(false);
  });

  it('ambos flags habilitan escritura', () => {
    const a = parseSyncDriveVideoArgs([
      '--execute',
      '--confirm-cloud-video-sync',
    ]);
    expect(a.dryRun).toBe(false);
    expect(a.execute).toBe(true);
  });

  it('rechaza flags CV', () => {
    expect(() => parseSyncDriveVideoArgs(['--folderId=x'])).toThrow();
  });
});

describe('idempotencia conceptual', () => {
  it('plan regenerado con NO_CHANGE → NO_WRITABLE_NEW', () => {
    const plan = finalizePlan(
      [
        makeNewItem(0, {
          action: 'NO_CHANGE',
          reasons: ['SAME_ACTIVE_VIDEO'],
          activeVideoId: 'v1',
        }),
      ],
      14,
    );
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'NO_WRITABLE_NEW')).toBe(true);
  });

  it('mismo plan parcial válido pasa precheck estructural (READY candidate)', () => {
    const plan = partialOneNewPlan(13);
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(true);
    expect(r.newItems).toHaveLength(1);
  });
});

describe('applyNewPersonVideosInTransaction (mock pg)', () => {
  function mockClient(opts: {
    failOnPersonId?: string;
    activePersonIds?: Set<string>;
    linkedFileIds?: Set<string>;
  }) {
    const meta = {
      queries: [] as string[],
      began: false,
      committed: false,
      rolledBack: false,
    };
    const client = {
      _meta: meta,
      async query(sql: string, params?: unknown[]) {
        meta.queries.push(sql);
        const s = sql.replace(/\s+/g, ' ').trim();
        if (s === 'BEGIN') {
          meta.began = true;
          return { rows: [], rowCount: 0 };
        }
        if (s === 'COMMIT') {
          meta.committed = true;
          return { rows: [], rowCount: 0 };
        }
        if (s === 'ROLLBACK') {
          meta.rolledBack = true;
          return { rows: [], rowCount: 0 };
        }
        if (s.includes('FROM organigrama.person_video') && s.includes('count(*)')) {
          return { rows: [{ c: '13' }], rowCount: 1 };
        }
        if (s.includes('FROM core.person') && s.includes('FOR UPDATE')) {
          const personId = String(params?.[0]);
          if (opts.failOnPersonId === personId) {
            return { rows: [], rowCount: 0 };
          }
          return {
            rows: [
              {
                id: personId,
                document:
                  personId === '2001' ? '1000810767' : `doc-${personId}`,
                is_active: true,
                role_name: 'ANALISTA',
                full_name: 'Test Person',
              },
            ],
            rowCount: 1,
          };
        }
        if (
          s.includes('FROM organigrama.person_video') &&
          s.includes('is_active = TRUE') &&
          s.includes('person_id')
        ) {
          const personId = String(params?.[0]);
          if (opts.activePersonIds?.has(personId)) {
            return { rows: [{ id: 'v-active' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }
        if (
          s.includes('FROM organigrama.person_video') &&
          s.includes('drive_file_id')
        ) {
          const fileId = String(params?.[0]);
          if (opts.linkedFileIds?.has(fileId)) {
            return {
              rows: [{ id: 'v-linked', person_id: 'x' }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }
        if (s.startsWith('INSERT INTO organigrama.person_video')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    return client as unknown as import('pg').Client & { _meta: typeof meta };
  }

  it('rollback total si uno de varios NEW falla', async () => {
    const items = [
      makeNewItem(0, {
        personId: '2001',
        document: '1000810767',
        driveFileId: 'f1',
      }),
      makeNewItem(1, {
        personId: '2002',
        document: 'doc-2002',
        driveFileId: 'f2',
      }),
    ];
    const client = mockClient({ failOnPersonId: '2002' });
    await expect(
      applyNewPersonVideosInTransaction(client, items, new Map()),
    ).rejects.toThrow(/Persona ausente/);
    expect(client._meta.began).toBe(true);
    expect(client._meta.rolledBack).toBe(true);
    expect(client._meta.committed).toBe(false);
  });

  it('rechaza persona con video activo (idempotencia writer)', async () => {
    const items = [
      makeNewItem(0, {
        personId: '2001',
        document: '1000810767',
        driveFileId: 'f1',
      }),
    ];
    const client = mockClient({
      activePersonIds: new Set(['2001']),
    });
    await expect(
      applyNewPersonVideosInTransaction(client, items, new Map()),
    ).rejects.toThrow(/Ya existe video activo/);
  });

  it('rechaza drive_file_id ya registrado', async () => {
    const items = [
      makeNewItem(0, {
        personId: '2001',
        document: '1000810767',
        driveFileId: 'f-dup',
      }),
    ];
    const client = mockClient({
      linkedFileIds: new Set(['f-dup']),
    });
    await expect(
      applyNewPersonVideosInTransaction(client, items, new Map()),
    ).rejects.toThrow(/drive_file_id ya registrado/);
  });
});
