import {
  assertP2ContractReferentialIntegrity,
  assertP2EvidenceIdentityIntegrity,
  assertStableCanonicalIds,
  buildCanonicalEvidenceUnitId,
} from './p2-evidence-loader';
import type { P2InputEvidenceUnit } from './p2.types';

function sampleUnit(
  partial: Partial<P2InputEvidenceUnit> & { evidenceUnitId: string },
): P2InputEvidenceUnit {
  return {
    originalEvidenceUnitId: partial.originalEvidenceUnitId ?? null,
    evidenceKind: partial.evidenceKind ?? 'ROLE_TITLE',
    explicitness: partial.explicitness ?? 'EXPLICIT',
    pageNumber: partial.pageNumber ?? 1,
    startOffset: partial.startOffset ?? 0,
    endOffset: partial.endOffset ?? 10,
    contentFingerprint: partial.contentFingerprint ?? 'fp',
    primaryCandidateId: partial.primaryCandidateId ?? 'c-0001',
    normalizedActivity: null,
    object: null,
    toolOrMethod: null,
    result: null,
    scope: null,
    temporalContext: null,
    ...partial,
  };
}

describe('P2 evidence identity (8A.2)', () => {
  it('builds stable distinct IDs for same candidate different structure', () => {
    const a = buildCanonicalEvidenceUnitId({
      artifactIdentity: 'pack:P1P-V11-20260805205709-bf601215',
      primaryCandidateId: 'c-0010',
      startOffset: 100,
      endOffset: 200,
      evidenceKind: 'ROLE_TITLE',
      ordinal: 0,
    });
    const b = buildCanonicalEvidenceUnitId({
      artifactIdentity: 'pack:P1P-V11-20260805205709-bf601215',
      primaryCandidateId: 'c-0010',
      startOffset: 100,
      endOffset: 200,
      evidenceKind: 'SKILL_CLAIM',
      ordinal: 0,
    });
    const a2 = buildCanonicalEvidenceUnitId({
      artifactIdentity: 'pack:P1P-V11-20260805205709-bf601215',
      primaryCandidateId: 'c-0010',
      startOffset: 100,
      endOffset: 200,
      evidenceKind: 'ROLE_TITLE',
      ordinal: 0,
    });
    expect(a).not.toEqual(b);
    expect(a).toEqual(a2);
    expect(a.startsWith('ceu_')).toBe(true);
  });

  it('rejects duplicate canonical IDs', () => {
    const units = [
      sampleUnit({ evidenceUnitId: 'ceu_a' }),
      sampleUnit({ evidenceUnitId: 'ceu_a' }),
    ];
    expect(() => assertP2EvidenceIdentityIntegrity(units)).toThrow(
      /not unique/i,
    );
  });

  it('accepts unique canonical IDs', () => {
    const units = [
      sampleUnit({ evidenceUnitId: 'ceu_a' }),
      sampleUnit({ evidenceUnitId: 'ceu_b' }),
    ];
    expect(() => assertP2EvidenceIdentityIntegrity(units)).not.toThrow();
  });

  it('rejects orphan support refs in contract', () => {
    expect(() =>
      assertP2ContractReferentialIntegrity(
        {
          payload: {
            evidenceDispositions: [{ evidenceUnitId: 'ceu_a' }],
            domainCandidates: [
              {
                supportingEvidenceUnitIds: ['ceu_missing'],
                contradictingEvidenceUnitIds: [],
              },
            ],
          },
        },
        ['ceu_a'],
      ),
    ).toThrow(/not in input unit set/i);
  });

  it('reload stability helper detects drift', () => {
    const a = [sampleUnit({ evidenceUnitId: 'ceu_a' })];
    const b = [sampleUnit({ evidenceUnitId: 'ceu_b' })];
    expect(() => assertStableCanonicalIds(a, b)).toThrow(/changed on reload/i);
  });
});
