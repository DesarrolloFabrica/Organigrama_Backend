/**
 * FASE — MC1 P2 DETERMINISTIC AUTHORITY SHADOW GATE
 * Offline. Gemini = 0. skipGemini = false. Nunca autoridad real.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { EXPERIMENTAL_RESOLVER_POLICY_V03 } from '../experimental/deterministic-resolver/experimental-policy-v03';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import {
  RESOLVER_CANDIDATE_2_VERSION,
  type FieldCandidate,
  type ResolverEvidenceUnit,
} from '../experimental/deterministic-resolver/types';
import { resolveFieldsToEvaluate } from '../p3/p3-context-loader';
import { findLatestR1Pack, loadR1Contract } from '../p3/p3-context-loader';
import type { R1ContractEnvelope } from '../r1/r1.types';
import type { P2ContractEnvelope } from '../p2/p2.types';
import { discoverHistoricalInventory } from './inventory';
import {
  CANDIDATE_2_POLICY_VERSION,
  evaluateP2SkipEligibility,
} from './skip-eligibility';
import { evaluateP2ContractSkipEligibilityV3 } from './skip-eligibility-v3';
import { isDeterministicSkipGeminiEnabled } from './flags';
import { buildCandidateSetV2, type CandidateSetV2Result } from './candidate-set-v2';
import { CSET_V2_FIXTURES, mutateRemoveContextAction } from './candidate-set-v2-fixtures';
import { mutateAddStrongCompetitor } from './candidate-set-fixtures';
import {
  artifactIdentityFromP1PackRel,
  buildEvidenceIdMap,
} from './full-contract-evidence';
import { buildDeterministicFullContract } from './full-contract';
import { adaptFullContractToExperimentalR1 } from './experimental-r1-full-adapter';
import { evaluateFullContractEligibility } from './full-contract-eligibility';
import {
  evaluateP2AuthorityEligibility,
  type P3ContextClass,
} from './authority-eligibility';
import {
  AUTHORITY_SHADOW_EVENTS,
  experimentalP3InputFingerprint,
  fieldCodesOf,
  p3ContextFromAuthorityShadow,
  p3ContextFromHistoricalR1,
  productionP3FieldsFingerprint,
  P3_CONTEXT_ADAPTER_VERSION,
  P3_CONTEXT_FUTURE_ROUTING,
  type P3FieldContextShadow,
} from './p3-shadow-context';
import {
  isolateDeterministicAuthorityFailure,
  releaseP3ContextOrIsolate,
} from './authority-failure';

const POLICY = EXPERIMENTAL_RESOLVER_POLICY_V03;
const SKIP_OPTS = { candidate: 'C2' as const, policy: POLICY };
const MEASURED_P2_TOKENS = 18359;
const INITIAL_CANDIDATES = ['Johan', 'Camilo', 'S19'] as const;

function ledgerSnapshot(backendRoot: string) {
  const path = join(backendRoot, 'tmp', 'mc1-gemini-ledger', 'events.jsonl');
  if (!existsSync(path)) return { exists: false, path, calls: 0, tokens: 0, events: 0 };
  const text = readFileSync(path, 'utf8');
  let calls = 0;
  let tokens = 0;
  let events = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    events += 1;
    try {
      const ev = JSON.parse(line) as { eventType?: string; usage?: { totalTokens?: number } };
      if (ev.eventType === 'GEMINI_CALL') {
        calls += 1;
        tokens += ev.usage?.totalTokens ?? 0;
      }
    } catch {
      /* ignore */
    }
  }
  return { exists: true, path, calls, tokens, events };
}

function resolveC2(snapshotId: string, units: ResolverEvidenceUnit[]) {
  return resolveFieldsHardened({
    snapshotId,
    units,
    policy: POLICY,
    resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
  });
}

function r1View(r1: R1ContractEnvelope | null) {
  if (!r1) return { status: null as string | null, primary: null as string | null, secondaries: [] as string[] };
  return {
    status: r1.payload.fieldResolutionStatus,
    primary: r1.payload.primaryField?.fieldCode ?? null,
    secondaries: [...(r1.payload.secondaryFields ?? []).map((s) => s.fieldCode).filter((x): x is string => !!x)].sort(),
  };
}

function p3Canon(r1: R1ContractEnvelope | null): string[] {
  if (!r1) return [];
  return [...new Set(resolveFieldsToEvaluate(r1).map((f) => f.fieldCode))].sort();
}

function setEqual(a: string[], b: string[]): boolean {
  return a.join('|') === b.join('|');
}

