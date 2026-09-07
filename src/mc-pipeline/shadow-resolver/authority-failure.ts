/**
 * Aislamiento de fallo: un error determinístico no entrega contrato parcial a P3.
 * Simulación offline. Fallback futuro = Gemini P2 completo. No se llama Gemini aquí.
 */
import type { P3FieldContextShadow } from './p3-shadow-context';

export type AuthorityFailureIsolation = {
  event: 'P2_AUTHORITY_SHADOW_FALLBACK';
  state: 'FALLBACK_REQUIRED';
  reason: 'DETERMINISTIC_ERROR';
  p3Context: [];
  r1: null;
  contract: null;
  partialContractReleased: false;
};

export function isolateDeterministicAuthorityFailure(
  _error: unknown,
): AuthorityFailureIsolation {
  return {
    event: 'P2_AUTHORITY_SHADOW_FALLBACK',
    state: 'FALLBACK_REQUIRED',
    reason: 'DETERMINISTIC_ERROR',
    p3Context: [],
    r1: null,
    contract: null,
    partialContractReleased: false,
  };
}

export function releaseP3ContextOrIsolate(args: {
  contractValid: boolean;
  p3: P3FieldContextShadow[];
}):
  | { ok: true; p3: P3FieldContextShadow[] }
  | { ok: false; isolation: AuthorityFailureIsolation } {
  if (!args.contractValid) {
    return {
      ok: false,
      isolation: isolateDeterministicAuthorityFailure('INVALID_CONTRACT'),
    };
  }
  return { ok: true, p3: args.p3 };
}
