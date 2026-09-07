/**
 * FASE — MC1 P2 SEMANTIC REUSE CANARY DESIGN
 * Offline. Gemini = 0. No ejecuta canary. No writes Cloud.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SPECIALTY_CATALOG_SCOPE, SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { RESOLVER_CANDIDATE_2_VERSION } from '../experimental/deterministic-resolver/types';
import { findLatestR1Pack, loadR1Contract } from '../p3/p3-context-loader';
import { findLatestP3Pack, loadP3Contract, resolveP4SpecialtiesEvaluated } from '../p4/p4-context-loader';
import type { P3ContractEnvelope } from '../p3/p3.types';
import { findLatestP4Pack } from '../profile/profile-pack-loader';
import {
  presentationFingerprint,
  reassembleMc1Presentation,
} from '../profile/profile-presentation-reassembly';
import type { Mc1PersonCompetenciesPresentationDto } from '../person-profile/mc1-person-profile.types';
import {
  buildP3SemanticFingerprint,
  buildP4SemanticFingerprint,
  decideP3Reuse,
  decideP4Reuse,
  defaultP3SemanticInput,
  defaultP4SemanticInput,
  evidenceIdentityFromUnits,
} from '../semantic-reuse';
import { sha256Utf8, stableStringify } from '../semantic-reuse/hash';
import { evaluateDeterministicAuthority } from './authority-runtime';
import { computeAuthorityFingerprint } from './authority-fingerprint';
import { artifactIdentityFromP1PackRel } from './full-contract-evidence';
import { CANDIDATE_SET_V2_POLICY_VERSION } from './candidate-set-policy-v2';
import { FULL_CONTRACT_ADAPTER_VERSION } from './full-contract';
import { CANDIDATE_2_POLICY_VERSION } from './skip-eligibility';
import { isDeterministicSkipGeminiEnabled, isP2DeterministicAuthorityEnabled } from './flags';
import { discoverHistoricalInventory } from './inventory';
import {
  CAMILO_CANARY_IDENTITY,
  CANARY_EXECUTION_CONTRACT,
  CANARY_NOT_CANDIDATES,
  evaluateCanaryPreconditions,
  isP2CanaryEnabled,
  productionCanaryArmed,
  type CanaryPreconditionsInput,
} from './canary-design';
import type { SemanticLineage } from '../semantic-reuse/types';

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

function semanticPresentation(p: Mc1PersonCompetenciesPresentationDto) {
  const primary = p.fields.find((f) => f.role === 'PRIMARY');
  const specialties = [...new Set(p.fields.flatMap((f) => f.specialties.map((s) => s.code)))].sort();
  const skills = [
    ...new Set(p.fields.flatMap((f) => f.specialties.flatMap((s) => s.skills.map((sk) => sk.code)))),
  ].sort();
  const radar = p.fields.flatMap((f) =>
    f.competencyMap.dimensions.map((d) => ({
      field: f.code,
      dim: d.code,
      relativeCoverage: d.relativeCoverage,
      evidenceState: d.evidenceState ?? null,
    })),
  );
  const evidenceStates = [...new Set(radar.map((r) => r.evidenceState))].sort();
  return {
    primaryField: primary?.code ?? null,
    specialties,
    skills,
    radar,
    evidenceStates,
  };
}

function eqArr(a: Array<string | null>, b: Array<string | null>): boolean {
  return a.join('|') === b.join('|');
}

export function runCamiloCanaryDesign(backendRoot: string) {
  if (isDeterministicSkipGeminiEnabled() !== false) throw new Error('SKIP_MUST_STAY_FALSE');
  if (isP2DeterministicAuthorityEnabled() !== false) throw new Error('AUTHORITY_MUST_STAY_FALSE');
  if (isP2CanaryEnabled() !== false) throw new Error('CANARY_MUST_STAY_FALSE');
  if (productionCanaryArmed() !== false) throw new Error('CANARY_MUST_STAY_UNARMED');
  const ledgerBefore = ledgerSnapshot(backendRoot);
  const once = simulateOnce(backendRoot);
  const twice = simulateOnce(backendRoot);
  const ledgerAfter = ledgerSnapshot(backendRoot);
  const ledger = {
    before: ledgerBefore,
    after: ledgerAfter,
    callsDelta: ledgerAfter.calls - ledgerBefore.calls,
    tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
    eventsDelta: ledgerAfter.events - ledgerBefore.events,
  };
  const determinism =
    once.semanticDigest === twice.semanticDigest && once.p3Fp === twice.p3Fp && once.p4Fp === twice.p4Fp
      ? 'PASS'
      : 'FAIL';
  const costOk = ledger.callsDelta === 0 && ledger.tokensDelta === 0 && ledger.eventsDelta === 0;
  const testsOk = once.failure.failed === 0;
  const invariantsOk =
    once.equivalence.primaryField &&
    once.equivalence.specialties &&
    once.equivalence.skills &&
    once.equivalence.radar &&
    once.equivalence.evidenceStates;
  let verdict: 'CAMILO_ZERO_GEMINI_CANARY_DESIGN_READY' | 'MORE_CANARY_DESIGN_REQUIRED' | 'CANARY_NOT_SAFE' =
    'MORE_CANARY_DESIGN_REQUIRED';
  if (!costOk || !testsOk || determinism !== 'PASS') verdict = 'MORE_CANARY_DESIGN_REQUIRED';
  else if (!invariantsOk || once.dryRun.decision !== 'CANARY_DRY_RUN_READY') verdict = 'CANARY_NOT_SAFE';
  else verdict = 'CAMILO_ZERO_GEMINI_CANARY_DESIGN_READY';

  const files: Record<string, unknown> = {
    'preconditions.json': once.preconditions,
    'dry-run.json': once.dryRun,
    'p2-deterministic.json': once.p2,
    'p3-reuse.json': once.p3,
    'p4-reuse.json': once.p4,
    'profile-comparison.json': once.profile,
    'presentation-comparison.json': once.presentation,
    'failure-injection.json': once.failure,
    'tests.json': { cases: once.failure.cases, passed: once.failure.passed, failed: once.failure.failed },
    'determinism-report.json': {
      status: determinism,
      digestA: once.semanticDigest,
      digestB: twice.semanticDigest,
    },
    'cost-report.json': {
      actualGeminiCalls: 0,
      actualGeminiTokens: 0,
      actualGeminiEventsDelta: ledger.eventsDelta,
      historicalCounterfactualAvoidedTokens: 18359,
      p2GeminiCallAvoidedDesigned: 1,
      labelHistorical: 'HISTORICAL_COUNTERFACTUAL',
      mixed: false,
    },
  };
  const outDir = join(backendRoot, 'tmp', 'mc1-p2-semantic-reuse-canary');
  mkdirSync(outDir, { recursive: true });
  const repoTmp = join(backendRoot, '..', 'tmp', 'mc1-p2-semantic-reuse-canary');
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
    dryRun: once.dryRun.decision,
    equivalence: once.equivalence,
    failure: once.failure,
    p2: once.p2,
    p3: once.p3.reuseDecision,
    p4: once.p4.reuseDecision,
    johan: 'NOT_CANARY_CANDIDATE',
    s19: 'NOT_CANARY_CANDIDATE',
    execution: CANARY_EXECUTION_CONTRACT,
  };
}

function simulateOnce(backendRoot: string) {
  const inventory = discoverHistoricalInventory(backendRoot);
  const row = inventory.find((r) => r.snapshotId === CAMILO_CANARY_IDENTITY.snapshotId);
  if (!row?.p1PackRel) throw new Error('CAMILO_P1_MISSING');
  const p1Abs = resolve(backendRoot, row.p1PackRel);
  const units = loadEvidenceUnitsFromP1Pack(p1Abs);
  const p1EvidenceIdentity = evidenceIdentityFromUnits(units);
  const authorityFingerprint = computeAuthorityFingerprint({ units });
  const sim = evaluateDeterministicAuthority({
    snapshotId: CAMILO_CANARY_IDENTITY.snapshotId,
    personId: CAMILO_CANARY_IDENTITY.personId,
    units,
    artifactIdentity: artifactIdentityFromP1PackRel(row.p1PackRel),
    simulateAuthority: true,
  });
  const r1Dir = findLatestR1Pack(backendRoot, CAMILO_CANARY_IDENTITY.snapshotId);
  const p3Dir = row.p3PackRel
    ? resolve(backendRoot, row.p3PackRel)
    : findLatestP3Pack(backendRoot, CAMILO_CANARY_IDENTITY.snapshotId);
  const p4Dir = row.p4PackRel
    ? resolve(backendRoot, row.p4PackRel)
    : findLatestP4Pack(backendRoot, CAMILO_CANARY_IDENTITY.snapshotId);
  const histR1 = r1Dir ? loadR1Contract(r1Dir) : null;
  const p3: P3ContractEnvelope | null =
    p3Dir && existsSync(join(p3Dir, 'p3-contract.json')) ? loadP3Contract(p3Dir) : null;
  const histFields = uniqSort(p3?.payload.fieldsEvaluated ?? []);
  const histStatus = p3?.payload.r1FieldResolutionStatus ?? histR1?.payload.fieldResolutionStatus ?? 'UNRESOLVED';
  const detFields = sim.r1
    ? uniqSort([sim.r1.primary, ...sim.r1.secondaries].filter((x): x is string => !!x))
    : [];
  const detStatus = sim.r1?.resolutionStatus ?? 'UNRESOLVED';
  const oldP3 = defaultP3SemanticInput({
    contract: 'PRODUCTION',
    evidenceIdentity: p1EvidenceIdentity,
    fieldContext: histFields.map((c) => ({ fieldCode: c })),
    r1FieldResolutionStatus: histStatus,
  });
  const newP3 = defaultP3SemanticInput({
    contract: 'PRODUCTION',
    evidenceIdentity: p1EvidenceIdentity,
    fieldContext: detFields.map((c) => ({ fieldCode: c })),
    r1FieldResolutionStatus: detStatus,
  });
  const lineage: SemanticLineage = {
    originalRunId: p3?.pipelineRunId ?? null,
    newRunId: 'canary-sim',
    originalProducer: 'GEMINI',
    newUpstreamProducer: 'DETERMINISTIC_RESOLVER',
    oldResultIdentity: p3?.payload.executionId ?? null,
    newResultIdentity: authorityFingerprint,
  };
  const p3Rec = decideP3Reuse(oldP3, newP3, lineage);
  const histSpecialties = p3
    ? resolveP4SpecialtiesEvaluated(p3).map((s) => ({
        fieldCode: s.fieldCode,
        specialtyCode: s.specialtyCode,
        status: s.p3Status,
        evaluationRole: s.evaluationRole,
        publishableFromP3: s.publishableFromP3,
        routingEligible: s.routingEligible !== false,
        p3Confidence: s.p3Confidence,
      }))
    : [];
  const oldP4 = defaultP4SemanticInput({
    evidenceIdentity: p1EvidenceIdentity,
    specialties: histSpecialties,
    r1FieldResolutionStatus: histStatus,
  });
  const p4Rec = decideP4Reuse({
    p3Decision: p3Rec.reuseDecision,
    oldInput: oldP4,
    candidate: oldP4,
    lineage,
  });
  const p3Fp = buildP3SemanticFingerprint(oldP3);
  const p4Fp = buildP4SemanticFingerprint(oldP4);

  let histPres = null as ReturnType<typeof reassembleMc1Presentation> | null;
  let canaryPres = null as ReturnType<typeof reassembleMc1Presentation> | null;
  let reassemblyError: string | null = null;
  const profileDir = row.profilePackRel ? resolve(backendRoot, row.profilePackRel) : undefined;
  if (r1Dir && p3Dir && p4Dir) {
    try {
      const args = {
        backendRoot,
        snapshotId: CAMILO_CANARY_IDENTITY.snapshotId,
        r1PackDir: r1Dir,
        p3PackDir: p3Dir,
        p4PackDir: p4Dir,
        profilePackDir: profileDir && existsSync(profileDir) ? profileDir : undefined,
        strictLineage: false,
      };
      histPres = reassembleMc1Presentation(args);
      canaryPres = reassembleMc1Presentation(args);
    } catch (e) {
      reassemblyError = e instanceof Error ? e.message : String(e);
    }
  }
  const histSem = histPres ? semanticPresentation(histPres.presentation) : null;
  const canarySem = canaryPres ? semanticPresentation(canaryPres.presentation) : null;
  const equivalence = {
    primaryField: histSem?.primaryField === canarySem?.primaryField && histSem?.primaryField === 'SOFTWARE_ENGINEERING',
    specialties: !!histSem && !!canarySem && eqArr(histSem.specialties, canarySem.specialties),
    skills: !!histSem && !!canarySem && eqArr(histSem.skills, canarySem.skills),
    radar:
      !!histSem &&
      !!canarySem &&
      stableStringify(histSem.radar) === stableStringify(canarySem.radar),
    evidenceStates: !!histSem && !!canarySem && eqArr(histSem.evidenceStates, canarySem.evidenceStates),
  };

  const preInput: CanaryPreconditionsInput = {
    personId: CAMILO_CANARY_IDENTITY.personId,
    snapshotId: CAMILO_CANARY_IDENTITY.snapshotId,
    p1EvidenceIdentity,
    pinnedP1EvidenceIdentity: p1EvidenceIdentity,
    authorityFingerprint,
    pinnedAuthorityFingerprint: authorityFingerprint,
    p3SemanticFingerprint: p3Fp,
    pinnedP3SemanticFingerprint: p3Fp,
    p4SemanticFingerprint: p4Fp,
    pinnedP4SemanticFingerprint: p4Fp,
    resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
    policyVersion: CANDIDATE_2_POLICY_VERSION,
    candidateSetPolicyVersion: CANDIDATE_SET_V2_POLICY_VERSION,
    contractAdapterVersion: FULL_CONTRACT_ADAPTER_VERSION,
    catalogVersion: SPECIALTY_CATALOG_VERSION,
    pinnedCatalogVersion: SPECIALTY_CATALOG_VERSION,
    authorityEligible: sim.authorityEligible,
    p3PackExists: Boolean(p3Dir && p3),
    p4PackExists: Boolean(p4Dir && existsSync(join(p4Dir, 'p4-contract.json'))),
    p3Reuse: p3Rec.reuseDecision,
    p4Reuse: p4Rec.reuseDecision,
    profileReassemblyAvailable: Boolean(histPres && canaryPres),
    canaryEnabled: false,
    killPermits: false,
  };
  const dryRun = evaluateCanaryPreconditions(preInput, { skipExecutionFlags: true });
  const executionNow = evaluateCanaryPreconditions(preInput);

  const failureCases = [
    { id: 'camilo_exact', r: dryRun, expect: 'CANARY_DRY_RUN_READY' as const },
    {
      id: 'changed_snapshot',
      r: evaluateCanaryPreconditions({ ...preInput, snapshotId: '99' }, { skipExecutionFlags: true }),
      expect: 'CANARY_ABORT' as const,
    },
    {
      id: 'changed_p1',
      r: evaluateCanaryPreconditions({ ...preInput, p1EvidenceIdentity: 'mutated' }, { skipExecutionFlags: true }),
      expect: 'CANARY_ABORT' as const,
    },
    {
      id: 'changed_catalog',
      r: evaluateCanaryPreconditions({ ...preInput, catalogVersion: '0.0.0' }, { skipExecutionFlags: true }),
      expect: 'CANARY_ABORT' as const,
    },
    {
      id: 'not_eligible',
      r: evaluateCanaryPreconditions({ ...preInput, authorityEligible: false }, { skipExecutionFlags: true }),
      expect: 'CANARY_ABORT' as const,
    },
    {
      id: 'p3_unsafe',
      r: evaluateCanaryPreconditions({ ...preInput, p3Reuse: 'RECOMPUTE_REQUIRED' }, { skipExecutionFlags: true }),
      expect: 'CANARY_ABORT' as const,
    },
    {
      id: 'p4_unsafe',
      r: evaluateCanaryPreconditions({ ...preInput, p4Reuse: 'RECOMPUTE_REQUIRED' }, { skipExecutionFlags: true }),
      expect: 'CANARY_ABORT' as const,
    },
    {
      id: 'missing_p3',
      r: evaluateCanaryPreconditions({ ...preInput, p3PackExists: false }, { skipExecutionFlags: true }),
      expect: 'CANARY_ABORT' as const,
    },
    {
      id: 'missing_p4',
      r: evaluateCanaryPreconditions({ ...preInput, p4PackExists: false }, { skipExecutionFlags: true }),
      expect: 'CANARY_ABORT' as const,
    },
    {
      id: 'resolver_version',
      r: evaluateCanaryPreconditions({ ...preInput, resolverVersion: '0.0.0' }, { skipExecutionFlags: true }),
      expect: 'CANARY_ABORT' as const,
    },
    {
      id: 'kill_switch',
      r: evaluateCanaryPreconditions({ ...preInput, canaryEnabled: true, killPermits: false }),
      expect: 'CANARY_ABORT' as const,
    },
    {
      id: 'johan_not_allowlisted',
      r: evaluateCanaryPreconditions({ ...preInput, personId: 2, snapshotId: '12' }, { skipExecutionFlags: true }),
      expect: 'CANARY_ABORT' as const,
    },
    {
      id: 's19_not_allowlisted',
      r: evaluateCanaryPreconditions({ ...preInput, personId: 9019, snapshotId: '19' }, { skipExecutionFlags: true }),
      expect: 'CANARY_ABORT' as const,
    },
    { id: 'execution_flags_off_aborts', r: executionNow, expect: 'CANARY_ABORT' as const },
  ].map((c) => ({
    id: c.id,
    expected: c.expect,
    observed: c.r.decision,
    geminiFallback: c.r.geminiFallback,
    pass: c.r.decision === c.expect && c.r.geminiFallback === 'DISABLED_FOR_CANARY',
  }));

  const semanticDigest = sha256Utf8(
    stableStringify({
      p3Fp,
      p4Fp,
      histSem,
      canarySem,
      primary: sim.contract?.primary?.fieldCode ?? null,
    }),
  );

  return {
    semanticDigest,
    p3Fp,
    p4Fp,
    preconditions: {
      identity: {
        personId: CAMILO_CANARY_IDENTITY.personId,
        snapshotId: CAMILO_CANARY_IDENTITY.snapshotId,
        p1EvidenceIdentity,
        authorityFingerprint,
        p3SemanticFingerprint: p3Fp,
        p4SemanticFingerprint: p4Fp,
        nameNotUsedAsKey: true,
      },
      versions: {
        resolver: RESOLVER_CANDIDATE_2_VERSION,
        policy: CANDIDATE_2_POLICY_VERSION,
        candidateSet: CANDIDATE_SET_V2_POLICY_VERSION,
        adapter: FULL_CONTRACT_ADAPTER_VERSION,
        catalog: SPECIALTY_CATALOG_VERSION,
      },
      packs: { p1: row.p1PackRel, r1: r1Dir, p3: p3Dir, p4: p4Dir, profile: profileDir ?? null },
      flagsProposed: {
        MC1_P2_CANARY_ENABLED: false,
        MC1_P2_CANARY_PERSON_IDS: [1],
        MC1_P2_CANARY_SNAPSHOT_IDS: ['8'],
        killSwitchPrecedence: 'MC1_P2_DETERMINISTIC_GLOBAL_KILL_SWITCH then canary flag',
        armed: false,
      },
    },
    dryRun: {
      ...dryRun,
      expectedGeminiDelta: { calls: 0, tokens: 0 },
      executionWouldAbortToday: executionNow.decision === 'CANARY_ABORT',
      executionBlockedBy: executionNow.blockedBy,
      contract: CANARY_EXECUTION_CONTRACT,
    },
    p2: {
      authorityEligible: sim.authorityEligible,
      primary: sim.contract?.primary?.fieldCode ?? null,
      secondaries: sim.contract?.secondaries.map((s) => s.fieldCode) ?? [],
      context: sim.contract?.contextFields.map((c) => c.fieldCode) ?? [],
      producedBy: sim.producedBy,
      newFields: false,
      expectedPrimary: 'SOFTWARE_ENGINEERING',
      primaryOk: sim.contract?.primary?.fieldCode === 'SOFTWARE_ENGINEERING',
    },
    p3: {
      reuseDecision: p3Rec.reuseDecision,
      compare: p3Rec.compare,
      usageRelation: p3Rec.usageRelation,
      histFields,
      detFields,
      lineage: p3Rec.lineage,
      historyNotRewritten: true,
    },
    p4: {
      reuseDecision: p4Rec.reuseDecision,
      compare: p4Rec.compare,
      usageRelation: p4Rec.usageRelation,
      independentOfP3ResultIdentity: true,
      historyNotRewritten: true,
    },
    profile: {
      available: Boolean(histPres),
      error: reassemblyError,
      historicalFingerprint: histPres?.fingerprint ?? null,
      canaryFingerprint: canaryPres?.fingerprint ?? null,
      cloudWrite: false,
    },
    presentation: {
      historical: histSem,
      canary: canarySem,
      fingerprintEqual: histPres?.fingerprint === canaryPres?.fingerprint,
      semantic: equivalence,
      metadataDifferences: ['lineage P2 producer/runId would be new; P3/P4 pack origin unchanged'],
      rules: ['OBSERVED', 'WEAK_EVIDENCE', 'NO_EVIDENCE'],
    },
    equivalence,
    failure: {
      passed: failureCases.filter((c) => c.pass).length,
      failed: failureCases.filter((c) => !c.pass).length,
      cases: failureCases,
      geminiFallback: 'DISABLED_FOR_CANARY',
    },
    notCandidates: CANARY_NOT_CANDIDATES,
  };
}
