import {
  computeP1ReuseFingerprint,
  computeP2ReuseFingerprint,
  computeP3ReuseFingerprint,
  computeP4ReuseFingerprint,
  hashSnapshotContent,
  p4SpecialtiesKey,
} from './reuse-fingerprint';

const p1Base = {
  snapshotContentHash: hashSnapshotContent('cv-text'),
  segmenterName: 'det',
  segmenterVersion: '1',
  promptVersion: 'P1.1',
  contractVersion: '2.0.0',
  model: 'gemini-3.6-flash',
  batchBuilderVersion: 'b1',
  validatorVersion: 'v1',
};

const p2Base = {
  p1ArtifactDigest: 'digest-a',
  promptVersion: 'P2.1',
  contractVersion: '1.0.0',
  catalogPolicyVersion: 'c1',
  professionalFieldCatalogVersion: 'f1',
  reasoningPolicyVersion: 'r1',
  generationPolicyVersion: 'g1',
  model: 'gemini-3.6-flash',
};

const p3Base = {
  p1ArtifactDigest: 'digest-a',
  r1FieldResolutionStatus: 'RESOLVED',
  fieldsEvaluated: ['VISUAL_DESIGN', 'COMMUNICATIONS'],
  promptVersion: 'P3.1',
  contractVersion: '1.0.0',
  specialtyCatalogVersion: '1.12.0',
  reasoningPolicyVersion: 'r1',
  generationPolicyVersion: 'g1',
  model: 'gemini-3.6-flash',
};

const p4Base = {
  p1ArtifactDigest: 'digest-a',
  p3ResultIdentity: 'p3-fp-1',
  specialtiesKey: p4SpecialtiesKey([
    { fieldCode: 'VISUAL_DESIGN', specialtyCode: 'UX', p3Status: 'OBSERVED' },
  ]),
  promptVersion: 'P4.1',
  contractVersion: '1.1.0',
  specialtyCatalogVersion: '1.12.0',
  routingPolicyVersion: '12H.1',
  reasoningPolicyVersion: 'r1',
  generationPolicyVersion: 'g1',
  model: 'gemini-3.6-flash',
};

describe('reuse fingerprints', () => {
  it('same effective input → same fingerprint', () => {
    expect(computeP1ReuseFingerprint(p1Base)).toBe(
      computeP1ReuseFingerprint({ ...p1Base }),
    );
    expect(computeP3ReuseFingerprint(p3Base)).toBe(
      computeP3ReuseFingerprint({
        ...p3Base,
        fieldsEvaluated: ['COMMUNICATIONS', 'VISUAL_DESIGN'],
      }),
    );
  });

  it('different snapshot → different P1 fingerprint', () => {
    expect(
      computeP1ReuseFingerprint({
        ...p1Base,
        snapshotContentHash: hashSnapshotContent('other-cv'),
      }),
    ).not.toBe(computeP1ReuseFingerprint(p1Base));
  });

  it('different prompt version → execute (new fingerprint)', () => {
    expect(
      computeP1ReuseFingerprint({ ...p1Base, promptVersion: 'P1.2' }),
    ).not.toBe(computeP1ReuseFingerprint(p1Base));
    expect(
      computeP2ReuseFingerprint({ ...p2Base, promptVersion: 'P2.2' }),
    ).not.toBe(computeP2ReuseFingerprint(p2Base));
  });

  it('different catalog invalidates only the affected phase', () => {
    const p1 = computeP1ReuseFingerprint(p1Base);
    const p2 = computeP2ReuseFingerprint(p2Base);
    const p3 = computeP3ReuseFingerprint(p3Base);
    const p3Catalog = computeP3ReuseFingerprint({
      ...p3Base,
      specialtyCatalogVersion: 'TEST_INVALIDATION_ONLY',
    });
    const p2Catalog = computeP2ReuseFingerprint({
      ...p2Base,
      professionalFieldCatalogVersion: 'f2',
    });
    expect(p3Catalog).not.toBe(p3);
    expect(computeP1ReuseFingerprint(p1Base)).toBe(p1);
    expect(computeP2ReuseFingerprint(p2Base)).toBe(p2);
    expect(p2Catalog).not.toBe(p2);
    expect(computeP3ReuseFingerprint(p3Base)).toBe(p3);
  });

  it('different model → new fingerprint', () => {
    expect(
      computeP4ReuseFingerprint({ ...p4Base, model: 'gemini-2.5-flash' }),
    ).not.toBe(computeP4ReuseFingerprint(p4Base));
  });

  it('P3 result identity change invalidates P4 without changing P1', () => {
    const p1 = computeP1ReuseFingerprint(p1Base);
    const p4 = computeP4ReuseFingerprint(p4Base);
    expect(
      computeP4ReuseFingerprint({ ...p4Base, p3ResultIdentity: 'p3-fp-2' }),
    ).not.toBe(p4);
    expect(computeP1ReuseFingerprint(p1Base)).toBe(p1);
  });

  it('test override changes fingerprint without touching production versions', () => {
    expect(
      computeP3ReuseFingerprint({
        ...p3Base,
        overrides: { specialtyCatalogVersion: 'TEST_INVALIDATION_ONLY' },
      }),
    ).not.toBe(computeP3ReuseFingerprint(p3Base));
  });
});
