/**
 * Configuración JSON ya usada por callP1GeminiJson.
 * Extraída a constante para fingerprint de reuse — no cambia temperatura ni mime.
 */
export const GEMINI_JSON_CALL_CONFIG = {
  responseMimeType: 'application/json' as const,
  temperature: 0.2 as const,
};

export function geminiJsonCallConfigFingerprint(): string {
  return `mime=${GEMINI_JSON_CALL_CONFIG.responseMimeType}|temp=${GEMINI_JSON_CALL_CONFIG.temperature}`;
}
