/**
 * Identidad de evidencia del full contract determinístico.
 * No inventa IDs. Mapea resolver evidenceId (P1 candidateId) → eu-* → ceu_* reproducible.
 */
import { basename } from 'node:path';
import { buildCanonicalEvidenceUnitId } from '../p2/p2-evidence-loader';
import type { ResolverEvidenceUnit } from '../experimental/deterministic-resolver/types';

export type EvidenceIdMapRow = {
  resolverEvidenceId: string;
  sourceP1CandidateId: string;
  originalEvidenceUnitId: string;
  canonicalEvidenceUnitId: string;
  evidenceKind: string;
  startOffset: number | null;
  endOffset: number | null;
};

export function artifactIdentityFromP1PackRel(p1PackRel: string): string {
  return `pack:${basename(p1PackRel.replace(/\\/g, '/'))}`;
}

export function buildEvidenceIdMap(args: {
  units: ResolverEvidenceUnit[];
  artifactIdentity: string;
}): EvidenceIdMapRow[] {
  const ordinalByKey = new Map<string, number>();
  const rows: EvidenceIdMapRow[] = [];
  const seen = new Set<string>();
  for (const u of args.units) {
    const start = u.startOffset ?? 0;
    const end = u.endOffset ?? 0;
    const structKey = [u.candidateId, String(start), String(end), u.evidenceKind].join('|');
    const seenN = ordinalByKey.get(structKey) ?? 0;
    ordinalByKey.set(structKey, seenN + 1);
    if (seen.has(u.evidenceId)) continue;
    seen.add(u.evidenceId);
    rows.push({
      resolverEvidenceId: u.evidenceId,
      sourceP1CandidateId: u.candidateId,
      originalEvidenceUnitId: `eu-${u.candidateId}`,
      canonicalEvidenceUnitId: buildCanonicalEvidenceUnitId({
        artifactIdentity: args.artifactIdentity,
        primaryCandidateId: u.candidateId,
        startOffset: start,
        endOffset: end,
        evidenceKind: u.evidenceKind,
        ordinal: seenN,
      }),
      evidenceKind: u.evidenceKind,
      startOffset: u.startOffset ?? null,
      endOffset: u.endOffset ?? null,
    });
  }
  return rows.sort((a, b) => a.resolverEvidenceId.localeCompare(b.resolverEvidenceId));
}

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

export function lineageValid(
  supportIds: string[],
  map: EvidenceIdMapRow[],
): boolean {
  const known = new Set(map.map((r) => r.resolverEvidenceId));
  return supportIds.every((id) => known.has(id));
}
