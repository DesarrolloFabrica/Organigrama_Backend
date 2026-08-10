import {
  buildPersistBatchInputs,
  contentFingerprintOf,
  sha256Hex,
  type P1MemoryArtifact,
} from './p1-memory-artifact';
import { createP1PersistenceService } from './p1-persistence.service';
import { P1RunnerPersistenceAdapter } from './p1-runner-persistence-adapter';
import { P1PersistenceError } from './p1-persistence.errors';

describe('P1 runner persistence adapter (no Gemini)', () => {
  it('ARTIFACT_ONLY is default-safe without DB writers', () => {
    const svc = createP1PersistenceService({ mode: 'ARTIFACT_ONLY' });
    expect(svc.hasDbWriter).toBe(false);
    const adapter = P1RunnerPersistenceAdapter.create({ mode: 'ARTIFACT_ONLY' });
    expect(adapter).toBeTruthy();
  });

  it('PERSIST_MDE requires explicit confirmation', () => {
    expect(() =>
      P1RunnerPersistenceAdapter.create({
        mode: 'PERSIST_MDE',
        confirmPersist: false,
      }),
    ).toThrow(P1PersistenceError);
  });

  it('contentFingerprint is stable and ignores nulls as empty token', () => {
    const a = contentFingerprintOf({
      explicitness: 'EXPLICIT',
      evidenceKind: 'ACTION',
      normalizedActivity: null,
      object: 'x',
      toolOrMethod: null,
      result: null,
    });
    const b = contentFingerprintOf({
      explicitness: 'EXPLICIT',
      evidenceKind: 'ACTION',
      normalizedActivity: null,
      object: 'x',
      toolOrMethod: null,
      result: null,
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('buildPersistBatchInputs keeps 1:1 decisions per batch without CV text', () => {
    const artifact: P1MemoryArtifact = {
      snapshotId: '1',
      prototypeId: 'SYNTH',
      source: 'ARTIFACT_REUSED',
      artifactDir: null,
      candidates: [
        {
          candidateId: 'c1',
          pageNumber: 1,
          startOffset: 0,
          endOffset: 4,
          textHash: sha256Hex('abcd'),
          candidateType: 'SENTENCE',
          blockType: 'OTHER',
          parentHeadingCandidateId: null,
        },
        {
          candidateId: 'c2',
          pageNumber: 1,
          startOffset: 5,
          endOffset: 9,
          textHash: sha256Hex('efgh'),
          candidateType: 'SENTENCE',
          blockType: 'OTHER',
          parentHeadingCandidateId: null,
        },
      ],
      decisions: [
        {
          candidateId: 'c1',
          decision: 'ACCEPTED',
          reasonCode: 'OK',
          reviewRequired: false,
          batchId: 'b1',
        },
        {
          candidateId: 'c2',
          decision: 'REJECTED_CONTEXT_ONLY',
          reasonCode: 'HEADING_ONLY',
          reviewRequired: false,
          batchId: 'b1',
        },
      ],
      units: [
        {
          primaryCandidateId: 'c1',
          pageNumber: 1,
          startOffset: 0,
          endOffset: 4,
          spanTextHash: sha256Hex('abcd'),
          contentFingerprint: contentFingerprintOf({
            explicitness: 'EXPLICIT',
            evidenceKind: 'ACTION',
            normalizedActivity: 'do',
            object: null,
            toolOrMethod: null,
            result: null,
          }),
          evidenceKind: 'ACTION',
          explicitness: 'EXPLICIT',
          decision: 'ACCEPTED',
          reviewGate: 'NOT_REQUIRED',
          batchId: 'b1',
          normalizedActivity: 'do',
          object: null,
          toolOrMethod: null,
          result: null,
          scope: null,
          temporalContext: null,
          provenance: { batchId: 'b1', origin: 'TEST' },
        },
      ],
      batches: [
        {
          batchId: 'b1',
          pageRangeStart: 1,
          pageRangeEnd: 1,
          candidateIds: ['c1', 'c2'],
        },
      ],
      warningCodes: [],
      metrics: {
        candidateCount: 2,
        decisionCount: 2,
        accepted: 1,
        rejected: 1,
        reviewRequired: 0,
        unitCount: 1,
        batchCount: 1,
        unsupportedSpanCount: 0,
        explicit: 1,
        stronglySupported: 0,
        inferred: 0,
        evidenceKindTotals: { ACTION: 1 },
      },
    };
    const inputs = buildPersistBatchInputs(artifact);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].candidates).toHaveLength(2);
    expect(inputs[0].decisions).toHaveLength(2);
    expect(inputs[0].units).toHaveLength(1);
    const blob = JSON.stringify(inputs);
    expect(blob).not.toMatch(/sourceText|normalizedText|prompt/i);
  });
});
