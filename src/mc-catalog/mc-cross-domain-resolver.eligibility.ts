import type {
  McCdrDecisionCode,
  McCrossDomainResolverPolicy,
  McEvaluationSetSnapshot,
  McResolverEligibility,
} from './mc-cross-domain-resolver.types';

export function assessEvaluationSetResolverEligibility(
  set: McEvaluationSetSnapshot,
  policy: McCrossDomainResolverPolicy,
): McResolverEligibility {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!set.personId?.trim()) {
    return ineligible('INVALID_STRUCTURE', ['personId ausente']);
  }
  if (!set.candidateDomains?.length) {
    return ineligible('INVALID_STRUCTURE', ['candidateDomains vacío']);
  }
  if (!set.contextHash?.trim()) {
    warnings.push('contextHash vacío');
  }

  const sortedCandidates = [...set.candidateDomains]
    .map((c) => c.toUpperCase())
    .sort((a, b) => a.localeCompare(b));
  if (new Set(sortedCandidates).size !== sortedCandidates.length) {
    return ineligible('DUPLICATE_DOMAIN', [
      'candidateDomains con duplicados',
    ]);
  }

  if (set.setStatus === 'RUNNING') {
    return ineligible('RUNNING_SET_NOT_ALLOWED', ['set RUNNING']);
  }
  if (set.setStatus === 'FAILED') {
    return ineligible('FAILED_SET_NOT_ALLOWED', ['set FAILED']);
  }
  if (set.setStatus === 'PARTIAL') {
    if (!policy.allowPartialSets) {
      return ineligible('PARTIAL_SET_NOT_ALLOWED', [
        'PARTIAL no resoluble por defecto (allowPartialSets=false)',
      ]);
    }
    warnings.push('allowPartialSets experimental');
  }

  const byCode = new Map(
    set.domains.map((d) => [d.domainCode.toUpperCase(), d]),
  );
  if (byCode.size !== set.domains.length) {
    return ineligible('DUPLICATE_DOMAIN', [
      'domains[] con domainCode duplicado',
    ]);
  }

  for (const code of sortedCandidates) {
    const d = byCode.get(code);
    if (!d) {
      return ineligible('MISSING_CANDIDATE_OUTCOME', [
        `candidato ${code} sin outcome`,
      ]);
    }
    if (d.domainStatus === 'FAILED') {
      return ineligible('FAILED_DOMAIN_PRESENT', [
        `dominio ${code} FAILED ≠ OUTSIDE`,
      ]);
    }
    if (
      d.domainStatus === 'NOT_EVALUATED' ||
      d.domainStatus === 'SKIPPED'
    ) {
      if (!policy.allowPartialSets) {
        return ineligible('PARTIAL_SET_NOT_ALLOWED', [
          `dominio ${code} status=${d.domainStatus}`,
        ]);
      }
    }
    if (d.domainStatus === 'SUCCEEDED') {
      if (!d.profileEvaluationId) {
        return ineligible('INVALID_STRUCTURE', [
          `${code} SUCCEEDED sin profileEvaluationId`,
        ]);
      }
      if (!d.domainQualification) {
        return ineligible('INVALID_STRUCTURE', [
          `${code} SUCCEEDED sin domainQualification`,
        ]);
      }
    }
  }

  // Extra domains not in candidates
  for (const d of set.domains) {
    if (!sortedCandidates.includes(d.domainCode.toUpperCase())) {
      reasons.push(`dominio extra ${d.domainCode} no en candidates`);
      return ineligible('INVALID_STRUCTURE', reasons);
    }
  }

  return {
    eligible: true,
    code: 'ELIGIBLE',
    reasons: ['set COMPLETE estructuralmente válido'],
    warnings,
  };
}

function ineligible(
  code: McCdrDecisionCode,
  reasons: string[],
): McResolverEligibility {
  return { eligible: false, code, reasons, warnings: [] };
}
