/**
 * EvidenceSignatureExtractor — resumen estadístico P1 sin PII/texto/spans.
 */
import type { ValidatedEvidenceUnit } from '../mc-pipeline/p1/p1-batch-output-validator';
import type { P1CandidateDecision } from '../mc-pipeline/p1/p1.types';
import {
  characterCountBucket,
  pageCountBucket,
  perPageBucket,
} from './buckets';
import { SIGNATURE_VERSION } from './observatory.constants';
import { sha256Hex } from './hash';
import type { EvidenceSignature } from './observatory.types';

export type SignatureInput = {
  snapshotId: string;
  configFingerprint: string;
  runSalt: string;
  pageCount: number;
  characterCount: number;
  candidateCount: number;
  batchCount: number;
  units: Array<Pick<ValidatedEvidenceUnit, 'evidenceKind' | 'explicitness' | 'decision' | 'reviewRequired'>>;
  decisions: Iterable<P1CandidateDecision>;
  unsupportedSpanCount: number;
  validationFailureCount: number;
  warningCount: number;
  duplicateCount?: number;
};

function ratios(counts: Record<string, number>, total: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    out[k] = total > 0 ? Number((v / total).toFixed(4)) : 0;
  }
  return out;
}

export class EvidenceSignatureExtractor {
  extract(input: SignatureInput): EvidenceSignature {
    const kindCounts: Record<string, number> = {};
    const explCounts: Record<string, number> = {
      EXPLICIT: 0,
      STRONGLY_SUPPORTED: 0,
      INFERRED: 0,
    };

    for (const u of input.units) {
      kindCounts[u.evidenceKind] = (kindCounts[u.evidenceKind] ?? 0) + 1;
      explCounts[u.explicitness] = (explCounts[u.explicitness] ?? 0) + 1;
    }

    let accepted = 0;
    let rejected = 0;
    let ambiguous = 0;
    let reviewRequired = 0;
    for (const d of input.decisions) {
      if (d === 'ACCEPTED') accepted += 1;
      else if (d.startsWith('REJECTED')) rejected += 1;
      else if (d === 'AMBIGUOUS') ambiguous += 1;
      else if (d === 'REVIEW_REQUIRED') reviewRequired += 1;
    }
    // INFERRED units force REVIEW_REQUIRED — count units flagged too
    for (const u of input.units) {
      if (u.reviewRequired) reviewRequired = Math.max(reviewRequired, reviewRequired);
    }
    const reviewFromUnits = input.units.filter((u) => u.reviewRequired).length;
    reviewRequired = Math.max(reviewRequired, reviewFromUnits);

    const evidenceUnitCount = input.units.length;
    const pages = Math.max(input.pageCount, 1);
    const unitsPerAccepted =
      accepted > 0 ? Number((evidenceUnitCount / accepted).toFixed(4)) : 0;

    const snapshotFingerprint = sha256Hex(
      `${input.runSalt}|snap|${input.snapshotId}`,
    );

    return {
      signatureVersion: SIGNATURE_VERSION,
      snapshotFingerprint,
      configFingerprint: input.configFingerprint,
      pageCountBucket: pageCountBucket(input.pageCount),
      characterCountBucket: characterCountBucket(input.characterCount),
      candidateCount: input.candidateCount,
      batchCount: input.batchCount,
      evidenceUnitCount,
      acceptedCandidateCount: accepted,
      rejectedCandidateCount: rejected,
      ambiguousCount: ambiguous,
      reviewRequiredCount: reviewRequired,
      evidenceKindCounts: kindCounts,
      evidenceKindRatios: ratios(kindCounts, evidenceUnitCount),
      explicitnessCounts: explCounts,
      explicitnessRatios: ratios(explCounts, evidenceUnitCount),
      evidencePerPageBucket: perPageBucket(evidenceUnitCount / pages),
      candidatePerPageBucket: perPageBucket(input.candidateCount / pages),
      unitsPerAcceptedCandidate: unitsPerAccepted,
      duplicateCount: input.duplicateCount ?? 0,
      unsupportedSpanCount: input.unsupportedSpanCount,
      validationFailureCount: input.validationFailureCount,
      warningCount: input.warningCount,
    };
  }

  /** Escaneo defensivo: lanza si aparece campo prohibido. */
  assertNoPii(signature: EvidenceSignature): void {
    const json = JSON.stringify(signature).toLowerCase();
    const banned = [
      'sourceText',
      'normalizedActivity',
      'startOffset',
      'endOffset',
      'email',
      'personName',
      'driveFileId',
      'cargo',
      'especialidad',
    ];
    for (const b of banned) {
      if (json.includes(b.toLowerCase())) {
        throw new Error(`SIGNATURE_PII_LEAK:${b}`);
      }
    }
  }
}
