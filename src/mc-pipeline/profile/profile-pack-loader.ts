import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findLatestR1Pack, loadR1Contract } from '../p3/p3-context-loader';
import { findLatestP3Pack, loadP3Contract } from '../p4/p4-context-loader';
import type { R1ContractEnvelope } from '../r1/r1.types';
import type { P3ContractEnvelope } from '../p3/p3.types';
import type { P4ContractEnvelope, P4ObservedSkill } from '../p4/p4.types';

export function findLatestP4Pack(
  backendRoot: string,
  snapshotId: string,
): string | null {
  const root = resolve(backendRoot, 'tmp', 'mc1-p4-functional');
  if (!existsSync(root)) return null;
  const prefix = `P4F-8D-S${snapshotId}-`;
  const dirs = readdirSync(root)
    .filter((n) => n.startsWith(prefix))
    .map((n) => join(root, n))
    .filter((p) => statSync(p).isDirectory())
    .sort();
  return dirs.length ? dirs[dirs.length - 1] : null;
}

export function loadP4Contract(packDir: string): P4ContractEnvelope {
  const path = join(packDir, 'p4-contract.json');
  if (!existsSync(path)) {
    throw new Error(`missing p4-contract.json in ${packDir}`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as P4ContractEnvelope;
}

export type ProfileSourcePacks = {
  snapshotId: string;
  r1PackDir: string;
  p3PackDir: string;
  p4PackDir: string;
  r1: R1ContractEnvelope;
  p3: P3ContractEnvelope;
  p4: P4ContractEnvelope;
};

export function loadProfileSourcePacks(args: {
  backendRoot: string;
  snapshotId: string;
  r1PackDir?: string;
  p3PackDir?: string;
  p4PackDir?: string;
}): ProfileSourcePacks {
  const r1PackDir =
    args.r1PackDir ?? findLatestR1Pack(args.backendRoot, args.snapshotId);
  const p3PackDir =
    args.p3PackDir ?? findLatestP3Pack(args.backendRoot, args.snapshotId);
  const p4PackDir =
    args.p4PackDir ?? findLatestP4Pack(args.backendRoot, args.snapshotId);
  if (!r1PackDir) throw new Error(`no R1 pack for snapshot ${args.snapshotId}`);
  if (!p3PackDir) throw new Error(`no P3 pack for snapshot ${args.snapshotId}`);
  if (!p4PackDir) throw new Error(`no P4 pack for snapshot ${args.snapshotId}`);

  const r1 = loadR1Contract(r1PackDir);
  const p3 = loadP3Contract(p3PackDir);
  const p4 = loadP4Contract(p4PackDir);

  for (const [label, sid] of [
    ['r1', r1.payload.snapshotId],
    ['p3', p3.payload.snapshotId],
    ['p4', p4.payload.snapshotId],
  ] as const) {
    if (String(sid) !== String(args.snapshotId)) {
      throw new Error(
        `${label} snapshot mismatch: pack=${sid} expected=${args.snapshotId}`,
      );
    }
  }

  return {
    snapshotId: args.snapshotId,
    r1PackDir,
    p3PackDir,
    p4PackDir,
    r1,
    p3,
    p4,
  };
}

export function listObservedP3Specialties(p3: P3ContractEnvelope): Array<{
  fieldCode: string;
  specialtyCode: string;
  confidence: number;
}> {
  const out: Array<{
    fieldCode: string;
    specialtyCode: string;
    confidence: number;
  }> = [];
  for (const fr of p3.payload.fieldResults ?? []) {
    for (const s of fr.observedSpecialties ?? []) {
      if (s.status !== 'OBSERVED') continue;
      out.push({
        fieldCode: fr.fieldCode,
        specialtyCode: s.specialtyCode,
        confidence: s.confidence,
      });
    }
  }
  return out;
}

/**
 * Skills P4 OBSERVED eligible for public Profile / radar.
 *
 * FASE 12I filter (applied HERE — not in mapper 12E):
 * parentSpecialtyCode must be a P3 OBSERVED specialty for the same field.
 * Skills parented only under P3 WEAK (ROUTING_CANDIDATE) remain in the P4
 * artifact but must not alter the public radar or publishable skill list.
 */
export function listObservedP4Skills(
  p4: P4ContractEnvelope,
  observedP3Specialties?: Array<{ fieldCode: string; specialtyCode: string }>,
): P4ObservedSkill[] {
  const observedKeys =
    observedP3Specialties === undefined
      ? null
      : new Set(
          observedP3Specialties.map(
            (s) => `${s.fieldCode}::${s.specialtyCode}`,
          ),
        );
  const out: P4ObservedSkill[] = [];
  for (const sr of p4.payload.specialtyResults ?? []) {
    for (const sk of sr.observedSkills ?? []) {
      if (sk.status !== 'OBSERVED') continue;
      if (observedKeys) {
        const key = `${sk.parentFieldCode}::${sk.parentSpecialtyCode}`;
        if (!observedKeys.has(key)) continue;
      }
      out.push(sk);
    }
  }
  return out;
}

export type EvidenceExplicitnessIndex = Map<string, string>;

/** Índice opcional evidenceUnitId → explicitness (si se carga pack P1). */
export function buildExplicitnessIndexFromUnits(
  units: Array<{ evidenceUnitId: string; explicitness: string }>,
): EvidenceExplicitnessIndex {
  const m = new Map<string, string>();
  for (const u of units) m.set(u.evidenceUnitId, u.explicitness);
  return m;
}
