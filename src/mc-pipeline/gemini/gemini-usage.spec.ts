import {
  emptyGeminiUsage,
  extractGeminiUsage,
  extractGeminiUsageRaw,
  normalizeGeminiUsage,
  thinkingUsageStatus,
} from './gemini-usage';

describe('gemini-usage', () => {
  it('maps SDK usageMetadata fields without inventing zeros', () => {
    const { usage, raw } = extractGeminiUsage({
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 4,
        totalTokenCount: 14,
        cachedContentTokenCount: 2,
        thoughtsTokenCount: 3,
        toolUsePromptTokenCount: 1,
      },
    });
    expect(raw).toEqual({
      promptTokenCount: 10,
      candidatesTokenCount: 4,
      totalTokenCount: 14,
      cachedContentTokenCount: 2,
      thoughtsTokenCount: 3,
      toolUsePromptTokenCount: 1,
    });
    expect(usage).toEqual({
      promptTokens: 10,
      candidateTokens: 4,
      totalTokens: 14,
      cachedTokens: 2,
      thinkingTokens: 3,
      toolUsePromptTokens: 1,
    });
    expect(thinkingUsageStatus(usage)).toBe('EXPOSED');
  });

  it('uses null when a metric is missing — never 0 for UNKNOWN', () => {
    const { usage } = extractGeminiUsage({
      usageMetadata: { promptTokenCount: 8, totalTokenCount: 8 },
    });
    expect(usage.promptTokens).toBe(8);
    expect(usage.candidateTokens).toBeNull();
    expect(usage.thinkingTokens).toBeNull();
    expect(usage.cachedTokens).toBeNull();
    expect(usage.toolUsePromptTokens).toBeNull();
    expect(thinkingUsageStatus(usage)).toBe('THINKING_USAGE_NOT_EXPOSED');
  });

  it('returns all-null when usageMetadata is absent', () => {
    expect(extractGeminiUsageRaw({})).toEqual({
      promptTokenCount: null,
      candidatesTokenCount: null,
      totalTokenCount: null,
      cachedContentTokenCount: null,
      thoughtsTokenCount: null,
      toolUsePromptTokenCount: null,
    });
    expect(extractGeminiUsage(null).usage).toEqual(emptyGeminiUsage());
  });

  it('ignores non-numeric SDK values', () => {
    const raw = extractGeminiUsageRaw({
      usageMetadata: { promptTokenCount: '12', thoughtsTokenCount: Number.NaN },
    });
    expect(raw.promptTokenCount).toBeNull();
    expect(raw.thoughtsTokenCount).toBeNull();
    expect(normalizeGeminiUsage(raw).thinkingTokens).toBeNull();
  });
});
