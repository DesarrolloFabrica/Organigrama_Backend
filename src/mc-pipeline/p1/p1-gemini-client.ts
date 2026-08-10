/**
 * Cliente Gemini mínimo para prototipo P1 (texto JSON).
 */
import { GoogleGenAI } from '@google/genai';

export type P1GeminiCallResult = {
  text: string;
  model: string;
  attempt: number;
};

export async function callP1GeminiJson(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPayload: string;
  attempt?: number;
}): Promise<P1GeminiCallResult> {
  const attempt = params.attempt ?? 1;
  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const response = await ai.models.generateContent({
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
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });
  const text = response.text?.trim() ?? '';
  if (!text) {
    throw new Error('empty_model_response');
  }
  return { text, model: params.model, attempt };
}
