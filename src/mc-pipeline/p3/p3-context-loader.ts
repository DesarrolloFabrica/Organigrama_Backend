import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import {
  SPECIALTY_CATALOG_SCOPE,
  specialtiesForField,
} from '../catalog/specialties-visual-education';
import {
  loadP2EvidenceFromP1Pack,
  type P2LoadedEvidence,
} from '../p2/p2-evidence-loader';
import type { R1ContractEnvelope } from '../r1/r1.types';

export type P3ResolvedFieldInput = {
  fieldCode: string;
  role: 'PRIMARY' | 'SECONDARY';
  confidence: number;
};

export type P3LoadedContext = {
  snapshotId: string;
  r1PackDir: string;
  r1: R1ContractEnvelope;
  fieldsToEvaluate: P3ResolvedFieldInput[];
  evidence: P2LoadedEvidence;
  warningCodes: string[];
};

export function newP3ExecutionId(): string {
  return randomUUID();
}

export function fingerprintP3Config(parts: Record<string, string>): string {
  const ordered = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k]}`)
    .join('|');
  return createHash('sha256').update(ordered, 'utf8').digest('hex');
}

export function findLatestR1Pack(
  backendRoot: string,
  snapshotId: string,
): string | null {
  const root = resolve(backendRoot, 'tmp', 'mc1-r1-functional');
  if (!existsSync(root)) return null;
  const prefixes = [
    `R1F-8A2-S${snapshotId}-`,
    `R1F-8A1-S${snapshotId}-`,
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

export function loadR1Contract(packDir: string): R1ContractEnvelope {
  const path = join(packDir, 'r1-contract.json');
  if (!existsSync(path)) {
    throw new Error(`missing r1-contract.json in ${packDir}`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as R1ContractEnvelope;
}

/**
 * Campos a evaluar en P3:
 * - RESOLVED: solo primary (KNOWN en scope de catálogo specialty)
 * - MULTI_FIELD: primary + secondaries
 * - UNRESOLVED: ninguno
 * Solo VISUAL_DESIGN / EDUCATION tienen especialidades en 8B.
 */
export function resolveFieldsToEvaluate(
  r1: R1ContractEnvelope,
): P3ResolvedFieldInput[] {
  const p = r1.payload;
  if (p.fieldResolutionStatus === 'UNRESOLVED' || !p.primaryField) {
    return [];
  }

  const out: P3ResolvedFieldInput[] = [];
  const primary = p.primaryField.fieldCode;
  if (primary && SPECIALTY_CATALOG_SCOPE.has(primary)) {
    out.push({
      fieldCode: primary,
      role: 'PRIMARY',
      confidence: p.primaryField.confidence,
    });
  }

  if (p.fieldResolutionStatus === 'MULTI_FIELD') {
    for (const s of p.secondaryFields ?? []) {
      const code = s.fieldCode;
      if (!code || !SPECIALTY_CATALOG_SCOPE.has(code)) continue;
      if (out.some((x) => x.fieldCode === code)) continue;
      out.push({
        fieldCode: code,
        role: 'SECONDARY',
        confidence: s.confidence,
      });
    }
  }

  return out;
}

export async function loadP3Context(args: {
  backendRoot: string;
  snapshotId: string;
  dataSource: DataSource;
  r1PackDir?: string;
}): Promise<P3LoadedContext> {
  const r1PackDir =
    args.r1PackDir ?? findLatestR1Pack(args.backendRoot, args.snapshotId);
  if (!r1PackDir) {
    throw new Error(`no R1 pack for snapshot ${args.snapshotId}`);
  }

  const r1 = loadR1Contract(r1PackDir);
  if (String(r1.payload.snapshotId) !== String(args.snapshotId)) {
    throw new Error(
      `r1 snapshot mismatch: pack=${r1.payload.snapshotId} expected=${args.snapshotId}`,
    );
  }

  const fieldsToEvaluate = resolveFieldsToEvaluate(r1);
  const evidence = await loadP2EvidenceFromP1Pack({
    backendRoot: args.backendRoot,
    snapshotId: args.snapshotId,
    dataSource: args.dataSource,
  });

  const warningCodes = [
    'INPUT_SOURCE_R1_PLUS_P1_PACK_ARTIFACT_ONLY',
    'SPECIALTY_CATALOG_SCOPE_VE_ED_PPM_FA_SE_AV_COMM',
    ...evidence.warningCodes.filter((w) => w.startsWith('CANONICAL_')),
  ];

  for (const f of fieldsToEvaluate) {
    if (specialtiesForField(f.fieldCode).length === 0) {
      warningCodes.push(`NO_SPECIALTIES_DEFINED_FOR_${f.fieldCode}`);
    }
  }

  return {
    snapshotId: args.snapshotId,
    r1PackDir,
    r1,
    fieldsToEvaluate,
    evidence,
    warningCodes,
  };
}
