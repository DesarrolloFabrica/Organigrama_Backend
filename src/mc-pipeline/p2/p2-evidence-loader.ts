import { createHash, randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import {
  loadP1MemoryArtifactFromPack,
  resolveCohortArtifactDir,
} from '../p1-persistence/p1-artifact-pack-loader';
import type { P1MemoryArtifact } from '../p1-persistence/p1-memory-artifact';
import { sha256Hex } from '../p1-persistence/p1-memory-artifact';
import type { P2InputEvidenceUnit } from './p2.types';

export type P2LoadedEvidence = {
  snapshotId: string;
  p1PrototypeId: string;
  /** Pseudo p1 run id for ARTIFACT_ONLY (pack), not a DB UUID unless present. */
  p1RunId: string;
  artifactDir: string;
  p1ArtifactDigest: string;
  units: P2InputEvidenceUnit[];
  warningCodes: string[];
};

export class P2EvidenceIdentityError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'P2EvidenceIdentityError';
    this.code = code;
    this.details = details;
  }
}

function unitEligible(u: P1MemoryArtifact['units'][number]): boolean {
  if (u.decision !== 'ACCEPTED') return false;
  if (u.reviewGate !== 'NOT_REQUIRED') return false;
  if (u.explicitness === 'INFERRED') return false;
  return (
    u.explicitness === 'EXPLICIT' || u.explicitness === 'STRONGLY_SUPPORTED'
  );
}

export function digestP1Units(units: P2InputEvidenceUnit[]): string {
  const rows = [...units]
    .map(
      (u) =>
        `${u.evidenceUnitId}|${u.evidenceKind}|${u.explicitness}|${u.contentFingerprint}|${u.startOffset}|${u.endOffset}`,
    )
    .sort();
  return sha256Hex(rows.join('\n'));
}

function sanitizeIdToken(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 64);
}

/**
 * Identidad canónica ARTIFACT_ONLY (estable, determinista, legible):
 * artifactShort + primaryCandidate + offsets + kind + ordinal.
 * No usa sourceText ni similitud textual.
 */
export function buildCanonicalEvidenceUnitId(args: {
  artifactIdentity: string;
  primaryCandidateId: string;
  startOffset: number;
  endOffset: number;
  evidenceKind: string;
  ordinal: number;
}): string {
  const artifactShort = sanitizeIdToken(
    args.artifactIdentity.includes(':')
      ? args.artifactIdentity.split(':').pop()!
      : args.artifactIdentity,
  ).slice(-16);
  return [
    'ceu',
    artifactShort,
    sanitizeIdToken(args.primaryCandidateId),
    String(args.startOffset),
    String(args.endOffset),
    sanitizeIdToken(args.evidenceKind),
    `o${args.ordinal}`,
  ].join('_');
}

/**
 * Guard de entrada P2 — aborta antes de Gemini si la identidad no es 1:1.
 */
export function assertP2EvidenceIdentityIntegrity(
  units: P2InputEvidenceUnit[],
): void {
  const ids = units.map((u) => u.evidenceUnitId);
  const unique = new Set(ids);
  if (ids.length !== unique.size) {
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    throw new P2EvidenceIdentityError(
      'P2_EVIDENCE_ID_NOT_UNIQUE',
      'canonical evidenceUnitId set is not unique',
      {
        unitCount: ids.length,
        uniqueCount: unique.size,
        duplicateIds: [...new Set(dup)].slice(0, 20),
      },
    );
  }
  for (const u of units) {
    if (!u.evidenceUnitId || !u.evidenceUnitId.startsWith('ceu_')) {
      throw new P2EvidenceIdentityError(
        'P2_EVIDENCE_ID_INVALID',
        'canonical evidenceUnitId missing or malformed',
        { evidenceUnitId: u.evidenceUnitId },
      );
    }
  }
}

/**
 * Guard referencial sobre salida P2 normalizada (dispositions 1:1, sin huérfanos).
 */
