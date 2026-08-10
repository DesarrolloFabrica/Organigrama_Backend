import { createHash } from 'node:crypto';
import {
  assertConfigFingerprint,
  computeConfigFingerprint,
} from './p1-config-fingerprint';
import { P1_WARNING_POLICY_VERSION } from './p1-persistence.constants';
import { P1PersistenceError } from './p1-persistence.errors';
import { createP1PersistenceService } from './p1-persistence.service';
import type { P1RunConfig } from './p1-persistence.types';

const baseConfig = (): P1RunConfig => ({
  contractCode: 'MC1.P1.EVIDENCE',
  contractVersion: '2.0.0',
  segmenterName: 'deterministic-evidence-candidate-segmenter',
  segmenterVersion: '1.1.0',
  promptVersion: 'MC1.P1.PROMPT.PROTOTYPE.1.1.0',
  modelProvider: 'google-genai',
  modelVersion: 'gemini-3.6-flash',
  batchBuilderVersion: '1.0.0',
  validatorVersion: '1.0.0',
  warningPolicyVersion: P1_WARNING_POLICY_VERSION,
  resultOrigin: 'LAB',
  lineageKey: 'DEFAULT',
});

describe('P1 persistence — modes and fingerprint (no DB)', () => {
  it('DRY_RUN does not instantiate DB writer', () => {
    const svc = createP1PersistenceService({ mode: 'DRY_RUN' });
    expect(svc.hasDbWriter).toBe(false);
    expect(() =>
      svc.planRun('1', baseConfig()),
    ).toThrow(P1PersistenceError);
  });

  it('ARTIFACT_ONLY does not instantiate DB writer', () => {
    const svc = createP1PersistenceService({ mode: 'ARTIFACT_ONLY' });
    expect(svc.hasDbWriter).toBe(false);
    expect(() => svc.persistBatch('x', {
      batchId: 'b1',
      pageRangeStart: 1,
      pageRangeEnd: 1,
      candidates: [],
      decisions: [],
      units: [],
    })).toThrow(/ARTIFACT_ONLY|forbids/);
  });

  it('computes stable configFingerprint including warningPolicyVersion', () => {
    const a = computeConfigFingerprint(baseConfig());
    const b = computeConfigFingerprint(baseConfig());
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(() =>
      assertConfigFingerprint(baseConfig(), createHash('sha256').update('x').digest('hex')),
    ).toThrow(/configFingerprint|CONFIG_FINGERPRINT_MISMATCH/i);
  });

  it('rejects wrong warningPolicyVersion', () => {
    expect(() =>
      assertConfigFingerprint({
        ...baseConfig(),
        warningPolicyVersion: '9.9.9',
      }),
    ).toThrow(/warningPolicyVersion/);
  });
});