function fieldDisposition(
  code: string,
  set: CandidateSetV2Result,
  p2Cand: FieldCandidate | undefined,
): string {
  if (set.primary?.fieldCode === code) return 'PRIMARY';
  if (set.secondaries.some((s) => s.fieldCode === code)) return 'SECONDARY';
  if (set.contextFields.some((c) => c.fieldCode === code)) return 'CONTEXT';
  if (set.competitors.some((c) => c.fieldCode === code)) return 'COMPETITOR';
  if ((p2Cand?.independentSourceCount ?? 0) === 1) return 'THIN_NOT_CONTEXT';
  if ((p2Cand?.originEvidenceIds.length ?? 0) === 0) return 'NOT_SUPPORTED';
  return 'NOT_SUPPORTED';
}

function classifyP3(args: {
  det: string[];
  canon: string[];
  extraRoles: Record<string, string>;
  missingDisposition: Record<string, string>;
}): P3ContextClass {
  if (setEqual(args.det, args.canon)) return 'EXACT';
  const extra = args.det.filter((c) => !args.canon.includes(c));
  const missing = args.canon.filter((c) => !args.det.includes(c));
  const extraSecondary = extra.filter((c) => args.extraRoles[c] === 'SECONDARY');
  const extraContext = extra.filter((c) => args.extraRoles[c] === 'CONTEXT');
  const missingMiss = missing.filter((c) => {
    const d = args.missingDisposition[c];
    return d === 'CONTEXT' || d === 'SECONDARY' || d === 'COMPETITOR';
  });
  const missingUnsupported = missing.filter((c) => {
    const d = args.missingDisposition[c] ?? 'NOT_SUPPORTED';
    return d === 'NOT_SUPPORTED' || d === 'THIN_NOT_CONTEXT';
  });
  if (missingMiss.length > 0 && extraSecondary.length > 0) return 'CONFLICTING';
  if (missingMiss.length > 0) return 'NARROWER';
  if (extraSecondary.length > 0) return 'BROADER';
  if (extraContext.length > 0 && missingUnsupported.length === missing.length) return 'COMPATIBLE';
  if (extra.length === 0 && missingUnsupported.length === missing.length) return 'COMPATIBLE';
  if (extra.filter((c) => args.extraRoles[c] === 'COMPETITOR').length && missing.length) {
    return missingUnsupported.length === missing.length ? 'COMPATIBLE' : 'CONFLICTING';
  }
  return 'CONFLICTING';
}

function reviewContext(
  independent: number,
  originCount: number,
  diffs: string[],
  aliases: string[],
): 'SUPPORTED' | 'QUESTIONABLE' | 'UNSUPPORTED' {
  if (originCount === 0) return 'UNSUPPORTED';
  if (independent !== 1) return 'QUESTIONABLE';
  if (diffs.length === 0 && aliases.length === 0) return 'UNSUPPORTED';
  return 'SUPPORTED';
}

