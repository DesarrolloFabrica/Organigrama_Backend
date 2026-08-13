import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import {
  isKnownSpecialtyCode,
  SPECIALTY_CATALOG_VERSION,
} from '../catalog/specialties-visual-education';
import {
  loadP2EvidenceFromP1Pack,
  type P2LoadedEvidence,
} from '../p2/p2-evidence-loader';
import { findLatestR1Pack, loadR1Contract } from '../p3/p3-context-loader';
import type { R1ContractEnvelope } from '../r1/r1.types';
import type { P3ContractEnvelope } from '../p3/p3.types';
import type { P4SpecialtyEvaluated } from './p4.types';

export type P4LoadedContext = {
  snapshotId: string;
  r1PackDir: string;
  p3PackDir: string;
  r1: R1ContractEnvelope;
  p3: P3ContractEnvelope;
  specialtiesEvaluated: P4SpecialtyEvaluated[];
  evidence: P2LoadedEvidence;
  warningCodes: string[];
};

export function newP4ExecutionId(): string {
  return randomUUID();
}

export function fingerprintP4Config(parts: Record<string, string>): string {
  const ordered = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k]}`)
    .join('|');
  return createHash('sha256').update(ordered, 'utf8').digest('hex');
}

export function findLatestP3Pack(
  backendRoot: string,
  snapshotId: string,
): string | null {
  const root = resolve(backendRoot, 'tmp', 'mc1-p3-functional');
  if (!existsSync(root)) return null;
  const prefixes = [
    `P3F-8B2-S${snapshotId}-`,
    `P3F-8B-S${snapshotId}-`,
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

export function loadP3Contract(packDir: string): P3ContractEnvelope {
  const path = join(packDir, 'p3-contract.json');
  if (!existsSync(path)) {
    throw new Error(`missing p3-contract.json in ${packDir}`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as P3ContractEnvelope;
}

/**
 * Resuelve destinos P4 desde P3:
 * - OBSERVED → AUTHORITATIVE_TARGET (publishableFromP3)
 * - WEAK → ROUTING_CANDIDATE (no publishable)
 * - NOT_EMITTED / otros → no entran
 *
 * Abstención P4 si no hay ningún AUTHORITATIVE_TARGET (WEAK-only no activa P4).
 */
export function resolveP4SpecialtiesEvaluated(
  p3: P3ContractEnvelope,
): P4SpecialtyEvaluated[] {
  const out: P4SpecialtyEvaluated[] = [];
  const seen = new Set<string>();
  for (const fr of p3.payload.fieldResults ?? []) {
    for (const s of fr.observedSpecialties ?? []) {
      if (s.status !== 'OBSERVED' && s.status !== 'WEAK') continue;
      if (!isKnownSpecialtyCode(s.specialtyCode)) continue;
      if (s.parentFieldCode !== fr.fieldCode) continue;
      const key = `${fr.fieldCode}::${s.specialtyCode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const isObserved = s.status === 'OBSERVED';
      out.push({
        fieldCode: fr.fieldCode,
        specialtyCode: s.specialtyCode,
        p3Status: s.status,
        p3Confidence: s.confidence,
        evaluationRole: isObserved
          ? 'AUTHORITATIVE_TARGET'
          : 'ROUTING_CANDIDATE',
        routingEligible: true,
        publishableFromP3: isObserved,
      });
    }
  }
  return out;
}

/**
 * @deprecated Prefer resolveP4SpecialtiesEvaluated — kept for call sites that
 * historically meant "OBSERVED only". Now returns OBSERVED + WEAK routing.
 */
export function resolveObservedSpecialties(
  p3: P3ContractEnvelope,
): P4SpecialtyEvaluated[] {
  return resolveP4SpecialtiesEvaluated(p3);
}

export function authoritativeTargetsOnly(
  specialties: P4SpecialtyEvaluated[],
): P4SpecialtyEvaluated[] {
  return specialties.filter((s) => s.evaluationRole === 'AUTHORITATIVE_TARGET');
}

export async function loadP4Context(args: {
  backendRoot: string;
  snapshotId: string;
  dataSource: DataSource;
  r1PackDir?: string;
  p3PackDir?: string;
}): Promise<P4LoadedContext> {
  const r1PackDir =
    args.r1PackDir ?? findLatestR1Pack(args.backendRoot, args.snapshotId);
  if (!r1PackDir) {
    throw new Error(`no R1 pack for snapshot ${args.snapshotId}`);
  }
  const p3PackDir =
    args.p3PackDir ?? findLatestP3Pack(args.backendRoot, args.snapshotId);
  if (!p3PackDir) {
    throw new Error(`no P3 pack for snapshot ${args.snapshotId}`);
  }

  const r1 = loadR1Contract(r1PackDir);
  const p3 = loadP3Contract(p3PackDir);

  if (String(r1.payload.snapshotId) !== String(args.snapshotId)) {
    throw new Error(
      `r1 snapshot mismatch: pack=${r1.payload.snapshotId} expected=${args.snapshotId}`,
    );
  }
  if (String(p3.payload.snapshotId) !== String(args.snapshotId)) {
    throw new Error(
      `p3 snapshot mismatch: pack=${p3.payload.snapshotId} expected=${args.snapshotId}`,
    );
  }
  if (p3.payload.specialtyCatalogVersion !== SPECIALTY_CATALOG_VERSION) {
    // Soft warn — still proceed if specialties resolve
  }

  const specialtiesEvaluated = resolveP4SpecialtiesEvaluated(p3);
  const evidence = await loadP2EvidenceFromP1Pack({
    backendRoot: args.backendRoot,
    snapshotId: args.snapshotId,
    dataSource: args.dataSource,
  });

  const warningCodes = [
    'INPUT_SOURCE_R1_P3_PLUS_P1_PACK_ARTIFACT_ONLY',
    'SPECIALTY_CATALOG_ACTIVE_V1_3_0',
    'P3_OBSERVED_AUTHORITATIVE_AND_WEAK_ROUTING_CANDIDATES',
    ...evidence.warningCodes.filter((w) => w.startsWith('CANONICAL_')),
  ];
  if (p3.payload.specialtyCatalogVersion !== SPECIALTY_CATALOG_VERSION) {
    warningCodes.push('P3_SPECIALTY_CATALOG_VERSION_MISMATCH');
  }

  return {
    snapshotId: args.snapshotId,
    r1PackDir,
    p3PackDir,
    r1,
    p3,
    specialtiesEvaluated,
    evidence,
    warningCodes,
  };
}
