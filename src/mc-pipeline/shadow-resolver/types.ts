import {
  SHADOW_EVENT_TYPE,
  SHADOW_NAMESPACE,
  type ShadowComparison,
  type ShadowDecision,
  type ShadowP3Decision,
} from '../experimental/deterministic-resolver/shadow/shadow-types';

export type ShadowLogKind =
  | 'SHADOW_RESOLVED'
  | 'SHADOW_AMBIGUOUS'
  | 'SHADOW_INSUFFICIENT'
  | 'SHADOW_REUSED'
  | 'SHADOW_ERROR'
  | 'SHADOW_DISABLED';

export type RuntimeShadowEvent = ShadowDecision & {
  eventId: string;
  storeKind: 'mc1_shadow_resolver_event';
  durationMs: number;
};

export type RuntimeShadowP3Event = ShadowP3Decision & {
  eventId: string;
  storeKind: 'mc1_shadow_resolver_event';
  durationMs: number;
};

export type RuntimeComparison = ShadowComparison & {
  eventId: string;
  canonicalCode: string | null;
  canonicalStatus: string;
  reviewRequired: boolean;
};

export type ShadowObserveStatus =
  | 'COMPUTED'
  | 'SHADOW_REUSED'
  | 'DISABLED'
  | 'ERROR';

export type ShadowP2ObserveResult = {
  status: ShadowObserveStatus;
  event: RuntimeShadowEvent | null;
  comparison: RuntimeComparison | null;
  durationMs: number;
  error: string | null;
  productionMutated: false;
};

export type ShadowP3ObserveResult = {
  status: ShadowObserveStatus;
  p2: ShadowP2ObserveResult;
  events: RuntimeShadowP3Event[];
  comparisons: RuntimeComparison[];
  durationMs: number;
  wouldSkipGemini: boolean;
  error: string | null;
  productionMutated: false;
};

export { SHADOW_EVENT_TYPE, SHADOW_NAMESPACE };
