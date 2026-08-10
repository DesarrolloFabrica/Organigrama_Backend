import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { writeR1ArtifactPack } from './r1-artifact-writer';
import { resolveR1FromP2 } from './r1-resolver';
import type { P2ContractView, R1ContractEnvelope } from './r1.types';

export type R1RunResult = {
  envelope: R1ContractEnvelope;
  outDir: string;
  p2PackDir: string;
};

export function findLatestP2Pack(
  backendRoot: string,
  snapshotId: string,
): string | null {
  const root = resolve(backendRoot, 'tmp', 'mc1-p2-functional');
  if (!existsSync(root)) return null;
  // Prefer identity-corrected packs (8A.2), then frozen-catalog 7F; never overwrite history.
  const prefixes = [
    `P2F-8A2-S${snapshotId}-`,
    `P2F-7F-S${snapshotId}-`,
    `P2F-7D-S${snapshotId}-`,
  ];
  for (const prefix of prefixes) {
    const dirs = readdirSync(root)
      .filter((n) => n.startsWith(prefix))
      .map((n) => join(root, n))
      .filter((p) => statSync(p).isDirectory())
      .sort();
    if (dirs.length) return dirs[dirs.length - 1];
  }
  return null;
}

export function loadP2Contract(packDir: string): P2ContractView {
  const path = join(packDir, 'p2-contract.json');
  if (!existsSync(path)) {
    throw new Error(`missing p2-contract.json in ${packDir}`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as P2ContractView;
}

/**
 * Runner R1 ARTIFACT_ONLY — lee contrato P2, resuelve, escribe artefactos.
 * Sin IA / sin CV / sin Evidence Units.
 */
export function runR1ArtifactOnly(args: {
  backendRoot: string;
  snapshotId: string;
  p2PackDir?: string;
  outRoot?: string;
}): R1RunResult {
  const p2PackDir =
    args.p2PackDir ?? findLatestP2Pack(args.backendRoot, args.snapshotId);
  if (!p2PackDir) {
    throw new Error(`no P2 pack for snapshot ${args.snapshotId}`);
  }

  const p2 = loadP2Contract(p2PackDir);
  if (String(p2.payload.snapshotId) !== String(args.snapshotId)) {
    throw new Error(
      `p2 snapshot mismatch: pack=${p2.payload.snapshotId} expected=${args.snapshotId}`,
    );
  }

  const { envelope } = resolveR1FromP2(p2);

  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const outRoot =
    args.outRoot ?? resolve(args.backendRoot, 'tmp', 'mc1-r1-functional');
  const outDir = join(
    outRoot,
    `R1F-8A2-S${args.snapshotId}-${stamp}-${envelope.payload.p2ExecutionId.slice(0, 8)}`,
  );

  writeR1ArtifactPack({ outDir, envelope, p2PackDir });

  return { envelope, outDir, p2PackDir };
}
