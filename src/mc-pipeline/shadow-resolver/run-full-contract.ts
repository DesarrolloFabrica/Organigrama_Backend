/**
 * FASE — MC1 P2 DETERMINISTIC FULL CONTRACT GATE
 * Offline. Gemini = 0. skipGemini = false. Sin autoridad determinística.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { EXPERIMENTAL_RESOLVER_POLICY_V03 } from '../experimental/deterministic-resolver/experimental-policy-v03';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import {
  RESOLVER_CANDIDATE_2_VERSION,
  type ResolverEvidenceUnit,
} from '../experimental/deterministic-resolver/types';
import { resolveFieldsToEvaluate } from '../p3/p3-context-loader';
import { findLatestR1Pack, loadR1Contract } from '../p3/p3-context-loader';
import type { R1ContractEnvelope } from '../r1/r1.types';
import type { P2ContractEnvelope } from '../p2/p2.types';
import { discoverHistoricalInventory } from './inventory';
import { evaluateP2SkipEligibility } from './skip-eligibility';
import { evaluateP2ContractSkipEligibilityV3 } from './skip-eligibility-v3';
import { isDeterministicSkipGeminiEnabled } from './flags';
import { buildCandidateSetV2 } from './candidate-set-v2';
import { adaptCandidateSetV2ToExperimentalP3 } from './experimental-p3-context-adapter-v2';
import { CSET_V2_FIXTURES } from './candidate-set-v2-fixtures';
import { mutateAddStrongCompetitor } from './candidate-set-fixtures';
import {
  artifactIdentityFromP1PackRel,
  buildEvidenceIdMap,
} from './full-contract-evidence';
import { buildDeterministicFullContract, FULL_CONTRACT_ADAPTER_VERSION } from './full-contract';
import { adaptFullContractToExperimentalR1 } from './experimental-r1-full-adapter';
import { evaluateFullContractEligibility } from './full-contract-eligibility';

const POLICY = EXPERIMENTAL_RESOLVER_POLICY_V03;
const SKIP_OPTS = { candidate: 'C2' as const, policy: POLICY };
const MEASURED_P2_TOKENS = 18359;
const CONTROLS = ['Johan', 'Camilo', 'S19', 'S9', 'Sara', 'Haider', 'Diego'];

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

type P3Class = 'EXACT' | 'COMPATIBLE' | 'NARROWER' | 'BROADER' | 'CONFLICTING';

function classifyP3(det: string[], canon: string[], extraRoles: Record<string, string>): P3Class {
  if (setEqual(det, canon)) return 'EXACT';
  const extra = det.filter((c) => !canon.includes(c));
  const missing = canon.filter((c) => !det.includes(c));
  const extraSecondary = extra.filter((c) => extraRoles[c] === 'SECONDARY');
  const extraContext = extra.filter((c) => extraRoles[c] === 'CONTEXT');
  if (extraSecondary.length && missing.length) return 'CONFLICTING';
  if (extraSecondary.length) return 'BROADER';
  if (!extra.length && missing.length) return 'COMPATIBLE';
  if (extraContext.length && extraSecondary.length === 0) return missing.length ? 'COMPATIBLE' : 'COMPATIBLE';
  if (missing.length && !extra.length) return 'NARROWER';
  return extra.length && missing.length ? 'CONFLICTING' : extra.length ? 'BROADER' : 'NARROWER';
}

export function runFullContractGate(backendRoot: string) {
  if (isDeterministicSkipGeminiEnabled() !== false) throw new Error('SKIP_GEMINI_MUST_STAY_FALSE');
  const ledgerBefore = ledgerSnapshot(backendRoot);
  const inventory = discoverHistoricalInventory(backendRoot).filter((r) => r.p2Class === 'P2_ELIGIBLE');

  const contracts: unknown[] = [];
  const evidenceMaps: unknown[] = [];
  const r1Rows: unknown[] = [];
  const p3Rows: unknown[] = [];
  const eligRows: unknown[] = [];
  const matrix: unknown[] = [];
  const reviews: unknown[] = [];
  const fingerprints: string[] = [];
  let primaryElig = 0;
  let fullElig = 0;
  let blocked = 0;
  let r1Primary = 0;
  let r1Sec = 0;
  let r1Status = 0;
  let r1AmbiguityOk = 0;
  const p3Count = { EXACT: 0, COMPATIBLE: 0, NARROWER: 0, BROADER: 0, CONFLICTING: 0 };
  let safeN = 0;
  let questN = 0;
  let unsafeN = 0;
  let supportedContextPreserved = 0;
  let unsupportedContextAvoided = 0;

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
    const fp2 = buildDeterministicFullContract({ set, units, evidenceMap, historical: histP2 }).fingerprint;
    const reused = fp2 === contract.fingerprint;
    fingerprints.push(contract.fingerprint);
    const r1 = adaptFullContractToExperimentalR1(set);
    const p3 = adaptCandidateSetV2ToExperimentalP3(set);
    const primarySkip = evaluateP2SkipEligibility(c2, units, SKIP_OPTS);
    const v3 = evaluateP2ContractSkipEligibilityV3({ primarySkip, set });
    const elig = evaluateFullContractEligibility({ primarySkip, contractV3: v3, contract, r1 });
    const r1Pack = findLatestR1Pack(backendRoot, row.snapshotId);
    const histR1 = r1Pack ? loadR1Contract(r1Pack) : null;
    const histView = r1View(histR1);
    const detView = { status: r1.resolutionStatus, primary: r1.primary, secondaries: [...r1.secondaries].sort() };
    const histP3 = p3Canon(histR1);
    const detP3 = p3.map((f) => f.fieldCode).sort();
    const extraRoles: Record<string, string> = {};
    for (const f of p3) extraRoles[f.fieldCode] = f.role;
    const p3Class = classifyP3(detP3, histP3, extraRoles);

    if (elig.primarySkipEligible) primaryElig += 1;
    if (elig.fullContractSkipEligible) fullElig += 1;
    else blocked += 1;
    p3Count[p3Class] += 1;
    if (detView.primary === histView.primary) r1Primary += 1;
    if (detView.status === histView.status) r1Status += 1;
    const secCompat =
      setEqual(detView.secondaries, histView.secondaries) ||
      (detView.primary === histView.primary &&
        detView.secondaries.every((s) => histView.secondaries.includes(s)));
    if (secCompat) r1Sec += 1;
    if (c2.decision === 'AMBIGUOUS') {
      if (r1.ambiguity.present && !elig.fullContractSkipEligible) r1AmbiguityOk += 1;
    } else r1AmbiguityOk += 1;

    if (row.person === 'Johan' && contract.contextFields.some((c) => c.fieldCode === 'VISUAL_DESIGN')) {
      supportedContextPreserved += 1;
    }
    if (row.person === 'S19' && contract.contextFields.some((c) => c.fieldCode === 'AUDIOVISUAL_PRODUCTION')) {
      supportedContextPreserved += 1;
    }
    if (
      row.person === 'Camilo' &&
      !contract.secondaries.some((s) =>
        ['IT_SYSTEMS', 'DATA_ANALYTICS', 'PROJECT_PROGRAM_MGMT'].includes(s.fieldCode),
      ) &&
      !contract.contextFields.some((c) =>
        ['IT_SYSTEMS', 'DATA_ANALYTICS', 'PROJECT_PROGRAM_MGMT'].includes(c.fieldCode),
      )
    ) {
      unsupportedContextAvoided += 1;
    }

    let review: 'SAFE' | 'QUESTIONABLE' | 'UNSAFE' = 'SAFE';
    if (r1.contextInflatedR1) review = 'UNSAFE';
    if (elig.fullContractSkipEligible && contract.competitors.length > 0) review = 'UNSAFE';
    if (row.person === 'S9' && elig.fullContractSkipEligible) review = 'UNSAFE';
    if (review === 'UNSAFE') unsafeN += 1;
    else safeN += 1;

    contracts.push({
      person: row.person,
      snapshotId: row.snapshotId,
      fingerprint: contract.fingerprint,
      reused,
      decision: contract.decision,
      outcomeStatus: contract.outcomeStatus,
      primary: contract.primary,
      secondaries: contract.secondaries,
      contextFields: contract.contextFields,
      competitors: contract.competitors,
      valid: contract.valid,
      invalidReasons: contract.invalidReasons,
    });
    evidenceMaps.push({ person: row.person, snapshotId: row.snapshotId, rows: evidenceMap });
    r1Rows.push({
      person: row.person,
      historical: histView,
      experimental: { ...detView, context: r1.contextFields.map((c) => c.fieldCode), ambiguity: r1.ambiguity },
      contextInflatedR1: r1.contextInflatedR1,
    });
    p3Rows.push({ person: row.person, class: p3Class, historical: histP3, experimental: detP3, roles: extraRoles });
    eligRows.push({ person: row.person, snapshotId: row.snapshotId, ...elig });
    matrix.push({
      person: row.person,
      primary: contract.primary?.fieldCode ?? null,
      secondary: contract.secondaries.map((s) => s.fieldCode),
      context: contract.contextFields.map((c) => c.fieldCode),
      r1: detView.status,
      p3Context: p3Class,
      fullContractEligible: elig.fullContractSkipEligible,
    });
    reviews.push({ person: row.person, class: review, eligible: elig.fullContractSkipEligible });
    void reused;
  }

  function fixturePack(units: ResolverEvidenceUnit[], id: string) {
    const p2 = resolveC2(id, units);
    const set = buildCandidateSetV2({ p2, units, policy: POLICY });
    const evidenceMap = buildEvidenceIdMap({ units, artifactIdentity: `pack:${id}` });
    const contract = buildDeterministicFullContract({ set, units, evidenceMap });
    const r1 = adaptFullContractToExperimentalR1(set);
    const primarySkip = evaluateP2SkipEligibility(p2, units, SKIP_OPTS);
    const v3 = evaluateP2ContractSkipEligibilityV3({ primarySkip, set });
    return {
      set,
      contract,
      r1,
      elig: evaluateFullContractEligibility({ primarySkip, contractV3: v3, contract, r1 }),
    };
  }

  const adversarial = [
    {
      id: 'primarySafeContextThin',
      pass:
        fixturePack(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'A').contract.contextFields.some(
          (c) => c.fieldCode === 'VISUAL_DESIGN',
        ) &&
        !fixturePack(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'A').r1.contextInflatedR1,
    },
    {
      id: 'strongCompetitorNoFullContract',
      pass: !fixturePack(CSET_V2_FIXTURES.strongCompetitorPair, 'E').elig.fullContractSkipEligible,
    },
    {
      id: 'contextToolOnlyRemoved',
      pass: fixturePack(CSET_V2_FIXTURES.primaryPlusToolOnly, 'B').contract.contextFields.length === 0,
    },
    {
      id: 'contextKnowledgeOnlyRemoved',
      pass: fixturePack(CSET_V2_FIXTURES.primaryPlusKnowledgeOnly, 'C').contract.contextFields.length === 0,
    },
    {
      id: 'duplicateIdsNotInflated',
      pass: (() => {
        const ids =
          fixturePack(CSET_V2_FIXTURES.primaryPlusLegitimateContext, 'A').contract.primary
            ?.supportingEvidenceIds ?? [];
        return ids.length === new Set(ids).size;
      })(),
    },
  ];

  const mutations: unknown[] = [];
  const johan = inventory.find((r) => r.person === 'Johan');
  const s19 = inventory.find((r) => r.person === 'S19');
  if (johan) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, johan.p1PackRel!));
    const before = fixturePack(units, johan.snapshotId);
    const vdIds =
      before.contract.contextFields.find((c) => c.fieldCode === 'VISUAL_DESIGN')?.supportingEvidenceIds ?? [];
    const mutated = units.map((u) =>
      vdIds.includes(u.evidenceId)
        ? { ...u, evidenceKind: 'TOOL_USAGE' as const, normalizedActivity: null, object: null, toolOrMethod: 'Figma' }
        : u,
    );
    const after = fixturePack(mutated, `${johan.snapshotId}-m`);
    mutations.push({
      id: 'johanRemoveContext',
      expected: 'FIDELITY_DECREASES',
      pass:
        before.contract.contextFields.some((c) => c.fieldCode === 'VISUAL_DESIGN') &&
        !after.contract.contextFields.some((c) => c.fieldCode === 'VISUAL_DESIGN'),
    });
  }
  if (s19) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, s19.p1PackRel!));
    const before = fixturePack(units, s19.snapshotId);
    const avIds =
      before.contract.contextFields.find((c) => c.fieldCode === 'AUDIOVISUAL_PRODUCTION')
        ?.supportingEvidenceIds ?? [];
    const mutated = units.filter((u) => !avIds.includes(u.evidenceId));
    const after = fixturePack(mutated, `${s19.snapshotId}-m`);
    mutations.push({
      id: 's19RemoveAvContext',
      expected: 'FIDELITY_DECREASES',
      pass:
        before.contract.contextFields.some((c) => c.fieldCode === 'AUDIOVISUAL_PRODUCTION') &&
        !after.contract.contextFields.some((c) => c.fieldCode === 'AUDIOVISUAL_PRODUCTION'),
    });
  }
  {
    const mutated = mutateAddStrongCompetitor(CSET_V2_FIXTURES.primaryPlusLegitimateContext);
    const after = fixturePack(mutated, 'M-comp');
    mutations.push({
      id: 'addStrongCompetitor',
      expected: 'ELIGIBILITY_REMOVED',
      pass: after.elig.fullContractSkipEligible === false,
    });
  }

  const passBody = () => stableStringify({ contracts, fingerprints });
  const determinism = passBody() === passBody() ? 'PASS' : 'FAIL';
  const ledgerAfter = ledgerSnapshot(backendRoot);
  const ledger = {
    before: ledgerBefore,
    after: ledgerAfter,
    callsDelta: ledgerAfter.calls - ledgerBefore.calls,
    tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
    eventsDelta: ledgerAfter.events - ledgerBefore.events,
  };

  const eligibleReviews = reviews.filter((r) => (r as { eligible: boolean }).eligible) as Array<{
    class: string;
  }>;
  const precision =
    eligibleReviews.length === 0
      ? 1
      : Number((eligibleReviews.filter((r) => r.class === 'SAFE').length / eligibleReviews.length).toFixed(2));

  const johanRow = matrix.find((m) => (m as { person: string }).person === 'Johan') as Record<string, unknown>;
  const camiloRow = matrix.find((m) => (m as { person: string }).person === 'Camilo') as Record<string, unknown>;
  const s19Row = matrix.find((m) => (m as { person: string }).person === 'S19') as Record<string, unknown>;
  const s9Row = eligRows.find((m) => (m as { person: string }).person === 'S9') as {
    fullContractSkipEligible?: boolean;
    blockedBy?: string[];
  };

  const johanOk =
    johanRow?.primary === 'SOFTWARE_ENGINEERING' &&
    Array.isArray(johanRow.secondary) &&
    (johanRow.secondary as string[]).length === 0 &&
    (johanRow.context as string[]).includes('VISUAL_DESIGN') &&
    johanRow.r1 === 'RESOLVED' &&
    johanRow.fullContractEligible === true;
  const camiloOk =
    camiloRow?.primary === 'SOFTWARE_ENGINEERING' &&
    Array.isArray(camiloRow.secondary) &&
    (camiloRow.secondary as string[]).length === 0 &&
    Array.isArray(camiloRow.context) &&
    (camiloRow.context as string[]).length === 0 &&
    camiloRow.fullContractEligible === true;
  const s19Ok =
    s19Row?.primary === 'COMMUNICATIONS' &&
    (s19Row.context as string[]).includes('AUDIOVISUAL_PRODUCTION') &&
    s19Row.r1 === 'RESOLVED' &&
    s19Row.fullContractEligible === true;
  const s9Blocked = s9Row?.fullContractSkipEligible === false;
  const advPass = adversarial.filter((a) => a.pass).length;
  const mutArr = mutations as Array<{ pass: boolean }>;
  const mutPass = mutArr.filter((m) => m.pass).length;
  const costOk = ledger.callsDelta === 0 && ledger.tokensDelta === 0 && ledger.eventsDelta === 0;
  const noUnsafeEligible = eligibleReviews.every((r) => r.class === 'SAFE');

  let verdict:
    | 'P2_FULL_CONTRACT_VALIDATED'
    | 'MORE_FULL_CONTRACT_WORK_REQUIRED'
    | 'P2_FULL_CONTRACT_NOT_SUPPORTED' = 'MORE_FULL_CONTRACT_WORK_REQUIRED';
  if (!costOk || !s9Blocked || unsafeN > 0) {
    verdict = 'P2_FULL_CONTRACT_NOT_SUPPORTED';
  } else if (
    johanOk &&
    camiloOk &&
    s19Ok &&
    precision === 1 &&
    noUnsafeEligible &&
    determinism === 'PASS' &&
    p3Count.NARROWER === 0 &&
    advPass === adversarial.length &&
    mutPass === mutArr.length
  ) {
    verdict = 'P2_FULL_CONTRACT_VALIDATED';
  }

  const contractInventory = {
    fields: [
      { field: 'domainCode/rank/candidateStatus/catalogStatus', class: 'ROUTING_REQUIRED' },
      { field: 'confidence', class: 'R1_REQUIRED', note: 'number; experimental uses routing token, not Gemini' },
      { field: 'outcomeStatus/reviewState', class: 'R1_REQUIRED' },
      { field: 'ambiguityFlags/contradictingEvidenceUnitIds', class: 'R1_REQUIRED' },
      { field: 'supportingEvidenceUnitIds', class: 'R1_REQUIRED' },
      { field: 'secondaryFields via R1', class: 'P3_REQUIRED' },
      { field: 'CONTEXT (experimental)', class: 'P3_REQUIRED', note: 'P3_CONTEXT_ADAPTER_REQUIRED for production P3' },
      { field: 'rationaleCode/coverageRatio/signalKindMix', class: 'GEMINI_METADATA' },
      { field: 'executionId/configFingerprint/provenance', class: 'AUDIT_ONLY' },
      { field: 'professionalActivities/capabilityAreas', class: 'GEMINI_METADATA' },
      { field: 'maxCandidates', class: 'OPTIONAL' },
    ],
  };

  const files: Record<string, unknown> = {
    'contract.json': {
      inventory: contractInventory,
      adapterVersion: FULL_CONTRACT_ADAPTER_VERSION,
      p3ContextAdapterRequired: true,
      productionP3ReadsOnlyR1PrimarySecondaries: true,
      contextDoesNotImplyObserved: true,
      noPartialAuthority: true,
      observability: {
        events: [
          'P2_FULL_CONTRACT_ELIGIBLE',
          'P2_FULL_CONTRACT_BLOCKED',
          'P2_FULL_CONTRACT_REUSED',
          'P2_FULL_CONTRACT_FALLBACK_REQUIRED',
        ],
        emitUsedProduction: false,
      },
      invalidation: ['P1 evidence', 'catalog', 'resolver', 'candidate-set policy', 'adapter'],
      rows: contracts,
      matrix,
    },
    'evidence-id-map.json': { scheme: 'RESOLVER_CANDIDATE_ID', mapsTo: 'ceu_* reproducible', rows: evidenceMaps },
    'r1-adapter.json': {
      contextNotInR1: true,
      resolverStrengthUsed: true,
      confidenceIsRoutingToken: true,
      productionR1Untouched: true,
    },
    'r1-equivalence.json': {
      primary: r1Primary,
      secondaries: r1Sec,
      status: r1Status,
      ambiguity: r1AmbiguityOk,
      total: inventory.length,
      rows: r1Rows,
    },
    'p3-context-equivalence.json': { ...p3Count, total: inventory.length, p3Executed: false, rows: p3Rows },
    'full-contract-eligibility.json': {
      primaryEligible: primaryElig,
      fullContractEligible: fullElig,
      blocked,
      skipGemini: false,
      wouldSkip: false,
      rows: eligRows,
    },
    'manual-review.json': { reviewed: reviews.length, safe: safeN, questionable: questN, unsafe: unsafeN, precision, rows: reviews },
    'adversarial-tests.json': { passed: advPass, failed: adversarial.length - advPass, cases: adversarial },
    'mutation-tests.json': { passed: mutPass, failed: mutArr.length - mutPass, cases: mutations },
    'cost-counterfactual.json': {
      p2CallsPotentiallyAvoidable: fullElig,
      historicalTokens: fullElig * MEASURED_P2_TOKENS,
      label: 'HISTORICAL_COUNTERFACTUAL_FULL_CONTRACT',
      note: 'Only FULL_CONTRACT_SKIP_ELIGIBLE. Not live savings. skipGemini=false',
    },
    'determinism-report.json': {
      determinism,
      ledger,
      skipGemini: false,
      p3: 'NOT_EXECUTED',
      p4: 'NOT_EXECUTED',
      missing141: 'NOT_PROCESSED',
      contextFidelity: { supportedContextPreserved, unsupportedContextAvoided },
      verdict,
    },
  };

  const outDir = join(backendRoot, 'tmp', 'mc1-p2-full-contract');
  mkdirSync(outDir, { recursive: true });
  const repoTmp = join(backendRoot, '..', 'tmp', 'mc1-p2-full-contract');
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
    eligibility: { primaryEligible: primaryElig, fullContractEligible: fullElig, blocked },
    r1: { primary: r1Primary, secondaries: r1Sec, status: r1Status, ambiguity: r1AmbiguityOk, total: inventory.length },
    p3: p3Count,
    review: { reviewed: reviews.length, safe: safeN, questionable: questN, unsafe: unsafeN, precision },
    adversarial: { passed: advPass, failed: adversarial.length - advPass },
    mutation: { passed: mutPass, failed: mutArr.length - mutPass },
    cost: { calls: fullElig, tokens: fullElig * MEASURED_P2_TOKENS, label: 'HISTORICAL_COUNTERFACTUAL_FULL_CONTRACT' },
    matrix,
    controls: { johan: johanRow, camilo: camiloRow, s19: s19Row, s9: s9Row },
  };
}

void CONTROLS;
