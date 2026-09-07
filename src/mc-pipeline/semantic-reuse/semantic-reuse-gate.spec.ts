import {
  buildP3SemanticFingerprint,
  compareP3SemanticInputs,
  decideP3Reuse,
  defaultP3SemanticInput,
  evidenceIdentityFromUnits,
} from './p3-gate';
import { decideP4Reuse, defaultP4SemanticInput } from './p4-gate';
import { runSemanticGateAdversarialTests, runSemanticGateMutationTests } from './adversarial';
import { CSET_V2_FIXTURES } from '../shadow-resolver/candidate-set-v2-fixtures';
import type { SemanticLineage } from './types';

const UNITS = CSET_V2_FIXTURES.primaryPlusLegitimateContext;

function lin(over: Partial<SemanticLineage> = {}): SemanticLineage {
  return {
    originalRunId: 'a',
    newRunId: 'a',
    originalProducer: 'GEMINI',
    newUpstreamProducer: 'GEMINI',
    oldResultIdentity: 'x',
    newResultIdentity: 'x',
    ...over,
  };
}

describe('MC1 semantic reuse gate prototype', () => {
  it('adversarial fixtures pass', () => {
    const rows = runSemanticGateAdversarialTests();
    expect(rows.filter((r) => !r.pass).map((r) => r.id)).toEqual([]);
  });

  it('mutation fixtures pass', () => {
    const rows = runSemanticGateMutationTests();
    expect(rows.filter((r) => !r.pass).map((r) => r.id)).toEqual([]);
  });

  it('production contract ignores fieldRole and sorts field codes', () => {
    const evidenceIdentity = evidenceIdentityFromUnits(UNITS);
    const a = defaultP3SemanticInput({
      contract: 'PRODUCTION',
      evidenceIdentity,
      fieldContext: [
        { fieldCode: 'VISUAL_DESIGN', fieldRole: 'SECONDARY' },
        { fieldCode: 'SOFTWARE_ENGINEERING', fieldRole: 'PRIMARY' },
      ],
      r1FieldResolutionStatus: 'MULTI_FIELD',
    });
    const b = defaultP3SemanticInput({
      contract: 'PRODUCTION',
      evidenceIdentity,
      fieldContext: [
        { fieldCode: 'SOFTWARE_ENGINEERING', fieldRole: 'CONTEXT' },
        { fieldCode: 'VISUAL_DESIGN', fieldRole: 'CONTEXT' },
      ],
      r1FieldResolutionStatus: 'MULTI_FIELD',
    });
    expect(buildP3SemanticFingerprint(a)).toBe(buildP3SemanticFingerprint(b));
    expect(compareP3SemanticInputs(a, b)).toBe('IDENTICAL');
  });

  it('does not mix PRODUCTION and ROLE_AWARE', () => {
    const evidenceIdentity = evidenceIdentityFromUnits(UNITS);
    const prod = defaultP3SemanticInput({
      contract: 'PRODUCTION',
      evidenceIdentity,
      fieldContext: [{ fieldCode: 'SOFTWARE_ENGINEERING', fieldRole: 'PRIMARY' }],
      r1FieldResolutionStatus: 'RESOLVED',
    });
    const role = defaultP3SemanticInput({
      contract: 'ROLE_AWARE',
      evidenceIdentity,
      fieldContext: [{ fieldCode: 'SOFTWARE_ENGINEERING', fieldRole: 'PRIMARY' }],
      r1FieldResolutionStatus: 'RESOLVED',
    });
    expect(compareP3SemanticInputs(prod, role)).toBe('UNPROVEN');
  });

  it('maps producer-only change to metadata reuse and keeps lineage', () => {
    const evidenceIdentity = evidenceIdentityFromUnits(UNITS);
    const input = defaultP3SemanticInput({
      contract: 'PRODUCTION',
      evidenceIdentity,
      fieldContext: [{ fieldCode: 'SOFTWARE_ENGINEERING' }],
      r1FieldResolutionStatus: 'RESOLVED',
    });
    const rec = decideP3Reuse(
      input,
      input,
      lin({ newUpstreamProducer: 'DETERMINISTIC', newResultIdentity: 'det-1' }),
    );
    expect(rec.reuseDecision).toBe('SAFE_REUSE_WITH_METADATA_CHANGE');
    expect(rec.usageRelation).toBe('REUSED_UNDER_SEMANTIC_EQUIVALENCE');
    expect(rec.lineage.newUpstreamProducer).toBe('DETERMINISTIC');
    expect(rec.lineage.originalProducer).toBe('GEMINI');
  });

  it('blocks P4 reuse when P3 must recompute', () => {
    const evidenceIdentity = evidenceIdentityFromUnits(UNITS);
    const p4 = defaultP4SemanticInput({
      evidenceIdentity,
      r1FieldResolutionStatus: 'RESOLVED',
      specialties: [
        {
          fieldCode: 'SOFTWARE_ENGINEERING',
          specialtyCode: 'FRONTEND_ENGINEERING',
          status: 'OBSERVED',
          evaluationRole: 'AUTHORITATIVE_TARGET',
          publishableFromP3: true,
          routingEligible: true,
        },
      ],
    });
    const rec = decideP4Reuse({
      p3Decision: 'RECOMPUTE_REQUIRED',
      oldInput: p4,
      candidate: p4,
      lineage: lin(),
    });
    expect(rec.reuseDecision).toBe('RECOMPUTE_REQUIRED');
    expect(rec.usageRelation).toBeNull();
  });
});
