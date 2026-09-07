import { join } from 'node:path';
import { COHORT } from '../experimental/deterministic-resolver/cohort';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { resolveSpecialtiesHardened } from '../experimental/deterministic-resolver/specialty-resolver-hardened';
import { shadowInputFingerprint } from '../experimental/deterministic-resolver/shadow/fingerprint';
import { RESOLVER_HARDENING_VERSION } from '../experimental/deterministic-resolver/types';
import {
  ADVERSARIAL_FIXTURES,
  FRONTEND_RESOLVED_FIXTURE,
  GOV_RESOLVED_FIXTURE,
  mutateActionToKnowledge,
  mutateAddCompetitor,
  mutateCollapseIndependent,
  mutateRemoveOutcome,
} from './gate-fixtures';
import { isDeterministicSkipGeminiEnabled } from './flags';
import {
  APPROVED_POLICY_VERSION,
  APPROVED_RESOLVER_VERSION,
  evaluateP2SkipEligibility,
  evaluateP3SkipEligibility,
  SKIP_CANDIDATE_CODE,
} from './skip-eligibility';

const BACKEND = process.cwd();

describe('MC1 shadow runtime skip eligibility gate', () => {
  it('skip eligibility positive: GOV fixture can be SKIP_ELIGIBLE on P3 when P2 is', () => {
    const p2 = resolveFieldsHardened({ snapshotId: 'pos', units: GOV_RESOLVED_FIXTURE });
    const p2Skip = evaluateP2SkipEligibility(p2, GOV_RESOLVED_FIXTURE);
    expect(p2.decision).toBe('RESOLVED');
    expect(p2Skip.eligibility).toBe('SKIP_ELIGIBLE');
    const p3 = resolveSpecialtiesHardened({
      snapshotId: 'pos',
      units: GOV_RESOLVED_FIXTURE,
      fieldCodes: ['DATA_ANALYTICS'],
      allowObservedEquivalent: true,
    });
    const gov = p3.items.find((i) => i.specialtyCode === 'DATA_GOVERNANCE')!;
    const p3Skip = evaluateP3SkipEligibility({
      item: gov,
      units: GOV_RESOLVED_FIXTURE,
      p2Decision: p2.decision,
      p2Skip: p2Skip.eligibility,
    });
    expect(gov.decision).toBe('RESOLVED');
    expect(p3Skip.eligibility).toBe('SKIP_ELIGIBLE');
    expect(p3Skip.wouldSkip).toBe(false);
    expect(isDeterministicSkipGeminiEnabled()).toBe(false);
  });

  it('skip eligibility negative: RESOLVED with strong competitor is NOT_SKIP_ELIGIBLE', () => {
    const sara = COHORT.find((c) => c.person === 'Sara')!;
    const units = loadEvidenceUnitsFromP1Pack(join(BACKEND, sara.p1PackRel));
    const p2 = resolveFieldsHardened({ snapshotId: sara.snapshotId, units });
    const skip = evaluateP2SkipEligibility(p2, units);
    expect(p2.decision).toBe('RESOLVED');
    expect(skip.eligibility).toBe('NOT_SKIP_ELIGIBLE');
    expect(skip.reasons).toContain('STRONG_COMPETITOR');
  });

  it('P2 ambiguous blocks P3 skip independently', () => {
    const jp = COHORT.find((c) => c.person === 'Juan Pablo')!;
    const units = loadEvidenceUnitsFromP1Pack(join(BACKEND, jp.p1PackRel));
    const p2 = resolveFieldsHardened({ snapshotId: jp.snapshotId, units });
    const p2Skip = evaluateP2SkipEligibility(p2, units);
    expect(p2.decision).toBe('AMBIGUOUS');
    expect(p2Skip.eligibility).toBe('NOT_SKIP_ELIGIBLE');
    const p3 = resolveSpecialtiesHardened({
      snapshotId: jp.snapshotId,
      units,
      fieldCodes: p2.ambiguousFieldCodes,
      allowObservedEquivalent: false,
    });
    for (const item of p3.items.filter((i) => i.decision === 'RESOLVED')) {
      const skip = evaluateP3SkipEligibility({
        item,
        units,
        p2Decision: p2.decision,
        p2Skip: p2Skip.eligibility,
      });
      expect(skip.eligibility).toBe('NOT_SKIP_ELIGIBLE');
      expect(skip.reasons).toEqual(
        expect.arrayContaining(['P2_NOT_SKIP_ELIGIBLE', 'PARENT_FIELD_NOT_STABLE']),
      );
    }
  });

  it('catalog gap blocks skip', () => {
    const p2 = resolveFieldsHardened({ snapshotId: 'gap', units: GOV_RESOLVED_FIXTURE });
    const withGap = {
      ...p2,
      reasonCodes: [...p2.reasonCodes, 'CATALOG_GAP'],
    };
    const skip = evaluateP2SkipEligibility(withGap, GOV_RESOLVED_FIXTURE);
    expect(skip.eligibility).toBe('NOT_SKIP_ELIGIBLE');
    expect(skip.reasons).toEqual(expect.arrayContaining(['CATALOG_GAP', 'BLOCKING_REASON_CODE']));
  });

  it('single-source blocks skip', () => {
    const p2 = resolveFieldsHardened({ snapshotId: 'thin', units: GOV_RESOLVED_FIXTURE });
    const thin = {
      ...p2,
      candidateFields: p2.candidateFields.map((c) =>
        c.fieldCode === p2.resolvedFieldCode
          ? { ...c, independentSourceCount: 1, matchScore: 1 }
          : c,
      ),
    };
    const skip = evaluateP2SkipEligibility(thin, GOV_RESOLVED_FIXTURE);
    expect(skip.eligibility).toBe('NOT_SKIP_ELIGIBLE');
    expect(skip.reasons).toContain('INSUFFICIENT_INDEPENDENT_SOURCES');
  });

  it('competitor blocks skip', () => {
    const haider = COHORT.find((c) => c.person === 'Haider')!;
    const units = loadEvidenceUnitsFromP1Pack(join(BACKEND, haider.p1PackRel));
    const p2 = resolveFieldsHardened({ snapshotId: haider.snapshotId, units });
    const skip = evaluateP2SkipEligibility(p2, units);
    expect(p2.decision).toBe('RESOLVED');
    expect(skip.eligibility).toBe('NOT_SKIP_ELIGIBLE');
    expect(skip.reasons).toContain('STRONG_COMPETITOR');
  });

  it('mutation removes eligibility', () => {
    const beforeP2 = resolveFieldsHardened({ snapshotId: 'mut', units: GOV_RESOLVED_FIXTURE });
    const beforeSkip = evaluateP2SkipEligibility(beforeP2, GOV_RESOLVED_FIXTURE);
    expect(beforeSkip.eligibility).toBe('SKIP_ELIGIBLE');

    const noOutcome = mutateRemoveOutcome(GOV_RESOLVED_FIXTURE);
    const afterGov = resolveSpecialtiesHardened({
      snapshotId: 'mut',
      units: noOutcome,
      fieldCodes: ['DATA_ANALYTICS'],
      allowObservedEquivalent: true,
    }).items.find((i) => i.specialtyCode === 'DATA_GOVERNANCE')!;
    expect(afterGov.decision).not.toBe('RESOLVED');

    const collapsed = mutateCollapseIndependent(GOV_RESOLVED_FIXTURE);
    const afterCollapse = resolveSpecialtiesHardened({
      snapshotId: 'mut',
      units: collapsed,
      fieldCodes: ['DATA_ANALYTICS'],
      allowObservedEquivalent: true,
    }).items.find((i) => i.specialtyCode === 'DATA_GOVERNANCE')!;
    expect(afterCollapse.decision).not.toBe('RESOLVED');

    const knowledge = mutateActionToKnowledge(GOV_RESOLVED_FIXTURE);
    const afterK = resolveSpecialtiesHardened({
      snapshotId: 'mut',
      units: knowledge,
      fieldCodes: ['DATA_ANALYTICS'],
      allowObservedEquivalent: true,
    }).items.find((i) => i.specialtyCode === 'DATA_GOVERNANCE')!;
    expect(afterK.observedEquivalent).toBe(false);

    const withRival = mutateAddCompetitor(GOV_RESOLVED_FIXTURE);
    const rivalP2 = resolveFieldsHardened({ snapshotId: 'mut', units: withRival });
    const rivalSkip = evaluateP2SkipEligibility(rivalP2, withRival);
    expect(rivalSkip.eligibility).toBe('NOT_SKIP_ELIGIBLE');
  });

  it('version freeze fingerprint', () => {
    expect(SKIP_CANDIDATE_CODE).toBe('MC1.DETERMINISTIC.RESOLVER.CANDIDATE.1');
    expect(APPROVED_RESOLVER_VERSION).toBe(RESOLVER_HARDENING_VERSION);
    expect(APPROVED_POLICY_VERSION).toBe('0.2.0');
    const a = shadowInputFingerprint({ units: GOV_RESOLVED_FIXTURE, phase: 'P2' });
    const b = shadowInputFingerprint({ units: GOV_RESOLVED_FIXTURE, phase: 'P2' });
    const c = shadowInputFingerprint({
      units: GOV_RESOLVED_FIXTURE,
      phase: 'P2',
      policyVersion: '0.2.0-probe',
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });

  it('adversarial fixtures do not inflate identity', () => {
    const tool = resolveFieldsHardened({
      snapshotId: 'adv',
      units: ADVERSARIAL_FIXTURES.toolRichShallow,
    });
    expect(tool.decision).not.toBe('RESOLVED');
    const knowledge = resolveSpecialtiesHardened({
      snapshotId: 'adv',
      units: ADVERSARIAL_FIXTURES.knowledgeRichActionPoor,
      fieldCodes: ['DATA_ANALYTICS'],
      allowObservedEquivalent: true,
    });
    expect(knowledge.items.every((i) => i.observedEquivalent === false)).toBe(true);
    const multi = resolveFieldsHardened({
      snapshotId: 'adv',
      units: ADVERSARIAL_FIXTURES.multiDomainCv,
    });
    expect(multi.decision).not.toBe('RESOLVED');
    const one = resolveFieldsHardened({
      snapshotId: 'adv',
      units: ADVERSARIAL_FIXTURES.oneStrongSentence,
    });
    expect(one.decision).not.toBe('RESOLVED');
    const motion = resolveFieldsHardened({
      snapshotId: 'adv',
      units: ADVERSARIAL_FIXTURES.sharedPracticeMotion,
    });
    expect(motion.decision).not.toBe('RESOLVED');
  });

  it('frontend fixture skip stays off even when eligible', () => {
    const p2 = resolveFieldsHardened({
      snapshotId: 'fe',
      units: FRONTEND_RESOLVED_FIXTURE,
    });
    const skip = evaluateP2SkipEligibility(p2, FRONTEND_RESOLVED_FIXTURE);
    expect(skip.wouldSkip).toBe(false);
    expect(isDeterministicSkipGeminiEnabled()).toBe(false);
  });
});
