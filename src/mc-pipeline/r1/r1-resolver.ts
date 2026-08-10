import { createHash } from 'node:crypto';
import { mapToFieldCode, R1_CATALOG_VERSION } from './r1-catalog-aliases';
import {
  R1_CONTRACT_CODE,
  R1_CONTRACT_VERSION,
  R1_RULE_VERSION,
  type P2CandidateView,
  type P2ContractView,
  type R1ContractEnvelope,
  type R1FieldResolutionStatus,
  type R1LegacyResolutionStatus,
  type R1ResolvedField,
} from './r1.types';

/** Política determinística documentada (no IA). */
export const R1_POLICY = {
  /** Δ confidence rank1−rank2 por debajo ⇒ MULTI_FIELD si ambos ACTIVE fuertes */
  clearLeadMinDelta: 0.08,
  /** Segundo candidato “fuerte” */
  strongSecondaryMinConfidence: 0.75,
  /** Primario mínimo para RESOLVED en solitario */
  resolveMinConfidence: 0.7,
  /** WEAK no compite como secundario fuerte */
  ignoreWeakAsCompetitor: true,
} as const;

function configHash(): string {
  return createHash('sha256')
    .update(
      [
        R1_RULE_VERSION,
        R1_CATALOG_VERSION,
        R1_POLICY.clearLeadMinDelta,
        R1_POLICY.strongSecondaryMinConfidence,
        R1_POLICY.resolveMinConfidence,
      ].join('|'),
      'utf8',
    )
    .digest('hex');
}

function toResolvedField(c: P2CandidateView): R1ResolvedField {
  const mapped = mapToFieldCode({
    domainCode: c.domainCode,
    proposedDomainKey: c.proposedDomainKey,
  });
  return {
    fieldCode: mapped.fieldCode,
    sourceKey: mapped.sourceKey,
    catalogStatus: mapped.mapped
      ? c.catalogStatus === 'KNOWN'
        ? 'KNOWN'
        : 'MAPPED_PROPOSED'
      : c.catalogStatus === 'UNRESOLVED'
        ? 'UNRESOLVED'
        : 'PROPOSED',
    rank: c.rank,
    confidence: c.confidence,
    candidateId: c.candidateId,
  };
}

function legacyOf(
  status: R1FieldResolutionStatus,
  reason: string,
): R1LegacyResolutionStatus {
  if (status === 'RESOLVED') return 'RESOLVED_PRIMARY';
  if (status === 'MULTI_FIELD') return 'MULTI_DOMAIN';
  if (reason === 'NO_DOMAIN_EVIDENCE' || reason === 'INSUFFICIENT_SIGNAL') {
    return 'INSUFFICIENT_EVIDENCE';
  }
  if (reason === 'REVIEW_REQUIRED') return 'REVIEW_REQUIRED';
  if (reason === 'NO_CANDIDATES') return 'NO_DOMAIN_MATCH';
  return 'AMBIGUOUS';
}

function hasFlag(c: P2CandidateView, flag: string): boolean {
  return (c.ambiguityFlags ?? []).includes(flag);
}

/**
 * Resolver R1 — solo P2 contract fields.
 */
