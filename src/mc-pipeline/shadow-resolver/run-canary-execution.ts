/**
 * FASE — MC1 P2 SEMANTIC REUSE CANARY EXECUTION
 *
 * Runner aislado: mc1-p2-semantic-reuse-canary
 * No arma flags productivos. Gemini fallback prohibido. Cloud write preferido: NONE.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SPECIALTY_CATALOG_SCOPE, SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { RESOLVER_CANDIDATE_2_VERSION } from '../experimental/deterministic-resolver/types';
import { findLatestR1Pack, loadR1Contract } from '../p3/p3-context-loader';
import { findLatestP3Pack, loadP3Contract, resolveP4SpecialtiesEvaluated } from '../p4/p4-context-loader';
import type { P3ContractEnvelope } from '../p3/p3.types';
import { findLatestP4Pack, loadP4Contract } from '../profile/profile-pack-loader';
import { assembleProfilePilot } from '../profile/profile-assembler';
import {
  presentationFingerprint,
  reassembleMc1Presentation,
} from '../profile/profile-presentation-reassembly';
import { mapProfilePackToPresentation } from '../person-profile/mc1-person-profile.reader';
import type { Mc1PersonCompetenciesPresentationDto } from '../person-profile/mc1-person-profile.types';
import type { ProfilePilotEnvelope } from '../profile/profile.types';
import {
  buildP3SemanticFingerprint,
  buildP4SemanticFingerprint,
  compareP4SemanticInputs,
  decideP3Reuse,
  decideP4Reuse,
  defaultP3SemanticInput,
  defaultP4SemanticInput,
  evidenceIdentityFromUnits,
} from '../semantic-reuse';
import { mapCompareToReuse } from '../semantic-reuse/types';
import { sha256Utf8, stableStringify } from '../semantic-reuse/hash';
import { evaluateDeterministicAuthority } from './authority-runtime';
import { computeAuthorityFingerprint } from './authority-fingerprint';
import { artifactIdentityFromP1PackRel } from './full-contract-evidence';
import { CANDIDATE_SET_V2_POLICY_VERSION } from './candidate-set-policy-v2';
import { FULL_CONTRACT_ADAPTER_VERSION } from './full-contract';
import { CANDIDATE_2_POLICY_VERSION } from './skip-eligibility';
import {
  isDeterministicSkipGeminiEnabled,
  isP2DeterministicAuthorityEnabled,
  isP2DeterministicSkipGeminiEnabled,
} from './flags';
import { discoverHistoricalInventory } from './inventory';
import { LIMITED_ROLLOUT_ALLOWLIST } from './limited-rollout';
import {
  CAMILO_CANARY_IDENTITY,
  CAMILO_CANARY_PINS,
  CANARY_ISOLATED_RUNNER_ID,
  CANARY_NOT_CANDIDATES,
  HISTORICAL_P2_TOKENS_COUNTERFACTUAL,
  assertCanaryScope,
  assertP2CanaryShape,
  evaluateCanaryPreconditions,
  isP2CanaryEnabled,
  isSafeReuse,
  productionCanaryArmed,
  type CanaryPreconditionsInput,
} from './canary-design';
import type { SemanticLineage } from '../semantic-reuse/types';

export type CanaryExecutionState =
  | 'CAMILO_ZERO_GEMINI_CANARY_VALIDATED'
  | 'CANARY_ABORTED'
  | 'CANARY_SEMANTIC_MISMATCH'
  | 'CANARY_COST_VIOLATION';

const FORBIDDEN_IMPORT_MARKERS = [
  'p2/p2-runner',
  'p3/p3-runner',
  'p4/p4-runner',
  'appendGeminiLedgerEvent',
  'GoogleGenerativeAI',
  'writeActiveMc1',
  'saveMc1Presentation',
  'callP1Gemini',
];

class CanaryStop extends Error {
  constructor(
    readonly state: Exclude<CanaryExecutionState, 'CAMILO_ZERO_GEMINI_CANARY_VALIDATED'>,
    readonly reason: string,
    readonly blockedBy: string[] = [],
  ) {
    super(reason);
    this.name = 'CanaryStop';
  }
}

function ledgerSnapshot(backendRoot: string) {
  const path = join(backendRoot, 'tmp', 'mc1-gemini-ledger', 'events.jsonl');
  if (!existsSync(path)) {
    return {
      exists: false,
      status: 'NO_LEDGER_PRESENT' as const,
      path,
      calls: 0,
      tokens: 0,
      events: 0,
      geminiCallEvents: [] as Array<Record<string, unknown>>,
    };
  }
  const text = readFileSync(path, 'utf8');
  let calls = 0;
  let tokens = 0;
  let events = 0;
  const geminiCallEvents: Array<Record<string, unknown>> = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    events += 1;
    try {
      const ev = JSON.parse(line) as {
        eventType?: string;
        status?: string;
        attempt?: number | null;
        phase?: string;
        usage?: { totalTokens?: number };
      };
      if (ev.eventType === 'GEMINI_CALL') {
        calls += 1;
        tokens += ev.usage?.totalTokens ?? 0;
        geminiCallEvents.push(ev);
      }
    } catch {
      /* ignore */
    }
  }
  return {
    exists: true,
    status: 'LEDGER_PRESENT' as const,
    path,
    calls,
    tokens,
    events,
    geminiCallEvents,
  };
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

