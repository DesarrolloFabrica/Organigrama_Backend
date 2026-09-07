/**
 * Adapter P3 runtime inactivo. No se conecta al prompt Gemini.
 * CONTEXT viaja separado de SECONDARIES.
 */
import {
  experimentalP3InputFingerprint,
  fieldCodesOf,
  p3ContextFromAuthorityShadow,
  p3ContextFromHistoricalR1,
  productionP3FieldsFingerprint,
  type P3FieldContextShadow,
  type P3FieldRole,
} from './p3-shadow-context';
import type { ExperimentalR1Full } from './experimental-r1-full-adapter';
import type { DeterministicFullContract } from './full-contract';
import type { R1ContractEnvelope } from '../r1/r1.types';

export const P3_CONTEXT_RUNTIME_DISABLED = true as const;

export type P3ReuseSafety =
  | 'P3_CONTEXT_RUNTIME_DISABLED'
  | 'P3_REUSE_BLOCKED_ROLE_CHANGE'
  | 'P3_REUSE_BLOCKED_FIELDSET'
  | 'P3_REUSE_CANDIDATE_NOT_ACTIVATED';

const VALID_ROLES = new Set<P3FieldRole>(['PRIMARY', 'SECONDARY', 'CONTEXT']);

export function p3ContextRuntime(args: {
  r1: ExperimentalR1Full;
  contract: DeterministicFullContract;
}): { fields: P3FieldContextShadow[]; enabled: false; flag: 'P3_CONTEXT_RUNTIME_DISABLED' } {
  return {
    fields: p3ContextFromAuthorityShadow(args),
    enabled: false,
    flag: 'P3_CONTEXT_RUNTIME_DISABLED',
  };
}

export function contextRolesValid(fields: P3FieldContextShadow[]): boolean {
  return fields.every((f) => !f.role || VALID_ROLES.has(f.role));
}

export function evaluateP3ReuseSafety(args: {
  historical: P3FieldContextShadow[];
  proposed: P3FieldContextShadow[];
}): { decision: P3ReuseSafety; sameFieldSet: boolean; roleChanges: Array<{ fieldCode: string; from?: string; to?: string }> } {
  const histCodes = fieldCodesOf(args.historical);
  const propCodes = fieldCodesOf(args.proposed);
  const sameFieldSet = histCodes.join('|') === propCodes.join('|');
  const roleChanges = args.historical
    .filter((h) => {
      const p = args.proposed.find((x) => x.fieldCode === h.fieldCode);
      return p && h.role && p.role && h.role !== p.role;
    })
    .map((h) => ({
      fieldCode: h.fieldCode,
      from: h.role,
      to: args.proposed.find((x) => x.fieldCode === h.fieldCode)?.role,
    }));
  if (P3_CONTEXT_RUNTIME_DISABLED && sameFieldSet && roleChanges.length > 0) {
    return { decision: 'P3_REUSE_BLOCKED_ROLE_CHANGE', sameFieldSet, roleChanges };
  }
  if (!sameFieldSet) {
    return { decision: 'P3_REUSE_BLOCKED_FIELDSET', sameFieldSet, roleChanges };
  }
  if (P3_CONTEXT_RUNTIME_DISABLED) {
    return { decision: 'P3_CONTEXT_RUNTIME_DISABLED', sameFieldSet, roleChanges };
  }
  return { decision: 'P3_REUSE_CANDIDATE_NOT_ACTIVATED', sameFieldSet, roleChanges };
}

/**
 * Fingerprint P3 futuro (fieldCode + fieldRole).
 * No se usa en p3-runner mientras authority esté desactivada.
 */
export function futureP3FingerprintPart(
  fields: Array<{ fieldCode: string; role?: P3FieldRole }>,
  authorityEnabled: boolean,
): string {
  if (!authorityEnabled) {
    return [...fields.map((f) => f.fieldCode)].sort().join(',');
  }
  return [...fields.map((f) => `${f.fieldCode}:${f.role ?? 'UNSET'}`)].sort().join(',');
}

export function p3FingerprintCompatibility(fields: P3FieldContextShadow[]) {
  return {
    production: productionP3FieldsFingerprint(fieldCodesOf(fields)),
    experimental: experimentalP3InputFingerprint(fields),
    productionUnchangedWhileAuthorityOff: true,
  };
}

export { p3ContextFromHistoricalR1 };
export type { R1ContractEnvelope };
