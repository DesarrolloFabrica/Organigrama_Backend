/**
 * FASE — MC1 DOWNSTREAM SEMANTIC REUSE AUDIT
 * Offline. Gemini = 0. No modifica fingerprints productivos ni reuse gates.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SPECIALTY_CATALOG_SCOPE, SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import { computeP3ReuseFingerprint, computeP4ReuseFingerprint, p4SpecialtiesKey } from '../gemini/reuse-fingerprint';
import { findLatestR1Pack, loadR1Contract } from '../p3/p3-context-loader';
import {
  P3_CONTRACT_VERSION,
  P3_GENERATION_POLICY_VERSION,
  P3_PROMPT_VERSION,
  P3_REASONING_POLICY_VERSION,
  type P3ContractEnvelope,
} from '../p3/p3.types';
import { resolveP4SpecialtiesEvaluated } from '../p4/p4-context-loader';
import {
  P4_CONTRACT_VERSION,
  P4_GENERATION_POLICY_VERSION,
  P4_PROMPT_VERSION,
  P4_REASONING_POLICY_VERSION,
  P4_ROUTING_POLICY_VERSION,
} from '../p4/p4.types';
import { evaluateDeterministicAuthority } from './authority-runtime';
import { artifactIdentityFromP1PackRel } from './full-contract-evidence';
import { isDeterministicSkipGeminiEnabled, isP2DeterministicAuthorityEnabled } from './flags';
import { discoverHistoricalInventory } from './inventory';
import {
  LIMITED_ROLLOUT_ALLOWLIST,
  MEASURED_P2_TOKENS,
  MEASURED_P3_TOKENS,
  MEASURED_P4_TOKENS,
} from './limited-rollout';
import { p3ContextFromHistoricalR1 } from './p3-shadow-context';
import { runAdversarialReuseTests, runMutationTests } from './semantic-reuse-adversarial';
import {
  FIELD_ROLE_SEMANTIC_POLICY,
  MC1_SEMANTIC_REUSE_GATE,
  P3_CURRENT_FINGERPRINT_PARTS,
  P4_CURRENT_FINGERPRINT_PARTS,
  PRODUCER_IDENTITY_POLICY,
  SEMANTIC_REUSE_POLICY,
  classifyFingerprintDelta,
  computeActualP3PromptIdentity,
  computeSemanticP3Fingerprint,
  computeSemanticP4Fingerprint,
  decideReuseSafety,
  type ReuseSafetyClass,
} from './semantic-reuse-design';

const PINNED_MODEL = 'historical';

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

function uniqSort(codes: string[]): string[] {
  return [...new Set(codes.filter((c) => SPECIALTY_CATALOG_SCOPE.has(c)))].sort();
}

function roleMap(rows: Array<{ fieldCode: string; role?: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.role) out[r.fieldCode] = r.role;
  }
  return out;
}

function currentP3Fp(args: { digest: string; status: string; fields: string[] }): string {
  return computeP3ReuseFingerprint({
    p1ArtifactDigest: args.digest,
    r1FieldResolutionStatus: args.status,
    fieldsEvaluated: args.fields,
    promptVersion: P3_PROMPT_VERSION,
    contractVersion: P3_CONTRACT_VERSION,
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    reasoningPolicyVersion: P3_REASONING_POLICY_VERSION,
    generationPolicyVersion: P3_GENERATION_POLICY_VERSION,
    model: PINNED_MODEL,
  });
}

function currentP4Fp(args: { digest: string; p3Identity: string; specialtiesKey: string }): string {
  return computeP4ReuseFingerprint({
    p1ArtifactDigest: args.digest,
    p3ResultIdentity: args.p3Identity,
    specialtiesKey: args.specialtiesKey,
    promptVersion: P4_PROMPT_VERSION,
    contractVersion: P4_CONTRACT_VERSION,
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    routingPolicyVersion: P4_ROUTING_POLICY_VERSION,
    reasoningPolicyVersion: P4_REASONING_POLICY_VERSION,
    generationPolicyVersion: P4_GENERATION_POLICY_VERSION,
    model: PINNED_MODEL,
  });
}

function caseType(args: {
  p3Safety: ReuseSafetyClass;
  p4CurrentWouldInvalidate: boolean;
  p4SemanticWouldInvalidate: boolean;
}): 'A' | 'B' | 'C' | 'N/A' {
  if (args.p3Safety === 'SAFE_REUSE' && args.p4SemanticWouldInvalidate === false) return 'A';
  if (args.p3Safety === 'RECOMPUTE_REQUIRED') return 'B';
  if (
    (args.p3Safety === 'SAFE_REUSE' || args.p3Safety === 'REUSE_UNPROVEN') &&
    args.p4CurrentWouldInvalidate &&
    !args.p4SemanticWouldInvalidate
  ) {
    return 'C';
  }
  if (args.p3Safety === 'REUSE_UNPROVEN') return 'B';
  return 'N/A';
}

export function runSemanticReuseAudit(backendRoot: string) {
  if (isDeterministicSkipGeminiEnabled() !== false) throw new Error('SKIP_MUST_STAY_FALSE');
  if (isP2DeterministicAuthorityEnabled() !== false) throw new Error('AUTHORITY_MUST_STAY_FALSE');
  const ledgerBefore = ledgerSnapshot(backendRoot);
  const inventory = discoverHistoricalInventory(backendRoot).filter((r) => r.p2Class === 'P2_ELIGIBLE');

  const transitions: unknown[] = [];
  const candidateCosts: unknown[] = [];

  for (const row of inventory) {
    if (!row.p1PackRel) continue;
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, row.p1PackRel));
    const sim = evaluateDeterministicAuthority({
      snapshotId: row.snapshotId,
      personId: row.person,
      units,
      artifactIdentity: artifactIdentityFromP1PackRel(row.p1PackRel),
      simulateAuthority: true,
    });
    const histR1Pack = findLatestR1Pack(backendRoot, row.snapshotId);
    const histR1 = histR1Pack ? loadR1Contract(histR1Pack) : null;
    const histP3Ctx = histR1 ? p3ContextFromHistoricalR1(histR1) : [];
    const histR1WouldEvaluateToday = uniqSort(histP3Ctx.map((f) => f.fieldCode));
    const histRoles = roleMap(histP3Ctx);

    let histP3Fields = histR1WouldEvaluateToday;
    let histStatus = histR1?.payload.fieldResolutionStatus ?? 'UNRESOLVED';
    let histSpecialties: Array<{
      fieldCode: string;
      specialtyCode: string;
      evaluationRole?: string;
      p3Status?: string;
    }> = [];
    if (row.p3PackRel) {
      const p3Abs = resolve(backendRoot, row.p3PackRel);
      if (existsSync(join(p3Abs, 'p3-contract.json'))) {
        const p3 = JSON.parse(readFileSync(join(p3Abs, 'p3-contract.json'), 'utf8')) as P3ContractEnvelope;
        if (Array.isArray(p3.payload?.fieldsEvaluated) && p3.payload.fieldsEvaluated.length) {
          histP3Fields = uniqSort(p3.payload.fieldsEvaluated);
        }
        if (p3.payload?.r1FieldResolutionStatus) histStatus = p3.payload.r1FieldResolutionStatus;
        histSpecialties = resolveP4SpecialtiesEvaluated(p3);
      }
    }

    const detR1 = sim.r1;
    const detProdFields = detR1
      ? uniqSort([detR1.primary, ...detR1.secondaries].filter((x): x is string => !!x))
      : [];
    const detAdapterFields = uniqSort(sim.p3.map((f) => f.fieldCode));
    const detRoles = roleMap(sim.p3);
    const detStatus = detR1?.resolutionStatus ?? 'UNRESOLVED';
    const digest = 'PINNED_P1';

    const prodFieldSetChanged = histP3Fields.join('|') !== detProdFields.join('|');
    const adapterFieldSetChanged = histP3Fields.join('|') !== detAdapterFields.join('|');
    const roleChanged = Object.keys({ ...histRoles, ...detRoles }).some(
      (k) => histRoles[k] && detRoles[k] && histRoles[k] !== detRoles[k],
    );
    const statusChanged = histStatus !== detStatus;

    const p3SafetyProd = decideReuseSafety({
      fieldSetChanged: prodFieldSetChanged,
      evidenceChanged: false,
      roleChanged,
      statusChanged,
    });
    const p3SafetyAdapter = decideReuseSafety({
      fieldSetChanged: adapterFieldSetChanged,
      evidenceChanged: false,
      roleChanged,
      statusChanged,
    });

    const histCurrentP3 = currentP3Fp({ digest, status: histStatus, fields: histP3Fields });
    const detCurrentP3Prod = currentP3Fp({ digest, status: detStatus, fields: detProdFields });
    const detCurrentP3Adapter = currentP3Fp({ digest, status: detStatus, fields: detAdapterFields });
    const currentChangedProd = histCurrentP3 !== detCurrentP3Prod;
    const currentChangedAdapter = histCurrentP3 !== detCurrentP3Adapter;

    const histSemantic = computeSemanticP3Fingerprint({
      units,
      fields: histP3Fields.map((c) => ({ fieldCode: c, role: histRoles[c] })),
    });
    const detSemanticProd = computeSemanticP3Fingerprint({
      units,
      fields: detProdFields.map((c) => ({ fieldCode: c, role: detRoles[c] ?? histRoles[c] })),
    });
    const detSemanticAdapter = computeSemanticP3Fingerprint({
      units,
      fields: detAdapterFields.map((c) => ({
        fieldCode: c,
        role: detRoles[c],
      })),
    });
    const semanticChangedProd = histSemantic !== detSemanticProd;
    const semanticChangedAdapter = histSemantic !== detSemanticAdapter;

    const histActual = computeActualP3PromptIdentity({
      units,
      fieldCodes: histP3Fields,
      r1FieldResolutionStatus: histStatus,
    });
    const detActualProd = computeActualP3PromptIdentity({
      units,
      fieldCodes: detProdFields,
      r1FieldResolutionStatus: detStatus,
    });
    const actualChangedProd = histActual !== detActualProd;

    const histSpecKey = p4SpecialtiesKey(histSpecialties);
    const histP4Current = currentP4Fp({
      digest,
      p3Identity: histCurrentP3,
      specialtiesKey: histSpecKey,
    });
    const detP4CurrentIfP3Reexec = currentP4Fp({
      digest,
      p3Identity: detCurrentP3Prod,
      specialtiesKey: histSpecKey,
    });
    const p4CurrentWouldInvalidate = histP4Current !== detP4CurrentIfP3Reexec;
    const p4SemanticWouldInvalidate = p3SafetyProd === 'RECOMPUTE_REQUIRED';
    const p4Safety: ReuseSafetyClass =
      p3SafetyProd === 'SAFE_REUSE'
        ? p4CurrentWouldInvalidate
          ? 'SAFE_REUSE_WITH_METADATA_CHANGE'
          : 'SAFE_REUSE'
        : p3SafetyProd;

    const deltaProd = classifyFingerprintDelta({
      currentChanged: currentChangedProd,
      semanticChanged: semanticChangedProd,
    });
    const deltaAdapter = classifyFingerprintDelta({
      currentChanged: currentChangedAdapter,
      semanticChanged: semanticChangedAdapter,
    });

    const named = LIMITED_ROLLOUT_ALLOWLIST.entries.find((e) => e.snapshotId === row.snapshotId);
    const wouldSkipP2 = Boolean(named && sim.authorityEligible);
    const p3RecomputeOfficial = p3SafetyProd !== 'SAFE_REUSE';
    const p4RecomputeOfficial =
      p4Safety !== 'SAFE_REUSE' && p4Safety !== 'SAFE_REUSE_WITH_METADATA_CHANGE';
    const p2Saved = wouldSkipP2 ? MEASURED_P2_TOKENS : 0;
    const p3Cost = wouldSkipP2 && p3RecomputeOfficial ? MEASURED_P3_TOKENS : 0;
    const p4Cost = wouldSkipP2 && p4RecomputeOfficial ? MEASURED_P4_TOKENS : 0;
    const net = p2Saved - p3Cost - p4Cost;
    const ctype = caseType({
      p3Safety: p3SafetyProd,
      p4CurrentWouldInvalidate,
      p4SemanticWouldInvalidate,
    });

    const rec = {
      person: row.person,
      snapshotId: row.snapshotId,
      authorityEligible: sim.authorityEligible,
      wouldSkipP2,
      historical: {
        r1Status: histStatus,
        p3PackFields: histP3Fields,
        r1WouldEvaluateToday: histR1WouldEvaluateToday,
        r1VsPackDiscrepancy: histR1WouldEvaluateToday.join('|') !== histP3Fields.join('|'),
        p3Fields: histP3Fields,
        roles: histRoles,
        specialtiesKey: histSpecKey,
      },
      deterministic: {
        producedBy: sim.producedBy,
        r1Status: detStatus,
        productionP3Fields: detProdFields,
        adapterP3Fields: detAdapterFields,
        roles: detRoles,
        fallback: sim.fallback,
      },
      p3: {
        productionPath: p3SafetyProd,
        adapterPath: p3SafetyAdapter,
        currentChangedProd,
        currentChangedAdapter,
        semanticChangedProd,
        semanticChangedAdapter,
        actualPromptChangedProd: actualChangedProd,
        fingerprintDeltaProd: deltaProd,
        fingerprintDeltaAdapter: deltaAdapter,
        roleContract: FIELD_ROLE_SEMANTIC_POLICY.currentClassification,
        currentFpHist: histCurrentP3,
        currentFpDetProd: detCurrentP3Prod,
        semanticFpHist: histSemantic,
        semanticFpDetProd: detSemanticProd,
        semanticFpDetAdapter: detSemanticAdapter,
      },
      p4: {
        safety: p4Safety,
        currentWouldInvalidateViaP3Identity: p4CurrentWouldInvalidate,
        semanticWouldInvalidate: p4SemanticWouldInvalidate,
        note: 'P4 specialties after a real P3 recompute are unknown without AI; conservative recompute if P3 recomputes',
      },
      caseType: ctype,
      cost: { p2Saved, p3Cost, p4Cost, net, label: 'HISTORICAL_COUNTERFACTUAL_SEMANTIC_REUSE' },
    };
    transitions.push(rec);
    if (named) candidateCosts.push(rec);
  }

  const p3Metrics = summarizePhase(
    transitions as Array<{
      p3: { productionPath: ReuseSafetyClass; currentChangedProd: boolean; semanticChangedProd: boolean };
    }>,
  );
  const p4Metrics = summarizeP4(
    transitions as Array<{
      p4: {
        safety: ReuseSafetyClass;
        currentWouldInvalidateViaP3Identity: boolean;
        semanticWouldInvalidate: boolean;
      };
    }>,
  );

  const adversarial = runAdversarialReuseTests();
  const mutation = runMutationTests();
  const ledgerAfter = ledgerSnapshot(backendRoot);
  const ledger = {
    before: ledgerBefore,
    after: ledgerAfter,
    callsDelta: ledgerAfter.calls - ledgerBefore.calls,
    tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
    eventsDelta: ledgerAfter.events - ledgerBefore.events,
  };
  const costOk = ledger.callsDelta === 0 && ledger.tokensDelta === 0 && ledger.eventsDelta === 0;
  const testsOk = adversarial.every((t) => t.pass) && mutation.every((t) => t.pass);

  const controls = {
    Camilo: namedControl(transitions, 'Camilo'),
    Johan: namedControl(transitions, 'Johan'),
    S19: namedControl(transitions, 'S19'),
  };

  const candidateNet = (
    candidateCosts as Array<{ cost: { p2Saved: number; p3Cost: number; p4Cost: number; net: number } }>
  ).reduce(
    (a, r) => ({
      p2Saved: a.p2Saved + r.cost.p2Saved,
      p3Cost: a.p3Cost + r.cost.p3Cost,
      p4Cost: a.p4Cost + r.cost.p4Cost,
      net: a.net + r.cost.net,
    }),
    { p2Saved: 0, p3Cost: 0, p4Cost: 0, net: 0 },
  );

  let verdict:
    | 'SEMANTIC_REUSE_MODEL_SUPPORTED'
    | 'CURRENT_REUSE_ALREADY_CORRECT'
    | 'MORE_DEPENDENCY_AUDIT_REQUIRED'
    | 'SEMANTIC_REUSE_TOO_RISKY' = 'MORE_DEPENDENCY_AUDIT_REQUIRED';
  if (!costOk || !testsOk) verdict = 'MORE_DEPENDENCY_AUDIT_REQUIRED';
  else verdict = 'SEMANTIC_REUSE_MODEL_SUPPORTED';

  const files: Record<string, unknown> = {
    'dependency-graph.json': {
      nodes: ['P1', 'P2', 'R1', 'P3', 'P4', 'PROFILE', 'Presentation'],
      edges: [
        { from: 'P1', to: 'P2', kind: 'HARD_SEMANTIC_DEPENDENCY', via: 'evidence units' },
        { from: 'P1', to: 'P3', kind: 'HARD_SEMANTIC_DEPENDENCY', via: 'full evidence set in prompt' },
        { from: 'P1', to: 'P4', kind: 'HARD_SEMANTIC_DEPENDENCY', via: 'full evidence set in prompt' },
        { from: 'P2', to: 'R1', kind: 'HARD_SEMANTIC_DEPENDENCY', via: 'candidates + confidence → status/fields' },
        { from: 'P2', to: 'P3', kind: 'SOFT_DEPENDENCY', via: 'only through R1 field set; producedBy technical-only' },
        { from: 'R1', to: 'P3', kind: 'HARD_SEMANTIC_DEPENDENCY', via: 'fieldCodes PRIMARY+SECONDARY' },
        {
          from: 'R1',
          to: 'P3',
          kind: 'SOFT_DEPENDENCY',
          via: 'r1FieldResolutionStatus in user payload; UNKNOWN effect',
        },
        {
          from: 'P2.CONTEXT',
          to: 'P3',
          kind: 'TECHNICAL_ONLY_DEPENDENCY',
          via: 'P3_CONTEXT_RUNTIME_DISABLED; not in production P3',
        },
        { from: 'P3', to: 'P4', kind: 'HARD_SEMANTIC_DEPENDENCY', via: 'specialtyCode/status/evaluationRole' },
        { from: 'P3', to: 'P4', kind: 'TECHNICAL_ONLY_DEPENDENCY', via: 'p3ResultIdentity (full P3 reuse fp)' },
        { from: 'P4', to: 'PROFILE', kind: 'HARD_SEMANTIC_DEPENDENCY', via: 'deterministic assemble from packs' },
        {
          from: 'PROFILE',
          to: 'Presentation',
          kind: 'HARD_SEMANTIC_DEPENDENCY',
          via: 'reassembleMc1Presentation; no Gemini',
        },
      ],
    },
    'p2-p3-dependencies.json': {
      source: ['p3-prompt-v1.ts', 'p3-context-loader.ts', 'reuse-fingerprint.ts'],
      fieldRoleInPrompt: false,
      producedByInFingerprint: false,
      rows: P3_CURRENT_FINGERPRINT_PARTS,
    },
    'p3-p4-dependencies.json': {
      source: ['p4-prompt-v1.ts', 'p4-context-loader.ts', 'p4-runner.ts'],
      p3ResultIdentityIsCoarseProxy: true,
      rows: P4_CURRENT_FINGERPRINT_PARTS,
    },
    'current-fingerprints.json': {
      p3: {
        parts: [
          'p1ArtifactDigest',
          'r1FieldResolutionStatus',
          'fieldsEvaluated (codes sorted)',
          'prompt/contract/catalog/reasoning/generation/model/modelConfig',
        ],
        notIncluded: ['producedBy', 'fieldRole', 'confidence', 'candidateIds', 'runId', 'p2ResultIdentity'],
        issues: [
          'r1FieldResolutionStatus in prompt+fp: UNKNOWN whether it changes reasoning',
          'fieldRole absent: UNDERINVALIDATION_RISK once CONTEXT policy is live',
        ],
      },
      p4: {
        parts: [
          'p1ArtifactDigest',
          'p3ResultIdentity',
          'specialtiesKey',
          'prompt/contract/catalog/routing/reasoning/generation/model/modelConfig',
        ],
        issues: ['p3ResultIdentity OVERINVALIDATING if P3 pack regenerates with same specialties'],
      },
    },
    'semantic-fingerprint-design.json': {
      policy: SEMANTIC_REUSE_POLICY,
      gate: MC1_SEMANTIC_REUSE_GATE,
      producer: PRODUCER_IDENTITY_POLICY,
      fieldRole: FIELD_ROLE_SEMANTIC_POLICY,
      implemented: false,
      productionFingerprintsUnchanged: true,
    },
    'historical-reuse-simulation.json': {
      evaluated: transitions.length,
      p3: p3Metrics,
      p4: p4Metrics,
      r1VsPackDiscrepancies: (
        transitions as Array<{ historical: { r1VsPackDiscrepancy: boolean } }>
      ).filter((r) => r.historical.r1VsPackDiscrepancy).length,
      note: 'P3 comparison baseline = stored pack fieldsEvaluated (what Gemini actually saw), not resolveFieldsToEvaluate(hist R1) which can include secondaries filtered out of catalog at P3 run time.',
      rows: transitions,
    },
    'candidate-net-cost.json': {
      ...candidateNet,
      p3Recompute: candidateNet.p3Cost,
      p4Recompute: candidateNet.p4Cost,
      label: 'HISTORICAL_COUNTERFACTUAL_SEMANTIC_REUSE',
      officialRule: 'production P3 path; REUSE_UNPROVEN counts as recompute; no forced reuse',
      rows: candidateCosts,
    },
    'adversarial-tests.json': {
      passed: adversarial.filter((t) => t.pass).length,
      failed: adversarial.filter((t) => !t.pass).length,
      cases: adversarial,
    },
    'mutation-tests.json': {
      passed: mutation.filter((t) => t.pass).length,
      failed: mutation.filter((t) => !t.pass).length,
      cases: mutation,
    },
  };

  const outDir = join(backendRoot, 'tmp', 'mc1-semantic-reuse-audit');
  mkdirSync(outDir, { recursive: true });
  const repoTmp = join(backendRoot, '..', 'tmp', 'mc1-semantic-reuse-audit');
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
    p3Metrics,
    p4Metrics,
    candidateNet,
    controls,
    adversarial: {
      passed: adversarial.filter((t) => t.pass).length,
      failed: adversarial.filter((t) => !t.pass).length,
    },
    mutation: {
      passed: mutation.filter((t) => t.pass).length,
      failed: mutation.filter((t) => !t.pass).length,
    },
    transitions: transitions.length,
    missingProfiles: 'NOT_PROCESSED' as const,
  };
}

function namedControl(rows: unknown[], person: string) {
  return (rows as Array<{ person: string }>).find((r) => r.person === person) ?? null;
}

function summarizePhase(
  rows: Array<{
    p3: { productionPath: ReuseSafetyClass; currentChangedProd: boolean; semanticChangedProd: boolean };
  }>,
) {
  return {
    evaluatedTransitions: rows.length,
    currentInvalidations: rows.filter((r) => r.p3.currentChangedProd).length,
    semanticInvalidations: rows.filter((r) => r.p3.semanticChangedProd).length,
    safeReuseOpportunities: rows.filter((r) => r.p3.productionPath === 'SAFE_REUSE').length,
    recomputeRequired: rows.filter((r) => r.p3.productionPath === 'RECOMPUTE_REQUIRED').length,
    unproven: rows.filter((r) => r.p3.productionPath === 'REUSE_UNPROVEN').length,
    overinvalidation: rows.filter((r) => r.p3.currentChangedProd && !r.p3.semanticChangedProd).length,
    underinvalidationRisk: rows.filter((r) => !r.p3.currentChangedProd && r.p3.semanticChangedProd).length,
  };
}

function summarizeP4(
  rows: Array<{
    p4: {
      safety: ReuseSafetyClass;
      currentWouldInvalidateViaP3Identity: boolean;
      semanticWouldInvalidate: boolean;
    };
  }>,
) {
  return {
    evaluatedTransitions: rows.length,
    currentInvalidations: rows.filter((r) => r.p4.currentWouldInvalidateViaP3Identity).length,
    semanticInvalidations: rows.filter((r) => r.p4.semanticWouldInvalidate).length,
    safeReuseOpportunities: rows.filter(
      (r) => r.p4.safety === 'SAFE_REUSE' || r.p4.safety === 'SAFE_REUSE_WITH_METADATA_CHANGE',
    ).length,
    recomputeRequired: rows.filter((r) => r.p4.safety === 'RECOMPUTE_REQUIRED').length,
    unproven: rows.filter((r) => r.p4.safety === 'REUSE_UNPROVEN').length,
  };
}
