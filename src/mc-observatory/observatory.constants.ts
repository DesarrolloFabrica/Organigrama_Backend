/**
 * Constantes congeladas del Evidence Observatory Pilot (FASE 5G.1).
 */
import {
  P1_CONTRACT_VERSION,
  P1_PROMPT_VERSION,
  P1_SEGMENTER_NAME,
  P1_SEGMENTER_VERSION,
} from '../mc-pipeline/p1/p1.types';

export const OBSERVATORY_PILOT_CODE_VERSION = '1.0.0';
export const SELECTION_POLICY_VERSION = '1.0.0';
export const SIGNATURE_VERSION = '1.0.0';
export const BATCH_BUILDER_VERSION = '1.0.0';
export const VALIDATOR_VERSION = '1.0.0';

export const COHORT_CODE = 'MC1-OBS-PILOT5-V1';
export const COHORT_VERSION = '1.0.0';
export const MAX_COHORT_MEMBERS = 5;

export const ANCHOR_SNAPSHOT_IDS = ['1', '2'] as const;

export const FROZEN_P1_CONFIG = {
  contractName: 'MC1.P1.EVIDENCE',
  contractVersion: P1_CONTRACT_VERSION,
  segmenterName: P1_SEGMENTER_NAME,
  segmenterVersion: P1_SEGMENTER_VERSION,
  promptVersion: P1_PROMPT_VERSION,
  modelProvider: 'google-genai',
  modelVersion: 'gemini-3.6-flash',
  batchBuilderVersion: BATCH_BUILDER_VERSION,
  validatorVersion: VALIDATOR_VERSION,
  signatureVersion: SIGNATURE_VERSION,
} as const;

export const ANCHOR_ARTIFACT_DIRS: Record<string, string> = {
  '1': 'P1P-V11-20260805205709-bf601215',
  '2': 'P1P-V11-S2-20260806133814-e99b7e49',
};

export const FORBIDDEN_SELECTION_FIELDS = [
  'cargo',
  'area',
  'areaId',
  'coordinacion',
  'facultad',
  'jefe',
  'jefeId',
  'jerarquia',
  'dominio',
  'especialidad',
  'skill',
] as const;
