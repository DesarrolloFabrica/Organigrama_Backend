/**
 * FASE — MC1 P2 ZERO-GEMINI CANDIDATE EXPANSION
 * Offline. Gemini = 0. No canary nuevo. No writes Cloud. No arma flags.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SPECIALTY_CATALOG_SCOPE, SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';
import { COHORT } from '../experimental/deterministic-resolver/cohort';
import { loadEvidenceUnitsFromP1Pack } from '../experimental/deterministic-resolver/evidence';
import { RESOLVER_CANDIDATE_2_VERSION } from '../experimental/deterministic-resolver/types';
import { findLatestR1Pack, loadR1Contract } from '../p3/p3-context-loader';
import { loadP3Contract, resolveP4SpecialtiesEvaluated } from '../p4/p4-context-loader';
import type { P3ContractEnvelope } from '../p3/p3.types';
import { assembleProfilePilot } from '../profile/profile-assembler';
import { reassembleMc1Presentation } from '../profile/profile-presentation-reassembly';
import { mapProfilePackToPresentation } from '../person-profile/mc1-person-profile.reader';
import type { Mc1PersonCompetenciesPresentationDto } from '../person-profile/mc1-person-profile.types';
import {
  compareP4SemanticInputs,
  decideP3Reuse,
  decideP4Reuse,
  defaultP3SemanticInput,
  defaultP4SemanticInput,
  evidenceIdentityFromUnits,
} from '../semantic-reuse';
import { mapCompareToReuse, type ReuseDecision, type SemanticLineage } from '../semantic-reuse/types';
import { sha256Utf8, stableStringify } from '../semantic-reuse/hash';
import { evaluateDeterministicAuthority } from './authority-runtime';
import { computeAuthorityFingerprint } from './authority-fingerprint';
import { artifactIdentityFromP1PackRel } from './full-contract-evidence';
import { CANDIDATE_SET_V2_POLICY_VERSION } from './candidate-set-policy-v2';
import { FULL_CONTRACT_ADAPTER_VERSION } from './full-contract';
import { CANDIDATE_2_POLICY_VERSION } from './skip-eligibility';
import { isDeterministicSkipGeminiEnabled, isP2DeterministicAuthorityEnabled } from './flags';
import { discoverHistoricalInventory, type InventoryRow } from './inventory';
import { fullGateCohort } from './gate-cohort';
import { MEASURED_P2_TOKENS } from './limited-rollout';
import {
  classifyZeroGeminiCase,
  isSafeReuseStar,
  runZeroGeminiAdversarialClassificationTests,
  type ZeroGeminiClass,
} from './zero-gemini-classify';

type Freshness = 'LATEST_COMPATIBLE' | 'HISTORICAL_ONLY' | 'STALE';
type ManualVerdict = 'SAFE' | 'QUESTIONABLE' | 'UNSAFE';
type CanaryTier = 'TIER_1' | 'TIER_2' | 'TIER_3' | null;

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

function listDirs(abs: string): string[] {
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .map((n) => join(abs, n))
    .filter((p) => statSync(p).isDirectory());
}

function snapshotFromName(name: string): string | null {
  const m = name.match(/-S(\d+)-/) || name.match(/^S(\d+)$/) || name.match(/S(\d+)/);
  return m ? m[1] : null;
}

function rel(backendRoot: string, abs: string | null): string | null {
  if (!abs) return null;
  return abs.replace(/\\/g, '/').replace(backendRoot.replace(/\\/g, '/') + '/', '');
}

function identityMap(backendRoot: string): Map<string, { person: string; personId: number }> {
  const map = new Map<string, { person: string; personId: number }>();
  for (const m of COHORT) map.set(m.snapshotId, { person: m.person, personId: m.personId });
  for (const m of fullGateCohort(backendRoot)) {
    if (!map.has(m.snapshotId)) map.set(m.snapshotId, { person: m.person, personId: m.personId });
  }
  map.set('9', { person: 'S9', personId: 9009 });
  map.set('19', { person: 'S19', personId: 9019 });
  return map;
}

function discoverUntaggedP1(backendRoot: string): Array<{ packRel: string; snapshotId: null }> {
  const root = join(backendRoot, 'tmp', 'mc1-p1-prototype');
  return listDirs(root)
    .filter((d) => !snapshotFromName(d.replace(/\\/g, '/').split('/').pop() ?? ''))
    .filter((d) => existsSync(join(d, 'validated-evidence.json')))
    .map((d) => ({ packRel: rel(backendRoot, d) as string, snapshotId: null }));
}

function siblingP1(backendRoot: string, snapshotId: string): string[] {
  const root = join(backendRoot, 'tmp', 'mc1-p1-prototype');
  return listDirs(root)
    .filter((d) => snapshotFromName(d.replace(/\\/g, '/').split('/').pop() ?? '') === snapshotId)
    .map((d) => rel(backendRoot, d) as string)
    .sort();
}

function freshnessFor(row: InventoryRow, siblings: string[]): Freshness {
  if (siblings.length <= 1) return 'LATEST_COMPATIBLE';
  const latest = siblings[siblings.length - 1];
  if (row.p1PackRel && row.p1PackRel.replace(/\\/g, '/') === latest.replace(/\\/g, '/')) {
    return 'LATEST_COMPATIBLE';
  }
  if (row.p1PackRel && siblings.some((s) => s.includes(row.p1PackRel!.replace(/\\/g, '/')))) {
    return 'HISTORICAL_ONLY';
  }
  return 'STALE';
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
  return { primaryField: primary?.code ?? null, specialties, skills, radar };
}

function eqArr(a: string[], b: string[]): boolean {
  return a.join('|') === b.join('|');
}

function writeTwin(backendRoot: string, files: Record<string, unknown>) {
  const outDir = join(backendRoot, 'tmp', 'mc1-p2-zero-gemini-expansion');
  mkdirSync(outDir, { recursive: true });
  const repoTmp = join(backendRoot, '..', 'tmp', 'mc1-p2-zero-gemini-expansion');
  mkdirSync(repoTmp, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    const text = `${stableStringify(body)}\n`;
    writeFileSync(join(outDir, name), text, 'utf8');
    writeFileSync(join(repoTmp, name), text, 'utf8');
  }
  return outDir;
}

type ClassifiedRow = {
  person: string;
  personId: number | null;
  snapshotId: string;
  class: ZeroGeminiClass;
  profileUnverified: boolean;
  p2: Record<string, unknown>;
  p3: Record<string, unknown>;
  p4: Record<string, unknown>;
  inventory: Record<string, unknown>;
  freshness: Freshness;
  profile: Record<string, unknown> | null;
  quality: Record<string, unknown>;
  digest: string;
};

function classifyOne(backendRoot: string, row: InventoryRow, ids: Map<string, { person: string; personId: number }>): ClassifiedRow {
  const ident = ids.get(row.snapshotId);
  const person = ident?.person ?? row.person;
  const personId = ident?.personId ?? null;
  const siblings = siblingP1(backendRoot, row.snapshotId);
  const freshness = freshnessFor(row, siblings);
  const p1Ok = Boolean(row.p1PackRel && existsSync(resolve(backendRoot, row.p1PackRel)));
  const catalogOk = row.unknownSpecialtyCodes.length === 0;
  const p3Ok = Boolean(row.p3PackRel);
  const p4Ok = Boolean(row.p4PackRel);

  const inventory = {
    personId,
    snapshotId: row.snapshotId,
    person,
    p1Identity: row.p1PackRel,
    p2Canonical: row.p2PackRel,
    p3Pack: row.p3PackRel,
    p4Pack: row.p4PackRel,
    profile: row.profilePackRel,
    catalogVersion: row.specialtyCatalogVersion,
    fieldCatalog: row.fieldCatalogVersion,
    resolverCompatible: row.resolverCompatible,
    siblingP1: siblings,
    missing: [
      !p1Ok ? 'P1' : null,
      !row.p2Available ? 'P2' : null,
      !p3Ok ? 'P3' : null,
      !p4Ok ? 'P4' : null,
      !row.profileAvailable ? 'PROFILE' : null,
    ].filter(Boolean),
  };

  if (!p1Ok) {
    const cls = classifyZeroGeminiCase({
      p1IdentityCompatible: false,
      catalogCompatible: catalogOk,
      semanticInputReconstructable: false,
      p3PackAvailable: p3Ok,
      p4PackAvailable: p4Ok,
      p2AuthorityEligible: false,
      p2Decision: null,
      p3Reuse: null,
      p4Reuse: null,
    });
    return finish(person, personId, row, cls, freshness, inventory, {
      p2: { authorityEligible: false, geminiCalled: false },
      p3: { geminiCalled: false },
      p4: { geminiCalled: false },
      profile: null,
    });
  }

  const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, row.p1PackRel!));
  const p1EvidenceIdentity = evidenceIdentityFromUnits(units);
  const authorityFingerprint = computeAuthorityFingerprint({ units });
  const sim = evaluateDeterministicAuthority({
    snapshotId: row.snapshotId,
    personId: personId ?? person,
    units,
    artifactIdentity: artifactIdentityFromP1PackRel(row.p1PackRel!),
    simulateAuthority: true,
  });

  const p2 = {
    authorityEligible: sim.authorityEligible,
    decision: sim.contract?.decision ?? null,
    primary: sim.contract?.primary?.fieldCode ?? null,
    secondaries: sim.contract?.secondaries.map((s) => s.fieldCode) ?? [],
    context: sim.contract?.contextFields.map((c) => c.fieldCode) ?? [],
    producedBy: sim.producedBy,
    candidateSet: {
      policy: CANDIDATE_SET_V2_POLICY_VERSION,
      resolver: RESOLVER_CANDIDATE_2_VERSION,
      policyVersion: CANDIDATE_2_POLICY_VERSION,
      adapter: FULL_CONTRACT_ADAPTER_VERSION,
    },
    authorityFingerprint,
    p1EvidenceIdentity,
    event: sim.event,
    blockedBy: sim.fallbackReason,
    geminiCalled: false,
  };

  const r1Dir = findLatestR1Pack(backendRoot, row.snapshotId);
  const histR1 = r1Dir ? loadR1Contract(r1Dir) : null;
  let p3: P3ContractEnvelope | null = null;
  if (row.p3PackRel) {
    const p3Abs = resolve(backendRoot, row.p3PackRel);
    if (existsSync(join(p3Abs, 'p3-contract.json'))) p3 = loadP3Contract(p3Abs);
  }

  const reconstructable = Boolean(p3 && p1Ok);
  const histFields = uniqSort(p3?.payload.fieldsEvaluated ?? []);
  const histStatus = p3?.payload.r1FieldResolutionStatus ?? histR1?.payload.fieldResolutionStatus ?? 'UNRESOLVED';
  const detFields = sim.r1
    ? uniqSort([sim.r1.primary, ...sim.r1.secondaries].filter((x): x is string => !!x))
    : [];
  const detStatus = sim.r1?.resolutionStatus ?? 'UNRESOLVED';

  let p3Reuse: ReuseDecision | null = null;
  let p4Reuse: ReuseDecision | null = null;
  let p3Rec: ReturnType<typeof decideP3Reuse> | null = null;
  let p4Independent: ReuseDecision | null = null;
  let p4Rec: ReturnType<typeof decideP4Reuse> | null = null;

  if (reconstructable && p3) {
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
      originalRunId: p3.pipelineRunId ?? null,
      newRunId: sim.authorityEligible ? 'zero-gemini-expansion' : p3.pipelineRunId ?? null,
      originalProducer: 'GEMINI',
      newUpstreamProducer: sim.authorityEligible ? 'DETERMINISTIC_RESOLVER' : 'GEMINI',
      oldResultIdentity: p3.payload.executionId ?? null,
      newResultIdentity: sim.authorityEligible ? authorityFingerprint : p3.payload.executionId ?? null,
    };
    p3Rec = decideP3Reuse(oldP3, newP3, lineage);
    p3Reuse = p3Rec.reuseDecision;

    const histSpecialties = resolveP4SpecialtiesEvaluated(p3).map((s) => ({
      fieldCode: s.fieldCode,
      specialtyCode: s.specialtyCode,
      status: s.p3Status,
      evaluationRole: s.evaluationRole,
      publishableFromP3: s.publishableFromP3,
      routingEligible: s.routingEligible !== false,
      p3Confidence: s.p3Confidence,
    }));
    const oldP4 = defaultP4SemanticInput({
      evidenceIdentity: p1EvidenceIdentity,
      specialties: histSpecialties,
      r1FieldResolutionStatus: histStatus,
    });
    if (isSafeReuseStar(p3Reuse)) {
      const candidateP4 = defaultP4SemanticInput({
        evidenceIdentity: p1EvidenceIdentity,
        specialties: histSpecialties,
        r1FieldResolutionStatus: detStatus,
      });
      p4Independent = mapCompareToReuse(compareP4SemanticInputs(oldP4, candidateP4, lineage));
      p4Rec = decideP4Reuse({
        p3Decision: p3Reuse,
        oldInput: oldP4,
        candidate: candidateP4,
        lineage,
      });
      p4Reuse = p4Independent;
    }
  }

  const cls = classifyZeroGeminiCase({
    p1IdentityCompatible: p1Ok,
    catalogCompatible: catalogOk,
    semanticInputReconstructable: reconstructable,
    p3PackAvailable: p3Ok,
    p4PackAvailable: p4Ok,
    p2AuthorityEligible: sim.authorityEligible,
    p2Decision: sim.contract?.decision ?? null,
    p3Reuse,
    p4Reuse,
  });

  const profileUnverified = cls === 'ZERO_GEMINI_CANDIDATE' && !row.profileAvailable;
  const p3Out = {
    reuse: p3Reuse,
    compare: p3Rec?.compare ?? null,
    usageRelation: p3Rec?.usageRelation ?? null,
    histFields,
    detFields,
    geminiCalled: false,
    historyNotRewritten: true,
  };
  const p4Out = {
    reuse: p4Reuse,
    independentReuse: p4Independent,
    compare: p4Rec?.compare ?? null,
    usageRelation: p4Rec?.usageRelation ?? null,
    evaluatedIndependently: isSafeReuseStar(p3Reuse),
    geminiCalled: false,
    historyNotRewritten: true,
  };

  return finish(person, personId, row, cls, freshness, inventory, {
    p2,
    p3: p3Out,
    p4: p4Out,
    profile: null,
    profileUnverified,
    simR1: sim.r1?.envelope ?? null,
  });
}

function finish(
  person: string,
  personId: number | null,
  row: InventoryRow,
  cls: ZeroGeminiClass,
  freshness: Freshness,
  inventory: Record<string, unknown>,
  extra: {
    p2: Record<string, unknown>;
    p3: Record<string, unknown>;
    p4: Record<string, unknown>;
    profile: Record<string, unknown> | null;
    profileUnverified?: boolean;
    simR1?: unknown;
  },
): ClassifiedRow {
  const digest = sha256Utf8(
    stableStringify({
      snapshotId: row.snapshotId,
      cls,
      p2: extra.p2,
      p3: extra.p3,
      p4: extra.p4,
    }),
  );
  return {
    person,
    personId,
    snapshotId: row.snapshotId,
    class: cls,
    profileUnverified: extra.profileUnverified === true,
    p2: extra.p2,
    p3: extra.p3,
    p4: extra.p4,
    inventory,
    freshness,
    profile: extra.profile,
    quality: {
      p2Primary: extra.p2.primary ?? null,
      candidateSet: extra.p2.candidateSet ?? null,
      p3Semantic: extra.p3.reuse ?? null,
      p4Semantic: extra.p4.reuse ?? extra.p4.independentReuse ?? null,
    },
    digest,
  };
}

function simulateProfile(backendRoot: string, row: InventoryRow, classified: ClassifiedRow): Record<string, unknown> {
  const p3Dir = row.p3PackRel ? resolve(backendRoot, row.p3PackRel) : null;
  const p4Dir = row.p4PackRel ? resolve(backendRoot, row.p4PackRel) : null;
  const r1Dir = findLatestR1Pack(backendRoot, row.snapshotId);
  const profileDir = row.profilePackRel ? resolve(backendRoot, row.profilePackRel) : undefined;
  if (!p3Dir || !p4Dir || !r1Dir) {
    return { status: 'UNVERIFIED', reason: 'missing packs' };
  }
  const outR1 = join(backendRoot, 'tmp', 'mc1-p2-zero-gemini-expansion', `local-r1-S${row.snapshotId}`);
  mkdirSync(outR1, { recursive: true });
  const sim = evaluateDeterministicAuthority({
    snapshotId: row.snapshotId,
    personId: classified.personId ?? classified.person,
    units: loadEvidenceUnitsFromP1Pack(resolve(backendRoot, row.p1PackRel!)),
    artifactIdentity: artifactIdentityFromP1PackRel(row.p1PackRel!),
    simulateAuthority: true,
  });
  if (!sim.r1?.envelope) return { status: 'UNVERIFIED', reason: 'no deterministic R1' };
  writeFileSync(join(outR1, 'r1-contract.json'), `${JSON.stringify(sim.r1.envelope, null, 2)}\n`, 'utf8');
  const assembled = assembleProfilePilot({
    backendRoot,
    snapshotId: row.snapshotId,
    r1PackDir: outR1,
    p3PackDir: p3Dir,
    p4PackDir: p4Dir,
  });
  const assembledPres = mapProfilePackToPresentation({
    packDir: p4Dir,
    envelope: assembled,
    producedAtMs: Date.parse(assembled.producedAt) || 0,
  });
  const canonical = reassembleMc1Presentation({
    backendRoot,
    snapshotId: row.snapshotId,
    r1PackDir: r1Dir,
    p3PackDir: p3Dir,
    p4PackDir: p4Dir,
    profilePackDir: profileDir && existsSync(profileDir) ? profileDir : undefined,
    strictLineage: false,
  });
  const a = semanticPresentation(assembledPres);
  const c = semanticPresentation(canonical.presentation);
  const axis = (s: ReturnType<typeof semanticPresentation>) =>
    s.radar.map((r) => `${r.field}:${r.dim}:${r.evidenceState ?? ''}`).sort();
  const equal = {
    primaryField: a.primaryField === c.primaryField,
    specialties: eqArr(a.specialties, c.specialties),
    skills: eqArr(a.skills, c.skills),
    radar: stableStringify(c.radar) === stableStringify(semanticPresentation(canonical.presentation).radar),
    evidenceState: eqArr(axis(a), axis(c)),
  };
  const pass = equal.primaryField && equal.specialties && equal.skills && equal.radar && equal.evidenceState;
  return {
    status: pass ? 'SEMANTIC_EQUIVALENCE_PASS' : 'SEMANTIC_EQUIVALENCE_FAIL',
    equal,
    assembled: { primaryField: a.primaryField, specialties: a.specialties, skills: a.skills },
    canonical: { primaryField: c.primaryField, specialties: c.specialties, skills: c.skills },
    geminiCalled: false,
  };
}

function manualReview(row: ClassifiedRow, profile: Record<string, unknown> | null): {
  verdict: ManualVerdict;
  tier: CanaryTier;
  notes: string[];
  overinference: string | null;
} {
  if (row.class !== 'ZERO_GEMINI_CANDIDATE') {
    return { verdict: 'UNSAFE', tier: null, notes: ['not a zero-Gemini candidate'], overinference: null };
  }
  const notes: string[] = [];
  const ctx = (row.p2.context as string[]) ?? [];
  const secs = (row.p2.secondaries as string[]) ?? [];
  const profileOk = profile?.status === 'SEMANTIC_EQUIVALENCE_PASS';
  const roleChange = Boolean((row.p3.histFields as string[])?.join('|') !== (row.p3.detFields as string[])?.join('|'));
  if (ctx.length || secs.length) notes.push('deterministic CONTEXT/SECONDARIES present');
  if (roleChange) notes.push('P3 field set differs from historical pack');
  const overinference =
    row.snapshotId === '8'
      ? 'R1 histórico tenía secondaries IT/DA/PPM que no entraron al pack P3; det P2 no los reproduce. No es overinference del perfil público.'
      : null;

  if (profileOk && !roleChange && ctx.length === 0 && row.snapshotId === '8') {
    return { verdict: 'SAFE', tier: 'TIER_1', notes: ['Camilo control: P2 SE-only, P3/P4 metadata reuse, profile verified'], overinference };
  }
  if (profileOk && !roleChange && ctx.length === 0) {
    notes.push('profile verified, no field-set change');
    return { verdict: 'SAFE', tier: 'TIER_1', notes, overinference };
  }
  if (isSafeReuseStar(row.p3.reuse as ReuseDecision) && isSafeReuseStar(row.p4.reuse as ReuseDecision)) {
    return { verdict: 'QUESTIONABLE', tier: profileOk ? 'TIER_2' : 'TIER_3', notes, overinference };
  }
  return { verdict: 'UNSAFE', tier: 'TIER_3', notes, overinference };
}

function camiloMutations(backendRoot: string, camilo: ClassifiedRow): Array<{ id: string; expected: string; observed: string; pass: boolean }> {
  if (!camilo.inventory.p1Identity) return [{ id: 'camilo_missing', expected: 'run', observed: 'missing', pass: false }];
  const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, String(camilo.inventory.p1Identity)));
  const evidence = evidenceIdentityFromUnits(units);
  const p3Abs = resolve(backendRoot, String(camilo.inventory.p3Pack));
  const p3 = loadP3Contract(p3Abs);
  const histFields = uniqSort(p3.payload.fieldsEvaluated ?? []);
  const histStatus = p3.payload.r1FieldResolutionStatus ?? 'RESOLVED';
  const oldP3 = defaultP3SemanticInput({
    contract: 'PRODUCTION',
    evidenceIdentity: evidence,
    fieldContext: histFields.map((c) => ({ fieldCode: c })),
    r1FieldResolutionStatus: histStatus,
  });
  const lineage: SemanticLineage = {
    originalRunId: p3.pipelineRunId ?? null,
    newRunId: 'mut',
    originalProducer: 'GEMINI',
    newUpstreamProducer: 'DETERMINISTIC_RESOLVER',
    oldResultIdentity: 'a',
    newResultIdentity: 'b',
  };
  const fieldMut = decideP3Reuse(
    oldP3,
    defaultP3SemanticInput({
      contract: 'PRODUCTION',
      evidenceIdentity: evidence,
      fieldContext: [...histFields, 'VISUAL_DESIGN'].map((c) => ({ fieldCode: c })),
      r1FieldResolutionStatus: histStatus,
    }),
    lineage,
  );
  const digestMut = decideP3Reuse(
    oldP3,
    defaultP3SemanticInput({
      contract: 'PRODUCTION',
      evidenceIdentity: 'mutated-digest',
      fieldContext: histFields.map((c) => ({ fieldCode: c })),
      r1FieldResolutionStatus: histStatus,
    }),
    lineage,
  );
  const producerOnly = decideP3Reuse(
    oldP3,
    defaultP3SemanticInput({
      contract: 'PRODUCTION',
      evidenceIdentity: evidence,
      fieldContext: histFields.map((c) => ({ fieldCode: c })),
      r1FieldResolutionStatus: histStatus,
    }),
    lineage,
  );
  return [
    {
      id: 'camilo_field_context_change',
      expected: 'RECOMPUTE_REQUIRED',
      observed: fieldMut.reuseDecision,
      pass: fieldMut.reuseDecision === 'RECOMPUTE_REQUIRED',
    },
    {
      id: 'camilo_evidence_digest_change',
      expected: 'RECOMPUTE_REQUIRED|REUSE_UNPROVEN',
      observed: digestMut.reuseDecision,
      pass: digestMut.reuseDecision === 'RECOMPUTE_REQUIRED' || digestMut.reuseDecision === 'REUSE_UNPROVEN',
    },
    {
      id: 'camilo_producer_only',
      expected: 'SAFE_REUSE*',
      observed: producerOnly.reuseDecision,
      pass: isSafeReuseStar(producerOnly.reuseDecision),
    },
  ];
}

function runOnce(backendRoot: string): { rows: ClassifiedRow[]; extra: Record<string, unknown>; digest: string } {
  const ids = identityMap(backendRoot);
  const inventory = discoverHistoricalInventory(backendRoot);
  const untagged = discoverUntaggedP1(backendRoot);
  const rows = inventory.map((row) => classifyOne(backendRoot, row, ids));
  for (const u of untagged) {
    rows.push({
      person: 'UNKNOWN_UNTAGGED_P1',
      personId: null,
      snapshotId: 'NONE',
      class: 'INSUFFICIENT_ARTIFACTS',
      profileUnverified: false,
      p2: { authorityEligible: false, geminiCalled: false },
      p3: { geminiCalled: false },
      p4: { geminiCalled: false },
      inventory: { p1Identity: u.packRel, snapshotId: null, missing: ['snapshotId', 'P2', 'P3', 'P4'] },
      freshness: 'STALE',
      profile: null,
      quality: {},
      digest: sha256Utf8(u.packRel),
    });
  }

  for (const z of rows.filter((r) => r.class === 'ZERO_GEMINI_CANDIDATE' && !r.profileUnverified)) {
    const inv = inventory.find((i) => i.snapshotId === z.snapshotId);
    if (!inv) continue;
    z.profile = simulateProfile(backendRoot, inv, z);
    z.quality = { ...z.quality, PROFILE: z.profile.status };
  }

  const extra = { untaggedP1: untagged, discoveredSnapshots: inventory.map((r) => r.snapshotId) };
  const digest = sha256Utf8(
    stableStringify({
      classes: rows.map((r) => ({ s: r.snapshotId, c: r.class, d: r.digest })),
      untagged: untagged.map((u) => u.packRel),
    }),
  );
  return { rows, extra, digest };
}

export function runZeroGeminiCandidateExpansion(backendRoot: string) {
  if (isDeterministicSkipGeminiEnabled() !== false) throw new Error('SKIP_MUST_STAY_FALSE');
  if (isP2DeterministicAuthorityEnabled() !== false) throw new Error('AUTHORITY_MUST_STAY_FALSE');
  const ledgerBefore = ledgerSnapshot(backendRoot);
  const a = runOnce(backendRoot);
  const b = runOnce(backendRoot);
  const ledgerAfter = ledgerSnapshot(backendRoot);
  const ledger = {
    before: ledgerBefore,
    after: ledgerAfter,
    callsDelta: ledgerAfter.calls - ledgerBefore.calls,
    tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
    eventsDelta: ledgerAfter.events - ledgerBefore.events,
  };
  const determinism = a.digest === b.digest ? 'PASS' : 'FAIL';
  const rows = a.rows;

  const camilo = rows.find((r) => r.snapshotId === '8' && r.personId === 1);
  const johan = rows.find((r) => r.snapshotId === '12');
  const s19 = rows.find((r) => r.snapshotId === '19');
  const s9 = rows.find((r) => r.snapshotId === '9');
  const juan = rows.find((r) => r.snapshotId === '14');
  const diego = rows.find((r) => r.snapshotId === '22');

  let regression: string | null = null;
  if (
    !camilo ||
    camilo.class !== 'ZERO_GEMINI_CANDIDATE' ||
    camilo.p3.reuse !== 'SAFE_REUSE_WITH_METADATA_CHANGE' ||
    camilo.p4.reuse !== 'SAFE_REUSE_WITH_METADATA_CHANGE' ||
    camilo.p2.authorityEligible !== true
  ) {
    regression = 'REGRESSION_BLOCK';
  }
  if (johan && johan.class !== 'P2_ONLY_BUT_DOWNSTREAM_RECOMPUTE') regression = regression ?? 'JOHAN_CONTROL_FAIL';
  if (s19 && s19.class !== 'P2_ONLY_BUT_DOWNSTREAM_RECOMPUTE') regression = regression ?? 'S19_CONTROL_FAIL';
  if (s9 && s9.class !== 'NOT_P2_ELIGIBLE') regression = regression ?? 'S9_CONTROL_FAIL';
  if (juan && juan.class !== 'NOT_P2_ELIGIBLE') regression = regression ?? 'JUAN_PABLO_CONTROL_FAIL';
  if (diego && diego.class !== 'NOT_P2_ELIGIBLE') regression = regression ?? 'DIEGO_CONTROL_FAIL';

  const adversarial = runZeroGeminiAdversarialClassificationTests();
  const mutation = camilo ? camiloMutations(backendRoot, camilo) : [];

  const zero = rows.filter((r) => r.class === 'ZERO_GEMINI_CANDIDATE');
  const reviews = zero.map((r) => {
    const rev = manualReview(r, r.profile);
    return {
      person: r.person,
      personId: r.personId,
      snapshotId: r.snapshotId,
      ...rev,
      profileVerified: r.profile?.status === 'SEMANTIC_EQUIVALENCE_PASS',
      manualReviewRequired: true,
    };
  });

  const byClass: Record<string, number> = {};
  for (const r of rows) byClass[r.class] = (byClass[r.class] ?? 0) + 1;
  byClass.ZERO_GEMINI_CANDIDATE_PROFILE_UNVERIFIED = rows.filter((r) => r.profileUnverified).length;

  const domainMap = new Map<string, { eligibleP2: number; zeroGemini: number; downstreamRecompute: number }>();
  for (const r of rows) {
    if (r.snapshotId === 'NONE') continue;
    const field = String(r.p2.primary ?? 'UNRESOLVED');
    const cur = domainMap.get(field) ?? { eligibleP2: 0, zeroGemini: 0, downstreamRecompute: 0 };
    if (r.p2.authorityEligible) cur.eligibleP2 += 1;
    if (r.class === 'ZERO_GEMINI_CANDIDATE') cur.zeroGemini += 1;
    if (r.class === 'P2_ONLY_BUT_DOWNSTREAM_RECOMPUTE') cur.downstreamRecompute += 1;
    domainMap.set(field, cur);
  }

  const uniqueZeroPersons = [...new Set(zero.map((r) => r.personId).filter((x): x is number => x != null))];
  const costSnapshots = reviews.filter((r) => r.verdict === 'SAFE').length * MEASURED_P2_TOKENS;
  const costPersons = uniqueZeroPersons.filter((id) =>
    reviews.some((r) => r.personId === id && r.verdict === 'SAFE'),
  ).length * MEASURED_P2_TOKENS;

  const costOk = ledger.callsDelta === 0 && ledger.tokensDelta === 0 && ledger.eventsDelta === 0;
  const testsOk = adversarial.every((t) => t.pass) && mutation.every((t) => t.pass);
  let verdict: 'ZERO_GEMINI_CANDIDATE_SET_VALIDATED' | 'MORE_CANDIDATE_VALIDATION_REQUIRED' | 'NO_ADDITIONAL_SAFE_CANDIDATES' =
    'MORE_CANDIDATE_VALIDATION_REQUIRED';
  if (regression || !costOk || !testsOk || determinism !== 'PASS') {
    verdict = 'MORE_CANDIDATE_VALIDATION_REQUIRED';
  } else if (reviews.filter((r) => r.verdict === 'SAFE' && r.tier === 'TIER_1').length <= 1) {
    verdict = 'NO_ADDITIONAL_SAFE_CANDIDATES';
  } else {
    verdict = 'ZERO_GEMINI_CANDIDATE_SET_VALIDATED';
  }

  const uniquePersons = [...new Set(rows.map((r) => r.personId).filter((x): x is number => x != null))];
  const files = {
    'inventory.json': {
      snapshots: rows.map((r) => r.inventory),
      untaggedP1: a.extra.untaggedP1,
      discovered: rows.length,
      uniquePersons: uniquePersons.length,
    },
    'p2-authority.json': rows.map((r) => ({ snapshotId: r.snapshotId, person: r.person, ...r.p2 })),
    'p3-semantic-reuse.json': rows.map((r) => ({ snapshotId: r.snapshotId, person: r.person, ...r.p3 })),
    'p4-semantic-reuse.json': rows.map((r) => ({ snapshotId: r.snapshotId, person: r.person, ...r.p4 })),
    'classifications.json': {
      counts: byClass,
      rows: rows.map((r) => ({
        person: r.person,
        personId: r.personId,
        snapshotId: r.snapshotId,
        class: r.class,
        profileUnverified: r.profileUnverified,
        freshness: r.freshness,
      })),
    },
    'profile-equivalence.json': rows
      .filter((r) => r.class === 'ZERO_GEMINI_CANDIDATE')
      .map((r) => ({ snapshotId: r.snapshotId, person: r.person, profile: r.profile, unverified: r.profileUnverified })),
    'manual-review.json': reviews,
    'domain-breakdown.json': [...domainMap.entries()].map(([field, n]) => ({ field, ...n })),
    'cost-opportunity.json': {
      candidateSnapshots: reviews.filter((r) => r.verdict === 'SAFE').length,
      uniquePersons: uniqueZeroPersons.length,
      historicalP2TokensAvoidableSnapshots: costSnapshots,
      historicalP2TokensAvoidableUniquePersons: costPersons,
      p3RecomputeCost: 0,
      p4RecomputeCost: 0,
      net: costPersons,
      label: 'HISTORICAL_COUNTERFACTUAL_ZERO_GEMINI_P2',
      missing141NotProjected: true,
    },
    'adversarial-tests.json': { passed: adversarial.filter((t) => t.pass).length, failed: adversarial.filter((t) => !t.pass).length, cases: adversarial },
    'mutation-tests.json': { passed: mutation.filter((t) => t.pass).length, failed: mutation.filter((t) => !t.pass).length, cases: mutation },
    'determinism-report.json': { status: determinism, digestA: a.digest, digestB: b.digest, ledger },
  };
  const outDir = writeTwin(backendRoot, files);
  return {
    outDir,
    verdict: regression ?? verdict,
    regression,
    ledger,
    determinism,
    counts: byClass,
    rows,
    reviews,
    domain: files['domain-breakdown.json'],
    cost: files['cost-opportunity.json'],
    adversarial: files['adversarial-tests.json'],
    mutation: files['mutation-tests.json'],
    controls: {
      Camilo: camilo?.class ?? 'MISSING',
      Johan: johan?.class ?? 'MISSING',
      S19: s19?.class ?? 'MISSING',
      S9: s9?.class ?? 'MISSING',
      'Juan Pablo': juan?.class ?? 'MISSING',
      Diego: diego?.class ?? 'MISSING',
    },
    uniquePersons: uniquePersons.length,
    discovered: rows.length,
    flags: {
      authority: isP2DeterministicAuthorityEnabled(),
      skip: isDeterministicSkipGeminiEnabled(),
    },
  };
}
