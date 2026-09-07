import { createHash } from 'node:crypto';
import { PROFESSIONAL_FIELD_CATALOG_VERSION } from '../../../catalog/professional-fields';
import { SPECIALTY_CATALOG_VERSION } from '../../../catalog/specialties-visual-education';
import {
  EXPERIMENTAL_POLICY_VERSION,
  EXPERIMENTAL_RESOLVER_POLICY,
} from '../experimental-policy';
import { stableStringify } from '../run-prototype';
import { RESOLVER_HARDENING_VERSION, type ResolverEvidenceUnit } from '../types';

export type CanonicalEvidenceIdentity = {
  evidenceId: string;
  candidateId: string;
  evidenceKind: string;
  explicitness: string;
  decision: string;
  normalizedActivity: string | null;
  object: string | null;
  toolOrMethod: string | null;
  result: string | null;
  scope: string | null;
  pageNumber: number | null;
  startOffset: number | null;
  endOffset: number | null;
};

export function canonicalEvidenceIdentity(
  units: ResolverEvidenceUnit[],
): CanonicalEvidenceIdentity[] {
  return units
    .map((u) => ({
      evidenceId: u.evidenceId,
      candidateId: u.candidateId,
      evidenceKind: String(u.evidenceKind),
      explicitness: u.explicitness,
      decision: u.decision,
      normalizedActivity: u.normalizedActivity,
      object: u.object,
      toolOrMethod: u.toolOrMethod,
      result: u.result,
      scope: u.scope,
      pageNumber: u.pageNumber ?? null,
      startOffset: u.startOffset ?? null,
      endOffset: u.endOffset ?? null,
    }))
    .sort((a, b) => {
      const k = a.evidenceId.localeCompare(b.evidenceId);
      if (k !== 0) return k;
      return `${a.startOffset ?? 0}`.localeCompare(`${b.startOffset ?? 0}`);
    });
}

export function relevantCatalogFingerprint(): string {
  return sha256(
    stableStringify({
      fieldCatalogVersion: PROFESSIONAL_FIELD_CATALOG_VERSION,
      specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
      policyVersion: EXPERIMENTAL_POLICY_VERSION,
      overlay: EXPERIMENTAL_RESOLVER_POLICY,
    }),
  );
}

export function shadowInputFingerprint(args: {
  units: ResolverEvidenceUnit[];
  phase: 'P2' | 'P3';
  fieldContext?: string[];
  policyVersion?: string;
}): string {
  const policyVersion = args.policyVersion ?? EXPERIMENTAL_POLICY_VERSION;
  return sha256(
    stableStringify({
      canonicalEvidenceIdentity: canonicalEvidenceIdentity(args.units),
      relevantCatalogFingerprint: relevantCatalogFingerprint(),
      resolverVersion: RESOLVER_HARDENING_VERSION,
      policyVersion,
      phase: args.phase,
      fieldContext: [...(args.fieldContext ?? [])].sort(),
    }),
  );
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export const SHADOW_CATALOG_VERSION_LABEL = `${PROFESSIONAL_FIELD_CATALOG_VERSION}+${SPECIALTY_CATALOG_VERSION}`;
