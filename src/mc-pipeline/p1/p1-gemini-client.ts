/**
 * Cliente Gemini mínimo para prototipo P1 (texto JSON).
 * Instrumenta usageMetadata en el ledger local. No cambia modelo, temperatura ni prompts.
 */
import { GoogleGenAI } from '@google/genai';
import {
  GEMINI_JSON_CALL_CONFIG,
} from '../gemini/gemini-json-call-config';
import {
  recordGeminiCall,
  type GeminiLedgerContext,
} from '../gemini/gemini-ledger';
import {
  extractGeminiUsage,
  emptyGeminiUsage,
  type GeminiUsage,
  type GeminiUsageRaw,
} from '../gemini/gemini-usage';
import {
  toSdkThinkingConfig,
  type Mc1ThinkingConfig,
} from '../gemini/gemini-thinking-config';

export type P1GeminiCallResult = {
  text: string;
  model: string;
  attempt: number;
  usage: GeminiUsage;
  usageRaw: GeminiUsageRaw;
  durationMs: number;
};

export async function callP1GeminiJson(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPayload: string;
  attempt?: number;
  ledger?: GeminiLedgerContext;
  backendRoot?: string;
  thinkingConfig?: Mc1ThinkingConfig;
}): Promise<P1GeminiCallResult> {
  const attempt = params.attempt ?? 1;
  const t0 = Date.now();
  const ledgerCtx: GeminiLedgerContext = {
    ...(params.ledger ?? { phase: 'P1' }),
    phase: params.ledger?.phase ?? 'P1',
    model: params.model,
    attempt,
  };

  const record = (
    status: 'SUCCESS' | 'FAILED' | 'EXECUTED_FORCE',
    usage: GeminiUsage,
    usageRaw: GeminiUsageRaw | null,
    errorCode: string | null,
  ) => {
    recordGeminiCall({
      context: ledgerCtx,
      usage,
      usageRaw,
      status,
      durationMs: Date.now() - t0,
      errorCode,
      backendRoot: params.backendRoot,
    });
  };

  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const thinking = toSdkThinkingConfig(params.thinkingConfig);
  let response: unknown;
  try {
    response = await ai.models.generateContent({
      model: params.model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: params.systemPrompt },
            { text: '\n\n---\n\n' },
            { text: params.userPayload },
          ],
        },
      ],
      config: {
        responseMimeType: GEMINI_JSON_CALL_CONFIG.responseMimeType,
        temperature: GEMINI_JSON_CALL_CONFIG.temperature,
        ...(thinking ? { thinkingConfig: thinking } : {}),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record('FAILED', emptyGeminiUsage(), null, msg.slice(0, 180));
    throw err;
  }

  const { usage, raw } = extractGeminiUsage(response);
  const text =
    (response as { text?: string }).text?.trim() ?? '';
  if (!text) {
    record('FAILED', usage, raw, 'empty_model_response');
    throw new Error('empty_model_response');
  }
  const forceStatus =
    params.ledger?.forceRecompute === true ? 'EXECUTED_FORCE' : 'SUCCESS';
  record(forceStatus, usage, raw, null);
  return {
    text,
    model: params.model,
    attempt,
    usage,
    usageRaw: raw,
    durationMs: Date.now() - t0,
  };
}
