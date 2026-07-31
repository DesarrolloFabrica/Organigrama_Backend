/**
 * Firma determinista del contenido curado (sin timestamps).
 * Se usa como pdf_sha256 sintético + raw_result.meta.contentFingerprint.
 */

import { createHash } from 'node:crypto';
import type { CuratedProfileDocument } from './curated-profile.schema';
import { toCanonicalKey } from './curated-profile.normalize';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

export function computeCuratedContentFingerprint(params: {
  document: CuratedProfileDocument;
  personId: string;
  personCvId: string;
}): string {
  const payload = {
    schemaVersion: params.document.schemaVersion,
    personId: params.personId,
    personCvId: params.personCvId,
    domain: params.document.domain.code,
    specialties: [...params.document.specialties]
      .map((s) => ({
        code: s.code,
        skills: [...s.skills]
          .map((sk) => ({
            key: toCanonicalKey(sk.canonicalName),
            type: sk.skillType ?? null,
            decision: sk.reviewDecision ?? 'REUSE_EXISTING',
            confidence: sk.confidence,
            evidence: [...sk.evidence]
              .map((e) => ({
                text: e.text.trim().toLowerCase(),
                evidenceType: e.evidenceType,
                sourceSection: e.sourceSection ?? null,
              }))
              .sort((a, b) => a.text.localeCompare(b.text)),
          }))
          .sort((a, b) =>
            a.key === b.key
              ? String(a.type).localeCompare(String(b.type))
              : a.key.localeCompare(b.key),
          ),
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
  return createHash('sha256')
    .update(stableStringify(payload), 'utf8')
    .digest('hex');
}
