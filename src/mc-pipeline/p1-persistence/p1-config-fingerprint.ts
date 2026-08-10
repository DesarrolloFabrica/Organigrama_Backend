import { createHash } from 'node:crypto';
import {
  P1_ALLOWED_WARNING_CODES,
  P1_CONTRACT_CODE,
  P1_WARNING_POLICY_VERSION,
  type P1AllowedWarningCode,
} from './p1-persistence.constants';
import { p1Error } from './p1-persistence.errors';
import type { P1RunConfig } from './p1-persistence.types';

export function computeConfigFingerprint(config: P1RunConfig): string {
  const parts = [
    config.contractVersion,
    config.segmenterName,
    config.segmenterVersion,
    config.promptVersion,
    config.modelProvider,
    config.modelVersion,
    config.batchBuilderVersion,
    config.validatorVersion,
    config.warningPolicyVersion,
  ];
  return createHash('sha256').update(parts.join('|'), 'utf8').digest('hex');
}

export function assertConfigFingerprint(
  config: P1RunConfig,
  provided?: string | null,
): string {
  if (config.contractCode !== P1_CONTRACT_CODE) {
    throw p1Error(
      'CONFIG_FINGERPRINT_MISMATCH',
      'contractCode must be MC1.P1.EVIDENCE',
    );
  }
  if (config.warningPolicyVersion !== P1_WARNING_POLICY_VERSION) {
    throw p1Error(
      'CONFIG_FINGERPRINT_MISMATCH',
      `warningPolicyVersion must be ${P1_WARNING_POLICY_VERSION}`,
      { got: config.warningPolicyVersion },
    );
  }
  const computed = computeConfigFingerprint(config);
  if (provided && provided !== computed) {
    throw p1Error(
      'CONFIG_FINGERPRINT_MISMATCH',
      'configFingerprint does not match provenance',
    );
  }
  return computed;
}

export function assertWarningCodesAllowed(
  codes: string[],
): P1AllowedWarningCode[] {
  const allowed = new Set<string>(P1_ALLOWED_WARNING_CODES);
  for (const c of codes) {
    if (!allowed.has(c)) {
      throw p1Error('UNKNOWN_WARNING_CODE', 'warning code not in allowlist', {
        code: c,
      });
    }
  }
  return codes as P1AllowedWarningCode[];
}

export function sha256Hex(seed: string): string {
  return createHash('sha256').update(seed, 'utf8').digest('hex');
}
