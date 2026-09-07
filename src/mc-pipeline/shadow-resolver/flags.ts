/**
 * Flags de shadow / authority runtime.
 * MC1_SHADOW_RESOLVER_ENABLED controla SOLO emisión de eventos shadow.
 * Authority y skip Gemini están hardcodeados en false: no se activan por env.
 */
export const MC1_SHADOW_RESOLVER_FLAG = 'MC1_SHADOW_RESOLVER_ENABLED' as const;
export const MC1_P2_DETERMINISTIC_RESOLVER_FLAG = 'MC1_P2_DETERMINISTIC_RESOLVER_ENABLED' as const;
export const MC1_P2_DETERMINISTIC_AUTHORITY_FLAG = 'MC1_P2_DETERMINISTIC_AUTHORITY_ENABLED' as const;
export const MC1_P2_DETERMINISTIC_SKIP_GEMINI_FLAG = 'MC1_P2_DETERMINISTIC_SKIP_GEMINI' as const;
export const MC1_DETERMINISTIC_SKIP_GEMINI = false as const;
export const MC1_P2_DETERMINISTIC_AUTHORITY_ENABLED = false as const;
export const SHADOW_LATENCY_ALERT_MS = 500;
export const AUTHORITY_LATENCY_ALERT_MS = 500;

function envOn(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export function isShadowResolverEnabled(override?: boolean): boolean {
  if (override === true) return true;
  if (override === false) return false;
  return envOn(MC1_SHADOW_RESOLVER_FLAG);
}

/** Evaluación determinística (shadow). Default false. No implica autoridad. */
export function isP2DeterministicResolverEnabled(override?: boolean): boolean {
  if (override === true) return true;
  if (override === false) return false;
  return envOn(MC1_P2_DETERMINISTIC_RESOLVER_FLAG);
}

/** Autoridad productiva. Hardcode false en esta fase. Env se ignora. */
export function isP2DeterministicAuthorityEnabled(): false {
  void process.env[MC1_P2_DETERMINISTIC_AUTHORITY_FLAG];
  return MC1_P2_DETERMINISTIC_AUTHORITY_ENABLED;
}

/**
 * Kill switch de skip Gemini. Hardcode false.
 * Aunque env sea true, esta fase no salta Gemini.
 */
export function isP2DeterministicSkipGeminiEnabled(): false {
  void process.env[MC1_P2_DETERMINISTIC_SKIP_GEMINI_FLAG];
  return MC1_DETERMINISTIC_SKIP_GEMINI;
}

export function isDeterministicSkipGeminiEnabled(): false {
  return isP2DeterministicSkipGeminiEnabled();
}