export function assertP2ContractReferentialIntegrity(
  envelope: {
    payload: {
      evidenceDispositions: Array<{ evidenceUnitId: string }>;
      domainCandidates: Array<{
        supportingEvidenceUnitIds: string[];
        contradictingEvidenceUnitIds: string[];
      }>;
    };
  },
  expectedUnitIds: string[],
): void {
  const dispositions = envelope.payload.evidenceDispositions ?? [];
  const dispIds = dispositions.map((d) => d.evidenceUnitId);
  const uniqueDisp = new Set(dispIds);
  if (dispIds.length !== expectedUnitIds.length) {
    throw new P2EvidenceIdentityError(
      'P2_DISPOSITION_COUNT_MISMATCH',
      'evidenceDispositions count != input units',
      {
        dispositionCount: dispIds.length,
        unitCount: expectedUnitIds.length,
      },
    );
  }
  if (dispIds.length !== uniqueDisp.size) {
    throw new P2EvidenceIdentityError(
      'P2_DISPOSITION_ID_NOT_UNIQUE',
      'evidenceDispositions are not unique by evidenceUnitId',
      {
        dispositionCount: dispIds.length,
        uniqueCount: uniqueDisp.size,
      },
    );
  }
  const expected = new Set(expectedUnitIds);
  for (const id of dispIds) {
    if (!expected.has(id)) {
      throw new P2EvidenceIdentityError(
        'P2_DISPOSITION_UNKNOWN_UNIT',
        'disposition references unknown evidenceUnitId',
        { evidenceUnitId: id },
      );
    }
  }

  const orphans: string[] = [];
  for (const c of envelope.payload.domainCandidates ?? []) {
    for (const id of c.supportingEvidenceUnitIds ?? []) {
      if (!expected.has(id)) orphans.push(`support:${id}`);
    }
    for (const id of c.contradictingEvidenceUnitIds ?? []) {
      if (!expected.has(id)) orphans.push(`contradict:${id}`);
    }
  }
  if (orphans.length) {
    throw new P2EvidenceIdentityError(
      'P2_ORPHAN_EVIDENCE_REFS',
      'support/contradiction IDs not in input unit set',
      { orphans: orphans.slice(0, 30), orphanCount: orphans.length },
    );
  }
}

/**
 * Valida salida cruda del modelo antes de aceptar (huérfanos / dispositions dup).
 * No invoca Gemini; se aplica tras la respuesta.
 */
export function assertP2RawEvidenceRefs(
  raw: {
    domainCandidates?: Array<{
      supportingEvidenceUnitIds?: string[];
      contradictingEvidenceUnitIds?: string[];
    }>;
    evidenceDispositions?: Array<{ evidenceUnitId?: string }>;
  },
  unitIds: string[],
): void {
  const unitSet = new Set(unitIds);
  const orphans: string[] = [];
  for (const c of raw.domainCandidates ?? []) {
    for (const id of c.supportingEvidenceUnitIds ?? []) {
      if (!unitSet.has(id)) orphans.push(`support:${id}`);
    }
    for (const id of c.contradictingEvidenceUnitIds ?? []) {
      if (!unitSet.has(id)) orphans.push(`contradict:${id}`);
    }
  }
  for (const d of raw.evidenceDispositions ?? []) {
    if (d.evidenceUnitId && !unitSet.has(d.evidenceUnitId)) {
      orphans.push(`disposition:${d.evidenceUnitId}`);
    }
  }
  if (orphans.length) {
    throw new P2EvidenceIdentityError(
      'P2_ORPHAN_EVIDENCE_REFS_RAW',
      'model output references evidence IDs outside input set',
      { orphans: orphans.slice(0, 30), orphanCount: orphans.length },
    );
  }

  const dispIds = (raw.evidenceDispositions ?? [])
    .map((d) => d.evidenceUnitId)
    .filter((id): id is string => Boolean(id));
  if (dispIds.length !== new Set(dispIds).size) {
    throw new P2EvidenceIdentityError(
      'P2_DISPOSITION_ID_NOT_UNIQUE_RAW',
      'model output has duplicate evidenceDispositions',
      { dispositionCount: dispIds.length },
    );
  }
}

/**
 * Carga units elegibles desde pack P1 v1.1 (modo ARTIFACT_ONLY / LAB).
 * Asigna evidenceUnitId canónico estable (no eu-<candidateId>).
 */
