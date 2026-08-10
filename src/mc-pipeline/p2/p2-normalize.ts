import { createHash } from 'node:crypto';
import {
  isReservedSpecialtyCode,
  PROFESSIONAL_FIELD_CATALOG_VERSION,
  resolveToKnownFieldCode,
} from '../catalog/professional-fields';
import {
  P2_CATALOG_POLICY_VERSION,
  P2_CONTRACT_CODE,
  P2_CONTRACT_VERSION,
  P2_GENERATION_POLICY_VERSION,
  P2_MAX_CANDIDATES,
  P2_PROMPT_VERSION,
  P2_REASONING_POLICY_VERSION,
  type P2AmbiguityFlag,
  type P2ArtifactPayload,
  type P2CandidateStatus,
  type P2CatalogStatus,
  type P2ContractEnvelope,
  type P2DomainCandidate,
  type P2EvidenceDisposition,
  type P2EvidenceDispositionDecision,
  type P2ModelRawOutput,
  type P2OutcomeStatus,
  type P2RationaleCode,
  type P2ReviewState,
} from './p2.types';

const RATIONALES = new Set<P2RationaleCode>([
  'SUPPORT_ACTION_CLUSTER',
  'SUPPORT_PROJECT_RESULT',
  'SUPPORT_RESPONSIBILITY_SCOPE',
  'SUPPORT_DELIVERABLE_SET',
  'SUPPORT_MIXED_KINDS',
  'PENALTY_KNOWLEDGE_ONLY',
  'PENALTY_CONTRADICTION',
  'PENALTY_LOW_DIVERSITY',
  'GAP_NO_KNOWN_MATCH',
  'TRANSVERSAL_SPLIT',
]);

const FLAGS = new Set<P2AmbiguityFlag>([
  'TRANSVERSAL_SUPPORT',
  'MULTI_CANDIDATE_TIE',
  'CONTRADICTORY_EVIDENCE',
  'KNOWLEDGE_HEAVY',
  'LOW_COVERAGE',
  'KIND_IMBALANCE',
  'CATALOG_GAP',
  'WEAK_EXPLICITNESS',
  'INSUFFICIENT_ACTIONABLE_SIGNAL',
]);

const DISPOSITIONS = new Set<P2EvidenceDispositionDecision>([
  'SUPPORTS',
  'CONTRADICTS',
  'NEUTRAL',
  'INSUFFICIENT',
  'EXCLUDED_BY_POLICY',
]);

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function asOutcome(v: unknown): P2OutcomeStatus {
  const s = String(v ?? '');
  if (
    s === 'CANDIDATES_PRODUCED' ||
    s === 'NO_DOMAIN_EVIDENCE' ||
    s === 'INSUFFICIENT_SIGNAL' ||
    s === 'REVIEW_REQUIRED' ||
    s === 'FAILED'
  ) {
    return s;
  }
  return 'FAILED';
}

function asReview(v: unknown): P2ReviewState {
  const s = String(v ?? 'NOT_REQUIRED');
  if (s === 'SUGGESTED' || s === 'REQUIRED' || s === 'NOT_REQUIRED') return s;
  return 'NOT_REQUIRED';
}

function asCatalog(v: unknown): P2CatalogStatus {
  const s = String(v ?? 'PROPOSED');
  if (s === 'KNOWN' || s === 'PROPOSED' || s === 'UNRESOLVED') return s;
  return 'PROPOSED';
}

function asCandStatus(v: unknown): P2CandidateStatus {
  const s = String(v ?? 'ACTIVE');
  return s === 'WEAK' ? 'WEAK' : 'ACTIVE';
}

function asRationale(v: unknown): P2RationaleCode {
  const s = String(v ?? 'SUPPORT_MIXED_KINDS') as P2RationaleCode;
  return RATIONALES.has(s) ? s : 'SUPPORT_MIXED_KINDS';
}

export type NormalizeResult = {
  envelope: P2ContractEnvelope;
  activities: NonNullable<P2ModelRawOutput['professionalActivities']>;
  capabilities: NonNullable<P2ModelRawOutput['capabilityAreas']>;
  normalizeWarnings: string[];
};

