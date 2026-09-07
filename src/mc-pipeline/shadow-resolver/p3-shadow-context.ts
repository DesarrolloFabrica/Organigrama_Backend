/**
 * Adapter P3 experimental para authority shadow.
 * No modifica p3-context-loader ni el prompt P3.
 * CONTEXT habilita evaluación; no implica OBSERVED.
 */
import { createHash } from 'node:crypto';
import { SPECIALTY_CATALOG_SCOPE } from '../catalog/specialties-visual-education';
import { fingerprintP3Config, resolveFieldsToEvaluate } from '../p3/p3-context-loader';
import type { R1ContractEnvelope } from '../r1/r1.types';
import type { ExperimentalR1Full } from './experimental-r1-full-adapter';
import type { DeterministicFullContract } from './full-contract';

export type P3FieldRole = 'PRIMARY' | 'SECONDARY' | 'CONTEXT';

export type P3FieldContextShadow = {
  fieldCode: string;
  /** Ausente en packs históricos; default = PRIMARY/SECONDARY según R1. */
  role?: P3FieldRole;
  source: 'R1' | 'P2_CONTEXT' | 'HISTORICAL_R1';
};

export const P3_CONTEXT_ADAPTER_VERSION = 'MC1.P3.CONTEXT.SHADOW.1.0.0' as const;

/**
 * Routing futuro de P3. No se implementa semántica Gemini.
 * CONTEXT permite evaluación con el mismo umbral de evidencia; no hay promoción automática.
 */
export const P3_CONTEXT_FUTURE_ROUTING = {
  PRIMARY: { evaluate: true, automaticPromotion: 'n/a' },
  SECONDARY: { evaluate: true, automaticPromotion: 'n/a' },
  CONTEXT: {
    evaluate: true,
    evidenceThresholdUnchanged: true,
    automaticPromotion: false,
  },
} as const;

export const AUTHORITY_SHADOW_EVENTS = [
  'P2_AUTHORITY_SHADOW_ELIGIBLE',
  'P2_AUTHORITY_SHADOW_SIMULATED',
  'P2_AUTHORITY_SHADOW_BLOCKED',
  'P2_AUTHORITY_SHADOW_FALLBACK',
] as const;

function push(
  out: P3FieldContextShadow[],
  fieldCode: string,
  role: P3FieldRole,
  source: P3FieldContextShadow['source'],
) {
  if (!SPECIALTY_CATALOG_SCOPE.has(fieldCode)) return;
  if (out.some((x) => x.fieldCode === fieldCode)) return;
  out.push({ fieldCode, role, source });
}

/** Histórico: role opcional se rellena desde R1. */
export function p3ContextFromHistoricalR1(r1: R1ContractEnvelope): P3FieldContextShadow[] {
  return resolveFieldsToEvaluate(r1).map((f) => ({
    fieldCode: f.fieldCode,
    role: f.role,
    source: 'HISTORICAL_R1' as const,
  }));
}

/**
 * Authority shadow: R1 PRIMARY + SECONDARIES + P2 CONTEXT.
 * CONTEXT no se lee de R1 secondaries.
 * Contrato inválido / AMBIGUOUS / COMPETITOR no se entrega a P3 (sin parciales).
 */
export function p3ContextFromAuthorityShadow(args: {
  r1: ExperimentalR1Full;
  contract: DeterministicFullContract;
}): P3FieldContextShadow[] {
  if (
    !args.contract.valid ||
    args.contract.decision !== 'RESOLVED' ||
    args.contract.competitors.length > 0 ||
    args.r1.ambiguity.present
  ) {
    return [];
  }
  const out: P3FieldContextShadow[] = [];
  if (args.r1.primary) push(out, args.r1.primary, 'PRIMARY', 'R1');
  for (const code of args.r1.secondaries) push(out, code, 'SECONDARY', 'R1');
  for (const c of args.contract.contextFields) {
    push(out, c.fieldCode, 'CONTEXT', 'P2_CONTEXT');
  }
  return out.sort((a, b) => a.fieldCode.localeCompare(b.fieldCode));
}

/** Fingerprint productivo actual: solo fieldCode (p3-runner). */
export function productionP3FieldsFingerprint(fieldCodes: string[]): string {
  return fingerprintP3Config({ fields: [...fieldCodes].sort().join(',') });
}

/** Fingerprint futuro propuesto: fieldCode + fieldRole. */
export function experimentalP3InputFingerprint(fields: P3FieldContextShadow[]): string {
  const rows = fields
    .map((f) => `${f.fieldCode}:${f.role ?? 'UNSET'}`)
    .sort()
    .join(',');
  return createHash('sha256')
    .update(`${P3_CONTEXT_ADAPTER_VERSION}|${rows}`, 'utf8')
    .digest('hex');
}

export function fieldCodesOf(fields: P3FieldContextShadow[]): string[] {
  return [...new Set(fields.map((f) => f.fieldCode))].sort();
}

export function contextInflatesR1Secondaries(
  r1: ExperimentalR1Full,
  context: P3FieldContextShadow[],
): boolean {
  const seconds = new Set(r1.secondaries);
  return context.some((f) => f.role === 'CONTEXT' && seconds.has(f.fieldCode));
}
