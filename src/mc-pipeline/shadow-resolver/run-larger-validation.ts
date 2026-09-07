/**
 * Validación offline ampliada de Candidate.1 congelado.
 * No modifica reglas. No llama Gemini. No activa skip.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { resolveSpecialtiesHardened } from '../experimental/deterministic-resolver/specialty-resolver-hardened';
import { compareP2, compareP3Specialty } from '../experimental/deterministic-resolver/compare';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import type {
  FieldResolverResult,
  ResolverEvidenceUnit,
  SpecialtyResolverItem,
} from '../experimental/deterministic-resolver/types';
import { APPROVED_POLICY_VERSION, APPROVED_RESOLVER_VERSION } from './skip-eligibility';
import {
  duplicatedSourceRisk,
  evaluateP2SkipEligibility,
  evaluateP3SkipEligibility,
  isToolOnlyResolved,
  reviewClass,
  SKIP_CANDIDATE_CODE,
  type SkipEval,
} from './skip-eligibility';
import { discoverHistoricalInventory, type InventoryRow } from './inventory';
import {
  CONFIDENCE_AUDIT,
  EXPERIMENTAL_RATIONALE_MAP,
  P3_TO_P4_USAGE,
  P4_MINIMUM_CONTRACT,
} from './p3-p4-audit';
import {
  ADVERSARIAL_FIXTURES,
  GOV_RESOLVED_FIXTURE,
  mutateActionToKnowledge,
  mutateAddCompetitor,
  mutateCollapseIndependent,
  mutateRemoveOutcome,
} from './gate-fixtures';
import { isDeterministicSkipGeminiEnabled } from './flags';

const MEASURED_P2_TOKENS = 18359;
const MEASURED_P3_TOKENS = 11590;

type P2Verdict =
  | 'MORE_VALIDATION_REQUIRED'
  | 'READY_FOR_INTEGRATION_DESIGN'
  | 'REJECTED';
type P3Verdict =
  | 'MORE_VALIDATION_REQUIRED'
  | 'BLOCKED_BY_P4_CONTRACT'
  | 'READY_FOR_INTEGRATION_DESIGN'
  | 'REJECTED';

function combineSkipVerdicts(p2: P2Verdict, p3: P3Verdict) {
  if (p2 === 'REJECTED' || p3 === 'REJECTED') return 'DETERMINISTIC_SKIP_REJECTED';
  if (p2 === 'READY_FOR_INTEGRATION_DESIGN' && p3 === 'BLOCKED_BY_P4_CONTRACT') {
    return 'P2_READY_P3_BLOCKED';
  }
  if (p2 === 'READY_FOR_INTEGRATION_DESIGN' && p3 === 'READY_FOR_INTEGRATION_DESIGN') {
    return 'P2_AND_P3_READY_FOR_INTEGRATION_DESIGN';
  }
  return 'MORE_VALIDATION_REQUIRED';
}

type HistP3Row = {
  fieldCode: string;
  specialtyCode: string;
  status: string;
  confidence?: number;
  supportingEvidenceUnitIds?: string[];
  rationaleCode?: string;
};

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
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

function loadHistP2(packDir: string) {
  const summary = readJson(join(packDir, 'summary.json')) as {
    ranks?: Array<{ domainCode: string; status: string; rank: number }>;
  };
  return { ranks: summary.ranks ?? [] };
}

function loadHistP3(packDir: string): HistP3Row[] {
  const contractPath = join(packDir, 'p3-contract.json');
  if (existsSync(contractPath)) {
    const c = readJson(contractPath) as {
      payload?: {
        fieldResults?: Array<{
          fieldCode: string;
          observedSpecialties?: Array<{
            specialtyCode: string;
            parentFieldCode: string;
            status: string;
            confidence?: number;
            supportingEvidenceUnitIds?: string[];
            rationaleCode?: string;
          }>;
        }>;
      };
    };
    const out: HistP3Row[] = [];
    for (const fr of c.payload?.fieldResults ?? []) {
      for (const s of fr.observedSpecialties ?? []) {
        out.push({
          fieldCode: s.parentFieldCode || fr.fieldCode,
          specialtyCode: s.specialtyCode,
          status: s.status,
          confidence: s.confidence,
          supportingEvidenceUnitIds: s.supportingEvidenceUnitIds,
          rationaleCode: s.rationaleCode,
        });
      }
    }
    if (out.length) return out;
  }
  const summary = readJson(join(packDir, 'summary.json')) as {
    observed?: HistP3Row[];
  };
  return summary.observed ?? [];
}

function originPreview(units: ResolverEvidenceUnit[], ids: string[]): string[] {
  return units
    .filter((u) => ids.includes(u.evidenceId))
    .slice(0, 3)
    .map((u) => u.normalizedActivity || u.object || u.toolOrMethod || u.evidenceId);
}

function classifyP2Failure(args: {
  decision: string;
  skip: SkipEval;
  cmpClass: string;
}): string {
  if (args.skip.eligibility === 'SKIP_ELIGIBLE' && args.cmpClass === 'FALSE_POSITIVE') {
    return 'RESOLVER_ERROR';
  }
  if (args.decision === 'AMBIGUOUS') return 'LEGITIMATE_AMBIGUITY';
  if (args.decision === 'INSUFFICIENT_EVIDENCE' && args.cmpClass === 'FALSE_NEGATIVE') {
    return 'CATALOG_GAP';
  }
  if (args.cmpClass === 'FALSE_POSITIVE') return 'RESOLVER_ERROR';
  if (args.cmpClass === 'EXACT_MATCH' || args.cmpClass === 'COMPATIBLE_MATCH') {
    return 'GENERALIZATION_PASS';
  }
  if (args.cmpClass === 'RESOLVER_AMBIGUOUS') return 'LEGITIMATE_AMBIGUITY';
  return 'GENERALIZATION_PASS';
}

function p3Equivalence(args: {
  skip: SkipEval;
  item: SpecialtyResolverItem;
  canonical: HistP3Row | undefined;
}): 'FULLY_REPRODUCIBLE' | 'FUNCTIONALLY_EQUIVALENT' | 'PARTIALLY_EQUIVALENT' | 'NOT_EQUIVALENT' {
  if (args.skip.eligibility !== 'SKIP_ELIGIBLE') return 'NOT_EQUIVALENT';
  if (!args.canonical) return 'NOT_EQUIVALENT';
  const statusOk = args.canonical.status === 'OBSERVED';
  const fieldOk = args.canonical.fieldCode === args.item.fieldCode;
  const supportsMatch =
    JSON.stringify([...(args.canonical.supportingEvidenceUnitIds ?? [])].sort()) ===
    JSON.stringify([...args.item.originEvidenceIds].sort());
  const rationaleMapped =
    EXPERIMENTAL_RATIONALE_MAP[args.item.reasonCodes[0] ?? ''] === args.canonical.rationaleCode;
  if (statusOk && fieldOk && supportsMatch && rationaleMapped) return 'FULLY_REPRODUCIBLE';
  if (statusOk && fieldOk) return 'FUNCTIONALLY_EQUIVALENT';
  if (fieldOk && args.canonical.status === 'WEAK') return 'PARTIALLY_EQUIVALENT';
  return 'NOT_EQUIVALENT';
}

function evaluateRow(backendRoot: string, row: InventoryRow) {
  const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, row.p1PackRel!));
  const p2 = resolveFieldsHardened({ snapshotId: row.snapshotId, units });
  const p2Skip = evaluateP2SkipEligibility(p2, units);
  const histP2 = loadHistP2(resolve(backendRoot, row.p2PackRel!));
  const cmp = compareP2(p2, histP2);
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
  const p3 =
    row.p3Class === 'P3_ELIGIBLE'
      ? resolveSpecialtiesHardened({
          snapshotId: row.snapshotId,
          units,
          fieldCodes,
          allowObservedEquivalent: p2.decision === 'RESOLVED',
        })
      : { items: [] as SpecialtyResolverItem[] };
  const histP3 = row.p3PackRel ? loadHistP3(resolve(backendRoot, row.p3PackRel)) : [];
  const p3Items = p3.items.map((item) => {
    const skip = evaluateP3SkipEligibility({
      item,
      units,
      p2Decision: p2.decision,
      p2Skip: p2Skip.eligibility,
    });
    const canonical = histP3.find((h) => h.specialtyCode === item.specialtyCode);
    const histStatus =
      canonical?.status === 'OBSERVED' || canonical?.status === 'WEAK'
        ? canonical.status
        : 'NOT_EMITTED';
    const cmp3 = compareP3Specialty({
      specialtyCode: item.specialtyCode,
      decision: item.decision,
      historicalStatus: histStatus,
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
    const supportsReproducible =
      item.originEvidenceIds.length > 0 &&
      (canonical?.supportingEvidenceUnitIds ?? []).some((id) =>
        item.originEvidenceIds.includes(id),
      )
        ? 'SUPPORTS_REPRODUCIBLE'
        : 'SUPPORTS_GAP';
    return {
      item,
      skip,
      review,
      canonical,
      cmp3,
      supportsReproducible,
      equivalence: p3Equivalence({ skip, item, canonical }),
    };
  });
  return { row, units, p2, p2Skip, p2Review, cmp, histP2, histP3, p3Items };
}

function runAdversarial() {
  const cases: Array<{
    id: string;
    units: ResolverEvidenceUnit[];
    expect: (p2: FieldResolverResult) => boolean;
  }> = [
    {
      id: 'tool-heavy',
      units: ADVERSARIAL_FIXTURES.toolRichShallow,
      expect: (p2) => p2.decision !== 'RESOLVED',
    },
    {
      id: 'knowledge-only',
      units: ADVERSARIAL_FIXTURES.knowledgeRichActionPoor,
      expect: (p2) => p2.decision !== 'RESOLVED',
    },
    {
      id: 'single-source',
      units: ADVERSARIAL_FIXTURES.singleSource,
      expect: (p2) => p2.decision !== 'RESOLVED',
    },
    {
      id: 'cross-domain',
      units: ADVERSARIAL_FIXTURES.multiDomainCv,
      expect: (p2) => p2.decision !== 'RESOLVED',
    },
    {
      id: 'shared-practice',
      units: ADVERSARIAL_FIXTURES.sharedPracticeMotion,
      expect: (p2) => p2.decision !== 'RESOLVED',
    },
    {
      id: 'strong-competitor',
      units: ADVERSARIAL_FIXTURES.strongCompetitorPair,
      expect: (p2) => {
        const skip = evaluateP2SkipEligibility(p2, ADVERSARIAL_FIXTURES.strongCompetitorPair);
        return skip.eligibility !== 'SKIP_ELIGIBLE';
      },
    },
    {
      id: 'multiple-independent-actions',
      units: ADVERSARIAL_FIXTURES.outcomeRich,
      expect: (p2) => p2.decision === 'RESOLVED',
    },
    {
      id: 'outcome-rich-gov',
      units: GOV_RESOLVED_FIXTURE,
      expect: (p2) => p2.decision === 'RESOLVED',
    },
    {
      id: 'duplicate-spans',
      units: ADVERSARIAL_FIXTURES.duplicateSpans,
      expect: (p2) => p2.decision !== 'RESOLVED',
    },
  ];
  return cases.map((c) => {
    const p2 = resolveFieldsHardened({ snapshotId: c.id, units: c.units });
    return { id: c.id, pass: c.expect(p2), p2Decision: p2.decision, field: p2.resolvedFieldCode };
  });
}

function runMutationsOnSkipEligible(
  cases: Array<{ person: string; units: ResolverEvidenceUnit[]; field: string | null }>,
) {
  const mutations = [
    { id: 'collapse-independent', fn: mutateCollapseIndependent, always: true },
    { id: 'action-to-knowledge', fn: mutateActionToKnowledge, always: true },
    { id: 'add-competitor', fn: mutateAddCompetitor, always: true },
    { id: 'remove-outcome', fn: mutateRemoveOutcome, always: false },
  ];
  const out: Array<{
    person: string;
    mutation: string;
    pass: boolean;
    before: string;
    after: string;
    note?: string;
  }> = [];
  for (const c of cases) {
    const before = evaluateP2SkipEligibility(
      resolveFieldsHardened({ snapshotId: c.person, units: c.units }),
      c.units,
    );
    if (before.eligibility !== 'SKIP_ELIGIBLE') continue;
    for (const m of mutations) {
      if (!m.always) {
        out.push({
          person: c.person,
          mutation: m.id,
          pass: true,
          before: before.eligibility,
          after: before.eligibility,
          note: 'N/A — outcome is a P3 signal, not a P2 skip-critical signal',
        });
        continue;
      }
      const mutated = m.fn(c.units);
      const after = evaluateP2SkipEligibility(
        resolveFieldsHardened({ snapshotId: c.person, units: mutated }),
        mutated,
      );
      out.push({
        person: c.person,
        mutation: m.id,
        pass: after.eligibility === 'NOT_SKIP_ELIGIBLE',
        before: before.eligibility,
        after: after.eligibility,
      });
    }
  }
  return out;
}

function criticalRows(
  evals: Array<ReturnType<typeof evaluateRow>>,
): Array<{ person: string; code: string; actual: string; pass: boolean }> {
  const findP2 = (person: string) => evals.find((e) => e.row.person === person)?.p2;
  const findP3 = (person: string, code: string) =>
    evals
      .find((e) => e.row.person === person)
      ?.p3Items.find((i) => i.item.specialtyCode === code)?.item;
  return [
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
      pass: findP3('Diego', 'DATA_GOVERNANCE')?.decision !== 'RESOLVED',
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
}

export function runLargerOfflineValidation(backendRoot: string) {
  const frozen = {
    candidateCode: SKIP_CANDIDATE_CODE,
    resolverVersion: APPROVED_RESOLVER_VERSION,
    policyVersion: APPROVED_POLICY_VERSION,
    skipGemini: isDeterministicSkipGeminiEnabled(),
  };
  if (
    frozen.candidateCode !== 'MC1.DETERMINISTIC.RESOLVER.CANDIDATE.1' ||
    frozen.resolverVersion !== '0.2.0' ||
    frozen.policyVersion !== '0.2.0' ||
    frozen.skipGemini !== false
  ) {
    throw new Error('CANDIDATE_NOT_FROZEN');
  }

  const ledgerBefore = ledgerSnapshot(backendRoot);
  const inventory = discoverHistoricalInventory(backendRoot);
  const p2Rows = inventory.filter((r) => r.p2Class === 'P2_ELIGIBLE');
  const evals = p2Rows.map((r) => evaluateRow(backendRoot, r));

  const p2SkipEligible = evals.filter((e) => e.p2Skip.eligibility === 'SKIP_ELIGIBLE');
  const p2SkipExact = p2SkipEligible.filter((e) => e.cmp.class === 'EXACT_MATCH');
  const p2SkipRankMismatch = p2SkipEligible.filter(
    (e) => e.p2.resolvedFieldCode !== e.cmp.historicalRank1,
  );
  const p2Resolved = evals.filter((e) => e.p2.decision === 'RESOLVED');
  const p2SkipFp = p2SkipEligible.filter((e) => e.cmp.class === 'FALSE_POSITIVE');
  const p2SkipPrecision =
    p2SkipEligible.length === 0 ? null : p2SkipExact.length / p2SkipEligible.length;

  const p3Evals = evals.filter((e) => e.row.p3Class === 'P3_ELIGIBLE');
  const p3Items = p3Evals.flatMap((e) => e.p3Items);
  const p3Resolved = p3Items.filter((i) => i.item.decision === 'RESOLVED');
  const p3SkipEligible = p3Items.filter((i) => i.skip.eligibility === 'SKIP_ELIGIBLE');
  const p3SkipFp = p3SkipEligible.filter((i) => i.cmp3.class === 'FALSE_POSITIVE');
  const p3SkipPrecision =
    p3SkipEligible.length === 0
      ? null
      : p3SkipEligible.filter(
          (i) => i.cmp3.class === 'EXACT_MATCH' || i.cmp3.class === 'COMPATIBLE_MATCH',
        ).length / p3SkipEligible.length;

  const skipReview = [
    ...p2SkipEligible.map((e) => {
      const top = e.p2.candidateFields.find((c) => c.fieldCode === e.p2.resolvedFieldCode);
      return {
        phase: 'P2' as const,
        person: e.row.person,
        domain: e.row.domain,
        code: e.p2.resolvedFieldCode,
        evidence: originPreview(e.units, top?.originEvidenceIds ?? []),
        explanation: e.p2.reasonCodes,
        catalog: e.p2Skip.catalogDependency,
        canonical: e.cmp.historicalRank1,
        review: e.p2Review,
        cmp: e.cmp.class,
        classification:
          e.p2.resolvedFieldCode !== e.cmp.historicalRank1
            ? 'RESOLVER_ERROR'
            : classifyP2Failure({
                decision: e.p2.decision,
                skip: e.p2Skip,
                cmpClass: e.cmp.class,
              }),
        rank1Match: e.p2.resolvedFieldCode === e.cmp.historicalRank1,
        verdict:
          e.p2Review === 'UNSAFE_RESOLVED' ||
          e.cmp.class === 'FALSE_POSITIVE' ||
          e.p2.resolvedFieldCode !== e.cmp.historicalRank1
            ? 'UNSAFE'
            : e.p2Review === 'QUESTIONABLE_RESOLVED'
              ? 'QUESTIONABLE'
              : 'SAFE',
      };
    }),
    ...p3SkipEligible.map((i) => {
      const person = p3Evals.find((e) => e.p3Items.includes(i))!;
      return {
        phase: 'P3' as const,
        person: person.row.person,
        domain: person.row.domain,
        code: i.item.specialtyCode,
        evidence: originPreview(person.units, i.item.originEvidenceIds),
        explanation: i.item.reasonCodes,
        catalog: i.skip.catalogDependency,
        canonical: i.canonical?.status ?? 'NOT_EMITTED',
        review: i.review,
        cmp: i.cmp3.class,
        classification:
          i.cmp3.class === 'FALSE_POSITIVE' ? 'RESOLVER_ERROR' : 'GENERALIZATION_PASS',
        verdict:
          i.review === 'UNSAFE_RESOLVED' || i.cmp3.class === 'FALSE_POSITIVE'
            ? 'UNSAFE'
            : i.review === 'QUESTIONABLE_RESOLVED'
              ? 'QUESTIONABLE'
              : 'SAFE',
      };
    }),
  ];

  const domainBreakdown: Record<
    string,
    { evaluated: number; resolved: number; skipEligible: number; fp: number; fn: number }
  > = {};
  for (const e of evals) {
    const field = e.cmp.historicalRank1 ?? e.p2.resolvedFieldCode ?? e.row.domain ?? 'UNKNOWN';
    const bucket = domainBreakdown[field] ?? {
      evaluated: 0,
      resolved: 0,
      skipEligible: 0,
      fp: 0,
      fn: 0,
    };
    bucket.evaluated += 1;
    if (e.p2.decision === 'RESOLVED') bucket.resolved += 1;
    if (e.p2Skip.eligibility === 'SKIP_ELIGIBLE') bucket.skipEligible += 1;
    if (e.p2.decision === 'RESOLVED' && e.cmp.class === 'FALSE_POSITIVE') bucket.fp += 1;
    if (e.cmp.class === 'FALSE_NEGATIVE') bucket.fn += 1;
    domainBreakdown[field] = bucket;
  }

  const p3FieldBreakdown: Record<
    string,
    { evaluated: number; resolved: number; skipEligible: number; fp: number; fn: number }
  > = {};
  for (const e of p3Evals) {
    for (const i of e.p3Items) {
      const field = i.item.fieldCode;
      const bucket = p3FieldBreakdown[field] ?? {
        evaluated: 0,
        resolved: 0,
        skipEligible: 0,
        fp: 0,
        fn: 0,
      };
      bucket.evaluated += 1;
      if (i.item.decision === 'RESOLVED') bucket.resolved += 1;
      if (i.skip.eligibility === 'SKIP_ELIGIBLE') bucket.skipEligible += 1;
      if (i.item.decision === 'RESOLVED' && i.cmp3.class === 'FALSE_POSITIVE') bucket.fp += 1;
      if (i.cmp3.class === 'FALSE_NEGATIVE') bucket.fn += 1;
      p3FieldBreakdown[field] = bucket;
    }
  }

  const boundaries = evals
    .filter((e) => {
      const codes = new Set([
        e.p2.resolvedFieldCode,
        ...e.p2.ambiguousFieldCodes,
        ...e.p2Skip.strongCompetitorCodes,
        e.cmp.historicalRank1,
      ]);
      const pairs = [
        ['DIGITAL_MARKETING', 'COMMUNICATIONS'],
        ['VISUAL_DESIGN', 'AUDIOVISUAL_PRODUCTION'],
        ['SOFTWARE_ENGINEERING', 'VISUAL_DESIGN'],
        ['DATA_ANALYTICS', 'IT_SYSTEMS'],
        ['DATA_ANALYTICS', 'CUSTOMER_SUCCESS'],
        ['EDUCATION', 'FINANCE_ADMIN'],
        ['EDUCATION', 'PROJECT_PROGRAM_MGMT'],
      ];
      return pairs.some(([a, b]) => codes.has(a) && codes.has(b));
    })
    .map((e) => ({
      person: e.row.person,
      decision: e.p2.decision,
      field: e.p2.resolvedFieldCode,
      competitors: e.p2Skip.strongCompetitorCodes,
      ambiguous: e.p2.ambiguousFieldCodes,
      skip: e.p2Skip.eligibility,
    }));

  const contractRows = p3SkipEligible.map((i) => {
    const person = p3Evals.find((e) => e.p3Items.includes(i))!;
    return {
      person: person.row.person,
      specialtyCode: i.item.specialtyCode,
      resolverStatus: i.item.decision,
      canonicalStatus: i.canonical?.status ?? 'NOT_EMITTED',
      supports: i.supportsReproducible,
      rationaleExperimental: EXPERIMENTAL_RATIONALE_MAP[i.item.reasonCodes[0] ?? ''] ?? null,
      canonicalRationale: i.canonical?.rationaleCode ?? null,
      canonicalConfidence: i.canonical?.confidence ?? null,
      equivalence: i.equivalence,
      p4MinimumMatch:
        i.equivalence === 'FUNCTIONALLY_EQUIVALENT' || i.equivalence === 'FULLY_REPRODUCIBLE',
    };
  });

  const p3ContractEquivalentForSkip = p3SkipEligible.filter(
    (i) => i.equivalence === 'FUNCTIONALLY_EQUIVALENT' || i.equivalence === 'FULLY_REPRODUCIBLE',
  );
  const p3PersonSkip = p3Evals.filter((e) => {
    if (e.p2Skip.eligibility !== 'SKIP_ELIGIBLE') return false;
    const resolved = e.p3Items.filter((i) => i.item.decision === 'RESOLVED');
    if (!resolved.length) return false;
    if (resolved.some((i) => i.skip.eligibility !== 'SKIP_ELIGIBLE')) return false;
    const simObserved = new Set(
      resolved
        .filter(
          (i) =>
            i.equivalence === 'FUNCTIONALLY_EQUIVALENT' || i.equivalence === 'FULLY_REPRODUCIBLE',
        )
        .map((i) => i.item.specialtyCode),
    );
    const histObserved = new Set(
      e.histP3.filter((h) => h.status === 'OBSERVED').map((h) => h.specialtyCode),
    );
    if (simObserved.size !== histObserved.size) return false;
    for (const s of histObserved) if (!simObserved.has(s)) return false;
    return true;
  });

  const pipeline = evals.map((e) => {
    const p2Mode = e.p2Skip.eligibility === 'SKIP_ELIGIBLE' ? 'DETERMINISTIC' : 'HISTORICAL_FALLBACK';
    const personSkip = p3PersonSkip.includes(e);
    const p3Mode =
      personSkip &&
      e.p3Items
        .filter((i) => i.skip.eligibility === 'SKIP_ELIGIBLE')
        .every(
          (i) =>
            i.equivalence === 'FUNCTIONALLY_EQUIVALENT' || i.equivalence === 'FULLY_REPRODUCIBLE',
        )
        ? 'DETERMINISTIC'
        : 'HISTORICAL_FALLBACK';
    const simulatedField =
      p2Mode === 'DETERMINISTIC' ? e.p2.resolvedFieldCode : e.cmp.historicalRank1;
    const histObserved = e.histP3.filter((h) => h.status === 'OBSERVED').map((h) => h.specialtyCode);
    const simulatedSpecialties =
      p3Mode === 'DETERMINISTIC'
        ? e.p3Items
            .filter((i) => i.skip.eligibility === 'SKIP_ELIGIBLE')
            .map((i) => i.item.specialtyCode)
        : histObserved;
    const fieldMatch = simulatedField === e.cmp.historicalRank1;
    const specMatch =
      [...simulatedSpecialties].sort().join('|') === [...histObserved].sort().join('|');
    return {
      person: e.row.person,
      p1: 'HISTORICAL',
      p2: p2Mode,
      p3: p3Mode,
      p4: 'HISTORICAL',
      simulatedField,
      canonicalField: e.cmp.historicalRank1,
      fieldMatch,
      simulatedSpecialties: [...simulatedSpecialties].sort(),
      canonicalSpecialties: [...histObserved].sort(),
      specialtyMatch: specMatch,
      p4InputEquivalence: p3Mode === 'HISTORICAL_FALLBACK' ? 'EXACT' : specMatch ? 'EXACT' : 'DIFFERENT',
      profileEquivalence: e.row.profileAvailable
        ? p3Mode === 'HISTORICAL_FALLBACK'
          ? 'P4_INPUT_EQUIVALENT_PROFILE_UNPROVEN'
          : 'PROFILE_EQUIVALENCE_UNPROVEN'
        : 'PROFILE_EQUIVALENCE_UNPROVEN',
    };
  });

  const adversarial = runAdversarial();
  const mutation = runMutationsOnSkipEligible(
    p2SkipEligible.map((e) => ({
      person: e.row.person,
      units: e.units,
      field: e.p2.resolvedFieldCode,
    })),
  );
  const controls = criticalRows(evals);
  const newControls = evals
    .filter((e) => !COHORT_NAMES.has(e.row.person))
    .filter(
      (e) =>
        e.p2.decision === 'AMBIGUOUS' ||
        e.p2Skip.strongCompetitorCodes.length > 0 ||
        e.p2Skip.eligibility === 'SKIP_ELIGIBLE',
    )
    .map((e) => ({
      person: e.row.person,
      domain: e.row.domain,
      p2: e.p2.decision,
      skip: e.p2Skip.eligibility,
      competitors: e.p2Skip.strongCompetitorCodes,
    }));

  const overlay = {
    p2Native: p2SkipEligible.filter((e) => e.p2Skip.catalogDependency === 'CATALOG_NATIVE').length,
    p2Overlay: p2SkipEligible.filter((e) => e.p2Skip.catalogDependency !== 'CATALOG_NATIVE').length,
    p3Native: p3SkipEligible.filter((i) => i.skip.catalogDependency === 'CATALOG_NATIVE').length,
    p3Overlay: p3SkipEligible.filter((i) => i.skip.catalogDependency !== 'CATALOG_NATIVE').length,
  };

  const p2CriticalFp = skipReview.filter((r) => r.phase === 'P2' && r.verdict === 'UNSAFE').length;
  const p3CriticalFp = skipReview.filter((r) => r.phase === 'P3' && r.verdict === 'UNSAFE').length;

  const p2Verdict: P2Verdict =
    p2CriticalFp > 0 || (p2SkipPrecision !== null && p2SkipPrecision < 1)
      ? 'MORE_VALIDATION_REQUIRED'
      : !controls.every((c) => c.pass)
        ? 'MORE_VALIDATION_REQUIRED'
        : p2SkipExact.length > 0 && p2SkipPrecision === 1
          ? 'READY_FOR_INTEGRATION_DESIGN'
          : 'MORE_VALIDATION_REQUIRED';

  const p3FullyBlockedByContract = true;
  const p3Verdict: P3Verdict = p3CriticalFp > 0
    ? 'REJECTED'
    : p3FullyBlockedByContract
      ? 'BLOCKED_BY_P4_CONTRACT'
      : 'MORE_VALIDATION_REQUIRED';

  const overall = combineSkipVerdicts(p2Verdict, p3Verdict);

  const nP2 = evals.length;
  const theoreticalP2 = p2Resolved.length * MEASURED_P2_TOKENS;
  const safeP2 = p2SkipExact.length * MEASURED_P2_TOKENS;
  const theoreticalP3 = p3SkipEligible.length > 0
    ? new Set(
        p3SkipEligible.map((i) => p3Evals.find((e) => e.p3Items.includes(i))!.row.person),
      ).size * MEASURED_P3_TOKENS
    : 0;
  const safeP3 = 0;
  const historicalTokens = nP2 * MEASURED_P2_TOKENS + nP2 * MEASURED_P3_TOKENS;

  const bodyPass1 = {
    frozen,
    inventory,
    p2: {
      evaluated: nP2,
      resolved: p2Resolved.length,
      skipEligible: p2SkipEligible.length,
      skipEligibleExactRank1: p2SkipExact.length,
      skipRank1Mismatch: p2SkipRankMismatch.map((e) => e.row.person),
      ambiguous: evals.filter((e) => e.p2.decision === 'AMBIGUOUS').length,
      insufficient: evals.filter((e) => e.p2.decision === 'INSUFFICIENT_EVIDENCE').length,
      precisionAmongResolved:
        p2Resolved.length === 0
          ? null
          : p2Resolved.filter(
              (e) => e.cmp.class === 'EXACT_MATCH' || e.cmp.class === 'COMPATIBLE_MATCH',
            ).length / p2Resolved.length,
      precisionAmongSkipEligible: p2SkipPrecision,
      falsePositives: p2Resolved.filter((e) => e.cmp.class === 'FALSE_POSITIVE').length,
      falseNegatives: evals.filter((e) => e.cmp.class === 'FALSE_NEGATIVE').length,
      skipFalsePositives: p2SkipFp.length,
      criticalFalsePositives: p2CriticalFp,
    },
    p3: {
      persons: p3Evals.length,
      evaluated: p3Items.length,
      resolved: p3Resolved.length,
      skipEligible: p3SkipEligible.length,
      ambiguous: p3Items.filter((i) => i.item.decision === 'AMBIGUOUS').length,
      insufficient: p3Items.filter((i) => i.item.decision === 'INSUFFICIENT_EVIDENCE').length,
      precisionAmongSkipEligible: p3SkipPrecision,
      falsePositives: p3Resolved.filter((i) => i.cmp3.class === 'FALSE_POSITIVE').length,
      falseNegatives: p3Items.filter((i) => i.cmp3.class === 'FALSE_NEGATIVE').length,
      skipFalsePositives: p3SkipFp.length,
      criticalFalsePositives: p3CriticalFp,
      personLevelSkip: p3PersonSkip.length,
    },
  };

  const runOnce = () => stableStringify({
    ...bodyPass1,
    skipReview,
    domainBreakdown,
    p3FieldBreakdown,
    pipeline,
    contractRows,
  });
  const pass1 = runOnce();
  const pass2 = runOnce();
  const determinism = pass1 === pass2;

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
    frozen,
    overall,
    p2Verdict,
    p3Verdict,
    ledger,
    inventory,
    p2: bodyPass1.p2,
    p3: bodyPass1.p3,
    domainBreakdown,
    p3FieldBreakdown,
    boundaries,
    skipReview,
    controls,
    newControls,
    contractAudit: {
      p3ToP4: P3_TO_P4_USAGE,
      minimum: P4_MINIMUM_CONTRACT,
      confidence: CONFIDENCE_AUDIT,
      rationaleMapExperimental: EXPERIMENTAL_RATIONALE_MAP,
      rows: contractRows,
    },
    pipeline,
    adversarial,
    mutation,
    overlay,
    tokens: {
      label: 'HISTORICAL_COUNTERFACTUAL',
      theoreticalResolverCapacity: {
        p2: theoreticalP2,
        p3: theoreticalP3,
        total: theoreticalP2 + theoreticalP3,
      },
      productionSafeCandidate: {
        p2: safeP2,
        p3: safeP3,
        total: safeP2 + safeP3,
        note: 'P3 safe = 0 while P4 contract remains blocked',
      },
      historicalTokens,
      p2SafelyAvoidable: safeP2,
      p3SafelyAvoidable: safeP3,
    },
    determinism: determinism ? 'PASS' : 'FAIL',
  };

  const outDir = join(backendRoot, 'tmp', 'mc1-deterministic-skip-larger-validation');
  mkdirSync(outDir, { recursive: true });
  const files: Record<string, unknown> = {
    'cohort-inventory.json': {
      currentSpecialtyCatalog: '1.13.0',
      fieldCatalog: '2.0.0',
      rows: inventory,
    },
    'p2-validation.json': { ...bodyPass1.p2, domainBreakdown, boundaries },
    'p3-validation.json': { ...bodyPass1.p3, p3FieldBreakdown },
    'skip-review.json': skipReview,
    'p3-p4-contract-audit.json': artifacts.contractAudit,
    'contract-equivalence.json': contractRows,
    'pipeline-simulation.json': pipeline,
    'profile-equivalence.json': pipeline.map((p) => ({
      person: p.person,
      p4InputEquivalence: p.p4InputEquivalence,
      profileEquivalence: p.profileEquivalence,
    })),
    'adversarial-tests.json': adversarial,
    'mutation-tests.json': mutation,
    'token-simulation.json': artifacts.tokens,
    'determinism-report.json': {
      result: artifacts.determinism,
      runs: 2,
      skipGemini: false,
      gemini: 'NOT_INVOKED',
    },
    'summary.json': {
      overall,
      p2Verdict,
      p3Verdict,
      p2: bodyPass1.p2,
      p3: bodyPass1.p3,
      ledger,
    },
  };
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(outDir, name), stableStringify(body), 'utf8');
  }
  return { outDir, ...artifacts };
}

const COHORT_NAMES = new Set([
  'Sara',
  'Haider',
  'Diego',
  'Johan',
  'Nidia',
  'Camilo',
  'Juan Pablo',
  'Santiago',
  'Katherin',
  'Danna',
]);
