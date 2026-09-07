/**
 * Extracción de usageMetadata del SDK @google/genai.
 * null = métrica no entregada. Nunca se convierte UNKNOWN en 0.
 */

export type GeminiUsage = {
  promptTokens: number | null;
  candidateTokens: number | null;
  totalTokens: number | null;
  cachedTokens: number | null;
  thinkingTokens: number | null;
  toolUsePromptTokens: number | null;
};

/** Campos numéricos que el SDK declara en GenerateContentResponseUsageMetadata. */
export type GeminiUsageRaw = {
  promptTokenCount: number | null;
  candidatesTokenCount: number | null;
  totalTokenCount: number | null;
  cachedContentTokenCount: number | null;
  thoughtsTokenCount: number | null;
  toolUsePromptTokenCount: number | null;
};

function asIntOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function emptyGeminiUsage(): GeminiUsage {
  return {
    promptTokens: null,
    candidateTokens: null,
    totalTokens: null,
    cachedTokens: null,
    thinkingTokens: null,
    toolUsePromptTokens: null,
  };
}

export function extractGeminiUsageRaw(response: unknown): GeminiUsageRaw {
  const meta = (response as { usageMetadata?: Record<string, unknown> } | null)
    ?.usageMetadata;
  if (!meta || typeof meta !== 'object') {
    return {
      promptTokenCount: null,
      candidatesTokenCount: null,
      totalTokenCount: null,
      cachedContentTokenCount: null,
      thoughtsTokenCount: null,
      toolUsePromptTokenCount: null,
    };
  }
  return {
    promptTokenCount: asIntOrNull(meta.promptTokenCount),
    candidatesTokenCount: asIntOrNull(meta.candidatesTokenCount),
    totalTokenCount: asIntOrNull(meta.totalTokenCount),
    cachedContentTokenCount: asIntOrNull(meta.cachedContentTokenCount),
    thoughtsTokenCount: asIntOrNull(meta.thoughtsTokenCount),
    toolUsePromptTokenCount: asIntOrNull(meta.toolUsePromptTokenCount),
  };
}

export function normalizeGeminiUsage(raw: GeminiUsageRaw): GeminiUsage {
  return {
    promptTokens: raw.promptTokenCount,
    candidateTokens: raw.candidatesTokenCount,
    totalTokens: raw.totalTokenCount,
    cachedTokens: raw.cachedContentTokenCount,
    thinkingTokens: raw.thoughtsTokenCount,
    toolUsePromptTokens: raw.toolUsePromptTokenCount,
  };
}

export function extractGeminiUsage(response: unknown): {
  usage: GeminiUsage;
  raw: GeminiUsageRaw;
} {
  const raw = extractGeminiUsageRaw(response);
  return { usage: normalizeGeminiUsage(raw), raw };
}

export function thinkingUsageStatus(
  usage: GeminiUsage,
): 'EXPOSED' | 'THINKING_USAGE_NOT_EXPOSED' {
  return usage.thinkingTokens == null
    ? 'THINKING_USAGE_NOT_EXPOSED'
    : 'EXPOSED';
}