export function normalizeP2ModelOutput(args: {
  raw: P2ModelRawOutput;
  executionId: string;
  configFingerprint: string;
  snapshotId: string;
  p1RunId: string;
  p1ArtifactDigest: string;
  unitIds: string[];
  campaignId: string;
  pipelineRunId: string;
  registryFingerprint: string;
  modelWarnings: string[];
  inputSource: 'P1_PACK_ARTIFACT_ONLY_LAB' | 'P1_CANONICAL_EVIDENCE_READER';
}): NormalizeResult {
  const normalizeWarnings: string[] = [...args.modelWarnings];
  const unitSet = new Set(args.unitIds);

  let outcome = asOutcome(args.raw.outcomeStatus);
  let candidatesIn = Array.isArray(args.raw.domainCandidates)
    ? args.raw.domainCandidates
    : [];

  if (outcome === 'NO_DOMAIN_EVIDENCE') {
    candidatesIn = [];
  }

  // Cap + unique ranks
  candidatesIn = [...candidatesIn]
    .sort((a, b) => Number(a.rank) - Number(b.rank))
    .slice(0, P2_MAX_CANDIDATES);
  if ((args.raw.domainCandidates?.length ?? 0) > P2_MAX_CANDIDATES) {
    normalizeWarnings.push('CANDIDATE_CAP_APPLIED');
  }

  const domainCandidates: P2DomainCandidate[] = candidatesIn.map((c, idx) => {
    const rawSupporting = c.supportingEvidenceUnitIds ?? [];
    const rawContradicting = c.contradictingEvidenceUnitIds ?? [];
    for (const id of rawSupporting) {
      if (!unitSet.has(id)) {
        normalizeWarnings.push('ORPHAN_SUPPORT_REF');
      }
    }
    for (const id of rawContradicting) {
      if (!unitSet.has(id)) {
        normalizeWarnings.push('ORPHAN_CONTRADICTION_REF');
      }
    }
    const supporting = rawSupporting.filter((id) => unitSet.has(id));
    const contradicting = rawContradicting.filter((id) => unitSet.has(id));
    const flags = (c.ambiguityFlags ?? []).filter((f): f is P2AmbiguityFlag =>
      FLAGS.has(f as P2AmbiguityFlag),
    );

    const rawCode =
      c.domainCode != null && String(c.domainCode).trim()
        ? String(c.domainCode).trim()
        : null;
    const rawProposed =
      c.proposedDomainKey != null && String(c.proposedDomainKey).trim()
        ? String(c.proposedDomainKey).trim()
        : null;

    if (isReservedSpecialtyCode(rawCode) || isReservedSpecialtyCode(rawProposed)) {
      normalizeWarnings.push('RESERVED_SPECIALTY_COERCED_OR_DROPPED');
    }

    const known = resolveToKnownFieldCode(rawCode, rawProposed);
    let catalogStatus: P2CatalogStatus = asCatalog(c.catalogStatus);
    let domainCode: string | null = null;
    let proposed: string | null = rawProposed;

    if (known) {
      catalogStatus = 'KNOWN';
      domainCode = known;
      proposed = null;
      if (rawCode && rawCode !== known) {
        normalizeWarnings.push('LEGACY_OR_SPECIALTY_CODE_MAPPED_TO_KNOWN_FIELD');
      }
    } else if (catalogStatus === 'KNOWN') {
      // Model claimed KNOWN but code invalid → PROPOSED or drop specialty-only
      catalogStatus = 'PROPOSED';
      domainCode = null;
      if (!proposed) {
        proposed = rawCode ? `field.${rawCode.toLowerCase()}` : null;
      }
      normalizeWarnings.push('INVALID_KNOWN_CODE_DEMOTED_TO_PROPOSED');
    } else if (catalogStatus === 'PROPOSED') {
      domainCode = null;
      if (!proposed) {
        proposed = `field.unspecified_${idx + 1}`;
        normalizeWarnings.push('PROPOSED_KEY_SYNTHESIZED');
      }
    } else {
      // UNRESOLVED
      domainCode = null;
    }

    return {
      candidateId: c.candidateId?.trim() || `dc-${idx + 1}`,
      domainCode,
      proposedDomainKey: proposed,
      catalogStatus,
      candidateStatus: asCandStatus(c.candidateStatus),
      confidence: clamp01(Number(c.confidence)),
      rank: idx + 1,
      supportingEvidenceUnitIds: supporting,
      contradictingEvidenceUnitIds: contradicting,
      rationaleCode: asRationale(c.rationaleCode),
      coverageRatio: clamp01(Number(c.coverageRatio)),
      ambiguityFlags: flags,
      signalKindMix: c.signalKindMix,
      producedBy: 'MODEL' as const,
    };
  });

  // Dedupe same KNOWN field code (keep highest confidence / first rank)
  const seenKnown = new Set<string>();
  const deduped: P2DomainCandidate[] = [];
  for (const c of domainCandidates) {
    if (c.catalogStatus === 'KNOWN' && c.domainCode) {
      if (seenKnown.has(c.domainCode)) {
        normalizeWarnings.push('DUPLICATE_KNOWN_FIELD_DROPPED');
        continue;
      }
      seenKnown.add(c.domainCode);
    }
    deduped.push(c);
  }
  deduped.forEach((c, i) => {
    c.rank = i + 1;
  });
  domainCandidates.length = 0;
  domainCandidates.push(...deduped);

  if (
    domainCandidates.length > 0 &&
    outcome !== 'REVIEW_REQUIRED' &&
    outcome !== 'FAILED'
  ) {
    outcome = 'CANDIDATES_PRODUCED';
  }
  if (domainCandidates.length === 0 && outcome === 'CANDIDATES_PRODUCED') {
    outcome = 'INSUFFICIENT_SIGNAL';
    normalizeWarnings.push('EMPTY_CANDIDATES_FORCED_INSUFFICIENT');
  }

  // Dispositions: ensure coverage
  const rawDisp = Array.isArray(args.raw.evidenceDispositions)
    ? args.raw.evidenceDispositions
    : [];
  const byId = new Map<string, P2EvidenceDisposition>();
  for (const d of rawDisp) {
    if (!unitSet.has(d.evidenceUnitId)) continue;
    const decision = DISPOSITIONS.has(d.decision)
      ? d.decision
      : ('NEUTRAL' as const);
    const refs = (d.candidateRefs ?? []).filter((r) =>
      domainCandidates.some((c) => c.candidateId === r),
    );
    byId.set(d.evidenceUnitId, {
      evidenceUnitId: d.evidenceUnitId,
      decision,
      candidateRefs:
        decision === 'SUPPORTS' || decision === 'CONTRADICTS'
          ? refs.length
            ? refs
            : undefined
          : undefined,
      policyCode: d.policyCode,
    });
  }
  for (const id of args.unitIds) {
    if (!byId.has(id)) {
      byId.set(id, { evidenceUnitId: id, decision: 'NEUTRAL' });
      normalizeWarnings.push('DISPOSITION_BACKFILLED_NEUTRAL');
    }
  }
  // Fix SUPPORTS without refs
  const candIds = new Set(domainCandidates.map((c) => c.candidateId));
  for (const d of byId.values()) {
    if (
      (d.decision === 'SUPPORTS' || d.decision === 'CONTRADICTS') &&
      (!d.candidateRefs || d.candidateRefs.length === 0)
    ) {
      // attach to candidates that list this unit
      const refs = domainCandidates
        .filter(
          (c) =>
            c.supportingEvidenceUnitIds.includes(d.evidenceUnitId) ||
            c.contradictingEvidenceUnitIds.includes(d.evidenceUnitId),
        )
        .map((c) => c.candidateId)
        .filter((id) => candIds.has(id));
      if (refs.length) d.candidateRefs = refs;
      else d.decision = 'NEUTRAL';
    }
  }

  // Dispositions 1:1 con units de entrada (unicidad + cobertura)
  const evidenceDispositions = args.unitIds.map((id) => byId.get(id)!);
  if (evidenceDispositions.length !== args.unitIds.length) {
    throw new Error('P2_DISPOSITION_COVERAGE_MISMATCH');
  }
  if (
    new Set(evidenceDispositions.map((d) => d.evidenceUnitId)).size !==
    evidenceDispositions.length
  ) {
    throw new Error('P2_DISPOSITION_ID_NOT_UNIQUE');
  }

  let reviewState = asReview(args.raw.reviewState);
  if (
    domainCandidates.some((c) => c.catalogStatus === 'UNRESOLVED' && c.rank <= 2)
  ) {
    reviewState = 'REQUIRED';
  }

  const payload: P2ArtifactPayload = {
    executionId: args.executionId,
    configFingerprint: args.configFingerprint,
    p1RunId: args.p1RunId,
    snapshotId: args.snapshotId,
    p1ArtifactDigest: args.p1ArtifactDigest,
    catalogPolicyVersion: P2_CATALOG_POLICY_VERSION,
    outcomeStatus: outcome,
    domainCandidates,
    evidenceDispositions,
    reviewState,
    maxCandidates: P2_MAX_CANDIDATES,
    artifactProvenance: {
      stageCode: 'P2',
      contractCode: P2_CONTRACT_CODE,
      contractVersion: P2_CONTRACT_VERSION,
      inputSource: args.inputSource,
      generativeResultOrigin: 'LIVE',
      reasoningPolicyVersion: P2_REASONING_POLICY_VERSION,
      generationPolicyVersion: P2_GENERATION_POLICY_VERSION,
      promptVersion: P2_PROMPT_VERSION,
      professionalFieldCatalogVersion: PROFESSIONAL_FIELD_CATALOG_VERSION,
    },
  };

  const digestBody = JSON.stringify({
    candidates: domainCandidates,
    dispositions: evidenceDispositions,
    outcome,
  });
  payload.artifactProvenance.p2ArtifactDigest = createHash('sha256')
    .update(digestBody, 'utf8')
    .digest('hex');

  const warnings = [
    ...normalizeWarnings.map((code) => ({
      code,
      severity: 'WARNING' as const,
      messageSafe: code,
    })),
    ...(args.raw.warnings ?? []).map((w) => ({
      code: 'MODEL_WARNING',
      severity: 'WARNING' as const,
      messageSafe: String(w).slice(0, 120),
    })),
  ];

  const abstained =
    outcome === 'NO_DOMAIN_EVIDENCE' || outcome === 'INSUFFICIENT_SIGNAL';

  const envelope: P2ContractEnvelope = {
    contractCode: P2_CONTRACT_CODE,
    contractVersion: P2_CONTRACT_VERSION,
    stageCode: 'P2',
    registryFingerprint: args.registryFingerprint,
    campaignId: args.campaignId,
    pipelineRunId: args.pipelineRunId,
    producedAt: new Date().toISOString(),
    abstained: abstained || undefined,
    abstentionReason: abstained ? outcome : undefined,
    errors: [],
    warnings,
    payload,
  };

  return {
    envelope,
    activities: args.raw.professionalActivities ?? [],
    capabilities: args.raw.capabilityAreas ?? [],
    normalizeWarnings,
  };
}