export async function loadP2EvidenceFromP1Pack(args: {
  backendRoot: string;
  snapshotId: string;
  dataSource: DataSource;
}): Promise<P2LoadedEvidence> {
  const dir = resolveCohortArtifactDir(args.backendRoot, args.snapshotId);
  if (!dir) {
    throw new Error(`no P1 pack for snapshot ${args.snapshotId}`);
  }

  const snapRows = await args.dataSource.query(
    `SELECT id, normalized_text FROM organigrama.mc_cv_snapshot WHERE id = $1`,
    [args.snapshotId],
  );
  if (!snapRows[0]?.normalized_text) {
    throw new Error(`snapshot ${args.snapshotId} missing normalized_text`);
  }

  const memory = loadP1MemoryArtifactFromPack({
    artifactDir: dir,
    snapshotId: args.snapshotId,
    normalizedText: String(snapRows[0].normalized_text),
  });

  const artifactIdentity = `pack:${memory.prototypeId}`;
  const eligible = memory.units.filter(unitEligible);

  // ordinal por clave estructural (mismo candidate+offsets+kind)
  const ordinalByKey = new Map<string, number>();
  const units: P2InputEvidenceUnit[] = eligible.map((u) => {
    const structKey = [
      u.primaryCandidateId,
      String(u.startOffset),
      String(u.endOffset),
      u.evidenceKind,
    ].join('|');
    const seen = ordinalByKey.get(structKey) ?? 0;
    ordinalByKey.set(structKey, seen + 1);
    const ordinal = seen;

    const originalEvidenceUnitId = `eu-${u.primaryCandidateId}`;
    const evidenceUnitId = buildCanonicalEvidenceUnitId({
      artifactIdentity,
      primaryCandidateId: u.primaryCandidateId,
      startOffset: u.startOffset,
      endOffset: u.endOffset,
      evidenceKind: u.evidenceKind,
      ordinal,
    });

    return {
      evidenceUnitId,
      originalEvidenceUnitId,
      evidenceKind: u.evidenceKind,
      explicitness: u.explicitness,
      pageNumber: u.pageNumber,
      startOffset: u.startOffset,
      endOffset: u.endOffset,
      contentFingerprint: u.contentFingerprint,
      primaryCandidateId: u.primaryCandidateId,
      normalizedActivity: u.normalizedActivity,
      object: u.object,
      toolOrMethod: u.toolOrMethod,
      result: u.result,
      scope: u.scope,
      temporalContext: u.temporalContext,
    };
  });

  const warningCodes: string[] = [
    'INPUT_SOURCE_P1_PACK_ARTIFACT_ONLY_LAB',
    'DEFAULT_CANONICAL_VIEW_NOT_USED',
    'CANONICAL_EVIDENCE_UNIT_ID_V1',
  ];
  if (units.length === 0) {
    warningCodes.push('NO_ELIGIBLE_UNITS_AFTER_FILTER');
  }

  // Guard inmediato post-carga (también se revalida en runner antes de Gemini)
  assertP2EvidenceIdentityIntegrity(units);

  return {
    snapshotId: args.snapshotId,
    p1PrototypeId: memory.prototypeId,
    p1RunId: artifactIdentity,
    artifactDir: dir,
    p1ArtifactDigest: digestP1Units(units),
    units,
    warningCodes,
  };
}

export function newExecutionId(): string {
  return randomUUID();
}

export function fingerprintP2Config(parts: Record<string, string>): string {
  const ordered = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k]}`)
    .join('|');
  return createHash('sha256').update(ordered, 'utf8').digest('hex');
}

/** Verifica que recargar el mismo pack reproduce los mismos IDs canónicos. */
export function assertStableCanonicalIds(
  a: P2InputEvidenceUnit[],
  b: P2InputEvidenceUnit[],
): void {
  if (a.length !== b.length) {
    throw new P2EvidenceIdentityError(
      'P2_EVIDENCE_ID_UNSTABLE_COUNT',
      'reload unit count mismatch',
      { a: a.length, b: b.length },
    );
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].evidenceUnitId !== b[i].evidenceUnitId) {
      throw new P2EvidenceIdentityError(
        'P2_EVIDENCE_ID_UNSTABLE',
        'canonical id changed on reload',
        {
          index: i,
          a: a[i].evidenceUnitId,
          b: b[i].evidenceUnitId,
        },
      );
    }
  }
}