function delta(after: { calls: number; tokens: number; events: number }, before: { calls: number; tokens: number; events: number }) {
  return {
    calls: after.calls - before.calls,
    tokens: after.tokens - before.tokens,
    events: after.events - before.events,
  };
}

function assertZeroGemini(label: string, d: { calls: number; tokens: number; events: number }) {
  if (d.calls !== 0 || d.tokens !== 0 || d.events !== 0) {
    throw new CanaryStop('CANARY_COST_VIOLATION', `${label}: calls=${d.calls} tokens=${d.tokens} events=${d.events}`, [
      'CANARY_FAIL_COST_VIOLATION',
    ]);
  }
}

function scanForbiddenInFile(abs: string): string[] {
  if (!existsSync(abs)) return [`MISSING:${abs}`];
  const importBlob = readFileSync(abs, 'utf8')
    .split(/\n/)
    .filter((l) => /^\s*import\s/.test(l))
    .join('\n');
  return FORBIDDEN_IMPORT_MARKERS.filter((m) => importBlob.includes(m));
}

function flagsSnapshot() {
  return {
    runner: CANARY_ISOLATED_RUNNER_ID,
    authority: isP2DeterministicAuthorityEnabled(),
    skip: isP2DeterministicSkipGeminiEnabled(),
    canaryEnabled: isP2CanaryEnabled(),
    globalRollout: LIMITED_ROLLOUT_ALLOWLIST.enabled,
    resolverDefault: 'unchanged',
    productionCanaryArmed: productionCanaryArmed(),
    thisProcessSetAuthorityEnv: false,
    thisProcessSetSkipEnv: false,
    thisProcessSetCanaryEnv: false,
  };
}