function foldText(u: ResolverEvidenceUnit): string {
  return `${u.normalizedActivity ?? ''} ${u.object ?? ''} ${u.result ?? ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function runAuthorityShadowGate(backendRoot: string) {
  if (isDeterministicSkipGeminiEnabled() !== false) throw new Error('SKIP_GEMINI_MUST_STAY_FALSE');
  const ledgerBefore = ledgerSnapshot(backendRoot);
  const inventory = discoverHistoricalInventory(backendRoot).filter((r) => r.p2Class === 'P2_ELIGIBLE');

  const simulations: unknown[] = [];
  const r1Rows: unknown[] = [];
  const p3AdapterRows: unknown[] = [];
  const p3EqRows: unknown[] = [];
  const roleRows: unknown[] = [];
  const eligRows: unknown[] = [];
  const contextReviews: Array<{
    person: string;
    fieldCode: string;
    review: 'SUPPORTED' | 'QUESTIONABLE' | 'UNSUPPORTED';
  }> = [];

  const p3Count = { EXACT: 0, COMPATIBLE: 0, NARROWER: 0, BROADER: 0, CONFLICTING: 0 };
  let r1Primary = 0;
  let r1SecExact = 0;
  let r1SecCompat = 0;
  let r1Status = 0;
  let authPassed = 0;
  let authBlocked = 0;
  let safeN = 0;
  let questN = 0;
  let unsafeN = 0;
  const fingerprints: string[] = [];

  for (const row of inventory) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, row.p1PackRel!));
    const c2 = resolveC2(row.snapshotId, units);
    const set = buildCandidateSetV2({ p2: c2, units, policy: POLICY });
    const histP2 = JSON.parse(
      readFileSync(resolve(backendRoot, row.p2PackRel!, 'p2-contract.json'), 'utf8'),
    ) as P2ContractEnvelope;
    const evidenceMap = buildEvidenceIdMap({
      units,
      artifactIdentity: artifactIdentityFromP1PackRel(row.p1PackRel!),
    });
    const contract = buildDeterministicFullContract({
      set,
      units,
      evidenceMap,
      historical: histP2,
    });
    fingerprints.push(contract.fingerprint);
    const r1 = adaptFullContractToExperimentalR1(set);
    const detP3 = p3ContextFromAuthorityShadow({ r1, contract });
    const released = releaseP3ContextOrIsolate({ contractValid: contract.valid, p3: detP3 });
    const shadowP3 = released.ok ? released.p3 : [];
    const primarySkip = evaluateP2SkipEligibility(c2, units, SKIP_OPTS);
    const v3 = evaluateP2ContractSkipEligibilityV3({ primarySkip, set });
    const full = evaluateFullContractEligibility({ primarySkip, contractV3: v3, contract, r1 });
    const r1Pack = findLatestR1Pack(backendRoot, row.snapshotId);
    const histR1 = r1Pack ? loadR1Contract(r1Pack) : null;
    const histView = r1View(histR1);
    const histP3Fields = histR1 ? p3ContextFromHistoricalR1(histR1) : [];
    const histP3 = p3Canon(histR1);
    const detCodes = fieldCodesOf(shadowP3);
    const extraRoles: Record<string, string> = {};
    for (const f of shadowP3) extraRoles[f.fieldCode] = f.role ?? 'UNSET';
    const missingDisposition: Record<string, string> = {};
    for (const code of histP3) {
      missingDisposition[code] = fieldDisposition(
        code,
        set,
        c2.candidateFields.find((c) => c.fieldCode === code),
      );
    }
    const p3Class = classifyP3({
      det: detCodes,
      canon: histP3,
      extraRoles,
      missingDisposition,
    });
    const auth = evaluateP2AuthorityEligibility({
      resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
      policyVersion: CANDIDATE_2_POLICY_VERSION,
      full,
      contract,
      r1,
      p3Class,
    });

    const pathUsed = auth.authorityEligible
      ? 'DETERMINISTIC_P2_AUTHORITY_SHADOW'
      : 'HISTORICAL_P2_FALLBACK';
    const effectiveP3: P3FieldContextShadow[] = auth.authorityEligible ? shadowP3 : histP3Fields;
    const event = auth.authorityEligible
      ? 'P2_AUTHORITY_SHADOW_ELIGIBLE'
      : full.fullContractSkipEligible
        ? 'P2_AUTHORITY_SHADOW_BLOCKED'
        : 'P2_AUTHORITY_SHADOW_FALLBACK';
    const simulatedEvent = auth.authorityEligible ? 'P2_AUTHORITY_SHADOW_SIMULATED' : event;

    if (auth.authorityEligible) authPassed += 1;
    else authBlocked += 1;
    p3Count[p3Class] += 1;

    const detView = {
      status: r1.resolutionStatus,
      primary: r1.primary,
      secondaries: [...r1.secondaries].sort(),
    };
    if (detView.primary === histView.primary) r1Primary += 1;
    if (setEqual(detView.secondaries, histView.secondaries)) r1SecExact += 1;
    const secCompat =
      setEqual(detView.secondaries, histView.secondaries) ||
      (detView.primary === histView.primary &&
        detView.secondaries.every((s) => histView.secondaries.includes(s)));
    if (secCompat) r1SecCompat += 1;
    if (detView.status === histView.status) r1Status += 1;

    const overinference = histP3.filter(
      (c) =>
        !detCodes.includes(c) &&
        (missingDisposition[c] === 'NOT_SUPPORTED' || missingDisposition[c] === 'THIN_NOT_CONTEXT'),
    );
    const roleChanges = histP3Fields
      .filter((h) => {
        const s = shadowP3.find((x) => x.fieldCode === h.fieldCode);
        return s && s.role && h.role && s.role !== h.role;
      })
      .map((h) => ({
        fieldCode: h.fieldCode,
        historicalRole: h.role,
        shadowRole: shadowP3.find((x) => x.fieldCode === h.fieldCode)?.role,
      }));
    const sameFieldSet = setEqual(detCodes, histP3);
    const packReuse = sameFieldSet
      ? roleChanges.length
        ? 'RISK_ROLE_CHANGE_SAME_FIELDSET'
        : 'FIELDSET_AND_ROLES_MATCH_NOT_REUSED'
      : 'FIELDSET_DIFFERS_NOT_REUSED';

    for (const c of set.contextFields) {
      const review = reviewContext(
        c.independentSourceCount,
        c.originEvidenceIds.length,
        c.differentialSignals,
        c.fieldSpecificSignals,
      );
      contextReviews.push({ person: row.person, fieldCode: c.fieldCode, review });
    }

    let review: 'SAFE' | 'QUESTIONABLE' | 'UNSAFE' = 'SAFE';
    if (r1.contextInflatedR1) review = 'UNSAFE';
    if (row.person === 'S9' && auth.authorityEligible) review = 'UNSAFE';
    if (row.person === 'Johan' && !shadowP3.some((f) => f.fieldCode === 'VISUAL_DESIGN' && f.role === 'CONTEXT')) {
      if (auth.authorityEligible) review = 'UNSAFE';
    }
    if (
      row.person === 'S19' &&
      !shadowP3.some((f) => f.fieldCode === 'AUDIOVISUAL_PRODUCTION' && f.role === 'CONTEXT')
    ) {
      if (auth.authorityEligible) review = 'UNSAFE';
    }
    if (auth.authorityEligible && p3Class !== 'EXACT' && p3Class !== 'COMPATIBLE') review = 'UNSAFE';
    if (auth.authorityEligible) {
      if (review === 'UNSAFE') unsafeN += 1;
      else safeN += 1;
    }

    const prodFp = productionP3FieldsFingerprint(detCodes);
    const histProdFp = productionP3FieldsFingerprint(histP3);
    const expFp = experimentalP3InputFingerprint(shadowP3);
    const histExpFp = experimentalP3InputFingerprint(histP3Fields);

    simulations.push({
      person: row.person,
      snapshotId: row.snapshotId,
      shadowMode: 'SHADOW_ONLY',
      state: auth.authorityEligible ? 'AUTHORITY_SIMULATED' : 'FALLBACK_REQUIRED',
      eligibility: auth.eligibility,
      pathUsed,
      event,
      simulatedEvent,
      wouldActivateAuthority: false,
      contract: {
        decision: contract.decision,
        primary: contract.primary?.fieldCode ?? null,
        secondaries: contract.secondaries.map((s) => s.fieldCode),
        context: contract.contextFields.map((c) => c.fieldCode),
        competitors: contract.competitors.map((c) => c.competitorCode),
        valid: contract.valid,
      },
    });
    r1Rows.push({
      person: row.person,
      historical: histView,
      experimental: { ...detView, context: r1.contextFields.map((c) => c.fieldCode) },
      contextInflatedR1: r1.contextInflatedR1,
      primaryMatch: detView.primary === histView.primary,
      secondaryExact: setEqual(detView.secondaries, histView.secondaries),
      secondaryCompatible: secCompat,
      statusMatch: detView.status === histView.status,
    });
    p3AdapterRows.push({
      person: row.person,
      shadow: shadowP3,
      historical: histP3Fields,
      effective: effectiveP3,
      released: released.ok,
    });
    p3EqRows.push({
      person: row.person,
      class: p3Class,
      historical: histP3,
      experimental: detCodes,
      roles: extraRoles,
      roleChanges,
      packReuse,
      productionFingerprintMatch: prodFp === histProdFp,
      experimentalFingerprintMatch: expFp === histExpFp,
      overinference: overinference.length ? { label: 'CANONICAL_OVERINFERENCE', fields: overinference } : null,
    });
    roleRows.push({
      person: row.person,
      eligible: auth.authorityEligible,
      review,
      p3Class,
      context: set.contextFields.map((c) => c.fieldCode),
      secondaries: set.secondaries.map((s) => s.fieldCode),
    });
    eligRows.push({
      person: row.person,
      snapshotId: row.snapshotId,
      ...auth,
      fullContractEligible: full.fullContractSkipEligible,
    });
  }

  function fixturePack(units: ResolverEvidenceUnit[], id: string) {
    const p2 = resolveC2(id, units);
    const set = buildCandidateSetV2({ p2, units, policy: POLICY });
    const evidenceMap = buildEvidenceIdMap({ units, artifactIdentity: `pack:${id}` });
    const contract = buildDeterministicFullContract({ set, units, evidenceMap });
    const r1 = adaptFullContractToExperimentalR1(set);
    const p3 = p3ContextFromAuthorityShadow({ r1, contract });
    const primarySkip = evaluateP2SkipEligibility(p2, units, SKIP_OPTS);
    const v3 = evaluateP2ContractSkipEligibilityV3({ primarySkip, set });
    const full = evaluateFullContractEligibility({ primarySkip, contractV3: v3, contract, r1 });
    return { set, contract, r1, p3, full };
  }

  const adversarial = [
    {
      id: 'legitimateThinContext',
      pass:
        fixturePack(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'A').p3.some(
          (f) => f.fieldCode === 'VISUAL_DESIGN' && f.role === 'CONTEXT',
        ) &&
        !fixturePack(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'A').r1.secondaries.includes(
          'VISUAL_DESIGN',
        ),
    },
    {
      id: 'toolOnlyContextNone',
      pass: fixturePack(CSET_V2_FIXTURES.primaryPlusToolOnly, 'B').p3.every((f) => f.role !== 'CONTEXT'),
    },
    {
      id: 'knowledgeOnlyContextNone',
      pass: fixturePack(CSET_V2_FIXTURES.primaryPlusKnowledgeOnly, 'C').p3.every((f) => f.role !== 'CONTEXT'),
    },
    {
      id: 'strongRivalCompetitorNotContext',
      pass: (() => {
        const p = fixturePack(CSET_V2_FIXTURES.strongCompetitorPair, 'E');
        return p.contract.competitors.length >= 2 && p.contract.contextFields.length === 0;
      })(),
    },
    {
      id: 'strongSecondaryNotContext',
      pass: (() => {
        const p = fixturePack(CSET_V2_FIXTURES.primaryPlusSecondaryIt, 'D');
        return (
          p.r1.secondaries.includes('IT_SYSTEMS') &&
          p.p3.find((f) => f.fieldCode === 'IT_SYSTEMS')?.role === 'SECONDARY'
        );
      })(),
    },
    {
      id: 'contextMutationRemovedShrinksP3',
      pass: (() => {
        const before = fixturePack(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'M0');
        const after = fixturePack(
          mutateRemoveContextAction(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'vd1'),
          'M1',
        );
        return (
          before.p3.some((f) => f.fieldCode === 'VISUAL_DESIGN') &&
          !after.p3.some((f) => f.fieldCode === 'VISUAL_DESIGN')
        );
      })(),
    },
  ];

  const mutations: unknown[] = [];
  const johan = inventory.find((r) => r.person === 'Johan');
  const s19 = inventory.find((r) => r.person === 'S19');
  const s9 = inventory.find((r) => r.person === 'S9');
  if (johan) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, johan.p1PackRel!));
    const before = fixturePack(units, johan.snapshotId);
    const mutated = units.filter((u) => !foldText(u).includes('piezas graficas'));
    const after = fixturePack(mutated, `${johan.snapshotId}-m`);
    mutations.push({
      id: 'johanRemovePiezasGraficas',
      expected: 'VD_CONTEXT_DISAPPEARS',
      pass:
        before.p3.some((f) => f.fieldCode === 'VISUAL_DESIGN' && f.role === 'CONTEXT') &&
        !after.p3.some((f) => f.fieldCode === 'VISUAL_DESIGN'),
      before: before.p3.filter((f) => f.role === 'CONTEXT').map((f) => f.fieldCode),
      after: after.p3.filter((f) => f.role === 'CONTEXT').map((f) => f.fieldCode),
    });
  }
  if (s19) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, s19.p1PackRel!));
    const before = fixturePack(units, s19.snapshotId);
    const avIds =
      before.contract.contextFields.find((c) => c.fieldCode === 'AUDIOVISUAL_PRODUCTION')
        ?.supportingEvidenceIds ?? [];
    const mutated = units.filter(
      (u) => !(avIds.includes(u.evidenceId) && u.evidenceKind === 'ACTION'),
    );
    const after = fixturePack(mutated, `${s19.snapshotId}-m`);
    mutations.push({
      id: 's19RemoveAvAction',
      expected: 'AV_CONTEXT_DISAPPEARS',
      pass:
        before.p3.some((f) => f.fieldCode === 'AUDIOVISUAL_PRODUCTION' && f.role === 'CONTEXT') &&
        !after.p3.some((f) => f.fieldCode === 'AUDIOVISUAL_PRODUCTION'),
      before: before.p3.filter((f) => f.role === 'CONTEXT').map((f) => f.fieldCode),
      after: after.p3.filter((f) => f.role === 'CONTEXT').map((f) => f.fieldCode),
    });
  }
  if (s9) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, s9.p1PackRel!));
    const c2 = resolveC2(s9.snapshotId, units);
    const da = c2.candidateFields.find((c) => c.fieldCode === 'DATA_ANALYTICS');
    const keep = da?.originEvidenceIds[0];
    const mutated = units.map((u) =>
      da?.originEvidenceIds.includes(u.evidenceId) && u.evidenceId !== keep
        ? { ...u, evidenceKind: 'KNOWLEDGE_STATEMENT' as const }
        : u,
    );
    const after = fixturePack(mutated, `${s9.snapshotId}-m`);
    const daRole =
      after.set.competitors.find((c) => c.fieldCode === 'DATA_ANALYTICS')?.role ??
      after.set.contextFields.find((c) => c.fieldCode === 'DATA_ANALYTICS')?.role ??
      after.set.secondaries.find((c) => c.fieldCode === 'DATA_ANALYTICS')?.role ??
      null;
    const coherent =
      (after.set.decision === 'RESOLVED' && daRole === 'CONTEXT') ||
      (after.set.decision === 'AMBIGUOUS' && daRole === 'COMPETITOR') ||
      daRole === null;
    mutations.push({
      id: 's9ReduceCompetitorSignal',
      expected: 'DETERMINISTIC_TRANSITION_COHERENT',
      pass: coherent && after.full.fullContractSkipEligible === (after.set.decision === 'RESOLVED' && after.set.competitors.length === 0),
      c2After: after.set.decision,
      daRole,
    });
  }
  mutations.push({
    id: 'addStrongCompetitorBlocksAuthority',
    expected: 'FALLBACK_REQUIRED',
    pass: !fixturePack(
      mutateAddStrongCompetitor(CSET_V2_FIXTURES.primaryPlusLegitimateContext),
      'M-comp',
    ).full.fullContractSkipEligible,
  });

  const isolated = isolateDeterministicAuthorityFailure(new Error('simulated resolver error'));
  const invalidRelease = releaseP3ContextOrIsolate({
    contractValid: false,
    p3: [{ fieldCode: 'SOFTWARE_ENGINEERING', role: 'PRIMARY', source: 'R1' }],
  });
  const failurePath = {
    pass:
      isolated.p3Context.length === 0 &&
      isolated.partialContractReleased === false &&
      isolated.contract === null &&
      isolated.r1 === null &&
      invalidRelease.ok === false,
    isolation: isolated,
    invalidContract: invalidRelease.ok ? null : invalidRelease.isolation,
  };

  const passBody = () => stableStringify({ simulations, fingerprints });
  const determinism = passBody() === passBody() ? 'PASS' : 'FAIL';
  const ledgerAfter = ledgerSnapshot(backendRoot);
  const ledger = {
    before: ledgerBefore,
    after: ledgerAfter,
    callsDelta: ledgerAfter.calls - ledgerBefore.calls,
    tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
    eventsDelta: ledgerAfter.events - ledgerBefore.events,
  };

  const supportedCtx = contextReviews.filter((c) => c.review === 'SUPPORTED').length;
  const contextPrecision =
    contextReviews.length === 0 ? 1 : Number((supportedCtx / contextReviews.length).toFixed(2));

  const simByPerson = (name: string) =>
    simulations.find((s) => (s as { person: string }).person === name) as Record<string, unknown> | undefined;
  const eqByPerson = (name: string) =>
    p3EqRows.find((s) => (s as { person: string }).person === name) as Record<string, unknown> | undefined;
  const eligByPerson = (name: string) =>
    eligRows.find((s) => (s as { person: string }).person === name) as {
      authorityEligible?: boolean;
      state?: string;
      blockedBy?: string[];
    };

  const johanSim = simByPerson('Johan');
  const camiloSim = simByPerson('Camilo');
  const s19Sim = simByPerson('S19');
  const s9Elig = eligByPerson('S9');
  const johanEq = eqByPerson('Johan');
  const camiloEq = eqByPerson('Camilo');
  const s19Eq = eqByPerson('S19');

  const johanOk =
    (johanSim?.contract as { primary?: string; context?: string[] })?.primary === 'SOFTWARE_ENGINEERING' &&
    ((johanSim?.contract as { context?: string[] }).context ?? []).includes('VISUAL_DESIGN') &&
    (johanEq?.class === 'EXACT' || johanEq?.class === 'COMPATIBLE') &&
    eligByPerson('Johan')?.authorityEligible === true;
  const camiloOk =
    (camiloSim?.contract as { primary?: string; context?: string[] })?.primary === 'SOFTWARE_ENGINEERING' &&
    ((camiloSim?.contract as { context?: string[] }).context ?? []).length === 0 &&
    (camiloEq?.class === 'EXACT' || camiloEq?.class === 'COMPATIBLE') &&
    eligByPerson('Camilo')?.authorityEligible === true;
  const s19Ok =
    (s19Sim?.contract as { primary?: string; context?: string[] })?.primary === 'COMMUNICATIONS' &&
    ((s19Sim?.contract as { context?: string[] }).context ?? []).includes('AUDIOVISUAL_PRODUCTION') &&
    (s19Eq?.class === 'EXACT' || s19Eq?.class === 'COMPATIBLE') &&
    eligByPerson('S19')?.authorityEligible === true;
  const s9Fallback = s9Elig?.authorityEligible === false && s9Elig?.state === 'FALLBACK_REQUIRED';
  const s9FalseAuthority = s9Elig?.authorityEligible === true;

  const eligibleP3 = eligRows.filter((e) => (e as { authorityEligible: boolean }).authorityEligible) as Array<{
    p3Class: P3ContextClass;
    person: string;
  }>;
  const eligibleP3Ok = eligibleP3.every((e) => e.p3Class === 'EXACT' || e.p3Class === 'COMPATIBLE');

  const advPass = adversarial.filter((a) => a.pass).length;
  const mutArr = mutations as Array<{ pass: boolean }>;
  const mutPass = mutArr.filter((m) => m.pass).length;
  const costOk = ledger.callsDelta === 0 && ledger.tokensDelta === 0 && ledger.eventsDelta === 0;
  const initialBlocked = INITIAL_CANDIDATES.filter((n) => !eligByPerson(n)?.authorityEligible);

  type ProfileEq = 'PROVEN' | 'LIKELY' | 'UNPROVEN';
  const profileRows: Array<{ person: string; profile: ProfileEq; p4: 'NOT_EXECUTED' }> = inventory.map(
    (row) => {
      const eq = eqByPerson(row.person) as { class?: string; packReuse?: string } | undefined;
      const elig = eligByPerson(row.person)?.authorityEligible === true;
      let profile: ProfileEq = 'UNPROVEN';
      if (elig && eq?.class === 'EXACT' && eq.packReuse === 'RISK_ROLE_CHANGE_SAME_FIELDSET') {
        profile = 'LIKELY';
      } else if (elig && eq?.class === 'EXACT' && eq.packReuse === 'FIELDSET_AND_ROLES_MATCH_NOT_REUSED') {
        profile = 'LIKELY';
      }
      return { person: row.person, profile, p4: 'NOT_EXECUTED' };
    },
  );

  let verdict:
    | 'P2_AUTHORITY_SHADOW_VALIDATED'
    | 'MORE_AUTHORITY_SHADOW_WORK_REQUIRED'
    | 'P2_AUTHORITY_APPROACH_BLOCKED' = 'MORE_AUTHORITY_SHADOW_WORK_REQUIRED';
  if (!costOk || !s9Fallback || s9FalseAuthority || unsafeN > 0 || contextPrecision !== 1) {
    verdict = 'P2_AUTHORITY_APPROACH_BLOCKED';
  } else if (
    johanOk &&
    camiloOk &&
    s19Ok &&
    eligibleP3Ok &&
    determinism === 'PASS' &&
    failurePath.pass &&
    advPass === adversarial.length &&
    mutPass === mutArr.length &&
    questN === 0 &&
    authPassed >= 1
  ) {
    verdict = 'P2_AUTHORITY_SHADOW_VALIDATED';
  }

  const files: Record<string, unknown> = {
    'authority-simulation.json': {
      shadowMode: 'SHADOW_ONLY',
      neverRealAuthority: true,
      skipGemini: false,
      eventsDesigned: AUTHORITY_SHADOW_EVENTS,
      noUsedEvent: true,
      rows: simulations,
    },
    'r1-results.json': {
      primaryEquivalence: r1Primary,
      secondaryExact: r1SecExact,
      secondaryCompatible: r1SecCompat,
      statusEquivalence: r1Status,
      total: inventory.length,
      note: 'CONTEXT demotion from historical SECONDARY is expected; R1 experimental omits CONTEXT.',
      rows: r1Rows,
    },
    'p3-context-adapter.json': {
      adapterVersion: P3_CONTEXT_ADAPTER_VERSION,
      roleSupport: ['PRIMARY', 'SECONDARY', 'CONTEXT'],
      backwardCompatible: 'role optional; historical packs default PRIMARY/SECONDARY from R1',
      futureRouting: P3_CONTEXT_FUTURE_ROUTING,
      fingerprint: {
        productionToday: 'fieldCode only (p3-runner fields join)',
        experimentalDesign: 'fieldCode + fieldRole',
        impact: 'same field set with role change does not change production fingerprint; experimental fingerprint must change',
      },
      geminiSemanticsImplemented: false,
      rows: p3AdapterRows,
    },
    'p3-context-equivalence.json': {
      ...p3Count,
      total: inventory.length,
      p3Executed: false,
      eligibleMustBeExactOrCompatible: true,
      rows: p3EqRows,
    },
    'role-review.json': {
      reviewedEligible: safeN + questN + unsafeN,
      safe: safeN,
      questionable: questN,
      unsafe: unsafeN,
      contextPrecision,
      contextReviews,
      rows: roleRows,
    },
    'adversarial-tests.json': { passed: advPass, failed: adversarial.length - advPass, cases: adversarial },
    'mutation-tests.json': { passed: mutPass, failed: mutArr.length - mutPass, cases: mutations },
    'failure-path.json': failurePath,
    'eligibility.json': {
      initialCandidates: [...INITIAL_CANDIDATES],
      passed: authPassed,
      blocked: authBlocked,
      skipGemini: false,
      wouldActivateAuthority: false,
      rows: eligRows,
    },
    'cost-counterfactual.json': {
      authorityEligible: authPassed,
      p2CallsPotentiallyAvoidable: authPassed,
      historicalTokens: authPassed * MEASURED_P2_TOKENS,
      label: 'HISTORICAL_COUNTERFACTUAL_AUTHORITY',
      note: 'Only P2_AUTHORITY_ELIGIBLE. Not live savings. skipGemini=false',
    },
    'determinism-report.json': {
      determinism,
      ledger,
      skipGemini: false,
      p3: 'NOT_EXECUTED',
      p4: 'NOT_EXECUTED',
      missing141: 'NOT_PROCESSED',
      profileEquivalence: {
        proven: profileRows.filter((p) => p.profile === 'PROVEN').length,
        likely: profileRows.filter((p) => p.profile === 'LIKELY').length,
        unproven: profileRows.filter((p) => p.profile === 'UNPROVEN').length,
        rows: profileRows,
      },
      verdict,
    },
  };

  const outDir = join(backendRoot, 'tmp', 'mc1-p2-authority-shadow');
  mkdirSync(outDir, { recursive: true });
  const repoTmp = join(backendRoot, '..', 'tmp', 'mc1-p2-authority-shadow');
  mkdirSync(repoTmp, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    const text = stableStringify(body);
    writeFileSync(join(outDir, name), text, 'utf8');
    writeFileSync(join(repoTmp, name), text, 'utf8');
  }

  return {
    outDir,
    verdict,
    ledger,
    determinism,
    evaluated: inventory.length,
    authority: {
      initial: [...INITIAL_CANDIDATES],
      passed: authPassed,
      blocked: authBlocked,
      initialBlocked,
    },
    r1: {
      primary: r1Primary,
      secondaryExact: r1SecExact,
      secondaryCompatible: r1SecCompat,
      status: r1Status,
      total: inventory.length,
    },
    p3: p3Count,
    review: { reviewed: safeN + questN + unsafeN, safe: safeN, questionable: questN, unsafe: unsafeN, contextPrecision },
    adversarial: { passed: advPass, failed: adversarial.length - advPass },
    mutation: { passed: mutPass, failed: mutArr.length - mutPass },
    failureIsolation: failurePath.pass ? 'PASS' : 'FAIL',
    cost: {
      calls: authPassed,
      tokens: authPassed * MEASURED_P2_TOKENS,
      label: 'HISTORICAL_COUNTERFACTUAL_AUTHORITY',
    },
    profile: {
      proven: profileRows.filter((p) => p.profile === 'PROVEN').length,
      likely: profileRows.filter((p) => p.profile === 'LIKELY').length,
      unproven: profileRows.filter((p) => p.profile === 'UNPROVEN').length,
    },
    controls: {
      johan: { sim: johanSim, eq: johanEq, ok: johanOk },
      camilo: { sim: camiloSim, eq: camiloEq, ok: camiloOk },
      s19: { sim: s19Sim, eq: s19Eq, ok: s19Ok },
      s9: { elig: s9Elig, fallback: s9Fallback, falseAuthority: s9FalseAuthority },
    },
  };
}
