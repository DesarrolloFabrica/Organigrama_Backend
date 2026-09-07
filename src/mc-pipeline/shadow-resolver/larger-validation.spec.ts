import { join } from 'node:path';
import { P3_TO_P4_USAGE, P4_MINIMUM_CONTRACT, CONFIDENCE_AUDIT } from './p3-p4-audit';
import { discoverHistoricalInventory } from './inventory';
import { SKIP_CANDIDATE_CODE } from './skip-eligibility';
import { isDeterministicSkipGeminiEnabled } from './flags';
import { ADVERSARIAL_FIXTURES } from './gate-fixtures';
import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { evaluateP2SkipEligibility } from './skip-eligibility';

const BACKEND = process.cwd();

describe('MC1 larger offline validation (frozen candidate)', () => {
  it('skip flag stays false and candidate is frozen', () => {
    expect(isDeterministicSkipGeminiEnabled()).toBe(false);
    expect(SKIP_CANDIDATE_CODE).toBe('MC1.DETERMINISTIC.RESOLVER.CANDIDATE.1');
  });

  it('inventory finds P1+P2 historical snapshots without Gemini', () => {
    const rows = discoverHistoricalInventory(BACKEND);
    const p2 = rows.filter((r) => r.p2Class === 'P2_ELIGIBLE');
    expect(p2.length).toBeGreaterThanOrEqual(20);
    expect(p2.every((r) => r.p1Available && r.p2Available)).toBe(true);
  });

  it('P4 minimum contract is specialtyCode + parent field + status', () => {
    expect([...P4_MINIMUM_CONTRACT]).toEqual([
      'specialtyCode',
      'parentFieldCode',
      'status',
    ]);
    expect(CONFIDENCE_AUDIT.codePath).toBe('NON_BLOCKING');
    const supports = P3_TO_P4_USAGE.find((u) => u.p3Field === 'supportingEvidenceUnitIds');
    const rationale = P3_TO_P4_USAGE.find((u) => u.p3Field === 'rationaleCode');
    expect(supports?.classification).toBe('NOT_REQUIRED_BY_P4');
    expect(rationale?.classification).toBe('NOT_REQUIRED_BY_P4');
  });

  it('expanded adversarial fixtures do not skip on shallow patterns', () => {
    const tool = resolveFieldsHardened({
      snapshotId: 'adv',
      units: ADVERSARIAL_FIXTURES.toolRichShallow,
    });
    expect(evaluateP2SkipEligibility(tool, ADVERSARIAL_FIXTURES.toolRichShallow).eligibility).toBe(
      'NOT_SKIP_ELIGIBLE',
    );
    const single = resolveFieldsHardened({
      snapshotId: 'adv',
      units: ADVERSARIAL_FIXTURES.singleSource,
    });
    expect(evaluateP2SkipEligibility(single, ADVERSARIAL_FIXTURES.singleSource).eligibility).toBe(
      'NOT_SKIP_ELIGIBLE',
    );
    const dup = resolveFieldsHardened({
      snapshotId: 'adv',
      units: ADVERSARIAL_FIXTURES.duplicateSpans,
    });
    expect(evaluateP2SkipEligibility(dup, ADVERSARIAL_FIXTURES.duplicateSpans).eligibility).toBe(
      'NOT_SKIP_ELIGIBLE',
    );
  });
});