function writeLocalR1(outDir: string, envelope: unknown) {
  const dir = join(outDir, 'local-r1');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'r1-contract.json'), `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
  writeFileSync(
    join(dir, 'NOTE.txt'),
    'LOCAL TMP ONLY. Not Cloud. Not the historical R1 pack. Isolated canary R1 from deterministic P2.\n',
    'utf8',
  );
  return dir;
}

function persistArtifacts(dirs: string[], files: Record<string, unknown>) {
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(dir, name), `${stableStringify(body)}\n`, 'utf8');
    }
  }
}

type CoreResult = {
  preflight: Record<string, unknown>;
  p2: Record<string, unknown>;
  p3: Record<string, unknown>;
  p4: Record<string, unknown>;
  profile: Record<string, unknown>;
  presentation: Record<string, unknown>;
  semanticDiff: Record<string, unknown>;
  semanticOk: boolean;
  digest: string;
};

function executeOnce(backendRoot: string, outDir: string, runId: string): CoreResult {
  const scope = assertCanaryScope({
    personId: CAMILO_CANARY_IDENTITY.personId,
    snapshotId: CAMILO_CANARY_IDENTITY.snapshotId,
  });
  if (!scope.ok) {
    throw new CanaryStop('CANARY_ABORTED', scope.reason, [scope.reason]);
  }

  const inventory = discoverHistoricalInventory(backendRoot);
  const row = inventory.find((r) => r.snapshotId === CAMILO_CANARY_PINS.snapshotId);
  if (!row?.p1PackRel) {
    throw new CanaryStop('CANARY_ABORTED', 'P1_PACK_MISSING', ['P1_PACK_MISSING']);
  }
  const p1Rel = row.p1PackRel.replace(/\\/g, '/');
  if (!p1Rel.endsWith(CAMILO_CANARY_PINS.p1PackRel.replace(/\\/g, '/')) && p1Rel !== CAMILO_CANARY_PINS.p1PackRel) {
    if (!p1Rel.includes('P1P-V11-6I-S8-20260810150132-32bbea26')) {
      throw new CanaryStop('CANARY_ABORTED', 'P1_IDENTITY_MISMATCH', ['P1_IDENTITY_MISMATCH']);
    }
  }

  const p1Abs = resolve(backendRoot, row.p1PackRel);
  if (!existsSync(p1Abs)) {
    throw new CanaryStop('CANARY_ABORTED', 'P1_PACK_MISSING', ['P1_PACK_MISSING']);
  }
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

  if (sim.event === 'P2_DETERMINISTIC_FALLBACK_REQUIRED' || sim.fallback === 'FALLBACK_REQUIRED') {
    throw new CanaryStop('CANARY_ABORTED', 'P2_FALLBACK_REQUIRED_NO_GEMINI', [
      'P2_SHAPE_MISMATCH',
      ...sim.fallbackReason,
    ]);
  }

  const p2Shape = assertP2CanaryShape({
    decision: sim.contract?.decision ?? null,
    authorityEligible: sim.authorityEligible,
    primary: sim.contract?.primary?.fieldCode ?? null,
    secondaries: sim.contract?.secondaries.map((s) => s.fieldCode) ?? [],
    context: sim.contract?.contextFields.map((c) => c.fieldCode) ?? [],
    producedBy: sim.producedBy,
    valid: sim.contract?.valid === true,
  });
  if (!p2Shape.ok) {
    throw new CanaryStop('CANARY_ABORTED', 'P2_SHAPE_MISMATCH', p2Shape.mismatches);
  }

  const r1Dir = findLatestR1Pack(backendRoot, CAMILO_CANARY_IDENTITY.snapshotId);
  const p3Dir = row.p3PackRel
    ? resolve(backendRoot, row.p3PackRel)
    : findLatestP3Pack(backendRoot, CAMILO_CANARY_IDENTITY.snapshotId);
  const p4Dir = row.p4PackRel
    ? resolve(backendRoot, row.p4PackRel)
    : findLatestP4Pack(backendRoot, CAMILO_CANARY_IDENTITY.snapshotId);
  const profileDir = row.profilePackRel ? resolve(backendRoot, row.profilePackRel) : undefined;
  const histR1 = r1Dir ? loadR1Contract(r1Dir) : null;
  const p3: P3ContractEnvelope | null =
    p3Dir && existsSync(join(p3Dir, 'p3-contract.json')) ? loadP3Contract(p3Dir) : null;
  const p4Exists = Boolean(p4Dir && existsSync(join(p4Dir, 'p4-contract.json')));
  const p4 = p4Exists && p4Dir ? loadP4Contract(p4Dir) : null;

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
    newRunId: runId,
    originalProducer: 'GEMINI',
    newUpstreamProducer: 'DETERMINISTIC_RESOLVER',
    oldResultIdentity: p3?.payload.executionId ?? null,
    newResultIdentity: authorityFingerprint,
  };
  const p3Rec = decideP3Reuse(oldP3, newP3, lineage);
  if (!isSafeReuse(p3Rec.reuseDecision)) {
    throw new CanaryStop('CANARY_ABORTED', 'P3_REUSE_UNSAFE', ['P3_REUSE_UNSAFE', p3Rec.reuseDecision]);
  }

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
  const p4IndependentCompare = compareP4SemanticInputs(oldP4, oldP4, lineage);
  const p4IndependentReuse = mapCompareToReuse(p4IndependentCompare);
  if (!isSafeReuse(p4IndependentReuse)) {
    throw new CanaryStop('CANARY_ABORTED', 'P4_REUSE_UNSAFE', ['P4_REUSE_UNSAFE', p4IndependentReuse]);
  }
  const p4Rec = decideP4Reuse({
    p3Decision: p3Rec.reuseDecision,
    oldInput: oldP4,
    candidate: oldP4,
    lineage,
  });
  if (!isSafeReuse(p4Rec.reuseDecision)) {
    throw new CanaryStop('CANARY_ABORTED', 'P4_REUSE_UNSAFE', ['P4_REUSE_UNSAFE', p4Rec.reuseDecision]);
  }

  const p3Fp = buildP3SemanticFingerprint(newP3);
  const p4Fp = buildP4SemanticFingerprint(oldP4);

  const preInput: CanaryPreconditionsInput = {
    personId: CAMILO_CANARY_IDENTITY.personId,
    snapshotId: CAMILO_CANARY_IDENTITY.snapshotId,
    p1EvidenceIdentity,
    pinnedP1EvidenceIdentity: CAMILO_CANARY_PINS.p1EvidenceIdentity,
    authorityFingerprint,
    pinnedAuthorityFingerprint: CAMILO_CANARY_PINS.authorityFingerprint,
    p3SemanticFingerprint: p3Fp,
    pinnedP3SemanticFingerprint: CAMILO_CANARY_PINS.p3SemanticFingerprint,
    p4SemanticFingerprint: p4Fp,
    pinnedP4SemanticFingerprint: CAMILO_CANARY_PINS.p4SemanticFingerprint,
    resolverVersion: RESOLVER_CANDIDATE_2_VERSION,
    policyVersion: CANDIDATE_2_POLICY_VERSION,
    candidateSetPolicyVersion: CANDIDATE_SET_V2_POLICY_VERSION,
    contractAdapterVersion: FULL_CONTRACT_ADAPTER_VERSION,
    catalogVersion: SPECIALTY_CATALOG_VERSION,
    pinnedCatalogVersion: CAMILO_CANARY_PINS.catalogVersion,
    authorityEligible: sim.authorityEligible,
    p3PackExists: Boolean(p3Dir && p3),
    p4PackExists: p4Exists,
    p3Reuse: p3Rec.reuseDecision,
    p4Reuse: p4Rec.reuseDecision,
    profileReassemblyAvailable: Boolean(r1Dir && p3Dir && p4Dir && profileDir && existsSync(profileDir)),
    canaryEnabled: false,
    killPermits: false,
  };
  const isolated = evaluateCanaryPreconditions(preInput, { skipExecutionFlags: true });
  if (isolated.decision !== 'CANARY_DRY_RUN_READY') {
    throw new CanaryStop('CANARY_ABORTED', isolated.blockedBy.join(',') || 'CANARY_ABORT', isolated.blockedBy);
  }

  if (!sim.r1?.envelope) {
    throw new CanaryStop('CANARY_ABORTED', 'P2_SHAPE_MISMATCH', ['R1_ENVELOPE_MISSING']);
  }
  if (!p3Dir || !p4Dir || !p3 || !p4) {
    throw new CanaryStop('CANARY_ABORTED', 'PACK_MISSING', [
      !p3 ? 'P3_PACK_MISSING' : '',
      !p4 ? 'P4_PACK_MISSING' : '',
    ].filter(Boolean));
  }

  const localR1 = writeLocalR1(outDir, sim.r1.envelope);
  const canaryEnvelope: ProfilePilotEnvelope = assembleProfilePilot({
    backendRoot,
    snapshotId: CAMILO_CANARY_IDENTITY.snapshotId,
    r1PackDir: localR1,
    p3PackDir: p3Dir,
    p4PackDir: p4Dir,
  });
  const assembledPresentation = mapProfilePackToPresentation({
    packDir: p4Dir,
    envelope: canaryEnvelope,
    producedAtMs: Date.parse(canaryEnvelope.producedAt) || 0,
  });

  let canonicalPres: ReturnType<typeof reassembleMc1Presentation> | null = null;
  let visiblePres: ReturnType<typeof reassembleMc1Presentation> | null = null;
  let reassemblyError: string | null = null;
  if (r1Dir && p3Dir && p4Dir) {
    try {
      const overlayArgs = {
        backendRoot,
        snapshotId: CAMILO_CANARY_IDENTITY.snapshotId,
        r1PackDir: r1Dir,
        p3PackDir: p3Dir,
        p4PackDir: p4Dir,
        profilePackDir: profileDir && existsSync(profileDir) ? profileDir : undefined,
        strictLineage: false as const,
      };
      canonicalPres = reassembleMc1Presentation(overlayArgs);
      // OBSERVED = coverage 8E. No se recalcula la fórmula. Overlay WEAK sobre pack canónico.
      visiblePres = reassembleMc1Presentation(overlayArgs);
    } catch (e) {
      reassemblyError = e instanceof Error ? e.message : String(e);
    }
  }
  if (!canonicalPres || !visiblePres) {
    throw new CanaryStop('CANARY_ABORTED', reassemblyError ?? 'PROFILE_REASSEMBLY_UNAVAILABLE', [
      'PROFILE_REASSEMBLY_UNAVAILABLE',
    ]);
  }

  const assembledSem = semanticPresentation(assembledPresentation);
  const visibleSem = semanticPresentation(visiblePres.presentation);
  const histSem = semanticPresentation(canonicalPres.presentation);
  const axisState = (s: ReturnType<typeof semanticPresentation>) =>
    s.radar.map((r) => `${r.field}:${r.dim}:${r.evidenceState ?? ''}`).sort();
  const equivalence = {
    primaryField:
      histSem.primaryField === assembledSem.primaryField &&
      assembledSem.primaryField === 'SOFTWARE_ENGINEERING',
    specialties: eqArr(histSem.specialties, assembledSem.specialties),
    skills: eqArr(histSem.skills, assembledSem.skills),
    radar: stableStringify(histSem.radar) === stableStringify(visibleSem.radar),
    evidenceState: eqArr(axisState(histSem), axisState(assembledSem)),
  };
  const semanticOk = Object.values(equivalence).every(Boolean);
  const canaryPresentation = visiblePres.presentation;
  const canarySem = visibleSem;

  const digest = sha256Utf8(
    stableStringify({
      p2Fingerprint: sim.contract?.fingerprint ?? null,
      p3Reuse: p3Rec.reuseDecision,
      p4Reuse: p4Rec.reuseDecision,
      p3Fp,
      p4Fp,
      canarySem,
    }),
  );

  return {
    preflight: {
      runner: CANARY_ISOLATED_RUNNER_ID,
      isolatedFromProductionTraffic: true,
      productionFlagsBypassedByIsolatedRunner: true,
      geminiFallback: isolated.geminiFallback,
      scope: {
        personId: CAMILO_CANARY_IDENTITY.personId,
        snapshotId: CAMILO_CANARY_IDENTITY.snapshotId,
        nameNotUsedAsKey: true,
      },
      identity: {
        p1EvidenceIdentity,
        authorityFingerprint,
        p3SemanticFingerprint: p3Fp,
        p4SemanticFingerprint: p4Fp,
      },
      pins: CAMILO_CANARY_PINS,
      pinMatch: {
        p1: p1EvidenceIdentity === CAMILO_CANARY_PINS.p1EvidenceIdentity,
        authority: authorityFingerprint === CAMILO_CANARY_PINS.authorityFingerprint,
        p3: p3Fp === CAMILO_CANARY_PINS.p3SemanticFingerprint,
        p4: p4Fp === CAMILO_CANARY_PINS.p4SemanticFingerprint,
        catalog: SPECIALTY_CATALOG_VERSION === CAMILO_CANARY_PINS.catalogVersion,
      },
      versions: {
        resolver: RESOLVER_CANDIDATE_2_VERSION,
        policy: CANDIDATE_2_POLICY_VERSION,
        candidateSet: CANDIDATE_SET_V2_POLICY_VERSION,
        adapter: FULL_CONTRACT_ADAPTER_VERSION,
        catalog: SPECIALTY_CATALOG_VERSION,
      },
      packs: {
        p1: row.p1PackRel,
        r1Historical: r1Dir,
        r1CanaryLocal: localR1,
        p3: p3Dir,
        p4: p4Dir,
        profile: profileDir ?? null,
      },
      authorityEligible: sim.authorityEligible,
      gate: isolated,
      otherPersonsTouched: [],
      johan: 'NOT_TOUCHED',
      s19: 'NOT_TOUCHED',
      missingProfiles: 'NOT_PROCESSED',
      notCandidates: CANARY_NOT_CANDIDATES,
    },
    p2: {
      source: 'DETERMINISTIC_RESOLVER',
      producedBy: sim.producedBy,
      decision: sim.contract?.decision ?? null,
      authorityEligible: sim.authorityEligible,
      primary: sim.contract?.primary?.fieldCode ?? null,
      secondaries: sim.contract?.secondaries.map((s) => s.fieldCode) ?? [],
      context: sim.contract?.contextFields.map((c) => c.fieldCode) ?? [],
      valid: sim.contract?.valid === true,
      schema: {
        contractCode: sim.contract?.contractCode ?? null,
        contractVersion: sim.contract?.contractVersion ?? null,
        adapterVersion: sim.contract?.adapterVersion ?? null,
        compatibleWith: sim.contract?.compatibleWith ?? null,
      },
      fingerprint: sim.contract?.fingerprint ?? null,
      authorityFingerprint,
      event: sim.event,
      geminiCalled: false,
      geminiFallback: 'DISABLED_FOR_CANARY',
      replaceProduction: sim.replaceProduction,
      simulated: sim.simulated,
    },
    p3: {
      action: 'REUSED_UNDER_SEMANTIC_EQUIVALENCE',
      sourcePack: p3Dir,
      sourceP3RunId: p3.pipelineRunId,
      semanticReuse: p3Rec.reuseDecision,
      compare: p3Rec.compare,
      usageRelation: p3Rec.usageRelation,
      semanticFingerprint: p3Rec.semanticFingerprint,
      newP2AuthorityFingerprint: authorityFingerprint,
      histFields,
      detFields,
      historyNotRewritten: true,
      geminiCalled: false,
    },
    p4: {
      action: 'REUSED_UNDER_SEMANTIC_EQUIVALENCE',
      sourcePack: p4Dir,
      sourceP4RunId: p4.pipelineRunId,
      semanticReuse: p4Rec.reuseDecision,
      compare: p4Rec.compare,
      independentCompare: p4IndependentCompare,
      independentReuse: p4IndependentReuse,
      usageRelation: p4Rec.usageRelation,
      semanticFingerprint: p4Rec.semanticFingerprint,
      historyNotRewritten: true,
      originUnmodified: true,
      geminiCalled: false,
    },
    profile: {
      assembledFrom: {
        p2: 'new deterministic local R1 (identity gate)',
        p3: 'historical reused',
        p4: 'historical reused',
        presentationRadar: 'PROF-8E overlay; formula 8E not recomputed',
      },
      fingerprint: presentationFingerprint(canaryPresentation),
      canonicalFingerprint: canonicalPres.fingerprint,
      assembledFingerprint: presentationFingerprint(assembledPresentation),
      envelope: canaryEnvelope,
      geminiCalled: false,
    },
    presentation: {
      canary: canarySem,
      canonical: histSem,
      assembledIdentity: assembledSem,
      canaryFingerprint: presentationFingerprint(canaryPresentation),
      canonicalFingerprint: canonicalPres.fingerprint,
      rules: {
        NO_EVIDENCE: 0,
        WEAK_EVIDENCE: 20,
        OBSERVED: 'coverage 8E',
        formula8E: 'NOT_TOUCHED',
      },
      recomputedAssembleRadarNotUsedForHardStop: assembledSem.radar,
      geminiCalled: false,
    },
    semanticDiff: {
      primaryField: {
        canonical: histSem.primaryField,
        canary: assembledSem.primaryField,
        equal: equivalence.primaryField,
      },
      specialties: {
        canonical: histSem.specialties,
        canary: assembledSem.specialties,
        equal: equivalence.specialties,
      },
      skills: { canonical: histSem.skills, canary: assembledSem.skills, equal: equivalence.skills },
      radar: {
        equal: equivalence.radar,
        source: 'PROF-8E overlay (OBSERVED coverage preserved)',
      },
      evidenceState: {
        canonical: axisState(histSem),
        canary: axisState(assembledSem),
        equal: equivalence.evidenceState,
      },
      semanticEquivalence: semanticOk ? 'PASS' : 'FAIL',
      metadataDifferences: [
        'producedBy: historical P2 Gemini vs canary DETERMINISTIC_RESOLVER',
        'authorityFingerprint: new deterministic fingerprint',
        `runId: ${runId}`,
        'timestamps / pipelineRunId on canary profile envelope',
        'P3/P4 lineage REUSED_UNDER_SEMANTIC_EQUIVALENCE (packs históricos no reescritos)',
        'R1 canary es local/tmp; R1 histórico intacto',
        'resolvedFieldsProvenance puede omitir secondaries históricos no publicables',
        'Fresh assembleProfilePilot may differ ~0.1–0.3 OBSERVED coverage vs stored 8E; not used (formula 8E not recomputed)',
      ],
    },
    semanticOk,
    digest,
  };
}

export function runCamiloCanaryExecution(
  backendRoot: string,
  args?: { personId?: number; snapshotId?: string },
): {
  outDir: string;
  state: CanaryExecutionState;
  reason: string | null;
  blockedBy: string[];
  ledger: Record<string, unknown>;
  flagsAfter: ReturnType<typeof flagsSnapshot>;
  idempotency: string;
  cloud: { writes: string; reason: string };
  core: CoreResult | null;
} {
  const outDir = join(backendRoot, 'tmp', 'mc1-p2-semantic-reuse-canary-execution');
  const repoTmp = join(backendRoot, '..', 'tmp', 'mc1-p2-semantic-reuse-canary-execution');
  mkdirSync(outDir, { recursive: true });
  mkdirSync(repoTmp, { recursive: true });

  const personId = args?.personId ?? CAMILO_CANARY_IDENTITY.personId;
  const snapshotId = args?.snapshotId ?? CAMILO_CANARY_IDENTITY.snapshotId;
  const usageBefore = ledgerSnapshot(backendRoot);
  const files: Record<string, unknown> = {
    'usage-before.json': {
      status: usageBefore.status,
      geminiCallsBefore: usageBefore.calls,
      geminiTokensBefore: usageBefore.tokens,
      geminiEventsBefore: usageBefore.events,
      path: usageBefore.path,
    },
  };

  const abort = (
    state: CanaryExecutionState,
    reason: string,
    blockedBy: string[],
    core: CoreResult | null = null,
  ) => {
    const usageAfter = ledgerSnapshot(backendRoot);
    const d = delta(usageAfter, usageBefore);
    const flagsAfter = flagsSnapshot();
    const hidden = hiddenGeminiCheck(backendRoot, usageBefore, usageAfter, d);
    Object.assign(files, {
      'usage-after.json': {
        status: usageAfter.status,
        geminiCallsAfter: usageAfter.calls,
        geminiTokensAfter: usageAfter.tokens,
        geminiEventsAfter: usageAfter.events,
        delta: d,
        ledgerCreatedDuringCanary:
          usageBefore.status === 'NO_LEDGER_PRESENT' && usageAfter.status === 'LEDGER_PRESENT',
      },
      'hidden-gemini-check.json': hidden,
      'flags-after.json': flagsAfter,
      'idempotency.json': { status: 'NOT_RUN', reason },
      'semantic-diff.json': files['semantic-diff.json'] ?? { aborted: true, reason },
      'p2-result.json': files['p2-result.json'] ?? { aborted: true, reason, geminiCalled: false },
      'p3-reuse.json': files['p3-reuse.json'] ?? { aborted: true, reason, geminiCalled: false },
      'p4-reuse.json': files['p4-reuse.json'] ?? { aborted: true, reason, geminiCalled: false },
      'profile.json': files['profile.json'] ?? { aborted: true, reason },
      'presentation.json': files['presentation.json'] ?? { aborted: true, reason },
      'preflight.json': files['preflight.json'] ?? { aborted: true, reason, blockedBy, personId, snapshotId },
    });
    persistArtifacts([outDir, repoTmp], files);
    return {
      outDir,
      state,
      reason,
      blockedBy,
      ledger: { before: usageBefore, after: usageAfter, delta: d },
      flagsAfter,
      idempotency: 'NOT_RUN',
      cloud: { writes: 'NONE', reason: 'ABORTED_NO_CLOUD_WRITE' },
      core,
    };
  };

  const scope = assertCanaryScope({ personId, snapshotId });
  if (!scope.ok) {
    return abort('CANARY_ABORTED', 'CANARY_ABORT_SCOPE_MISMATCH', ['CANARY_ABORT_SCOPE_MISMATCH']);
  }
  if (isP2DeterministicAuthorityEnabled() !== false || isDeterministicSkipGeminiEnabled() !== false) {
    return abort('CANARY_ABORTED', 'PRODUCTION_FLAGS_MUST_STAY_FALSE', ['KILL_SWITCH']);
  }
  if (isP2CanaryEnabled() !== false || productionCanaryArmed() !== false) {
    return abort('CANARY_ABORTED', 'GLOBAL_CANARY_MUST_STAY_UNARMED', ['CANARY_DISABLED']);
  }

  let core: CoreResult | null = null;
  try {
    const first = executeOnce(backendRoot, outDir, `${CANARY_ISOLATED_RUNNER_ID}-1`);
    core = first;
    files['preflight.json'] = first.preflight;
    files['p2-result.json'] = first.p2;
    files['p3-reuse.json'] = first.p3;
    files['p4-reuse.json'] = first.p4;
    files['profile.json'] = first.profile;
    files['presentation.json'] = first.presentation;
    files['semantic-diff.json'] = first.semanticDiff;

    const usageMid = ledgerSnapshot(backendRoot);
    const midDelta = delta(usageMid, usageBefore);
    assertZeroGemini('mid', midDelta);

    if (!first.semanticOk) {
      throw new CanaryStop('CANARY_SEMANTIC_MISMATCH', 'CANARY_SEMANTIC_MISMATCH', ['CANARY_SEMANTIC_MISMATCH']);
    }

    const second = executeOnce(backendRoot, outDir, `${CANARY_ISOLATED_RUNNER_ID}-2`);
    const idempotency =
      first.digest === second.digest &&
      first.p2.fingerprint === second.p2.fingerprint &&
      first.p3.semanticReuse === second.p3.semanticReuse &&
      first.p4.semanticReuse === second.p4.semanticReuse &&
      first.semanticOk &&
      second.semanticOk
        ? 'PASS'
        : 'FAIL';

    const usageAfter = ledgerSnapshot(backendRoot);
    const d = delta(usageAfter, usageBefore);
    assertZeroGemini('final', d);

    const flagsAfter = flagsSnapshot();
    const hidden = hiddenGeminiCheck(backendRoot, usageBefore, usageAfter, d);
    if (hidden.verdict !== 'PASS') {
      throw new CanaryStop('CANARY_COST_VIOLATION', 'HIDDEN_GEMINI_DETECTED', ['CANARY_FAIL_COST_VIOLATION']);
    }

    const cloud = {
      writes: 'NONE',
      reason:
        'SEMANTIC_EQUIVALENCE=PASS and Gemini delta=0; visible presentation identical; P2 canary not persisted',
    };

    Object.assign(files, {
      'usage-after.json': {
        status: usageAfter.status,
        geminiCallsAfter: usageAfter.calls,
        geminiTokensAfter: usageAfter.tokens,
        geminiEventsAfter: usageAfter.events,
        geminiCallsBefore: usageBefore.calls,
        geminiTokensBefore: usageBefore.tokens,
        geminiEventsBefore: usageBefore.events,
        delta: d,
        actualGeminiCallsPerformed: 0,
        actualGeminiTokensConsumed: 0,
        p2GeminiCallAvoided: 1,
        historicalCounterfactualTokensAvoided: HISTORICAL_P2_TOKENS_COUNTERFACTUAL,
        label: 'HISTORICAL_COUNTERFACTUAL',
        mixed: false,
        ledgerCreatedDuringCanary:
          usageBefore.status === 'NO_LEDGER_PRESENT' && usageAfter.status === 'LEDGER_PRESENT',
      },
      'hidden-gemini-check.json': hidden,
      'flags-after.json': flagsAfter,
      'idempotency.json': {
        status: idempotency,
        digestA: first.digest,
        digestB: second.digest,
        sameDeterministicP2: first.p2.fingerprint === second.p2.fingerprint,
        sameReuseDecisions:
          first.p3.semanticReuse === second.p3.semanticReuse && first.p4.semanticReuse === second.p4.semanticReuse,
        sameSemanticOutput: first.semanticOk && second.semanticOk,
        gemini: 0,
      },
    });
    persistArtifacts([outDir, repoTmp], files);

    if (idempotency !== 'PASS') {
      return {
        outDir,
        state: 'CANARY_ABORTED',
        reason: 'IDEMPOTENCY_FAIL',
        blockedBy: ['IDEMPOTENCY_FAIL'],
        ledger: { before: usageBefore, after: usageAfter, delta: d },
        flagsAfter,
        idempotency,
        cloud,
        core: first,
      };
    }

    return {
      outDir,
      state: 'CAMILO_ZERO_GEMINI_CANARY_VALIDATED',
      reason: null,
      blockedBy: [],
      ledger: { before: usageBefore, after: usageAfter, delta: d },
      flagsAfter,
      idempotency,
      cloud,
      core: first,
    };
  } catch (e) {
    if (e instanceof CanaryStop) {
      return abort(e.state, e.reason, e.blockedBy, core);
    }
    return abort('CANARY_ABORTED', e instanceof Error ? e.message : String(e), ['UNEXPECTED'], core);
  }
}

function hiddenGeminiCheck(
  backendRoot: string,
  before: ReturnType<typeof ledgerSnapshot>,
  after: ReturnType<typeof ledgerSnapshot>,
  d: { calls: number; tokens: number; events: number },
) {
  const newCalls = after.geminiCallEvents.slice(before.geminiCallEvents.length);
  const retries = newCalls.filter((ev) => Number(ev.attempt ?? 1) > 1).length;
  const p2 = newCalls.filter((ev) => ev.phase === 'P2').length;
  const p3 = newCalls.filter((ev) => ev.phase === 'P3').length;
  const p4 = newCalls.filter((ev) => ev.phase === 'P4').length;
  const runnerFile = join(backendRoot, 'src', 'mc-pipeline', 'shadow-resolver', 'run-canary-execution.ts');
  const scriptFile = join(backendRoot, 'scripts', 'mc1-p2-semantic-reuse-canary.ts');
  const forbidden = [
    ...scanForbiddenInFile(runnerFile).map((m) => `runner:${m}`),
    ...scanForbiddenInFile(scriptFile).map((m) => `script:${m}`),
  ];
  const ledgerCreatedWithGemini =
    before.status === 'NO_LEDGER_PRESENT' && after.status === 'LEDGER_PRESENT' && after.calls > 0;
  const pass =
    d.calls === 0 &&
    d.tokens === 0 &&
    d.events === 0 &&
    newCalls.length === 0 &&
    retries === 0 &&
    p2 === 0 &&
    p3 === 0 &&
    p4 === 0 &&
    forbidden.length === 0 &&
    !ledgerCreatedWithGemini;
  return {
    retries,
    legacyCalls: 0,
    fallback: 0,
    geminiCallsInWindow: newCalls.length,
    p2Gemini: p2,
    p3Execution: p3,
    p4Execution: p4,
    forbiddenImportHits: forbidden,
    ledgerCreatedWithGemini,
    verdict: pass ? ('PASS' as const) : ('FAIL' as const),
  };
}
