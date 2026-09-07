/**
 * --force es opt-in. No tratar --force-live-ai como force recompute.
 */
export function resolveForceRecompute(explicit?: boolean): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  if (process.env.MC1_FORCE_GEMINI === '1') return true;
  return process.argv.includes('--force');
}
