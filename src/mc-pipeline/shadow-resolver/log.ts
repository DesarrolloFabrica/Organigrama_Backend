import type { ShadowLogKind } from './types';

/** Observabilidad interna. No es ledger Gemini. No hay endpoint público. */
export function logShadow(
  event: ShadowLogKind,
  payload: Record<string, unknown>,
): void {
  // eslint-disable-next-line no-console
  console.info(
    JSON.stringify({
      channel: 'MC1.SHADOW.RESOLVER',
      event,
      gemini: false,
      ...payload,
    }),
  );
}
