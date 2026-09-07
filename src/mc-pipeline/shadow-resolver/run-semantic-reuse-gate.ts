/**
 * FASE — MC1 SEMANTIC REUSE GATE PROTOTYPE
 * Offline. Gemini = 0. No modifica fingerprints ni gates productivos.
 * No importa el módulo semantic-reuse desde runners P1–P4.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SPECIALTY_CATALOG_SCOPE, SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
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
import {
  buildP3PromptEffective,
  buildP4PromptEffective,
  decideP3Reuse,
  decideP4Reuse,
  defaultP3SemanticInput,
  defaultP4SemanticInput,
  evidenceIdentityFromUnits,
  runSemanticGateAdversarialTests,
  runSemanticGateMutationTests,
  type P3SemanticInput,
  type P4SemanticInput,
  type ReuseDecision,
  type SemanticLineage,
} from '../semantic-reuse';
import { evaluateDeterministicAuthority } from './authority-runtime';
import { artifactIdentityFromP1PackRel } from './full-contract-evidence';
import { isDeterministicSkipGeminiEnabled, isP2DeterministicAuthorityEnabled } from './flags';
import { discoverHistoricalInventory } from './inventory';
import {
  MEASURED_P2_TOKENS,
  MEASURED_P3_TOKENS,
  MEASURED_P4_TOKENS,
} from './limited-rollout';
import { p3ContextFromHistoricalR1 } from './p3-shadow-context';
import { sha256Utf8, stableStringify } from '../semantic-reuse/hash';

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

function isSafe(d: ReuseDecision): boolean {
  return d === 'SAFE_REUSE' || d === 'SAFE_REUSE_WITH_METADATA_CHANGE';
}

function currentP3Fp(digest: string, status: string, fields: string[]): string {
  return computeP3ReuseFingerprint({
    p1ArtifactDigest: digest,
    r1FieldResolutionStatus: status,
    fieldsEvaluated: fields,
    promptVersion: P3_PROMPT_VERSION,
    contractVersion: P3_CONTRACT_VERSION,
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    reasoningPolicyVersion: P3_REASONING_POLICY_VERSION,
    generationPolicyVersion: P3_GENERATION_POLICY_VERSION,
    model: PINNED_MODEL,
  });
}

function currentP4Fp(digest: string, p3Identity: string, specialtiesKey: string): string {
  return computeP4ReuseFingerprint({
    p1ArtifactDigest: digest,
    p3ResultIdentity: p3Identity,
    specialtiesKey,
    promptVersion: P4_PROMPT_VERSION,
    contractVersion: P4_CONTRACT_VERSION,
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    routingPolicyVersion: P4_ROUTING_POLICY_VERSION,
    reasoningPolicyVersion: P4_REASONING_POLICY_VERSION,
    generationPolicyVersion: P4_GENERATION_POLICY_VERSION,
    model: PINNED_MODEL,
  });
}

function writeTwin(backendRoot: string, files: Record<string, unknown>) {
  const outDir = join(backendRoot, 'tmp', 'mc1-semantic-reuse-gate');
  mkdirSync(outDir, { recursive: true });
  const repoTmp = join(backendRoot, '..', 'tmp', 'mc1-semantic-reuse-gate');
  mkdirSync(repoTmp, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    const text = stableStringify(body);
    writeFileSync(join(outDir, name), text, 'utf8');
    writeFileSync(join(repoTmp, name), text, 'utf8');
  }
  return outDir;
}

export function runSemanticReuseGatePrototype(backendRoot: string) {
  if (isDeterministicSkipGeminiEnabled() !== false) throw new Error('SKIP_MUST_STAY_FALSE');
  if (isP2DeterministicAuthorityEnabled() !== false) throw new Error('AUTHORITY_MUST_STAY_FALSE');
  const ledgerBefore = ledgerSnapshot(backendRoot);
  return runOnce(backendRoot, ledgerBefore);
}

function runOnce(backendRoot: string, ledgerBefore: ReturnType<typeof ledgerSnapshot>) {
  const inventory = discoverHistoricalInventory(backendRoot).filter((r) => r.p2Class === 'P2_ELIGIBLE');
  const p3Inputs: unknown[] = [];
  const p4Inputs: unknown[] = [];
  const currentVs: unknown[] = [];
  const decisions: unknown[] = [];
  const payloads: unknown[] = [];
  const simRows: unknown[] = [];
  const critical: unknown[] = [];

  for (const row of inventory) {
    if (!row.p1PackRel) continue;
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, row.p1PackRel));
    const evidenceIdentity = evidenceIdentityFromUnits(units);
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
    const histR1Today = uniqSort(histP3Ctx.map((f) => f.fieldCode));
    const histRoles = Object.fromEntries(
      histP3Ctx.filter((f) => f.role).map((f) => [f.fieldCode, f.role as string]),
    );

    let histP3Fields = histR1Today;
    let histStatus = histR1?.payload.fieldResolutionStatus ?? 'UNRESOLVED';
    let histP3RunId: string | null = null;
    let histSpecialties: P4SemanticInput['specialties'] = [];
    if (row.p3PackRel) {
      const p3Abs = resolve(backendRoot, row.p3PackRel);
      const p3Path = join(p3Abs, 'p3-contract.json');
      if (existsSync(p3Path)) {
        const p3 = JSON.parse(readFileSync(p3Path, 'utf8')) as P3ContractEnvelope;
        if (Array.isArray(p3.payload?.fieldsEvaluated) && p3.payload.fieldsEvaluated.length) {
          histP3Fields = uniqSort(p3.payload.fieldsEvaluated);
        }
        if (p3.payload?.r1FieldResolutionStatus) histStatus = p3.payload.r1FieldResolutionStatus;
        histP3RunId = p3.pipelineRunId ?? p3.payload.executionId ?? null;
        histSpecialties = resolveP4SpecialtiesEvaluated(p3).map((s) => ({
          fieldCode: s.fieldCode,
          specialtyCode: s.specialtyCode,
          status: s.p3Status,
          evaluationRole: s.evaluationRole,
          publishableFromP3: s.publishableFromP3,
          routingEligible: s.routingEligible !== false,
          p3Confidence: s.p3Confidence,
        }));
      }
    }

    const detR1 = sim.r1;
    const detProdFields = detR1
      ? uniqSort([detR1.primary, ...detR1.secondaries].filter((x): x is string => !!x))
      : [];
    const detStatus = detR1?.resolutionStatus ?? 'UNRESOLVED';
    const detRoles = Object.fromEntries(sim.p3.filter((f) => f.role).map((f) => [f.fieldCode, f.role as string]));

    const oldP3: P3SemanticInput = defaultP3SemanticInput({
      contract: 'PRODUCTION',
      evidenceIdentity,
      fieldContext: histP3Fields.map((c) => ({ fieldCode: c, fieldRole: histRoles[c] })),
      r1FieldResolutionStatus: histStatus,
    });
    const newP3: P3SemanticInput = defaultP3SemanticInput({
      contract: 'PRODUCTION',
      evidenceIdentity,
      fieldContext: detProdFields.map((c) => ({ fieldCode: c, fieldRole: detRoles[c] })),
      r1FieldResolutionStatus: detStatus,
    });
    const lineage: SemanticLineage = {
      originalRunId: histP3RunId,
      newRunId: sim.authorityEligible ? 'deterministic-authority-sim' : histP3RunId,
      originalProducer: 'GEMINI',
      newUpstreamProducer: sim.authorityEligible ? 'DETERMINISTIC_RESOLVER' : 'GEMINI',
      oldResultIdentity: currentP3Fp(evidenceIdentity, histStatus, histP3Fields),
      newResultIdentity: sim.authorityEligible
        ? currentP3Fp(evidenceIdentity, detStatus, detProdFields)
        : currentP3Fp(evidenceIdentity, histStatus, histP3Fields),
    };
    const p3Rec = decideP3Reuse(oldP3, newP3, lineage);

    const oldP4: P4SemanticInput | null = histSpecialties.length
      ? defaultP4SemanticInput({
          evidenceIdentity,
          specialties: histSpecialties,
          r1FieldResolutionStatus: histStatus,
        })
      : null;
    const candidateP4 =
      isSafe(p3Rec.reuseDecision) && oldP4
        ? defaultP4SemanticInput({
            evidenceIdentity,
            specialties: histSpecialties,
            r1FieldResolutionStatus: detStatus,
          })
        : null;
    const p4Rec = decideP4Reuse({
      p3Decision: p3Rec.reuseDecision,
      oldInput: oldP4,
      candidate: candidateP4,
      lineage: {
        ...lineage,
        oldResultIdentity: lineage.oldResultIdentity,
        newResultIdentity: isSafe(p3Rec.reuseDecision)
          ? lineage.oldResultIdentity
          : 'WOULD_RECOMPUTE_P3',
      },
    });

    const p3PayloadOld = buildP3PromptEffective({ input: oldP3, units });
    const p3PayloadNew = buildP3PromptEffective({ input: newP3, units });
    const p3PayloadEq = p3PayloadOld.digest === p3PayloadNew.digest;
    if (isSafe(p3Rec.reuseDecision) && !p3PayloadEq) {
      critical.push({
        person: row.person,
        snapshotId: row.snapshotId,
        phase: 'P3',
        code: 'CRITICAL_UNDERINVALIDATION',
        note: 'semantic SAFE* but prompt-effective payload differs',
      });
    }
    let p4PayloadEq: boolean | null = null;
    if (isSafe(p3Rec.reuseDecision) && oldP4 && candidateP4) {
      const a = buildP4PromptEffective({ input: oldP4, units });
      const b = buildP4PromptEffective({ input: candidateP4, units });
      p4PayloadEq = a.digest === b.digest;
      if (isSafe(p4Rec.reuseDecision) && !p4PayloadEq) {
        critical.push({
          person: row.person,
          snapshotId: row.snapshotId,
          phase: 'P4',
          code: 'CRITICAL_UNDERINVALIDATION',
          note: 'semantic SAFE* but prompt-effective payload differs',
        });
      }
    }

    const currentP3Changed =
      currentP3Fp(evidenceIdentity, histStatus, histP3Fields) !==
      currentP3Fp(evidenceIdentity, detStatus, detProdFields);
    const specKey = p4SpecialtiesKey(histSpecialties);
    const currentP4Changed =
      currentP4Fp(evidenceIdentity, lineage.oldResultIdentity ?? 'h', specKey) !==
      currentP4Fp(
        evidenceIdentity,
        isSafe(p3Rec.reuseDecision) ? (lineage.oldResultIdentity ?? 'h') : 'new-p3-pack',
        specKey,
      );
    const semanticP3Invalidates = !isSafe(p3Rec.reuseDecision);
    let vs: 'same_decision' | 'overinvalidated_today' | 'underinvalidated_risk' = 'same_decision';
    if (currentP3Changed && !semanticP3Invalidates) vs = 'overinvalidated_today';
    if (!currentP3Changed && semanticP3Invalidates) vs = 'underinvalidated_risk';

    const authorityEligible = sim.authorityEligible;
    const wouldSkipP2 = authorityEligible;
    const joint =
      authorityEligible && isSafe(p3Rec.reuseDecision) && isSafe(p4Rec.reuseDecision)
        ? 'P2_AUTHORITY_WITH_SAFE_DOWNSTREAM_REUSE'
        : null;
    const canary = joint ? 'CANARY_CANDIDATE' : null;

    const p2Saved = wouldSkipP2 ? MEASURED_P2_TOKENS : 0;
    const p3Cost = wouldSkipP2 && !isSafe(p3Rec.reuseDecision) ? MEASURED_P3_TOKENS : 0;
    const p4Cost = wouldSkipP2 && !isSafe(p4Rec.reuseDecision) ? MEASURED_P4_TOKENS : 0;
    const p3Saved = wouldSkipP2 && isSafe(p3Rec.reuseDecision) ? MEASURED_P3_TOKENS : 0;
    const p4Saved = wouldSkipP2 && isSafe(p4Rec.reuseDecision) ? MEASURED_P4_TOKENS : 0;
    const net = p2Saved + p3Saved + p4Saved - p3Cost - p4Cost - (wouldSkipP2 ? 0 : 0);
    const netTokens = p2Saved - p3Cost - p4Cost;

    const rec = {
      person: row.person,
      snapshotId: row.snapshotId,
      authorityEligible,
      wouldSkipP2,
      jointState: joint,
      canary,
      historical: {
        p3PackFields: histP3Fields,
        r1WouldEvaluateToday: histR1Today,
        r1Status: histStatus,
      },
      deterministic: {
        productionP3Fields: detProdFields,
        r1Status: detStatus,
        producedBy: sim.producedBy,
      },
      p3: p3Rec,
      p4: p4Rec,
      profile: {
        deterministicReusable: isSafe(p3Rec.reuseDecision) && isSafe(p4Rec.reuseDecision),
        note: 'same valid P3/P4 packs → presentation reassemblable without Gemini',
      },
      payload: { p3Equivalent: p3PayloadEq, p4Equivalent: p4PayloadEq },
      currentVsSemantic: vs,
      cost: {
        p2Saved,
        p3Saved,
        p4Saved,
        p3Cost,
        p4Cost,
        net: netTokens,
        label: 'HISTORICAL_COUNTERFACTUAL_SEMANTIC_REUSE',
      },
    };
    void net;


    p3Inputs.push({
      person: row.person,
      snapshotId: row.snapshotId,
      contract: 'PRODUCTION',
      old: oldP3,
      candidate: newP3,
      compare: p3Rec.compare,
      fingerprints: { old: p3Rec.oldSemanticFingerprint, candidate: p3Rec.semanticFingerprint },
    });
    p4Inputs.push({
      person: row.person,
      snapshotId: row.snapshotId,
      old: oldP4,
      candidate: candidateP4,
      compare: p4Rec.compare,
      p3Decision: p3Rec.reuseDecision,
      excluded: ['p3ResultIdentity'],
    });
    currentVs.push({
      person: row.person,
      snapshotId: row.snapshotId,
      currentP3Changed,
      semanticP3Invalidates,
      currentP4WouldInvalidateIfP3Regen: currentP4Changed,
      class: vs,
    });
    decisions.push({
      person: row.person,
      snapshotId: row.snapshotId,
      p3: p3Rec.reuseDecision,
      p4: p4Rec.reuseDecision,
      compareP3: p3Rec.compare,
      compareP4: p4Rec.compare,
      usageRelationP3: p3Rec.usageRelation,
      usageRelationP4: p4Rec.usageRelation,
      lineage: p3Rec.lineage,
      historyNotRewritten: true,
    });
    payloads.push({
      person: row.person,
      snapshotId: row.snapshotId,
      p3Equivalent: p3PayloadEq,
      p4Equivalent: p4PayloadEq,
    });
    simRows.push(rec);
  }

  const adversarial = runSemanticGateAdversarialTests();
  const mutation = runSemanticGateMutationTests();
  const ledgerAfter = ledgerSnapshot(backendRoot);
  const ledger = {
    before: ledgerBefore,
    after: ledgerAfter,
    callsDelta: ledgerAfter.calls - ledgerBefore.calls,
    tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
    eventsDelta: ledgerAfter.events - ledgerBefore.events,
  };

  const p3Safe = (simRows as Array<{ p3: { reuseDecision: ReuseDecision } }>).filter((r) =>
    isSafe(r.p3.reuseDecision),
  ).length;
  const p3Recompute = (simRows as Array<{ p3: { reuseDecision: ReuseDecision } }>).filter(
    (r) => r.p3.reuseDecision === 'RECOMPUTE_REQUIRED',
  ).length;
  const currentInvalidations = (currentVs as Array<{ currentP3Changed: boolean }>).filter(
    (r) => r.currentP3Changed,
  ).length;
  const semanticInvalidations = (currentVs as Array<{ semanticP3Invalidates: boolean }>).filter(
    (r) => r.semanticP3Invalidates,
  ).length;
  const over = (currentVs as Array<{ class: string }>).filter((r) => r.class === 'overinvalidated_today').length;
  const under = (currentVs as Array<{ class: string }>).filter((r) => r.class === 'underinvalidated_risk').length;

  const canaries = (simRows as Array<{ jointState: string | null; person: string; canary: string | null }>).filter(
    (r) => r.jointState === 'P2_AUTHORITY_WITH_SAFE_DOWNSTREAM_REUSE',
  );
  const candidateRows = (
    simRows as Array<{
      person: string;
      cost: { p2Saved: number; p3Cost: number; p4Cost: number; net: number; p3Saved: number; p4Saved: number };
    }>
  ).filter((r) => ['Camilo', 'Johan', 'S19'].includes(r.person));
  const net = candidateRows.reduce(
    (a, r) => ({
      p2Saved: a.p2Saved + r.cost.p2Saved,
      p3Cost: a.p3Cost + r.cost.p3Cost,
      p4Cost: a.p4Cost + r.cost.p4Cost,
      p3Saved: a.p3Saved + r.cost.p3Saved,
      p4Saved: a.p4Saved + r.cost.p4Saved,
      net: a.net + r.cost.net,
    }),
    { p2Saved: 0, p3Cost: 0, p4Cost: 0, p3Saved: 0, p4Saved: 0, net: 0 },
  );

  const files: Record<string, unknown> = {
    'p3-semantic-inputs.json': { contract: 'PRODUCTION', roleAwareSeparate: true, rows: p3Inputs },
    'p4-semantic-inputs.json': { p3ResultIdentityExcluded: true, rows: p4Inputs },
    'current-vs-semantic.json': {
      currentInvalidations,
      semanticInvalidations,
      safeReuse: p3Safe,
      overinvalidationsRemoved: over,
      underinvalidationsDetected: under,
      rows: currentVs,
    },
    'reuse-decisions.json': { rows: decisions },
    'payload-equivalence.json': { rows: payloads },
    'authority-reuse-simulation.json': {
      skipGemini: false,
      authorityEnabled: false,
      rows: simRows,
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
    'net-cost.json': {
      ...net,
      downstreamRecompute: net.p3Cost + net.p4Cost,
      downstreamReuse: net.p3Saved + net.p4Saved,
      label: 'HISTORICAL_COUNTERFACTUAL_SEMANTIC_REUSE',
      rows: candidateRows.map((r) => ({ person: r.person, ...r.cost })),
    },
    'determinism-report.json': { status: 'PENDING' },
  };

  const digest1 = sha256Utf8(stableStringify(files));
  const outDir = writeTwin(backendRoot, files);

  return {
    outDir,
    ledger,
    filesDigest: digest1,
    p3Safe,
    p3Recompute,
    currentInvalidations,
    semanticInvalidations,
    over,
    under,
    critical,
    canaries,
    net,
    adversarial: {
      passed: adversarial.filter((t) => t.pass).length,
      failed: adversarial.filter((t) => !t.pass).length,
    },
    mutation: {
      passed: mutation.filter((t) => t.pass).length,
      failed: mutation.filter((t) => !t.pass).length,
    },
    controls: {
      Camilo: simRows.find((r) => (r as { person: string }).person === 'Camilo'),
      Johan: simRows.find((r) => (r as { person: string }).person === 'Johan'),
      S19: simRows.find((r) => (r as { person: string }).person === 'S19'),
      'Juan Pablo': simRows.find((r) => (r as { person: string }).person === 'Juan Pablo'),
      Diego: simRows.find((r) => (r as { person: string }).person === 'Diego'),
    },
    transitions: simRows.length,
  };
}

export function runSemanticReuseGateWithDeterminism(backendRoot: string) {
  if (isDeterministicSkipGeminiEnabled() !== false) throw new Error('SKIP_MUST_STAY_FALSE');
  if (isP2DeterministicAuthorityEnabled() !== false) throw new Error('AUTHORITY_MUST_STAY_FALSE');
  const ledgerBefore = ledgerSnapshot(backendRoot);
  const a = runOnce(backendRoot, ledgerBefore);
  const b = runOnce(backendRoot, ledgerBefore);
  const determinism = a.filesDigest === b.filesDigest ? 'PASS' : 'FAIL';
  const ledgerAfter = ledgerSnapshot(backendRoot);
  const ledger = {
    before: ledgerBefore,
    after: ledgerAfter,
    callsDelta: ledgerAfter.calls - ledgerBefore.calls,
    tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
    eventsDelta: ledgerAfter.events - ledgerBefore.events,
  };
  const costOk = ledger.callsDelta === 0 && ledger.tokensDelta === 0 && ledger.eventsDelta === 0;
  const testsOk = a.adversarial.failed === 0 && a.mutation.failed === 0;
  const camilo = a.controls.Camilo as {
    p3: { reuseDecision: ReuseDecision; compare: string };
    p4: { reuseDecision: ReuseDecision };
    jointState: string | null;
    canary: string | null;
    cost: { net: number };
    payload: { p3Equivalent: boolean; p4Equivalent: boolean };
  } | undefined;
  const johan = a.controls.Johan as { p3: { reuseDecision: ReuseDecision }; p4: { reuseDecision: ReuseDecision }; cost: { net: number } } | undefined;
  const s19 = a.controls.S19 as { p3: { reuseDecision: ReuseDecision }; p4: { reuseDecision: ReuseDecision }; cost: { net: number } } | undefined;
  const camiloOk =
    !!camilo &&
    isSafe(camilo.p3.reuseDecision) &&
    isSafe(camilo.p4.reuseDecision) &&
    camilo.p3.compare !== 'SEMANTIC_CHANGE';
  const johanOk = johan?.p3.reuseDecision === 'RECOMPUTE_REQUIRED';
  const s19Ok = s19?.p3.reuseDecision === 'RECOMPUTE_REQUIRED';
  const criticalCount = a.critical.length;
  let verdict:
    | 'SEMANTIC_REUSE_GATE_PROTOTYPE_VALIDATED'
    | 'MORE_SEMANTIC_REUSE_WORK_REQUIRED'
    | 'SEMANTIC_REUSE_GATE_REJECTED' = 'MORE_SEMANTIC_REUSE_WORK_REQUIRED';
  if (criticalCount > 0) verdict = 'SEMANTIC_REUSE_GATE_REJECTED';
  else if (costOk && testsOk && determinism === 'PASS' && camiloOk && johanOk && s19Ok && a.under === 0) {
    verdict = 'SEMANTIC_REUSE_GATE_PROTOTYPE_VALIDATED';
  }

  const detReport = {
    status: determinism,
    digestA: a.filesDigest,
    digestB: b.filesDigest,
  };
  writeTwin(backendRoot, {
    ...readWritten(backendRoot),
    'determinism-report.json': detReport,
  });

  return {
    ...a,
    ledger,
    determinism,
    verdict,
    criticalCount,
    camiloOk,
    johanOk,
    s19Ok,
  };
}

function readWritten(backendRoot: string): Record<string, unknown> {
  const dir = join(backendRoot, 'tmp', 'mc1-semantic-reuse-gate');
  const names = [
    'p3-semantic-inputs.json',
    'p4-semantic-inputs.json',
    'current-vs-semantic.json',
    'reuse-decisions.json',
    'payload-equivalence.json',
    'authority-reuse-simulation.json',
    'adversarial-tests.json',
    'mutation-tests.json',
    'net-cost.json',
  ];
  const out: Record<string, unknown> = {};
  for (const n of names) {
    const p = join(dir, n);
    if (existsSync(p)) out[n] = JSON.parse(readFileSync(p, 'utf8'));
  }
  return out;
}
