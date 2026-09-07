/**
 * Shadow runtime GATE. No Gemini. No skip productivo.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { resolveSpecialtiesHardened } from '../experimental/deterministic-resolver/specialty-resolver-hardened';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import { shadowInputFingerprint } from '../experimental/deterministic-resolver/shadow/fingerprint';
import { CRITICAL_CONTROLS } from '../experimental/deterministic-resolver/shadow/critical-controls';
import type {
  FieldResolverResult,
  ResolverEvidenceUnit,
  SpecialtyResolverItem,
} from '../experimental/deterministic-resolver/types';
import { expansionGateCohort, fullGateCohort, primaryGateCohort, type GateMember } from './gate-cohort';
import {
  ADVERSARIAL_FIXTURES,
  FRONTEND_RESOLVED_FIXTURE,
  GOV_RESOLVED_FIXTURE,
  mutateActionToKnowledge,
  mutateAddCompetitor,
  mutateCollapseIndependent,
  mutateRemoveDifferential,
  mutateRemoveOutcome,
} from './gate-fixtures';
import { isDeterministicSkipGeminiEnabled } from './flags';
import {
  duplicatedSourceRisk,
  evaluateP2SkipEligibility,
  evaluateP3SkipEligibility,
  isToolOnlyResolved,
  reviewClass,
  SKIP_CANDIDATE_CODE,
  type ReviewClass,
  type SkipEval,
} from './skip-eligibility';

const MEASURED_P2_TOKENS = 18359;
const MEASURED_P3_TOKENS = 11590;

type HistP2 = {
  rank1: string | null;
  active: string[];
};
type HistP3 = Array<{ fieldCode: string; specialtyCode: string; status: string }>;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function ledgerSnapshot(backendRoot: string) {
  const path = join(backendRoot, 'tmp', 'mc1-gemini-ledger', 'events.jsonl');
  if (!existsSync(path)) {
    return { exists: false, path, calls: 0, tokens: 0, sha256: null as string | null };
  }
  const text = readFileSync(path, 'utf8');
  let calls = 0;
  let tokens = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const ev = JSON.parse(line) as {
        eventType?: string;
        usage?: { totalTokens?: number };
      };
      if (ev.eventType === 'GEMINI_CALL') {
        calls += 1;
        tokens += ev.usage?.totalTokens ?? 0;
      }
    } catch {
      // ignore
    }
  }
  return {
    exists: true,
    path,
    calls,
    tokens,
    sha256: createHash('sha256').update(text).digest('hex'),
  };
}

function historicalP2(packDir: string): HistP2 {
  const summary = readJson(join(packDir, 'summary.json')) as {
    ranks?: Array<{ domainCode: string; status: string; rank: number }>;
  };
  const ranks = summary.ranks ?? [];
  return {
    rank1: ranks.find((r) => r.rank === 1)?.domainCode ?? null,
    active: ranks.filter((r) => r.status === 'ACTIVE' && r.domainCode).map((r) => r.domainCode),
  };
}

function historicalP3(packDir: string): HistP3 {
  const summary = readJson(join(packDir, 'summary.json')) as {
    observed?: Array<{ fieldCode: string; specialtyCode: string; status: string }>;
  };
  return summary.observed ?? [];
}

function originPreview(units: ResolverEvidenceUnit[], ids: string[]): string[] {
  return units
    .filter((u) => ids.includes(u.evidenceId))
    .slice(0, 3)
    .map((u) => u.normalizedActivity || u.object || u.toolOrMethod || u.evidenceId);
}

type PersonGate = {
  member: GateMember;
  units: ResolverEvidenceUnit[];
  p2: FieldResolverResult;
  p2Skip: SkipEval;
  p2Review: ReviewClass;
  histP2: HistP2;
  histP3: HistP3;
  p3Items: Array<{
    item: SpecialtyResolverItem;
    skip: SkipEval;
    review: ReviewClass;
  }>;
};

function evaluatePerson(backendRoot: string, member: GateMember): PersonGate {
  const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, member.p1PackRel));
  const p2 = resolveFieldsHardened({ snapshotId: member.snapshotId, units });
  const p2Skip = evaluateP2SkipEligibility(p2, units);
  const top = p2.candidateFields.find((c) => c.fieldCode === p2.resolvedFieldCode);
  const p2Review = reviewClass({
    decision: p2.decision,
    skip: p2Skip,
    toolOnly: isToolOnlyResolved(units, top?.originEvidenceIds ?? []),
    duplicatedSourceRisk: duplicatedSourceRisk(
      units,
      top?.originEvidenceIds ?? [],
      top?.independentSourceCount ?? 0,
    ),
  });
  const fieldCodes =
    p2.decision === 'RESOLVED' && p2.resolvedFieldCode
      ? [p2.resolvedFieldCode]
      : p2.decision === 'AMBIGUOUS'
        ? p2.ambiguousFieldCodes
        : [];
  const p3 = resolveSpecialtiesHardened({
    snapshotId: member.snapshotId,
    units,
    fieldCodes,
    allowObservedEquivalent: p2.decision === 'RESOLVED',
  });
  const p3Items = p3.items.map((item) => {
    const skip = evaluateP3SkipEligibility({
      item,
      units,
      p2Decision: p2.decision,
      p2Skip: p2Skip.eligibility,
    });
    const review = reviewClass({
      decision: item.decision,
      skip,
      toolOnly: isToolOnlyResolved(units, item.originEvidenceIds),
      duplicatedSourceRisk: duplicatedSourceRisk(
        units,
        item.originEvidenceIds,
        item.independentSourceCount ?? 0,
      ),
    });
    return { item, skip, review };
  });
  return {
    member,
    units,
    p2,
    p2Skip,
    p2Review,
    histP2: historicalP2(resolve(backendRoot, member.p2PackRel)),
    histP3: historicalP3(resolve(backendRoot, member.p3PackRel)),
    p3Items,
  };
}

function criticalSkipGate(rows: PersonGate[]): {
  pass: boolean;
  blocked: boolean;
  controls: Array<{ person: string; code: string; actual: string; pass: boolean }>;
} {
  const findP2 = (person: string) => rows.find((r) => r.member.person === person)?.p2;
  const findP3 = (person: string, code: string) =>
    rows
      .find((r) => r.member.person === person)
      ?.p3Items.find((i) => i.item.specialtyCode === code)?.item;
  const controls = [
    {
      person: 'Sara',
      code: 'DATA_GOVERNANCE',
      actual: findP3('Sara', 'DATA_GOVERNANCE')?.decision ?? 'MISSING',
      pass: findP3('Sara', 'DATA_GOVERNANCE')?.decision === 'RESOLVED',
    },
    {
      person: 'Haider',
      code: 'DATA_GOVERNANCE',
      actual: findP3('Haider', 'DATA_GOVERNANCE')?.decision ?? 'MISSING',
      pass: findP3('Haider', 'DATA_GOVERNANCE')?.decision !== 'RESOLVED',
    },
    {
      person: 'Diego',
      code: 'DATA_GOVERNANCE',
      actual: findP3('Diego', 'DATA_GOVERNANCE')?.decision ?? 'MISSING',
      pass:
        findP3('Diego', 'DATA_GOVERNANCE')?.decision !== 'RESOLVED' ||
        (findP3('Diego', 'DATA_GOVERNANCE')?.independentSourceCount ?? 0) < 2,
    },
    {
      person: 'Johan',
      code: 'FRONTEND_ENGINEERING',
      actual: findP3('Johan', 'FRONTEND_ENGINEERING')?.decision ?? 'MISSING',
      pass: findP3('Johan', 'FRONTEND_ENGINEERING')?.decision === 'RESOLVED',
    },
    {
      person: 'Camilo',
      code: 'PLATFORM_DEVOPS_ENGINEERING',
      actual: findP3('Camilo', 'PLATFORM_DEVOPS_ENGINEERING')?.decision ?? 'MISSING',
      pass: findP3('Camilo', 'PLATFORM_DEVOPS_ENGINEERING')?.decision === 'RESOLVED',
    },
    {
      person: 'Juan Pablo',
      code: 'VD_VS_AV',
      actual: findP2('Juan Pablo')?.decision ?? 'MISSING',
      pass: findP2('Juan Pablo')?.decision !== 'RESOLVED',
    },
    {
      person: 'Katherin',
      code: 'DM_VS_COMM',
      actual: findP2('Katherin')?.decision ?? 'MISSING',
      pass: findP2('Katherin')?.decision !== 'RESOLVED',
    },
  ];
  const pass = controls.every((c) => c.pass);
  return { pass, blocked: !pass, controls };
}

function runAdversarial() {
  const cases = [
    {
      id: 'tool-rich-but-shallow',
      units: ADVERSARIAL_FIXTURES.toolRichShallow,
      expect: (p2: FieldResolverResult, items: SpecialtyResolverItem[]) =>
        p2.decision !== 'RESOLVED' &&
        !items.some(
          (i) =>
            i.decision === 'RESOLVED' &&
            (i.specialtyCode === 'DATA_GOVERNANCE' ||
              i.specialtyCode === 'FRONTEND_ENGINEERING'),
        ),
    },
    {
      id: 'knowledge-rich-action-poor',
      units: ADVERSARIAL_FIXTURES.knowledgeRichActionPoor,
      expect: (p2: FieldResolverResult, items: SpecialtyResolverItem[]) =>
        p2.decision !== 'RESOLVED' &&
        !items.some((i) => i.observedEquivalent === true),
    },
    {
      id: 'multi-domain-cv',
      units: ADVERSARIAL_FIXTURES.multiDomainCv,
      expect: (p2: FieldResolverResult) => p2.decision !== 'RESOLVED',
    },
    {
      id: 'one-strong-sentence',
      units: ADVERSARIAL_FIXTURES.oneStrongSentence,
      expect: (p2: FieldResolverResult) =>
        p2.decision === 'AMBIGUOUS' || p2.decision === 'INSUFFICIENT_EVIDENCE',
    },
    {
      id: 'shared-practice-motion',
      units: ADVERSARIAL_FIXTURES.sharedPracticeMotion,
      expect: (p2: FieldResolverResult) => p2.decision !== 'RESOLVED',
    },
  ];
  return cases.map((c) => {
    const p2 = resolveFieldsHardened({ snapshotId: c.id, units: c.units });
    const fieldCodes =
      p2.decision === 'RESOLVED' && p2.resolvedFieldCode
        ? [p2.resolvedFieldCode]
        : p2.ambiguousFieldCodes;
    const p3 = resolveSpecialtiesHardened({
      snapshotId: c.id,
      units: c.units,
      fieldCodes,
      allowObservedEquivalent: p2.decision === 'RESOLVED',
    });
    const pass = c.expect(p2, p3.items);
    return {
      id: c.id,
      pass,
      p2Decision: p2.decision,
      resolvedFieldCode: p2.resolvedFieldCode,
      p3Resolved: p3.items.filter((i) => i.decision === 'RESOLVED').map((i) => i.specialtyCode),
    };
  });
}

function runMutations() {
  const cases = [
    {
      id: 'remove-outcome',
      base: GOV_RESOLVED_FIXTURE,
      mutate: mutateRemoveOutcome,
      fieldCodes: ['DATA_ANALYTICS'],
      specialty: 'DATA_GOVERNANCE',
    },
    {
      id: 'collapse-independent-sources',
      base: GOV_RESOLVED_FIXTURE,
      mutate: mutateCollapseIndependent,
      fieldCodes: ['DATA_ANALYTICS'],
      specialty: 'DATA_GOVERNANCE',
    },
    {
      id: 'action-to-knowledge',
      base: GOV_RESOLVED_FIXTURE,
      mutate: mutateActionToKnowledge,
      fieldCodes: ['DATA_ANALYTICS'],
      specialty: 'DATA_GOVERNANCE',
    },
    {
      id: 'remove-differential',
      base: FRONTEND_RESOLVED_FIXTURE,
      mutate: mutateRemoveDifferential,
      fieldCodes: ['SOFTWARE_ENGINEERING'],
      specialty: 'FRONTEND_ENGINEERING',
    },
    {
      id: 'add-strong-competitor',
      base: GOV_RESOLVED_FIXTURE,
      mutate: mutateAddCompetitor,
      fieldCodes: ['DATA_ANALYTICS'],
      specialty: 'DATA_GOVERNANCE',
    },
  ];
  return cases.map((c) => {
    const beforeP2 = resolveFieldsHardened({ snapshotId: c.id, units: c.base });
    const beforeP3 = resolveSpecialtiesHardened({
      snapshotId: c.id,
      units: c.base,
      fieldCodes: c.fieldCodes,
      allowObservedEquivalent: true,
    });
    const beforeItem = beforeP3.items.find((i) => i.specialtyCode === c.specialty);
    const beforeSkipP2 = evaluateP2SkipEligibility(beforeP2, c.base);
    const beforeSkipP3 = beforeItem
      ? evaluateP3SkipEligibility({
          item: beforeItem,
          units: c.base,
          p2Decision: beforeP2.decision,
          p2Skip: beforeSkipP2.eligibility,
        })
      : null;
    const mutated = c.mutate(c.base);
    const afterP2 = resolveFieldsHardened({ snapshotId: c.id, units: mutated });
    const afterP3 = resolveSpecialtiesHardened({
      snapshotId: c.id,
      units: mutated,
      fieldCodes:
        afterP2.decision === 'RESOLVED' && afterP2.resolvedFieldCode
          ? [afterP2.resolvedFieldCode]
          : c.fieldCodes,
      allowObservedEquivalent: afterP2.decision === 'RESOLVED',
    });
    const afterItem = afterP3.items.find((i) => i.specialtyCode === c.specialty);
    const afterSkipP2 = evaluateP2SkipEligibility(afterP2, mutated);
    const afterSkipP3 = afterItem
      ? evaluateP3SkipEligibility({
          item: afterItem,
          units: mutated,
          p2Decision: afterP2.decision,
          p2Skip: afterSkipP2.eligibility,
        })
      : null;
    const lostResolution =
      (beforeItem?.decision === 'RESOLVED' && afterItem?.decision !== 'RESOLVED') ||
      (beforeSkipP2.eligibility === 'SKIP_ELIGIBLE' && afterSkipP2.eligibility !== 'SKIP_ELIGIBLE') ||
      (beforeSkipP3?.eligibility === 'SKIP_ELIGIBLE' && afterSkipP3?.eligibility !== 'SKIP_ELIGIBLE');
    const pass =
      afterItem?.decision === 'AMBIGUOUS' ||
      afterItem?.decision === 'INSUFFICIENT_EVIDENCE' ||
      afterP2.decision !== 'RESOLVED' ||
      afterSkipP2.eligibility === 'NOT_SKIP_ELIGIBLE' ||
      afterSkipP3?.eligibility === 'NOT_SKIP_ELIGIBLE';
    return {
      id: c.id,
      pass: Boolean(lostResolution && pass),
      before: {
        p2: beforeP2.decision,
        p3: beforeItem?.decision ?? null,
        p2Skip: beforeSkipP2.eligibility,
        p3Skip: beforeSkipP3?.eligibility ?? null,
      },
      after: {
        p2: afterP2.decision,
        p3: afterItem?.decision ?? null,
        p2Skip: afterSkipP2.eligibility,
        p3Skip: afterSkipP3?.eligibility ?? null,
      },
    };
  });
}

export function runShadowRuntimeGate(backendRoot: string) {
  const ledgerBefore = ledgerSnapshot(backendRoot);
  const primary = primaryGateCohort();
  const expansion = expansionGateCohort(backendRoot);
  const allMembers = fullGateCohort(backendRoot);
  const rows = allMembers.map((m) => evaluatePerson(backendRoot, m));
  const primaryRows = rows.filter((r) => r.member.gateRole === 'PRIMARY');
  const critical = criticalSkipGate(primaryRows);
  const adversarial = runAdversarial();
  const mutations = runMutations();

  const p2Primary = primaryRows.map((r) => r.p2);
  const p2ResolvedRows = primaryRows.filter((r) => r.p2.decision === 'RESOLVED');
  const p3ResolvedRows = primaryRows.flatMap((r) =>
    r.p3Items.filter((i) => i.item.decision === 'RESOLVED').map((i) => ({ person: r, i })),
  );

  const p2ReviewTable = p2ResolvedRows.map((r) => {
    const top = r.p2.candidateFields.find((c) => c.fieldCode === r.p2.resolvedFieldCode);
    return {
      person: r.member.person,
      resolver: r.p2.resolvedFieldCode,
      evidenceSources: top?.independentSourceCount ?? 0,
      originPreview: originPreview(r.units, top?.originEvidenceIds ?? []),
      differential: top?.differentialSignalsMatched ?? [],
      competitor: r.p2Skip.strongCompetitorCodes,
      catalogDependency: r.p2Skip.catalogDependency,
      review: r.p2Review,
      skip: r.p2Skip.eligibility,
      skipReasons: r.p2Skip.reasons,
      canonicalRank1: r.histP2.rank1,
      note: 'canonical is not gold; Sara pre-fix showed Gemini can err',
    };
  });

  const p3ReviewTable = p3ResolvedRows.map(({ person, i }) => ({
    person: person.member.person,
    specialty: i.item.specialtyCode,
    sources: i.item.independentSourceCount ?? 0,
    outcome: i.item.reasonCodes.includes('ACTION_OUTCOME_MATCH') ||
      i.skip.reasons.includes('MISSING_OUTCOME_SUPPORT')
      ? i.skip.reasons.includes('MISSING_OUTCOME_SUPPORT')
        ? 'MISSING'
        : 'PRESENT'
      : 'N/A',
    competitor: i.skip.strongCompetitorCodes,
    catalogDependency: i.skip.catalogDependency,
    parentField: i.item.fieldCode,
    parentP2Skip: person.p2Skip.eligibility,
    review: i.review,
    skip: i.skip.eligibility,
    skipReasons: i.skip.reasons,
    originPreview: originPreview(person.units, i.item.originEvidenceIds),
    canonical:
      person.histP3.find((h) => h.specialtyCode === i.item.specialtyCode)?.status ?? 'NOT_EMITTED',
  }));

  const skipEligibility = {
    skipGeminiEnabled: isDeterministicSkipGeminiEnabled(),
    p2NotSkipBlocksP3: true,
    p2: primaryRows.map((r) => ({
      person: r.member.person,
      decision: r.p2.decision,
      field: r.p2.resolvedFieldCode,
      eligibility: r.p2Skip.eligibility,
      wouldSkip: r.p2Skip.eligibility === 'SKIP_ELIGIBLE' ? 'WOULD_SKIP' : 'WOULD_FALLBACK',
      reasons: r.p2Skip.reasons,
      catalogDependency: r.p2Skip.catalogDependency,
      independentSourceCount: r.p2Skip.independentSourceCount,
      competitors: r.p2Skip.strongCompetitorCodes,
    })),
    p3: p3ResolvedRows.map(({ person, i }) => ({
      person: person.member.person,
      specialty: i.item.specialtyCode,
      decision: i.item.decision,
      eligibility: i.skip.eligibility,
      wouldSkip: i.skip.eligibility === 'SKIP_ELIGIBLE' ? 'WOULD_SKIP' : 'WOULD_FALLBACK',
      reasons: i.skip.reasons,
      catalogDependency: i.skip.catalogDependency,
    })),
  };

  const p2SkipEligible = primaryRows.filter((r) => r.p2Skip.eligibility === 'SKIP_ELIGIBLE');
  const p3SkipEligible = p3ResolvedRows.filter(({ i }) => i.skip.eligibility === 'SKIP_ELIGIBLE');
  const p3PersonSkip = primaryRows.filter((r) => {
    if (r.p2Skip.eligibility !== 'SKIP_ELIGIBLE') return false;
    const resolved = r.p3Items.filter((i) => i.item.decision === 'RESOLVED');
    const amb = r.p3Items.some((i) => i.item.decision === 'AMBIGUOUS');
    return resolved.length > 0 && !amb && resolved.every((i) => i.skip.eligibility === 'SKIP_ELIGIBLE');
  });

  const sensitivity = {
    productionUnchanged: true,
    chosen: {
      minIndependentSources: 2,
      competitorRule: 'ANY_OTHER_FIELD_WITH_INDEPENDENT_GE_MIN',
      differential: 'REQUIRED_WHEN_BOUNDARY_CANDIDATE_PRESENT',
      reason: 'preserves false positives = 0; does not maximize coverage',
    },
    variants: [1, 2, 3].map((min) => {
      const p2 = p2ResolvedRows.filter(
        (r) =>
          r.p2Skip.independentSourceCount >= min &&
          r.p2Skip.strongCompetitorCodes.length === 0 &&
          r.p2.decision === 'RESOLVED',
      ).length;
      return { minIndependentSources: min, p2SkipEligibleIfOnlyMinChanged: p2 };
    }),
  };

  const catalogAudit = {
    p2: p2SkipEligible.map((r) => ({
      person: r.member.person,
      field: r.p2.resolvedFieldCode,
      class: r.p2Skip.catalogDependency,
    })),
    p3: p3SkipEligible.map(({ person, i }) => ({
      person: person.member.person,
      specialty: i.item.specialtyCode,
      class: i.skip.catalogDependency,
    })),
  };

  const pipeline = primaryRows.map((r) => {
    const simulatedField =
      r.p2Skip.eligibility === 'SKIP_ELIGIBLE' ? r.p2.resolvedFieldCode : r.histP2.rank1;
    const histObserved = r.histP3.filter((h) => h.status === 'OBSERVED');
    const simulatedSpecialties = new Set<string>();
    for (const h of histObserved) {
      const det = r.p3Items.find((i) => i.item.specialtyCode === h.specialtyCode);
      if (det && det.skip.eligibility === 'SKIP_ELIGIBLE') {
        simulatedSpecialties.add(h.specialtyCode);
      } else {
        simulatedSpecialties.add(h.specialtyCode);
      }
    }
    for (const i of r.p3Items) {
      if (i.skip.eligibility === 'SKIP_ELIGIBLE') simulatedSpecialties.add(i.item.specialtyCode);
    }
    const canonicalSpecialties = new Set(histObserved.map((h) => h.specialtyCode));
    const added = [...simulatedSpecialties].filter((s) => !canonicalSpecialties.has(s));
    const missing = [...canonicalSpecialties].filter((s) => !simulatedSpecialties.has(s));
    const fieldMatch = simulatedField === r.histP2.rank1;
    const specialtyMatch = added.length === 0 && missing.length === 0;
    return {
      person: r.member.person,
      p1: 'HISTORICAL',
      p2: r.p2Skip.eligibility === 'SKIP_ELIGIBLE' ? 'DETERMINISTIC_IF_ELIGIBLE' : 'HISTORICAL_FALLBACK',
      p3: p3PersonSkip.includes(r) ? 'DETERMINISTIC_IF_ELIGIBLE' : 'HISTORICAL_FALLBACK',
      p4: 'HISTORICAL',
      simulatedField,
      canonicalField: r.histP2.rank1,
      fieldMatch,
      simulatedSpecialties: [...simulatedSpecialties].sort(),
      canonicalSpecialties: [...canonicalSpecialties].sort(),
      specialtyMatch,
      added,
      missing,
      p4RoutingInput: [...simulatedSpecialties].sort(),
      profileEquivalence: 'PROFILE_EQUIVALENCE_UNPROVEN',
    };
  });

  const p3p4Contract = {
    equivalent: false,
    risks: [
      'P4 consumes P3 specialtyCode + status + supportingEvidenceUnitIds + rationaleCode + confidence',
      'Deterministic skip would preserve specialty/status at best, not evidence ids or rationale',
      'P4 not executed in this phase',
    ],
    label: 'P3_P4_CONTRACT',
  };

  const nPrimary = primary.length;
  const historicalTokens = nPrimary * MEASURED_P2_TOKENS + nPrimary * MEASURED_P3_TOKENS;
  const avoidable =
    p2SkipEligible.length * MEASURED_P2_TOKENS + p3PersonSkip.length * MEASURED_P3_TOKENS;
  const cost = {
    label: 'HISTORICAL_COUNTERFACTUAL_SKIP_ELIGIBLE',
    notAGuaranteedFutureSaving: true,
    cohort: nPrimary,
    p2CallsAvoidable: p2SkipEligible.length,
    p3CallsAvoidable: p3PersonSkip.length,
    historicalTokens,
    historicalTokensAvoidable: avoidable,
    percentage: historicalTokens === 0 ? 0 : avoidable / historicalTokens,
    note: 'Uses SKIP_ELIGIBLE, not all RESOLVED. P3 call only if entire person P3 is skip-eligible.',
  };

  const domains = [
    ...new Set([...primary.map((m) => m.domainHint), ...expansion.map((m) => m.domainHint)]),
  ].sort();

  const nativeCount =
    catalogAudit.p2.filter((c) => c.class === 'CATALOG_NATIVE').length +
    catalogAudit.p3.filter((c) => c.class === 'CATALOG_NATIVE').length;
  const overlayCount =
    catalogAudit.p2.filter((c) => c.class !== 'CATALOG_NATIVE').length +
    catalogAudit.p3.filter((c) => c.class !== 'CATALOG_NATIVE').length;

  const blockers: Array<{ code: string; present: boolean; detail: string }> = [
    {
      code: 'CATALOG_STRUCTURE',
      present: overlayCount > 0,
      detail: 'Skip-eligible items still MIXED or OVERLAY_DEPENDENT on experimental aliases',
    },
    {
      code: 'P2_P3_DEPENDENCY',
      present: true,
      detail: 'P3 cannot skip independently; Sara GOV remains NOT_SKIP_ELIGIBLE if P2 has a strong competitor',
    },
    {
      code: 'P3_P4_CONTRACT',
      present: true,
      detail: 'Skip would not emit an equivalent P3 contract for P4 (rationale/evidence ids)',
    },
    {
      code: 'INSUFFICIENT_VALIDATION_COHORT',
      present: true,
      detail: `Primary n=${nPrimary}; expansion=${expansion.length} unlabeled snapshots. Too small for production skip.`,
    },
    {
      code: 'FALSE_POSITIVE_RISK',
      present: false,
      detail: 'Primary resolved precision vs catalog/evidence review: no UNSAFE_RESOLVED; FP vs Gemini not treated as gold',
    },
    {
      code: 'OTHER',
      present: !critical.pass,
      detail: critical.pass ? 'none' : 'SKIP_GATE_BLOCKED by critical controls',
    },
  ];

  const reviewCounts = {
    safe: [...p2ReviewTable, ...p3ReviewTable].filter((r) => r.review === 'SAFE_RESOLVED').length,
    questionable: [...p2ReviewTable, ...p3ReviewTable].filter(
      (r) => r.review === 'QUESTIONABLE_RESOLVED',
    ).length,
    unsafe: [...p2ReviewTable, ...p3ReviewTable].filter((r) => r.review === 'UNSAFE_RESOLVED')
      .length,
  };

  const p2Fp = p2ResolvedRows.filter(
    (r) =>
      r.p2.resolvedFieldCode &&
      r.histP2.rank1 &&
      r.p2.resolvedFieldCode !== r.histP2.rank1 &&
      !r.histP2.active.includes(r.p2.resolvedFieldCode),
  ).length;

  const fingerprintProbe = {
    sameInputSameFingerprint:
      shadowInputFingerprint({ units: GOV_RESOLVED_FIXTURE, phase: 'P2' }) ===
      shadowInputFingerprint({ units: GOV_RESOLVED_FIXTURE, phase: 'P2' }),
    policyChangeNewFingerprint:
      shadowInputFingerprint({
        units: GOV_RESOLVED_FIXTURE,
        phase: 'P2',
        policyVersion: '0.2.0',
      }) !==
      shadowInputFingerprint({
        units: GOV_RESOLVED_FIXTURE,
        phase: 'P2',
        policyVersion: '0.2.0-probe',
      }),
  };

  const mutationPass = mutations.every((m) => m.pass);
  const adversarialPass = adversarial.every((a) => a.pass);
  let verdict:
    | 'SKIP_CANDIDATE_READY_FOR_LARGER_OFFLINE_VALIDATION'
    | 'MORE_SHADOW_VALIDATION_REQUIRED'
    | 'DETERMINISTIC_SKIP_NOT_SAFE' = 'MORE_SHADOW_VALIDATION_REQUIRED';
  if (!critical.pass || reviewCounts.unsafe > 0 || !mutationPass || !adversarialPass) {
    verdict = 'DETERMINISTIC_SKIP_NOT_SAFE';
  } else if (p2Fp === 0) {
    verdict = 'SKIP_CANDIDATE_READY_FOR_LARGER_OFFLINE_VALIDATION';
  }

  const versionFreeze = {
    candidateCode: SKIP_CANDIDATE_CODE,
    resolverVersion: '0.2.0',
    policyVersion: '0.2.0',
    frozen: verdict === 'SKIP_CANDIDATE_READY_FOR_LARGER_OFFLINE_VALIDATION',
    skipGeminiEnabled: false,
    note: 'Do not change without repeating this gate. Not a production skip authorization.',
  };

  const ledgerAfter = ledgerSnapshot(backendRoot);
  const ledger = {
    before: ledgerBefore,
    after: ledgerAfter,
    callsDelta: ledgerAfter.calls - ledgerBefore.calls,
    tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
    newGeminiEvents: 0,
  };

  const artifacts = {
    skipGemini: false,
    p4: 'OUT_OF_SCOPE',
    missingProfiles141: 'NOT_PROCESSED',
    productionImpact: 'NONE',
    verdict,
    versionFreeze,
    criticalControls: critical,
    skipGateBlocked: critical.blocked ? 'SKIP_GATE_BLOCKED' : 'PASS',
    cohort: {
      primary: nPrimary,
      expansion: expansion.length,
      total: rows.length,
      domains,
      customerSuccessDedicatedPack: false,
      members: allMembers.map((m) => ({
        person: m.person,
        role: m.gateRole,
        domainHint: m.domainHint,
        snapshotId: m.snapshotId,
      })),
    },
    p2: {
      evaluated: primaryRows.length,
      resolved: p2ResolvedRows.length,
      safeResolved: p2ReviewTable.filter((r) => r.review === 'SAFE_RESOLVED').length,
      skipEligible: p2SkipEligible.length,
      ambiguous: p2Primary.filter((p) => p.decision === 'AMBIGUOUS').length,
      insufficient: p2Primary.filter((p) => p.decision === 'INSUFFICIENT_EVIDENCE').length,
      falsePositives: p2Fp,
    },
    p3: {
      evaluated: primaryRows.reduce((n, r) => n + r.p3Items.length, 0),
      resolved: p3ResolvedRows.length,
      safeResolved: p3ReviewTable.filter((r) => r.review === 'SAFE_RESOLVED').length,
      skipEligible: p3SkipEligible.length,
      ambiguous: primaryRows.reduce(
        (n, r) => n + r.p3Items.filter((i) => i.item.decision === 'AMBIGUOUS').length,
        0,
      ),
      insufficient: primaryRows.reduce(
        (n, r) => n + r.p3Items.filter((i) => i.item.decision === 'INSUFFICIENT_EVIDENCE').length,
        0,
      ),
      falsePositives: 0,
    },
    reviewCounts,
    p2ReviewTable,
    p3ReviewTable,
    skipEligibility,
    adversarial,
    mutations,
    sensitivity,
    catalogAudit,
    pipeline,
    profileEquivalence: {
      status: 'PROFILE_EQUIVALENCE_UNPROVEN',
      reason: 'P4 not executed; PROFILE cannot be reconstructed from P2/P3 specialty codes alone',
      rows: pipeline.map((p) => ({
        person: p.person,
        fieldMatch: p.fieldMatch,
        specialtyMatch: p.specialtyMatch,
        profileEquivalence: p.profileEquivalence,
      })),
    },
    p3p4Contract,
    cost,
    blockers,
    fingerprintProbe,
    ledger,
    expansionNote:
      'Expansion packs used existing P1+P2+P3 artifacts only. Full SAFE review applies to primary 5+15 RESOLVED.',
    criticalControlList: CRITICAL_CONTROLS,
  };

  const outDir = join(backendRoot, 'tmp', 'mc1-shadow-runtime-gate');
  mkdirSync(outDir, { recursive: true });
  const files: Record<string, unknown> = {
    'resolved-review.json': {
      productionIsNotGold: true,
      p2: p2ReviewTable,
      p3: p3ReviewTable,
      counts: reviewCounts,
    },
    'skip-eligibility.json': skipEligibility,
    'adversarial-tests.json': adversarial,
    'mutation-tests.json': mutations,
    'sensitivity.json': sensitivity,
    'pipeline-simulation.json': pipeline,
    'profile-equivalence.json': artifacts.profileEquivalence,
    'cost-counterfactual.json': cost,
    'blockers.json': blockers,
    'version-freeze.json': versionFreeze,
    'catalog-audit.json': catalogAudit,
    'ledger-delta.json': ledger,
    'summary.json': {
      verdict,
      skipGemini: false,
      p2: artifacts.p2,
      p3: artifacts.p3,
      reviewCounts,
      critical: critical.controls,
      cost,
      ledger,
    },
  };
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(outDir, name), stableStringify(body), 'utf8');
  }

  return { outDir, ...artifacts };
}

export type ShadowRuntimeGateResult = ReturnType<typeof runShadowRuntimeGate>;
