import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ResolverEvidenceUnit } from './types';

const ORIGIN_KINDS = new Set([
  'ACTION',
  'RESPONSIBILITY',
  'PROJECT',
  'DELIVERABLE',
]);

const REINFORCE_KINDS = new Set(['KNOWLEDGE_STATEMENT', 'RESULT']);

export function isOriginKind(kind: string): boolean {
  return ORIGIN_KINDS.has(kind);
}

export function isReinforceKind(kind: string): boolean {
  return REINFORCE_KINDS.has(kind);
}

export function isEligibleUnit(u: ResolverEvidenceUnit): boolean {
  if (u.decision !== 'ACCEPTED') return false;
  return u.explicitness === 'EXPLICIT' || u.explicitness === 'STRONGLY_SUPPORTED';
}

type RawValidated = {
  units?: Array<{
    candidateId: string;
    evidencePrototypeId?: string;
    evidenceKind: string;
    explicitness: string;
    decision: string;
    pageNumber?: number;
    startOffset?: number;
    endOffset?: number;
    normalizedActivity?: string | null;
    object?: string | null;
    toolOrMethod?: string | null;
    result?: string | null;
    scope?: string | null;
    temporalContext?: string | null;
  }>;
};

export function loadEvidenceUnitsFromP1Pack(
  packDir: string,
): ResolverEvidenceUnit[] {
  const path = join(packDir, 'validated-evidence.json');
  if (!existsSync(path)) {
    throw new Error(`P1 validated-evidence.json missing: ${path}`);
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as RawValidated;
  const units: ResolverEvidenceUnit[] = [];
  for (const u of raw.units ?? []) {
    units.push({
      evidenceId: u.candidateId,
      candidateId: u.candidateId,
      evidenceKind: u.evidenceKind,
      explicitness: u.explicitness,
      decision: u.decision,
      normalizedActivity: u.normalizedActivity ?? null,
      object: u.object ?? null,
      toolOrMethod: u.toolOrMethod ?? null,
      result: u.result ?? null,
      scope: u.scope ?? null,
      temporalContext: u.temporalContext ?? null,
      pageNumber: u.pageNumber ?? null,
      startOffset: u.startOffset ?? null,
      endOffset: u.endOffset ?? null,
    });
  }
  return units.filter(isEligibleUnit);
}
