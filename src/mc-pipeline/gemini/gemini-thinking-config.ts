/**
 * Controles de thinking del SDK @google/genai ^2.13.0.
 * Producción: thinkingConfig ausente (default del modelo).
 * Experimento: pasar un override explícito; nunca mezclar level y budget.
 */
import { ThinkingLevel, type ThinkingConfig } from '@google/genai';

export type Mc1ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

export type Mc1ThinkingConfig = {
  thinkingLevel?: Mc1ThinkingLevel;
  thinkingBudget?: number;
};

const SDK_THINKING_LEVEL: Record<Mc1ThinkingLevel, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

export function serializeThinkingConfig(
  cfg?: Mc1ThinkingConfig | null,
): string {
  if (!cfg) return 'absent';
  if (cfg.thinkingLevel) return `level:${cfg.thinkingLevel}`;
  if (typeof cfg.thinkingBudget === 'number') {
    return `budget:${cfg.thinkingBudget}`;
  }
  return 'absent';
}

/** Payload SDK. undefined = no enviar thinkingConfig (baseline productivo). */
export function toSdkThinkingConfig(
  cfg?: Mc1ThinkingConfig | null,
): ThinkingConfig | undefined {
  if (!cfg) return undefined;
  if (cfg.thinkingLevel) {
    return { thinkingLevel: SDK_THINKING_LEVEL[cfg.thinkingLevel] };
  }
  if (typeof cfg.thinkingBudget === 'number') {
    return { thinkingBudget: cfg.thinkingBudget };
  }
  return undefined;
}
