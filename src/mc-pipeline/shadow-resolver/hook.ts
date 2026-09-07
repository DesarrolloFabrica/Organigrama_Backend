/**
 * Hook pasivo para runners productivos.
 * Fire-and-forget. Nunca lanza. Nunca salta Gemini. Nunca muta el resultado.
 */
import { join } from 'node:path';
import type { P2InputEvidenceUnit } from '../p2/p2.types';
import { isP2DeterministicResolverEnabled, isShadowResolverEnabled } from './flags';
import { logShadow } from './log';
import { fromP2InputUnits } from './map-evidence';
import { PersistentShadowStore } from './persist';
import { observeP2Shadow, observeP3Shadow, parsePersonId } from './runtime';
import { evaluateDeterministicAuthority } from './authority-runtime';

export function defaultShadowRuntimeDir(backendRoot: string): string {
  return join(backendRoot, 'tmp', 'mc1-hybrid-resolver-shadow-runtime');
}

export function observeMc1ShadowFromP2(args: {
  backendRoot: string;
  snapshotId: string;
  personId?: string | number;
  units: P2InputEvidenceUnit[];
}): void {
  try {
    if (!isShadowResolverEnabled()) return;
    const store = new PersistentShadowStore(defaultShadowRuntimeDir(args.backendRoot));
    observeP2Shadow({
      store,
      units: fromP2InputUnits(args.units),
      snapshotId: args.snapshotId,
      personId: parsePersonId(args.personId),
    });
  } catch (err) {
    logShadow('SHADOW_ERROR', {
      phase: 'P2',
      snapshotId: args.snapshotId,
      error: err instanceof Error ? err.message : String(err),
      isolated: true,
    });
  }
}

/**
 * Hook pasivo de autoridad determinística.
 * Nunca lanza. Nunca reemplaza el contrato P2. Nunca salta Gemini.
 * Con flags default no evalúa el resolver (sin latencia extra).
 */
export function observeMc1DeterministicAuthorityFromP2(args: {
  backendRoot: string;
  snapshotId: string;
  personId?: string | number;
  units: P2InputEvidenceUnit[];
  artifactIdentity: string;
}): { replaceProduction: false; productionUnaffected: true } {
  try {
    if (!isP2DeterministicResolverEnabled()) {
      return { replaceProduction: false, productionUnaffected: true };
    }
    evaluateDeterministicAuthority({
      snapshotId: args.snapshotId,
      personId: args.personId,
      units: fromP2InputUnits(args.units),
      artifactIdentity: args.artifactIdentity,
      simulateAuthority: false,
    });
  } catch (err) {
    logShadow('SHADOW_ERROR', {
      phase: 'P2_AUTHORITY',
      snapshotId: args.snapshotId,
      error: err instanceof Error ? err.message : String(err),
      isolated: true,
    });
  }
  return { replaceProduction: false, productionUnaffected: true };
}

export function observeMc1ShadowFromP3(args: {
  backendRoot: string;
  snapshotId: string;
  personId?: string | number;
  units: P2InputEvidenceUnit[];
}): void {
  try {
    if (!isShadowResolverEnabled()) return;
    const store = new PersistentShadowStore(defaultShadowRuntimeDir(args.backendRoot));
    observeP3Shadow({
      store,
      units: fromP2InputUnits(args.units),
      snapshotId: args.snapshotId,
      personId: parsePersonId(args.personId),
    });
  } catch (err) {
    logShadow('SHADOW_ERROR', {
      phase: 'P3',
      snapshotId: args.snapshotId,
      error: err instanceof Error ? err.message : String(err),
      isolated: true,
    });
  }
}
