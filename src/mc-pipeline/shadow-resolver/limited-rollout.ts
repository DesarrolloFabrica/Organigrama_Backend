/**
 * Limited rollout design — no activa autoridad.
 * Allowlist + eligibility + kill switch. Fail-closed.
 */
import { isP2DeterministicAuthorityEnabled, isP2DeterministicSkipGeminiEnabled } from './flags';

export const LIMITED_ROLLOUT_KILL_SWITCH_ENV = 'MC1_P2_DETERMINISTIC_GLOBAL_KILL_SWITCH' as const;

export type LimitedAllowlistEntry = {
  person: string;
  personId: number;
  snapshotId: string;
  p1PackRel: string;
  primaryField: string;
  hasContext: boolean;
};

/** Solo los 3 ya validados. No se amplia. enabled=false. */
export const LIMITED_ROLLOUT_ALLOWLIST: {
  enabled: false;
  matchOn: Array<'personId' | 'snapshotId' | 'p1Identity' | 'authorityFingerprint'>;
  entries: LimitedAllowlistEntry[];
} = {
  enabled: false,
  matchOn: ['personId', 'snapshotId', 'p1Identity', 'authorityFingerprint'],
  entries: [
    {
      person: 'Camilo',
      personId: 1,
      snapshotId: '8',
      p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S8-20260810150132-32bbea26',
      primaryField: 'SOFTWARE_ENGINEERING',
      hasContext: false,
    },
    {
      person: 'Johan',
      personId: 2,
      snapshotId: '12',
      p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S12-20260813155624-bf324001',
      primaryField: 'SOFTWARE_ENGINEERING',
      hasContext: true,
    },
    {
      person: 'S19',
      personId: 9019,
      snapshotId: '19',
      p1PackRel: 'tmp/mc1-p1-prototype/P1P-V11-6I-S19-20260813145941-88b1e517',
      primaryField: 'COMMUNICATIONS',
      hasContext: true,
    },
  ],
};

export type LimitedAuthorityDecision = 'DETERMINISTIC_AUTHORITY' | 'FALLBACK_REQUIRED';

export type LimitedDecisionInput = {
  allowlisted: boolean;
  eligible: boolean;
  killPermits: boolean;
  authorityEnabled: boolean;
  skipEnabled: boolean;
  fingerprintValid: boolean;
};

/**
 * Condición futura completa. Fail-closed.
 * Allowlist no fuerza el resolver. Kill switch gana.
 */
export function evaluateLimitedAuthorityDecision(input: LimitedDecisionInput): {
  decision: LimitedAuthorityDecision;
  blockedBy: string[];
} {
  const blockedBy: string[] = [];
  if (!input.killPermits) blockedBy.push('KILL_SWITCH');
  if (!input.authorityEnabled) blockedBy.push('AUTHORITY_DISABLED');
  if (!input.skipEnabled) blockedBy.push('SKIP_DISABLED');
  if (!input.allowlisted) blockedBy.push('NOT_ALLOWLISTED');
  if (!input.eligible) blockedBy.push('NOT_ELIGIBLE');
  if (!input.fingerprintValid) blockedBy.push('FINGERPRINT_INVALID');
  return {
    decision: blockedBy.length === 0 ? 'DETERMINISTIC_AUTHORITY' : 'FALLBACK_REQUIRED',
    blockedBy,
  };
}

export function isAllowlistedIdentity(args: {
  personId: number;
  snapshotId: string;
  list?: typeof LIMITED_ROLLOUT_ALLOWLIST;
}): boolean {
  const list = args.list ?? LIMITED_ROLLOUT_ALLOWLIST;
  if (!list.entries.length) return false;
  return list.entries.some(
    (e) => e.personId === args.personId && e.snapshotId === args.snapshotId,
  );
}

/** Kill switch de diseño: env=false mata. Esta fase el skip hardcodeado ya mata. */
export function killSwitchPermits(override?: boolean): boolean {
  if (override === false) return false;
  if (override === true) {
    return isP2DeterministicSkipGeminiEnabled() || override;
  }
  const env = process.env[LIMITED_ROLLOUT_KILL_SWITCH_ENV]?.trim().toLowerCase();
  if (env === 'false' || env === '0' || env === 'kill') return false;
  return isP2DeterministicSkipGeminiEnabled();
}

export function productionLimitedRolloutArmed(): false {
  void isP2DeterministicAuthorityEnabled();
  return false;
}

export const ROLLOUT_STAGES = {
  stage0: { authority: false, note: 'actual' },
  stage1: { allowlist: 'single snapshot/person', note: 'Camilo-only candidate' },
  stage2: { allowlist: 'max 3 validated', note: 'Johan/Camilo/S19 if downstream ready' },
  stage3: { allowlist: 'field-specific candidate', note: 'not general SE/COMM' },
} as const;

export const MEASURED_P2_TOKENS = 18359;
export const MEASURED_P3_TOKENS = 11590;
export const MEASURED_P4_TOKENS = 10951;
