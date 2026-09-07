/**
 * Fingerprint de autoridad determinística P2.
 * No timestamps. No reutiliza fingerprint Gemini.
 */
import { createHash } from 'node:crypto';
import { PROFESSIONAL_FIELD_CATALOG_VERSION } from '../catalog/professional-fields';
import { canonicalEvidenceIdentity } from '../experimental/deterministic-resolver/shadow/fingerprint';
import { stableStringify } from '../experimental/deterministic-resolver/run-prototype';
import { RESOLVER_CANDIDATE_2_VERSION } from '../experimental/deterministic-resolver/types';
import type { ResolverEvidenceUnit } from '../experimental/deterministic-resolver/types';
import { CANDIDATE_2_POLICY_VERSION } from './skip-eligibility';
import { CANDIDATE_SET_POLICY_V2 } from './candidate-set-policy-v2';
import { FULL_CONTRACT_ADAPTER_VERSION } from './full-contract';

export function computeAuthorityFingerprint(args: {
  units: ResolverEvidenceUnit[];
  fieldCatalogVersion?: string;
  resolverVersion?: string;
  policyVersion?: string;
  candidateSetPolicyVersion?: string;
  contractAdapterVersion?: string;
}): string {
  return createHash('sha256')
    .update(
      stableStringify({
        p1EvidenceIdentity: canonicalEvidenceIdentity(args.units),
        fieldCatalogFingerprint: args.fieldCatalogVersion ?? PROFESSIONAL_FIELD_CATALOG_VERSION,
        resolverVersion: args.resolverVersion ?? RESOLVER_CANDIDATE_2_VERSION,
        policyVersion: args.policyVersion ?? CANDIDATE_2_POLICY_VERSION,
        candidateSetPolicyVersion:
          args.candidateSetPolicyVersion ?? CANDIDATE_SET_POLICY_V2.policyVersion,
        contractAdapterVersion: args.contractAdapterVersion ?? FULL_CONTRACT_ADAPTER_VERSION,
      }),
      'utf8',
    )
    .digest('hex');
}

export type AuthorityLineage = {
  snapshotId: string;
  p1EvidenceIdentity: ReturnType<typeof canonicalEvidenceIdentity>;
  catalogFingerprint: string;
  resolverVersion: string;
  policyVersion: string;
  candidateSetPolicyVersion: string;
  contractAdapterVersion: string;
  authorityFingerprint: string;
};
