/**
 * Búsqueda de packs reutilizables por reuseFingerprint.
 * No reutiliza FAILED/PARTIAL ni packs sin fingerprint (pre-ledger).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

export type ReusablePackHit = {
  dir: string;
  artifactId: string;
  reuseFingerprint: string;
  snapshotId: string;
};

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isFailedOutcome(status: unknown): boolean {
  const s = String(status ?? '').toUpperCase();
  return (
    s === 'FAILED' ||
    s === 'PARTIAL' ||
    s === 'INVALID' ||
    s === 'BLOCKED' ||
    s === 'VALIDATION_FAILED'
  );
}

export function findReusablePack(args: {
  searchRoot: string;
  snapshotId: string;
  reuseFingerprint: string;
  namePredicate: (name: string) => boolean;
  manifestName?: string;
  extraOk?: (dir: string, manifest: Record<string, unknown>) => boolean;
}): ReusablePackHit | null {
  if (!existsSync(args.searchRoot)) return null;
  const manifestName = args.manifestName ?? 'manifest.json';
  const hits: Array<ReusablePackHit & { mtime: number }> = [];
  for (const name of readdirSync(args.searchRoot)) {
    if (!args.namePredicate(name)) continue;
    const dir = join(args.searchRoot, name);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    const manifest = readJson(join(dir, manifestName));
    if (!manifest) continue;
    if (String(manifest.snapshotId ?? '') !== String(args.snapshotId)) continue;
    if (String(manifest.reuseFingerprint ?? '') !== args.reuseFingerprint) {
      continue;
    }
    if (manifest.discarded === true) continue;
    if (isFailedOutcome(manifest.status ?? manifest.outcomeStatus)) continue;
    if (args.extraOk && !args.extraOk(dir, manifest)) continue;
    hits.push({
      dir,
      artifactId: basename(dir),
      reuseFingerprint: args.reuseFingerprint,
      snapshotId: String(args.snapshotId),
      mtime: statSync(dir).mtimeMs,
    });
  }
  hits.sort((a, b) => a.mtime - b.mtime);
  const last = hits[hits.length - 1];
  return last
    ? {
        dir: last.dir,
        artifactId: last.artifactId,
        reuseFingerprint: last.reuseFingerprint,
        snapshotId: last.snapshotId,
      }
    : null;
}

export function findReusableP1Pack(args: {
  searchRoot: string;
  snapshotId: string;
  reuseFingerprint: string;
}): ReusablePackHit | null {
  return findReusablePack({
    ...args,
    namePredicate: (n) => n.startsWith('P1P-'),
    manifestName: 'prototype-manifest.json',
    extraOk: (dir, manifest) => {
      const summary = readJson(join(dir, 'execution-summary.json'));
      if (!summary) return false;
      if (String(summary.status) !== 'COMPLETED') return false;
      if (isFailedOutcome(manifest.status)) return false;
      return existsSync(join(dir, 'validated-evidence.json'));
    },
  });
}

export function findReusableP2Pack(args: {
  searchRoot: string;
  snapshotId: string;
  reuseFingerprint: string;
}): ReusablePackHit | null {
  return findReusablePack({
    ...args,
    namePredicate: (n) => n.startsWith('P2F-'),
    extraOk: (dir) => existsSync(join(dir, 'p2-contract.json')),
  });
}

export function findReusableP3Pack(args: {
  searchRoot: string;
  snapshotId: string;
  reuseFingerprint: string;
}): ReusablePackHit | null {
  return findReusablePack({
    ...args,
    namePredicate: (n) => n.startsWith('P3F-'),
    extraOk: (dir) => existsSync(join(dir, 'p3-contract.json')),
  });
}

export function findReusableP4Pack(args: {
  searchRoot: string;
  snapshotId: string;
  reuseFingerprint: string;
}): ReusablePackHit | null {
  return findReusablePack({
    ...args,
    namePredicate: (n) => n.startsWith('P4F-'),
    extraOk: (dir) => existsSync(join(dir, 'p4-contract.json')),
  });
}

/** Identidad de resultado P3 para fingerprint P4. Vacío si el pack es pre-ledger. */
export function readManifestReuseFingerprint(
  packDir: string,
  manifestName = 'manifest.json',
): string {
  const manifest = readJson(join(packDir, manifestName));
  const fp = manifest?.reuseFingerprint;
  return typeof fp === 'string' && fp.trim() ? fp : '';
}
