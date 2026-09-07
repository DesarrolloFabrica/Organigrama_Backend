/**
 * Runtime SHADOW. Nunca muta P2/P3/P4/PROFILE.
 * Nunca salta Gemini. Excepciones se tragan (SHADOW_FAILURE != PRODUCT_FAILURE).
 */
import { createHash } from 'node:crypto';
import { PROFESSIONAL_FIELD_CATALOG_VERSION } from '../catalog/professional-fields';
import { SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';
import { EXPERIMENTAL_POLICY_VERSION } from '../experimental/deterministic-resolver/experimental-policy';
import { resolveFieldsHardened } from '../experimental/deterministic-resolver/field-resolver-hardened';
import { resolveSpecialtiesHardened } from '../experimental/deterministic-resolver/specialty-resolver-hardened';
import { shadowInputFingerprint } from '../experimental/deterministic-resolver/shadow/fingerprint';
import { compareShadowP2, compareShadowP3 } from '../experimental/deterministic-resolver/shadow/shadow-compare';
import {
  SHADOW_EVENT_TYPE,
  SHADOW_NAMESPACE,
  type ProductionP2Snapshot,
  type ProductionP3Snapshot,
  type ShadowDecision,
} from '../experimental/deterministic-resolver/shadow/shadow-types';
import { RESOLVER_HARDENING_VERSION, type ResolverEvidenceUnit } from '../experimental/deterministic-resolver/types';
import { isShadowResolverEnabled, SHADOW_LATENCY_ALERT_MS } from './flags';
import { logShadow } from './log';
import type { PersistentShadowStore } from './persist';
import type {
  RuntimeComparison,
  RuntimeShadowEvent,
  RuntimeShadowP3Event,
  ShadowP2ObserveResult,
  ShadowP3ObserveResult,
} from './types';

export type ObserveContext = {
  store: PersistentShadowStore;
  units: ResolverEvidenceUnit[];
  snapshotId: string;
  personId: number;
  personLabel?: string;
  enabled?: boolean;
  policyVersion?: string;
  canonicalP2?: ProductionP2Snapshot;
  canonicalP3?: ProductionP3Snapshot[];
  createdAt?: string;
};

function eventIdFor(fingerprint: string): string {
  return `shd_${createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)}`;
}

function logKind(decision: 'RESOLVED' | 'AMBIGUOUS' | 'INSUFFICIENT_EVIDENCE') {
  if (decision === 'RESOLVED') return 'SHADOW_RESOLVED' as const;
  if (decision === 'AMBIGUOUS') return 'SHADOW_AMBIGUOUS' as const;
  return 'SHADOW_INSUFFICIENT' as const;
}

function toComparison(
  eventId: string,
  cmp: ReturnType<typeof compareShadowP2>,
  canonicalCode: string | null,
  canonicalStatus: string,
): RuntimeComparison {
  return {
    ...cmp,
    eventId,
    canonicalCode,
    canonicalStatus,
    reviewRequired: cmp.needsHumanReview,
  };
}

export function observeP2Shadow(ctx: ObserveContext): ShadowP2ObserveResult {
  const started = Date.now();
  try {
    if (!isShadowResolverEnabled(ctx.enabled)) {
      logShadow('SHADOW_DISABLED', { phase: 'P2', snapshotId: ctx.snapshotId });
      return {
        status: 'DISABLED',
        event: null,
        comparison: null,
        durationMs: Date.now() - started,
        error: null,
        productionMutated: false,
      };
    }
    const fp = shadowInputFingerprint({
      units: ctx.units,
      phase: 'P2',
      policyVersion: ctx.policyVersion,
    });
    const cached = ctx.store.lookup(fp);
    if (cached && cached.phase === 'P2') {
      logShadow('SHADOW_REUSED', {
        phase: 'P2',
        snapshotId: ctx.snapshotId,
        personId: ctx.personId,
        eventId: cached.eventId,
        inputFingerprint: fp,
      });
      return {
        status: 'SHADOW_REUSED',
        event: cached,
        comparison: null,
        durationMs: Date.now() - started,
        error: null,
        productionMutated: false,
      };
    }
    const resolved = resolveFieldsHardened({
      snapshotId: ctx.snapshotId,
      units: ctx.units,
    });
    const durationMs = Date.now() - started;
    const top = resolved.candidateFields[0];
    const wouldSkip = resolved.decision === 'RESOLVED';
    const createdAt = ctx.createdAt ?? new Date().toISOString();
    const base: ShadowDecision = {
      namespace: SHADOW_NAMESPACE,
      eventType: SHADOW_EVENT_TYPE,
      notAProductionResult: true,
      phase: 'P2',
      personId: ctx.personId,
      personLabel: ctx.personLabel ?? String(ctx.personId),
      snapshotId: ctx.snapshotId,
      resolverVersion: RESOLVER_HARDENING_VERSION,
      policyVersion: ctx.policyVersion ?? EXPERIMENTAL_POLICY_VERSION,
      catalogVersion: PROFESSIONAL_FIELD_CATALOG_VERSION,
      decision: resolved.decision,
      candidateCode: resolved.resolvedFieldCode,
      supportingEvidenceIds: top?.originEvidenceIds ?? [],
      independentSourceCount: top?.independentSourceCount ?? 0,
      reasonCodes: resolved.reasonCodes,
      competitors:
        resolved.decision === 'AMBIGUOUS'
          ? resolved.ambiguousFieldCodes
          : (top?.competitorFieldCodes ?? []),
      inputFingerprint: fp,
      createdAt,
      reused: false,
      wouldSkipGemini: wouldSkip,
      differentialSignalsMatched: top?.differentialSignalsMatched ?? [],
    };
    const event: RuntimeShadowEvent = {
      ...base,
      eventId: eventIdFor(fp),
      storeKind: 'mc1_shadow_resolver_event',
      durationMs,
    };
    ctx.store.insert(event);
    logShadow(logKind(event.decision), {
      phase: 'P2',
      snapshotId: ctx.snapshotId,
      personId: ctx.personId,
      eventId: event.eventId,
      decision: event.decision,
      candidateCode: event.candidateCode,
      wouldSkipGemini: event.wouldSkipGemini,
      durationMs,
      latencyAlert: durationMs >= SHADOW_LATENCY_ALERT_MS,
    });
    let comparison: RuntimeComparison | null = null;
    if (ctx.canonicalP2) {
      const cmp = compareShadowP2({
        personId: ctx.personId,
        snapshotId: ctx.snapshotId,
        shadow: event,
        production: ctx.canonicalP2,
      });
      comparison = toComparison(
        event.eventId,
        cmp,
        ctx.canonicalP2.rank1,
        ctx.canonicalP2.rank1 ? `ACTIVE rank-1 ${ctx.canonicalP2.rank1}` : 'NO_ACTIVE_FIELD',
      );
      ctx.store.insertComparison(comparison);
    }
    return {
      status: 'COMPUTED',
      event,
      comparison,
      durationMs,
      error: null,
      productionMutated: false,
    };
  } catch (err) {
    const durationMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    logShadow('SHADOW_ERROR', {
      phase: 'P2',
      snapshotId: ctx.snapshotId,
      personId: ctx.personId,
      error: message,
    });
    return {
      status: 'ERROR',
      event: null,
      comparison: null,
      durationMs,
      error: message,
      productionMutated: false,
    };
  }
}

export function observeP3Shadow(ctx: ObserveContext): ShadowP3ObserveResult {
  const started = Date.now();
  const empty: ShadowP3ObserveResult = {
    status: 'ERROR',
    p2: {
      status: 'ERROR',
      event: null,
      comparison: null,
      durationMs: 0,
      error: null,
      productionMutated: false,
    },
    events: [],
    comparisons: [],
    durationMs: 0,
    wouldSkipGemini: false,
    error: null,
    productionMutated: false,
  };
  try {
    if (!isShadowResolverEnabled(ctx.enabled)) {
      logShadow('SHADOW_DISABLED', { phase: 'P3', snapshotId: ctx.snapshotId });
      return {
        ...empty,
        status: 'DISABLED',
        p2: {
          status: 'DISABLED',
          event: null,
          comparison: null,
          durationMs: 0,
          error: null,
          productionMutated: false,
        },
        durationMs: Date.now() - started,
      };
    }
    const p2 = observeP2Shadow(ctx);
    if (!p2.event) {
      return {
        ...empty,
        status: p2.status,
        p2,
        durationMs: Date.now() - started,
        error: p2.error,
      };
    }
    const fieldCodes =
      p2.event.decision === 'RESOLVED' && p2.event.candidateCode
        ? [p2.event.candidateCode]
        : p2.event.decision === 'AMBIGUOUS'
          ? p2.event.competitors
          : [];
    const t0 = Date.now();
    const resolved = resolveSpecialtiesHardened({
      snapshotId: ctx.snapshotId,
      units: ctx.units,
      fieldCodes,
      allowObservedEquivalent: p2.event.decision === 'RESOLVED',
    });
    const p3Duration = Date.now() - t0;
    const createdAt = ctx.createdAt ?? new Date().toISOString();
    const prodMap = new Map(
      (ctx.canonicalP3 ?? []).map((o) => [`${o.fieldCode}::${o.specialtyCode}`, o]),
    );
    const events: RuntimeShadowP3Event[] = [];
    const comparisons: RuntimeComparison[] = [];
    const pending: RuntimeShadowP3Event[] = [];
    let reusedAll = resolved.items.length > 0;
    for (const item of resolved.items) {
      const itemFp = shadowInputFingerprint({
        units: ctx.units,
        phase: 'P3',
        fieldContext: fieldCodes,
        policyVersion: ctx.policyVersion,
      });
      const fp = createHash('sha256')
        .update(`${itemFp}:${item.fieldCode}:${item.specialtyCode}`)
        .digest('hex');
      const cached = ctx.store.lookup(fp);
      if (cached && cached.phase === 'P3') {
        events.push(cached as RuntimeShadowP3Event);
        continue;
      }
      reusedAll = false;
      const event: RuntimeShadowP3Event = {
        namespace: SHADOW_NAMESPACE,
        eventType: SHADOW_EVENT_TYPE,
        notAProductionResult: true,
        phase: 'P3',
        personId: ctx.personId,
        personLabel: ctx.personLabel ?? String(ctx.personId),
        snapshotId: ctx.snapshotId,
        resolverVersion: RESOLVER_HARDENING_VERSION,
        policyVersion: ctx.policyVersion ?? EXPERIMENTAL_POLICY_VERSION,
        catalogVersion: SPECIALTY_CATALOG_VERSION,
        decision: item.decision,
        candidateCode: item.specialtyCode,
        supportingEvidenceIds: item.originEvidenceIds,
        independentSourceCount: item.independentSourceCount ?? 0,
        reasonCodes: item.reasonCodes,
        competitors: [],
        inputFingerprint: fp,
        createdAt,
        reused: false,
        wouldSkipGemini: false,
        differentialSignalsMatched: [],
        fieldCode: item.fieldCode,
        specialtyCode: item.specialtyCode,
        observedEquivalent: item.observedEquivalent,
        eventId: eventIdFor(fp),
        storeKind: 'mc1_shadow_resolver_event',
        durationMs: p3Duration,
      };
      pending.push(event);
      events.push(event);
    }
    const p3HasAmb = events.some((i) => i.decision === 'AMBIGUOUS');
    const p3HasResolved = events.some((i) => i.decision === 'RESOLVED');
    const wouldSkipGemini = p2.event.wouldSkipGemini && p3HasResolved && !p3HasAmb;
    for (const ev of pending) {
      ev.wouldSkipGemini = wouldSkipGemini;
      ctx.store.insert(ev);
      logShadow(logKind(ev.decision), {
        phase: 'P3',
        snapshotId: ctx.snapshotId,
        personId: ctx.personId,
        eventId: ev.eventId,
        specialtyCode: ev.specialtyCode,
        decision: ev.decision,
        durationMs: p3Duration,
        latencyAlert: p3Duration >= SHADOW_LATENCY_ALERT_MS,
      });
      const prod = prodMap.get(`${ev.fieldCode}::${ev.specialtyCode}`);
      const canonical: ProductionP3Snapshot = prod ?? {
        fieldCode: ev.fieldCode,
        specialtyCode: ev.specialtyCode,
        status: 'NOT_EMITTED',
        source: 'CANONICAL_PACK_SUMMARY',
      };
      const cmp = compareShadowP3({
        personId: ctx.personId,
        snapshotId: ctx.snapshotId,
        shadow: ev,
        production: canonical,
      });
      const rc = toComparison(ev.eventId, cmp, canonical.specialtyCode, canonical.status);
      ctx.store.insertComparison(rc);
      comparisons.push(rc);
    }
    const durationMs = Date.now() - started;
    return {
      status: reusedAll ? 'SHADOW_REUSED' : 'COMPUTED',
      p2,
      events,
      comparisons,
      durationMs,
      wouldSkipGemini,
      error: null,
      productionMutated: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logShadow('SHADOW_ERROR', {
      phase: 'P3',
      snapshotId: ctx.snapshotId,
      personId: ctx.personId,
      error: message,
    });
    return {
      ...empty,
      durationMs: Date.now() - started,
      error: message,
    };
  }
}

export function parsePersonId(raw?: string | number | null): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
