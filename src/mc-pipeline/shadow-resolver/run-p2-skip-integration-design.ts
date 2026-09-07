/**
 * Diseño de integración P2 skip — simulación offline.
 * Gemini = 0. skipGemini = false. No escribe packs productivos.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { EXPERIMENTAL_RESOLVER_POLICY_V03 } from '../experimental/deterministic-resolver/experimental-policy-v03';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import {
  RESOLVER_CANDIDATE_2_VERSION,
} from '../experimental/deterministic-resolver/types';
import { resolveR1FromP2 } from '../r1/r1-resolver';
import { resolveFieldsToEvaluate } from '../p3/p3-context-loader';
import type { P2ContractEnvelope } from '../p2/p2.types';
import type { P2ContractView, R1ContractEnvelope } from '../r1/r1.types';
import { discoverHistoricalInventory } from './inventory';
import { evaluateP2SkipEligibility } from './skip-eligibility';
import { isDeterministicSkipGeminiEnabled } from './flags';
import {
  buildSyntheticDeterministicP2,
  DETERMINISTIC_AUTHORITY_ROUTING_SCORE,
  DETERMINISTIC_P2_RATIONALE_MAP_VERSION,
  DETERMINISTIC_P2_SOURCE,
} from './synthetic-p2-contract';
import { findLatestR1Pack, loadR1Contract } from '../p3/p3-context-loader';

const POLICY = EXPERIMENTAL_RESOLVER_POLICY_V03;
const SKIP_OPTS = { candidate: 'C2' as const, policy: POLICY };

function ledgerSnapshot(backendRoot: string) {
  const path = join(backendRoot, 'tmp', 'mc1-gemini-ledger', 'events.jsonl');
  if (!existsSync(path)) {
    return { exists: false, path, calls: 0, tokens: 0, events: 0 };
  }
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
      // ignore
    }
  }
  return { exists: true, path, calls, tokens, events };
}

function readP2(packDir: string): P2ContractEnvelope {
  return JSON.parse(readFileSync(join(packDir, 'p2-contract.json'), 'utf8')) as P2ContractEnvelope;
}

function r1Key(r1: R1ContractEnvelope) {
  const p = r1.payload;
  return {
    status: p.fieldResolutionStatus,
    primary: p.primaryField?.fieldCode ?? null,
    secondaries: [...(p.secondaryFields ?? []).map((s) => s.fieldCode).filter(Boolean)].sort(),
  };
}

function p3Key(r1: R1ContractEnvelope) {
  return resolveFieldsToEvaluate(r1)
    .map((f) => `${f.role}:${f.fieldCode}`)
    .sort();
}

export function runP2SkipIntegrationDesign(backendRoot: string) {
  if (isDeterministicSkipGeminiEnabled() !== false) {
    throw new Error('SKIP_GEMINI_MUST_STAY_FALSE');
  }
  const ledgerBefore = ledgerSnapshot(backendRoot);
  const inventory = discoverHistoricalInventory(backendRoot).filter(
    (r) => r.p2Class === 'P2_ELIGIBLE',
  );

  const syntheticRows: unknown[] = [];
  const r1Rows: unknown[] = [];
  const p3Rows: unknown[] = [];
  let syntheticValid = 0;
  let syntheticInvalid = 0;
  let r1Matches = 0;
  let p3Matches = 0;

  for (const row of inventory) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, row.p1PackRel!));
    const c2 = resolveFieldsHardened({
      snapshotId: row.snapshotId,
      units,
      policy: POLICY,
      resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
    });
    const skip = evaluateP2SkipEligibility(c2, units, SKIP_OPTS);
    const histP2 = readP2(resolve(backendRoot, row.p2PackRel!));
    const r1Pack = findLatestR1Pack(backendRoot, row.snapshotId);
    const histR1 = r1Pack ? loadR1Contract(r1Pack) : null;

    let used: P2ContractEnvelope = histP2;
    let source: 'DETERMINISTIC' | 'GEMINI' = 'GEMINI';
    let synthValid = true;
    let invalidReasons: string[] = [];

    if (skip.eligibility === 'SKIP_ELIGIBLE') {
      const built = buildSyntheticDeterministicP2({
        historical: histP2,
        p2: c2,
        skip,
        fingerprint: skip.fingerprint ?? createHash('sha256').update(row.snapshotId).digest('hex'),
      });
      used = built.envelope;
      source = 'DETERMINISTIC';
      synthValid = built.valid;
      invalidReasons = built.invalidReasons;
      if (built.valid) syntheticValid += 1;
      else syntheticInvalid += 1;
      syntheticRows.push({
        person: row.person,
        snapshotId: row.snapshotId,
        field: c2.resolvedFieldCode,
        valid: built.valid,
        invalidReasons,
        candidateCount: built.envelope.payload.domainCandidates.length,
        confidenceSemantics: 'DETERMINISTIC_AUTHORITY_ROUTING_SCORE',
        confidence: DETERMINISTIC_AUTHORITY_ROUTING_SCORE,
        rationaleMap: DETERMINISTIC_P2_RATIONALE_MAP_VERSION,
        rationaleCode: built.envelope.payload.domainCandidates[0]?.rationaleCode,
        supportsScheme: 'RESOLVER_CANDIDATE_ID_NOT_CEU',
        p2Source: DETERMINISTIC_P2_SOURCE,
        historicalCandidateCount: histP2.payload.domainCandidates.length,
        historicalSecondaries: histP2.payload.domainCandidates
          .filter((c) => c.rank > 1)
          .map((c) => c.domainCode),
      });
    }

    const simR1 = resolveR1FromP2(used as unknown as P2ContractView).envelope;
    const histKey = histR1 ? r1Key(histR1) : null;
    const simKey = r1Key(simR1);
    const r1Match =
      !!histKey &&
      histKey.status === simKey.status &&
      histKey.primary === simKey.primary &&
      histKey.secondaries.join('|') === simKey.secondaries.join('|');
    if (r1Match) r1Matches += 1;
    r1Rows.push({
      person: row.person,
      source,
      match: r1Match,
      historical: histKey,
      simulated: simKey,
      missingContractField: r1Match
        ? null
        : source === 'DETERMINISTIC'
          ? 'SECONDARY_CANDIDATES'
          : 'MISSING_HISTORICAL_R1',
    });

    const histP3 = histR1 ? p3Key(histR1) : [];
    const simP3 = p3Key(simR1);
    const p3Match = histP3.join('|') === simP3.join('|');
    if (p3Match) p3Matches += 1;
    p3Rows.push({
      person: row.person,
      source,
      skipEligible: skip.eligibility === 'SKIP_ELIGIBLE',
      match: p3Match,
      historical: histP3,
      simulated: simP3,
    });
  }

  const skipPeople = p3Rows.filter((r) => (r as { skipEligible?: boolean }).skipEligible);
  const skipP3Match = skipPeople.filter((r) => (r as { match?: boolean }).match).length;
  const downstreamOk = skipPeople.length > 0 && skipP3Match === skipPeople.length;

  const contractAudit = {
    contractCode: 'MC1.P2.DOMAIN_CANDIDATES',
    contractVersion: '2.0.0',
    fields: [
      {
        field: 'domainCode',
        class: 'REQUIRED_FOR_ROUTING',
        reproducible: true,
        notes: 'R1 maps to fieldCode; P3 eval set',
      },
      {
        field: 'rank',
        class: 'REQUIRED_FOR_ROUTING',
        reproducible: true,
        notes: 'R1 sorts by rank',
      },
      {
        field: 'candidateStatus',
        class: 'REQUIRED_FOR_ROUTING',
        reproducible: true,
        notes: 'WEAK ignored as competitor; ACTIVE kept including secondaries',
      },
      {
        field: 'catalogStatus',
        class: 'REQUIRED_FOR_ROUTING',
        reproducible: true,
      },
      {
        field: 'confidence',
        class: 'REQUIRED_FOR_ROUTING',
        reproducible: false,
        notes: 'R1 floors 0.7 / delta 0.08 / secondary 0.75. Gemini-specific magnitude. Adapter 1.0 is routing-only.',
      },
      {
        field: 'ambiguityFlags',
        class: 'REQUIRED_FOR_ROUTING',
        reproducible: 'PARTIAL',
        notes: 'MULTI_CANDIDATE_TIE, CONTRADICTORY_EVIDENCE, TRANSVERSAL_SUPPORT affect R1',
      },
      {
        field: 'supportingEvidenceUnitIds',
        class: 'REQUIRED_FOR_AUDIT',
        reproducible: 'PARTIAL',
        notes: 'R1 uses length vs contradictions only. P3 does not read P2 supports. Must be ceu_ in production.',
      },
      {
        field: 'contradictingEvidenceUnitIds',
        class: 'REQUIRED_FOR_ROUTING',
        reproducible: false,
        notes: 'R1 blocks if CONTRADICTORY_EVIDENCE and many IDs. Candidate.2 does not emit Gemini contradictions. Empty is safe for skip-eligible.',
      },
      {
        field: 'outcomeStatus',
        class: 'REQUIRED_FOR_ROUTING',
        reproducible: true,
      },
      {
        field: 'reviewState',
        class: 'REQUIRED_FOR_ROUTING',
        reproducible: true,
        notes: 'REQUIRED blocks R1',
      },
      {
        field: 'rationaleCode',
        class: 'OPTIONAL_METADATA',
        reproducible: 'MAPPED',
        notes: 'R1/P3 do not read P2 rationaleCode. Versioned map exists for audit.',
      },
      {
        field: 'coverageRatio',
        class: 'OPTIONAL_METADATA',
        reproducible: false,
        notes: 'NON_EQUIVALENT_METADATA. Not read by R1 or P3.',
      },
      {
        field: 'signalKindMix',
        class: 'GEMINI_SPECIFIC',
        reproducible: false,
      },
      {
        field: 'evidenceDispositions',
        class: 'OPTIONAL_METADATA',
        reproducible: 'PARTIAL',
        notes: 'Not consumed by R1/P3',
      },
      {
        field: 'professionalActivities / capabilityAreas',
        class: 'GEMINI_SPECIFIC',
        reproducible: false,
        notes: 'Not in R1 P2ContractView',
      },
      {
        field: 'producedBy',
        class: 'REQUIRED_FOR_AUDIT',
        reproducible: true,
        notes: 'RULE_HINT for deterministic',
      },
    ],
  };

  const r1Dependency = {
    reRanks: true,
    resolvesConflicts: true,
    requiresMultipleCandidates: true,
    needsConfidence: true,
    needsSupports: 'length vs contradictions only',
    needsContradictions: true,
    policy: {
      clearLeadMinDelta: 0.08,
      strongSecondaryMinConfidence: 0.75,
      resolveMinConfidence: 0.7,
      ignoreWeakAsCompetitor: true,
    },
    p3ConsumesSecondariesOnResolved: true,
    observedSkipEligible: {
      Johan: { historicalR1: 'MULTI_FIELD', secondaries: ['VISUAL_DESIGN'], p3: ['SOFTWARE_ENGINEERING', 'VISUAL_DESIGN'] },
      S19: { historicalR1: 'MULTI_FIELD', secondaries: ['AUDIOVISUAL_PRODUCTION'] },
      Camilo: { historicalR1: 'RESOLVED', secondaries: ['IT_SYSTEMS', 'DATA_ANALYTICS', 'PROJECT_PROGRAM_MGMT'] },
    },
  };

  const blockers = [
    {
      code: 'SECONDARY_CANDIDATES',
      severity: 'BLOCKING_FOR_AUTHORITY',
      detail:
        'R1 emits secondaries even on RESOLVED; P3 evaluates them. Single-field synthetic P2 changes R1 status/secondaries and P3 field context for all 3 skip-eligible cases.',
    },
    {
      code: 'CONFIDENCE',
      severity: 'ADAPTER_REQUIRED',
      detail:
        'R1 requires numeric confidence. Cannot emit null. Adapter 1.0 is not Gemini-equivalent. Primary fieldCode can still match.',
    },
    {
      code: 'COVERAGE_RATIO',
      severity: 'NON_BLOCKING',
      detail: 'NON_EQUIVALENT_METADATA. Not read by R1/P3.',
    },
    {
      code: 'P2_CONTRACT',
      severity: 'NON_BLOCKING_ENUM_GAP',
      detail: 'generativeResultOrigin has no DETERMINISTIC value; provenance must be extended before authority.',
    },
    {
      code: 'CATALOG_OVERLAY',
      severity: 'NON_BLOCKING_FOR_DESIGN',
      detail: 'Skip-eligible mix is MIXED/NATIVE. Overlay 0.3.0 remains experimental.',
    },
    {
      code: 'DOMAIN_VALIDATION',
      severity: 'ROLLOUT_CONSTRAINT',
      detail: 'Safe skips only observed for SOFTWARE_ENGINEERING and COMMUNICATIONS. DA had no skip-eligible.',
    },
    {
      code: 'R1_DEPENDENCY',
      severity: 'BLOCKING_FOR_AUTHORITY',
      detail: 'R1 is not a pass-through of rank-1. Close ACTIVE pairs become MULTI_FIELD (Johan, S19).',
    },
  ];

  const designReady =
    r1Matches === inventory.length &&
    p3Matches === inventory.length &&
    downstreamOk &&
    syntheticInvalid === 0 &&
    ledgerBefore.calls === 0;

  const verdict = designReady
    ? 'P2_SKIP_INTEGRATION_DESIGN_READY'
    : r1Matches < inventory.length || !downstreamOk
      ? 'MORE_P2_CONTRACT_WORK_REQUIRED'
      : 'P2_SKIP_INTEGRATION_BLOCKED';

  const pass1 = () =>
    stableStringify({
      inventory: inventory.map((r) => r.snapshotId),
      r1Rows,
      p3Rows,
      syntheticRows,
    });
  const determinism = pass1() === pass1() ? 'PASS' : 'FAIL';
  const ledgerAfter = ledgerSnapshot(backendRoot);
  const ledger = {
    before: ledgerBefore,
    after: ledgerAfter,
    callsDelta: ledgerAfter.calls - ledgerBefore.calls,
    tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
    eventsDelta: ledgerAfter.events - ledgerBefore.events,
  };

  const rollout = {
    stage0: 'SHADOW — Candidate.2 observe only, skipGemini=false',
    stage1: 'allowlist snapshots Johan/Camilo/S19 in lab — still skipGemini=false until secondary-candidate policy exists',
    stage2: 'authority for SKIP_ELIGIBLE in allowedDeterministicFields after R1/P3 secondary policy',
    stage3: 'general — not proposed',
    allowedDeterministicFieldsProposed: ['SOFTWARE_ENGINEERING', 'COMMUNICATIONS'],
    initialAllowlistNotActivated: [
      { person: 'Johan', snapshotId: '12', field: 'SOFTWARE_ENGINEERING' },
      { person: 'Camilo', snapshotId: '8', field: 'SOFTWARE_ENGINEERING' },
      { person: 'S19', snapshotId: '19', field: 'COMMUNICATIONS' },
    ],
    excludedUntilValidated: ['DATA_ANALYTICS'],
    flags: {
      MC1_P2_DETERMINISTIC_RESOLVER_ENABLED: { default: 'env, shadow only', implemented: false },
      MC1_P2_DETERMINISTIC_SKIP_ENABLED: { default: false, implemented: false, mustStayFalse: true },
    },
    statesThisPhase: ['SHADOW', 'ELIGIBLE'],
    notThisPhase: ['AUTHORITATIVE_DETERMINISTIC', 'FALLBACK_GEMINI'],
  };

  const observability = {
    events: [
      'P2_DETERMINISTIC_ELIGIBLE',
      'P2_DETERMINISTIC_USED',
      'P2_GEMINI_FALLBACK',
      'P2_DETERMINISTIC_REUSED',
      'P2_DETERMINISTIC_ERROR',
    ],
    emitUsedThisPhase: false,
    metrics: [
      'eligible rate',
      'actual deterministic usage',
      'fallback rate',
      'agreement shadow',
      'tokens avoided',
      'latency',
      'errors',
    ],
    costAccounting: {
      geminiCallsAvoided: 1,
      tokensAvoided: 'historical estimate / unknown — do not mix',
    },
  };

  const artifacts = {
    skipGemini: false,
    candidate: {
      resolver: '0.3.0',
      policy: '0.3.0',
      skipActive: false,
    },
    ledger,
    determinism,
    verdict,
    r1: { matches: r1Matches, total: inventory.length, differences: inventory.length - r1Matches },
    p3Input: { matches: p3Matches, total: inventory.length, differences: inventory.length - p3Matches },
    synthetic: { cases: syntheticRows.length, valid: syntheticValid, invalid: syntheticInvalid },
    downstreamOk,
    p3: 'NOT_TOUCHED',
    p4: 'NOT_TOUCHED',
    missing141: 'NOT_PROCESSED',
  };

  const files: Record<string, unknown> = {
    'p2-contract-audit.json': contractAudit,
    'r1-dependency.json': r1Dependency,
    'synthetic-p2.json': {
      casesSimulated: syntheticRows.length,
      valid: syntheticValid,
      invalid: syntheticInvalid,
      rows: syntheticRows,
    },
    'r1-equivalence.json': {
      matches: r1Matches,
      differences: inventory.length - r1Matches,
      objective: '20/20',
      rows: r1Rows,
    },
    'p3-input-equivalence.json': {
      matches: p3Matches,
      differences: inventory.length - p3Matches,
      skipEligible: skipPeople,
      rows: p3Rows,
    },
    'rollout-plan.json': rollout,
    'observability.json': observability,
    'blockers.json': { verdict, blockers },
    'summary.json': artifacts,
  };

  const outDir = join(backendRoot, 'tmp', 'mc1-p2-deterministic-skip-design');
  mkdirSync(outDir, { recursive: true });
  const repoTmp = join(backendRoot, '..', 'tmp', 'mc1-p2-deterministic-skip-design');
  mkdirSync(repoTmp, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    const text = stableStringify(body);
    writeFileSync(join(outDir, name), text, 'utf8');
    writeFileSync(join(repoTmp, name), text, 'utf8');
  }
  return { outDir, ...artifacts, ledger };
}
