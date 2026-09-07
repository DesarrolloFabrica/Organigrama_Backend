import type {
  ComparisonClass,
  DiscrepancyClass,
  FieldResolverResult,
  SpecialtyResolverResult,
} from './types';

export type HistoricalP2 = {
  ranks: Array<{ domainCode: string; status: string; rank: number }>;
};

export type HistoricalP3 = {
  observed: Array<{
    fieldCode: string;
    specialtyCode: string;
    status: string;
  }>;
};

export function compareP2(
  resolved: FieldResolverResult,
  historical: HistoricalP2,
): {
  class: ComparisonClass;
  discrepancy: DiscrepancyClass | null;
  historicalRank1: string | null;
  historicalActive: string[];
} {
  const active = historical.ranks
    .filter((r) => r.status === 'ACTIVE' && r.domainCode)
    .map((r) => r.domainCode);
  const rank1 = historical.ranks.find((r) => r.rank === 1)?.domainCode ?? null;

  if (resolved.decision === 'AMBIGUOUS') {
    return {
      class: 'RESOLVER_AMBIGUOUS',
      discrepancy: 'LEGITIMATE_AMBIGUITY',
      historicalRank1: rank1,
      historicalActive: active,
    };
  }
  if (resolved.decision === 'INSUFFICIENT_EVIDENCE') {
    return {
      class: active.length ? 'FALSE_NEGATIVE' : 'EXACT_MATCH',
      discrepancy: active.length ? 'INSUFFICIENT_INFORMATION' : null,
      historicalRank1: rank1,
      historicalActive: active,
    };
  }
  const field = resolved.resolvedFieldCode;
  if (field && field === rank1) {
    return {
      class: 'EXACT_MATCH',
      discrepancy: null,
      historicalRank1: rank1,
      historicalActive: active,
    };
  }
  if (field && active.includes(field)) {
    return {
      class: 'COMPATIBLE_MATCH',
      discrepancy: 'LEGITIMATE_AMBIGUITY',
      historicalRank1: rank1,
      historicalActive: active,
    };
  }
  if (field && !active.includes(field)) {
    return {
      class: 'FALSE_POSITIVE',
      discrepancy: 'RESOLVER_ERROR',
      historicalRank1: rank1,
      historicalActive: active,
    };
  }
  return {
    class: 'CONFLICT',
    discrepancy: 'RESOLVER_ERROR',
    historicalRank1: rank1,
    historicalActive: active,
  };
}

export function compareP3Specialty(args: {
  specialtyCode: string;
  decision: SpecialtyResolverResult['items'][number]['decision'];
  historicalStatus: 'OBSERVED' | 'WEAK' | 'NOT_EMITTED';
}): {
  class: ComparisonClass;
  discrepancy: DiscrepancyClass | null;
} {
  const { decision, historicalStatus } = args;
  if (decision === 'RESOLVED') {
    if (historicalStatus === 'OBSERVED') {
      return { class: 'EXACT_MATCH', discrepancy: null };
    }
    if (historicalStatus === 'WEAK') {
      return {
        class: 'COMPATIBLE_MATCH',
        discrepancy: 'LEGITIMATE_AMBIGUITY',
      };
    }
    return { class: 'FALSE_POSITIVE', discrepancy: 'RESOLVER_ERROR' };
  }
  if (decision === 'AMBIGUOUS') {
    return {
      class: 'RESOLVER_AMBIGUOUS',
      discrepancy: 'LEGITIMATE_AMBIGUITY',
    };
  }
  if (historicalStatus === 'OBSERVED') {
    return {
      class: 'FALSE_NEGATIVE',
      discrepancy: 'INSUFFICIENT_INFORMATION',
    };
  }
  if (historicalStatus === 'WEAK') {
    return {
      class: 'COMPATIBLE_MATCH',
      discrepancy: 'LEGITIMATE_AMBIGUITY',
    };
  }
  return { class: 'EXACT_MATCH', discrepancy: null };
}
