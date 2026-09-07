/**
 * Independencia de evidencia.
 *
 * Dos supports NO son independientes si:
 * - comparten candidateId (mismo span P1, posiblemente partido en slots);
 * - son fragmentos adyacentes de la misma frase (misma página, gap pequeño);
 * - ACTION + cola RESULT derivada del mismo origen adyacente.
 */
import { EXPERIMENTAL_RESOLVER_POLICY } from './experimental-policy';
import type { ResolverEvidenceUnit } from './types';

export function sourceClusterId(u: ResolverEvidenceUnit): string {
  return u.candidateId || u.evidenceId;
}

export function spansAdjacent(
  a: ResolverEvidenceUnit,
  b: ResolverEvidenceUnit,
  gap = EXPERIMENTAL_RESOLVER_POLICY.adjacentSpanGap,
): boolean {
  const aStart = a.startOffset;
  const aEnd = a.endOffset;
  const bStart = b.startOffset;
  const bEnd = b.endOffset;
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) {
    return false;
  }
  if (
    a.pageNumber != null &&
    b.pageNumber != null &&
    a.pageNumber !== b.pageNumber
  ) {
    return false;
  }
  return aStart <= bEnd + gap && bStart <= aEnd + gap;
}

export function independentSourceCount(
  originUnits: ResolverEvidenceUnit[],
): number {
  if (originUnits.length === 0) return 0;
  const parent = new Map<string, string>();
  const keyOf = (u: ResolverEvidenceUnit, i: number) =>
    `${u.evidenceId}#${i}#${u.startOffset ?? 'x'}`;
  const find = (k: string): string => {
    const p = parent.get(k) ?? k;
    if (p !== k) {
      const root = find(p);
      parent.set(k, root);
      return root;
    }
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const keys = originUnits.map((u, i) => {
    const k = keyOf(u, i);
    parent.set(k, k);
    return k;
  });

  for (let i = 0; i < originUnits.length; i += 1) {
    for (let j = i + 1; j < originUnits.length; j += 1) {
      const a = originUnits[i];
      const b = originUnits[j];
      if (sourceClusterId(a) === sourceClusterId(b) || spansAdjacent(a, b)) {
        union(keys[i], keys[j]);
      }
    }
  }

  return new Set(keys.map(find)).size;
}

export function pickOriginUnits(
  all: ResolverEvidenceUnit[],
  originIds: string[],
): ResolverEvidenceUnit[] {
  const wanted = new Set(originIds);
  return all.filter((u) => wanted.has(u.evidenceId));
}
