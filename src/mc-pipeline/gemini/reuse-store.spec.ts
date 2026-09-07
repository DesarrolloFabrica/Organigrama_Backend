import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveForceRecompute } from './gemini-force';
import {
  findReusableP1Pack,
  findReusableP3Pack,
} from './reuse-store';

function writeJson(dir: string, name: string, data: unknown) {
  writeFileSync(join(dir, name), JSON.stringify(data), 'utf8');
}

describe('reuse-store + force', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mc1-reuse-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('same fingerprint → reuse COMPLETED P1 pack', () => {
    const dir = join(root, 'P1P-V11-6I-S19-ok');
    mkdirSync(dir);
    writeJson(dir, 'prototype-manifest.json', {
      snapshotId: '19',
      reuseFingerprint: 'fp-same',
    });
    writeJson(dir, 'execution-summary.json', { status: 'COMPLETED' });
    writeJson(dir, 'validated-evidence.json', { units: [] });
    const hit = findReusableP1Pack({
      searchRoot: root,
      snapshotId: '19',
      reuseFingerprint: 'fp-same',
    });
    expect(hit?.dir).toBe(dir);
    expect(hit?.artifactId).toBe('P1P-V11-6I-S19-ok');
  });

  it('FAILED / PARTIAL result → no reuse', () => {
    const failed = join(root, 'P1P-V11-6I-S19-fail');
    mkdirSync(failed);
    writeJson(failed, 'prototype-manifest.json', {
      snapshotId: '19',
      reuseFingerprint: 'fp-fail',
    });
    writeJson(failed, 'execution-summary.json', { status: 'FAILED' });
    writeJson(failed, 'validated-evidence.json', { units: [] });
    expect(
      findReusableP1Pack({
        searchRoot: root,
        snapshotId: '19',
        reuseFingerprint: 'fp-fail',
      }),
    ).toBeNull();

    const partial = join(root, 'P1P-V11-6I-S19-partial');
    mkdirSync(partial);
    writeJson(partial, 'prototype-manifest.json', {
      snapshotId: '19',
      reuseFingerprint: 'fp-partial',
    });
    writeJson(partial, 'execution-summary.json', { status: 'PARTIAL' });
    writeJson(partial, 'validated-evidence.json', { units: [] });
    expect(
      findReusableP1Pack({
        searchRoot: root,
        snapshotId: '19',
        reuseFingerprint: 'fp-partial',
      }),
    ).toBeNull();
  });

  it('pack without fingerprint → no reuse', () => {
    const dir = join(root, 'P1P-V11-6I-S19-legacy');
    mkdirSync(dir);
    writeJson(dir, 'prototype-manifest.json', { snapshotId: '19' });
    writeJson(dir, 'execution-summary.json', { status: 'COMPLETED' });
    writeJson(dir, 'validated-evidence.json', { units: [] });
    expect(
      findReusableP1Pack({
        searchRoot: root,
        snapshotId: '19',
        reuseFingerprint: 'fp-new',
      }),
    ).toBeNull();
  });

  it('discarded pack → no reuse', () => {
    const dir = join(root, 'P3F-8B2-S19-disc');
    mkdirSync(dir);
    writeJson(dir, 'manifest.json', {
      snapshotId: '19',
      reuseFingerprint: 'fp-p3',
      discarded: true,
      outcomeStatus: 'COMPLETED',
    });
    writeJson(dir, 'p3-contract.json', {});
    expect(
      findReusableP3Pack({
        searchRoot: root,
        snapshotId: '19',
        reuseFingerprint: 'fp-p3',
      }),
    ).toBeNull();
  });

  it('forceRecompute is opt-in and ignores --force-live-ai', () => {
    const argv = process.argv;
    process.argv = ['node', 'script.ts', '--force-live-ai'];
    try {
      expect(resolveForceRecompute()).toBe(false);
      expect(resolveForceRecompute(true)).toBe(true);
      expect(resolveForceRecompute(false)).toBe(false);
    } finally {
      process.argv = argv;
    }
    process.argv = ['node', 'script.ts', '--force'];
    try {
      expect(resolveForceRecompute()).toBe(true);
    } finally {
      process.argv = argv;
    }
  });
});
