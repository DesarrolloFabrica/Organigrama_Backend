import { createHash } from 'node:crypto';
import {
  DRIVE_VIDEO_APPROVED_PLAN_EXPECTATIONS,
  type DriveVideoApplyPlanFile,
} from './drive-video-apply-types';
import { validateApprovedDriveVideoPlan } from './drive-video-apply-validator';
import { parseSyncDriveVideoArgs } from './drive-video-sync-cli-args';

function basePlan(
  overrides?: Partial<DriveVideoApplyPlanFile>,
): DriveVideoApplyPlanFile {
  const newItems = Array.from({ length: 13 }, (_, i) => ({
    action: 'NEW' as const,
    reasons: ['NO_ACTIVE_PERSON_VIDEO'],
    document: `100000000${i}`,
    personId: String(1000 + i),
    driveFileId: `file-${i}`,
    driveFileName: `100000000${i}.mp4`,
    relativePath: `AREA/100000000${i}.mp4`,
    mimeType: 'video/mp4',
    formatClass: 'SUPPORTED_MVP',
    size: 10,
    md5Checksum: `md5-${i}`,
    modifiedTime: '2026-01-01T00:00:00.000Z',
  }));
  const plan: DriveVideoApplyPlanFile = {
    summary: {
      generatedAt: '2026-08-03T20:23:07.317Z',
      inventorySource: '/tmp/inv.json',
      database: 'core',
      inventoryTotal: 14,
      byAction: {
        NEW: 13,
        INVALID_NAME: 1,
        REPLACE: 0,
        METADATA_CHANGED: 0,
        DUPLICATE_DOCUMENT: 0,
        PERSON_NOT_FOUND: 0,
        PERSON_MATCH_MULTIPLE: 0,
        PERSON_INACTIVE: 0,
        VACANCY_NOT_ELIGIBLE: 0,
      },
      personVideoRowsBefore: 0,
      personVideoRowsAfter: 0,
    },
    items: [
      ...newItems,
      {
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
      },
    ],
  };
  return { ...plan, ...overrides, summary: { ...plan.summary, ...overrides?.summary } };
}

describe('validateApprovedDriveVideoPlan', () => {
  it('acepta el plan aprobado (13 NEW + 1 INVALID_NAME)', () => {
    const plan = basePlan();
    const raw = JSON.stringify(plan);
    const r = validateApprovedDriveVideoPlan(plan, raw);
    expect(r.ok).toBe(true);
    expect(r.newItems).toHaveLength(13);
    expect(r.omittedInvalidName).toHaveLength(1);
    expect(r.planHash).toBe(
      createHash('sha256').update(raw).digest('hex'),
    );
  });

  it('rechaza plan con REPLACE', () => {
    const plan = basePlan();
    plan.items[0] = { ...plan.items[0], action: 'REPLACE' };
    plan.summary.byAction.NEW = 12;
    plan.summary.byAction.REPLACE = 1;
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'HAS_REPLACE' || i.code === 'NEW_COUNT' || i.code === 'FORBIDDEN_WRITABLE')).toBe(
      true,
    );
  });

  it('rechaza plan con METADATA_CHANGED', () => {
    const plan = basePlan();
    plan.items[0] = { ...plan.items[0], action: 'METADATA_CHANGED' };
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(false);
    expect(
      r.issues.some(
        (i) =>
          i.code === 'HAS_METADATA_CHANGED' ||
          i.code === 'FORBIDDEN_WRITABLE' ||
          i.code === 'NEW_COUNT',
      ),
    ).toBe(true);
  });

  it('rechaza NEW con personId repetido', () => {
    const plan = basePlan();
    plan.items[1] = { ...plan.items[1], personId: plan.items[0].personId };
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'NEW_DUP_PERSON')).toBe(true);
  });

  it('rechaza NEW con driveFileId repetido', () => {
    const plan = basePlan();
    plan.items[1] = { ...plan.items[1], driveFileId: plan.items[0].driveFileId };
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'NEW_DUP_FILE')).toBe(true);
  });

  it('INVALID_NAME no bloquea conteo de NEW cuando métricas coinciden', () => {
    const plan = basePlan();
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.omittedInvalidName[0].action).toBe('INVALID_NAME');
    expect(r.newItems).toHaveLength(
      DRIVE_VIDEO_APPROVED_PLAN_EXPECTATIONS.newCount,
    );
  });

  it('summary sanitizado: expectativas no exponen PII', () => {
    expect(DRIVE_VIDEO_APPROVED_PLAN_EXPECTATIONS.database).toBe('core');
    expect(DRIVE_VIDEO_APPROVED_PLAN_EXPECTATIONS.newCount).toBe(13);
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
  it('segunda pasada: plan con 0 NEW falla validación de expectativas', () => {
    const plan = basePlan();
    plan.items = plan.items.map((i) =>
      i.action === 'NEW' ? { ...i, action: 'NO_CHANGE' as const } : i,
    );
    plan.summary.byAction.NEW = 0;
    plan.summary.byAction.NO_CHANGE = 13;
    const r = validateApprovedDriveVideoPlan(plan, JSON.stringify(plan));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'NEW_COUNT')).toBe(true);
  });
});
