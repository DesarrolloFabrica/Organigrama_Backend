import { FROZEN_P1_CONFIG, OBSERVATORY_PILOT_CODE_VERSION } from './observatory.constants';
import { sha256Hex } from './hash';

export type ConfigFingerprintInput = {
  contractVersion: string;
  segmenterVersion: string;
  promptVersion: string;
  modelProvider: string;
  modelVersion: string;
  batchBuilderVersion: string;
  validatorVersion: string;
  signatureVersion: string;
  cohortReproHash: string;
  pilotCodeVersion?: string;
};

export function computeConfigFingerprint(input: ConfigFingerprintInput): string {
  const payload = [
    input.contractVersion,
    input.segmenterVersion,
    input.promptVersion,
    input.modelProvider,
    input.modelVersion,
    input.batchBuilderVersion,
    input.validatorVersion,
    input.signatureVersion,
    input.cohortReproHash,
    input.pilotCodeVersion ?? OBSERVATORY_PILOT_CODE_VERSION,
  ].join('|');
  return sha256Hex(payload);
}

export function frozenConfigFingerprint(cohortReproHash: string): string {
  return computeConfigFingerprint({
    contractVersion: FROZEN_P1_CONFIG.contractVersion,
    segmenterVersion: FROZEN_P1_CONFIG.segmenterVersion,
    promptVersion: FROZEN_P1_CONFIG.promptVersion,
    modelProvider: FROZEN_P1_CONFIG.modelProvider,
    modelVersion: FROZEN_P1_CONFIG.modelVersion,
    batchBuilderVersion: FROZEN_P1_CONFIG.batchBuilderVersion,
    validatorVersion: FROZEN_P1_CONFIG.validatorVersion,
    signatureVersion: FROZEN_P1_CONFIG.signatureVersion,
    cohortReproHash,
  });
}
