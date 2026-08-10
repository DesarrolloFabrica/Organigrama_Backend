/**
 * Guardrails del Observatory Pilot — bloquean ejecución insegura.
 */
import { assertMdeTarget, type MdeConnectionTarget } from '../mc-pipeline/p0/mde-guard';
import {
  ANCHOR_SNAPSHOT_IDS,
  FROZEN_P1_CONFIG,
  MAX_COHORT_MEMBERS,
} from './observatory.constants';
import type { CohortSpec } from './observatory.types';

export type GuardrailContext = {
  mde: MdeConnectionTarget;
  cohort: CohortSpec;
  modelVersion: string;
  segmenterVersion: string;
  promptVersion: string;
  contractVersion: string;
  geminiApiKeyPresent: boolean;
  publisherEnabled: boolean;
  p2Enabled: boolean;
  cloudConfigPresent: boolean;
  execute: boolean;
  confirm: boolean;
  dryRunPlanHash: string | null;
  expectedDryRunPlanHash: string | null;
};

export type GuardrailResult = {
  ok: boolean;
  errors: string[];
};

export function evaluateGuardrails(ctx: GuardrailContext): GuardrailResult {
  const errors: string[] = [];

  try {
    assertMdeTarget(ctx.mde);
  } catch {
    errors.push('MDE_GUARD_FAILED');
  }

  if (!String(ctx.mde.database).includes('_mde')) {
    errors.push('DATABASE_NOT_MDE');
  }

  if (ctx.cohort.members.length > MAX_COHORT_MEMBERS) {
    errors.push('COHORT_TOO_LARGE');
  }
  if (ctx.cohort.members.length !== MAX_COHORT_MEMBERS) {
    errors.push('COHORT_SIZE_MUST_BE_FIVE');
  }

  for (const id of ANCHOR_SNAPSHOT_IDS) {
    const found = ctx.cohort.members.some(
      (m) => m.role === 'ANCHOR' && m.snapshotId === id,
    );
    if (!found) errors.push(`ANCHOR_MISSING_${id}`);
  }

  if (ctx.segmenterVersion !== FROZEN_P1_CONFIG.segmenterVersion) {
    errors.push('SEGMENTER_VERSION_MISMATCH');
  }
  if (ctx.promptVersion !== FROZEN_P1_CONFIG.promptVersion) {
    errors.push('PROMPT_VERSION_MISMATCH');
  }
  if (ctx.contractVersion !== FROZEN_P1_CONFIG.contractVersion) {
    errors.push('CONTRACT_VERSION_MISMATCH');
  }
  if (ctx.modelVersion !== FROZEN_P1_CONFIG.modelVersion) {
    errors.push('MODEL_VERSION_MISMATCH');
  }

  if (ctx.publisherEnabled) errors.push('PUBLISHER_ENABLED');
  if (ctx.p2Enabled) errors.push('P2_ENABLED');
  if (ctx.cloudConfigPresent) errors.push('CLOUD_CONFIG_PRESENT');

  if (ctx.execute) {
    if (!ctx.confirm) errors.push('EXECUTE_REQUIRES_CONFIRM');
    if (!ctx.geminiApiKeyPresent) errors.push('GEMINI_API_KEY_MISSING');
    if (!ctx.dryRunPlanHash) errors.push('DRY_RUN_PLAN_MISSING');
    if (
      ctx.dryRunPlanHash &&
      ctx.expectedDryRunPlanHash &&
      ctx.dryRunPlanHash !== ctx.expectedDryRunPlanHash
    ) {
      errors.push('DRY_RUN_REPRO_HASH_CHANGED');
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertExecuteFlags(argv: string[]): void {
  const execute = argv.includes('--execute');
  const confirm = argv.includes('--confirm');
  if (execute && !confirm) {
    throw new Error('EXECUTE_REQUIRES_CONFIRM');
  }
  if (!execute && !argv.includes('--dry-run')) {
    throw new Error('MODE_REQUIRED_DRY_RUN_OR_EXECUTE');
  }
}

export function detectCloudConfigPresent(env: NodeJS.ProcessEnv): boolean {
  const keys = [
    'GOOGLE_CLOUD_PROJECT',
    'GCLOUD_PROJECT',
    'CLOUD_SQL_CONNECTION_NAME',
    'INSTANCE_CONNECTION_NAME',
  ];
  return keys.some((k) => Boolean(env[k]?.trim()));
}
