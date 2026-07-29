import {
  MC_CDR_POLICY_VERSION,
  MC_CDR_RESOLVER_VERSION,
  type McCrossDomainResolverPolicy,
} from './mc-cross-domain-resolver.types';

export const DEFAULT_CDR_V0_POLICY: McCrossDomainResolverPolicy = {
  resolverVersion: MC_CDR_RESOLVER_VERSION,
  policyVersion: MC_CDR_POLICY_VERSION,
  allowPartialSets: false,
  hybridMode: 'CONSERVATIVE',
  comparisonDimensions: [
    'activeSpecialtyRatio',
    'bestSpecialtyStrength',
    'topKSpecialtyStrength',
    'evidenceCoverage',
    'evidenceConfidence',
  ],
  minimumComparableDimensions: 2,
  topK: 2,
  dominanceMargin: 0.15,
};