export function resolveR1FromP2(p2: P2ContractView): {
  envelope: R1ContractEnvelope;
  decisionCodes: string[];
} {
  const decisionCodes: string[] = [];
  const warnings: R1ContractEnvelope['warnings'] = [];
  const p = p2.payload;
  const outcome = p.outcomeStatus;

  const active = [...(p.domainCandidates ?? [])]
    .filter((c) => c.candidateStatus !== 'SUPPRESSED')
    .sort((a, b) => a.rank - b.rank);

  const strong = active.filter((c) => {
    if (R1_POLICY.ignoreWeakAsCompetitor && c.candidateStatus === 'WEAK') {
      return false;
    }
    return true;
  });

  let fieldStatus: R1FieldResolutionStatus = 'UNRESOLVED';
  let primary: R1ResolvedField | null = null;
  let secondaries: R1ResolvedField[] = [];
  let reasonCode = 'INIT';

  if (
    outcome === 'NO_DOMAIN_EVIDENCE' ||
    outcome === 'INSUFFICIENT_SIGNAL' ||
    outcome === 'FAILED'
  ) {
    fieldStatus = 'UNRESOLVED';
    reasonCode = outcome;
    decisionCodes.push(`OUTCOME_${outcome}`);
  } else if (strong.length === 0) {
    fieldStatus = 'UNRESOLVED';
    reasonCode = 'NO_CANDIDATES';
    decisionCodes.push('NO_ACTIVE_CANDIDATES');
  } else if (p.reviewState === 'REQUIRED') {
    fieldStatus = 'UNRESOLVED';
    reasonCode = 'REVIEW_REQUIRED';
    decisionCodes.push('P2_REVIEW_REQUIRED');
  } else {
    const top = strong[0];
    const second = strong[1];
    const topField = toResolvedField(top);

    if (top.catalogStatus === 'UNRESOLVED' && !topField.fieldCode) {
      fieldStatus = 'UNRESOLVED';
      reasonCode = 'TOP_UNRESOLVED';
      decisionCodes.push('TOP_CANDIDATE_UNRESOLVED');
      primary = topField;
    } else if (
      hasFlag(top, 'CONTRADICTORY_EVIDENCE') &&
      (top.contradictingEvidenceUnitIds?.length ?? 0) > 0 &&
      (top.contradictingEvidenceUnitIds.length >=
        Math.max(1, Math.floor(top.supportingEvidenceUnitIds.length / 2)))
    ) {
      fieldStatus = 'UNRESOLVED';
      reasonCode = 'TOP_HEAVY_CONTRADICTION';
      decisionCodes.push('CONTRADICTION_BLOCKS_RESOLVE');
      primary = topField;
      if (second) secondaries = [toResolvedField(second)];
    } else if (
      second &&
      (hasFlag(top, 'MULTI_CANDIDATE_TIE') ||
        hasFlag(second, 'MULTI_CANDIDATE_TIE') ||
        top.confidence - second.confidence < R1_POLICY.clearLeadMinDelta) &&
      second.confidence >= R1_POLICY.strongSecondaryMinConfidence &&
      top.confidence >= R1_POLICY.resolveMinConfidence
    ) {
      fieldStatus = 'MULTI_FIELD';
      reasonCode = 'CLOSE_STRONG_PAIR';
      decisionCodes.push('MULTI_FIELD_CLOSE_LEAD');
      if (hasFlag(top, 'TRANSVERSAL_SUPPORT') || hasFlag(second, 'TRANSVERSAL_SUPPORT')) {
        decisionCodes.push('TRANSVERSAL_SUPPORT_PRESENT');
      }
      primary = topField;
      secondaries = [toResolvedField(second)];
      // include other strong near-ties
      for (const c of strong.slice(2)) {
        if (
          top.confidence - c.confidence < R1_POLICY.clearLeadMinDelta &&
          c.confidence >= R1_POLICY.strongSecondaryMinConfidence
        ) {
          secondaries.push(toResolvedField(c));
        }
      }
    } else if (top.confidence < R1_POLICY.resolveMinConfidence) {
      fieldStatus = 'UNRESOLVED';
      reasonCode = 'WEAK_TOP';
      decisionCodes.push('TOP_BELOW_RESOLVE_FLOOR');
      primary = topField;
      if (second) secondaries = [toResolvedField(second)];
    } else {
      fieldStatus = 'RESOLVED';
      reasonCode = 'CLEAR_PRIMARY';
      decisionCodes.push('RESOLVED_CLEAR_LEAD');
      primary = topField;
      secondaries = strong.slice(1).map(toResolvedField);
      if (!topField.fieldCode) {
        warnings.push({
          code: 'PRIMARY_UNMAPPED_TO_CATALOG',
          severity: 'WARNING',
          messageSafe: `primary sourceKey=${topField.sourceKey} not in catalog aliases`,
        });
      }
    }
  }

  if (fieldStatus === 'MULTI_FIELD' && secondaries.length === 0 && primary) {
    // safety
    fieldStatus = 'RESOLVED';
    reasonCode = 'MULTI_WITHOUT_SECONDARY_FORCED_RESOLVE';
    decisionCodes.push('MULTI_DEGENERATED_TO_RESOLVED');
  }

  const explanation = [
    `rule=${R1_RULE_VERSION}`,
    `reason=${reasonCode}`,
    `p2Outcome=${outcome}`,
    `status=${fieldStatus}`,
    primary
      ? `primary=${primary.fieldCode ?? primary.sourceKey}@${primary.confidence}`
      : 'primary=null',
    `secondaries=${secondaries.length}`,
    `codes=${decisionCodes.join(',')}`,
  ].join('; ');

  const payload = {
    fieldResolutionStatus: fieldStatus,
    resolutionStatus: legacyOf(fieldStatus, reasonCode),
    primaryField: primary,
    secondaryFields: secondaries,
    primaryDomainCode: primary?.fieldCode ?? null,
    secondaryDomainCodes: secondaries
      .map((s) => s.fieldCode)
      .filter((x): x is string => !!x),
    resolutionRuleVersion: R1_RULE_VERSION,
    configHash: configHash(),
    decisionExplanation: explanation,
    decisionCodes,
    p2ExecutionId: p.executionId,
    p2OutcomeStatus: outcome,
    snapshotId: String(p.snapshotId),
    provenance: {
      stageCode: 'R1' as const,
      mode: 'ARTIFACT_ONLY' as const,
      inputSource: 'P2_CONTRACT' as const,
      p2ArtifactDigest: p.artifactProvenance?.p2ArtifactDigest ?? null,
      generativeResultOrigin: 'RULES_ONLY' as const,
    },
  };

  const envelope: R1ContractEnvelope = {
    contractCode: R1_CONTRACT_CODE,
    contractVersion: R1_CONTRACT_VERSION,
    stageCode: 'R1',
    registryFingerprint: createHash('sha256')
      .update(`r1|${R1_RULE_VERSION}|${R1_CATALOG_VERSION}`, 'utf8')
      .digest('hex'),
    campaignId: p2.campaignId ?? 'MC1-R1-8A',
    pipelineRunId: p2.pipelineRunId ?? `r1-8a-${p.snapshotId}`,
    producedAt: new Date().toISOString(),
    abstained: fieldStatus === 'UNRESOLVED' || undefined,
    abstentionReason:
      fieldStatus === 'UNRESOLVED' ? reasonCode : undefined,
    errors: [],
    warnings: [
      ...warnings,
      ...(p2.warnings ?? []).map((w) => ({
        code: `P2_${w.code}`,
        severity: 'INFO',
        messageSafe: (w.messageSafe ?? w.code).slice(0, 160),
      })),
    ],
    payload,
  };

  return { envelope, decisionCodes };
}
